import { NextResponse } from "next/server";
import { CRM_SESSION_COOKIE } from "@/lib/admin/auth";

export async function POST() {
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
