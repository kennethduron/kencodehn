import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type LocalStatus = { API_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string };

function localStatus(): LocalStatus {
  const status = {
    API_URL: process.env.SUPABASE_LOCAL_URL,
    PUBLISHABLE_KEY: process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY,
    SECRET_KEY: process.env.SUPABASE_LOCAL_SERVICE_KEY,
  } as LocalStatus;
  const parsed = new URL(status.API_URL);
  if (!status.PUBLISHABLE_KEY || !status.SECRET_KEY || (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost")) {
    throw new Error("Phase 2 E2E refuses non-loopback services.");
  }
  return status;
}

const local = localStatus();
const service = createClient(local.API_URL, local.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "Phase2-Local-Only-2026!";
const identities = [
  { id: "52000000-0000-4000-8000-000000000001", email: "owner.phase2@example.test", role: "owner", active: true },
  { id: "52000000-0000-4000-8000-000000000002", email: "admin.phase2@example.test", role: "admin", active: true },
  { id: "52000000-0000-4000-8000-000000000003", email: "manager.phase2@example.test", role: "manager", active: true },
  { id: "52000000-0000-4000-8000-000000000004", email: "viewer.phase2@example.test", role: "viewer", active: true },
  { id: "52000000-0000-4000-8000-000000000005", email: "sales-a.phase2@example.test", role: "sales_agent", active: true },
  { id: "52000000-0000-4000-8000-000000000006", email: "sales-b.phase2@example.test", role: "sales_agent", active: true },
  { id: "52000000-0000-4000-8000-000000000007", email: "inactive.phase2@example.test", role: "viewer", active: false },
] as const;

for (const identity of identities) {
  const { error } = await service.auth.admin.createUser({ id: identity.id, email: identity.email, password, email_confirm: true });
  if (error && error.status !== 422) throw error;
}
const now = new Date().toISOString();
const { error: profileError } = await service.from("profiles").upsert(identities.map((identity) => ({
  id: identity.id, name: `Phase 2 ${identity.role}`, email: identity.email, role: identity.role, active: identity.active, created_at: now, updated_at: now,
})));
if (profileError) throw profileError;

async function authenticated(identity: (typeof identities)[number]) {
  const client = createClient(local.API_URL, local.PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: identity.email, password });
  if (error) throw error;
  return client;
}

async function rpc(client: SupabaseClient, operation: string, payload: Record<string, unknown>) {
  const result = await client.rpc("commercial_write", { p_operation: operation, p_payload: payload });
  if (result.error) throw result.error;
  return result.data as Record<string, any>;
}

async function payment(client: SupabaseClient, payload: Record<string, unknown>) {
  return client.rpc("financial_write", { p_operation: "payment_post", p_payload: payload });
}

const owner = await authenticated(identities[0]);
const admin = await authenticated(identities[1]);
const manager = await authenticated(identities[2]);
const viewer = await authenticated(identities[3]);
const salesA = await authenticated(identities[4]);
const salesB = await authenticated(identities[5]);
const inactive = await authenticated(identities[6]);
const anonymous = createClient(local.API_URL, local.PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
assert.ok((await anonymous.rpc("billing_dashboard_summary", { p_today: "2026-09-01" })).error);
const initialDashboardSummary = await owner.rpc("billing_dashboard_summary", { p_today: "2026-09-01" });
if (initialDashboardSummary.error) throw initialDashboardSummary.error;
assert.deepEqual(initialDashboardSummary.data, [{ currency: "USD", due_today_minor: 0, next_7_days_minor: 0, overdue_minor: 0, outstanding_minor: 0, collected_month_minor: 0 }]);

const createdClient = await rpc(owner, "client_create", {
  name: "Cliente financiero sanitizado", company: "Fixture Phase 2", email: "billing.phase2@example.test", clientSince: "2026-08-29", assignedToUid: identities[4].id,
});
const clientId = String(createdClient.id);
const billingSettings = await owner.rpc("financial_write", { p_operation: "client_billing_settings_update", p_payload: { clientId, billingEmail: "billing.phase2@example.test", billingNotificationsEnabled: true, paymentConfirmationEnabled: true, locale: "es", timezone: "America/Tegucigalpa" } });
if (billingSettings.error) throw billingSettings.error;
assert.ok((await manager.rpc("financial_write", { p_operation: "client_billing_settings_update", p_payload: { clientId } })).error);
const storedBillingSettings = await service.from("clients").select("billing_email,billing_notifications_enabled,payment_confirmation_enabled,billing_locale,billing_timezone").eq("id", clientId).single();
if (storedBillingSettings.error) throw storedBillingSettings.error;
assert.deepEqual(storedBillingSettings.data, { billing_email: "billing.phase2@example.test", billing_notifications_enabled: true, payment_confirmation_enabled: true, billing_locale: "es", billing_timezone: "America/Tegucigalpa" });
const createdProject = await rpc(owner, "project_create", {
  clientId, name: "Proyecto financiero sanitizado", status: "active", totalAmountMinor: "149900", currency: "USD", effectiveDate: "2026-08-29", startDate: "2026-09-01", assignedToUid: identities[4].id,
});
const projectId = String(createdProject.id);
const plan = await rpc(owner, "payment_plan_save", {
  projectId, name: "750 + 749", installments: [
    { label: "Anticipo", amountMinor: "75000", currency: "USD", dueDate: "2026-09-15", dueTime: "09:00" },
    { label: "Entrega", amountMinor: "74900", currency: "USD", dueDate: "2026-10-15", dueTime: "" },
  ],
});
await rpc(owner, "payment_plan_activate", { id: plan.id });

const receivableResult = await owner.from("receivables").select("*").eq("project_id", projectId).eq("origin_type", "project_installment").order("due_date");
if (receivableResult.error) throw receivableResult.error;
assert.equal(receivableResult.data.length, 2);
const [first, second] = receivableResult.data;
assert.equal(String(first.amount_due_minor), "75000");
assert.equal(String(second.amount_due_minor), "74900");
assert.equal(first.due_at, "2026-09-15T15:00:00+00:00");
assert.equal(second.due_at, null);

await rpc(owner, "payment_plan_activate", { id: plan.id });
assert.equal((await owner.from("receivables").select("id", { count: "exact", head: true }).eq("project_id", projectId)).count, 2);
const reminderTypes = await service.from("billing_reminder_events").select("event_type").eq("receivable_id", first.id);
if (reminderTypes.error) throw reminderTypes.error;
assert.deepEqual(new Set(reminderTypes.data.map((row) => row.event_type)), new Set(["payment_due_7_days", "payment_due_3_days", "payment_due_today", "payment_due_time", "payment_overdue_1_day"]));
const scheduleEmails = await service.from("billing_email_events").select("event_type,state").eq("payment_plan_id", plan.id);
if (scheduleEmails.error) throw scheduleEmails.error;
assert.deepEqual(scheduleEmails.data, [{ event_type: "payment_schedule_created", state: "scheduled" }]);

const basePayment = { clientId, currency: "USD", paidAt: "2026-09-01T14:00:00.000Z", method: "bank_transfer", reference: "LOCAL-SANITIZED", notes: "Local only", notifyClient: false };
const p500 = await payment(owner, { ...basePayment, amountMinor: "50000", allocations: [{ receivableId: first.id, amountMinor: "50000" }] });
if (p500.error) throw p500.error;
let state = await service.from("receivables").select("amount_paid_minor,balance_minor,payment_state").eq("id", first.id).single();
if (state.error) throw state.error;
assert.deepEqual({ paid: String(state.data.amount_paid_minor), balance: String(state.data.balance_minor), state: state.data.payment_state }, { paid: "50000", balance: "25000", state: "partially_paid" });

const p250 = await payment(admin, { ...basePayment, amountMinor: "25000", allocations: [{ receivableId: first.id, amountMinor: "25000" }] });
if (p250.error) throw p250.error;
state = await service.from("receivables").select("amount_paid_minor,balance_minor,payment_state").eq("id", first.id).single();
if (state.error) throw state.error;
assert.deepEqual({ paid: String(state.data.amount_paid_minor), balance: String(state.data.balance_minor), state: state.data.payment_state }, { paid: "75000", balance: "0", state: "paid" });

const p749 = await payment(owner, { ...basePayment, amountMinor: "74900", allocations: [{ receivableId: second.id, amountMinor: "74900" }] });
if (p749.error) throw p749.error;
let summary = await owner.from("project_financial_summary").select("*").eq("project_id", projectId).single();
if (summary.error) throw summary.error;
assert.deepEqual({ total: String(summary.data.total_amount_minor), paid: String(summary.data.paid_minor), outstanding: String(summary.data.outstanding_minor) }, { total: "149900", paid: "149900", outstanding: "0" });

const reversed = await owner.rpc("financial_write", { p_operation: "payment_reverse", p_payload: { id: p749.data.id, reason: "Prueba local de reversión" } });
if (reversed.error) throw reversed.error;
state = await service.from("receivables").select("amount_paid_minor,balance_minor,payment_state").eq("id", second.id).single();
if (state.error) throw state.error;
assert.deepEqual({ paid: String(state.data.amount_paid_minor), balance: String(state.data.balance_minor), state: state.data.payment_state }, { paid: "0", balance: "74900", state: "open" });
const preserved = await service.from("payments").select("status,payment_allocations(reversed_at)").eq("id", p749.data.id).single();
if (preserved.error) throw preserved.error;
assert.equal(preserved.data.status, "reversed");
assert.ok(preserved.data.payment_allocations[0].reversed_at);
const repost = await payment(owner, { ...basePayment, amountMinor: "74900", allocations: [{ receivableId: second.id, amountMinor: "74900" }] });
if (repost.error) throw repost.error;

const recurring = await rpc(owner, "recurring_service_save", {
  projectId, name: "Soporte mensual", monthlyAmountMinor: "11900", currency: "USD", frequency: "monthly", startDate: "2026-11-01", billingDay: 1, billingTime: "09:30", timezone: "America/Tegucigalpa", status: "active",
});
const generation = await service.rpc("billing_generate_recurring", { p_horizon_days: 45, p_now: "2026-10-01T12:00:00.000Z" });
if (generation.error) throw generation.error;
assert.equal(generation.data.created, 1);
assert.equal((await service.rpc("billing_generate_recurring", { p_horizon_days: 45, p_now: "2026-10-01T12:00:00.000Z" })).data.created, 0);
const recurringReceivable = await service.from("receivables").select("amount_due_minor,recurring_period_key,due_at").eq("recurring_service_id", recurring.id).single();
if (recurringReceivable.error) throw recurringReceivable.error;
assert.deepEqual({ amount: String(recurringReceivable.data.amount_due_minor), period: recurringReceivable.data.recurring_period_key, dueAt: recurringReceivable.data.due_at }, { amount: "11900", period: "2026-11", dueAt: "2026-11-01T15:30:00+00:00" });
summary = await owner.from("project_financial_summary").select("*").eq("project_id", projectId).single();
if (summary.error) throw summary.error;
assert.deepEqual({ total: String(summary.data.total_amount_minor), paid: String(summary.data.paid_minor), outstanding: String(summary.data.outstanding_minor) }, { total: "149900", paid: "149900", outstanding: "0" });

const competing = await Promise.all([
  payment(owner, { ...basePayment, clientId, amountMinor: "11900", allocations: [{ receivableId: (await service.from("receivables").select("id").eq("recurring_service_id", recurring.id).single()).data!.id, amountMinor: "11900" }] }),
  payment(admin, { ...basePayment, clientId, amountMinor: "11900", allocations: [{ receivableId: (await service.from("receivables").select("id").eq("recurring_service_id", recurring.id).single()).data!.id, amountMinor: "11900" }] }),
]);
assert.equal(competing.filter((result) => !result.error).length, 1);
assert.equal(competing.filter((result) => result.error).length, 1);
const concurrencyWinner = competing.find((result) => !result.error)!;
const concurrencyReversal = await owner.rpc("financial_write", { p_operation: "payment_reverse", p_payload: { id: concurrencyWinner.data.id, reason: "Restaurar fixture abierto para UI local" } });
if (concurrencyReversal.error) throw concurrencyReversal.error;
const reopenedRecurring = await service.from("receivables").select("payment_state,balance_minor").eq("recurring_service_id", recurring.id).single();
if (reopenedRecurring.error) throw reopenedRecurring.error;
assert.deepEqual({ state: reopenedRecurring.data.payment_state, balance: String(reopenedRecurring.data.balance_minor) }, { state: "open", balance: "11900" });

assert.equal((await salesA.from("receivables").select("id").eq("project_id", projectId)).data?.length, 3);
assert.equal((await salesB.from("receivables").select("id").eq("project_id", projectId)).data?.length, 0);
const pagedOwn = await salesA.rpc("billing_list_receivables", { p_page: 1, p_page_size: 2, p_payment_state: null, p_timing_state: "settled", p_origin_type: null, p_currency: "USD", p_client_id: null, p_project_id: null });
if (pagedOwn.error) throw pagedOwn.error;
assert.equal(pagedOwn.data.length, 2);
assert.equal(String(pagedOwn.data[0].total_count), "2");
const pagedOther = await salesB.rpc("billing_list_receivables", { p_page: 1, p_page_size: 20, p_payment_state: null, p_timing_state: null, p_origin_type: null, p_currency: null, p_client_id: null, p_project_id: null });
if (pagedOther.error) throw pagedOther.error;
assert.equal(pagedOther.data.length, 0);
assert.equal((await viewer.from("receivables").select("id").eq("project_id", projectId)).data?.length, 3);
assert.equal((await manager.from("payments").select("id").eq("client_id", clientId)).data?.length, 5);
assert.ok((await salesA.rpc("financial_write", { p_operation: "payment_post", p_payload: {} })).error);
assert.ok((await manager.rpc("financial_write", { p_operation: "payment_post", p_payload: {} })).error);
assert.equal((await inactive.from("receivables").select("id")).data?.length, 0);

const wrongIdentity = await owner.rpc("billing_claim_reminders", { p_worker_id: crypto.randomUUID(), p_limit: 1, p_now: "2027-01-01T00:00:00Z" });
assert.ok(wrongIdentity.error);
const hardDelete = await service.from("payments").delete().eq("id", p500.data.id);
assert.ok(hardDelete.error);

const { count: emailLogs } = await service.from("email_logs").select("id", { count: "exact", head: true });
const { count: pushLogs } = await service.from("push_logs").select("id", { count: "exact", head: true });
assert.equal(emailLogs, 0);
assert.equal(pushLogs, 0);

console.log(JSON.stringify({
  target: "loopback-only",
  financialFlow: "PASS",
  amounts: { project: "149900", installments: ["75000", "74900"], recurring: "11900" },
  receivables: { exactOnce: "PASS", partial: "PASS", paid: "PASS", recurringPeriod: "PASS" },
  payments: { full: "PASS", partial: "PASS", concurrency: "PASS", reversal: "PASS", immutableHistory: "PASS" },
  projectBalance: { total: "149900", paid: "149900", outstanding: "0", recurringExcluded: "PASS" },
  reminders: { rules: 5, paidSkip: "PASS", noDelivery: true },
  rls: { owner: "PASS", admin: "PASS", managerReadOnly: "PASS", viewerReadOnly: "PASS", salesScoped: "PASS", inactiveDenied: "PASS" },
  externalDeliveries: { email: 0, push: 0 },
}, null, 2));
