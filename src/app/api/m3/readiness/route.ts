import { NextResponse } from "next/server";
import { isCrmPreviewReadOnly } from "@/lib/data/preview-read-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };
const activeTaskStatuses = new Set(["pending", "in_progress", "overdue"]);

function unavailable() {
  return NextResponse.json({ ok: false }, { status: 404, headers: noStore });
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

async function exactCount(client: ReturnType<typeof createSupabaseAdminClient>, table: string) {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`readiness count failed (${table}:${error.code ?? "unknown"})`);
  return count ?? 0;
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" || !isCrmPreviewReadOnly()) return unavailable();

  try {
    const client = createSupabaseAdminClient();
    const evaluatedAt = new Date();
    const evaluatedAtIso = evaluatedAt.toISOString();
    const [profilesResult, tasksResult, remindersResult, settingsResult, tableEntries] = await Promise.all([
      client.from("profiles").select("id,role,active"),
      client.from("tasks").select("status,due_at,assigned_to,reminder_one_day_sent_at,reminder_one_hour_sent_at,due_notification_sent_at,overdue_notified_at"),
      client.from("reminder_events").select("status,notification_status,email_status,push_status,metadata"),
      client.from("admin_settings").select("*").eq("id", "default").maybeSingle(),
      Promise.all(["profiles", "leads", "lead_notes", "tasks", "notifications", "activity_logs", "email_logs", "push_logs", "device_tokens", "reminder_events"].map(async (table) => [table, await exactCount(client, table)] as const)),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (tasksResult.error) throw tasksResult.error;
    if (remindersResult.error) throw remindersResult.error;
    if (settingsResult.error) throw settingsResult.error;

    const profiles = profilesResult.data ?? [];
    const activeOwners = profiles.filter((profile) => profile.role === "owner" && profile.active === true);
    const confirmationResults = await Promise.all(activeOwners.map((owner) => client.auth.admin.getUserById(owner.id)));
    const confirmedActiveOwners = confirmationResults.filter(({ data, error }) => !error && Boolean(data.user?.email_confirmed_at ?? data.user?.confirmed_at)).length;

    const tasks = tasksResult.data ?? [];
    const settings = settingsResult.data ?? {};
    const historicalReminderWindows = { one_day: 0, one_hour: 0, due: 0, overdue: 0 };
    const futureReminderWindows = { one_day: 0, one_hour: 0, due: 0 };
    let overdueByTime = 0;
    let future = 0;
    let withoutDueAt = 0;
    let assigned = 0;

    for (const task of tasks) {
      if (task.assigned_to) assigned += 1;
      if (!task.due_at) {
        withoutDueAt += 1;
        continue;
      }
      const dueAt = Date.parse(task.due_at);
      if (!Number.isFinite(dueAt)) continue;
      if (dueAt >= evaluatedAt.getTime()) future += 1;
      if (dueAt < evaluatedAt.getTime() && activeTaskStatuses.has(task.status)) overdueByTime += 1;
      if (!activeTaskStatuses.has(task.status) || !task.assigned_to) continue;

      const windows = [
        ["one_day", dueAt - 24 * 60 * 60 * 1000, settings.task_reminder_one_day_enabled !== false, task.reminder_one_day_sent_at],
        ["one_hour", dueAt - 60 * 60 * 1000, settings.task_reminder_one_hour_enabled !== false, task.reminder_one_hour_sent_at],
        ["due", dueAt, settings.task_due_enabled !== false, task.due_notification_sent_at],
        ["overdue", dueAt, settings.task_overdue_enabled !== false, task.overdue_notified_at],
      ] as const;
      for (const [kind, scheduledAt, enabled, sentAt] of windows) {
        if (!enabled || sentAt) continue;
        if (scheduledAt < evaluatedAt.getTime()) historicalReminderWindows[kind] += 1;
        else if (kind !== "overdue") futureReminderWindows[kind] += 1;
      }
    }

    const reminderEvents = remindersResult.data ?? [];
    const migrationBaselineEvents = reminderEvents.filter((event) => event.metadata?.reason === "skipped_migration_baseline").length;
    const deliveryEligibleReminderEvents = reminderEvents.filter((event) => event.status === "pending" || event.status === "processing" || event.status === "failed").length;

    return NextResponse.json({
      ok: true,
      evaluatedAt: evaluatedAtIso,
      provider: { auth: "supabase", data: "supabase", previewReadOnly: true },
      owners: { active: activeOwners.length, confirmedActive: confirmedActiveOwners },
      tasks: {
        total: tasks.length,
        byStatus: countBy(tasks.map((task) => String(task.status))),
        overdueByTime,
        future,
        withoutDueAt,
        assigned,
        unassigned: tasks.length - assigned,
        historicalReminderWindows,
        futureReminderWindows,
      },
      reminders: {
        total: reminderEvents.length,
        byStatus: countBy(reminderEvents.map((event) => String(event.status))),
        migrationBaselineEvents,
        deliveryEligible: deliveryEligibleReminderEvents,
      },
      automation: {
        cutoverConfigured: Boolean(settings.automation_cutover_at),
        baselineCompleted: Boolean(settings.automation_baseline_completed_at),
      },
      tables: Object.fromEntries(tableEntries),
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, message: "Readiness audit unavailable." }, { status: 503, headers: noStore });
  }
}
