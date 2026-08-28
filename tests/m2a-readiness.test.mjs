import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FIREBASE_CRM_SOURCE_PROJECT_ID,
  FIREBASE_LEGACY_EXCLUDED_PROJECT_ID,
  SUPABASE_TARGET_ORGANIZATION,
  SUPABASE_TARGET_PROJECT_NAME,
  SUPABASE_TARGET_PROJECT_REF,
  SUPABASE_TARGET_REGION,
  assertFirebaseSourceProject,
  assertSupabaseRemoteUrl,
  assertSupabaseTargetIdentity,
  parseMigrationMode,
} from "../src/lib/migration/guards.ts";
import {
  analyzeMigrationDryRun,
  assertOwnerInvariant,
  createFirebaseScryptHash,
  formatFirebaseScryptHash,
  prepareMigrationRows,
} from "../src/lib/migration/preflight.ts";
import {
  MemoryAuthMigrationStore,
  MemoryMigrationStore,
  MigrationConflictError,
  MigrationInterruptedError,
  migrateAuthUsers,
  runMigrationWriter,
} from "../src/lib/migration/writer.ts";
import { SANITIZED_AUTH_USERS, SANITIZED_FIRESTORE } from "./fixtures/m2a-sanitized.ts";

const source = FIREBASE_CRM_SOURCE_PROJECT_ID;
const target = {
  projectRef: SUPABASE_TARGET_PROJECT_REF,
  projectName: SUPABASE_TARGET_PROJECT_NAME,
  organization: SUPABASE_TARGET_ORGANIZATION,
  region: SUPABASE_TARGET_REGION,
};
const guardedArgs = [
  "--write",
  `--confirm-source-project=${source}`,
  `--confirm-target-project-ref=${target.projectRef}`,
  `--confirm-target-project-name=${target.projectName}`,
  `--confirm-target-organization=${target.organization}`,
  `--confirm-target-region=${target.region}`,
];
const guardedEnv = {
  MIGRATION_ALLOW_REMOTE_WRITE: "true",
  FIREBASE_PROJECT_ID: source,
  SUPABASE_PROJECT_REF: target.projectRef,
  SUPABASE_PROJECT_NAME: target.projectName,
  SUPABASE_ORGANIZATION: target.organization,
  SUPABASE_REGION: target.region,
  NEXT_PUBLIC_SUPABASE_URL: `https://${target.projectRef}.supabase.co`,
  SUPABASE_SECRET_KEY: "sanitized-test-only",
};

test("Firebase source is exclusively kencode-81d66", () => {
  assert.equal(assertFirebaseSourceProject(source), source);
});

test("legacy live-chat project is explicitly rejected as source", () => {
  assert.equal(FIREBASE_LEGACY_EXCLUDED_PROJECT_ID, "kenneth-live-chat");
  assert.throws(() => assertFirebaseSourceProject(FIREBASE_LEGACY_EXCLUDED_PROJECT_ID), /mismatch/);
});

test("wrong Firebase project aborts", () => {
  assert.throws(() => assertFirebaseSourceProject("some-other-project"), /aborted/);
});

test("Supabase target accepts only Ken Code kencodehn identity", () => {
  assert.equal(assertSupabaseTargetIdentity(target), true);
  assert.throws(() => assertSupabaseTargetIdentity({ ...target, projectName: "other" }), /mismatch/);
});

test("Supabase remote URL must contain the exact approved project ref", () => {
  assert.equal(assertSupabaseRemoteUrl(`https://${target.projectRef}.supabase.co`), `https://${target.projectRef}.supabase.co`);
  assert.throws(() => assertSupabaseRemoteUrl("https://wrong.supabase.co"), /does not match/);
});

test("all remote writer guards are required and accepted only together", () => {
  assert.equal(parseMigrationMode(guardedArgs, guardedEnv).write, true);
  for (const missing of guardedArgs.slice(1)) {
    assert.throws(() => parseMigrationMode(guardedArgs.filter((argument) => argument !== missing), guardedEnv));
  }
});

test("writer is dry-run by default and mutates no target", async () => {
  const store = new MemoryMigrationStore();
  const rows = prepareMigrationRows(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS).rows;
  const result = await runMigrationWriter(rows, store);
  assert.equal(result.mode, "dry-run");
  assert.equal(store.targets.size, 0);
  assert.equal(store.mappings.size, 0);
});

test("optional orphan FK becomes null and original reference is preserved", () => {
  const fixture = structuredClone(SANITIZED_FIRESTORE);
  fixture.notifications.push({
    id: "fixture-notification-orphan",
    data: { leadId: "missing-legacy-lead", type: "system", title: "Orphan", createdAt: "2025-03-10T14:00:00.000Z" },
  });
  const prepared = prepareMigrationRows(fixture, SANITIZED_AUTH_USERS);
  const row = prepared.rows.find((candidate) => candidate.sourceId === "fixture-notification-orphan");
  assert.equal(prepared.optionalOrphans, 1);
  assert.equal(row.row.lead_id, null);
  assert.equal(row.row.legacy_data.orphaned_references.lead_id, "missing-legacy-lead");
});

