import "server-only";

import { leadDataScopeForAdmin, notificationDataScopeForAdmin, taskDataScopeForAdmin } from "@/lib/admin/authorization";
import type { ActivityLog, AdminLead, AdminMember, AdminNote, AdminNotification, AdminSettings, AdminTask } from "@/lib/admin/types";
import type { CrmRepositories } from "@/lib/data/repositories/types";
import { sendLeadStatusEmail, sendTaskOverdueEmail, sendTaskReminderEmail } from "@/lib/email/service";
import { sendPushToUser } from "@/lib/push/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Query = any;
type SupabaseLike = { from(table: string): Query; rpc(name: string, args?: Record<string, unknown>): Query };
const iso = (value: unknown) => typeof value === "string" ? value : null;
const text = (value: unknown) => typeof value === "string" ? value : "";
const minor = (value: unknown) => Number(value ?? 0) / 100;

export function mapSupabaseLead(row: Row): AdminLead {
  const follow = iso(row.follow_up_at);
  return {
    id: String(row.id), name: text(row.name), business: text(row.business), email: text(row.email), phone: text(row.phone), project: text(row.project), budget: text(row.budget), message: text(row.message),
    locale: row.locale === "en" ? "en" : "es", sourcePath: text(row.source_path), source: text(row.source), status: row.status, priority: row.priority,
    estimatedValue: minor(row.estimated_value_minor), initialProjectAmount: minor(row.initial_project_amount_minor), monthlyFee: minor(row.monthly_fee_minor), paymentStatus: row.payment_status,
    billingStartDate: iso(row.billing_start_date), billingNotes: text(row.billing_notes), wonValue: minor(row.won_value_minor), lastContactAt: iso(row.last_contact_at), nextAction: text(row.next_action),
    followUpDate: follow?.slice(0, 10) ?? "", followUpTime: follow?.slice(11, 16) ?? "", followUpTimezone: text(row.follow_up_timezone) || "America/Tegucigalpa", followUpAt: follow,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [], assignedToUid: row.assigned_to ?? null, assignedToName: row.assigned_to_name ?? null, assignedToEmail: row.assigned_to_email ?? null,
    assignedAt: iso(row.assigned_at), assignedByUid: row.assigned_by ?? null, assignedByEmail: row.assigned_by_email ?? null, createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}

export function mapSupabaseNote(row: Row): AdminNote {
  return { id: String(row.id), leadId: String(row.lead_id), text: text(row.body), createdBy: text(row.author_id ?? row.author_firebase_uid), createdByEmail: text(row.author_email), createdAt: text(row.created_at) };
}

export function mapSupabaseTask(row: Row): AdminTask {
  return { id: String(row.id), title: text(row.title), description: text(row.description), leadId: row.lead_id ?? null, leadName: row.lead_name ?? null, date: text(row.due_date), time: text(row.due_time).slice(0, 5), timezone: text(row.timezone) || "America/Tegucigalpa", dueAt: iso(row.due_at), priority: row.priority, status: row.status, type: row.type, reminderAt: iso(row.reminder_at), reminder1DaySentAt: iso(row.reminder_one_day_sent_at), reminder1HourSentAt: iso(row.reminder_one_hour_sent_at), dueNotificationSentAt: iso(row.due_notification_sent_at), completedAt: iso(row.completed_at), overdueEmailSentAt: iso(row.overdue_email_sent_at), overdueNotifiedAt: iso(row.overdue_notified_at), assignedToUid: row.assigned_to ?? null, assignedToName: row.assigned_to_name ?? null, assignedToEmail: row.assigned_to_email ?? null, assignedAt: iso(row.assigned_at), assignedByUid: row.assigned_by ?? null, assignedByEmail: row.assigned_by_email ?? null, createdByUid: row.created_by ?? null, createdByEmail: text(row.created_by_email), createdBy: text(row.created_by_email), completedByUid: row.completed_by ?? null, completedByEmail: row.completed_by_email ?? null, createdAt: text(row.created_at), updatedAt: text(row.updated_at) };
}

export function mapSupabaseNotification(row: Row): AdminNotification {
  return { id: String(row.id), title: text(row.title), message: text(row.message), type: row.type, severity: row.severity, leadId: row.lead_id ?? null, taskId: row.task_id ?? null, actionUrl: row.action_url ?? null, recipientUid: row.recipient_id ?? null, recipientName: row.recipient_name ?? null, recipientEmail: row.recipient_email ?? null, read: row.is_read === true, readAt: iso(row.read_at), deletedAt: iso(row.deleted_at), createdAt: text(row.created_at) };
}

export function mapSupabaseActivity(row: Row): ActivityLog {
  return { id: String(row.id), entityType: row.entity_type, entityId: text(row.entity_id), leadId: row.lead_id ?? null, taskId: row.task_id ?? null, noteId: row.note_id ?? null, action: text(row.action), title: text(row.title), description: text(row.description), before: row.before_data ?? null, after: row.after_data ?? null, userUid: row.actor_id ?? row.actor_firebase_uid ?? undefined, userEmail: text(row.actor_email), actorUid: row.actor_id ?? undefined, actorEmail: text(row.actor_email), targetUid: row.target_user_id ?? undefined, recipientUid: row.recipient_id ?? undefined, createdAt: text(row.created_at) };
}

export function mapSupabaseMember(row: Row): AdminMember {
  return { uid: String(row.id), name: text(row.name), email: text(row.email), role: row.role ?? null, active: row.active === true, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), lastLoginAt: iso(row.last_login_at), invitedAt: iso(row.invited_at), invitedByUid: row.invited_by ?? null, invitationStatus: row.invitation_status ?? null, invitationLastSentAt: iso(row.invitation_last_sent_at), assignedLeadCount: Number(row.assigned_lead_count ?? 0) };
}

