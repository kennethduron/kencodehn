import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type LocalConfig = { API_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string };

function localConfig(): LocalConfig {
  const value = {
    API_URL: process.env.SUPABASE_LOCAL_URL,
    PUBLISHABLE_KEY: process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY,
    SECRET_KEY: process.env.SUPABASE_LOCAL_SERVICE_KEY,
  } as LocalConfig;
  const parsed = new URL(value.API_URL);
  if (!value.PUBLISHABLE_KEY || !value.SECRET_KEY || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error("Safe lifecycle E2E refuses non-loopback services.");
  }
  return value;
}

const config = localConfig();
const service = createClient(config.API_URL, config.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "Lifecycle-Local-Only-2026!";
const people = [
  { id: "65000000-0000-4000-8000-000000000001", email: "owner.lifecycle@example.test", role: "owner", active: true },
  { id: "65000000-0000-4000-8000-000000000002", email: "manager.lifecycle@example.test", role: "manager", active: true },
  { id: "65000000-0000-4000-8000-000000000003", email: "sales.lifecycle@example.test", role: "sales_agent", active: true },
  { id: "65000000-0000-4000-8000-000000000004", email: "viewer.lifecycle@example.test", role: "viewer", active: true },
  { id: "65000000-0000-4000-8000-000000000005", email: "inactive.lifecycle@example.test", role: "admin", active: false },
  { id: "65000000-0000-4000-8000-000000000006", email: "admin.lifecycle@example.test", role: "admin", active: true },
] as const;

for (const person of people) {
  const { error } = await service.auth.admin.createUser({ id: person.id, email: person.email, password, email_confirm: true });
  if (error && error.status !== 422) throw error;
}
const now = new Date().toISOString();
const profile = await service.from("profiles").upsert(people.map((person) => ({
  id: person.id,
  name: `Lifecycle ${person.role}`,
  email: person.email,
  role: person.role,
  active: person.active,
  created_at: now,
  updated_at: now,
})));
if (profile.error) throw profile.error;

async function auth(person: (typeof people)[number]) {
  const client = createClient(config.API_URL, config.PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: person.email, password });
  if (error) throw error;
  return client;
}

async function write(client: SupabaseClient, name: string, operation: string, payload: Record<string, unknown>) {
  return client.rpc(name, { p_operation: operation, p_payload: payload });
}

const owner = await auth(people[0]);
const manager = await auth(people[1]);
const sales = await auth(people[2]);
const viewer = await auth(people[3]);
const inactive = await auth(people[4]);
const admin = await auth(people[5]);
const emailBefore = await service.from("email_logs").select("id", { count: "exact", head: true });
const pushBefore = await service.from("push_logs").select("id", { count: "exact", head: true });

const clientResult = await write(owner, "commercial_write", "client_create", {
  name: "Lifecycle Client",
  company: "Lifecycle Client",
  clientSince: "2026-08-31",
  assignedToUid: people[2].id,
});
if (clientResult.error) throw clientResult.error;
const clientId = clientResult.data.id as string;
const projectResult = await write(owner, "commercial_write", "project_create", {
  clientId,
  name: "Lifecycle Project",
  status: "active",
  totalAmountMinor: "10000",
  currency: "USD",
  soldAt: "2026-08-31",
  effectiveDate: "2026-08-31",
  assignedToUid: people[2].id,
});
if (projectResult.error) throw projectResult.error;
const projectId = projectResult.data.id as string;

const emptyModule = await write(owner, "add_on_write", "module_create", {
  clientId,
  projectId,
  name: "Empty lifecycle module",
  description: "Local fixture",
  requestDate: "2026-08-31",
  requestedByClient: false,
  currency: "USD",
});
if (emptyModule.error) throw emptyModule.error;
const emptyInfo = await owner.rpc("record_lifecycle_inspect", { p_entity: "module", p_id: emptyModule.data.id });
if (emptyInfo.error) throw emptyInfo.error;
assert.equal(emptyInfo.data.deleteAllowed, true);
assert.equal(emptyInfo.data.hasHistory, false);
const deleted = await owner.rpc("record_lifecycle_apply", { p_entity: "module", p_id: emptyModule.data.id, p_action: "delete", p_reason: "Fixture vacía" });
if (deleted.error) throw deleted.error;
assert.equal((await service.from("project_add_ons").select("id").eq("id", emptyModule.data.id)).data?.length, 0);

