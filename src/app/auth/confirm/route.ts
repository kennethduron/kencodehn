import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAdminNextPath } from "@/lib/supabase/auth-redirects";

const ALLOWED_TYPES = new Set<EmailOtpType>(["invite", "recovery", "email", "email_change"]);

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const fallback = rawType === "invite" ? "/admin/recovery?mode=invite" : "/admin/recovery";
  const next = resolveAdminNextPath(request.nextUrl.searchParams.get("next"), fallback);
  if (!tokenHash || !rawType || !ALLOWED_TYPES.has(rawType)) return privateRedirect(new URL("/admin/recovery?error=invalid_link", request.url));
  const { error } = await (await createSupabaseServerClient()).auth.verifyOtp({ token_hash: tokenHash, type: rawType });
  return privateRedirect(new URL(error ? "/admin/recovery?error=invalid_link" : next, request.url));
}
