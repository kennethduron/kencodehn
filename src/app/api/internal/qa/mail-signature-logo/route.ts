import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ownerId = "f2d4ab72-a373-53c3-8b9e-b8cf97174ed2";
const objectPath = `corporate/${ownerId}/qa-kencode-logo-2026-09-08.webp`;

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
