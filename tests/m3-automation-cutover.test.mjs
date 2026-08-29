import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260829000100_m3_automation_cutover_guard.sql", "utf8");
const queueBody = sql.slice(sql.indexOf("create or replace function public.enqueue_due_reminder_events"));

test("automation cutover timestamp and baseline completion are persisted", () => {
  assert.match(sql, /automation_cutover_at timestamptz/);
  assert.match(sql, /automation_baseline_completed_at timestamptz/);
  assert.match(sql, /automation cutover timestamp is immutable/);
});

test("historical windows are auditable and complete without delivery", () => {
  assert.match(sql, /'reason', 'skipped_migration_baseline'/);
  assert.match(sql, /'completed'/);
  assert.match(sql, /'skipped',\s*'skipped',\s*'skipped'/);
  assert.match(sql, /completed_at,\s*metadata/);
});

test("baseline is deterministic and idempotent", () => {
  assert.match(sql, /digest\(w\.task_id::text \|\| '\|' \|\| w\.kind::text \|\| '\|' \|\| w\.due_at::text/);
  assert.match(sql, /on conflict \(deterministic_key\) do nothing/);
  assert.match(sql, /pg_advisory_xact_lock/);
});

test("queue fails closed until the migration baseline exists", () => {
  assert.match(queueBody, /if v_cutover is null or v_baseline_completed is null then/);
  assert.match(queueBody, /automation migration baseline is not configured/);
});

test("pre-cutover reminder windows cannot be enqueued", () => {
  assert.match(queueBody, /t\.due_at >= v_cutover/);
  assert.match(queueBody, /t\.due_at - interval '1 hour' >= v_cutover/);
  assert.match(queueBody, /t\.due_at - interval '1 day' >= v_cutover/);
  assert.doesNotMatch(queueBody, /scheduled_at\s*<\s*v_cutover[\s\S]*insert into public\.reminder_events/);
});

test("one non-spammy reminder kind is selected per task and due is reachable", () => {
  assert.match(queueBody, /case[\s\S]*'overdue'::public\.reminder_kind[\s\S]*'due'::public\.reminder_kind[\s\S]*'one_hour'::public\.reminder_kind[\s\S]*'one_day'::public\.reminder_kind/);
  assert.match(queueBody, /t\.due_at <= p_now[\s\S]*task_due_enabled/);
  assert.doesNotMatch(queueBody, /cross join lateral \(values/);
});

test("existing legacy delivery markers suppress duplicate future events", () => {
  for (const field of ["reminder_one_day_sent_at", "reminder_one_hour_sent_at", "due_notification_sent_at", "overdue_notified_at"]) {
    assert.match(queueBody, new RegExp(`t\\.${field} is null`));
  }
});

test("baseline and queue remain service-role only", () => {
  assert.match(sql, /revoke all on function public\.baseline_reminders_for_cutover\(timestamptz\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.baseline_reminders_for_cutover\(timestamptz\) to service_role/);
  assert.match(sql, /revoke all on function public\.enqueue_due_reminder_events\(timestamptz\) from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant execute on function public\.(?:baseline_reminders_for_cutover|enqueue_due_reminder_events)[\s\S]{0,120}to authenticated/);
});
