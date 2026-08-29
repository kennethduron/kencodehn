import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/m3/reconciliation/route.ts", "utf8");

test("reconciliation audit is restricted to read-only Preview", () => {
  assert.match(route, /process\.env\.VERCEL_ENV !== "preview" \|\| !isCrmPreviewReadOnly\(\)/);
  assert.match(route, /status: 404/);
  assert.match(route, /mode: "read-only-reconciliation"/);
});

test("reconciliation audit uses the exact Firebase source guard", () => {
  assert.match(route, /FIREBASE_CRM_SOURCE_PROJECT_ID/);
  assert.match(route, /getAdminProjectId\(\) !== FIREBASE_CRM_SOURCE_PROJECT_ID/);
  assert.doesNotMatch(route, /kenneth-live-chat/);
});

test("reconciliation audit is GET-only and cannot mutate either source", () => {
  assert.match(route, /export async function GET\(\)/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /\.(?:insert|update|upsert|delete|set|add|createUser|updateUser|deleteUser|rpc)\(/);
});

test("reconciliation audit returns aggregates and no identity or secret fields", () => {
  assert.match(route, /piiReturned: false/);
  assert.match(route, /secretsReturned: false/);
  assert.match(route, /stage: failureStage/);
  assert.match(route, /mismatches/);
  assert.match(route, /matchedRows/);
  assert.doesNotMatch(route, /console\.(?:log|warn|error)/);
  assert.doesNotMatch(route, /passwordHash\s*:/);
  assert.match(route, /Cache-Control": "no-store/);
});