export function mapSupabaseSettings(row: Row | null): AdminSettings {
  return { emailNotificationsEnabled: row?.email_notifications_enabled !== false, pushNotificationsEnabled: row?.push_notifications_enabled !== false, internalNotificationsEnabled: row?.internal_notifications_enabled !== false, taskReminder1DayEnabled: row?.task_reminder_one_day_enabled !== false, taskReminder1HourEnabled: row?.task_reminder_one_hour_enabled !== false, taskDueEnabled: row?.task_due_enabled !== false, taskOverdueEnabled: row?.task_overdue_enabled !== false, dailySummaryEnabled: row?.daily_summary_enabled === true, notificationSoundEnabled: row?.notification_sound_enabled !== false, compactModeEnabled: row?.compact_mode_enabled === true, updatedAt: iso(row?.updated_at), updatedByUid: row?.updated_by ?? null, updatedBy: row?.updated_by_email ?? null };
}

async function rows(query: Query) {
  const { data, error } = await query;
  if (error) throw new Error(`Supabase repository query failed (${error.code ?? "unknown"}).`);
  return (data ?? []) as Row[];
}

async function mutation(client: SupabaseLike, operation: string, payload: Record<string, unknown>) {
  const { data, error } = await client.rpc("crm_write", { p_operation: operation, p_payload: payload });
  if (error) {
    const wrapped = new Error(error.message || "Supabase CRM mutation failed.") as Error & { status?: number };
    wrapped.status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 400;
    throw wrapped;
  }
  return (data ?? {}) as Record<string, unknown>;
}

