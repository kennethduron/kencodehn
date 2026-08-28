import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseMigrationMode } from "../src/lib/migration/guards.ts";
import {
  FIREBASE_PRODUCTION_PROJECT_ID,
  analyzeDates,
  analyzeDuplicates,
  analyzeMigrationDryRun,
  analyzeMoney,
  assertFirebaseProjectIdentity,
  assertSanitizedFixture,
  deterministicChecksum,
  formatFirebaseScryptHash,
  summarizeAuthUsers,
} from "../src/lib/migration/preflight.ts";
import { firestoreTimestampToIso, moneyToMinorUnits, parseCivilDate, resolveProfileId } from "../src/lib/migration/transform.ts";
import { SANITIZED_AUTH_USERS, SANITIZED_FIRESTORE } from "./fixtures/m2a-sanitized.ts";

test("production Firebase project identity guard accepts the exact project", () => {
  assert.equal(assertFirebaseProjectIdentity(FIREBASE_PRODUCTION_PROJECT_ID, FIREBASE_PRODUCTION_PROJECT_ID), FIREBASE_PRODUCTION_PROJECT_ID);
});

test("source project mismatch aborts before a remote read", () => {
  assert.throws(() => assertFirebaseProjectIdentity("wrong-project", FIREBASE_PRODUCTION_PROJECT_ID), /mismatch/);
});

test("Auth dry run returns aggregate metadata without identities", () => {
  const summary = summarizeAuthUsers(SANITIZED_AUTH_USERS);
  assert.deepEqual({ total: summary.total, passwordUsers: summary.passwordUsers }, { total: 2, passwordUsers: 2 });
  assert.equal(JSON.stringify(summary).includes("@"), false);
});

test("Auth summaries never contain password hashes or salts", () => {
  const summary = summarizeAuthUsers([{ uid: "a", email: "a@example.com", hasPasswordHash: true }]);
  assert.equal("passwordHash" in summary, false);
  assert.equal("passwordSalt" in summary, false);
});

test("duplicate emails are counted case-insensitively", () => {
  const summary = summarizeAuthUsers([{ uid: "a", email: "A@example.com" }, { uid: "b", email: "a@example.com" }]);
  assert.equal(summary.duplicateEmailGroups, 1);
});

test("disabled users remain visible in aggregate planning", () => {
  assert.equal(summarizeAuthUsers([{ uid: "a", disabled: true }]).disabled, 1);
});

test("Owner mapping is unique and resolvable", () => {
  assert.deepEqual(analyzeMigrationDryRun(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS).ownerMapping, { activeOwnerProfiles: 1, resolvableOwnerProfiles: 1, safe: true });
});

test("all sanitized documents are transformable", () => {
  const result = analyzeMigrationDryRun(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS);
  assert.equal(Object.values(result.tables).reduce((sum, table) => sum + table.errors, 0), 0);
  assert.equal(Object.values(result.tables).reduce((sum, table) => sum + table.transformable, 0), 15);
});

test("mandatory orphan lead relationships are classified without logging source IDs", () => {
  const fixture = structuredClone(SANITIZED_FIRESTORE);
  fixture.notes[0].data.leadId = "missing-lead";
  const result = analyzeMigrationDryRun(fixture, SANITIZED_AUTH_USERS);
  assert.equal(result.relationships.mandatoryOrphan, 1);
  assert.equal(JSON.stringify(result.relationships).includes("missing-lead"), false);
});

test("null ownership remains null and valid", () => {
  const result = analyzeMigrationDryRun(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS);
  assert.equal(result.tables.leads.errors, 0);
  assert.equal(result.tables.tasks.errors, 0);
});

test("missing profile mappings fail closed", () => {
  assert.throws(() => resolveProfileId("unknown", new Map()), /Missing Supabase profile mapping/);
});

test("money converts USD and HNL major values to exact minor units", () => {
  assert.equal(moneyToMinorUnits("1499.00"), 149900n);
  assert.equal(moneyToMinorUnits("25000.50"), 2500050n);
});

test("negative and malformed money are rejected", () => {
  assert.throws(() => moneyToMinorUnits("-1"), /Invalid monetary/);
  assert.throws(() => moneyToMinorUnits("not-money"), /Invalid monetary/);
});

test("numeric money cannot be rounded silently", () => {
  assert.throws(() => moneyToMinorUnits(1.005), /two decimal/);
});

