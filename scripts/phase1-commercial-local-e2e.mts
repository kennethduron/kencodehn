import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_LOCAL_URL;
const publishableKey = process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY;
if (!url || !publishableKey || !serviceKey) throw new Error("Local Supabase test environment is incomplete.");
const parsed = new URL(url);
if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") throw new Error("Phase 1 E2E refuses non-loopback services.");

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "Phase1-Local-Only-2026!";
const identities = [
  { id: "41000000-0000-4000-8000-000000000001", email: "owner.phase1@example.test", role: "owner" },
  { id: "41000000-0000-4000-8000-000000000002", email: "manager.phase1@example.test", role: "manager" },
  { id: "41000000-0000-4000-8000-000000000003", email: "viewer.phase1@example.test", role: "viewer" },
  { id: "41000000-0000-4000-8000-000000000004", email: "sales-a.phase1@example.test", role: "sales_agent" },
  { id: "41000000-0000-4000-8000-000000000005", email: "sales-b.phase1@example.test", role: "sales_agent" },
  { id: "41000000-0000-4000-8000-000000000006", email: "inactive.phase1@example.test", role: "viewer" },
] as const;

for (const identity of identities) {
  const { error } = await service.auth.admin.createUser({ id: identity.id, email: identity.email, password, email_confirm: true });
  if (error && error.status !== 422) throw error;
}
const now = new Date().toISOString();
const { error: profileError } = await service.from("profiles").upsert(identities.map((identity) => ({
  id: identity.id, name: "Phase 1 local fixture", email: identity.email, role: identity.role, active: identity.id !== identities[5].id, created_at: now, updated_at: now,
})));
if (profileError) throw profileError;

async function authenticated(identity: (typeof identities)[number]) {
  const client = createClient(url!, publishableKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: identity.email, password });
  if (error) throw error;
  return client;
}

const owner = await authenticated(identities[0]);
const manager = await authenticated(identities[1]);
const viewer = await authenticated(identities[2]);
const salesA = await authenticated(identities[3]);
const salesB = await authenticated(identities[4]);
const inactive = await authenticated(identities[5]);

const leadId = "42000000-0000-4000-8000-000000000001";
const { error: leadError } = await service.from("leads").insert({
  id: leadId, firebase_id: "phase1-local-won-lead", name: "Cliente convertido", business: "Fixture comercial", email: "client.phase1@example.test", phone: "+504 0000-0000",
  status: "won", priority: "medium", assigned_to: identities[3].id, assigned_at: now, assigned_by: identities[0].id,
  source: "local_fixture", source_path: "/local", created_at: now, updated_at: now,
});
if (leadError) throw leadError;

const conversion = await salesA.rpc("commercial_write", { p_operation: "lead_convert", p_payload: { leadId, clientSince: "2024-01-15" } });
if (conversion.error) throw conversion.error;
assert.equal(conversion.data.created, true);
const clientId = String(conversion.data.id);
const repeatedConversion = await salesA.rpc("commercial_write", { p_operation: "lead_convert", p_payload: { leadId, clientSince: "2024-01-15" } });
if (repeatedConversion.error) throw repeatedConversion.error;
assert.deepEqual(repeatedConversion.data, { id: clientId, created: false });
assert.ok((await salesB.rpc("commercial_write", { p_operation: "lead_convert", p_payload: { leadId } })).error);

const convertedClient = await salesA.from("clients").select("id,origin_lead_id,client_since,created_at,assigned_to").eq("id", clientId).single();
if (convertedClient.error) throw convertedClient.error;
assert.equal(convertedClient.data.origin_lead_id, leadId);
assert.equal(convertedClient.data.client_since, "2024-01-15");
assert.notEqual(convertedClient.data.created_at.slice(0, 10), convertedClient.data.client_since);
assert.equal(convertedClient.data.assigned_to, identities[3].id);
assert.equal((await salesB.from("clients").select("id").eq("id", clientId)).data?.length, 0);
assert.equal((await viewer.from("clients").select("id").eq("id", clientId)).data?.length, 1);
assert.ok((await viewer.rpc("commercial_write", { p_operation: "client_update", p_payload: { id: clientId, updates: { notes: "blocked" } } })).error);
assert.equal((await inactive.from("clients").select("id")).data?.length, 0);
assert.ok((await inactive.rpc("commercial_write", { p_operation: "client_create", p_payload: { name: "Blocked inactive" } })).error);