export function createSupabaseRepositoriesWithClient(client: SupabaseLike): CrmRepositories {
  return {
    leads: {
      async list(admin) { let query = client.from("leads").select("*").order("created_at", { ascending: false }); if (leadDataScopeForAdmin(admin) === "assigned") query = query.eq("assigned_to", admin.uid); return (await rows(query)).map(mapSupabaseLead); },
      async get(id, admin) { let query = client.from("leads").select("*").eq("id", id); if (leadDataScopeForAdmin(admin) === "assigned") query = query.eq("assigned_to", admin.uid); const result = await rows(query.limit(1)); return result[0] ? mapSupabaseLead(result[0]) : null; },
      async update(id, updates, admin) {
        await mutation(client, "lead_update", { id, updates });
        if (updates.status === "won" || updates.status === "quoted") {
          let query = client.from("leads").select("*").eq("id", id);
          if (leadDataScopeForAdmin(admin) === "assigned") query = query.eq("assigned_to", admin.uid);
          const after = await rows(query.limit(1));
          if (after[0]) await sendLeadStatusEmail(mapSupabaseLead(after[0]), updates.status);
        }
      },
      async assign(id, assignedToUid, admin) {
        const result = await mutation(client, "lead_assign", { id, assignedToUid });
        let query = client.from("leads").select("*").eq("id", id);
        if (leadDataScopeForAdmin(admin) === "assigned") query = query.eq("assigned_to", admin.uid);
        const after = await rows(query.limit(1));
        return { lead: after[0] ? mapSupabaseLead(after[0]) : null, changed: result.changed === true };
      },
    },
    notes: {
      async list(leadId) { return (await rows(client.from("lead_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }))).map(mapSupabaseNote); },
      async add(leadId, body) { const result = await mutation(client, "note_add", { leadId, body }); return String(result.id); },
    },
    tasks: {
      async list(admin, leadId) { let query = client.from("tasks").select("*").order("created_at", { ascending: false }); if (leadId) query = query.eq("lead_id", leadId); if (taskDataScopeForAdmin(admin) === "assigned") query = query.eq("assigned_to", admin.uid); return (await rows(query)).map(mapSupabaseTask); },
      async create(input) { const result = await mutation(client, "task_create", { input }); return String(result.id); },
      async update(id, updates) { await mutation(client, "task_update", { id, updates }); },
      async remove(id) { await mutation(client, "task_delete", { id }); },
    },
    notifications: {
      async list(admin) { let query = client.from("notifications").select("*").is("deleted_at", null).order("created_at", { ascending: false }); const scope = notificationDataScopeForAdmin(admin); if (scope === "none") return []; query = scope === "personal" ? query.eq("recipient_id", admin.uid) : query.or(`recipient_id.eq.${admin.uid},recipient_id.is.null`); return (await rows(query)).map(mapSupabaseNotification); },
      async setRead(id, read) { await mutation(client, "notification_read", { id, read }); },
      async markAllRead() { await mutation(client, "notifications_read_all", {}); },
      async remove(id) { await mutation(client, "notification_delete", { id }); },
    },
    activity: { async list(admin, leadId, limit = 100) { let query = client.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(limit); if (leadId) query = query.eq("lead_id", leadId); if (admin.role === "sales_agent") query = query.or(`recipient_id.eq.${admin.uid},actor_id.eq.${admin.uid}`); return (await rows(query)).map(mapSupabaseActivity); } },
    users: { async list() { return (await rows(client.from("profiles").select("*").order("created_at", { ascending: true }))).map(mapSupabaseMember); } },
    settings: {
      async get() { const result = await rows(client.from("admin_settings").select("*").eq("id", "default").limit(1)); return mapSupabaseSettings(result[0] ?? null); },
      async update(settings) { await mutation(client, "settings_update", { settings }); const result = await rows(client.from("admin_settings").select("*").eq("id", "default").limit(1)); return mapSupabaseSettings(result[0] ?? null); },
    },
    reminders: {
      async process(now = new Date()) {
        const admin = createSupabaseAdminClient();
        const evaluatedAt = now.toISOString();
        const queuedResult = await admin.rpc("enqueue_due_reminder_events", { p_now: evaluatedAt });
        if (queuedResult.error) throw new Error(`Supabase reminder queue failed (${queuedResult.error.code ?? "unknown"}).`);
        const claim = await admin.rpc("claim_due_reminder_events", { p_now: evaluatedAt, p_limit: 50 });
        if (claim.error) throw new Error(`Supabase reminder claim failed (${claim.error.code ?? "unknown"}).`);
        const settingsResult = await admin.from("admin_settings").select("*").eq("id", "default").maybeSingle();
        if (settingsResult.error) throw new Error(`Supabase reminder settings failed (${settingsResult.error.code ?? "unknown"}).`);
        const settings = mapSupabaseSettings(settingsResult.data);
        let completed = 0;
        let failed = 0;
        for (const event of claim.data ?? []) {
          let notificationStatus: "sent" | "failed" | "skipped" = "skipped";
          let emailStatus: "sent" | "failed" | "skipped" = "skipped";
          let pushStatus: "sent" | "failed" | "skipped" = "skipped";
          let notificationError: string | null = null;
          let emailError: string | null = null;
          let pushError: string | null = null;
          const taskResult = await admin.from("tasks").select("*").eq("id", event.task_id).maybeSingle();
          if (taskResult.error || !taskResult.data) {
            notificationStatus = emailStatus = pushStatus = "failed";
            notificationError = emailError = pushError = "task_missing";
          } else {
            const task = mapSupabaseTask(taskResult.data);
            const overdue = event.kind === "overdue";
            if (settings.internalNotificationsEnabled) {
              const notificationId = crypto.randomUUID();
              const { error } = await admin.from("notifications").upsert({
                id: notificationId, firebase_id: `reminder:${event.deterministic_key}:notification`, recipient_id: event.recipient_id,
                recipient_name: task.assignedToName, recipient_email: task.assignedToEmail, lead_id: task.leadId, task_id: task.id,
                type: overdue ? "task_overdue" : "task_reminder", severity: overdue ? "danger" : "warning",
                title: overdue ? "Tarea vencida" : "Recordatorio de tarea", message: overdue ? "Una tarea asignada esta vencida." : "Una tarea asignada se aproxima a su vencimiento.",
                action_url: task.leadId ? `/admin/leads/${task.leadId}` : "/admin/tareas", is_read: false, created_at: evaluatedAt, updated_at: evaluatedAt,
              }, { onConflict: "firebase_id", ignoreDuplicates: true });
              notificationStatus = error ? "failed" : "sent";
              notificationError = error ? "notification_write_failed" : null;
            }
            if (settings.emailNotificationsEnabled && task.assignedToEmail) {
              const result = overdue
                ? await sendTaskOverdueEmail(task, `reminder:${event.deterministic_key}:email`)
                : await sendTaskReminderEmail(task, String(event.kind), `reminder:${event.deterministic_key}:email`);
              emailStatus = result.sent ? "sent" : result.reason === "email_notifications_disabled" || result.reason === "email_to_missing" ? "skipped" : "failed";
              emailError = result.sent ? null : result.reason ?? "email_send_failed";
            }
            if (settings.pushNotificationsEnabled) {
              const result = await sendPushToUser(event.recipient_id, {
                type: overdue ? "task_overdue" : "task_reminder", title: overdue ? "Tarea vencida" : "Recordatorio de tarea",
                message: overdue ? "Una tarea asignada esta vencida." : "Una tarea asignada se aproxima a su vencimiento.",
                actionUrl: task.leadId ? `/admin/leads/${task.leadId}` : "/admin/tareas", relatedLeadId: task.leadId, relatedTaskId: task.id,
                idempotencyKey: `reminder:${event.deterministic_key}:push`,
              });
              pushStatus = result.sent > 0 ? "sent" : result.failed > 0 ? "failed" : "skipped";
              pushError = pushStatus === "sent" ? null : result.reason ?? (pushStatus === "failed" ? "push_send_failed" : "no_active_devices");
            }
          }
          const finish = await admin.rpc("complete_reminder_event", {
            p_id: event.id, p_lease: event.lease_token, p_notification_status: notificationStatus, p_email_status: emailStatus, p_push_status: pushStatus,
            p_notification_error: notificationError, p_email_error: emailError, p_push_error: pushError, p_now: evaluatedAt,
          });
          if (finish.error || finish.data !== true) throw new Error(`Supabase reminder completion failed (${finish.error?.code ?? "lease_mismatch"}).`);
          if ([notificationStatus, emailStatus, pushStatus].includes("failed")) failed += 1; else completed += 1;
        }
        return { provider: "supabase", evaluatedAt, queued: Number(queuedResult.data ?? 0), claimed: (claim.data ?? []).length, completed, failed, deliveriesAttempted: (claim.data ?? []).length };
      },
    },
  };
}

export async function createSupabaseRepositories(): Promise<CrmRepositories> {
  return createSupabaseRepositoriesWithClient(await createSupabaseServerClient());
}
