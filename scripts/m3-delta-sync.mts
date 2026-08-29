import { createClient } from "@supabase/supabase-js";

import { parseMigrationMode } from "../src/lib/migration/guards.ts";
import { readFirebaseSourceSnapshot } from "../src/lib/migration/firebase-source.ts";
import { analyzeMigrationDryRun, prepareMigrationRows } from "../src/lib/migration/preflight.ts";
import { migrationMapRow } from "../src/lib/migration/transform.ts";
import { MigrationConflictError, SupabaseMigrationStore } from "../src/lib/migration/writer.ts";

const args = process.argv.slice(2);
const mode = parseMigrationMode(args);
if (!mode.write || !args.includes("--source-read") || !args.includes("--target-read") || !args.includes("--delta-only")) {
  throw new Error("M3 delta sync requires source-read, target-read, delta-only, and write guards.");
}
if (!args.includes("--allow-mapped-updates")) throw new Error("M3 delta sync requires the migration-owned update guard.");
const confirmedDelta = Number(args.find((argument) => argument.startsWith("--confirm-delta-count="))?.slice("--confirm-delta-count=".length));
if (!Number.isSafeInteger(confirmedDelta) || confirmedDelta < 0) throw new Error("M3 delta sync requires an exact non-negative delta confirmation.");

const sourceProject = mode.confirmedSourceProject!;
const snapshot = await readFirebaseSourceSnapshot(sourceProject);
const analysis = analyzeMigrationDryRun(snapshot.collections, snapshot.authUsers);
if (analysis.relationships.mandatoryOrphan !== 0) throw new Error("M3 delta sync aborted on mandatory orphan relationships.");
const prepared = prepareMigrationRows(snapshot.collections, snapshot.authUsers);
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const { data: mappings, error: mappingError } = await client.from("migration_id_map")
  .select("source_collection,source_id,target_table,target_id,checksum")
  .eq("source_system", "firebase");
if (mappingError) throw new Error(`M3 delta mapping read failed (${mappingError.code ?? "unknown"}).`);

const expectedBySource = new Map(prepared.rows.map((row) => [`${row.sourceCollection}\0${row.sourceId}`, row]));
const mappingBySource = new Map((mappings ?? []).map((mapping) => [`${mapping.source_collection}\0${mapping.source_id}`, mapping]));
let mappingConflicts = 0;
for (const mapping of mappings ?? []) {
  const expected = expectedBySource.get(`${mapping.source_collection}\0${mapping.source_id}`);
  if (!expected || expected.targetTable !== mapping.target_table || expected.targetId !== mapping.target_id) mappingConflicts += 1;
}
if (mappingConflicts) throw new MigrationConflictError(mappingConflicts);

const deltaRows = prepared.rows.filter((row) => {
  const mapping = mappingBySource.get(`${row.sourceCollection}\0${row.sourceId}`);
  return !mapping || mapping.checksum !== row.checksum;
});
if (deltaRows.length !== confirmedDelta) {
  throw new Error(`M3 delta count changed: expected ${confirmedDelta}, observed ${deltaRows.length}; no writes performed.`);
}

const store = new SupabaseMigrationStore(client);
const outcomes = { inserted: 0, updated: 0, idempotent: 0, conflicts: 0 };
for (const row of deltaRows) {
  const outcome = await store.commit(row, migrationMapRow(row), true);
  outcomes[outcome] += 1;
}
if (outcomes.conflicts) throw new MigrationConflictError(outcomes.conflicts);

const { data: finalMappings, error: finalMappingError } = await client.from("migration_id_map")
  .select("source_collection,source_id,target_table,target_id,checksum")
  .eq("source_system", "firebase");
if (finalMappingError) throw new Error(`M3 final mapping read failed (${finalMappingError.code ?? "unknown"}).`);
const finalBySource = new Map((finalMappings ?? []).map((mapping) => [`${mapping.source_collection}\0${mapping.source_id}`, mapping]));
const finalMismatches = prepared.rows.filter((row) => {
  const mapping = finalBySource.get(`${row.sourceCollection}\0${row.sourceId}`);
  return !mapping || mapping.target_table !== row.targetTable || mapping.target_id !== row.targetId || mapping.checksum !== row.checksum;
}).length;

console.log(JSON.stringify({
  mode: "m3-delta-only",
  sourceProject,
  targetProject: mode.confirmedTargetProjectRef,
  sourceRows: prepared.rows.length,
  mappingsBefore: mappings?.length ?? 0,
  deltaRows: deltaRows.length,
  deltaCollections: Object.fromEntries([...new Set(deltaRows.map((row) => row.sourceCollection))].map((collection) => [collection, deltaRows.filter((row) => row.sourceCollection === collection).length])),
  outcomes,
  mappingsAfter: finalMappings?.length ?? 0,
  finalMappingMismatches: finalMismatches,
  mandatoryOrphans: analysis.relationships.mandatoryOrphan,
  piiLogged: false,
  secretsLogged: false,
}, null, 2));
if (finalMismatches !== 0 || (finalMappings?.length ?? 0) !== prepared.rows.length) process.exitCode = 1;
