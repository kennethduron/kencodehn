import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("scripts/m3-delta-sync.mts", "utf8");

test("M3 delta sync requires every remote write guard", () => {
  for (const guard of ["--source-read", "--target-read", "--delta-only", "--allow-mapped-updates", "--confirm-delta-count="]) {
    assert.match(script, new RegExp(guard.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(script, /parseMigrationMode\(args\)/);
});

test("M3 delta sync selects only missing or changed migration-owned mappings", () => {
  assert.match(script, /const deltaRows = prepared\.rows\.filter/);
  assert.match(script, /!mapping \|\| mapping\.checksum !== row\.checksum/);
  assert.match(script, /deltaRows\.length !== confirmedDelta/);
  assert.match(script, /no writes performed/);
});

test("M3 delta sync uses atomic commit and leaves checkpoints and Auth untouched", () => {
  assert.match(script, /new SupabaseMigrationStore\(client\)/);
  assert.match(script, /store\.commit\(row, migrationMapRow\(row\), true\)/);
  assert.doesNotMatch(script, /saveCheckpoint|migration_checkpoints|createUser|updateUser|migrateAuthUsers/);
});

test("M3 delta sync rejects mapping conflicts and verifies final reconciliation", () => {
  assert.match(script, /throw new MigrationConflictError\(mappingConflicts\)/);
  assert.match(script, /finalMappingMismatches/);
  assert.match(script, /mandatoryOrphans/);
  assert.match(script, /piiLogged: false/);
  assert.match(script, /secretsLogged: false/);
});
