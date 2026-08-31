import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";

const diagnosticSchema = z.object({
  stage: z.enum(["capability", "permission", "worker", "registration", "test", "deactivation"]),
  outcome: z.enum(["success", "unsupported", "denied", "failed"]),
  permission: z.enum(["default", "granted", "denied", "unavailable"]),
  platform: z.enum(["ios", "android", "windows", "macos", "linux", "other"]),
  standalone: z.boolean(),
}).strict();

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = diagnosticSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  console.info("notification_device_event", parsed.data);
  return NextResponse.json({ ok: true });
}