const historicalModule = await write(owner, "add_on_write", "module_create", {
  clientId,
  projectId,
  name: "Module with business history",
  description: "Local fixture",
  requestDate: "2026-08-31",
  requestedByClient: true,
  currency: "USD",
});
if (historicalModule.error) throw historicalModule.error;
const proposal = await write(owner, "add_on_write", "proposal_create", {
  addOnId: historicalModule.data.id,
  title: "Historical proposal",
  scope: "Business history fixture",
  amountMinor: "50000",
  currency: "USD",
  paymentTerms: "One payment",
  monthlyAddOnMinor: "0",
  estimatedDelivery: "",
  validUntil: "",
  clientNotes: "",
  internalNotes: "",
});
if (proposal.error) throw proposal.error;
const sentProposal = await write(owner, "add_on_write", "proposal_mark_sent", { proposalId: proposal.data.id });
if (sentProposal.error) throw sentProposal.error;
const historyInfo = await owner.rpc("record_lifecycle_inspect", { p_entity: "module", p_id: historicalModule.data.id });
if (historyInfo.error) throw historyInfo.error;
assert.equal(historyInfo.data.hasHistory, true);
assert.equal(historyInfo.data.deleteAllowed, false);
assert.equal(historyInfo.data.recommendedAction, "archive");
assert.ok((await owner.rpc("record_lifecycle_apply", { p_entity: "module", p_id: historicalModule.data.id, p_action: "delete", p_reason: "Must remain" })).error);
const archived = await owner.rpc("record_lifecycle_apply", { p_entity: "module", p_id: historicalModule.data.id, p_action: "archive", p_reason: "Conservar historial" });
if (archived.error) throw archived.error;
const archivedRow = await service.from("project_add_ons").select("archived_at,archive_reason").eq("id", historicalModule.data.id).single();
assert.ok(archivedRow.data?.archived_at);
assert.equal(archivedRow.data?.archive_reason, "Conservar historial");
assert.equal((await service.from("add_on_proposals").select("id").eq("id", proposal.data.id)).data?.length, 1);

const draftModule = await write(owner, "add_on_write", "module_create", {
  clientId, projectId, name: "Discardable draft module", description: "Local fixture",
  requestDate: "2026-08-31", requestedByClient: false, currency: "USD",
});
if (draftModule.error) throw draftModule.error;
const draftProposal = await write(owner, "add_on_write", "proposal_create", {
  addOnId: draftModule.data.id, title: "Discardable draft", scope: "Never sent local draft",
  amountMinor: "12000", currency: "USD", paymentTerms: "", monthlyAddOnMinor: "0",
  estimatedDelivery: "", validUntil: "", clientNotes: "", internalNotes: "",
});
if (draftProposal.error) throw draftProposal.error;
const draftInfo = await owner.rpc("record_lifecycle_inspect", { p_entity: "proposal", p_id: draftProposal.data.id });
if (draftInfo.error) throw draftInfo.error;
assert.equal(draftInfo.data.deleteAllowed, true);
assert.equal((await owner.rpc("record_lifecycle_apply", { p_entity: "proposal", p_id: draftProposal.data.id, p_action: "delete", p_reason: "Borrador accidental" })).error, null);
assert.equal((await service.from("add_on_proposals").select("id").eq("id", draftProposal.data.id)).data?.length, 0);
const draftModuleInfo = await owner.rpc("record_lifecycle_inspect", { p_entity: "module", p_id: draftModule.data.id });
if (draftModuleInfo.error) throw draftModuleInfo.error;
assert.equal(draftModuleInfo.data.deleteAllowed, true);

