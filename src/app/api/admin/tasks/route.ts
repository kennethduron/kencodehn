import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { checkOverdueTasks, createTask, listTasks } from "@/lib/admin/data";

export const runtime = "nodejs";

const taskSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1200).default(""),
  leadId: z.string().trim().nullable().optional(),
  leadName: z.string().trim().nullable().optional(),
  date: z.string().trim().min(4).max(20),
  time: z.string().trim().min(3).max(10),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).default("pending"),
  type: z.enum(["call", "whatsapp", "email", "meeting", "proposal", "follow_up"]).default("follow_up"),
}).strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  await checkOverdueTasks(admin);
  const leadId = request.nextUrl.searchParams.get("leadId") ?? undefined;
  const tasks = await listTasks(leadId);
  return NextResponse.json({ ok: true, tasks });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const parsed = taskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Datos invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;
  await createTask(input, admin);
  const tasks = await listTasks();
  return NextResponse.json({ ok: true, tasks });
}
