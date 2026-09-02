import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const localStatus = process.env.SUPABASE_LOCAL_URL ? null : JSON.parse(execFileSync("cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase status --output json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const url = process.env.SUPABASE_LOCAL_URL || localStatus?.API_URL || "";
const publishable = process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY || localStatus?.PUBLISHABLE_KEY || "";
const secret = process.env.SUPABASE_LOCAL_SERVICE_KEY || localStatus?.SECRET_KEY || "";
const parsed = new URL(url);
if (!publishable || !secret || !["127.0.0.1", "localhost"].includes(parsed.hostname)) throw new Error("Interaction billing E2E refuses non-loopback services.");

const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "Interaction-Local-Only-2026!";
const people = [
  { id: "68000000-0000-4000-8000-000000000001", email: "owner.interaction@example.test", role: "owner", active: true },
  { id: "68000000-0000-4000-8000-000000000002", email: "admin.interaction@example.test", role: "admin", active: true },
  { id: "68000000-0000-4000-8000-000000000003", email: "manager.interaction@example.test", role: "manager", active: true },
  { id: "68000000-0000-4000-8000-000000000004", email: "sales.interaction@example.test", role: "sales_agent", active: true },
  { id: "68000000-0000-4000-8000-000000000005", email: "viewer.interaction@example.test", role: "viewer", active: true },
  { id: "68000000-0000-4000-8000-000000000006", email: "inactive.interaction@example.test", role: "admin", active: false },
] as const;

for (const person of people) {
  const result = await service.auth.admin.createUser({ id: person.id, email: person.email, password, email_confirm: true });
  if (result.error && result.error.status !== 422) throw result.error;
}
const stamp = new Date().toISOString();
const profile = await service.from("profiles").upsert(people.map((person) => ({ id: person.id, name: `Interaction ${person.role}`, email: person.email, role: person.role, active: person.active, created_at: stamp, updated_at: stamp })));
if (profile.error) throw profile.error;

async function auth(person: (typeof people)[number]) {
  const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email: person.email, password });
  if (login.error) throw login.error;
  return client;
}
async function rpc(client: SupabaseClient, name: string, operation: string, payload: Record<string, unknown>) {
  return client.rpc(name, { p_operation: operation, p_payload: payload });
}

const owner = await auth(people[0]);
const admin = await auth(people[1]);
const manager = await auth(people[2]);
const sales = await auth(people[3]);
const viewer = await auth(people[4]);
const inactive = await auth(people[5]);
const emailBefore = await service.from("email_logs").select("id", { count: "exact", head: true });
const pushBefore = await service.from("push_logs").select("id", { count: "exact", head: true });

const clientResult = await rpc(owner, "commercial_write", "client_create", { name: "Interaction Fixture", company: "Interaction Fixture", clientSince: "2026-09-01", assignedToUid: people[3].id });
if (clientResult.error) throw clientResult.error;
const clientId = clientResult.data.id as string;

async function recurringProject(name: string) {
  const created = await rpc(owner, "commercial_write", "project_create", { clientId, name, status: "active", totalAmountMinor: "11900", currency: "USD", soldAt: "2026-09-01", effectiveDate: "2026-09-01", assignedToUid: people[3].id });
  if (created.error) throw created.error;
  const projectId = created.data.id as string;
  const saved = await rpc(owner, "commercial_write", "recurring_service_save", { projectId, name: `${name} monthly`, monthlyAmountMinor: "11900", currency: "USD", frequency: "monthly", startDate: "2026-09-05", billingDay: 5, billingTime: "09:00", timezone: "America/Tegucigalpa", status: "active" });
  if (saved.error) throw saved.error;
  return { projectId, serviceId: saved.data.id as string };
}

const managerFixture = await recurringProject("Manager correction");
const adminFixture = await recurringProject("Admin correction");
const ownerFixture = await recurringProject("Owner deactivation");
const generated = await service.rpc("billing_generate_recurring", { p_horizon_days: 120, p_now: "2026-09-01T12:00:00Z" });
if (generated.error) throw generated.error;
assert.ok(Number(generated.data.created) >= 6);

async function receivables(serviceId: string) {
  const result = await service.from("receivables").select("id,due_date,payment_state,amount_paid_minor,balance_minor,notifications_enabled,recurring_period_key,cancellation_reason").eq("recurring_service_id", serviceId).order("due_date");
  if (result.error) throw result.error;
  return result.data;
}

const managerRows = await receivables(managerFixture.serviceId);
assert.ok(managerRows.length >= 2);
const cancelledId = managerRows[0].id;
const managerPreview = await manager.rpc("billing_correction_preview", { p_service_type: "base", p_service_id: managerFixture.serviceId });
if (managerPreview.error) throw managerPreview.error;
assert.equal(managerPreview.data.total, managerRows.length);
assert.equal(managerPreview.data.cancellable, managerRows.length);
assert.ok((await sales.rpc("billing_correction_preview", { p_service_type: "base", p_service_id: managerFixture.serviceId })).error);

