import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AdminSettings, AdminUser } from "@/lib/admin/types";

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
  updatedBy: null,
};

const ownerPermissions = [
  "leads:view",
  "leads:edit",
  "tasks:delete",
  "reports:view",
  "settings:manage",
  "users:manage",
];

export function defaultPermissionsForRole(role: AdminUser["role"]) {
  if (role === "owner") return ownerPermissions;
  if (role === "admin") return ownerPermissions.filter((permission) => permission !== "users:manage");
  if (role === "manager") return ["leads:view", "leads:edit", "reports:view"];
  return ["leads:view"];
}

export function canManageSettings(admin: AdminUser) {
  return admin.role === "owner" || admin.permissions?.includes("settings:manage") === true;
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
    updatedBy: typeof data?.updatedBy === "string" ? data.updatedBy : null,
  };
}

export async function getAdminSettings() {
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
      updatedBy: admin.email,
    },
    { merge: true },
  );
  return { ...settings, updatedAt: now, updatedBy: admin.email };
}

export async function ensureAdminUserProfile(admin: AdminUser) {
  const db = getAdminDb();
  if (!db) return;
  const now = new Date().toISOString();
  await db.collection("adminUsers").doc(admin.uid).set(
    {
      uid: admin.uid,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions ?? defaultPermissionsForRole(admin.role),
      active: true,
      updatedAt: now,
    },
    { merge: true },
  );
}
