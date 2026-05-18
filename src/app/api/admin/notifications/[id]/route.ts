import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { deleteNotification, listNotifications, updateNotificationRead } from "@/lib/admin/data";

export const runtime = "nodejs";

const notificationPatchSchema = z.object({
  read: z.boolean().default(true),
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = notificationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Datos invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await updateNotificationRead(id, parsed.data.read, admin);
  const notifications = await listNotifications();
  return NextResponse.json({ ok: true, notifications });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  await deleteNotification(id, admin);
  const notifications = await listNotifications();
  return NextResponse.json({ ok: true, notifications });
}
