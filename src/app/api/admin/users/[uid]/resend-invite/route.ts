import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { AdminUserManagementError, resendAdminInvitation } from "@/lib/admin/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const access = await requirePermissionsFromRequest(request, "users:manage");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const { uid } = await params;
  try {
    const result = await resendAdminInvitation(uid, access.admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error("[Ken Code CRM invitation retry error]", error);
    return NextResponse.json({ ok: false, message: "No se pudo reenviar la invitacion." }, { status: 500 });
  }
}
