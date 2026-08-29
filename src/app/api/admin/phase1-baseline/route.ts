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

async function requireOwner(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "maintenance:run");
  if (!access.ok) return { response: NextResponse.json({ ok: false, message: access.message }, { status: access.status }) };
  if (access.admin.role !== "owner") return { response: NextResponse.json({ ok: false, message: "Solo el Owner puede establecer el baseline." }, { status: 403 }) };
  return { access };
}

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if ("response" in owner) return owner.response;
  const client = createSupabaseAdminClient();
  const [profiles, owners, leads, leadNotes, tasks, reminders, notifications, activity, email, push, settings] = await Promise.all([
    client.from("profiles").select("id", { head: true, count: "exact" }),
    client.from("profiles").select("id", { head: true, count: "exact" }).eq("role", "owner").eq("active", true),
    client.from("leads").select("id", { head: true, count: "exact" }),
    client.from("lead_notes").select("id", { head: true, count: "exact" }),
    client.from("tasks").select("id", { head: true, count: "exact" }),
    client.from("reminder_events").select("id", { head: true, count: "exact" }),
    client.from("notifications").select("id", { head: true, count: "exact" }),
    client.from("activity_logs").select("id", { head: true, count: "exact" }),
    client.from("email_logs").select("id", { head: true, count: "exact" }),
    client.from("push_logs").select("id", { head: true, count: "exact" }),
    client.from("admin_settings").select("id", { head: true, count: "exact" }),
  ]);
  const queries = [profiles, owners, leads, leadNotes, tasks, reminders, notifications, activity, email, push, settings];
  if (queries.some((query) => query.error)) return NextResponse.json({ ok: false, message: "No se pudo verificar el estado del baseline." }, { status: 500 });
  const actualCounts = {
    profiles: profiles.count ?? -1,
    leads: leads.count ?? -1,
    lead_notes: leadNotes.count ?? -1,
    tasks: tasks.count ?? -1,
    reminder_events: reminders.count ?? -1,
    notifications: notifications.count ?? -1,
    activity_logs: activity.count ?? -1,
    email_logs: email.count ?? -1,
    push_logs: push.count ?? -1,
    admin_settings: settings.count ?? -1,
  };
  return NextResponse.json({
    ok: true,
    summary: {
      leads: actualCounts.leads,
      notes: actualCounts.lead_notes,
      tasks: actualCounts.tasks,
      notifications: actualCounts.notifications,
      activityLogs: actualCounts.activity_logs,
      emailLogs: actualCounts.email_logs,
      pushLogs: actualCounts.push_logs,
    },
    verification: {
      countsMatchBackup: JSON.stringify(actualCounts) === JSON.stringify(expectedCounts),
      activeOwnerCount: owners.count ?? -1,
      reminderEventCount: actualCounts.reminder_events,
    },
  });
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if ("response" in owner) return owner.response;
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
    const reason = error.message.includes("changed after backup")
      ? "counts_changed"
      : error.message.includes("profile safety check failed")
        ? "profile_guard"
        : error.message.includes("already established")
          ? "baseline_conflict"
          : "execution_failed";
    const message = reason === "counts_changed"
      ? "Los datos cambiaron después del backup; se requiere un nuevo respaldo."
      : reason === "profile_guard"
        ? "La protección del perfil Owner impidió establecer el baseline."
        : "No se pudo establecer el baseline limpio.";
    return NextResponse.json({ ok: false, reason, message }, { status: 409 });
  }
  return NextResponse.json({ ok: true, result: data });
}