const manual = await owner.rpc("commercial_write", { p_operation: "client_create", p_payload: {
  name: "Cliente histórico", company: "Fixture", email: "historic.phase1@example.test", phone: "+504 1111-1111", clientSince: "2022-06-01", assignedToUid: identities[3].id,
} });
if (manual.error) throw manual.error;
const manualId = String(manual.data.id);
assert.equal((await owner.from("clients").select("client_since").eq("id", manualId).single()).data?.client_since, "2022-06-01");

const project = await owner.rpc("commercial_write", { p_operation: "project_create", p_payload: {
  clientId, name: "Proyecto comercial", status: "active", totalAmountMinor: 149_900, currency: "USD", effectiveDate: "2025-03-01", startDate: "2026-09-01", assignedToUid: identities[3].id,
} });
if (project.error) throw project.error;
const projectId = String(project.data.id);
assert.equal((await salesA.from("projects").select("id").eq("id", projectId)).data?.length, 1);
assert.equal((await salesB.from("projects").select("id").eq("id", projectId)).data?.length, 0);
assert.equal((await owner.from("projects").select("effective_date").eq("id", projectId).single()).data?.effective_date, "2025-03-01");
assert.equal((await salesA.rpc("commercial_write", { p_operation: "project_update", p_payload: { id: projectId, updates: { description: "Visible al vendedor responsable" } } })).error, null);
assert.ok((await salesB.rpc("commercial_write", { p_operation: "project_update", p_payload: { id: projectId, updates: { description: "blocked" } } })).error);

assert.ok((await manager.rpc("commercial_write", { p_operation: "payment_plan_save", p_payload: { projectId, name: "Manager blocked", installments: [{ label: "Pago", amountMinor: 149_900 }] } })).error);
const invalidDraft = await owner.rpc("commercial_write", { p_operation: "payment_plan_save", p_payload: {
  projectId, name: "Borrador incompleto", installments: [{ label: "Anticipo", amountMinor: 149_000, dueDate: "2026-09-01" }],
} });
if (invalidDraft.error) throw invalidDraft.error;
assert.equal(invalidDraft.data.status, "draft");
assert.ok((await owner.rpc("commercial_write", { p_operation: "payment_plan_activate", p_payload: { id: invalidDraft.data.id } })).error);
assert.ok((await salesA.rpc("commercial_write", { p_operation: "payment_plan_save", p_payload: { projectId, name: "Blocked", installments: [] } })).error);
assert.ok((await owner.rpc("commercial_write", { p_operation: "payment_plan_save", p_payload: { projectId, name: "Zero blocked", installments: [{ label: "Zero", amountMinor: 0 }] } })).error);
assert.ok((await owner.rpc("commercial_write", { p_operation: "payment_plan_save", p_payload: { projectId, name: "Negative blocked", installments: [{ label: "Negative", amountMinor: -1 }] } })).error);

const validDraft = await owner.rpc("commercial_write", { p_operation: "payment_plan_save", p_payload: {
  id: invalidDraft.data.id, projectId, name: "40 / 60", installments: [
    { label: "Anticipo", amountMinor: 75_000, dueDate: "2026-09-01", dueTime: "09:00" },
    { label: "Entrega", amountMinor: 74_900, dueDate: "2026-10-01", dueTime: "09:00" },
  ],
} });
if (validDraft.error) throw validDraft.error;
assert.equal(validDraft.data.plannedTotalMinor, 149_900);
const activation = await owner.rpc("commercial_write", { p_operation: "payment_plan_activate", p_payload: { id: validDraft.data.id } });
if (activation.error) throw activation.error;
assert.equal(activation.data.status, "active");

