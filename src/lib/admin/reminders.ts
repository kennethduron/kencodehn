import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AdminTask } from "@/lib/admin/types";
import { sendTaskOverdueEmail, sendTaskReminderEmail } from "@/lib/email/service";
import { sendPushToUser } from "@/lib/push/service";
import { getAdminSettings } from "@/lib/admin/settings";
import {
  canClaimReminderEvent,
  channelStatusFromResult,
  classifyTaskReminder,
  REMINDER_LEASE_MS,
  REMINDER_RETRY_MS,
  reminderEventCompletion,
  reminderEventId,
  reminderLegacyField,
  type ReminderChannelStatus,
  type ReminderKind,
} from "@/lib/admin/reminder-policy";

type ChannelState = { status?: ReminderChannelStatus };

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
  return null;
}

function mapReminderTask(doc: QueryDocumentSnapshot<DocumentData>): AdminTask {
  const data = doc.data();
  return {
    id: doc.id,
    title: String(data.title ?? "Tarea"),
    description: String(data.description ?? ""),
    leadId: data.leadId ? String(data.leadId) : null,
    leadName: data.leadName ? String(data.leadName) : null,
    date: String(data.date ?? ""),
    time: String(data.time ?? ""),
    timezone: String(data.timezone ?? "America/Tegucigalpa"),
    dueAt: toIso(data.dueAt),
    priority: data.priority === "low" || data.priority === "high" ? data.priority : "medium",
    status: data.status === "in_progress" || data.status === "completed" || data.status === "cancelled" || data.status === "overdue" ? data.status : "pending",
    type: data.type === "call" || data.type === "whatsapp" || data.type === "email" || data.type === "meeting" || data.type === "proposal" ? data.type : "follow_up",
    reminderAt: toIso(data.reminderAt),
    reminder1DaySentAt: toIso(data.reminder1DaySentAt),
    reminder1HourSentAt: toIso(data.reminder1HourSentAt),
    dueNotificationSentAt: toIso(data.dueNotificationSentAt),
    completedAt: toIso(data.completedAt),
    completedByUid: data.completedByUid ? String(data.completedByUid) : null,
    completedByEmail: data.completedByEmail ? String(data.completedByEmail) : null,
    overdueEmailSentAt: toIso(data.overdueEmailSentAt),
    overdueNotifiedAt: toIso(data.overdueNotifiedAt),
    assignedToUid: data.assignedToUid ? String(data.assignedToUid) : null,
    assignedToName: data.assignedToName ? String(data.assignedToName) : null,
    assignedToEmail: data.assignedToEmail ? String(data.assignedToEmail) : null,
    assignedAt: toIso(data.assignedAt),
    assignedByUid: data.assignedByUid ? String(data.assignedByUid) : null,
    assignedByEmail: data.assignedByEmail ? String(data.assignedByEmail) : null,
    createdByUid: data.createdByUid ? String(data.createdByUid) : null,
    createdByEmail: data.createdByEmail ? String(data.createdByEmail) : "",
    createdBy: data.createdBy ? String(data.createdBy) : "",
    createdAt: toIso(data.createdAt) ?? "",
    updatedAt: toIso(data.updatedAt) ?? "",
  };
}

function reminderText(kind: ReminderKind) {
  if (kind === "1day") return { title: "Tarea vence en 1 día", label: "Recordatorio 1 día antes" };
  if (kind === "1hour") return { title: "Tarea vence en 1 hora", label: "Recordatorio 1 hora antes" };
  if (kind === "due") return { title: "Tarea en hora configurada", label: "Recordatorio de vencimiento" };
  return { title: "Tarea vencida", label: "Tarea vencida" };
}

function existingChannelStatus(data: Record<string, unknown>, channel: string): ReminderChannelStatus | null {
  const value = data[channel] as ChannelState | undefined;
  return value?.status === "sent" || value?.status === "skipped" ? value.status : null;
}

