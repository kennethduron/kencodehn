import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_LOCAL_URL;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY;
if (!url || !serviceKey) throw new Error("Local Supabase test environment is incomplete.");
const parsed = new URL(url);
if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") throw new Error("Baseline E2E refuses non-loopback services.");

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const ownerId = "43000000-0000-4000-8000-000000000001";
const ownerEmail = "baseline.owner@example.test";
const { error: authError } = await service.auth.admin.createUser({ id: ownerId, email: ownerEmail, password: "Baseline-Local-Only-2026!", email_confirm: true });
if (authError && authError.status !== 422) throw authError;
const { error: profileError } = await service.from("profiles").upsert({
  id: ownerId,
  name: "Baseline local Owner",
  email: ownerEmail,
  role: "owner",
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
if (profileError) throw profileError;

const expectedCounts = {
  profiles: 1,
  leads: 0,
  lead_notes: 0,
  tasks: 0,
  reminder_events: 0,
  notifications: 0,
  activity_logs: 0,
  email_logs: 0,
  push_logs: 0,
  admin_settings: 1,
};
const result = await service.rpc("establish_clean_business_baseline", {
  p_confirmation: "PRE_CLEAN_BASELINE",
  p_backup_checksum: "a".repeat(64),
  p_expected_counts: expectedCounts,
});
if (result.error) throw new Error(`${result.error.code}: ${result.error.message}`);
assert.equal(result.data.baselineKey, "PRE_CLEAN_BASELINE");
assert.equal(result.data.profilesPreserved, 1);
assert.equal(result.data.activeOwnersPreserved, 1);
assert.equal(result.data.idempotent, false);

const repeated = await service.rpc("establish_clean_business_baseline", {
  p_confirmation: "PRE_CLEAN_BASELINE",
  p_backup_checksum: "a".repeat(64),
  p_expected_counts: expectedCounts,
});
if (repeated.error) throw repeated.error;
assert.equal(repeated.data.idempotent, true);

console.log(JSON.stringify({ target: "loopback-only", baseline: "PASS", idempotency: "PASS" }));
