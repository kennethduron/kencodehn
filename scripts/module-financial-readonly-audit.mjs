import { createClient } from "@supabase/supabase-js";

const expectedRef = "nvtrgrltyzrkljarvwff";
const targetAddOnId = process.argv[2] || "ae1d8c61-e48f-4231-bd2c-88984e2366eb";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const secret = process.env.SUPABASE_SECRET_KEY || "";
const parsed = new URL(url);

if (parsed.protocol !== "https:" || parsed.hostname !== `${expectedRef}.supabase.co`) {
  throw new Error("Read-only audit refuses an unexpected Supabase target.");
}
if (!secret) throw new Error("Read-only audit requires the server-only Production credential.");

const client = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const read = async (query, label) => {
  const result = await query;
  if (result.error) throw new Error(`${label}: ${result.error.code || "read_failed"}`);
  return result.data || [];
};
const cents = (value) => Number(value || 0);
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sum = (rows, key) => rows.reduce((total, row) => total + cents(row[key]), 0);

const addOns = await read(
  client.from("project_add_ons").select("id,client_id,project_id,name,commercial_status,work_status,quoted_amount_minor,accepted_amount_minor,accepted_proposal_id,effective_date,approved_at,created_at,updated_at"),
  "modules",
);
const proposals = await read(
  client.from("add_on_proposals").select("id,add_on_id,proposal_number,version,status,amount_minor,monthly_add_on_minor,decided_at,created_at"),
  "proposals",
);
const sales = await read(
  client.from("add_on_sales").select("id,add_on_id,proposal_id,client_id,project_id,accepted_amount_minor,effective_date,approved_at,created_at"),
  "sales",
);
const plans = await read(
  client.from("add_on_payment_plans").select("id,add_on_sale_id,version,status,planned_total_minor,activated_at,created_at"),
  "plans",
);
const installments = await read(
  client.from("add_on_installments").select("id,payment_plan_id,sequence,label,amount_minor,due_date,due_time,created_at"),
  "installments",
);
const receivables = await read(
  client.from("receivables").select("id,client_id,project_id,origin_type,add_on_installment_id,add_on_recurring_service_id,description,amount_due_minor,amount_paid_minor,balance_minor,due_date,payment_state,cancelled_at,metadata,created_at"),
  "receivables",
);
const allocations = await read(
  client.from("payment_allocations").select("id,payment_id,receivable_id,amount_minor,reversed_at,created_at"),
  "allocations",
);
const payments = await read(
  client.from("payments").select("id,client_id,amount_minor,paid_at,method,status,notify_client,reversed_at,created_at,reference,notes,metadata"),
  "payments",
);
const imports = await read(
  client.from("historical_import_sessions").select("id,client_id,status,started_at,completed_at,reminders_reenabled,skipped_reminder_events"),
  "historical imports",
);
const activities = await read(
  client.from("activity_logs").select("id,entity_type,action,add_on_id,add_on_proposal_id,add_on_sale_id,receivable_id,payment_id,created_at,metadata").eq("add_on_id", targetAddOnId),
  "module activities",
);

const target = addOns.find((row) => row.id === targetAddOnId);
if (!target) throw new Error("Target module was not found.");
const targetProposals = proposals.filter((row) => row.add_on_id === targetAddOnId);
const targetSales = sales.filter((row) => row.add_on_id === targetAddOnId);
const targetSaleIds = new Set(targetSales.map((row) => row.id));
const targetPlans = plans.filter((row) => targetSaleIds.has(row.add_on_sale_id));
const targetPlanIds = new Set(targetPlans.map((row) => row.id));
const targetInstallments = installments.filter((row) => targetPlanIds.has(row.payment_plan_id));
const targetInstallmentIds = new Set(targetInstallments.map((row) => row.id));
const targetReceivables = receivables.filter((row) =>
  targetInstallmentIds.has(row.add_on_installment_id) || row.metadata?.addOnId === targetAddOnId,
);
const targetReceivableIds = new Set(targetReceivables.map((row) => row.id));
const targetAllocations = allocations.filter((row) => targetReceivableIds.has(row.receivable_id));
const targetPaymentIds = new Set(targetAllocations.map((row) => row.payment_id));
const targetPayments = payments.filter((row) => targetPaymentIds.has(row.id));

const moduleGroups = new Map();
for (const row of addOns) {
  const key = `${row.client_id}:${row.project_id}:${normalize(row.name)}`;
  moduleGroups.set(key, [...(moduleGroups.get(key) || []), row]);
}
const duplicates = [...moduleGroups.values()].filter((rows) => rows.length > 1).map((rows) => ({
  normalizedName: normalize(rows[0].name),
  count: rows.length,
  moduleIds: rows.map((row) => row.id),
  statuses: rows.map((row) => `${row.commercial_status}/${row.work_status}`),
  createdAt: rows.map((row) => row.created_at),
}));

