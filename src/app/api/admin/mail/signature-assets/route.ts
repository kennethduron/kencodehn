import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const form = await request.formData();
  const file = form.get("file");
  const scope = form.get("scope") === "corporate" ? "corporate" : "personal";
  if (scope === "corporate" && auth.admin.role !== "owner") return NextResponse.json({ error: "Solo el Owner puede cambiar la imagen corporativa." }, { status: 403 });
  if (!(file instanceof File) || !allowed.has(file.type)) return NextResponse.json({ error: "Seleccione una imagen PNG, JPG o WebP." }, { status: 415 });
  if (file.size <= 0 || file.size > 512_000) return NextResponse.json({ error: "La imagen debe pesar como máximo 500 KB." }, { status: 413 });
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { failOn: "error" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 6000 || metadata.height > 6000) return NextResponse.json({ error: "Las dimensiones de la imagen no son válidas." }, { status: 400 });
    const output = await image.rotate().resize({ width: 1200, height: 600, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    if (output.length > 512_000) return NextResponse.json({ error: "La imagen optimizada supera 500 KB." }, { status: 413 });
    const client = createSupabaseAdminClient();
    const path = `${scope}/${auth.admin.uid}/${crypto.randomUUID()}.webp`;
    const uploaded = await client.storage.from("mail-signature-assets").upload(path, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (uploaded.error) throw uploaded.error;
    const { data } = client.storage.from("mail-signature-assets").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl, width: metadata.width, height: metadata.height, size: output.length });
  } catch (error) {
    console.error("[Ken Code Mail signature image]", error);
    return NextResponse.json({ error: "No pudimos procesar la imagen." }, { status: 400 });
  }
}
