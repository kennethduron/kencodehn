import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_LOCAL_URL;
const publishableKey = process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY;
if (!url || !publishableKey || !serviceKey) throw new Error("Local notification RLS environment is incomplete.");
const target = new URL(url);
if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") throw new Error("Notification RLS E2E refuses non-loopback services.");

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "Notification-RLS-2026!";
const profiles = [
  { id: "20000000-0000-4000-8000-000000000001", email: "notification-owner@example.test", role: "owner", active: true },
  { id: "20000000-0000-4000-8000-000000000002", email: "notification-sales@example.test", role: "sales_agent", active: true },
  { id: "20000000-0000-4000-8000-000000000003", email: "notification-viewer@example.test", role: "viewer", active: true },
  { id: "20000000-0000-4000-8000-000000000004", email: "notification-inactive@example.test", role: "manager", active: false },
] as const;

for (const profile of profiles) {
  await service.auth.admin.deleteUser(profile.id).catch(() => undefined);
  const created = await service.auth.admin.createUser({ id: profile.id, email: profile.email, password, email_confirm: true });
  if (created.error) throw created.error;
  const inserted = await service.from("profiles").upsert({ id: profile.id, firebase_id: `rls:${profile.id}`, email: profile.email, name: profile.role, role: profile.role, active: profile.active });
  if (inserted.error) throw inserted.error;
}

async function signedIn(email: string) {
  const client = createClient(url as string, publishableKey as string, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return client;
}

try {
  for (const profile of profiles.filter((profile) => profile.active)) {
    const client = await signedIn(profile.email);
    const write = await client.from("user_notification_preferences").upsert({ profile_id: profile.id, push_enabled: true, email_enabled: false });
    assert.equal(write.error, null, `${profile.role} should manage own preferences`);
    const own = await client.from("user_notification_preferences").select("profile_id,push_enabled,email_enabled");
    assert.equal(own.error, null);
    assert.deepEqual(own.data?.map((row) => row.profile_id), [profile.id]);
  }

  const owner = await signedIn(profiles[0].email);
  const forged = await owner.from("user_notification_preferences").upsert({ profile_id: profiles[1].id, push_enabled: false });
  assert.ok(forged.error, "User A must not change user B preferences");

  const inactive = await signedIn(profiles[3].email);
  const inactiveWrite = await inactive.from("user_notification_preferences").insert({ profile_id: profiles[3].id });
  assert.ok(inactiveWrite.error, "Inactive profile must not create preferences");

  console.log(JSON.stringify({ target: "loopback-only", owner: "PASS", salesAgent: "PASS", viewer: "PASS", crossUserDenied: "PASS", inactiveDenied: "PASS" }, null, 2));
} finally {
  await service.from("user_notification_preferences").delete().in("profile_id", profiles.map((profile) => profile.id));
  await service.from("profiles").delete().in("id", profiles.map((profile) => profile.id));
  for (const profile of profiles) await service.auth.admin.deleteUser(profile.id).catch(() => undefined);
}
