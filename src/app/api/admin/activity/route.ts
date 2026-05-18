import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { listActivityLogs } from "@/lib/admin/data";

export const runtime = "nodejs";

const activityQuerySchema = z.object({
  leadId: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const parsed = activityQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Filtros invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const activity = await listActivityLogs(parsed.data.leadId, parsed.data.limit);
  return NextResponse.json({ ok: true, activity });
}
