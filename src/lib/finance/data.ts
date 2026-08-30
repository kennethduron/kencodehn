import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Expense, ExpenseCategory, FinanceReportRow, FinanceSeriesPoint, FinanceSummary } from "./types";

type Row = Record<string, any>;
const text = (value: unknown) => typeof value === "string" ? value : String(value ?? "");
const nullable = (value: unknown) => typeof value === "string" && value ? value : null;
function joined(value: unknown) { return Array.isArray(value) ? value[0] : value; }

function wrapError(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return;
  const wrapped = new Error(error.message || fallback) as Error & { status?: number };
  wrapped.status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
  throw wrapped;
}

export async function listExpenseCategories(activeOnly = false): Promise<ExpenseCategory[]> {
  const client = await createSupabaseServerClient();
  let query = client.from("expense_categories").select("id,name,description,active,sort_order").order("sort_order").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query; wrapError(error, "No se pudieron consultar las categorias.");
  return ((data ?? []) as Row[]).map((row) => ({ id:text(row.id),name:text(row.name),description:text(row.description),active:Boolean(row.active),sortOrder:Number(row.sort_order) }));
}

export async function listExpenses(input: { page?: number; pageSize?: number; from?: string; to?: string; currency?: string; categoryId?: string; projectId?: string; status?: string } = {}) {
  const client = await createSupabaseServerClient();
  const page=Math.max(1,input.page??1),pageSize=Math.min(50,Math.max(1,input.pageSize??20));
  let query=client.from("expenses").select("*,expense_categories(name),projects(name)",{count:"exact"}).order("expense_date",{ascending:false}).order("created_at",{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(input.from)query=query.gte("expense_date",input.from); if(input.to)query=query.lte("expense_date",input.to);
  if(input.currency)query=query.eq("currency",input.currency); if(input.categoryId)query=query.eq("category_id",input.categoryId);
  if(input.projectId)query=query.eq("project_id",input.projectId); if(input.status)query=query.eq("status",input.status);
  const {data,error,count}=await query;wrapError(error,"No se pudieron consultar los gastos.");
  const items=((data??[]) as Row[]).map((row):Expense=>({
    id:text(row.id),categoryId:text(row.category_id),categoryName:text(joined(row.expense_categories)?.name),description:text(row.description),vendor:text(row.vendor),amountMinor:text(row.amount_minor),currency:text(row.currency),expenseDate:text(row.expense_date),paidAt:nullable(row.paid_at),paymentMethod:text(row.payment_method),reference:text(row.reference),notes:text(row.notes),projectId:nullable(row.project_id),projectName:text(joined(row.projects)?.name),status:row.status,createdBy:text(row.created_by),createdAt:text(row.created_at),reversedAt:nullable(row.reversed_at),reversalReason:text(row.reversal_reason),
  }));
  return {items,total:count??0,page,pageSize};
}

export async function financeSummary(from:string,to:string):Promise<FinanceSummary[]> {
  const client=await createSupabaseServerClient();const{data,error}=await client.rpc("finance_summary",{p_from:from,p_to:to});wrapError(error,"No se pudo calcular el resumen financiero.");
  return ((data??[]) as Row[]).map((row)=>({currency:text(row.currency),soldMinor:text(row.sold_minor),collectedMinor:text(row.collected_minor),outstandingMinor:text(row.outstanding_minor),overdueMinor:text(row.overdue_minor),recurringCollectedMinor:text(row.recurring_collected_minor),expenseMinor:text(row.expense_minor),netCashMinor:text(row.net_cash_minor)}));
}

export async function financeSeries(from:string,to:string,currency:"USD"="USD"):Promise<FinanceSeriesPoint[]> {
  const client=await createSupabaseServerClient();const{data,error}=await client.rpc("finance_monthly_series",{p_from:from,p_to:to,p_currency:currency});wrapError(error,"No se pudo calcular la serie financiera.");
  return ((data??[]) as Row[]).map((row)=>({monthStart:text(row.month_start),collectedMinor:text(row.collected_minor),expenseMinor:text(row.expense_minor)}));
}

export async function financeReport(input:{report:string;from:string;to:string;currency?:"USD";clientId?:string;projectId?:string;sellerId?:string;paymentMethod?:string;categoryId?:string;page?:number;pageSize?:number}) {
  const client=await createSupabaseServerClient();const page=Math.max(1,input.page??1),pageSize=Math.min(200,Math.max(1,input.pageSize??25));
  const {data,error}=await client.rpc("finance_report",{p_report:input.report,p_from:input.from,p_to:input.to,p_currency:"USD",p_client_id:input.clientId||null,p_project_id:input.projectId||null,p_seller_id:input.sellerId||null,p_payment_method:input.paymentMethod||null,p_category_id:input.categoryId||null,p_page:page,p_page_size:pageSize});wrapError(error,"No se pudo generar el reporte.");
  const rows=(data??[]) as Row[];const items:FinanceReportRow[]=rows.map((row)=>({occurredOn:text(row.occurred_on),recordType:text(row.record_type),party:text(row.party),concept:text(row.concept),projectName:text(row.project_name),paymentMethod:text(row.payment_method),amountMinor:text(row.amount_minor),currency:text(row.currency),status:text(row.status),sellerId:nullable(row.seller_id),recordId:text(row.record_id)}));
  return {items,total:rows[0]?Number(rows[0].total_count):0,page,pageSize};
}

export async function financeMutation(operation:string,payload:Record<string,unknown>){const client=await createSupabaseServerClient();const{data,error}=await client.rpc("finance_write",{p_operation:operation,p_payload:payload});wrapError(error,"La operacion financiera fue rechazada.");return data as Record<string,unknown>;}
