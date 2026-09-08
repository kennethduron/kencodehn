import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ownerId = "f2d4ab72-a373-53c3-8b9e-b8cf97174ed2";
const objectPath = `corporate/${ownerId}/qa-kencode-logo-2026-09-08.webp`;
const draftId = "8e6e1d70-5d15-4d25-9a08-202609080001";
const attachmentId = "8e6e1d70-5d15-4d25-9a08-202609080002";
const attachmentPath = `${ownerId}/${draftId}/${attachmentId}`;

function authorized(request: NextRequest) {
  const normalize = (value: string | undefined | null) => (value ?? "").trim().replace(/^["']|["']$/g, "");
  const expected = normalize(process.env.CRON_SECRET);
  const received = normalize(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length > 0
    && expectedBuffer.length === receivedBuffer.length
    && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const client = createSupabaseAdminClient();
  const body = await request.json().catch(() => ({}));
  if (body.action === "prepare_email") {
    const [identity, signature, existingDraft, existingAttachment] = await Promise.all([
      client.from("mail_identities").select("id").eq("email", "kenneth@kencodehn.com").eq("status", "active").single(),
      client.from("corporate_mail_signatures").select("id").eq("name", "Firma QA Kenneth — 2026-09-08").eq("active", true).single(),
      client.from("mail_drafts").select("id").eq("id", draftId).maybeSingle(),
      client.from("mail_attachments").select("id").eq("id", attachmentId).maybeSingle(),
    ]);
    if (!identity.data || !signature.data) return NextResponse.json({ error: "La identidad o firma QA no está lista." }, { status: 409 });
    if (!existingDraft.data) {
      const created = await client.from("mail_drafts").insert({
        id: draftId,
        owner_id: ownerId,
        identity_id: identity.data.id,
        signature_selection: `corporate:${signature.data.id}`,
        to_addresses: [{ email: "kencodehn@gmail.com" }],
        cc_addresses: [],
        bcc_addresses: [],
        subject: "QA — Ken Code Mail, firma y adjunto — 2026-09-08",
        body_html: "<p>Hola Kenneth,</p><p>Este es el único correo autorizado para el checkpoint final de Ken Code Mail. Incluye una firma limitada a kenneth@kencodehn.com y un adjunto seguro de QA.</p><p>Por favor, confirme visualmente que el logo y la firma aparecen correctamente fuera del CRM y responda a este mismo hilo para validar la recepción y el threading.</p><p>Saludos.</p>",
        body_text: "Hola Kenneth,\n\nEste es el único correo autorizado para el checkpoint final de Ken Code Mail. Incluye una firma limitada a kenneth@kencodehn.com y un adjunto seguro de QA.\n\nPor favor, confirme visualmente que el logo y la firma aparecen correctamente fuera del CRM y responda a este mismo hilo para validar la recepción y el threading.\n\nSaludos.",
      });
      if (created.error) return NextResponse.json({ error: "No pudimos preparar el borrador QA." }, { status: 500 });
    }
    if (!existingAttachment.data) {
      const content = Buffer.from("KEN CODE CRM — QA MAIL CHECKPOINT\nDate: 2026-09-08\nAuthorized sender: kenneth@kencodehn.com\nAuthorized recipient: kencodehn@gmail.com\nThis attachment contains no client or financial data.\n", "utf8");
      const uploaded = await client.storage.from("mail-attachments").upload(attachmentPath, content, {
        contentType: "text/plain; charset=utf-8",
        upsert: false,
      });
      if (uploaded.error) return NextResponse.json({ error: "No pudimos cargar el adjunto QA." }, { status: 500 });
      const attached = await client.from("mail_attachments").insert({
        id: attachmentId,
        draft_id: draftId,
        storage_path: attachmentPath,
        filename: "QA-MAIL-CHECKPOINT-2026-09-08.txt",
        content_type: "text/plain",
        size_bytes: content.length,
      });
      if (attached.error) return NextResponse.json({ error: "No pudimos registrar el adjunto QA." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, draftId, attachmentId, reused: Boolean(existingDraft.data && existingAttachment.data) });
  }

  const { data: existing } = client.storage.from("mail-signature-assets").getPublicUrl(objectPath);
  const existingObjects = await client.storage.from("mail-signature-assets").list(`corporate/${ownerId}`, {
    search: "qa-kencode-logo-2026-09-08.webp",
  });
  if (existingObjects.data?.some((item) => item.name === "qa-kencode-logo-2026-09-08.webp")) {
    return NextResponse.json({ ok: true, url: existing.publicUrl, reused: true });
  }

  const input = await readFile(path.join(process.cwd(), "public", "images", "brand", "kencode-logo.jpg"));
  const output = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: 1200, height: 600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
  const uploaded = await client.storage.from("mail-signature-assets").upload(objectPath, output, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploaded.error) return NextResponse.json({ error: "No pudimos cargar el logo QA." }, { status: 500 });
  const { data } = client.storage.from("mail-signature-assets").getPublicUrl(objectPath);
  return NextResponse.json({ ok: true, url: data.publicUrl, size: output.length, reused: false });
}
