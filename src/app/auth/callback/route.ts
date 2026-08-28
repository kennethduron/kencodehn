import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAdminNextPath } from "@/lib/supabase/auth-redirects";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = resolveAdminNextPath(request.nextUrl.searchParams.get("next"), "/admin");
  if (!code) return NextResponse.redirect(new URL("/admin/recovery?error=missing_code", request.url));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/admin/recovery?error=invalid_link" : next, request.url));
}
