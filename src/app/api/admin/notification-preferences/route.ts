import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import {
  getAuthoritativeNotificationRecipient,
  getPersonalNotificationPreferences,
  personalNotificationPreferencesSchema,
  savePersonalNotificationPreferences,
} from "@/lib/notifications/preferences";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "Su sesión ya no está disponible." }, { status: 401 });
  const [preferences, recipient] = await Promise.all([
    getPersonalNotificationPreferences(admin.uid),
    getAuthoritativeNotificationRecipient(admin.uid),
  ]);
  if (!recipient) return NextResponse.json({ ok: false, message: "Su cuenta no está disponible." }, { status: 403 });
  return NextResponse.json({ ok: true, preferences, notificationEmail: recipient.email });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "Su sesión ya no está disponible." }, { status: 401 });
  const parsed = personalNotificationPreferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Revise las preferencias seleccionadas." }, { status: 400 });
  const recipient = await getAuthoritativeNotificationRecipient(admin.uid);
  if (!recipient) return NextResponse.json({ ok: false, message: "Su cuenta no está disponible." }, { status: 403 });
  const preferences = await savePersonalNotificationPreferences(admin.uid, parsed.data);
  return NextResponse.json({ ok: true, preferences, notificationEmail: recipient.email });
}
