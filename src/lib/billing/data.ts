import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { todayInHonduras } from "@/lib/time";
import type { BillingPayment, BillingReceivable, BillingRule, ProjectBillingSummary, ReceivableTiming } from "./types";

type Row = Record<string, any>;
const text = (value: unknown) => typeof value === "string" ? value : String(value ?? "");
const nullable = (value: unknown) => typeof value === "string" && value ? value : null;

function timing(row: Row): ReceivableTiming {
  if (row.payment_state === "paid" || row.payment_state === "cancelled") return "settled";
  const today = todayInHonduras();
  if (text(row.due_date) < today) return "overdue";
  if (text(row.due_date) === today) return "due_today";
  return "upcoming";
}

function mapReceivable(row: Row): BillingReceivable {
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
  return {
    id:text(row.id),clientId:text(row.client_id),clientName:text(row.client_name)||text(client?.company)||text(client?.name),projectId:text(row.project_id),projectName:text(row.project_name)||text(project?.name),sellerId:nullable(row.seller_id)??nullable(project?.assigned_to),originType:row.origin_type,
    description:text(row.description),amountDueMinor:text(row.amount_due_minor),amountPaidMinor:text(row.amount_paid_minor),balanceMinor:text(row.balance_minor),currency:text(row.currency),dueDate:text(row.due_date),dueTime:nullable(row.due_time)?.slice(0,5)??null,dueAt:nullable(row.due_at),paymentState:row.payment_state,timingState:(row.timing_state as ReceivableTiming|undefined)??timing(row),notificationsEnabled:Boolean(row.notifications_enabled),
  };
}

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(`Billing query failed (${error.code ?? "unknown"}).`);
  return data;
}

export async function listReceivables(input: { page?: number; pageSize?: number; state?: string; timing?: string; origin?: string; currency?: string; clientId?: string; projectId?: string } = {}) {
  const client = await createSupabaseServerClient();
  const page=Math.max(1,input.page??1),pageSize=Math.min(50,Math.max(1,input.pageSize??20));
  const {data,error}=await client.rpc("billing_list_receivables",{p_page:page,p_page_size:pageSize,p_payment_state:input.state??null,p_timing_state:input.timing??null,p_origin_type:input.origin??null,p_currency:input.currency??null,p_client_id:input.clientId??null,p_project_id:input.projectId??null});
  if(error) throw new Error(`Billing receivables query failed (${error.code??"unknown"}).`);
  const rows=(data??[]) as Row[];const items=rows.map(mapReceivable);
  return {items,total:rows[0]?Number(rows[0].total_count):0,page,pageSize};
}

export type BillingSummaryGroup = { currency:string;dueToday:string;next7:string;overdue:string;outstanding:string;collectedMonth:string };

export async function billingSummary():Promise<BillingSummaryGroup[]> {
  const client=await createSupabaseServerClient();
  const [receivables,payments]=await Promise.all([
    unwrap(client.from("receivables").select("amount_due_minor,amount_paid_minor,balance_minor,currency,due_date,payment_state").eq("currency","USD")),
    unwrap(client.from("payments").select("amount_minor,currency,paid_at,status").eq("status","posted").eq("currency","USD")),
  ]);
  const today=todayInHonduras(); const next=new Date(`${today}T12:00:00Z`); next.setUTCDate(next.getUTCDate()+7); const next7=next.toISOString().slice(0,10);
  const value={dueToday:BigInt(0),next7:BigInt(0),overdue:BigInt(0),outstanding:BigInt(0),collectedMonth:BigInt(0)};
  for(const row of (receivables??[]) as Row[]){if(row.payment_state==="cancelled")continue;const balance=BigInt(text(row.balance_minor));value.outstanding+=balance;if(row.payment_state!=="paid"){if(row.due_date===today)value.dueToday+=balance;else if(row.due_date<today)value.overdue+=balance;else if(row.due_date<=next7)value.next7+=balance;}}
  const month=today.slice(0,7);for(const row of (payments??[]) as Row[]){if(text(row.paid_at).slice(0,7)===month)value.collectedMonth+=BigInt(text(row.amount_minor));}
  return [{
    currency:"USD",
    dueToday:value.dueToday.toString(),
    next7:value.next7.toString(),
    overdue:value.overdue.toString(),
    outstanding:value.outstanding.toString(),
    collectedMonth:value.collectedMonth.toString(),
  }];
}

export async function listPayments(clientId?:string):Promise<BillingPayment[]> {
  const client=await createSupabaseServerClient();
  let query=client.from("payments").select("*,clients!inner(name,company),payment_allocations(id,receivable_id,amount_minor,reversed_at,receivables(description))").order("paid_at",{ascending:false}).limit(100);
  if(clientId)query=query.eq("client_id",clientId);
  const data=await unwrap(query);
  return ((data??[]) as Row[]).map(row=>{const c=Array.isArray(row.clients)?row.clients[0]:row.clients;return{id:text(row.id),clientId:text(row.client_id),clientName:text(c?.company)||text(c?.name),amountMinor:text(row.amount_minor),currency:text(row.currency),paidAt:text(row.paid_at),method:row.method,reference:text(row.reference),notes:text(row.notes),status:row.status,recordedBy:text(row.recorded_by),reversedAt:nullable(row.reversed_at),reversalReason:text(row.reversal_reason),allocations:(row.payment_allocations??[]).map((a:Row)=>({id:text(a.id),receivableId:text(a.receivable_id),amountMinor:text(a.amount_minor),description:text((Array.isArray(a.receivables)?a.receivables[0]:a.receivables)?.description),reversedAt:nullable(a.reversed_at)}))}});
}