const deliveredModule = await write(owner, "add_on_write", "module_create", {
  clientId, projectId, name: "Delivered but unsold module", description: "Local accidental fixture",
  requestDate: "2026-08-31", requestedByClient: false, currency: "USD",
});
if (deliveredModule.error) throw deliveredModule.error;
const deliveredProposal = await write(owner, "add_on_write", "proposal_create", {
  addOnId: deliveredModule.data.id, title: "Unsent accidental proposal", scope: "Never sent local draft",
  amountMinor: "15900", currency: "USD", paymentTerms: "", monthlyAddOnMinor: "0",
  estimatedDelivery: "", validUntil: "", clientNotes: "", internalNotes: "",
});
if (deliveredProposal.error) throw deliveredProposal.error;
const assignment = await write(owner, "add_on_write", "module_assign", {
  addOnId: deliveredModule.data.id, sellerId: "", reason: "Auxiliary reassignment fixture",
});
if (assignment.error) throw assignment.error;
const delivered = await write(owner, "add_on_write", "work_status_update", {
  addOnId: deliveredModule.data.id, status: "delivered", plannedStartDate: "2026-08-01",
  targetDeliveryDate: "2026-08-15", actualDeliveryDate: "2026-08-15", notes: "Auxiliary delivery state",
});
if (delivered.error) throw delivered.error;
const auxiliaryNotification = await service.from("notifications").insert({
  firebase_id: `local:${crypto.randomUUID()}`,
  recipient_id: people[0].id,
  add_on_id: deliveredModule.data.id,
  type: "module",
  severity: "info",
  title: "Auxiliary module notification",
  message: "Local-only fixture",
  action_url: `/admin/modulos/${deliveredModule.data.id}`,
  created_at: now,
  updated_at: now,
}).select("id").single();
if (auxiliaryNotification.error) throw auxiliaryNotification.error;
for (const actor of [owner, admin, manager]) {
  const info = await actor.rpc("record_lifecycle_inspect", { p_entity: "module", p_id: deliveredModule.data.id });
  if (info.error) throw info.error;
  assert.equal(info.data.deleteAllowed, true);
  assert.equal(info.data.hasHistory, false);
  assert.deepEqual(info.data.blockingReasons, []);
  assert.match(info.data.reason, /no tiene ventas, cobros ni pagos/i);
}
const auxiliaryActivityIds = (await service.from("activity_logs").select("id").eq("add_on_id", deliveredModule.data.id)).data?.map((row) => row.id) || [];
const deliveredDelete = await manager.rpc("record_lifecycle_apply", {
  p_entity: "module", p_id: deliveredModule.data.id, p_action: "delete", p_reason: "Registro accidental sin venta",
});
if (deliveredDelete.error) throw deliveredDelete.error;
assert.equal((await service.from("project_add_ons").select("id").eq("id", deliveredModule.data.id)).data?.length, 0);
assert.equal((await service.from("add_on_proposals").select("id").eq("id", deliveredProposal.data.id)).data?.length, 0);
assert.equal((await service.from("add_on_seller_assignment_events").select("id").eq("add_on_id", deliveredModule.data.id)).data?.length, 0);
assert.equal((await service.from("notifications").select("id").eq("id", auxiliaryNotification.data.id)).data?.length, 0);
if (auxiliaryActivityIds.length) {
  const detached = await service.from("activity_logs").select("add_on_id").in("id", auxiliaryActivityIds);
  assert.ok(detached.data?.every((row) => row.add_on_id === null));
}

const soldModule = await write(owner, "add_on_write", "module_create", {
  clientId, projectId, name: "Sold protected module", description: "Local protected fixture",
  requestDate: "2026-08-31", requestedByClient: true, currency: "USD",
});
if (soldModule.error) throw soldModule.error;
const soldProposal = await write(owner, "add_on_write", "proposal_create", {
  addOnId: soldModule.data.id, title: "Accepted proposal", scope: "Commercial sale fixture",
  amountMinor: "22500", currency: "USD", paymentTerms: "One payment", monthlyAddOnMinor: "0",
  estimatedDelivery: "", validUntil: "", clientNotes: "", internalNotes: "",
});
if (soldProposal.error) throw soldProposal.error;
const acceptedSale = await write(owner, "add_on_write", "proposal_accept", {
  proposalId: soldProposal.data.id, effectiveDate: "2026-08-31", decisionNotes: "Accepted locally",
});
if (acceptedSale.error) throw acceptedSale.error;
const saleInfo = await owner.rpc("record_lifecycle_inspect", { p_entity: "module", p_id: soldModule.data.id });
if (saleInfo.error) throw saleInfo.error;
assert.equal(saleInfo.data.deleteAllowed, false);
assert.ok(saleInfo.data.blockingReasons.includes("approved_sale"));
assert.match(saleInfo.data.reason, /venta aprobada/i);
assert.ok((await owner.rpc("record_lifecycle_apply", { p_entity: "module", p_id: soldModule.data.id, p_action: "delete", p_reason: "Must remain" })).error);

const managerModule = await write(owner, "add_on_write", "module_create", {
  clientId,
  projectId,
  name: "Manager empty module",
  description: "Local fixture",
  requestDate: "2026-08-31",
  requestedByClient: false,
  currency: "USD",
});
if (managerModule.error) throw managerModule.error;
const managerInfo = await manager.rpc("record_lifecycle_inspect", { p_entity: "module", p_id: managerModule.data.id });
if (managerInfo.error) throw managerInfo.error;
assert.equal(managerInfo.data.deleteAllowed, true);
assert.equal((await manager.rpc("record_lifecycle_apply", { p_entity: "module", p_id: managerModule.data.id, p_action: "delete", p_reason: "Sin actividad" })).error, null);

