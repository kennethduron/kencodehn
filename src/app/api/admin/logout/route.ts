import { NextResponse } from "next/server";
import { CRM_SESSION_COOKIE } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (getCrmAuthProvider() === "supabase") await (await createSupabaseServerClient()).auth.signOut({ scope: "local" });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CRM_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
