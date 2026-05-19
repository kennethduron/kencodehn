import { NextRequest, NextResponse } from "next/server";
import { processTaskReminders } from "@/lib/admin/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const received = request.headers.get("authorization");
  if (!expected || received !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const result = await processTaskReminders();
  return NextResponse.json({ ok: true, result });
}
