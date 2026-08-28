import { createClient } from "@supabase/supabase-js";

import { getAdminAuth, getAdminDb } from "../src/lib/firebase/admin.ts";
import { assertFirebaseSourceProject, parseMigrationMode } from "../src/lib/migration/guards.ts";
import {
  MIGRATION_COLLECTION_ORDER,
  analyzeMigrationDryRun,
  prepareMigrationRows,
  summarizeAuthUsers,
  type AuthUserSummaryInput,
  type SourceCollections,
} from "../src/lib/migration/preflight.ts";
import {
  SupabaseAuthMigrationStore,
  SupabaseMigrationStore,
  migrateAuthUsers,
  runMigrationWriter,
  type AuthMigrationUser,
} from "../src/lib/migration/writer.ts";

const args = process.argv.slice(2);
const mode = parseMigrationMode(args);
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
const db = getAdminDb();
const auth = getAdminAuth();
if (!db || !auth) throw new Error("Firebase Admin source credentials are unavailable.");
assertFirebaseSourceProject(db.projectId);
assertFirebaseSourceProject(auth.app.options.projectId);

const collections: SourceCollections = {};
for (const collection of MIGRATION_COLLECTION_ORDER) {
  const snapshot = await db.collection(collection).get();
  collections[collection] = snapshot.docs.map((document) => ({ id: document.id, data: document.data() }));
}

const authRecords = [];
let pageToken: string | undefined;
do {
  const page = await auth.listUsers(500, pageToken);
  authRecords.push(...page.users);
  pageToken = page.pageToken;
} while (pageToken);

const authSummaryInputs: AuthUserSummaryInput[] = authRecords.map((user) => ({
  uid: user.uid,
  email: user.email,
  emailVerified: user.emailVerified,
  disabled: user.disabled,
  displayName: user.displayName,
  providerIds: user.providerData.map((provider) => provider.providerId),
  hasPasswordHash: Boolean(user.passwordHash),
}));
const dryRun = analyzeMigrationDryRun(collections, authSummaryInputs);
const prepared = prepareMigrationRows(collections, authSummaryInputs);
if (!mode.write) {
  const authSummary = summarizeAuthUsers(authSummaryInputs);
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

const passwordUsers: AuthMigrationUser[] = authRecords.map((user) => {
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
  memoryCost: Number(process.env.FIREBASE_SCRYPT_MEMORY_COST),
  rounds: Number(process.env.FIREBASE_SCRYPT_ROUNDS),
  saltSeparator: process.env.FIREBASE_SCRYPT_SALT_SEPARATOR ?? "",
  signerKey: process.env.FIREBASE_SCRYPT_SIGNER_KEY ?? "",
  parallelization: 1,
};
if (scryptParameters.memoryCost !== 14 || scryptParameters.rounds !== 8) {
  throw new Error("Firebase SCRYPT parameters do not match the verified source configuration.");
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const authResult = await migrateAuthUsers(passwordUsers, new SupabaseAuthMigrationStore(supabase), scryptParameters);
const batchSizeArgument = args.find((argument) => argument.startsWith("--batch-size="))?.slice("--batch-size=".length);
const writerResult = await runMigrationWriter(prepared.rows, new SupabaseMigrationStore(supabase), {
  write: true,
  authorized: true,
  batchSize: batchSizeArgument ? Number(batchSizeArgument) : 100,
  logger: (entry) => console.log(JSON.stringify(entry)),
});
console.log(JSON.stringify({
  mode: "write",
  sourceProject: requestedSource,
  auth: authResult,
  rows: writerResult,
  secretsLogged: false,
  piiLogged: false,
}, null, 2));