const anomalies = [];
for (const row of addOns) {
  const rowProposals = proposals.filter((item) => item.add_on_id === row.id);
  const rowSales = sales.filter((item) => item.add_on_id === row.id);
  const accepted = rowProposals.filter((item) => item.status === "accepted");
  if (row.commercial_status === "approved" && !row.accepted_amount_minor) anomalies.push({ moduleId: row.id, type: "approved_without_module_amount" });
  if (row.commercial_status === "approved" && rowSales.length !== 1) anomalies.push({ moduleId: row.id, type: "approved_sale_count", count: rowSales.length });
  if (accepted.length > 1) anomalies.push({ moduleId: row.id, type: "multiple_accepted_proposals", count: accepted.length });
  if (rowSales[0] && cents(rowSales[0].accepted_amount_minor) !== cents(row.accepted_amount_minor)) anomalies.push({ moduleId: row.id, type: "module_sale_amount_mismatch", moduleAmountMinor: row.accepted_amount_minor, saleAmountMinor: rowSales[0].accepted_amount_minor });
  if (rowSales[0] && accepted[0] && cents(rowSales[0].accepted_amount_minor) !== cents(accepted[0].amount_minor)) anomalies.push({ moduleId: row.id, type: "sale_proposal_amount_mismatch", saleAmountMinor: rowSales[0].accepted_amount_minor, proposalAmountMinor: accepted[0].amount_minor });
  const rowPlan = plans.find((item) => item.add_on_sale_id === rowSales[0]?.id && item.status === "active");
  const rowInstallments = installments.filter((item) => item.payment_plan_id === rowPlan?.id);
  if (rowPlan && sum(rowInstallments, "amount_minor") !== cents(rowPlan.planned_total_minor)) anomalies.push({ moduleId: row.id, type: "plan_installment_total_mismatch" });
  if (rowPlan && rowSales[0] && cents(rowPlan.planned_total_minor) !== cents(rowSales[0].accepted_amount_minor)) anomalies.push({ moduleId: row.id, type: "plan_sale_amount_mismatch" });
}

const targetHistoricalImportIds = new Set(targetReceivables.map((row) => row.metadata?.historicalImportId).filter(Boolean));
const targetImportSessions = imports.filter((row) => targetHistoricalImportIds.has(row.id) || row.client_id === target.client_id).map((row) => ({
  id: row.id,
  status: row.status,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  containsTargetModule: targetHistoricalImportIds.has(row.id),
  remindersReenabled: row.reminders_reenabled,
  skippedReminderEvents: row.skipped_reminder_events,
}));

const report = {
  target: { projectRef: expectedRef, mode: "READ_ONLY", addOnId: targetAddOnId },
  module: target,
  proposals: targetProposals,
  sales: targetSales,
  paymentPlans: targetPlans,
  installments: targetInstallments,
  receivables: targetReceivables.map((row) => ({ ...row, metadata: { addOnId: row.metadata?.addOnId, saleId: row.metadata?.saleId, planId: row.metadata?.planId, historicalImportId: row.metadata?.historicalImportId } })),
  allocations: targetAllocations,
  payments: targetPayments.map((row) => ({ id: row.id, client_id: row.client_id, amount_minor: row.amount_minor, paid_at: row.paid_at, method: row.method, status: row.status, notify_client: row.notify_client, reversed_at: row.reversed_at, created_at: row.created_at, reference_present: Boolean(row.reference), notes_present: Boolean(row.notes), historical_import_id: row.metadata?.historicalImportId || null })),
  totals: {
    proposalAcceptedMinor: sum(targetProposals.filter((row) => row.status === "accepted"), "amount_minor"),
    saleMinor: sum(targetSales, "accepted_amount_minor"),
    activePlanMinor: sum(targetPlans.filter((row) => row.status === "active"), "planned_total_minor"),
    installmentMinor: sum(targetInstallments, "amount_minor"),
    receivableDueMinor: sum(targetReceivables.filter((row) => !row.cancelled_at), "amount_due_minor"),
    receivablePaidMinor: sum(targetReceivables.filter((row) => !row.cancelled_at), "amount_paid_minor"),
    receivableBalanceMinor: sum(targetReceivables.filter((row) => !row.cancelled_at), "balance_minor"),
    activeAllocationMinor: sum(targetAllocations.filter((row) => !row.reversed_at), "amount_minor"),
    postedPaymentMinor: sum(targetPayments.filter((row) => row.status === "posted"), "amount_minor"),
  },
  auditTrail: activities,
  historicalSessions: targetImportSessions,
  globalScan: {
    moduleCount: addOns.length,
    proposalCount: proposals.length,
    saleCount: sales.length,
    planCount: plans.length,
    receivableCount: receivables.length,
    paymentCount: payments.length,
    duplicateModuleGroups: duplicates,
    anomalies,
  },
};

console.log(JSON.stringify(report, null, 2));
