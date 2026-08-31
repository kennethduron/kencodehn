import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const worker = read("src/app/firebase-messaging-sw.js/route.ts");
const client = read("src/lib/push/client.ts");
const service = read("src/lib/push/service.ts");
const settings = read("src/components/admin/push-settings.tsx");
const devicesRoute = read("src/app/api/admin/push/devices/route.ts");
const testRoute = read("src/app/api/admin/push/test/route.ts");
const preferencesRoute = read("src/app/api/admin/notification-preferences/route.ts");
const preferences = read("src/lib/notifications/preferences.ts");
const migration = read("supabase/migrations/20260902000900_cross_platform_notification_preferences.sql");
const servicePrivileges = read("supabase/migrations/20260902001000_notification_delivery_service_privileges.sql");
const optInMigration = read("supabase/migrations/20260902001100_notification_channels_opt_in.sql");
const manifest = read("src/app/manifest.ts");
const shell = read("src/components/admin/admin-chrome.tsx");

test("iOS service worker avoids the WebKit-invalid regular expression literal", () => {
  assert.doesNotMatch(worker, /\[\/?#\]/);
  assert.doesNotMatch(worker, /Invalid regular expression/);
  assert.match(worker, /candidate\.startsWith\(\"\/admin\/\"\)/);
});

test("service worker SDK matches the installed Firebase release", () => {
  assert.equal((worker.match(/firebasejs\/12\.13\.0/g) || []).length, 2);
  assert.doesNotMatch(worker, /firebasejs\/10\.13\.2/);
});

test("service worker update lifecycle replaces stale workers safely", () => {
  assert.match(worker, /WORKER_VERSION/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
  assert.match(client, /updateViaCache: "none"/);
  assert.match(client, /SKIP_WAITING/);
});

test("push capability uses feature detection instead of user-agent gating", () => {
  for (const capability of ["Notification", "serviceWorker", "PushManager"]) assert.match(client, new RegExp(capability));
  assert.doesNotMatch(client, /userAgent|iPhone|Android/);
});

test("notification permission is requested only by the explicit activate action", () => {
  const activate = settings.slice(settings.indexOf("async function activate"), settings.indexOf("async function sendTest"));
  assert.match(activate, /Notification\.requestPermission\(\)/);
  assert.doesNotMatch(settings.slice(0, settings.indexOf("async function activate")), /requestPermission\(\)/);
});

test("client loads Firebase Messaging lazily", () => {
  assert.match(client, /await import\("firebase\/messaging"\)/);
  assert.doesNotMatch(settings, /from "firebase\/messaging"/);
});

test("push failures never expose technical provider errors in the UI", () => {
  for (const value of ["SyntaxError", "RegExp", "FirebaseError", "VAPID", "PushManager", "Service Worker", "FCM"]) assert.doesNotMatch(settings, new RegExp(value));
  assert.match(settings, /No pudimos activar las notificaciones\. Intente nuevamente\./);
});

test("test push is scoped to the authenticated current device", () => {
  assert.match(settings, /body: JSON\.stringify\(\{ deviceId: currentDeviceId \}\)/);
  assert.match(testRoute, /sendTestPushToDevice\(admin\.uid, parsed\.data\.deviceId\)/);
  assert.doesNotMatch(testRoute, /sendPushToAdmins|push:manage/);
  assert.match(service, /\.eq\("id", deviceId\)[\s\S]*\.eq\("profile_id", uid\)/);
});

test("test push reports success only after one provider acceptance", () => {
  assert.match(testRoute, /result\.sent !== 1 \|\| result\.failed !== 0/);
  assert.match(testRoute, /status: 409/);
});

test("all active roles can manage only their own devices", () => {
  assert.match(devicesRoute, /requireAdminFromRequest/);
  assert.doesNotMatch(devicesRoute, /push:manage/);
  assert.match(service, /eq\("profile_id", actor\.uid\)/);
});

test("personal preferences use authoritative authenticated identity", () => {
  assert.match(preferencesRoute, /getPersonalNotificationPreferences\(admin\.uid\)/);
  assert.match(preferencesRoute, /savePersonalNotificationPreferences\(admin\.uid/);
  assert.doesNotMatch(preferencesRoute, /profileId|notificationEmail.*request/);
});

test("notification email is resolved from the authoritative profile", () => {
  assert.match(preferences, /from\("profiles"\)/);
  assert.match(preferences, /select\("id,email,active,role"\)/);
  assert.match(preferencesRoute, /notificationEmail: recipient\.email/);
});

test("preferences separate CRM, push and email per event", () => {
  for (const event of ["mail_received", "task_assigned", "follow_up", "billing", "proposal_activity", "team_activity"]) assert.match(preferences, new RegExp(event));
  for (const channel of ["crm", "push", "email"]) assert.match(settings, new RegExp(`\"${channel}\"`));
});

test("security emails remain outside optional notification preferences", () => {
  assert.match(settings, /invitaciones, la recuperación de contraseña y los avisos críticos de seguridad no dependen/);
});

test("optional push and email channels default off and require explicit activation", () => {
  assert.match(preferences, /pushEnabled: false/);
  assert.match(preferences, /emailEnabled: false/);
  assert.match(optInMigration, /alter column push_enabled set default false/);
  assert.match(optInMigration, /alter column email_enabled set default false/);
  assert.match(settings, /savePreferences\(\{ \.\.\.preferences, pushEnabled: true \}, false\)/);
});

test("preferences table is forced-RLS and self-scoped", () => {
  assert.match(migration, /alter table public\.user_notification_preferences force row level security/);
  assert.match(migration, /profile_id = auth\.uid\(\)/g);
  assert.doesNotMatch(migration, /grant delete/);
});

test("notification delivery has least-privilege server writes without delete", () => {
  assert.match(servicePrivileges, /grant select, insert, update on table public\.user_notification_preferences to service_role/);
  assert.match(servicePrivileges, /grant select, insert, update on table public\.device_tokens to service_role/);
  assert.match(servicePrivileges, /grant select, insert, update on table public\.push_logs to service_role/);
  assert.match(servicePrivileges, /grant select, insert, update on table public\.email_logs to service_role/);
  assert.doesNotMatch(servicePrivileges, /grant[^;]*delete/i);
});

test("device lifecycle refreshes tokens and cleans them on logout", () => {
  assert.match(settings, /getCurrentPushToken/);
  assert.match(client, /deleteToken/);
  assert.match(client, /unregisterCurrentPushDevice/);
  assert.match(shell, /unregisterCurrentPushDevice/);
});

test("inactive profiles and cross-user devices are excluded from delivery", () => {
  assert.match(service, /profiles\?\.active === true/g);
  assert.match(service, /\.eq\("profile_id", uid\)/);
});

test("foreground push refreshes internal state without duplicating a native notification", () => {
  assert.match(shell, /subscribeToForegroundPush/);
  assert.match(shell, /kc:push-received/);
  assert.doesNotMatch(service, /notification:\s*\{/);
  assert.match(worker, /showNotification/);
});

test("PWA manifest satisfies Apple Home Screen identity requirements", () => {
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /start_url: "\/admin"/);
  assert.match(manifest, /id: "\/admin"/);
});

test("notification settings remain responsive and touch friendly", () => {
  assert.match(settings, /overflow-x-auto/);
  assert.match(settings, /min-h-11/g);
  assert.match(settings, /sm:p-6/);
  assert.match(settings, /md:grid-cols-2/);
});
