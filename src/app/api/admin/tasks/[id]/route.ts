import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { deleteTask, listTasks, updateTask } from "@/lib/admin/data";

export const runtime = "nodejs";

const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1200).optional(),
  leadId: z.string().trim().nullable().optional(),
  leadName: z.string().trim().nullable().optional(),
  date: z.string().trim().min(4).max(20).optional(),
  time: z.string().trim().min(3).max(10).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
  type: z.enum(["call", "whatsapp", "email", "meeting", "proposal", "follow_up"]).optional(),
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, "tasks:edit");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const admin = access.admin;
  const { id } = await params;
  const parsed = taskUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Datos invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const updates = parsed.data;
  await updateTask(id, updates, admin);
  const tasks = await listTasks();
  return NextResponse.json({ ok: true, tasks });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, "tasks:delete");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const admin = access.admin;
  const { id } = await params;
  await deleteTask(id, admin);
  const tasks = await listTasks();
  return NextResponse.json({ ok: true, tasks });
}
