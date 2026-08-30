import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mayAccessThread } from "@/lib/mail/service";
import { uuidSchema } from "@/lib/mail/security";

const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain"]);

export async function POST(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use"); if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const form = await request.formData(); const draftId = form.get("draftId"); const file = form.get("file");
  if (!uuidSchema.safeParse(draftId).success || !(file instanceof File)) return NextResponse.json({ error: "Adjunto inválido." }, { status: 400 });
  if (!allowed.has(file.type)) return NextResponse.json({ error: "Tipo de archivo no permitido." }, { status: 415 });
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Cada adjunto debe pesar menos de 10 MB." }, { status: 413 });
  const client = createSupabaseAdminClient(); const { data: draft } = await client.from("mail_drafts").select("id").eq("id", String(draftId)).eq("owner_id", auth.admin.uid).maybeSingle(); if (!draft) return NextResponse.json({ error: "Borrador no autorizado." }, { status: 403 });
  const id = crypto.randomUUID(); const path = `${auth.admin.uid}/${draft.id}/${id}`; const upload = await client.storage.from("mail-attachments").upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false }); if (upload.error) return NextResponse.json({ error: "No pudimos guardar el adjunto." }, { status: 500 });
  const row = await client.from("mail_attachments").insert({ id, draft_id: draft.id, storage_path: path, filename: file.name.replace(/[\r\n]/g, "").slice(0, 255) || "archivo", content_type: file.type, size_bytes: file.size }).select("id,filename,size_bytes").single(); if (row.error) { await client.storage.from("mail-attachments").remove([path]); return NextResponse.json({ error: "No pudimos registrar el adjunto." }, { status: 500 }); }
  return NextResponse.json({ ok: true, attachment: row.data });
}

export async function GET(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use"); if (!auth.ok) return new NextResponse(null, { status: auth.status });
  const id = request.nextUrl.searchParams.get("id"); if (!uuidSchema.safeParse(id).success) return new NextResponse(null, { status: 400 });
  const client = createSupabaseAdminClient(); const { data } = await client.from("mail_attachments").select("storage_path,filename,content_type,message_id,draft_id,mail_messages(thread_id),mail_drafts(owner_id)").eq("id", id).maybeSingle(); if (!data) return new NextResponse(null, { status: 404 });
  const message = Array.isArray(data.mail_messages) ? data.mail_messages[0] : data.mail_messages; const draft = Array.isArray(data.mail_drafts) ? data.mail_drafts[0] : data.mail_drafts; const allowed = message?.thread_id ? await mayAccessThread(auth.admin, message.thread_id) : draft?.owner_id === auth.admin.uid; if (!allowed) return new NextResponse(null, { status: 403 });
  const file = await client.storage.from("mail-attachments").download(data.storage_path); if (file.error || !file.data) return new NextResponse(null, { status: 404 });
  await client.from("mail_audit_events").insert({ action: "mail_attachment_accessed", actor_id: auth.admin.uid, safe_metadata: { attachmentId: id } });
  const safeName = data.filename.replace(/["\r\n]/g, "_"); return new NextResponse(file.data.stream(), { headers: { "Content-Type": data.content_type, "Content-Disposition": `attachment; filename="${safeName}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
