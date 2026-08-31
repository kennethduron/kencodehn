import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { profileFieldErrors, profileSchema } from "@/lib/admin/profile-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const photoTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

async function updateOwnProfile(changes: Record<string, unknown>, operation: string) {
  const result = await (await createSupabaseServerClient()).rpc("update_own_profile", { p_changes: changes });
  const { error } = result;
  if (error) {
    console.error("[Ken Code CRM profile mutation]", { operation, code: error.code || "unknown" });
  }
  return result;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await (await createSupabaseServerClient()).from("profiles").select("email,name,display_name,preferred_name,job_title,phone,locale,profile_photo_path").eq("id", admin.uid).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "No pudimos cargar el perfil." }, { status: 500 });
  return NextResponse.json({ profile: { email: data.email, displayName: data.display_name || data.name || "", preferredName: data.preferred_name, jobTitle: data.job_title, phone: data.phone, locale: data.locale, hasPhoto: Boolean(data.profile_photo_path) } });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corrija los campos indicados.", fieldErrors: profileFieldErrors(parsed.error) }, { status: 400 });
  const updated = await updateOwnProfile(parsed.data, "details");
  if (updated.error) return NextResponse.json({ error: "No pudimos guardar el perfil." }, { status: 500 });
  return NextResponse.json({ ok: true, profile: {
    displayName: updated.data.display_name,
    preferredName: updated.data.preferred_name,
    jobTitle: updated.data.job_title,
    phone: updated.data.phone,
    locale: updated.data.locale,
  } });
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
  const updated = await updateOwnProfile({ profilePhotoPath: path }, "photo_upload");
  if (updated.error) { await client.storage.from("profile-photos").remove([path]); return NextResponse.json({ error: "No pudimos actualizar el perfil." }, { status: 500 }); }
  if (current?.profile_photo_path && current.profile_photo_path !== path) {
    const removed = await client.storage.from("profile-photos").remove([current.profile_photo_path]);
    if (removed.error) {
      const rollback = await updateOwnProfile({ profilePhotoPath: current.profile_photo_path }, "photo_replace_rollback");
      if (!rollback.error) await client.storage.from("profile-photos").remove([path]);
      return NextResponse.json({ error: "No pudimos reemplazar la foto de forma segura. La imagen anterior se conservó." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const client = createSupabaseAdminClient();
  const { data } = await client.from("profiles").select("profile_photo_path").eq("id", admin.uid).maybeSingle();
  const previousPath = data?.profile_photo_path;
  const updated = await updateOwnProfile({ profilePhotoPath: null }, "photo_remove");
  if (updated.error) return NextResponse.json({ error: "No pudimos quitar la imagen." }, { status: 500 });
  if (previousPath) {
    const removed = await client.storage.from("profile-photos").remove([previousPath]);
    if (removed.error) {
      await updateOwnProfile({ profilePhotoPath: previousPath }, "photo_remove_rollback");
      return NextResponse.json({ error: "No pudimos quitar la foto de forma segura. Inténtelo nuevamente." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
