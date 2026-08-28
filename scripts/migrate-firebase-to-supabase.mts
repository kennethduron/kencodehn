import { createClient } from "@supabase/supabase-js";

import { assertFirebaseSourceProject, parseMigrationMode } from "../src/lib/migration/guards.ts";
import { readFirebaseSourceSnapshot } from "../src/lib/migration/firebase-source.ts";
import {
  analyzeMigrationDryRun,
  deterministicChecksum,
  prepareMigrationRows,
  summarizeAuthUsers,
} from "../src/lib/migration/preflight.ts";
import {
  SupabaseAuthMigrationStore,
  SupabaseMigrationStore,
  migrateAuthUsers,
  runMigrationWriter,
  type AuthMigrationUser,
} from "../src/lib/migration/writer.ts";
import { targetUuidForFirebase } from "../src/lib/migration/transform.ts";

const args = process.argv.slice(2);
const mode = parseMigrationMode(args);
const allowMappedUpdates = args.includes("--allow-mapped-updates");
if (!mode.sourceRead) {
  console.log(JSON.stringify({
    mode: "dry-run",
    remoteRead: false,
    remoteWrite: false,
    source: "kencode-81d66",
    target: "Ken Code / kencodehn",
    writer: ["auth", "profiles", "leads", "lead_notes", "tasks", "notifications", "activity_logs", "email_logs", "push_logs", "device_tokens", "admin_settings", "reminder_events"],
  }, null, 2));
  process.exit(0);
}

const requestedSource = args.find((argument) => argument.startsWith("--project-id="))?.slice("--project-id=".length)
  ?? process.env.FIREBASE_PROJECT_ID;
assertFirebaseSourceProject(requestedSource);
const snapshot = await readFirebaseSourceSnapshot(requestedSource);
const dryRun = analyzeMigrationDryRun(snapshot.collections, snapshot.authUsers);
const prepared = prepareMigrationRows(snapshot.collections, snapshot.authUsers);
if (!mode.write) {
  const authSummary = summarizeAuthUsers(snapshot.authUsers);
  console.log(JSON.stringify({
    mode: "dry-run",
    remoteRead: true,
    remoteWrite: false,
    sourceProject: requestedSource,
    sourceDocuments: prepared.rows.length,
    insertReady: prepared.rows.length,
    optionalOrphansPreserved: prepared.optionalOrphans,
    mandatoryOrphans: dryRun.relationships.mandatoryOrphan,
    ownerInvariant: dryRun.ownerMapping.safe,
    authUsers: authSummary.total,
    checksum: prepared.checksum,
  }, null, 2));
  process.exit(0);
}

const passwordUsers: AuthMigrationUser[] = snapshot.authUsers.map((user) => {
  if (!user.email || !user.passwordHash || !user.passwordSalt) {
    throw new Error("Every source Auth user must have an email and exportable password material.");
  }
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    passwordHash: user.passwordHash,
    passwordSalt: user.passwordSalt,
  };
});
const scryptParameters = {
  memoryCost: snapshot.scrypt.memoryCost,
  rounds: snapshot.scrypt.rounds,
  saltSeparator: snapshot.scrypt.saltSeparator,
  signerKey: snapshot.scrypt.signerKey,
  parallelization: 1,
};
if (scryptParameters.memoryCost !== 14 || scryptParameters.rounds !== 8) {
  throw new Error("Firebase SCRYPT parameters do not match the verified source configuration.");
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const businessTables = [...new Set(prepared.rows.map((row) => row.targetTable))];
const preflightCounts: Record<string, number> = {};
for (const table of businessTables) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact" }).limit(1);
  if (error) throw new Error(`Supabase target preflight failed for ${table} (${error.code ?? error.name ?? "unknown"}; ${error.message}).`);
  preflightCounts[table] = count ?? 0;
}
const { data: existingAuth, error: authPreflightError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
if (authPreflightError) throw new Error(`Supabase Auth preflight failed (${authPreflightError.status ?? "unknown"}).`);
const { count: mappingCount, error: mappingCountError } = await supabase.from("migration_id_map").select("id", { count: "exact" }).limit(1);
if (mappingCountError) throw new Error(`Migration mapping preflight failed (${mappingCountError.code ?? "unknown"}).`);
const remoteIsEmpty = Object.values(preflightCounts).every((count) => count === 0) && existingAuth.users.length === 0 && (mappingCount ?? 0) === 0;
const remoteIsMigrationOwned = (mappingCount ?? 0) === prepared.rows.length && existingAuth.users.length === passwordUsers.length;
const expectedAuth = new Map(passwordUsers.map((user) => [targetUuidForFirebase("authUsers", user.uid), user.email.trim().toLowerCase()]));
const remoteIsRecoverableAuthOnly = Object.values(preflightCounts).every((count) => count === 0)
  && (mappingCount ?? 0) === 0
  && existingAuth.users.length === passwordUsers.length
  && existingAuth.users.every((user) => expectedAuth.get(user.id) === user.email?.trim().toLowerCase());
if (!remoteIsEmpty && !remoteIsMigrationOwned && !remoteIsRecoverableAuthOnly) {
  throw new Error("Supabase target contains unexpected rows; migration aborted without overwrite.");
}

const authResult = await migrateAuthUsers(passwordUsers, new SupabaseAuthMigrationStore(supabase), scryptParameters);
const batchSizeArgument = args.find((argument) => argument.startsWith("--batch-size="))?.slice("--batch-size=".length);
const writerResult = await runMigrationWriter(prepared.rows, new SupabaseMigrationStore(supabase), {
  write: true,
  authorized: true,
  allowMappedUpdates,
  batchSize: batchSizeArgument ? Number(batchSizeArgument) : 100,
  logger: (entry) => console.log(JSON.stringify(entry)),
});

const { data: mappings, error: mappingError } = await supabase
  .from("migration_id_map")
  .select("source_collection,source_id,target_table,target_id,checksum")
  .eq("source_system", "firebase");
if (mappingError) throw new Error(`Migration reconciliation failed (${mappingError.code ?? "unknown"}).`);
const mappingChecksum = deterministicChecksum((mappings ?? []).map((mapping) => ({
  sourceCollection: mapping.source_collection,
  sourceId: mapping.source_id,
  targetTable: mapping.target_table,
  targetId: mapping.target_id,
  checksum: mapping.checksum,
})).sort((left, right) => `${left.sourceCollection}:${left.sourceId}`.localeCompare(`${right.sourceCollection}:${right.sourceId}`)));
const expectedMappingChecksum = deterministicChecksum(prepared.rows.map((row) => ({
  sourceCollection: row.sourceCollection,
  sourceId: row.sourceId,
  targetTable: row.targetTable,
  targetId: row.targetId,
  checksum: row.checksum,
})).sort((left, right) => `${left.sourceCollection}:${left.sourceId}`.localeCompare(`${right.sourceCollection}:${right.sourceId}`)));
if ((mappings?.length ?? 0) !== prepared.rows.length || mappingChecksum !== expectedMappingChecksum) {
  throw new Error("Migration reconciliation checksum mismatch.");
}
console.log(JSON.stringify({
  mode: "write",
  sourceProject: requestedSource,
  auth: authResult,
  rows: writerResult,
  reconciliation: {
    sourceRows: prepared.rows.length,
    mappingRows: mappings?.length ?? 0,
    checksumMatch: true,
  },
  secretsLogged: false,
  piiLogged: false,
}, null, 2));