for (const denied of [sales, viewer, inactive]) {
  const result = await rpc(denied, "billing_correction_write", "receivable_cancel", { id: cancelledId, reason: "Intento local denegado" });
  assert.ok(result.error, "Sales, Viewer and inactive users must be denied");
}
const managerCancel = await rpc(manager, "billing_correction_write", "receivable_cancel", { id: cancelledId, reason: "Período generado por error" });
if (managerCancel.error) throw managerCancel.error;
assert.equal(managerCancel.data.status, "cancelled");
const cancelled = await service.from("receivables").select("payment_state,notifications_enabled,schedule_version,cancellation_reason").eq("id", cancelledId).single();
assert.equal(cancelled.data?.payment_state, "cancelled");
assert.equal(cancelled.data?.notifications_enabled, false);
assert.equal(cancelled.data?.cancellation_reason, "Período generado por error");
assert.ok(Number(cancelled.data?.schedule_version) > 0);
const exception = await service.from("recurring_period_exceptions").select("period_key,reason,created_by").eq("receivable_id", cancelledId).single();
assert.equal(exception.data?.created_by, people[2].id);

const generationAgain = await service.rpc("billing_generate_recurring", { p_horizon_days: 120, p_now: "2026-09-01T12:00:00Z" });
if (generationAgain.error) throw generationAgain.error;
const managerAfter = await receivables(managerFixture.serviceId);
assert.equal(managerAfter.filter((row) => row.recurring_period_key === exception.data?.period_key).length, 1);
assert.equal(managerAfter.find((row) => row.recurring_period_key === exception.data?.period_key)?.payment_state, "cancelled");
assert.ok(managerAfter.some((row) => row.recurring_period_key !== exception.data?.period_key && row.payment_state === "open"));

const adminRows = await receivables(adminFixture.serviceId);
const adminCancel = await rpc(admin, "billing_correction_write", "receivable_cancel", { id: adminRows[0].id, reason: "Corrección administrativa local" });
if (adminCancel.error) throw adminCancel.error;
assert.equal(adminCancel.data.status, "cancelled");

const ownerRows = await receivables(ownerFixture.serviceId);
const protectedReceivable = ownerRows[0];
const paid = await rpc(owner, "financial_write", "payment_post", { clientId, currency: "USD", amountMinor: "5000", paidAt: "2026-09-02T15:00:00-06:00", method: "bank_transfer", reference: "LOCAL-ONLY", notes: "Local partial payment fixture", notifyClient: false, allocations: [{ receivableId: protectedReceivable.id, amountMinor: "5000" }] });
if (paid.error) throw paid.error;
const paidCancel = await rpc(owner, "billing_correction_write", "receivable_cancel", { id: protectedReceivable.id, reason: "Debe ser rechazado" });
assert.ok(paidCancel.error, "Partially paid periods cannot be cancelled");

const deactivated = await rpc(owner, "billing_correction_write", "recurring_service_deactivate", { serviceType: "base", serviceId: ownerFixture.serviceId, cancelFuture: true, reason: "Fin de servicio local" });
if (deactivated.error) throw deactivated.error;
assert.equal(deactivated.data.status, "cancelled");
assert.ok(Number(deactivated.data.cancelledFuture) >= 1);
assert.ok(Number(deactivated.data.preservedFuture) >= 1);
const serviceRow = await service.from("project_recurring_services").select("status").eq("id", ownerFixture.serviceId).single();
assert.equal(serviceRow.data?.status, "cancelled");
const ownerAfter = await receivables(ownerFixture.serviceId);
assert.equal(ownerAfter.find((row) => row.id === protectedReceivable.id)?.payment_state, "partially_paid");
assert.ok(ownerAfter.filter((row) => row.id !== protectedReceivable.id).every((row) => row.payment_state === "cancelled"));

const reminderEvents = await service.from("billing_reminder_events").select("state,skipped_reason").in("receivable_id", ownerAfter.filter((row) => row.payment_state === "cancelled").map((row) => row.id));
if (reminderEvents.error) throw reminderEvents.error;
assert.ok((reminderEvents.data || []).every((row) => ["skipped", "superseded", "sent"].includes(row.state)));
assert.ok((reminderEvents.data || []).every((row) => !["scheduled", "processing", "failed"].includes(row.state)));

const emailAfter = await service.from("email_logs").select("id", { count: "exact", head: true });
const pushAfter = await service.from("push_logs").select("id", { count: "exact", head: true });
assert.equal(emailAfter.count, emailBefore.count);
assert.equal(pushAfter.count, pushBefore.count);

console.log(JSON.stringify({ status: "PASS", generated: generated.data.created, cancelledPeriod: exception.data?.period_key, nextPeriodPreserved: true, partialPaymentProtected: true, serviceCancelledFuture: deactivated.data.cancelledFuture, roles: { owner: "allowed", admin: "allowed", manager: "allowed", sales: "denied", viewer: "denied", inactive: "denied" }, emailDelta: 0, pushDelta: 0 }));
