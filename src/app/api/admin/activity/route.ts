import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createCrmRepositories } from "@/lib/data/repositories";

export const runtime = "nodejs";

const activityQuerySchema = z.object({
  leadId: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export async function GET(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "activity:view");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const parsed = activityQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Filtros invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const repositories = await createCrmRepositories();
  if (parsed.data.leadId && !(await repositories.leads.get(parsed.data.leadId, access.admin))) {
    return NextResponse.json({ ok: false, message: "Lead no encontrado." }, { status: 404 });
  }
  const activity = await repositories.activity.list(access.admin, parsed.data.leadId, parsed.data.limit);
  return NextResponse.json({ ok: true, activity });
}
