import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { canRunMaintenance, deleteLeadCascade, getLeadDeletionSummary } from "@/lib/admin/cleanup";
import { getLead, updateLead } from "@/lib/admin/data";

export const runtime = "nodejs";

const leadUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "conversation", "quoted", "won", "lost"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  estimatedValue: z.coerce.number().min(0).optional(),
  initialProjectAmount: z.coerce.number().min(0).optional(),
  monthlyFee: z.coerce.number().min(0).optional(),
  paymentStatus: z.enum(["not_started", "pending", "partial", "paid", "overdue", "active"]).optional(),
  billingStartDate: z.string().trim().max(40).nullable().optional(),
  billingNotes: z.string().trim().max(1000).optional(),
  wonValue: z.coerce.number().min(0).optional(),
  lastContactAt: z.string().trim().max(40).nullable().optional(),
  nextAction: z.string().trim().max(240).optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
  followUpTime: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
  followUpTimezone: z.literal("America/Tegucigalpa").optional(),
  followUpAt: z.string().trim().max(40).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
}).strict();

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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  if (!canRunMaintenance(admin)) {
    return NextResponse.json({ ok: false, message: "No tienes permiso para eliminar leads." }, { status: 403 });
  }
  const { id } = await params;
  const summary = await getLeadDeletionSummary(id);
  if (summary.leads === 0) {
    return NextResponse.json({ ok: false, message: "Lead no encontrado." }, { status: 404 });
  }
  const deleted = await deleteLeadCascade(id);
  return NextResponse.json({ ok: true, deleted });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const parsed = leadUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Datos invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const updates = parsed.data;
  await updateLead(id, updates, admin);
  const lead = await getLead(id);
  return NextResponse.json({ ok: true, lead });
}
