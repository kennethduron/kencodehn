import { getAdminDb } from "@/lib/firebase/admin";
import { addActivityLog, createNotification, listTasks } from "@/lib/admin/data";
import type { AdminTask, AdminUser } from "@/lib/admin/types";
import { sendTaskOverdueEmail, sendTaskReminderEmail } from "@/lib/email/service";
import { sendPushToAdmins } from "@/lib/push/service";

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

async function dispatchTaskReminder(task: AdminTask, kind: ReminderKind, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) return false;
  const meta = reminderText(kind);
  const now = new Date().toISOString();
  const ref = db.collection("tasks").doc(task.id);
  const actionUrl = task.leadId ? `/admin/leads/${task.leadId}` : "/admin/tareas";
  const message = `${task.title}${task.leadName ? ` para ${task.leadName}` : ""}.`;

  await createNotification({
    title: meta.title,
    message,
    type: kind === "due" ? "task_due" : kind === "overdue" ? "task_overdue" : "task_reminder",
    severity: kind === "overdue" ? "danger" : task.priority === "high" ? "warning" : "info",
    leadId: task.leadId,
    taskId: task.id,
    actionUrl,
  });
  if (kind === "overdue") {
    await ref.set({ status: "overdue", overdueNotifiedAt: now, overdueEmailSentAt: now, updatedAt: now }, { merge: true });
    await sendTaskOverdueEmail({ ...task, status: "overdue", overdueNotifiedAt: now, overdueEmailSentAt: now });
  } else {
    await ref.set({ [meta.field]: now, updatedAt: now }, { merge: true });
    await sendTaskReminderEmail(task, meta.label);
  }
  await sendPushToAdmins({
    type: kind === "overdue" ? "task_overdue" : kind === "due" ? "task_due" : "task_reminder",
    title: meta.title,
    message,
    actionUrl,
    relatedLeadId: task.leadId,
    relatedTaskId: task.id,
  });
  await addActivityLog({
    entityType: "task",
    entityId: task.id,
    leadId: task.leadId,
    taskId: task.id,
    action: kind === "overdue" ? "task_overdue" : "task_reminder_sent",
    before: { status: task.status },
    after: { reminder: kind, sentAt: now },
    userEmail: admin.email,
  });
  return true;
}

export async function processTaskReminders(admin: AdminUser = { uid: "system", email: "cron@kencodehn.com", role: "admin" }) {
  const tasks = await listTasks();
  const now = Date.now();
  const results = { checked: tasks.length, reminder1Day: 0, reminder1Hour: 0, due: 0, overdue: 0 };

  for (const task of tasks) {
    if (!task.dueAt || task.status === "completed") continue;
    const due = new Date(task.dueAt).getTime();
    if (!Number.isFinite(due)) continue;
    const diff = due - now;

    if (diff > hour && diff <= day && !task.reminder1DaySentAt) {
      if (await dispatchTaskReminder(task, "1day", admin)) results.reminder1Day += 1;
      continue;
    }
    if (diff > 0 && diff <= hour && !task.reminder1HourSentAt) {
      if (await dispatchTaskReminder(task, "1hour", admin)) results.reminder1Hour += 1;
      continue;
    }
    if (diff <= 0 && diff >= -10 * minute && !task.dueNotificationSentAt) {
      if (await dispatchTaskReminder(task, "due", admin)) results.due += 1;
      continue;
    }
    if (diff < 0 && !task.overdueNotifiedAt) {
      if (await dispatchTaskReminder(task, "overdue", admin)) results.overdue += 1;
    }
  }
  return results;
}
