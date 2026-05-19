import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { sendPushToAdmins } from "@/lib/push/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  const result = await sendPushToAdmins({
    type: "system",
    title: "Prueba Ken Code CRM",
    message: "Las notificaciones push estan activas en este dispositivo.",
    actionUrl: "/admin/configuracion",
  });
  return NextResponse.json({ ok: true, result });
}
