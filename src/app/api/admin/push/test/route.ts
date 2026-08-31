import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { sendTestPushToDevice } from "@/lib/push/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "Su sesión ya no está disponible." }, { status: 401 });
  const parsed = z.object({ deviceId: z.string().uuid() }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Active primero las notificaciones en este dispositivo." }, { status: 400 });
  const result = await sendTestPushToDevice(admin.uid, parsed.data.deviceId);
  if (result.sent !== 1 || result.failed !== 0) {
    return NextResponse.json({ ok: false, message: "No pudimos entregar la prueba a este dispositivo." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, message: "La prueba fue aceptada para este dispositivo." });
}
