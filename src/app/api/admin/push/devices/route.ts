import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { deactivateDeviceToken, listDeviceTokens, registerDeviceToken } from "@/lib/push/service";

export const runtime = "nodejs";

const deviceSchema = z.object({
  token: z.string().trim().min(20).max(5000),
  userAgent: z.string().trim().max(500).optional(),
  platform: z.string().trim().max(120).optional(),
}).strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "Su sesión ya no está disponible." }, { status: 401 });
  const devices = await listDeviceTokens(admin.email);
  return NextResponse.json({
    ok: true,
    devices: devices.map(({ token: _token, ...device }) => device),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "Su sesión ya no está disponible." }, { status: 401 });
  const parsed = deviceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Datos invalidos.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const tokenId = await registerDeviceToken({ uid: admin.uid, email: admin.email, ...parsed.data });
  return NextResponse.json({ ok: true, tokenId });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "Su sesión ya no está disponible." }, { status: 401 });
  const parsed = deviceSchema.pick({ token: true }).safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Token requerido.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await deactivateDeviceToken(parsed.data.token, admin);
  return NextResponse.json({ ok: true });
}
