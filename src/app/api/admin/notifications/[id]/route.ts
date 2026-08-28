import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { deleteNotification, listNotifications, NotificationAccessError, updateNotificationRead } from "@/lib/admin/data";

export const runtime = "nodejs";

const notificationPatchSchema = z.object({
  read: z.boolean().default(true),
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, "notifications:edit");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const admin = access.admin;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = notificationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Datos invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    await updateNotificationRead(id, parsed.data.read, admin);
    const notifications = await listNotifications(admin);
    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    if (error instanceof NotificationAccessError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, "notifications:edit");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const admin = access.admin;
  const { id } = await params;
  try {
    await deleteNotification(id, admin);
    const notifications = await listNotifications(admin);
    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    if (error instanceof NotificationAccessError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    throw error;
  }
}
