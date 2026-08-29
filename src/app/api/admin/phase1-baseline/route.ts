import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { isCrmPreviewReadOnly } from "@/lib/data/preview-read-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({ confirmation: z.literal("PRE_CLEAN_BASELINE") }).strict();
const backupChecksum = "1a348702f074789a85e778e9ae5d6c691f344017533b89d5398cb4526d2620dd";
const expectedCounts = {
  profiles: 1,
  leads: 4,
  lead_notes: 0,
  tasks: 28,
  reminder_events: 0,
  notifications: 172,
  activity_logs: 275,
  email_logs: 121,
  push_logs: 113,
  admin_settings: 1,
} as const;

export async function POST(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "maintenance:run");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  if (access.admin.role !== "owner") return NextResponse.json({ ok: false, message: "Solo el Owner puede establecer el baseline." }, { status: 403 });
  if (isCrmPreviewReadOnly()) return NextResponse.json({ ok: false, message: "Preview permanece en modo solo lectura." }, { status: 423 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Confirmación de baseline inválida." }, { status: 400 });

  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("establish_clean_business_baseline", {
    p_confirmation: parsed.data.confirmation,
    p_backup_checksum: backupChecksum,
    p_expected_counts: expectedCounts,
  });
  if (error) {
    return NextResponse.json({ ok: false, message: error.message.includes("changed after backup") ? "Los datos cambiaron después del backup; se requiere un nuevo respaldo." : "No se pudo establecer el baseline limpio." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, result: data });
}
