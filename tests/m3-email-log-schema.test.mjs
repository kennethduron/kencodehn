import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260829000200_m3_owner_verification_email_log.sql", "utf8");
const email = readFileSync("src/lib/email/service.ts", "utf8");

test("remote email log allowlist matches the approved Owner verification type", () => {
  assert.match(email, /\| "owner_email_verification"/);
  assert.match(sql, /add constraint email_logs_type_valid check \(type in/);
  assert.match(sql, /'owner_email_verification'/);
});

test("email log compatibility migration changes only the type constraint", () => {
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|truncate|drop table|create table)\b/i);
  assert.doesNotMatch(sql, /cron|email_logs\s+set|send|push/i);
});
