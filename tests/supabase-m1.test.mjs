import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { getCrmDataProvider, isSupabaseDataProviderEnabled } from "../src/lib/data/provider.ts";
import { resolveSupabaseAuthRedirect } from "../src/lib/supabase/auth-redirects.ts";
import { parseMigrationMode } from "../src/lib/migration/guards.ts";
import {
  deterministicReminderIdentity,
  firestoreTimestampToIso,
  migrationMapRow,
  moneyToMinorUnits,
  parseCivilDate,
  resolveProfileId,
  targetUuidForFirebase,
  transformFirestoreDocument,
} from "../src/lib/migration/transform.ts";

const root = process.cwd();
const coreSql = readFileSync(join(root, "supabase/migrations/20260827000100_core_profiles.sql"), "utf8");
const schemaSql = readFileSync(join(root, "supabase/migrations/20260827000200_crm_schema.sql"), "utf8");
const rlsSql = readFileSync(join(root, "supabase/migrations/20260827000300_rls.sql"), "utf8");
const guardSql = readFileSync(join(root, "supabase/migrations/20260827000500_guard_scoped_mutations.sql"), "utf8");
const clientSource = readFileSync(join(root, "src/lib/supabase/client.ts"), "utf8");
const adminSource = readFileSync(join(root, "src/lib/supabase/admin.ts"), "utf8");

test("M1 provider defaults to Firebase", () => {
  assert.equal(getCrmDataProvider({}), "firebase");
  assert.equal(getCrmDataProvider({ CRM_DATA_PROVIDER: "" }), "firebase");
});

test("Supabase requires an explicit provider flag", () => {
  assert.equal(isSupabaseDataProviderEnabled({ CRM_DATA_PROVIDER: "firebase" }), false);
  assert.equal(isSupabaseDataProviderEnabled({ CRM_DATA_PROVIDER: "supabase" }), true);
});

test("unknown providers fail closed", () => {
  assert.throws(() => getCrmDataProvider({ CRM_DATA_PROVIDER: "other" }), /Unsupported/);
});

test("browser client contains no server secret", () => {
  assert.doesNotMatch(clientSource, /SUPABASE_SECRET_KEY|service_role/i);
  assert.match(clientSource, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|PublicSupabaseConfig|getPublicSupabaseConfig/);
});

