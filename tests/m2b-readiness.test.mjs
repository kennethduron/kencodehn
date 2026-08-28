import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getCrmDataProvider } from "../src/lib/data/provider.ts";
import { resolveAdminNextPath, resolveSupabaseAuthRedirect } from "../src/lib/supabase/auth-redirects.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("CRM data provider remains Firebase by default and requires an explicit Supabase flag", () => {
  assert.equal(getCrmDataProvider({}), "firebase");
  assert.equal(getCrmDataProvider({ CRM_DATA_PROVIDER: "supabase" }), "supabase");
  assert.throws(() => getCrmDataProvider({ CRM_DATA_PROVIDER: "other" }), /Unsupported/);
});

test("auth and data providers reject unsupported mixed combinations", () => {
  const source = read("../src/lib/auth/provider.ts");
  assert.match(source, /if \(auth !== data\)/);
  assert.match(source, /Unsupported CRM provider combination/);
});

test("admin recovery redirects reject external and non-admin destinations", () => {
  assert.equal(resolveAdminNextPath("/admin/leads?status=new"), "/admin/leads?status=new");
  assert.equal(resolveAdminNextPath("https://evil.example/admin"), "/admin");
  assert.equal(resolveAdminNextPath("//evil.example/admin"), "/admin");
  assert.equal(resolveAdminNextPath("/checkout"), "/admin");
  assert.equal(resolveSupabaseAuthRedirect("https://evil.example/admin"), "https://kencodehn.com/admin");
});

