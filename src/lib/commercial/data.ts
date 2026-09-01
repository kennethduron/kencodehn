import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CommercialActivity,
  CommercialClient,
  CommercialProject,
  ProjectInstallment,
  ProjectPaymentPlan,
  ProjectRecurringService,
  SellerAssignmentEvent,
} from "./types";

type Row = Record<string, any>;

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function nullableText(value: unknown) { return typeof value === "string" ? value : null; }

export function mapClient(row: Row): CommercialClient {
  return {
    id: String(row.id), clientNumber: text(row.client_number), kind: row.kind, originLeadId: nullableText(row.origin_lead_id), name: text(row.name), company: text(row.company), email: text(row.email), billingEmail: text(row.billing_email), billingNotificationsEnabled: Boolean(row.billing_notifications_enabled), paymentConfirmationEnabled: Boolean(row.payment_confirmation_enabled), billingLocale: row.billing_locale === "en" ? "en" : "es", billingTimezone: "America/Tegucigalpa", phone: text(row.phone), whatsapp: text(row.whatsapp), country: text(row.country), region: text(row.region), city: text(row.city), address: text(row.address),
    status: row.status, clientSince: text(row.client_since), notes: text(row.notes), tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    assignedToUid: nullableText(row.assigned_to), assignedAt: nullableText(row.assigned_at), createdByUid: text(row.created_by), createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}

export function mapProject(row: Row): CommercialProject {
  return {
    id: String(row.id), clientId: String(row.client_id), name: text(row.name), description: text(row.description), status: row.status,
    totalAmountMinor: String(row.total_amount_minor ?? "0"), currency: text(row.currency), soldAt: nullableText(row.sold_at), effectiveDate: text(row.effective_date), startDate: nullableText(row.start_date), targetEndDate: nullableText(row.target_end_date),
    completedAt: nullableText(row.completed_at), assignedToUid: nullableText(row.assigned_to), assignedAt: nullableText(row.assigned_at), createdByUid: text(row.created_by),
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}

function mapInstallment(row: Row): ProjectInstallment {
  return { id: String(row.id), paymentPlanId: String(row.payment_plan_id), sequence: Number(row.sequence), label: text(row.label), amountMinor: String(row.amount_minor ?? "0"), currency: text(row.currency), dueDate: nullableText(row.due_date), dueTime: nullableText(row.due_time)?.slice(0,5) ?? null, notes: text(row.notes) };
}

function mapActivity(row: Row): CommercialActivity {
  return { id: String(row.id), entityType: text(row.entity_type), action: text(row.action), title: text(row.title), description: text(row.description), actorId: nullableText(row.actor_id), actorEmail: text(row.actor_email), createdAt: text(row.created_at) };
}

async function rows(query: any) {
  const { data, error } = await query;
  if (error) throw new Error(`Commercial data query failed (${error.code ?? "unknown"}).`);
  return (data ?? []) as Row[];
}

export async function listCommercialClients() {
  const client = await createSupabaseServerClient();
  return (await rows(client.from("clients").select("*").order("client_since", { ascending: false }).order("created_at", { ascending: false }))).map(mapClient);
}

export async function getCommercialClient(id: string) {
  const client = await createSupabaseServerClient();
  const [clientRows, projectRows, taskRows, activityRows, assignmentRows] = await Promise.all([
    rows(client.from("clients").select("*").eq("id", id).limit(1)),
    rows(client.from("projects").select("*").eq("client_id", id).order("created_at", { ascending: false })),
    rows(client.from("tasks").select("id,title,status,priority,due_at,assigned_to").eq("client_id", id).order("created_at", { ascending: false })),
    rows(client.from("activity_logs").select("id,entity_type,action,title,description,actor_id,actor_email,created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(150)),
    rows(client.from("seller_assignment_events").select("*").eq("client_id", id).order("created_at", { ascending: false })),
  ]);
  if (!clientRows[0]) return null;
  return {
    client: mapClient(clientRows[0]),
    projects: projectRows.map(mapProject),
    tasks: taskRows,
    activity: activityRows.map(mapActivity),
    assignments: assignmentRows.map((row): SellerAssignmentEvent => ({
      id: String(row.id), entityType: row.entity_type, previousSellerId: nullableText(row.previous_seller_id), newSellerId: nullableText(row.new_seller_id), actorId: String(row.actor_id), actorEmail: text(row.actor_email), reason: text(row.reason), createdAt: text(row.created_at),
    })),
  };
}

export async function listCommercialProjects() {
  const client = await createSupabaseServerClient();
  const [projectRows, clientRows] = await Promise.all([
    rows(client.from("projects").select("*").order("created_at", { ascending: false })),
    rows(client.from("clients").select("id,name,company")),
  ]);
  const clientNames = new Map(clientRows.map((row) => [String(row.id), text(row.company) || text(row.name)]));
  return projectRows.map((row) => ({ ...mapProject(row), clientName: clientNames.get(String(row.client_id)) ?? "Cliente" }));
}

export async function getCommercialProject(id: string) {
  const client = await createSupabaseServerClient();
  const [projectRows, planRows, installmentRows, recurringRows, activityRows, assignmentRows] = await Promise.all([
    rows(client.from("projects").select("*").eq("id", id).limit(1)),
    rows(client.from("project_payment_plans").select("*").eq("project_id", id).order("version", { ascending: false })),
    rows(client.from("project_installments").select("*").order("sequence", { ascending: true })),
    rows(client.from("project_recurring_services").select("*").eq("project_id", id).limit(1)),
    rows(client.from("activity_logs").select("id,entity_type,action,title,description,actor_id,actor_email,created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(150)),
    rows(client.from("seller_assignment_events").select("*").eq("project_id", id).order("created_at", { ascending: false })),
  ]);
  if (!projectRows[0]) return null;
  const project = mapProject(projectRows[0]);
  const relevantInstallments = installmentRows.filter((row) => planRows.some((plan) => plan.id === row.payment_plan_id));
  const plans: ProjectPaymentPlan[] = planRows.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), version: Number(row.version), name: text(row.name), status: row.status,
    plannedTotalMinor: String(row.planned_total_minor ?? "0"), currency: text(row.currency), activatedAt: nullableText(row.activated_at), createdAt: text(row.created_at),
    installments: relevantInstallments.filter((item) => item.payment_plan_id === row.id).map(mapInstallment),
  }));
  const recurring: ProjectRecurringService | null = recurringRows[0] ? {
    id: String(recurringRows[0].id), projectId: String(recurringRows[0].project_id), name: text(recurringRows[0].name), monthlyAmountMinor: String(recurringRows[0].monthly_amount_minor),
    currency: text(recurringRows[0].currency), frequency: recurringRows[0].frequency, startDate: text(recurringRows[0].start_date), billingDay: Number(recurringRows[0].billing_day),
    billingTime: text(recurringRows[0].billing_time).slice(0, 5), timezone: text(recurringRows[0].timezone), status: recurringRows[0].status,
  } : null;
  return {
    project, plans, recurring, activity: activityRows.map(mapActivity),
    assignments: assignmentRows.map((row): SellerAssignmentEvent => ({ id: String(row.id), entityType: row.entity_type, previousSellerId: nullableText(row.previous_seller_id), newSellerId: nullableText(row.new_seller_id), actorId: String(row.actor_id), actorEmail: text(row.actor_email), reason: text(row.reason), createdAt: text(row.created_at) })),
  };
}

export async function commercialMutation(operation: string, payload: Record<string, unknown>) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("commercial_write", { p_operation: operation, p_payload: payload });
  if (error) {
    const wrapped = new Error(error.message || "Commercial mutation failed.") as Error & { status?: number };
    wrapped.status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    throw wrapped;
  }
  return (data ?? {}) as Record<string, unknown>;
}

export type ClientFinancialOverview = {
  originalProjectsMinor: string;
  additionalSalesMinor: string;
  lifetimeSoldMinor: string;
  collectedMinor: string;
  outstandingMinor: string;
  baseMonthlyMinor: string;
  addOnMonthlyMinor: string;
  monthlyCommitmentMinor: string;
  currency: "USD";
};

export async function getClientFinancialOverview(clientId: string): Promise<ClientFinancialOverview> {
  const client = await createSupabaseServerClient();
  const [projectsResult, salesResult, paymentsResult, receivablesResult, baseResult, addOnResult] = await Promise.all([
    client.from("projects").select("total_amount_minor,status").eq("client_id", clientId),
    client.from("add_on_sales").select("accepted_amount_minor").eq("client_id", clientId),
    client.from("payments").select("amount_minor,status").eq("client_id", clientId),
    client.from("receivables").select("balance_minor,payment_state").eq("client_id", clientId),
    client.from("project_recurring_services").select("monthly_amount_minor,status,projects!inner(client_id)").eq("projects.client_id", clientId),
    client.from("add_on_recurring_services").select("monthly_amount_minor,status,add_on_sales!inner(client_id)").eq("add_on_sales.client_id", clientId),
  ]);
  const failed = [projectsResult, salesResult, paymentsResult, receivablesResult, baseResult, addOnResult].find((result) => result.error);
  if (failed?.error) throw new Error("No se pudo calcular el resumen financiero del cliente.");
  const sum = (values: unknown[]) => values.reduce<bigint>((total, value) => total + BigInt(String(value ?? "0")), BigInt(0));
  const original = sum(((projectsResult.data ?? []) as Row[]).filter((row) => row.status !== "cancelled").map((row) => row.total_amount_minor));
  const additions = sum(((salesResult.data ?? []) as Row[]).map((row) => row.accepted_amount_minor));
  const collected = sum(((paymentsResult.data ?? []) as Row[]).filter((row) => row.status === "posted").map((row) => row.amount_minor));
  const outstanding = sum(((receivablesResult.data ?? []) as Row[]).filter((row) => row.payment_state === "open" || row.payment_state === "partially_paid").map((row) => row.balance_minor));
  const baseMonthly = sum(((baseResult.data ?? []) as Row[]).filter((row) => row.status === "active").map((row) => row.monthly_amount_minor));
  const addOnMonthly = sum(((addOnResult.data ?? []) as Row[]).filter((row) => row.status === "active").map((row) => row.monthly_amount_minor));
  return {
    originalProjectsMinor: original.toString(),
    additionalSalesMinor: additions.toString(),
    lifetimeSoldMinor: (original + additions).toString(),
    collectedMinor: collected.toString(),
    outstandingMinor: outstanding.toString(),
    baseMonthlyMinor: baseMonthly.toString(),
    addOnMonthlyMinor: addOnMonthly.toString(),
    monthlyCommitmentMinor: (baseMonthly + addOnMonthly).toString(),
    currency: "USD",
  };
}
