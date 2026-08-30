import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return new NextResponse(null, { status: 401 });
  const uid = request.nextUrl.searchParams.get("uid")?.trim() || admin.uid;
  if (uid !== admin.uid && !["owner", "admin", "manager"].includes(admin.role)) return new NextResponse(null, { status: 403 });
  const client = createSupabaseAdminClient();
  const { data: profile } = await client.from("profiles").select("profile_photo_path").eq("id", uid).maybeSingle();
  if (!profile?.profile_photo_path) return new NextResponse(null, { status: 404 });
  const { data, error } = await client.storage.from("profile-photos").download(profile.profile_photo_path);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data.stream(), { headers: { "Content-Type": data.type || "image/jpeg", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
}
