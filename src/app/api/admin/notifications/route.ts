import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { listNotifications, markAllNotificationsRead } from "@/lib/admin/data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const notifications = await listNotifications();
  return NextResponse.json({ ok: true, notifications });
}

const bulkSchema = z.object({
  action: z.literal("mark_all_read"),
}).strict();

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const parsed = bulkSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Accion invalida.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await markAllNotificationsRead(admin);
  const notifications = await listNotifications();
  return NextResponse.json({ ok: true, notifications });
}
