import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AdminSettings, AdminUser } from "@/lib/admin/types";
import { hasPermission } from "@/lib/admin/authorization";
import { isSupabaseDataProviderEnabled } from "@/lib/data/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const adminSettingsSchema = z
  .object({
    emailNotificationsEnabled: z.boolean(),
    pushNotificationsEnabled: z.boolean(),
    internalNotificationsEnabled: z.boolean(),
    taskReminder1DayEnabled: z.boolean(),
    taskReminder1HourEnabled: z.boolean(),
    taskDueEnabled: z.boolean(),
    taskOverdueEnabled: z.boolean(),
    dailySummaryEnabled: z.boolean(),
    notificationSoundEnabled: z.boolean(),
    compactModeEnabled: z.boolean(),
  })
  .strict();

export const defaultAdminSettings: AdminSettings = {
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: true,
  internalNotificationsEnabled: true,
  taskReminder1DayEnabled: true,
  taskReminder1HourEnabled: true,
  taskDueEnabled: true,
  taskOverdueEnabled: true,
  dailySummaryEnabled: false,
  notificationSoundEnabled: false,
  compactModeEnabled: false,
  updatedAt: null,
  updatedByUid: null,
  updatedBy: null,
};

export function canManageSettings(admin: AdminUser) {
  return hasPermission(admin, "settings:manage");
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function mapSettings(data: Record<string, unknown> | undefined): AdminSettings {
  return {
    emailNotificationsEnabled: toBoolean(data?.emailNotificationsEnabled, defaultAdminSettings.emailNotificationsEnabled),
    pushNotificationsEnabled: toBoolean(data?.pushNotificationsEnabled, defaultAdminSettings.pushNotificationsEnabled),
    internalNotificationsEnabled: toBoolean(data?.internalNotificationsEnabled, defaultAdminSettings.internalNotificationsEnabled),
    taskReminder1DayEnabled: toBoolean(data?.taskReminder1DayEnabled, defaultAdminSettings.taskReminder1DayEnabled),
    taskReminder1HourEnabled: toBoolean(data?.taskReminder1HourEnabled, defaultAdminSettings.taskReminder1HourEnabled),
    taskDueEnabled: toBoolean(data?.taskDueEnabled, defaultAdminSettings.taskDueEnabled),
    taskOverdueEnabled: toBoolean(data?.taskOverdueEnabled, defaultAdminSettings.taskOverdueEnabled),
    dailySummaryEnabled: toBoolean(data?.dailySummaryEnabled, defaultAdminSettings.dailySummaryEnabled),
    notificationSoundEnabled: toBoolean(data?.notificationSoundEnabled, defaultAdminSettings.notificationSoundEnabled),
    compactModeEnabled: toBoolean(data?.compactModeEnabled, defaultAdminSettings.compactModeEnabled),
    updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
    updatedByUid: typeof data?.updatedByUid === "string" ? data.updatedByUid : null,
    updatedBy: typeof data?.updatedBy === "string" ? data.updatedBy : null,
  };
}

export async function getAdminSettings() {
  if (isSupabaseDataProviderEnabled()) {
    const { data, error } = await createSupabaseAdminClient().from("admin_settings").select("*").eq("id", "default").maybeSingle();
    if (error) throw new Error(`Supabase settings query failed (${error.code ?? "unknown"}).`);
    if (!data) return defaultAdminSettings;
    return {
      emailNotificationsEnabled: data.email_notifications_enabled !== false,
      pushNotificationsEnabled: data.push_notifications_enabled !== false,
      internalNotificationsEnabled: data.internal_notifications_enabled !== false,
      taskReminder1DayEnabled: data.task_reminder_one_day_enabled !== false,
      taskReminder1HourEnabled: data.task_reminder_one_hour_enabled !== false,
      taskDueEnabled: data.task_due_enabled !== false,
      taskOverdueEnabled: data.task_overdue_enabled !== false,
      dailySummaryEnabled: data.daily_summary_enabled === true,
      notificationSoundEnabled: data.notification_sound_enabled !== false,
      compactModeEnabled: data.compact_mode_enabled === true,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
      updatedByUid: typeof data.updated_by === "string" ? data.updated_by : null,
      updatedBy: typeof data.updated_by_email === "string" ? data.updated_by_email : null,
    } satisfies AdminSettings;
  }
  const db = getAdminDb();
  if (!db) return defaultAdminSettings;
  const doc = await db.collection("adminSettings").doc("default").get();
  return mapSettings(doc.data());
}

export async function updateAdminSettings(settings: z.infer<typeof adminSettingsSchema>, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const now = new Date().toISOString();
  await db.collection("adminSettings").doc("default").set(
    {
      ...settings,
      updatedAt: now,
      updatedByUid: admin.uid,
      updatedBy: admin.email,
    },
    { merge: true },
  );
  return { ...settings, updatedAt: now, updatedByUid: admin.uid, updatedBy: admin.email };
}
