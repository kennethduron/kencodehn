import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { MANAGEABLE_ADMIN_ROLES } from "@/lib/admin/authorization";
import { AdminUserManagementError, updateAdminMember } from "@/lib/admin/users";

export const runtime = "nodejs";

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(MANAGEABLE_ADMIN_ROLES).optional(),
  active: z.boolean().optional(),
}).strict().refine((input) => Object.keys(input).length > 0, { message: "No hay cambios." });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const access = await requirePermissionsFromRequest(request, "users:manage");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Cambios invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { uid } = await params;
  try {
    const user = await updateAdminMember(uid, parsed.data, access.admin);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error("[Ken Code CRM user update error]", error);
    return NextResponse.json({ ok: false, message: "No se pudo actualizar el usuario." }, { status: 500 });
  }
}
