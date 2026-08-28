import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { adminSettingsSchema, canManageSettings } from "@/lib/admin/settings";
import { createCrmRepositories } from "@/lib/data/repositories";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "settings:view");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const settings = await (await createCrmRepositories()).settings.get();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "settings:manage");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const admin = access.admin;
  if (!canManageSettings(admin)) {
    return NextResponse.json({ ok: false, message: "No tienes permiso para administrar configuracion." }, { status: 403 });
  }
  const parsed = adminSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Datos invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const settings = await (await createCrmRepositories()).settings.update(parsed.data, admin);
  return NextResponse.json({ ok: true, settings });
}
