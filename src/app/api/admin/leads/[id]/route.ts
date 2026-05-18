import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { getLead, updateLead } from "@/lib/admin/data";

export const runtime = "nodejs";

const leadUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "conversation", "quoted", "won", "lost"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  estimatedValue: z.coerce.number().min(0).optional(),
  wonValue: z.coerce.number().min(0).optional(),
  lastContactAt: z.string().nullable().optional(),
  nextAction: z.string().max(240).optional(),
  followUpAt: z.string().nullable().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ ok: false, message: "Lead no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lead });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const updates = leadUpdateSchema.parse(await request.json());
  await updateLead(id, updates, admin);
  const lead = await getLead(id);
  return NextResponse.json({ ok: true, lead });
}