async function claimReminder(task: AdminTask, kind: ReminderKind, settings: Awaited<ReturnType<typeof getAdminSettings>>, now: Date) {
  const db = getAdminDb();
  if (!db || !task.dueAt || !task.assignedToUid) return null;
  const id = reminderEventId(task.id, kind, task.dueAt);
  const eventRef = db.collection("reminderEvents").doc(id);
  const taskRef = db.collection("tasks").doc(task.id);
  return db.runTransaction(async (transaction) => {
    const [eventSnapshot, taskSnapshot] = await Promise.all([transaction.get(eventRef), transaction.get(taskRef)]);
    if (!taskSnapshot.exists) return null;
    const currentTask = mapReminderTask(taskSnapshot as QueryDocumentSnapshot<DocumentData>);
    if (!currentTask.assignedToUid || classifyTaskReminder(currentTask, settings, now.getTime()) !== kind) return null;
    const eventData = eventSnapshot.data() ?? {};
    if (!canClaimReminderEvent(eventSnapshot.exists ? eventData : null, now.getTime())) return null;
    const channelStatuses = {
      notification: existingChannelStatus(eventData, "notification") ?? (settings.internalNotificationsEnabled ? "pending" : "skipped"),
      email: existingChannelStatus(eventData, "email") ?? (settings.emailNotificationsEnabled ? "pending" : "skipped"),
      push: existingChannelStatus(eventData, "push") ?? (settings.pushNotificationsEnabled ? "pending" : "skipped"),
    } as const;
    transaction.set(eventRef, {
      taskId: currentTask.id,
      leadId: currentTask.leadId,
      recipientUid: currentTask.assignedToUid,
      kind,
      dueAt: currentTask.dueAt,
      status: "processing",
      attempts: Number(eventData.attempts ?? 0) + 1,
      leaseUntil: new Date(now.getTime() + REMINDER_LEASE_MS).toISOString(),
      retryAt: null,
      notification: { status: channelStatuses.notification },
      email: { status: channelStatuses.email },
      push: { status: channelStatuses.push },
      createdAt: eventData.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    }, { merge: true });
    return { id, eventRef, taskRef, task: currentTask, channelStatuses };
  });
}

