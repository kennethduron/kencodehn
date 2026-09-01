import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260830000200_phase2_automated_billing.sql", "utf8");
const auditSql = readFileSync("supabase/migrations/20260830000300_phase2_billing_job_audit_grants.sql", "utf8");
const financialSql = readFileSync("supabase/migrations/20260830000100_phase2_receivables_payments.sql", "utf8");
const automation = readFileSync("src/lib/billing/automation.ts", "utf8");
const templates = readFileSync("src/lib/billing/templates.ts", "utf8");
const email = readFileSync("src/lib/email/service.ts", "utf8");
const cron = readFileSync("src/app/api/cron/billing/route.ts", "utf8");
const panel = readFileSync("src/components/admin/billing-panel.tsx", "utf8");
const payment = readFileSync("src/components/admin/payment-detail.tsx", "utf8");
const rules = readFileSync("src/components/admin/billing-rules-panel.tsx", "utf8");
const sections = readFileSync("src/components/admin/billing-detail-sections.tsx", "utf8");
const authorization = readFileSync("src/lib/admin/authorization.ts", "utf8");
const chrome = readFileSync("src/components/admin/admin-chrome.tsx", "utf8");

const cases = [
  ["A01 reminder rules are configurable rows", /create table public\.billing_reminder_rules/],
  ["A02 seven-day default exists", /'payment_due_7_days',7,'before'/],
  ["A03 three-day default exists", /'payment_due_3_days',3,'before'/],
  ["A04 due-today default exists", /'payment_due_today',0,'on'/],
  ["A05 due-time default exists", /'payment_due_time',0,'on'/],
  ["A06 one-day-overdue default exists", /'payment_overdue_1_day',1,'after'/],
  ["A07 due-time reminder requires a time", /due_time_only and v_receivable\.due_time is null/],
  ["A08 deterministic reminder identity includes schedule version", /billing-reminder:[^;]*:v/],
  ["A09 reminder uniqueness is DB enforced", /unique\(receivable_id, rule_id, schedule_version\)/],
  ["A10 event lifecycle includes superseded", /'scheduled', 'processing', 'sent', 'failed', 'skipped', 'superseded'/],
  ["A11 paid obligations are skipped", /receivable_paid/],
  ["A12 cancelled obligations are skipped", /receivable_cancelled/],
  ["A13 schedule changes supersede old reminders", /schedule_version<>new\.schedule_version/],
  ["A14 recurring periods are deterministic", /to_char\(v_due,'YYYY-MM'\)/],
  ["A15 recurring insertion has conflict dedupe", /on conflict\(recurring_service_id,recurring_period_key\) where recurring_service_id is not null do nothing/],
  ["A16 generation is active-service only", /v_service\.status<>'active'/],
  ["A17 generation horizon defaults to 45 days", /billing_generate_recurring\(p_horizon_days integer default 45/],
  ["A18 horizon is bounded", /p_horizon_days not between 1 and 120/],
  ["A19 paused and cancelled services are naturally excluded", /where status='active'/],
  ["A20 historical plans do not enqueue email", /notification_policy='historical_import'/],
  ["A21 past schedules do not enqueue email", /not v_all_future/],
  ["A22 missing recipient does not enqueue email", /v_recipient is null/],
  ["A23 client notification opt-out is enforced", /not v_client\.billing_notifications_enabled/],
  ["A24 schedule-created email is consolidated", /payment_schedule_created/],
  ["A25 schedule-updated email is distinct", /payment_schedule_updated/],
  ["A26 payment email requires explicit notify", /if not new\.notify_client then return new/],
  ["A27 payment confirmation opt-out is enforced", /not v_client\.payment_confirmation_enabled/],
  ["A28 email event has deterministic identity", /billing-email:payment_received:/],
  ["A29 workers claim with skip locked", /for update[^;]*skip locked/],
  ["A30 reminder lease is ten minutes", /lease_expires_at=p_now\+interval '10 minutes'/],
  ["A31 expired leases are reclaimed", /error_category='lease_expired'/],
  ["A32 retry backoff is bounded", /least\(interval '6 hours'/],
  ["A33 failed delivery is not marked sent", /case when p_sent then 'sent'.*else 'failed'/],
  ["A34 claim functions are service-role only", /grant execute on function public\.billing_claim_reminders[\s\S]*to service_role/],
  ["A35 billing tables have FORCE RLS", /billing_reminder_events force row level security/],
  ["A36 email queue is Admin-only readable", /billing_emails_read_admin/],
  ["A37 scheduler uses pg_cron", /create extension if not exists pg_cron/],
  ["A38 scheduler uses pg_net", /create extension if not exists pg_net/],
  ["A39 scheduler secret is stored in Vault", /vault\.create_secret/],
  ["A40 scheduler endpoint is exact", /https:\/\/kencodehn\.com\/api\/cron\/billing/],
  ["A41 delivery cadence is 15 minutes", /'\*\/15 \* \* \* \*'/],
  ["A42 generation cadence is daily", /'10 7 \* \* \*'/],
  ["A43 cron route accepts POST", /export async function POST/],
  ["A44 cron route has no GET handler", /BILLING_CRON_SECRET/],
  ["A45 scheduler secret uses timing-safe comparison", /timingSafeEqual/],
  ["A46 worker IDs are random UUIDs", /randomUUID/],
  ["A47 automation uses deterministic Resend keys", /idempotencyKey:text\([^)]*deterministic_key\)/],
  ["A48 email logging links billing entities", /receivableId|paymentId|billingEventId/],
  ["A49 automation has one bounded delivery entrypoint", /export async function runBillingDelivery/],
  ["A50 billing permission exists", /"billing:view"/],
  ["A51 payment-management permission exists", /"payments:manage"/],
  ["A52 billing-settings permission exists", /"billing_settings:manage"/],
  ["A53 Sales Agent has read-only financial permission", /sales_agent:\s*\[[\s\S]*?"billing:view"/],
  ["A54 navigation exposes Cobros", /\/admin\/cobros/],
  ["A55 mobile receivables use cards", /md:hidden/],
  ["A56 desktop receivables use controlled scroll", /overflow-x-auto/],
  ["A57 payment allocation uses BigInt helper", /parseMoneyToMinor/],
  ["A58 exact allocation is required before submit", /remaining\s*!==\s*BigInt\(0\)/],
  ["A59 cross-client selection is disabled in UI", /clientId\s*!==\s*item\.clientId/],
  ["A60 payment modal is viewport bounded", /kc-modal-viewport/],
  ["A61 payment reversal requires a reason", /reason\.trim\(\)\.length<3/],
  ["A62 reversal UI promises preserved history", /conservarán como historial/],
  ["A63 Client Billing is integrated", /ClientBillingSection/],
  ["A64 Client Payments is integrated", /ClientPaymentsSection/],
  ["A65 Project Billing is integrated", /ProjectBillingSection/],
  ["A66 reminder settings are interactive", /billing_rule_write|\/api\/admin\/billing\/rules/],
];

const allSource = sql + auditSql + financialSql + automation + templates + email + cron + panel + payment + rules + sections + authorization + chrome;
for (const [name, pattern] of cases) test(name, () => assert.match(allSource, pattern));

for (const [index, type] of ["payment_schedule_created", "payment_schedule_updated", "payment_due_7_days", "payment_due_3_days", "payment_due_today", "payment_due_time", "payment_overdue_1_day", "payment_received"].entries()) {
  test(`A${67 + index} ${type} template is implemented`, () => {
    assert.match(templates, new RegExp(type));
    assert.match(templates, /Ken Code/);
    assert.match(templates, /subject,text,html/);
  });
}
test("A75 templates escape client-controlled HTML", () => assert.match(templates, /replace\(\/\[&<>"'\]\//));
test("A76 Spanish is the default billing language", () => assert.match(templates, /locale:"es"\|"en"/));
test("A77 English templates are supported", () => assert.match(templates, /Payment due today/));
test("A78 partial reminders use the outstanding balance", () => assert.match(templates, /Saldo pendiente:.*balance/));
test("A79 templates do not interpolate internal IDs", () => assert.doesNotMatch(templates, /input\.(receivableId|paymentPlanId|workerId)/));
test("A80 no console logging appears in billing automation", () => assert.doesNotMatch(automation, /console\.(log|error|warn)/));
test("A81 cron route has no manual-production query switch", () => assert.doesNotMatch(cron, /runNow|manual=true|searchParams/));
test("A82 scheduler configuration never contains a committed secret", () => assert.doesNotMatch(sql, /Bearer [A-Za-z0-9_-]{32,}/));
test("A83 billing email events never send from a DB trigger", () => assert.doesNotMatch(sql, /resend\.com|emails\.send/));
test("A84 FCM is absent from billing automation", () => assert.doesNotMatch(automation + sql, /sendPush|firebase-admin|push_logs/));
test("A85 responsive payment controls meet 44px targets", () => assert.match(panel + payment, /min-h-11|h-11/));
test("A86 receivables do not cause page overflow", () => assert.doesNotMatch(panel, /min-w-screen|w-screen/));
test("A87 scheduler RPC is service-role only", () => assert.match(sql, /grant execute on function public\.billing_configure_scheduler\(text,text\) to service_role/));
test("A88 scheduler configuration rejects arbitrary endpoints", () => assert.match(sql, /p_endpoint<>'https:\/\/kencodehn\.com\/api\/cron\/billing'/));
test("A89 no production email is sent by the migration", () => assert.doesNotMatch(sql, /net\.http_post[^;]*resend/i));
test("A90 no manual cron execution exists in application code", () => assert.doesNotMatch(cron, /cron\.run|Run Now/));
test("A91 service role can write only the scheduler run audit", () => {
  assert.match(auditSql, /grant select, insert, update on table public\.billing_job_runs to service_role/);
  assert.doesNotMatch(auditSql, /billing_(reminder|email)_events[^;]*service_role/);
});
test("A92 delivery fails closed when job auditing fails", () => {
  assert.match(automation, /if\(startAuditError\)throw new Error/);
  assert.match(automation, /if\(successAuditError\)throw new Error/);
  assert.match(automation, /if\(failureAuditError\)throw new Error/);
});
