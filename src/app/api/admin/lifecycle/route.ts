import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { applyRecordLifecycle, inspectRecordLifecycle, lifecycleEntities } from "@/lib/lifecycle/data";

const inspectSchema = z.object({ entity: z.enum(lifecycleEntities), id: z.string().uuid() }).strict();

const schema = z.object({
  entity: z.enum(lifecycleEntities),
  id: z.string().uuid(),
  action: z.enum(["delete", "archive", "deactivate", "cancel"]),
  reason: z.string().trim().min(3).max(1000),
}).strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!hasPermission(admin, "records:archive")) return NextResponse.json({ error: "No tiene permiso para esta acción." }, { status: 403 });
  const parsed = inspectSchema.safeParse({ entity: request.nextUrl.searchParams.get("entity"), id: request.nextUrl.searchParams.get("id") });
  if (!parsed.success) return NextResponse.json({ error: "No pudimos revisar este registro." }, { status: 400 });
  try { return NextResponse.json({ ok: true, info: await inspectRecordLifecycle(parsed.data.entity, parsed.data.id) }); }
  catch { return NextResponse.json({ error: "No pudimos revisar este registro." }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise la acción y escriba un motivo." }, { status: 400 });
  const permission = parsed.data.action === "delete" ? "records:delete_empty" : "records:archive";
  if (!hasPermission(admin, permission)) return NextResponse.json({ error: "No tiene permiso para esta acción." }, { status: 403 });
  try {
    const result = await applyRecordLifecycle(parsed.data.entity, parsed.data.id, parsed.data.action, parsed.data.reason);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 400;
    const message = error instanceof Error && !/constraint|foreign key|database|postgres|supabase/i.test(error.message)
      ? error.message
      : "No se pudo completar la acción porque el registro debe conservarse.";
    return NextResponse.json({ error: message }, { status });
  }
}
