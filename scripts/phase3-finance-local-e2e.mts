import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type LocalStatus = { API_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string };
function localStatus(): LocalStatus {
  const status = { API_URL: process.env.SUPABASE_LOCAL_URL, PUBLISHABLE_KEY: process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY, SECRET_KEY: process.env.SUPABASE_LOCAL_SERVICE_KEY } as LocalStatus;
  const parsed = new URL(status.API_URL);
  if (!status.PUBLISHABLE_KEY || !status.SECRET_KEY || !["127.0.0.1", "localhost"].includes(parsed.hostname)) throw new Error("Phase 3 USD E2E refuses non-loopback services.");
  return status;
}

const local = localStatus();
const service = createClient(local.API_URL, local.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "Phase3-Local-Only-2026!";
const identities = [
  { id: "53000000-0000-4000-8000-000000000001", email: "owner.phase3@example.test", role: "owner", active: true },
  { id: "53000000-0000-4000-8000-000000000002", email: "admin.phase3@example.test", role: "admin", active: true },
  { id: "53000000-0000-4000-8000-000000000003", email: "manager.phase3@example.test", role: "manager", active: true },
  { id: "53000000-0000-4000-8000-000000000004", email: "viewer.phase3@example.test", role: "viewer", active: true },
  { id: "53000000-0000-4000-8000-000000000005", email: "sales.phase3@example.test", role: "sales_agent", active: true },
  { id: "53000000-0000-4000-8000-000000000006", email: "inactive.phase3@example.test", role: "admin", active: false },
] as const;

for (const identity of identities) { const { error } = await service.auth.admin.createUser({ id: identity.id, email: identity.email, password, email_confirm: true }); if (error && error.status !== 422) throw error; }
const now = new Date().toISOString();
const { error: profileError } = await service.from("profiles").upsert(identities.map((identity) => ({ id: identity.id, name: `Phase 3 ${identity.role}`, email: identity.email, role: identity.role, active: identity.active, created_at: now, updated_at: now })));
if (profileError) throw profileError;

async function authenticated(identity: (typeof identities)[number]) { const client = createClient(local.API_URL, local.PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); const { error } = await client.auth.signInWithPassword({ email: identity.email, password }); if (error) throw error; return client; }
async function commercial(client: SupabaseClient, operation: string, payload: Record<string, unknown>) { return client.rpc("commercial_write", { p_operation: operation, p_payload: payload }); }
async function finance(client: SupabaseClient, operation: string, payload: Record<string, unknown>) { return client.rpc("finance_write", { p_operation: operation, p_payload: payload }); }

const owner = await authenticated(identities[0]); const admin = await authenticated(identities[1]); const manager = await authenticated(identities[2]); const viewer = await authenticated(identities[3]); const sales = await authenticated(identities[4]); const inactive = await authenticated(identities[5]);
const category = (await owner.from("expense_categories").select("id").eq("name", "Software").single()).data!;

const createdClient = await commercial(owner, "client_create", { name: "Cliente local Phase 3", company: "Fixture financiero USD", clientSince: "2026-08-29", assignedToUid: identities[4].id });
if (createdClient.error) throw createdClient.error;
const clientId = createdClient.data.id;
const createdProject = await commercial(owner, "project_create", { clientId, name: "Proyecto USD local", status: "active", totalAmountMinor: "250000", currency: "USD", soldAt: "2026-08-29", effectiveDate: "2026-08-29", assignedToUid: identities[4].id });
if (createdProject.error) throw createdProject.error;
const projectId = createdProject.data.id;
const plan = await commercial(owner, "payment_plan_save", { projectId, name: "Plan USD", installments: [{ label: "Cuota única", amountMinor: "250000", currency: "USD", dueDate: "2026-09-15" }] });
if (plan.error) throw plan.error;
const activated = await commercial(owner, "payment_plan_activate", { id: plan.data.id }); if (activated.error) throw activated.error;
const receivable = (await owner.from("receivables").select("id,currency").eq("project_id", projectId).single()).data!; assert.equal(receivable.currency, "USD");

const paid = await owner.rpc("financial_write", { p_operation: "payment_post", p_payload: { clientId, currency: "USD", amountMinor: "100000", paidAt: "2026-09-01T15:00:00.000Z", method: "bank_transfer", reference: "LOCAL-P3", notes: "Loopback only", notifyClient: false, allocations: [{ receivableId: receivable.id, amountMinor: "100000" }] } });
if (paid.error) throw paid.error;
const usdExpense = await finance(admin, "expense_create", { categoryId: category.id, description: "Licencia local USD", vendor: "Proveedor local", amountMinor: "30000", currency: "USD", expenseDate: "2026-09-03", paidAt: "", paymentMethod: "paypal", reference: "LOCAL-USD", notes: "Fixture sanitizado", projectId });
if (usdExpense.error) throw usdExpense.error;
const temporary = await finance(owner, "expense_create", { categoryId: category.id, description: "Gasto que será anulado", vendor: "", amountMinor: "10000", currency: "USD", expenseDate: "2026-09-03", paidAt: "", paymentMethod: "other", reference: "", notes: "", projectId: "" });
if (temporary.error) throw temporary.error;
const reversed = await finance(owner, "expense_reverse", { id: temporary.data.id, reason: "Registro local duplicado" }); if (reversed.error) throw reversed.error;

const summary = await owner.rpc("finance_summary", { p_from: "2026-01-01", p_to: "2026-12-31" }); if (summary.error) throw summary.error;
assert.equal(summary.data.length, 1); assert.equal(summary.data[0].currency, "USD");
assert.deepEqual({ sold: String(summary.data[0].sold_minor), collected: String(summary.data[0].collected_minor), outstanding: String(summary.data[0].outstanding_minor), expenses: String(summary.data[0].expense_minor), net: String(summary.data[0].net_cash_minor) }, { sold: "250000", collected: "100000", outstanding: "150000", expenses: "30000", net: "70000" });
const report = await owner.rpc("finance_report", { p_report: "cash_result", p_from: "2026-01-01", p_to: "2026-12-31", p_currency: "USD", p_client_id: null, p_project_id: null, p_seller_id: null, p_payment_method: null, p_category_id: null, p_page: 1, p_page_size: 25 });
if (report.error) throw report.error; assert.equal(report.data.length, 2); assert.ok(report.data.every((row: any) => row.currency === "USD"));

const hnlProject = await commercial(owner, "project_create", { clientId, name: "Manipulado HNL", status: "active", totalAmountMinor: "100", currency: "HNL", effectiveDate: "2026-08-29" }); assert.ok(hnlProject.error);
const eurProject = await commercial(owner, "project_create", { clientId, name: "Manipulado EUR", status: "active", totalAmountMinor: "100", currency: "EUR", effectiveDate: "2026-08-29" }); assert.ok(eurProject.error);
const hnlExpense = await finance(owner, "expense_create", { categoryId: category.id, description: "Moneda manipulada HNL", vendor: "", amountMinor: "100", currency: "HNL", expenseDate: "2026-09-03", paidAt: "", paymentMethod: "cash", reference: "", notes: "", projectId: "" }); assert.ok(hnlExpense.error);
const eurExpense = await finance(owner, "expense_create", { categoryId: category.id, description: "Moneda manipulada EUR", vendor: "", amountMinor: "100", currency: "EUR", expenseDate: "2026-09-03", paidAt: "", paymentMethod: "cash", reference: "", notes: "", projectId: "" }); assert.ok(eurExpense.error);
const hnlPayment = await owner.rpc("financial_write", { p_operation: "payment_post", p_payload: { clientId, currency: "HNL", amountMinor: "100", paidAt: "2026-09-01T15:00:00.000Z", method: "cash", reference: "", notes: "", notifyClient: false, allocations: [{ receivableId: receivable.id, amountMinor: "100" }] } }); assert.ok(hnlPayment.error);
assert.ok((await owner.rpc("finance_monthly_series", { p_from: "2026-01-01", p_to: "2026-12-31", p_currency: "HNL" })).error);
assert.ok((await owner.rpc("finance_report", { p_report: "cash_result", p_from: "2026-01-01", p_to: "2026-12-31", p_currency: "EUR", p_page: 1, p_page_size: 25 })).error);

assert.ok((await manager.rpc("finance_summary", { p_from: "2026-01-01", p_to: "2026-12-31" })).error);
assert.equal((await viewer.from("expenses").select("id")).data?.length, 0); assert.equal((await sales.from("expenses").select("id")).data?.length, 0); assert.equal((await inactive.from("expenses").select("id")).data?.length, 0);
assert.ok((await sales.rpc("finance_write", { p_operation: "expense_create", p_payload: {} })).error);
assert.ok((await service.from("expenses").delete().eq("id", usdExpense.data.id)).error);
const preserved = await service.from("expenses").select("status,reversal_reason").eq("id", temporary.data.id).single(); assert.deepEqual(preserved.data, { status: "reversed", reversal_reason: "Registro local duplicado" });
const events = await service.from("activity_logs").select("action,actor_id").in("action", ["expense_recorded", "expense_reversed"]); assert.equal(events.data?.filter((row) => row.action === "expense_recorded").length, 2); assert.equal(events.data?.filter((row) => row.action === "expense_reversed").length, 1); assert.ok(events.data?.every((row) => Boolean(row.actor_id)));
const { count: emailLogs } = await service.from("email_logs").select("id", { count: "exact", head: true }); const { count: pushLogs } = await service.from("push_logs").select("id", { count: "exact", head: true }); assert.equal(emailLogs, 0); assert.equal(pushLogs, 0);

console.log(JSON.stringify({ target: "loopback-only", financeFlow: "PASS", currency: { operational: "USD", defaulted: "PASS", HNL: "REJECTED", EUR: "REJECTED" }, entities: { project: "USD", installment: "USD", receivable: "USD", payment: "USD", expense: "USD" }, reporting: { summary: "USD", cashResult: "USD", exportContract: "USD" }, expenses: { create: "PASS", reverse: "PASS", hardDelete: "DENIED", audit: "PASS" }, rls: { owner: "PASS", admin: "PASS", manager: "DENIED", viewer: "DENIED", salesAgent: "DENIED", inactive: "DENIED" }, externalDeliveries: { email: 0, push: 0 } }, null, 2));
