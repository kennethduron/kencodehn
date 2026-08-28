import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { sendPushToAdmins } from "@/lib/push/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "push:manage");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const result = await sendPushToAdmins({
    type: "system",
    title: "Prueba Ken Code CRM",
    message: "Las notificaciones push estan activas en este dispositivo.",
    actionUrl: "/admin/configuracion",
  });
  return NextResponse.json({ ok: true, result });
}
