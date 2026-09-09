import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mayAccessThread } from "@/lib/mail/service";
import { uuidSchema } from "@/lib/mail/security";
import {
  contentDispositionHeader,
  isPreviewableAttachmentType,
  MAX_MAIL_ATTACHMENT_BYTES,
  sanitizeAttachmentFilename,
  validateMailAttachment,
} from "@/lib/mail/attachment-security";

export async function POST(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const form = await request.formData();
  const draftId = form.get("draftId");
  const file = form.get("file");
  if (!uuidSchema.safeParse(draftId).success || !(file instanceof File)) {
    return NextResponse.json({ error: "Adjunto inválido." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_MAIL_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Cada adjunto debe pesar como máximo 10 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const filename = sanitizeAttachmentFilename(file.name);
  const validation = validateMailAttachment(bytes, filename, file.type);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason === "dangerous" ? "Este tipo de archivo es peligroso y fue rechazado." : "El contenido del archivo no coincide con un tipo permitido." },
      { status: 415 },
    );
  }

  const client = createSupabaseAdminClient();
  const { data: draft } = await client.from("mail_drafts").select("id").eq("id", String(draftId)).eq("owner_id", auth.admin.uid).maybeSingle();
  if (!draft) return NextResponse.json({ error: "Borrador no autorizado." }, { status: 403 });
  const id = crypto.randomUUID();
  const path = `${auth.admin.uid}/${draft.id}/${id}`;
  const upload = await client.storage.from("mail-attachments").upload(path, bytes, { contentType: validation.contentType, upsert: false });
  if (upload.error) return NextResponse.json({ error: "No pudimos guardar el adjunto." }, { status: 500 });
  const row = await client.from("mail_attachments").insert({
    id,
    draft_id: draft.id,
    storage_path: path,
    filename,
    content_type: validation.contentType,
    size_bytes: bytes.length,
  }).select("id,filename,size_bytes").single();
  if (row.error) {
    await client.storage.from("mail-attachments").remove([path]);
    return NextResponse.json({ error: "No pudimos registrar el adjunto." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, attachment: row.data });
}

export async function GET(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use");
  if (!auth.ok) return new NextResponse(null, { status: auth.status });
  const id = request.nextUrl.searchParams.get("id");
  if (!uuidSchema.safeParse(id).success) return new NextResponse(null, { status: 400 });

  const client = createSupabaseAdminClient();
  const { data } = await client.from("mail_attachments")
    .select("storage_path,filename,content_type,message_id,draft_id,mail_messages(thread_id),mail_drafts(owner_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new NextResponse(null, { status: 404 });
  const message = Array.isArray(data.mail_messages) ? data.mail_messages[0] : data.mail_messages;
  const draft = Array.isArray(data.mail_drafts) ? data.mail_drafts[0] : data.mail_drafts;
  const allowed = message?.thread_id ? await mayAccessThread(auth.admin, message.thread_id) : draft?.owner_id === auth.admin.uid;
  if (!allowed) return new NextResponse(null, { status: 403 });

  const file = await client.storage.from("mail-attachments").download(data.storage_path);
  if (file.error || !file.data) return new NextResponse(null, { status: 404 });
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  const validation = validateMailAttachment(bytes, data.filename, data.content_type);
  if (!validation.ok) {
    return new NextResponse(null, { status: 415, headers: { "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
  }
  const requestedMode = request.nextUrl.searchParams.get("mode");
  const mode = requestedMode === "inline" && isPreviewableAttachmentType(validation.contentType) ? "inline" : "attachment";
  await client.from("mail_audit_events").insert({ action: "mail_attachment_accessed", actor_id: auth.admin.uid, safe_metadata: { attachmentId: id, mode } });
  return new NextResponse(file.data, { headers: {
    "Content-Type": validation.contentType,
    "Content-Disposition": contentDispositionHeader(data.filename, mode),
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store",
  } });
}
