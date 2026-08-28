import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

import { MIGRATION_COLLECTION_ORDER, analyzeMigrationDryRun, assertSanitizedFixture } from "../src/lib/migration/preflight.ts";
import { prepareMigrationRows } from "../src/lib/migration/preflight.ts";
import { MigrationInterruptedError, SupabaseMigrationStore, runMigrationWriter } from "../src/lib/migration/writer.ts";
import { targetUuidForFirebase } from "../src/lib/migration/transform.ts";
import { LOCAL_FIXTURE_PASSWORD, SANITIZED_AUTH_USERS, SANITIZED_FIRESTORE } from "../tests/fixtures/m2a-sanitized.ts";

function localCliEnvironment() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const commandArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", "npx.cmd supabase status -o env"]
    : ["supabase", "status", "-o", "env"];
  const output = execFileSync(command, commandArgs, {
    encoding: "utf8",
    windowsHide: true,
  });
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

const local = localCliEnvironment();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || local.API_URL || "";
const secret = process.env.SUPABASE_SECRET_KEY || local.SERVICE_ROLE_KEY || "";
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || local.ANON_KEY || "";
const parsed = new URL(url);
if (!(["127.0.0.1", "localhost"].includes(parsed.hostname))) throw new Error("Local fixture runner refuses non-local Supabase URLs.");
if (!secret || !publishable) throw new Error("Local Supabase keys are required.");
assertSanitizedFixture({ auth: SANITIZED_AUTH_USERS, firestore: SANITIZED_FIRESTORE });

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
for (const sourceUser of SANITIZED_AUTH_USERS) {
  const { data, error } = await admin.auth.admin.createUser({
    id: targetUuidForFirebase("authUsers", sourceUser.uid),
    email: sourceUser.email,
    password: LOCAL_FIXTURE_PASSWORD,
    // Local-only RLS validation requires both fixture identities to sign in.
    // The source fixture still preserves an unverified-user case for dry-run analysis.
    email_confirm: true,
    user_metadata: { display_name: sourceUser.displayName, fixture: true },
  });
  if (error || !data.user) throw error ?? new Error("Local Auth fixture could not be created.");
}

const prepared = prepareMigrationRows(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS);
const migrationStore = new SupabaseMigrationStore(admin);
let interrupted = false;
try {
  await runMigrationWriter(prepared.rows, migrationStore, { write: true, authorized: true, batchSize: 2, interruptAfterBatches: 2 });
} catch (error) {
  if (!(error instanceof MigrationInterruptedError)) throw error;
  interrupted = true;
}
const resumed = await runMigrationWriter(prepared.rows, migrationStore, { write: true, authorized: true, batchSize: 2 });
const duplicate = await runMigrationWriter(prepared.rows, migrationStore, { write: true, authorized: true, batchSize: 2 });
const tableCounts = Object.fromEntries(MIGRATION_COLLECTION_ORDER.map((collection) => [collection, SANITIZED_FIRESTORE[collection].length]));

const additionalUsers = [
  { uid: "fixture-admin-uid", email: "admin.fixture@example.com", role: "admin" },
  { uid: "fixture-agent-b-uid", email: "agent-b.fixture@example.com", role: "sales_agent" },
] as const;
for (const user of additionalUsers) {
  const id = targetUuidForFirebase("authUsers", user.uid);
  const created = await admin.auth.admin.createUser({ id, email: user.email, password: LOCAL_FIXTURE_PASSWORD, email_confirm: true });
  if (created.error) throw new Error(`Additional local Auth fixture failed (${created.error.status ?? "unknown"}).`);
  const { error } = await admin.from("profiles").insert({ id, firebase_uid: user.uid, email: user.email, role: user.role, active: true });
  if (error) throw new Error(`Additional local profile fixture failed (${error.code}).`);
}

