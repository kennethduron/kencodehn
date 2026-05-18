import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { deleteTask, listTasks, updateTask } from "@/lib/admin/data";

export const runtime = "nodejs";

const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1200).optional(),
  date: z.string().trim().min(4).max(20).optional(),
  time: z.string().trim().min(3).max(10).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
  type: z.enum(["call", "whatsapp", "email", "meeting", "proposal", "follow_up"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const updates = taskUpdateSchema.parse(await request.json());
  await updateTask(id, updates, admin);
  const tasks = await listTasks();
  return NextResponse.json({ ok: true, tasks });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  await deleteTask(id, admin);
  const tasks = await listTasks();
  return NextResponse.json({ ok: true, tasks });
}
