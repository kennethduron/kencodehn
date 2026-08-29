import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail, type EmailType } from "@/lib/email/service";
import { billingTemplate, type BillingTemplateType } from "./templates";

type Row=Record<string,any>;
const text=(value:unknown)=>typeof value==="string"?value:String(value??"");

async function complete(kind:"reminder"|"email",id:string,workerId:string,sent:boolean,providerId?:string|null,errorCategory?:string|null){
  const client=createSupabaseAdminClient();const{error}=await client.rpc("billing_complete_event",{p_kind:kind,p_event_id:id,p_worker_id:workerId,p_sent:sent,p_provider_message_id:providerId??null,p_error_category:errorCategory??null});if(error)throw new Error(`Billing completion failed (${error.code??"unknown"}).`);
}

async function deliverReminder(row:Row,workerId:string){
  const type=row.event_type as BillingTemplateType;const template=billingTemplate({type,locale:row.locale==="en"?"en":"es",clientName:text(row.client_name),projectName:text(row.project_name),description:text(row.description),amountMinor:text(row.amount_due_minor),paidMinor:text(row.amount_paid_minor),balanceMinor:text(row.balance_minor),currency:text(row.currency),dueDate:text(row.due_date),dueTime:row.due_time?text(row.due_time).slice(0,5):null});
  const result=await sendEmail({...template,type:type as EmailType,to:text(row.recipient),relatedClientId:text(row.client_id),relatedProjectId:text(row.project_id),relatedReceivableId:text(row.receivable_id),idempotencyKey:text(row.deterministic_key)});
  await complete("reminder",text(row.event_id),workerId,result.sent,result.id,result.reason??null);return result.sent;
}

async function deliverQueuedEmail(event:Row,workerId:string){
  const client=createSupabaseAdminClient();let input:Parameters<typeof billingTemplate>[0];
  if(event.event_type==="payment_received"){
    const[{data:payment,error:paymentError},{data:receivables,error:receivableError},{data:clientRow,error:clientError}]=await Promise.all([
      client.from("payments").select("amount_minor,currency,paid_at").eq("id",event.payment_id).single(),
      client.from("receivables").select("balance_minor,currency").eq("client_id",event.client_id).neq("payment_state","cancelled"),
      client.from("clients").select("name,company").eq("id",event.client_id).single(),
    ]);if(paymentError||receivableError||clientError)throw new Error("Billing payment email data unavailable.");
    const balance=(receivables??[]).filter(r=>r.currency===payment.currency).reduce((sum,r)=>sum+BigInt(text(r.balance_minor)),BigInt(0));
    input={type:"payment_received",locale:event.locale==="en"?"en":"es",clientName:text(clientRow.company)||text(clientRow.name),amountMinor:text(payment.amount_minor),balanceMinor:balance.toString(),currency:text(payment.currency)};
  }else{
    const[{data:project,error:projectError},{data:clientRow,error:clientError},{data:installments,error:installmentError}]=await Promise.all([
      client.from("projects").select("name,total_amount_minor,currency").eq("id",event.project_id).single(),
      client.from("clients").select("name,company").eq("id",event.client_id).single(),
      client.from("project_installments").select("label,amount_minor,due_date,due_time").eq("payment_plan_id",event.payment_plan_id).order("sequence"),
    ]);if(projectError||clientError||installmentError)throw new Error("Billing schedule email data unavailable.");
    input={type:event.event_type,locale:event.locale==="en"?"en":"es",clientName:text(clientRow.company)||text(clientRow.name),projectName:text(project.name),amountMinor:text(project.total_amount_minor),balanceMinor:text(project.total_amount_minor),currency:text(project.currency),installments:(installments??[]).map(item=>({label:text(item.label),amountMinor:text(item.amount_minor),dueDate:text(item.due_date),dueTime:item.due_time?text(item.due_time).slice(0,5):null}))};
  }
  const template=billingTemplate(input);const result=await sendEmail({...template,type:event.event_type as EmailType,to:text(event.recipient),relatedClientId:text(event.client_id),relatedProjectId:event.project_id?text(event.project_id):null,relatedPaymentId:event.payment_id?text(event.payment_id):null,idempotencyKey:text(event.deterministic_key)});
  await complete("email",text(event.id),workerId,result.sent,result.id,result.reason??null);return result.sent;
}

export async function runBillingDelivery(){
  const client=createSupabaseAdminClient();const workerId=crypto.randomUUID();const runId=crypto.randomUUID();const started=Date.now();let processed=0,sent=0,failed=0,skipped=0;
  const{error:startAuditError}=await client.from("billing_job_runs").insert({id:runId,job_type:"delivery",source:"supabase_cron",status:"running"});
  if(startAuditError)throw new Error("Billing job audit start failed.");
  try{
    const[{data:reminders,error:reminderError},{data:emails,error:emailError}]=await Promise.all([client.rpc("billing_claim_reminders",{p_worker_id:workerId,p_limit:50,p_now:new Date().toISOString()}),client.rpc("billing_claim_emails",{p_worker_id:workerId,p_limit:25,p_now:new Date().toISOString()})]);
    if(reminderError||emailError)throw new Error("Billing claim failed.");
    for(const row of (reminders??[]) as Row[]){processed++;try{if(await deliverReminder(row,workerId))sent++;else failed++;}catch{failed++;await complete("reminder",text(row.event_id),workerId,false,null,"delivery_exception").catch(()=>{});}}
    for(const event of (emails??[]) as Row[]){processed++;try{if(await deliverQueuedEmail(event,workerId))sent++;else failed++;}catch{failed++;await complete("email",text(event.id),workerId,false,null,"delivery_exception").catch(()=>{});}}
    const{error:successAuditError}=await client.from("billing_job_runs").update({status:"succeeded",processed,sent,failed,skipped,finished_at:new Date().toISOString(),duration_ms:Date.now()-started}).eq("id",runId);
    if(successAuditError)throw new Error("Billing job audit completion failed.");
    return{processed,sent,failed,skipped};
  }catch(error){const{error:failureAuditError}=await client.from("billing_job_runs").update({status:"failed",processed,sent,failed,skipped,error_category:error instanceof Error?error.name:"unknown",finished_at:new Date().toISOString(),duration_ms:Date.now()-started}).eq("id",runId);if(failureAuditError)throw new Error("Billing job failure audit failed.",{cause:error});throw error;}
}
