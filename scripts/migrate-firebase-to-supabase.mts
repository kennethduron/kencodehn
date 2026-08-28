import { parseMigrationMode } from "../src/lib/migration/guards.ts";
import { FIRESTORE_COLLECTION_TARGETS, transformFirestoreDocument } from "../src/lib/migration/transform.ts";

const mode = parseMigrationMode(process.argv.slice(2));

if (!mode.sourceRead) {
  console.log(JSON.stringify({
    mode: "dry-run",
    remoteRead: false,
    remoteWrite: false,
    collections: FIRESTORE_COLLECTION_TARGETS,
    next: "Use --source-read for a read-only Firebase validation. M2 must provide the Firebase UID to Supabase Auth UUID mapping.",
  }, null, 2));
  process.exit(0);
}

const { getAdminDb } = await import("../src/lib/firebase/admin.ts");
const db = getAdminDb();
if (!db) throw new Error("Firebase Admin is not configured for the requested read-only migration scan.");

// M1 deliberately has no remote profile mapping because no Supabase Auth users have been migrated.
// Reading is bounded and outputs counts/errors only; document values and PII are never logged.
const profileIds = new Map<string, string>();
const summary: Record<string, { read: number; valid: number; blockedByAuthMapping: number; invalid: number }> = {};
for (const collection of Object.keys(FIRESTORE_COLLECTION_TARGETS) as Array<keyof typeof FIRESTORE_COLLECTION_TARGETS>) {
  const snapshot = await db.collection(collection).limit(1000).get();
  const result = { read: snapshot.size, valid: 0, blockedByAuthMapping: 0, invalid: 0 };
  for (const document of snapshot.docs) {
    try {
      transformFirestoreDocument(collection, document.id, document.data(), profileIds);
      result.valid += 1;
    } catch (error) {
      if (error instanceof Error && error.message.includes("profile mapping")) result.blockedByAuthMapping += 1;
      else result.invalid += 1;
    }
  }
  summary[collection] = result;
}

console.log(JSON.stringify({
  mode: mode.write ? "write-request-validated" : "dry-run",
  remoteRead: true,
  remoteWrite: false,
  summary,
  note: "M1 never writes migration rows. M2 must migrate Auth first and supply verified profile mappings before enabling database writes.",
}, null, 2));

if (mode.write) {
  throw new Error("M1 blocks data writes even after explicit authorization; implement and review the M2 writer separately.");
}