test("null without a source relation remains distinguishable from an orphan", () => {
  const prepared = prepareMigrationRows(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS);
  const row = prepared.rows.find((candidate) => candidate.sourceId === "fixture-notification-legacy");
  assert.equal(row.row.lead_id, null);
  assert.equal("orphaned_references" in row.row.legacy_data, false);
});

test("mandatory orphan aborts readiness", () => {
  const fixture = structuredClone(SANITIZED_FIRESTORE);
  fixture.notes[0].data.leadId = "missing-required-lead";
  assert.throws(() => prepareMigrationRows(fixture, SANITIZED_AUTH_USERS), /Mandatory orphan/);
});

test("714 sanitized documents become 714 insert-ready with ten optional warnings", () => {
  const createdAt = "2025-03-10T14:00:00.000Z";
  const fixture = {
    adminUsers: [{ id: "fixture-owner-uid", data: { uid: "fixture-owner-uid", email: "owner.fixture@example.com", role: "owner", active: true, createdAt } }],
    leads: Array.from({ length: 703 }, (_, index) => ({ id: `lead-${index}`, data: { name: `Fixture ${index}`, createdAt } })),
    notes: [], tasks: [], emailLogs: [], pushLogs: [], deviceTokens: [], adminSettings: [], reminderEvents: [],
    notifications: Array.from({ length: 4 }, (_, index) => ({ id: `notification-${index}`, data: { leadId: `missing-notification-lead-${index}`, type: "system", title: "Fixture", createdAt } })),
    activityLogs: Array.from({ length: 6 }, (_, index) => ({ id: `activity-${index}`, data: { entityType: "lead", entityId: `missing-activity-lead-${index}`, action: "legacy", createdAt } })),
  };
  const analyzed = analyzeMigrationDryRun(fixture, [SANITIZED_AUTH_USERS[0]]);
  const prepared = prepareMigrationRows(fixture, [SANITIZED_AUTH_USERS[0]]);
  assert.equal(Object.values(analyzed.tables).reduce((sum, table) => sum + table.source, 0), 714);
  assert.equal(Object.values(analyzed.tables).reduce((sum, table) => sum + table.insertReady, 0), 714);
  assert.equal(prepared.rows.length, 714);
  assert.equal(prepared.optionalOrphans, 10);
  assert.equal(analyzed.relationships.mandatoryOrphan, 0);
});

test("Owner invariant requires exactly one active source Owner", () => {
  assert.deepEqual(assertOwnerInvariant(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS), { sourceOwners: 1, authUsers: 1, profiles: 1, role: "owner", active: true });
  const none = structuredClone(SANITIZED_FIRESTORE);
  none.adminUsers[0].data.role = "admin";
  assert.throws(() => assertOwnerInvariant(none, SANITIZED_AUTH_USERS), /exactly one/);
  const two = structuredClone(SANITIZED_FIRESTORE);
  two.adminUsers[1].data.role = "owner";
  assert.throws(() => assertOwnerInvariant(two, SANITIZED_AUTH_USERS), /exactly one/);
});

test("Firebase SCRYPT vector generation uses rounds 8 and memory cost 14", () => {
  const parameters = { rounds: 8, memoryCost: 14, saltSeparator: "Bw==", signerKey: Buffer.alloc(32, 7).toString("base64") };
  const result = createFirebaseScryptHash("fixture-password", Buffer.from("fixture-salt").toString("base64"), parameters);
  assert.match(result.formatted, /^\$fbscrypt\$v=1,n=14,r=8,p=1,/);
  assert.equal(result.passwordHash.length > 20, true);
});

test("invalid Firebase SCRYPT conversion fails closed", () => {
  assert.throws(() => formatFirebaseScryptHash("not base64!", "c2FsdA==", { rounds: 8, memoryCost: 14, saltSeparator: "Bw==", signerKey: "a2V5" }), /base64/);
});

test("Auth writer is idempotent and preserves deterministic UUID", async () => {
  const store = new MemoryAuthMigrationStore();
  const users = [{ uid: "fixture-owner", email: "owner@example.com", emailVerified: true, disabled: false, passwordHash: "aGFzaA==", passwordSalt: "c2FsdA==" }];
  const parameters = { rounds: 8, memoryCost: 14, saltSeparator: "Bw==", signerKey: "a2V5" };
  assert.deepEqual(await migrateAuthUsers(users, store, parameters), { inserted: 1, idempotent: 0, conflicts: 0 });
  assert.deepEqual(await migrateAuthUsers(users, store, parameters), { inserted: 0, idempotent: 1, conflicts: 0 });
  assert.equal(store.users.size, 1);
});

