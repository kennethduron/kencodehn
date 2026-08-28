import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { getAccessibleLead, listActivityLogs } from "@/lib/admin/data";

export const runtime = "nodejs";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).strict();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, ["leads:view", "activity:view"]);
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const { id } = await params;
  if (!(await getAccessibleLead(id, access.admin))) return NextResponse.json({ ok: false, message: "Lead no encontrado." }, { status: 404 });
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Filtros invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const activity = await listActivityLogs(id, parsed.data.limit);
  return NextResponse.json({ ok: true, activity });
}
