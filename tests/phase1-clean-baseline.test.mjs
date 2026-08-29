import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260829000300_phase1_clean_business_baseline.sql", "utf8");
const backup = readFileSync("scripts/phase1-protect-pre-clean-dump.mjs", "utf8");
const dpapi = readFileSync("scripts/dpapi-key.ps1", "utf8");
const security = readFileSync("scripts/phase1-security-audit.mjs", "utf8");
const endpoint = readFileSync("src/app/api/admin/phase1-baseline/route.ts", "utf8");

test("baseline cleanup is gated by target, confirmation, checksum and exact counts", () => {
  assert.match(sql, /PRE_CLEAN_BASELINE/);
  assert.match(sql, /nvtrgrltyzrkljarvwff/);
  assert.match(sql, /backup_checksum ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql, /operational data changed after backup; create a new backup/);
  assert.match(sql, /profile safety check failed/);
});

test("baseline cleanup preserves identity, settings and technical migration history", () => {
  assert.doesNotMatch(sql, /delete from public\.profiles/i);
  assert.doesNotMatch(sql, /delete from public\.admin_settings/i);
  assert.doesNotMatch(sql, /delete from public\.migration_id_map/i);
  assert.doesNotMatch(sql, /delete from public\.migration_checkpoints/i);
  assert.doesNotMatch(sql, /truncate|drop table|db reset/i);
});

test("baseline cleanup orders dependent operational tables before leads", () => {
  const ordered = ["reminder_events", "email_logs", "push_logs", "notifications", "activity_logs", "lead_notes", "tasks", "leads"];
  let cursor = -1;
  for (const table of ordered) {
    const next = sql.indexOf(`delete from public.${table}`, cursor + 1);
    assert.ok(next > cursor, `${table} must be deleted in FK-safe order`);
    cursor = next;
  }
});

test("baseline RPC is service-role only and old broad cleanup is revoked", () => {
  assert.match(sql, /revoke all on function public\.establish_clean_business_baseline[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.establish_clean_business_baseline[\s\S]*to service_role/);
  assert.match(sql, /revoke execute on function public\.cleanup_operational_data\(\) from authenticated/);
});

test("backup excludes Auth, credential tokens and migration history", () => {
  assert.match(backup, /COPY auth\./);
  assert.match(backup, /COPY public\.device_tokens/);
  assert.match(backup, /COPY public\.migration_id_map/);
  assert.match(backup, /AES-256-GCM/);
  assert.match(dpapi, /DataProtectionScope.*CurrentUser/);
});

test("security audit never prints Supabase key values", () => {
  assert.match(security, /exactMatches/);
  assert.doesNotMatch(security, /console\.log\([^)]*(publishable|secret)\)/);
  assert.match(security, /secret_exact_match_in_public_build/);
});

test("remote baseline endpoint is Owner-only, exact and Preview-safe", () => {
  assert.match(endpoint, /maintenance:run/);
  assert.match(endpoint, /admin\.role !== "owner"/);
  assert.match(endpoint, /isCrmPreviewReadOnly\(\)/);
  assert.match(endpoint, /PRE_CLEAN_BASELINE/);
  assert.match(endpoint, /1a348702f074789a85e778e9ae5d6c691f344017533b89d5398cb4526d2620dd/);
});
