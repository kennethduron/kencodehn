import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/m3/readiness/route.ts", "utf8");

test("readiness audit exists only in read-only Preview", () => {
  assert.match(route, /process\.env\.VERCEL_ENV !== "preview" \|\| !isCrmPreviewReadOnly\(\)/);
  assert.match(route, /status: 404/);
  assert.match(route, /previewReadOnly: true/);
});

test("readiness audit exposes GET only and never mutates", () => {
  assert.match(route, /export async function GET\(\)/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /\.(?:insert|update|upsert|delete|rpc)\(/);
});

test("readiness audit contains no Firebase, email, cron, or delivery calls", () => {
  assert.doesNotMatch(route, /firebase|getAdminDb|getAdminAuth|getAdminMessaging/i);
  assert.doesNotMatch(route, /sendEmail|sendPush|processTaskReminders|enqueue_due|claim_due/i);
});

test("readiness response is aggregate-only and never returns identity fields", () => {
  assert.doesNotMatch(route, /select\("[^"]*(?:\bemail\b|\bname\b|\bfirebase_id\b)/);
  assert.doesNotMatch(route, /console\.(?:log|warn|error)/);
  assert.match(route, /Cache-Control": "no-store/);
  assert.match(route, /historicalReminderWindows/);
  assert.match(route, /confirmedActiveOwners/);
});
