import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const files = {
  migration: read("supabase/migrations/20260902000400_phase6_mail_delivery_hardening.sql"),
  webhook: read("src/app/api/webhooks/resend/route.ts"),
  backup: read("scripts/phase6-create-backup.mjs"),
  restore: read("scripts/phase6-restore-backup.mjs"),
  localE2e: read("scripts/phase6-local-e2e.ps1"),
  productionAudit: read("scripts/phase6-production-audit.mjs"),
  webhookConfig: read("scripts/phase6-resend-webhook-config.mjs"),
  runbook: read("docs/PHASE6_RUNBOOK.md"),
  ownerGuide: read("docs/OWNER_OPERATING_GUIDE.md"),
};

test("backup refuses an unexpected linked project", () => {
  assert.match(files.backup, /linkedRef !== PROJECT_REF/);
  assert.match(files.backup, /nvtrgrltyzrkljarvwff/);
});

test("backup uses authenticated encryption and verifies its round trip", () => {
  assert.match(files.backup, /aes-256-gcm/);
  assert.match(files.backup, /getAuthTag/);
  assert.match(files.backup, /roundTrip\.equals\(plaintext\)/);
});

test("backup excludes credential-bearing and migration metadata tables", () => {
  assert.match(files.backup, /device_tokens/);
  assert.match(files.backup, /migration_id_map/);
  assert.match(files.backup, /COPY auth\./);
});

test("restore verifies encrypted and restored SQL checksums", () => {
  assert.match(files.restore, /Encrypted artifact checksum mismatch/);
  assert.match(files.restore, /Restored SQL checksum mismatch/);
});

test("local E2E refuses a non-loopback target", () => {
  assert.match(files.localE2e, /127\.0\.0\.1/);
  assert.match(files.localE2e, /refuses non-loopback services/);
});

test("production audit is pinned to the Ken Code project", () => {
  assert.match(files.productionAudit, /nvtrgrltyzrkljarvwff/);
  assert.match(files.productionAudit, /refuses an unexpected Supabase target/);
});

test("webhook configuration requires one exact Production endpoint", () => {
  assert.match(files.webhookConfig, /https:\/\/kencodehn\.com\/api\/webhooks\/resend/);
  assert.match(files.webhookConfig, /matches\.length !== 1/);
});

test("mail delivery events are timestamp ordered and service-role only", () => {
  assert.match(files.migration, /p_occurred_at >= v_message\.delivery_status_at/);
  assert.match(files.migration, /grant execute[\s\S]*to service_role/);
});

test("financial dashboard aggregate remains RLS-aware", () => {
  assert.match(files.migration, /billing_dashboard_summary[\s\S]*security invoker/);
  assert.doesNotMatch(files.migration, /billing_dashboard_summary[\s\S]*security definer/);
});

test("webhook logs only a bounded stage and error category", () => {
  assert.match(files.webhook, /resend_webhook_failed.*eventType, stage, errorCategory/s);
  assert.match(files.webhook, /replace\(\/\[\^a-zA-Z0-9_.-\]/);
  assert.doesNotMatch(files.webhook, /console\.(log|error)\([^\n]*(body_html|body_text|recipientEmails|received\.data)/);
});

test("inbound identity assignments and profiles are queried explicitly", () => {
  assert.match(files.webhook, /mail_identity_assignments"\)\.select\("profile_id"\)/);
  assert.match(files.webhook, /profiles"\)\.select\("id,email,display_name,name"\)/);
});

test("runbook documents isolated restore and prohibits linked reset", () => {
  assert.match(files.runbook, /entorno aislado/i);
  assert.match(files.runbook, /Nunca.*db reset --linked/i);
});

test("owner guide covers identity reassignment without deleting history", () => {
  assert.match(files.ownerGuide, /reasign/i);
  assert.match(files.ownerGuide, /historial/i);
});