const notificationRecipients = [
  { firebaseId: "fixture-notification-owner", uid: "fixture-owner-uid" },
  { firebaseId: "fixture-notification-admin", uid: "fixture-admin-uid" },
  { firebaseId: "fixture-notification-agent-b", uid: "fixture-agent-b-uid" },
];
for (const notification of notificationRecipients) {
  const { error } = await admin.from("notifications").insert({
    id: targetUuidForFirebase("notifications", notification.firebaseId),
    firebase_id: notification.firebaseId,
    recipient_id: targetUuidForFirebase("authUsers", notification.uid),
    type: "system",
    severity: "info",
    title: "Fixture privada",
    message: "Contenido sanitizado",
    created_at: "2025-03-10T14:00:00.000Z",
    updated_at: "2025-03-10T14:00:00.000Z",
  });
  if (error) throw new Error(`Additional local notification fixture failed (${error.code}).`);
}

const conflictId = targetUuidForFirebase("leads", "fixture-unexpected-target");
const { error: conflictSeedError } = await admin.from("leads").insert({
  id: conflictId,
  firebase_id: "fixture-unexpected-target",
  name: "Unexpected sanitized target",
  created_at: "2025-03-10T14:00:00.000Z",
  updated_at: "2025-03-10T14:00:00.000Z",
});
if (conflictSeedError) throw new Error(`Local conflict seed failed (${conflictSeedError.code}).`);
const conflictAttempt = await admin.rpc("migration_commit_row", {
  p_source_collection: "leads",
  p_source_id: "fixture-conflicting-source",
  p_target_table: "leads",
  p_target_id: conflictId,
  p_checksum: "f".repeat(64),
  p_row: { id: conflictId, firebase_id: "fixture-conflicting-source", name: "Must not overwrite" },
});
const conflictRow = await admin.from("leads").select("name").eq("id", conflictId).single();
const conflictNoOverwrite = !conflictAttempt.error
  && conflictAttempt.data === "conflict"
  && conflictRow.data?.name === "Unexpected sanitized target";
await admin.from("leads").delete().eq("id", conflictId);
if (!conflictNoOverwrite) throw new Error("Local atomic conflict policy did not preserve the unexpected target row.");

const agent = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const adminUser = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const agentB = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const agentLogin = await agent.auth.signInWithPassword({ email: SANITIZED_AUTH_USERS[1].email, password: LOCAL_FIXTURE_PASSWORD });
const ownerLogin = await owner.auth.signInWithPassword({ email: SANITIZED_AUTH_USERS[0].email, password: LOCAL_FIXTURE_PASSWORD });
const adminLogin = await adminUser.auth.signInWithPassword({ email: additionalUsers[0].email, password: LOCAL_FIXTURE_PASSWORD });
const agentBLogin = await agentB.auth.signInWithPassword({ email: additionalUsers[1].email, password: LOCAL_FIXTURE_PASSWORD });
if (agentLogin.error || ownerLogin.error || adminLogin.error || agentBLogin.error) throw new Error("Local fixture Auth login failed.");

async function count(client: ReturnType<typeof createClient>, table: string) {
  const { count: value, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`Local RLS count failed for ${table}: ${error.code}`);
  return value ?? 0;
}

async function visibleNotificationIds(client: ReturnType<typeof createClient>) {
  const { data, error } = await client.from("notifications").select("firebase_id").order("firebase_id");
  if (error) throw new Error(`Local notification RLS read failed (${error.code}).`);
  return (data ?? []).map((row) => row.firebase_id);
}

const result = {
  localOnly: true,
  inserted: tableCounts,
  migrationMap: await count(admin, "migration_id_map"),
  checkpoints: await count(admin, "migration_checkpoints"),
  writer: { interrupted, resumed, duplicate },
  conflictNoOverwrite,
  ownerScope: {
    leads: await count(owner, "leads"),
    tasks: await count(owner, "tasks"),
    notifications: await count(owner, "notifications"),
  },
  salesAgentScope: {
    leads: await count(agent, "leads"),
    notes: await count(agent, "lead_notes"),
    tasks: await count(agent, "tasks"),
    notifications: await count(agent, "notifications"),
    activity: await count(agent, "activity_logs"),
  },
  notificationPolicy: {
    owner: await visibleNotificationIds(owner),
    admin: await visibleNotificationIds(adminUser),
    salesAgentA: await visibleNotificationIds(agent),
    salesAgentB: await visibleNotificationIds(agentB),
  },
  dryRun: analyzeMigrationDryRun(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS),
};
console.log(JSON.stringify(result, null, 2));
