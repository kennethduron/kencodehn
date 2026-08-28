import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createCrmRepositories } from "@/lib/data/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeSecret(value: string | undefined | null) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function readBearerToken(header: string | null) {
  const match = (header ?? "").trim().match(/^Bearer\s+(.+)$/i);
  return normalizeSecret(match?.[1]);
}

function secretsMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function GET(request: NextRequest) {
  const expected = normalizeSecret(process.env.CRON_SECRET);
  const received = readBearerToken(request.headers.get("authorization"));
  if (!expected || !received || !secretsMatch(expected, received)) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  try {
    const result = await (await createCrmRepositories()).reminders.process();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[Ken Code task reminder cron failed]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, message: "No se pudo completar el procesamiento." }, { status: 500 });
  }
}