export async function listPaymentsPage(input:{page?:number;pageSize?:number;currency?:string;status?:string;clientId?:string}={}){
  const client=await createSupabaseServerClient();const page=Math.max(1,input.page??1),pageSize=Math.min(50,Math.max(1,input.pageSize??20));
  let query=client.from("payments").select("*,clients!inner(name,company),payment_allocations(id,receivable_id,amount_minor,reversed_at,receivables(description))",{count:"exact"}).order("paid_at",{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(input.clientId)query=query.eq("client_id",input.clientId);if(input.currency)query=query.eq("currency",input.currency);if(input.status)query=query.eq("status",input.status);
  const {data,error,count}=await query;if(error)throw new Error(`Billing payments query failed (${error.code??"unknown"}).`);
  const items=((data??[]) as Row[]).map(row=>{const c=Array.isArray(row.clients)?row.clients[0]:row.clients;return{id:text(row.id),clientId:text(row.client_id),clientName:text(c?.company)||text(c?.name),amountMinor:text(row.amount_minor),currency:text(row.currency),paidAt:text(row.paid_at),method:row.method,reference:text(row.reference),notes:text(row.notes),status:row.status,recordedBy:text(row.recorded_by),reversedAt:nullable(row.reversed_at),reversalReason:text(row.reversal_reason),allocations:(row.payment_allocations??[]).map((a:Row)=>({id:text(a.id),receivableId:text(a.receivable_id),amountMinor:text(a.amount_minor),description:text((Array.isArray(a.receivables)?a.receivables[0]:a.receivables)?.description),reversedAt:nullable(a.reversed_at)}))} as BillingPayment;});
  return {items,total:count??0,page,pageSize};
}

export async function getReceivable(id:string){const client=await createSupabaseServerClient();const data=await unwrap(client.from("receivables").select("*,clients!inner(name,company),projects!inner(name,assigned_to)").eq("id",id).limit(1));const row=(data as Row[]|null)?.[0];return row?mapReceivable(row):null;}

export async function getPayment(id:string){
  const client=await createSupabaseServerClient();
  const data=await unwrap(client.from("payments").select("*,clients!inner(name,company),payment_allocations(id,receivable_id,amount_minor,reversed_at,receivables(description))").eq("id",id).limit(1));
  const row=((data??[]) as Row[])[0];if(!row)return null;const c=Array.isArray(row.clients)?row.clients[0]:row.clients;
  return{id:text(row.id),clientId:text(row.client_id),clientName:text(c?.company)||text(c?.name),amountMinor:text(row.amount_minor),currency:text(row.currency),paidAt:text(row.paid_at),method:row.method,reference:text(row.reference),notes:text(row.notes),status:row.status,recordedBy:text(row.recorded_by),reversedAt:nullable(row.reversed_at),reversalReason:text(row.reversal_reason),allocations:(row.payment_allocations??[]).map((a:Row)=>({id:text(a.id),receivableId:text(a.receivable_id),amountMinor:text(a.amount_minor),description:text((Array.isArray(a.receivables)?a.receivables[0]:a.receivables)?.description),reversedAt:nullable(a.reversed_at)}))} as BillingPayment;
}

export async function getProjectBillingSummary(projectId:string):Promise<ProjectBillingSummary|null>{
  const client=await createSupabaseServerClient();const data=await unwrap(client.from("project_financial_summary").select("*").eq("project_id",projectId).limit(1));const row=(data as Row[]|null)?.[0];
  return row?{projectId:text(row.project_id),totalMinor:text(row.total_amount_minor),paidMinor:text(row.paid_minor),outstandingMinor:text(row.outstanding_minor),currency:text(row.currency)}:null;
}

export async function listBillingRules():Promise<BillingRule[]>{const client=await createSupabaseServerClient();const data=await unwrap(client.from("billing_reminder_rules").select("*").order("offset_days",{ascending:false}));return ((data??[]) as Row[]).map(row=>({id:text(row.id),name:text(row.name),eventType:text(row.event_type),offsetDays:Number(row.offset_days),direction:text(row.direction),sendTime:text(row.send_time).slice(0,5),dueTimeOnly:Boolean(row.due_time_only),enabled:Boolean(row.enabled)}));}

export async function financialMutation(operation:string,payload:Record<string,unknown>){const client=await createSupabaseServerClient();const{data,error}=await client.rpc("financial_write",{p_operation:operation,p_payload:payload});if(error){const wrapped=new Error(error.message||"Financial mutation failed") as Error&{status?:number};wrapped.status=error.code==="42501"?403:error.code==="P0002"?404:400;throw wrapped;}return data as Record<string,unknown>;}
export async function billingRuleMutation(id:string,enabled:boolean,sendTime:string){const client=await createSupabaseServerClient();const{data,error}=await client.rpc("billing_rule_write",{p_rule_id:id,p_enabled:enabled,p_send_time:sendTime});if(error)throw new Error("Billing rule update failed");return data;}
