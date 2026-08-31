import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { MANAGEABLE_ADMIN_ROLES } from "@/lib/admin/authorization";
import {
  AdminUserManagementError,
  assessAdminMemberDeletion,
  deleteAdminMemberWithoutHistory,
  updateAdminMember,
} from "@/lib/admin/users";

export const runtime = "nodejs";

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(MANAGEABLE_ADMIN_ROLES).optional(),
  active: z.boolean().optional(),
}).strict().refine((input) => Object.keys(input).length > 0, { message: "No hay cambios." });
const uidSchema = z.uuid();

function userError(error: unknown, fallback: string) {
  if (error instanceof AdminUserManagementError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  }
  console.error("[Ken Code CRM user management error]", error);
  return NextResponse.json({ ok: false, message: fallback }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const access = await requirePermissionsFromRequest(request, "users:manage");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  if (access.admin.role !== "owner") return NextResponse.json({ ok: false, message: "Solo el Owner puede comprobar una eliminación definitiva." }, { status: 403 });
  const parsedUid = uidSchema.safeParse((await params).uid);
  if (!parsedUid.success) return NextResponse.json({ ok: false, message: "Miembro no válido." }, { status: 400 });
  try {
    const assessment = await assessAdminMemberDeletion(parsedUid.data, access.admin);
    return NextResponse.json({ ok: true, assessment });
  } catch (error) {
    return userError(error, "No pudimos comprobar el historial del miembro.");
  }
}

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
    return userError(error, "No se pudo actualizar el usuario.");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const access = await requirePermissionsFromRequest(request, "users:manage");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  if (access.admin.role !== "owner") return NextResponse.json({ ok: false, message: "Solo el Owner puede eliminar miembros definitivamente." }, { status: 403 });
  const parsedUid = uidSchema.safeParse((await params).uid);
  if (!parsedUid.success) return NextResponse.json({ ok: false, message: "Miembro no válido." }, { status: 400 });
  try {
    const deleted = await deleteAdminMemberWithoutHistory(parsedUid.data, access.admin);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    return userError(error, "No pudimos eliminar el miembro de forma segura.");
  }
}