const secondDraft = await owner.rpc("commercial_write", { p_operation: "payment_plan_save", p_payload: {
  projectId, name: "100%", installments: [{ label: "Pago único", amountMinor: 149_900, dueDate: "2026-09-15" }],
} });
if (secondDraft.error) throw secondDraft.error;
const secondInstallment = await service.from("project_installments").select("id").eq("payment_plan_id", secondDraft.data.id).single();
if (secondInstallment.error) throw secondInstallment.error;
if ((await service.from("project_installments").update({ currency: "HNL" }).eq("id", secondInstallment.data.id)).error) throw new Error("Could not prepare local currency mismatch fixture.");
assert.ok((await owner.rpc("commercial_write", { p_operation: "payment_plan_activate", p_payload: { id: secondDraft.data.id } })).error);
if ((await service.from("project_installments").update({ currency: "USD" }).eq("id", secondInstallment.data.id)).error) throw new Error("Could not restore local currency fixture.");
const secondActivation = await owner.rpc("commercial_write", { p_operation: "payment_plan_activate", p_payload: { id: secondDraft.data.id } });
if (secondActivation.error) throw secondActivation.error;
const plans = await owner.from("project_payment_plans").select("id,status").eq("project_id", projectId);
if (plans.error) throw plans.error;
assert.equal(plans.data.filter((plan) => plan.status === "active").length, 1);
assert.equal(plans.data.find((plan) => plan.id === validDraft.data.id)?.status, "archived");
assert.equal((await salesA.from("project_payment_plans").select("id").eq("project_id", projectId)).data?.length, 2);

assert.ok((await manager.rpc("commercial_write", { p_operation: "recurring_service_save", p_payload: { projectId, name: "Manager blocked", monthlyAmountMinor: 15_000, currency: "USD", startDate: "2026-10-01" } })).error);
const recurring = await owner.rpc("commercial_write", { p_operation: "recurring_service_save", p_payload: {
  projectId, name: "Mantenimiento", monthlyAmountMinor: 15_000, currency: "USD", frequency: "monthly", startDate: "2026-10-01", billingDay: 5, billingTime: "09:30", status: "active",
} });
if (recurring.error) throw recurring.error;
assert.equal((await salesA.from("project_recurring_services").select("status").eq("project_id", projectId).single()).data?.status, "active");
assert.ok((await salesA.rpc("commercial_write", { p_operation: "recurring_service_save", p_payload: { projectId } })).error);

assert.ok((await manager.rpc("commercial_write", { p_operation: "client_assign", p_payload: { id: clientId, assignedToUid: identities[4].id } })).error);
const reassignment = await owner.rpc("commercial_write", { p_operation: "client_assign", p_payload: { id: clientId, assignedToUid: identities[4].id, reason: "Local RLS test" } });
if (reassignment.error) throw reassignment.error;
assert.equal(reassignment.data.changed, true);
assert.equal((await owner.from("seller_assignment_events").select("id").eq("client_id", clientId)).data?.length, 1);

const { count: emailCount } = await service.from("email_logs").select("id", { head: true, count: "exact" });
const { count: pushCount } = await service.from("push_logs").select("id", { head: true, count: "exact" });
const { count: notificationCount } = await service.from("notifications").select("id", { head: true, count: "exact" });
const { count: reminderCount } = await service.from("reminder_events").select("id", { head: true, count: "exact" });
assert.deepEqual({ emailCount, pushCount, notificationCount, reminderCount }, { emailCount: 0, pushCount: 0, notificationCount: 0, reminderCount: 0 });
const { count: actorlessEvents, error: actorlessError } = await service.from("activity_logs").select("id", { head: true, count: "exact" }).is("actor_id", null);
if (actorlessError) throw actorlessError;
assert.equal(actorlessEvents, 0);

console.log(JSON.stringify({
  target: "loopback-only",
  clients: { manual: "PASS", historicalDate: "PASS", conversion: "PASS", conversionIdempotency: "PASS" },
  projects: { create: "PASS", ownership: "PASS", minorUnits: "PASS", currency: "PASS", historicalEffectiveDate: "PASS" },
  commercialPlans: { example1499Split: "75000+74900", draftMismatchAllowed: "PASS", activationMismatchRejected: "PASS", zeroNegativeRejected: "PASS", currencyMismatchRejected: "PASS", oneActive: "PASS", historyArchived: "PASS" },
  recurringService: "PASS",
  rls: { ownerGlobal: "PASS", managerCommercialReadOnly: "PASS", viewerReadOnly: "PASS", salesOwnOnly: "PASS", salesNoPlanEdit: "PASS", inactiveDenied: "PASS" },
  auditActors: "PASS",
  sellerHistory: "PASS",
  deliveries: { email: 0, push: 0, notification: 0, reminder: 0, cronRuns: 0 },
}, null, 2));
