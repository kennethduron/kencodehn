import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { adminSettingsSchema, canManageSettings, getAdminSettings, updateAdminSettings } from "@/lib/admin/settings";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  const settings = await getAdminSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  if (!canManageSettings(admin)) {
    return NextResponse.json({ ok: false, message: "No tienes permiso para administrar configuracion." }, { status: 403 });
  }
  const parsed = adminSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Datos invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const settings = await updateAdminSettings(parsed.data, admin);
  return NextResponse.json({ ok: true, settings });
}
