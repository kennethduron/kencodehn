import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { MANAGEABLE_ADMIN_ROLES } from "@/lib/admin/authorization";
import { AdminUserManagementError, inviteAdminMember } from "@/lib/admin/users";
import { validateUsername } from "@/lib/auth/username";

export const runtime = "nodejs";

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  role: z.enum(MANAGEABLE_ADMIN_ROLES),
  username: z.string().trim().max(32).optional(),
}).strict();

export async function POST(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "users:manage");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invitacion invalida.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (parsed.data.username) {
    const username = validateUsername(parsed.data.username);
    if (!username.ok) return NextResponse.json({ ok: false, message: username.reason }, { status: 400 });
  }
  try {
    const result = await inviteAdminMember(parsed.data, access.admin);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error("[Ken Code CRM invitation error]", error);
    return NextResponse.json({ ok: false, message: "No se pudo preparar la invitacion." }, { status: 500 });
  }
}