assert.ok((await sales.rpc("record_lifecycle_inspect", { p_entity: "module", p_id: historicalModule.data.id })).error);
assert.ok((await viewer.rpc("record_lifecycle_inspect", { p_entity: "module", p_id: historicalModule.data.id })).error);
assert.ok((await inactive.rpc("record_lifecycle_inspect", { p_entity: "module", p_id: historicalModule.data.id })).error);

const clientInfo = await owner.rpc("record_lifecycle_inspect", { p_entity: "client", p_id: clientId });
if (clientInfo.error) throw clientInfo.error;
assert.equal(clientInfo.data.hasHistory, true);
assert.equal(clientInfo.data.deleteAllowed, false);
assert.equal(clientInfo.data.recommendedAction, "deactivate");

const category = await service.from("expense_categories").select("id").limit(1).single();
if (category.error) throw category.error;
const expense = await service.from("expenses").insert({
  category_id: category.data.id,
  description: "Lifecycle local fixture",
  amount_minor: 100,
  currency: "USD",
  expense_date: "2026-08-31",
  payment_method: "cash",
  created_by: people[0].id,
}).select("id").single();
if (expense.error) throw expense.error;
const expenseInfo = await owner.rpc("record_lifecycle_inspect", { p_entity: "expense", p_id: expense.data.id });
if (expenseInfo.error) throw expenseInfo.error;
assert.equal(expenseInfo.data.deleteAllowed, false);
assert.equal(expenseInfo.data.archiveAllowed, false);
assert.equal(expenseInfo.data.recommendedAction, "reverse");
assert.ok((await owner.rpc("record_lifecycle_apply", { p_entity: "expense", p_id: expense.data.id, p_action: "delete", p_reason: "Forbidden" })).error);

const identity = await service.from("mail_identities").insert({
  local_part: "unused-lifecycle",
  display_name: "Unused Lifecycle",
  created_by: people[0].id,
}).select("id").single();
if (identity.error) throw identity.error;
const identityAssignment = await service.from("mail_identity_assignments").insert({
  identity_id: identity.data.id,
  profile_id: people[0].id,
  assigned_by: people[0].id,
  is_primary: true,
}).select("id").single();
if (identityAssignment.error) throw identityAssignment.error;
const identityAudit = await service.from("mail_audit_events").insert({
  action: "mail_identity_created",
  actor_id: people[0].id,
  identity_id: identity.data.id,
}).select("id").single();
if (identityAudit.error) throw identityAudit.error;
const identityInfo = await owner.rpc("record_lifecycle_inspect", { p_entity: "mail_identity", p_id: identity.data.id });
if (identityInfo.error) throw identityInfo.error;
assert.equal(identityInfo.data.deleteAllowed, true);
assert.equal((await owner.rpc("record_lifecycle_apply", { p_entity: "mail_identity", p_id: identity.data.id, p_action: "delete", p_reason: "Identidad nunca utilizada" })).error, null);
assert.equal((await service.from("mail_identities").select("id").eq("id", identity.data.id)).data?.length, 0);
assert.equal((await service.from("mail_identity_assignments").select("id").eq("id", identityAssignment.data.id)).data?.length, 0);
assert.equal((await service.from("mail_audit_events").select("identity_id").eq("id", identityAudit.data.id).single()).data?.identity_id, null);

const emailAfter = await service.from("email_logs").select("id", { count: "exact", head: true });
const pushAfter = await service.from("push_logs").select("id", { count: "exact", head: true });
assert.equal(emailAfter.count, emailBefore.count);
assert.equal(pushAfter.count, pushBefore.count);

console.log(JSON.stringify({
  target: "loopback-only",
  emptyRecordDelete: "PASS",
  historyPreservedByArchive: "PASS",
  owner: "PASS",
  manager: "PASS",
  salesAgent: "DENIED",
  viewer: "DENIED",
  inactive: "DENIED",
  financialHardDelete: "DENIED",
  proposalDraftDiscard: "PASS",
  deliveredWithoutBusinessHistoryDelete: "PASS",
  exactBlockingReason: "PASS",
  auxiliaryCleanup: "PASS",
  acceptedSaleDelete: "DENIED",
  unusedMailIdentityDelete: "PASS",
  externalDeliveries: { email: 0, push: 0 },
}, null, 2));