test("admin client is server-only and uses the secret key", () => {
  assert.match(adminSource, /server-only/);
  assert.match(adminSource, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(adminSource, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
});

test("SQL preserves exactly the five CRM roles", () => {
  for (const role of ["owner", "admin", "manager", "viewer", "sales_agent"]) assert.match(coreSql, new RegExp(`'${role}'`));
  assert.doesNotMatch(coreSql, /sales_rep|super_admin/);
});

test("Sales Agent lead RLS is bound to auth.uid", () => {
  assert.match(rlsSql, /assigned_to = auth\.uid\(\)/);
});

test("Sales Agent note RLS follows lead ownership", () => {
  assert.match(rlsSql, /lead_notes_insert_scoped[\s\S]*lead_belongs_to_current_user\(lead_id\)/);
});

test("Sales Agent task RLS checks task and optional lead ownership", () => {
  assert.match(rlsSql, /task_in_current_scope\(assigned_to, lead_id\)/);
});

test("Sales Agent notification RLS requires its recipient UUID", () => {
  assert.match(rlsSql, /current_profile_role\(\) = 'sales_agent' and recipient_id = auth\.uid\(\)/);
});

test("profiles cannot be updated by authenticated browser clients", () => {
  assert.match(rlsSql, /grant select on public\.profiles to authenticated/);
  assert.doesNotMatch(rlsSql, /grant select, update on public\.profiles/);
  assert.doesNotMatch(rlsSql, /create policy profiles_.*update/);
});

test("inactive profiles fail closed in RLS helpers", () => {
  assert.match(rlsSql, /where p\.id = auth\.uid\(\) and p\.active = true/);
  assert.match(rlsSql, /current_profile_active/);
});

test("Manager and Viewer retain global lead read scope", () => {
  assert.match(rlsSql, /'owner', 'admin', 'manager', 'viewer'/);
  assert.match(rlsSql, /current_profile_role\(\) in \('owner', 'admin', 'manager'\)/);
});

test("legacy unassigned lead remains unassigned", () => {
  const result = transformFirestoreDocument("leads", "legacy-lead", { name: "Legacy", createdAt: "2025-01-01T00:00:00Z" });
  assert.equal(result.row.assigned_to, null);
});

test("legacy task without assignment remains valid and unassigned", () => {
  const result = transformFirestoreDocument("tasks", "legacy-task", { title: "Legacy", createdAt: "2025-01-01T00:00:00Z" });
  assert.equal(result.row.assigned_to, null);
  assert.equal(result.row.lead_id, null);
});

test("legacy notification never acquires a recipient", () => {
  const result = transformFirestoreDocument("notifications", "legacy-notification", { title: "Legacy", createdAt: "2025-01-01T00:00:00Z" });
  assert.equal(result.row.recipient_id, null);
});

test("Firebase IDs map deterministically to UUIDs", () => {
  const first = targetUuidForFirebase("leads", "abc");
  assert.equal(first, targetUuidForFirebase("leads", "abc"));
  assert.notEqual(first, targetUuidForFirebase("tasks", "abc"));
  assert.match(first, /^[0-9a-f-]{36}$/);
});

test("Firebase UID mapping never assumes the UID is a Supabase UUID", () => {
  const target = "c9a94485-874d-4b4c-bfa1-fb0afbc22f9c";
  assert.equal(resolveProfileId("firebase-user", { "firebase-user": target }), target);
  assert.throws(() => resolveProfileId("firebase-user", {}), /Missing Supabase profile mapping/);
});

test("money converts major units into exact minor units", () => {
  assert.equal(moneyToMinorUnits("1499.99"), 149999n);
  assert.equal(moneyToMinorUnits("$1,499.50"), 149950n);
  assert.equal(moneyToMinorUnits(119), 11900n);
});

test("invalid or over-precise money is rejected", () => {
  assert.throws(() => moneyToMinorUnits("10.001"), /Invalid monetary value/);
  assert.throws(() => moneyToMinorUnits(-1), /Invalid monetary value/);
});

test("Firestore timestamp conversion preserves the instant", () => {
  assert.equal(firestoreTimestampToIso({ seconds: 0, nanoseconds: 0 }), "1970-01-01T00:00:00.000Z");
  assert.equal(firestoreTimestampToIso("2026-08-27T14:00:00-06:00"), "2026-08-27T20:00:00.000Z");
});

test("Honduras civil dates remain DATE values without UTC-midnight conversion", () => {
  assert.equal(parseCivilDate("2025-03-10"), "2025-03-10");
  assert.equal(parseCivilDate("2025-03-10T06:00:00.000Z"), "2025-03-10");
  assert.throws(() => parseCivilDate("2025-02-30"), /Invalid civil date/);
});

test("reminder identity is deterministic and kind-specific", () => {
  const first = deterministicReminderIdentity("task-1", "due", "2026-08-27T14:00:00Z");
  assert.equal(first, deterministicReminderIdentity("task-1", "due", "2026-08-27T14:00:00Z"));
  assert.notEqual(first, deterministicReminderIdentity("task-1", "overdue", "2026-08-27T14:00:00Z"));
});

test("database enforces duplicate reminder protection", () => {
  assert.match(schemaSql, /deterministic_key text not null unique/);
});

test("migration command defaults to local-only dry run", () => {
  assert.deepEqual(parseMigrationMode([], {}), {
    dryRun: true,
    sourceRead: false,
    write: false,
    confirmedSourceProject: null,
    confirmedTargetProjectRef: null,
    confirmedTargetProjectName: null,
    confirmedTargetOrganization: null,
    confirmedTargetRegion: null,
  });
});

test("migration cannot write without two explicit safeguards", () => {
  assert.throws(() => parseMigrationMode(["--write"], {}), /MIGRATION_ALLOW_REMOTE_WRITE/);
  assert.throws(() => parseMigrationMode(["--write", "--confirm-source-project=kencode-81d66"], {
    MIGRATION_ALLOW_REMOTE_WRITE: "true",
    FIREBASE_PROJECT_ID: "kencode-81d66",
    SUPABASE_SECRET_KEY: "not-logged",
  }), /target identity mismatch/);
});

test("unknown enum and status values are rejected", () => {
  assert.throws(() => transformFirestoreDocument("leads", "lead", { name: "Lead", status: "hacked" }), /Unknown lead status/);
  assert.throws(() => transformFirestoreDocument("tasks", "task", { title: "Task", status: "mystery" }), /Unknown task status/);
});

test("SQL contains real FK relationships", () => {
  assert.match(schemaSql, /lead_id uuid not null references public\.leads\(id\) on delete restrict/);
  assert.match(schemaSql, /assigned_to uuid references public\.profiles\(id\) on delete restrict/);
  assert.match(coreSql, /references auth\.users\(id\) on delete restrict/);
});

test("malformed migration rows are rejected", () => {
  assert.throws(() => transformFirestoreDocument("leads", "lead", null), /Malformed migration row/);
  assert.throws(() => transformFirestoreDocument("notes", "note", { text: "orphan" }), /requires leadId/);
});

test("migration map preserves source and deterministic target", () => {
  const result = transformFirestoreDocument("leads", "lead-1", { name: "Lead" });
  const map = migrationMapRow(result);
  assert.equal(map.source_id, "lead-1");
  assert.equal(map.target_id, result.targetId);
  assert.equal(map.source_system, "firebase");
});

test("auth redirects allow only Ken Code admin URLs", () => {
  assert.equal(resolveSupabaseAuthRedirect("https://kencodehn.com/admin/recovery"), "https://kencodehn.com/admin/recovery");
  assert.equal(resolveSupabaseAuthRedirect("/admin"), "https://kencodehn.com/admin");
});

test("auth redirects reject open redirects and public paths", () => {
  assert.equal(resolveSupabaseAuthRedirect("https://evil.example/admin"), "https://kencodehn.com/admin");
  assert.equal(resolveSupabaseAuthRedirect("//evil.example/admin"), "https://kencodehn.com/admin");
  assert.equal(resolveSupabaseAuthRedirect("https://kencodehn.com/contacto"), "https://kencodehn.com/admin");
});

test("every sensitive public table enables and forces RLS", () => {
  const tables = ["profiles", "migration_id_map", "leads", "lead_notes", "tasks", "notifications", "activity_logs", "email_logs", "push_logs", "device_tokens", "admin_settings", "reminder_events"];
  for (const table of tables) {
    assert.match(rlsSql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(rlsSql, new RegExp(`alter table public\\.${table} force row level security`));
  }
});

test("SECURITY DEFINER helpers use a fixed search_path", () => {
  const allSecuritySql = `${rlsSql}\n${guardSql}`;
  const definerCount = (allSecuritySql.match(/security definer/g) ?? []).length;
  const fixedPathCount = (allSecuritySql.match(/security definer\nset search_path = pg_catalog/g) ?? []).length;
  assert.equal(fixedPathCount, definerCount);
});

test("scoped users cannot forge denormalized lead assignment data", () => {
  assert.match(guardSql, /old\.assigned_to_name/);
  assert.match(guardSql, /old\.assigned_to_email/);
  assert.match(guardSql, /lead assignment requires owner or admin/);
});

test("scoped users cannot forge task actors or notification content", () => {
  assert.match(guardSql, /task completion actor must match auth\.uid\(\)/);
  assert.match(guardSql, /only notification state can be changed by this role/);
});
