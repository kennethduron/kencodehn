import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { canRunMaintenance, getCleanupSummary } from "@/lib/admin/cleanup";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "maintenance:run");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const admin = access.admin;
  if (!canRunMaintenance(admin)) {
    return NextResponse.json({ ok: false, message: "No tienes permiso para ver mantenimiento." }, { status: 403 });
  }
  const summary = await getCleanupSummary();
  return NextResponse.json({ ok: true, summary });
}

export async function POST(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "maintenance:run");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  if (!canRunMaintenance(access.admin)) {
    return NextResponse.json({ ok: false, message: "No tienes permiso para limpiar el CRM." }, { status: 403 });
  }
  return NextResponse.json({
    ok: false,
    message: "La limpieza legacy fue deshabilitada. Utiliza el baseline verificado de Phase 1.",
  }, { status: 410 });
}
