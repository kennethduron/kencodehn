import "server-only";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminRole } from "@/lib/admin/authorization";

export const notificationEventTypes = [
  "mail_received",
  "task_assigned",
  "follow_up",
  "billing",
  "proposal_activity",
  "team_activity",
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];
export type NotificationChannel = "crm" | "push" | "email";
export type EventChannelPreferences = Record<NotificationEventType, Record<NotificationChannel, boolean>>;

const channelPreferencesSchema = z.object({ crm: z.boolean(), push: z.boolean(), email: z.boolean() }).strict();
export const eventChannelPreferencesSchema = z.object({
  mail_received: channelPreferencesSchema,
  task_assigned: channelPreferencesSchema,
  follow_up: channelPreferencesSchema,
  billing: channelPreferencesSchema,
  proposal_activity: channelPreferencesSchema,
  team_activity: channelPreferencesSchema,
}).strict();

export const personalNotificationPreferencesSchema = z.object({
  internalEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  events: eventChannelPreferencesSchema,
}).strict();

export type PersonalNotificationPreferences = z.infer<typeof personalNotificationPreferencesSchema>;

export const defaultPersonalNotificationPreferences: PersonalNotificationPreferences = {
  internalEnabled: true,
  pushEnabled: false,
  emailEnabled: false,
  events: {
    mail_received: { crm: true, push: true, email: true },
    task_assigned: { crm: true, push: true, email: true },
    follow_up: { crm: true, push: true, email: true },
    billing: { crm: true, push: true, email: true },
    proposal_activity: { crm: true, push: true, email: false },
    team_activity: { crm: true, push: false, email: false },
  },
};

export function notificationEventsForRole(role: AdminRole): NotificationEventType[] {
  if (role === "owner" || role === "admin") return [...notificationEventTypes];
  if (role === "manager") return ["mail_received", "task_assigned", "follow_up", "billing", "proposal_activity", "team_activity"];
  if (role === "sales_agent") return ["mail_received", "task_assigned", "follow_up", "billing", "proposal_activity"];
  return ["billing", "proposal_activity"];
}

function mapPreferences(row: Record<string, unknown> | null | undefined): PersonalNotificationPreferences {
  const events = eventChannelPreferencesSchema.safeParse(row?.event_preferences);
  return {
    internalEnabled: row?.internal_enabled !== false,
    pushEnabled: row?.push_enabled === true,
    emailEnabled: row?.email_enabled === true,
    events: events.success ? events.data : defaultPersonalNotificationPreferences.events,
  };
}

export async function getPersonalNotificationPreferences(profileId: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("user_notification_preferences").select("*").eq("profile_id", profileId).maybeSingle();
  if (error && error.code !== "42P01") throw new Error(`Notification preferences lookup failed (${error.code ?? "unknown"}).`);
  return mapPreferences(data);
}

export async function savePersonalNotificationPreferences(profileId: string, input: PersonalNotificationPreferences) {
  const parsed = personalNotificationPreferencesSchema.parse(input);
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("user_notification_preferences").upsert({
    profile_id: profileId,
    internal_enabled: parsed.internalEnabled,
    push_enabled: parsed.pushEnabled,
    email_enabled: parsed.emailEnabled,
    event_preferences: parsed.events,
    updated_at: new Date().toISOString(),
  }, { onConflict: "profile_id" }).select("*").single();
  if (error) throw new Error(`Notification preferences save failed (${error.code ?? "unknown"}).`);
  return mapPreferences(data);
}

export async function notificationChannelEnabled(profileId: string, event: NotificationEventType, channel: NotificationChannel) {
  const preferences = await getPersonalNotificationPreferences(profileId);
  const masterEnabled = channel === "crm"
    ? preferences.internalEnabled
    : channel === "push" ? preferences.pushEnabled : preferences.emailEnabled;
  return masterEnabled && preferences.events[event][channel];
}

export async function getAuthoritativeNotificationRecipient(profileId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("profiles")
    .select("id,email,active,role")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(`Notification recipient lookup failed (${error.code ?? "unknown"}).`);
  if (!data || data.active !== true || !data.email) return null;
  return { id: String(data.id), email: String(data.email).trim().toLowerCase(), role: String(data.role ?? "") };
}
