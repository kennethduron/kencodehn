import { getAdminDb } from "@/lib/firebase/admin";
import { addActivityLog, listTasks } from "@/lib/admin/data";
import type { AdminTask, AdminUser } from "@/lib/admin/types";
import { sendTaskOverdueEmail, sendTaskReminderEmail } from "@/lib/email/service";
import { sendPushToAdmins } from "@/lib/push/service";
import { getAdminSettings } from "@/lib/admin/settings";
import { defaultPermissionsForRole } from "@/lib/admin/authorization";

type ReminderKind = "1day" | "1hour" | "due" | "overdue";

const minute = 60 * 1000;
const hour = 60 * minute;
const day = 24 * hour;

function reminderText(kind: ReminderKind) {
  if (kind === "1day") return { title: "Tarea vence en 1 dia", label: "Recordatorio 1 dia antes", field: "reminder1DaySentAt" };
  if (kind === "1hour") return { title: "Tarea vence en 1 hora", label: "Recordatorio 1 hora antes", field: "reminder1HourSentAt" };
  if (kind === "due") return { title: "Tarea en hora configurada", label: "Recordatorio hora exacta", field: "dueNotificationSentAt" };
  return { title: "Tarea vencida", label: "Tarea vencida", field: "overdueNotifiedAt" };
}

async function safeStep(label: string, taskId: string, action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    console.warn(`[Ken Code cron reminder secondary failed] ${label}`, { taskId, error });
  }
}

async function dispatchTaskReminder(task: AdminTask, kind: ReminderKind, admin: AdminUser, internalNotificationsEnabled: boolean) {
  const db = getAdminDb();
  if (!db) return false;
  const meta = reminderText(kind);
  const now = new Date().toISOString();
  const ref = db.collection("tasks").doc(task.id);
  const notificationRef = internalNotificationsEnabled ? db.collection("notifications").doc() : null;
  const actionUrl = task.leadId ? `/admin/leads/${task.leadId}` : "/admin/tareas";
  const message = `${task.title}${task.leadName ? ` para ${task.leadName}` : ""}.`;
  const notificationType = kind === "due" ? "task_due" : kind === "overdue" ? "task_overdue" : "task_reminder";
  const severity = kind === "overdue" ? "danger" : task.priority === "high" ? "warning" : "info";
  const taskUpdate =
    kind === "overdue"
      ? { status: "overdue", overdueNotifiedAt: now, overdueEmailSentAt: now, updatedAt: now }
      : { [meta.field]: now, updatedAt: now };

  const batch = db.batch();
  batch.set(ref, taskUpdate, { merge: true });
  if (notificationRef) {
    batch.set(notificationRef, {
      title: meta.title,
      message,
      type: notificationType,
      severity,
      leadId: task.leadId ?? null,
      taskId: task.id,
      actionUrl,
      read: false,
      readAt: null,
      deletedAt: null,
      createdAt: now,
    });
  }
  await batch.commit();

  await safeStep("email", task.id, () =>
    kind === "overdue"
      ? sendTaskOverdueEmail({ ...task, status: "overdue", overdueNotifiedAt: now, overdueEmailSentAt: now })
      : sendTaskReminderEmail(task, meta.label),
  );
  await safeStep("push", task.id, () =>
    sendPushToAdmins({
      type: kind === "overdue" ? "task_overdue" : kind === "due" ? "task_due" : "task_reminder",
      title: meta.title,
      message,
      actionUrl,
      relatedLeadId: task.leadId,
      relatedTaskId: task.id,
    }),
  );
  await safeStep("activityLog", task.id, () =>
    addActivityLog({
      entityType: "task",
      entityId: task.id,
      leadId: task.leadId,
      taskId: task.id,
      action: kind === "overdue" ? "task_overdue" : "task_reminder_sent",
      before: { status: task.status },
      after: { reminder: kind, sentAt: now, notificationId: notificationRef?.id ?? null },
      userUid: admin.uid,
      userEmail: admin.email,
    }),
  );
  return true;
}

export async function processTaskReminders(
  admin: AdminUser = {
    uid: "system",
    email: "cron@kencodehn.com",
    role: "admin",
    active: true,
    permissions: defaultPermissionsForRole("admin"),
  },
) {
  const tasks = await listTasks();
  const settings = await getAdminSettings();
  const now = Date.now();
  const results = { checked: tasks.length, reminder1Day: 0, reminder1Hour: 0, due: 0, overdue: 0, failed: 0 };

  for (const task of tasks) {
    if (!task.dueAt || task.status === "completed") continue;
    const due = new Date(task.dueAt).getTime();
    if (!Number.isFinite(due)) continue;
    const diff = due - now;

    try {
      if (diff > hour && diff <= day && !task.reminder1DaySentAt && settings.taskReminder1DayEnabled) {
        if (await dispatchTaskReminder(task, "1day", admin, settings.internalNotificationsEnabled)) results.reminder1Day += 1;
        continue;
      }
      if (diff > 0 && diff <= hour && !task.reminder1HourSentAt && settings.taskReminder1HourEnabled) {
        if (await dispatchTaskReminder(task, "1hour", admin, settings.internalNotificationsEnabled)) results.reminder1Hour += 1;
        continue;
      }
      if (diff <= 0 && diff >= -10 * minute && !task.dueNotificationSentAt && settings.taskDueEnabled) {
        if (await dispatchTaskReminder(task, "due", admin, settings.internalNotificationsEnabled)) results.due += 1;
        continue;
      }
      if (diff < 0 && !task.overdueNotifiedAt && settings.taskOverdueEnabled) {
        if (await dispatchTaskReminder(task, "overdue", admin, settings.internalNotificationsEnabled)) results.overdue += 1;
      }
    } catch (error) {
      results.failed += 1;
      console.warn("[Ken Code cron reminder failed]", { taskId: task.id, error });
    }
  }
  return results;
}
