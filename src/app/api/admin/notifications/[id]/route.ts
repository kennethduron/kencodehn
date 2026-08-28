import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createCrmRepositories } from "@/lib/data/repositories";

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
    const repositories = await createCrmRepositories();
    await repositories.notifications.setRead(id, parsed.data.read, admin);
    const notifications = await repositories.notifications.list(admin);
    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    if (error instanceof Error && "status" in error) return NextResponse.json({ ok: false, message: error.message }, { status: Number(error.status) || 400 });
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, "notifications:edit");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const admin = access.admin;
  const { id } = await params;
  try {
    const repositories = await createCrmRepositories();
    await repositories.notifications.remove(id, admin);
    const notifications = await repositories.notifications.list(admin);
    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    if (error instanceof Error && "status" in error) return NextResponse.json({ ok: false, message: error.message }, { status: Number(error.status) || 400 });
    throw error;
  }
}
