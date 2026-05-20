import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { canRunMaintenance, cleanupOperationalData, getCleanupSummary } from "@/lib/admin/cleanup";

export const runtime = "nodejs";

const cleanupSchema = z.object({
  confirmation: z.literal("LIMPIAR"),
}).strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  if (!canRunMaintenance(admin)) {
    return NextResponse.json({ ok: false, message: "No tienes permiso para ver mantenimiento." }, { status: 403 });
  }
  const summary = await getCleanupSummary();
  return NextResponse.json({ ok: true, summary });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  if (!canRunMaintenance(admin)) {
    return NextResponse.json({ ok: false, message: "No tienes permiso para limpiar el CRM." }, { status: 403 });
  }

  const parsed = cleanupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Confirmacion invalida. Escribe LIMPIAR para continuar." }, { status: 400 });
  }

  const before = await getCleanupSummary();
  const deleted = await cleanupOperationalData();
  return NextResponse.json({ ok: true, before, deleted });
}