async function dispatchClaim(claim: NonNullable<Awaited<ReturnType<typeof claimReminder>>>, kind: ReminderKind) {
  const db = getAdminDb();
  if (!db || !claim.task.assignedToUid) return false;
  const meta = reminderText(kind);
  const now = new Date().toISOString();
  const message = `${claim.task.title}${claim.task.leadName ? ` para ${claim.task.leadName}` : ""}.`;
  const actionUrl = claim.task.leadId ? `/admin/leads/${claim.task.leadId}` : "/admin/tareas";
  const statuses: Record<"notification" | "email" | "push", ReminderChannelStatus> = { ...claim.channelStatuses };
  const errors: Record<string, string | null> = {};

  if (statuses.notification === "pending") {
    try {
      const notificationRef = db.collection("notifications").doc(`task_reminder_${claim.id}`);
      const activityRef = db.collection("activityLogs").doc(`task_reminder_${claim.id}`);
      const notificationActivityRef = db.collection("activityLogs").doc(`notification_created_task_reminder_${claim.id}`);
      const batch = db.batch();
      batch.set(notificationRef, {
        title: meta.title,
        message,
        type: kind === "overdue" ? "task_overdue" : kind === "due" ? "task_due" : "task_reminder",
        severity: kind === "overdue" ? "danger" : claim.task.priority === "high" ? "warning" : "info",
        leadId: claim.task.leadId,
        taskId: claim.task.id,
        actionUrl,
        recipientUid: claim.task.assignedToUid,
        recipientName: claim.task.assignedToName,
        recipientEmail: claim.task.assignedToEmail,
        read: false,
        readAt: null,
        deletedAt: null,
        createdAt: now,
      }, { merge: true });
      batch.set(activityRef, {
        entityType: "task",
        entityId: claim.task.id,
        leadId: claim.task.leadId,
        taskId: claim.task.id,
        action: "reminder_processed",
        title: meta.title,
        description: "Recordatorio generado por el procesador programado.",
        before: null,
        after: { reminder: kind, eventId: claim.id },
        recipientUid: claim.task.assignedToUid,
        userUid: "system",
        userEmail: "system",
        actorUid: "system",
        actorEmail: "system",
        createdAt: now,
      }, { merge: true });
      batch.set(notificationActivityRef, {
        entityType: "notification",
        entityId: notificationRef.id,
        leadId: claim.task.leadId,
        taskId: claim.task.id,
        action: "notification_created",
        title: "Notificacion creada",
        description: "Se creo una notificacion privada de recordatorio.",
        before: null,
        after: { reminder: kind, eventId: claim.id, recipientUid: claim.task.assignedToUid },
        recipientUid: claim.task.assignedToUid,
        userUid: "system",
        userEmail: "system",
        actorUid: "system",
        actorEmail: "system",
        createdAt: now,
      }, { merge: true });
      await batch.commit();
      statuses.notification = "sent";
    } catch {
      statuses.notification = "failed";
      errors.notification = "notification_write_failed";
    }
  }

  if (statuses.email === "pending") {
    const result = kind === "overdue"
      ? await sendTaskOverdueEmail(claim.task, `task-reminder/${claim.id}/email`)
      : await sendTaskReminderEmail(claim.task, meta.label, `task-reminder/${claim.id}/email`);
    statuses.email = channelStatusFromResult(result.sent, result.reason);
    errors.email = result.sent ? null : result.reason ?? "email_send_failed";
  }

  if (statuses.push === "pending") {
    const result = await sendPushToUser(claim.task.assignedToUid, {
      type: kind === "overdue" ? "task_overdue" : kind === "due" ? "task_due" : "task_reminder",
      title: meta.title,
      message,
      actionUrl,
      relatedLeadId: claim.task.leadId,
      relatedTaskId: claim.task.id,
      idempotencyKey: `task-reminder_${claim.id}_push`,
    });
    statuses.push = channelStatusFromResult(result.sent > 0 && result.failed === 0, result.reason);
    errors.push = statuses.push === "failed" ? result.reason ?? "push_send_failed" : null;
  }

  const status = reminderEventCompletion(Object.values(statuses));
  const updateTime = new Date().toISOString();
  await db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(claim.eventRef);
    if (!eventSnapshot.exists || eventSnapshot.data()?.status !== "processing") return;
    transaction.set(claim.eventRef, {
      status,
      notification: { status: statuses.notification, error: errors.notification ?? null },
      email: { status: statuses.email, error: errors.email ?? null },
      push: { status: statuses.push, error: errors.push ?? null },
      completedAt: status === "completed" ? updateTime : null,
      retryAt: status === "failed" ? new Date(Date.now() + REMINDER_RETRY_MS).toISOString() : null,
      leaseUntil: null,
      updatedAt: updateTime,
    }, { merge: true });
    if (status === "completed") {
      const taskUpdate: Record<string, unknown> = { [reminderLegacyField(kind)]: updateTime, updatedAt: updateTime };
      if (kind === "overdue") {
        taskUpdate.status = "overdue";
        if (statuses.email === "sent") taskUpdate.overdueEmailSentAt = updateTime;
      }
      transaction.set(claim.taskRef, taskUpdate, { merge: true });
    }
  });
  return status === "completed";
}

export async function processTaskReminders(now = new Date()) {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin no está configurado.");
  const settings = await getAdminSettings();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const snapshot = await db.collection("tasks")
    .where("status", "in", ["pending", "in_progress", "overdue"])
    .where("dueAt", "<=", horizon)
    .orderBy("dueAt", "asc")
    .limit(300)
    .get();
  const tasks = snapshot.docs.map((doc) => mapReminderTask(doc));
  const results = { checked: tasks.length, claimed: 0, completed: 0, skipped: 0, failed: 0 };
  for (const task of tasks) {
    const kind = classifyTaskReminder(task, settings, now.getTime());
    if (!kind || !task.assignedToUid) {
      results.skipped += 1;
      continue;
    }
    try {
      const claim = await claimReminder(task, kind, settings, now);
      if (!claim) {
        results.skipped += 1;
        continue;
      }
      results.claimed += 1;
      if (await dispatchClaim(claim, kind)) results.completed += 1;
      else results.failed += 1;
    } catch (error) {
      results.failed += 1;
      console.warn("[Ken Code task reminder failed]", { taskId: task.id, reason: error instanceof Error ? error.name : "unknown" });
    }
  }
  return results;
}
