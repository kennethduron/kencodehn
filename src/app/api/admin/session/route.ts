import { NextRequest, NextResponse } from "next/server";
import { createCrmSession, CRM_SESSION_COOKIE, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    missingServerEnv: getMissingAdminEnv(),
    missingClientEnv: getMissingFirebaseClientEnv(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ ok: false, message: "Token de Firebase requerido." }, { status: 400 });
    }

    const result = await createCrmSession(idToken);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
    }

    const response = NextResponse.json({ ok: true, admin: result.admin });
    response.cookies.set(CRM_SESSION_COOKIE, result.sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: result.maxAge,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("[Ken Code CRM session error]", error);
    return NextResponse.json({ ok: false, message: "No se pudo iniciar sesion." }, { status: 500 });
  }
}
