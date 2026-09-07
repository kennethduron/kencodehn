import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const productionEndpoint = "https://kencodehn.com/api/cron/task-reminders";

function unavailable() {
  return NextResponse.json(
    { ok: false, message: "No pudimos configurar la automatización de recordatorios." },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "settings:view");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  if (access.admin.role !== "owner") return NextResponse.json({ ok: false, message: "Solo el Owner puede consultar esta automatización." }, { status: 403 });
  const result = await (await createSupabaseServerClient())
    .from("task_reminder_scheduler_state")
    .select("provider,schedule,endpoint,configured_at")
    .eq("id", "default")
    .maybeSingle();
  if (result.error) {
    console.error("task_reminder_scheduler_status_failed", { code: result.error.code || "unknown" });
    return unavailable();
  }
  return NextResponse.json({ ok: true, scheduler: result.data || null });
}

export async function POST(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "settings:manage");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  if (access.admin.role !== "owner") return NextResponse.json({ ok: false, message: "Solo el Owner puede configurar esta automatización." }, { status: 403 });
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return unavailable();
  const result = await createSupabaseAdminClient().rpc("task_reminder_configure_scheduler", {
    p_endpoint: productionEndpoint,
    p_secret: secret,
  });
  if (result.error) {
    console.error("task_reminder_scheduler_configuration_failed", { code: result.error.code || "unknown" });
    return unavailable();
  }
  return NextResponse.json({ ok: true, scheduler: result.data });
}
