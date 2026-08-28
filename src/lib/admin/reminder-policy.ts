export type ReminderKind = "1day" | "1hour" | "due" | "overdue";
export type ReminderChannelStatus = "pending" | "sent" | "failed" | "skipped";
export type ReminderEventStatus = "processing" | "completed" | "failed";

export type ReminderTaskState = {
  id: string;
  dueAt?: string | null;
  status?: string | null;
  reminder1DaySentAt?: string | null;
  reminder1HourSentAt?: string | null;
  dueNotificationSentAt?: string | null;
  overdueNotifiedAt?: string | null;
};

export type ReminderSettingsState = {
  taskReminder1DayEnabled: boolean;
  taskReminder1HourEnabled: boolean;
  taskDueEnabled: boolean;
  taskOverdueEnabled: boolean;
};

export type ReminderClaimState = {
  status?: ReminderEventStatus | null;
  leaseUntil?: string | null;
  retryAt?: string | null;
};

const minute = 60 * 1000;
const hour = 60 * minute;
const day = 24 * hour;

export const REMINDER_LEASE_MS = 5 * minute;
export const REMINDER_RETRY_MS = 15 * minute;

export function reminderLegacyField(kind: ReminderKind) {
  if (kind === "1day") return "reminder1DaySentAt" as const;
  if (kind === "1hour") return "reminder1HourSentAt" as const;
  if (kind === "due") return "dueNotificationSentAt" as const;
  return "overdueNotifiedAt" as const;
}

export function classifyTaskReminder(
  task: ReminderTaskState,
  settings: ReminderSettingsState,
  nowMs = Date.now(),
): ReminderKind | null {
  if (!task.dueAt || task.status === "completed" || task.status === "cancelled") return null;
  const dueMs = Date.parse(task.dueAt);
  if (!Number.isFinite(dueMs)) return null;
  const diff = dueMs - nowMs;

  if (diff > hour && diff <= day && !task.reminder1DaySentAt && settings.taskReminder1DayEnabled) return "1day";
  if (diff > 0 && diff <= hour && !task.reminder1HourSentAt && settings.taskReminder1HourEnabled) return "1hour";
  if (diff <= 0 && diff >= -10 * minute && !task.dueNotificationSentAt && settings.taskDueEnabled) return "due";
  if (diff < 0 && !task.overdueNotifiedAt && settings.taskOverdueEnabled) return "overdue";
  return null;
}

export function reminderEventId(taskId: string, kind: ReminderKind, dueAt: string) {
  const safeTaskId = taskId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
  const dueMs = Date.parse(dueAt);
  return `${safeTaskId}_${kind}_${Number.isFinite(dueMs) ? dueMs : "invalid"}`;
}

export function canClaimReminderEvent(existing: ReminderClaimState | null | undefined, nowMs = Date.now()) {
  if (!existing) return true;
  if (existing.status === "completed") return false;
  const leaseUntil = existing.leaseUntil ? Date.parse(existing.leaseUntil) : 0;
  if (existing.status === "processing" && Number.isFinite(leaseUntil) && leaseUntil > nowMs) return false;
  const retryAt = existing.retryAt ? Date.parse(existing.retryAt) : 0;
  if (existing.status === "failed" && Number.isFinite(retryAt) && retryAt > nowMs) return false;
  return true;
}

export function channelStatusFromResult(sent: boolean, reason?: string | null): ReminderChannelStatus {
  if (sent) return "sent";
  if (
    reason === "email_notifications_disabled"
    || reason === "email_to_missing"
    || reason === "push_notifications_disabled"
    || reason === "no_active_devices"
    || reason === "already_delivered"
  ) return "skipped";
  return "failed";
}

export function reminderEventCompletion(statuses: readonly ReminderChannelStatus[]): ReminderEventStatus {
  return statuses.every((status) => status === "sent" || status === "skipped") ? "completed" : "failed";
}