test("money audit classifies missing currency and source shapes", () => {
  const result = analyzeMoney(SANITIZED_FIRESTORE);
  assert.equal(result.negative, 0);
  assert.equal(result.nonFinite, 0);
  assert.equal(result.missingCurrency, 0);
});

test("timestamps support ISO, epoch seconds and epoch milliseconds", () => {
  assert.equal(firestoreTimestampToIso("2025-03-10T14:00:00.000Z"), "2025-03-10T14:00:00.000Z");
  assert.equal(firestoreTimestampToIso(1741615200), "2025-03-10T14:00:00.000Z");
  assert.equal(firestoreTimestampToIso(1741615200000), "2025-03-10T14:00:00.000Z");
});

test("Honduras civil DATE values are preserved", () => {
  assert.equal(parseCivilDate("2025-03-10"), "2025-03-10");
});

test("date audit accepts historical fixture variants", () => {
  assert.equal(analyzeDates(SANITIZED_FIRESTORE).malformed, 0);
});

test("checksums are deterministic regardless of object key order", () => {
  assert.equal(deterministicChecksum({ a: 1, b: { c: 2 } }), deterministicChecksum({ b: { c: 2 }, a: 1 }));
});

test("Firebase scrypt hashes are formatted for Supabase Auth without changing material", () => {
  assert.equal(
    formatFirebaseScryptHash("aGFzaA==", "c2FsdA==", { memoryCost: 14, rounds: 8, saltSeparator: "c2Vw", signerKey: "a2V5" }),
    "$fbscrypt$v=1,n=14,r=8,p=1,ss=c2Vw,sk=a2V5$c2FsdA==$aGFzaA==",
  );
});

test("duplicate analysis detects IDs, emails, reminders and tokens without returning values", () => {
  const result = analyzeDuplicates(SANITIZED_FIRESTORE, SANITIZED_AUTH_USERS);
  assert.equal(result.authEmailGroups, 0);
  assert.equal(result.reminderDeterministicKeyGroups, 0);
  assert.equal(JSON.stringify(result).includes("@"), false);
});

test("M1 remote Supabase write guard remains mandatory", () => {
  assert.throws(() => parseMigrationMode(["--write"], {}), /MIGRATION_ALLOW_REMOTE_WRITE/);
});

test("migration target project guard requires exact project ref", () => {
  assert.throws(() => parseMigrationMode([
    "--write",
    "--confirm-source-project=kencode-81d66",
    "--confirm-target-project-ref=wrong",
    "--confirm-target-project-name=kencodehn",
    "--confirm-target-organization=Ken Code",
    "--confirm-target-region=us-east-2",
  ], {
    MIGRATION_ALLOW_REMOTE_WRITE: "true",
    FIREBASE_PROJECT_ID: "kencode-81d66",
    SUPABASE_PROJECT_REF: "nvtrgrltyzrkljarvwff",
    SUPABASE_PROJECT_NAME: "kencodehn",
    SUPABASE_ORGANIZATION: "Ken Code",
    SUPABASE_REGION: "us-east-2",
    NEXT_PUBLIC_SUPABASE_URL: "https://nvtrgrltyzrkljarvwff.supabase.co",
    SUPABASE_SECRET_KEY: "fixture",
  }), /target identity mismatch/);
});

test("M2A preflight contains an unconditional write prohibition", () => {
  const source = readFileSync(new URL("../scripts/m2a-firebase-preflight.mts", import.meta.url), "utf8");
  assert.match(source, /M2A is read-only; remote writes are disabled/);
  assert.doesNotMatch(source, /\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
});

test("sanitized fixtures contain no password material or secrets", () => {
  assert.equal(assertSanitizedFixture({ SANITIZED_AUTH_USERS, SANITIZED_FIRESTORE }, ["real-person@example.com"]), true);
});

test("sanitized fixture covers required migration scenarios", () => {
  const serialized = JSON.stringify(SANITIZED_FIRESTORE);
  for (const expected of ["owner", "sales_agent", "fixture-lead-unassigned", "fixture-lead-agent", "fixture-task-legacy", "fixture-task-agent", "fixture-notification-legacy", "fixture-notification-agent", "fixture-reminder-failed", "USD", "HNL", "2025-03-10"]) {
    assert.equal(serialized.includes(expected), true, expected);
  }
});

test("production provider remains Firebase by default", () => {
  const provider = readFileSync(new URL("../src/lib/data/provider.ts", import.meta.url), "utf8");
  assert.match(provider, /return "firebase"/);
});