test("Supabase account UI includes forgot password, recovery, password visibility and secure reauthentication", () => {
  const forgot = read("../src/components/auth/forgot-password-form.tsx");
  const recovery = read("../src/components/auth/recovery-form.tsx");
  const password = read("../src/components/auth/password-field.tsx");
  const security = read("../src/components/auth/security-panel.tsx");
  assert.match(forgot, /resetPasswordForEmail/);
  assert.match(forgot, /Si la cuenta existe/);
  assert.match(recovery, /updateUser\(\{ password \}\)/);
  assert.match(recovery, /inválido|invÃ¡lido/);
  assert.match(password, /aria-label=\{visible \? `Ocultar/);
  assert.match(password, /type=\{visible \? "text" : "password"\}/);
  assert.match(security, /reauthenticate\(\)/);
  assert.match(security, /updateUser\(\{ password, nonce:/);
  assert.match(security, /!verificationSent \|\| nonce\.trim\(\)\.length < 6/);
  assert.match(security, /security\/password-changed/);
});

test("Supabase team invitations reject Owner and use server-only transactional RPCs", () => {
  const sql = read("../supabase/migrations/20260828000400_m2b_account_admin_rpcs.sql");
  const users = read("../src/lib/admin/supabase-users.ts");
  assert.match(sql, /if p_role = 'owner' then raise exception/);
  assert.match(sql, /revoke all on function public\.provision_invited_profile[\s\S]*from public,anon,authenticated/);
  assert.match(users, /auth\.admin\.inviteUserByEmail/);
  assert.match(users, /provision_invited_profile/);
});

test("public Supabase variables are statically referenced for Next.js browser inlining", () => {
  const source = read("../src/lib/supabase/env.ts");
  assert.match(source, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(source, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(source, /process\.env\[name\]/);
});

test("provider abstraction exposes all CRM read domains", () => {
  const types = read("../src/lib/data/repositories/types.ts");
  const supabase = read("../src/lib/data/repositories/supabase.ts");
  for (const domain of ["leads", "notes", "tasks", "notifications", "activity", "users", "settings", "reminders"]) {
    assert.match(types, new RegExp(`${domain}:`));
    assert.match(supabase, new RegExp(`${domain}:`));
  }
});

test("provider abstraction exposes current CRM write operations", () => {
  const types = read("../src/lib/data/repositories/types.ts");
  for (const operation of ["update", "assign", "add", "create", "remove", "setRead", "markAllRead"]) {
    assert.match(types, new RegExp(`${operation}\\(`));
  }
  const firebase = read("../src/lib/data/repositories/firebase.ts");
  const supabase = read("../src/lib/data/repositories/supabase.ts");
  assert.match(firebase, /assign: assignLead/);
  assert.match(supabase, /crm_write/);
});

test("admin APIs route reads and mutations through the selected repository", () => {
  for (const path of [
    "../src/app/api/admin/leads/route.ts",
    "../src/app/api/admin/leads/[id]/route.ts",
    "../src/app/api/admin/leads/[id]/notes/route.ts",
    "../src/app/api/admin/tasks/route.ts",
    "../src/app/api/admin/tasks/[id]/route.ts",
    "../src/app/api/admin/notifications/route.ts",
    "../src/app/api/admin/settings/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /createCrmRepositories/);
    assert.doesNotMatch(source, /@\/lib\/admin\/data/);
  }
});

test("Supabase CRM writes are transactional, authenticated and RLS-backed", () => {
  const sql = read("../supabase/migrations/20260828000600_m2b_transactional_crm_writes.sql");
  assert.match(sql, /function public\.crm_write/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /where id = auth\.uid\(\) and active = true/);
  assert.match(sql, /grant execute on function public\.crm_write\(text,jsonb\) to authenticated/);
  assert.match(sql, /lead update forbidden/);
  assert.match(sql, /task assignment forbidden/);
  assert.match(sql, /notifications_insert_scoped/);
  assert.match(sql, /current_profile_role\(\)='manager'[\s\S]*recipient_id in \(auth\.uid\(\), \(select l\.assigned_to/);
  assert.doesNotMatch(sql, /grant execute on function public\.crm_write[\s\S]*to anon/);
});

test("public Supabase lead persistence is service-role only and atomic", () => {
  const sql = read("../supabase/migrations/20260828000600_m2b_transactional_crm_writes.sql");
  const route = read("../src/app/api/leads/route.ts");
  assert.match(sql, /function public\.create_public_lead/);
  assert.match(sql, /revoke all on function public\.create_public_lead\(jsonb\) from public,anon,authenticated/);
  assert.match(sql, /grant execute on function public\.create_public_lead\(jsonb\) to service_role/);
  assert.match(route, /isSupabaseDataProviderEnabled/);
  assert.match(route, /create_public_lead/);
});

test("Supabase delivery logs and FCM device tokens follow the data provider", () => {
  const email = read("../src/lib/email/service.ts");
  const push = read("../src/lib/push/service.ts");
  assert.match(email, /isSupabaseDataProviderEnabled/);
  assert.match(email, /from\("email_logs"\)/);
  assert.match(push, /from\("device_tokens"\)/);
  assert.match(push, /from\("push_logs"\)/);
  assert.match(push, /createHash\("sha256"\)/);
  assert.match(push, /eq\("profile_id", uid\)/);
});

test("Supabase reminder processing uses service-only leases and provider-aware delivery channels", () => {
  const source = read("../src/lib/data/repositories/supabase.ts");
  const sql = read("../supabase/migrations/20260828000600_m2b_transactional_crm_writes.sql");
  assert.match(source, /createSupabaseAdminClient\(\)/);
  assert.match(source, /enqueue_due_reminder_events/);
  assert.match(source, /claim_due_reminder_events/);
  assert.match(source, /complete_reminder_event/);
  assert.match(source, /sendTaskReminderEmail/);
  assert.match(source, /sendPushToUser/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /lease_token/);
  assert.doesNotMatch(sql, /grant execute on function public\.claim_due_reminder_events[\s\S]{0,250}to authenticated/);
});

test("Supabase repository applies database ownership filters", () => {
  const source = read("../src/lib/data/repositories/supabase.ts");
  assert.match(source, /leadDataScopeForAdmin/);
  assert.match(source, /taskDataScopeForAdmin/);
  assert.match(source, /notificationDataScopeForAdmin/);
  assert.match(source, /eq\("assigned_to", admin\.uid\)/);
  assert.match(source, /eq\("recipient_id", admin\.uid\)/);
});

test("service-role migration grants do not expand anon or authenticated access", () => {
  const sql = read("../supabase/migrations/20260828000200_m2b_service_role_writer.sql");
  assert.match(sql, /grant select[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /grant\s+(?:select|insert|update|delete)[\s\S]*to\s+(?:anon|authenticated)/i);
});

test("safe delta writer locks mapping and target and checks the exact expected row", () => {
  const sql = read("../supabase/migrations/20260828000300_m2b_safe_delta.sql");
  assert.match(sql, /for update/gi);
  assert.match(sql, /current_row is distinct from p_expected_row/);
  assert.match(sql, /existing_map\.checksum <> p_previous_checksum/);
  assert.match(sql, /return 'conflict'/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to (?:anon|authenticated)/i);
});

test("production defaults remain Firebase and no automatic cutover is encoded", () => {
  const auth = read("../src/lib/auth/provider.ts");
  const data = read("../src/lib/data/provider.ts");
  assert.match(auth, /!configured \|\| configured === "firebase"/);
  assert.match(data, /!configured \|\| configured === "firebase"/);
  assert.doesNotMatch(read("../.env.example"), /^CRM_(?:AUTH|DATA)_PROVIDER=supabase$/m);
});

test("Firebase notification ownership query does not require an undeployed composite index", () => {
  const source = read("../src/lib/admin/data.ts");
  const personalQuery = source.match(/const personalSnapshot[\s\S]*?\.get\(\);/)?.[0] ?? "";
  assert.match(personalQuery, /where\("recipientUid", "==", admin\.uid\)/);
  assert.doesNotMatch(personalQuery, /orderBy/);
});

test("M2B readiness tests contain no real migration execution", () => {
  const packageJson = JSON.parse(read("../package.json"));
  assert.doesNotMatch(packageJson.scripts["test:m2b:readiness"], /--write|migrate:supabase/);
});
