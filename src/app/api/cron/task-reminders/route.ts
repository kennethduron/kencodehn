import { NextRequest, NextResponse } from "next/server";
import { processTaskReminders } from "@/lib/admin/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeSecret(value: string | undefined | null) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function readBearerToken(header: string | null) {
  const match = (header ?? "").trim().match(/^Bearer\s+(.+)$/i);
  return normalizeSecret(match?.[1]);
}

export async function GET(request: NextRequest) {
  const expected = normalizeSecret(process.env.CRON_SECRET);
  const received = readBearerToken(request.headers.get("authorization"));
  if (!expected || !received || received !== expected) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const result = await processTaskReminders();
  return NextResponse.json({ ok: true, result });
}
