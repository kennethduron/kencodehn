import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const profileSchema = z.object({
  displayName: z.string().trim().max(160), preferredName: z.string().trim().max(100),
  jobTitle: z.string().trim().max(140), phone: z.string().trim().max(60),
  locale: z.enum(["es-HN", "en-US"]),
}).strict();
const photoTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await createSupabaseAdminClient().from("profiles").select("email,display_name,preferred_name,job_title,phone,locale,profile_photo_path").eq("id", admin.uid).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "No pudimos cargar el perfil." }, { status: 500 });
  return NextResponse.json({ profile: { email: data.email, displayName: data.display_name, preferredName: data.preferred_name, jobTitle: data.job_title, phone: data.phone, locale: data.locale, hasPhoto: Boolean(data.profile_photo_path) } });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise los datos del perfil." }, { status: 400 });
  const { error } = await createSupabaseAdminClient().from("profiles").update({ display_name: parsed.data.displayName, preferred_name: parsed.data.preferredName, job_title: parsed.data.jobTitle, phone: parsed.data.phone, locale: parsed.data.locale, updated_at: new Date().toISOString() }).eq("id", admin.uid).eq("active", true);
  return error ? NextResponse.json({ error: "No pudimos guardar el perfil." }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const photo = (await request.formData()).get("photo");
  if (!(photo instanceof File)) return NextResponse.json({ error: "Seleccione una imagen." }, { status: 400 });
  const extension = photoTypes.get(photo.type);
  if (!extension) return NextResponse.json({ error: "Use una imagen JPG, PNG o WebP." }, { status: 415 });
  if (photo.size <= 0 || photo.size > 2 * 1024 * 1024) return NextResponse.json({ error: "La imagen debe pesar menos de 2 MB." }, { status: 413 });
  const client = createSupabaseAdminClient();
  const { data: current } = await client.from("profiles").select("profile_photo_path").eq("id", admin.uid).maybeSingle();
  const path = `${admin.uid}/${crypto.randomUUID()}.${extension}`;
  const uploaded = await client.storage.from("profile-photos").upload(path, new Uint8Array(await photo.arrayBuffer()), { contentType: photo.type, upsert: false, cacheControl: "3600" });
  if (uploaded.error) return NextResponse.json({ error: "No pudimos guardar la imagen." }, { status: 500 });
  const updated = await client.from("profiles").update({ profile_photo_path: path, updated_at: new Date().toISOString() }).eq("id", admin.uid).eq("active", true);
  if (updated.error) { await client.storage.from("profile-photos").remove([path]); return NextResponse.json({ error: "No pudimos actualizar el perfil." }, { status: 500 }); }
  if (current?.profile_photo_path && current.profile_photo_path !== path) await client.storage.from("profile-photos").remove([current.profile_photo_path]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const client = createSupabaseAdminClient();
  const { data } = await client.from("profiles").select("profile_photo_path").eq("id", admin.uid).maybeSingle();
  const { error } = await client.from("profiles").update({ profile_photo_path: null, updated_at: new Date().toISOString() }).eq("id", admin.uid).eq("active", true);
  if (error) return NextResponse.json({ error: "No pudimos quitar la imagen." }, { status: 500 });
  if (data?.profile_photo_path) await client.storage.from("profile-photos").remove([data.profile_photo_path]);
  return NextResponse.json({ ok: true });
}