test("duplicate migration execution creates no duplicate rows or mappings", async () => {
  const store = new MemoryMigrationStore();
  const rows = prepareMigrationRows(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS).rows;
  const first = await runMigrationWriter(rows, store, { write: true, authorized: true, batchSize: 2 });
  const second = await runMigrationWriter(rows, store, { write: true, authorized: true, batchSize: 2 });
  assert.equal(first.inserted, rows.length);
  assert.equal(second.inserted, 0);
  assert.equal(second.idempotent, rows.length);
  assert.equal(store.targets.size, rows.length);
  assert.equal(store.mappings.size, rows.length);
});

test("interrupted migration resumes to the same final state as a clean run", async () => {
  const rows = prepareMigrationRows(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS).rows;
  const clean = new MemoryMigrationStore();
  await runMigrationWriter(rows, clean, { write: true, authorized: true, batchSize: 2 });
  const resumed = new MemoryMigrationStore();
  await assert.rejects(() => runMigrationWriter(rows, resumed, { write: true, authorized: true, batchSize: 2, interruptAfterBatches: 2 }), MigrationInterruptedError);
  await runMigrationWriter(rows, resumed, { write: true, authorized: true, batchSize: 2 });
  assert.deepEqual([...resumed.targets.entries()], [...clean.targets.entries()]);
  assert.deepEqual([...resumed.mappings.entries()], [...clean.mappings.entries()]);
});

test("unexpected target conflict is visible and never overwritten", async () => {
  const row = prepareMigrationRows(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS).rows[0];
  const store = new MemoryMigrationStore();
  store.seedUnexpectedTarget(row.targetTable, row.targetId, { id: row.targetId, unexpected: true });
  await assert.rejects(() => runMigrationWriter([row], store, { write: true, authorized: true }), MigrationConflictError);
  assert.equal(store.targets.values().next().value.unexpected, true);
  assert.equal(store.mappings.size, 0);
});

test("UUID mappings are immutable once committed", async () => {
  const row = prepareMigrationRows(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS).rows[0];
  const store = new MemoryMigrationStore();
  await runMigrationWriter([row], store, { write: true, authorized: true });
  const mapping = store.mappings.values().next().value;
  mapping.target_id = "00000000-0000-4000-8000-000000000000";
  await assert.rejects(() => runMigrationWriter([row], store, { write: true, authorized: true }), MigrationConflictError);
});

test("checkpoint checksum inconsistency aborts resume", async () => {
  const row = prepareMigrationRows(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS).rows[0];
  const store = new MemoryMigrationStore();
  await store.saveCheckpoint({ sourceCollection: row.sourceCollection, batch: 1, lastSourceId: row.sourceId, processedCount: 1, checksum: "0".repeat(64), status: "completed", timestamp: "2025-01-01T00:00:00.000Z" });
  await assert.rejects(() => runMigrationWriter([row], store, { write: true, authorized: true }), /Checkpoint checksum mismatch/);
});

test("structured writer logs contain no PII, password hashes, or secrets", async () => {
  const logs = [];
  const rows = prepareMigrationRows(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS).rows;
  await runMigrationWriter(rows, new MemoryMigrationStore(), { write: true, authorized: true, logger: (entry) => logs.push(entry) });
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /@|password|signer|salt|secret|fixture-owner-uid|fixture-agent-uid/i);
});

test("notification RLS is exact for Owner, Admin, and Sales Agent inboxes", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260828000100_m2a_readiness.sql", import.meta.url), "utf8");
  assert.match(sql, /current_profile_role\(\) in \('owner', 'admin'\).*recipient_id = auth\.uid\(\) or recipient_id is null/s);
  assert.match(sql, /current_profile_role\(\) = 'sales_agent' and recipient_id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /current_profile_role\(\) in \('owner', 'admin'\).*recipient_id is not null/s);
});

test("migration checkpoints store operational metadata and no document body", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260828000100_m2a_readiness.sql", import.meta.url), "utf8");
  for (const field of ["source_collection", "batch", "last_source_id", "processed_count", "checksum", "status", "completed_at"]) assert.match(sql, new RegExp(field));
  assert.doesNotMatch(sql, /password_hash|password_salt|signer_key/);
});

test("atomic target writer has conflict detection and no overwrite clause", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260828000100_m2a_readiness.sql", import.meta.url), "utf8");
  assert.match(sql, /return 'conflict'/);
  assert.doesNotMatch(sql, /on conflict[\s\S]*do update/i);
});

test("local Firebase aliases label the unrelated project as legacy", () => {
  const config = JSON.parse(readFileSync(new URL("../.firebaserc", import.meta.url), "utf8"));
  assert.equal(config.projects.default, source);
  assert.equal(config.projects["crm-production"], source);
  assert.equal(config.projects["legacy-live-chat"], FIREBASE_LEGACY_EXCLUDED_PROJECT_ID);
});

test("tests use only in-memory/local stores and never a remote writer", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts["test:m2a:readiness"].includes("--write"), false);
  assert.equal(packageJson.scripts["test:m2a:readiness"].includes("migrate-firebase-to-supabase"), false);
});
