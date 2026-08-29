import { formatMinor } from "./money";

export type BillingTemplateType = "payment_schedule_created"|"payment_schedule_updated"|"payment_due_7_days"|"payment_due_3_days"|"payment_due_today"|"payment_due_time"|"payment_overdue_1_day"|"payment_received";
export type BillingTemplateInput={type:BillingTemplateType;locale:"es"|"en";clientName:string;projectName?:string;description?:string;amountMinor:string;paidMinor?:string;balanceMinor:string;currency:string;dueDate?:string;dueTime?:string|null;installments?:Array<{label:string;amountMinor:string;dueDate:string;dueTime?:string|null}>};
const esc=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]??char));

export function billingTemplate(input:BillingTemplateInput){
  const es=input.locale!=="en";const amount=formatMinor(input.amountMinor,input.currency,es?"es-HN":"en-US");const balance=formatMinor(input.balanceMinor,input.currency,es?"es-HN":"en-US");
  const labels:Record<BillingTemplateType,[string,string]>={
    payment_schedule_created:["Calendario de pagos de Ken Code","Your Ken Code payment schedule"],payment_schedule_updated:["Calendario de pagos actualizado","Updated payment schedule"],
    payment_due_7_days:["Pago próximo en 7 días","Payment due in 7 days"],payment_due_3_days:["Pago próximo en 3 días","Payment due in 3 days"],payment_due_today:["Pago programado para hoy","Payment due today"],payment_due_time:["Hora de pago programada","Scheduled payment time"],payment_overdue_1_day:["Pago vencido","Overdue payment"],payment_received:["Pago recibido por Ken Code","Payment received by Ken Code"],
  };
  const subject=labels[input.type][es?0:1];
  const schedule=input.installments?.length?`<div style="margin:24px 0">${input.installments.map(item=>`<div style="padding:12px 0;border-bottom:1px solid #e2e8f0"><strong>${esc(item.label)}</strong><br>${esc(item.dueDate)}${item.dueTime?` · ${esc(item.dueTime)}`:""} — ${esc(formatMinor(item.amountMinor,input.currency,es?"es-HN":"en-US"))}</div>`).join("")}</div>`:"";
  const body=es?`Hola ${esc(input.clientName)},<br><br>${input.type==="payment_received"?`Confirmamos la recepción de ${esc(amount)}.`:`Le compartimos una actualización de cobro para ${esc(input.projectName||input.description||"su servicio")}.`}<br><br><strong>Saldo pendiente: ${esc(balance)}</strong>${input.dueDate?`<br>Fecha: ${esc(input.dueDate)}${input.dueTime?` · ${esc(input.dueTime)}`:""}`:""}${schedule}`:`Hello ${esc(input.clientName)},<br><br>${input.type==="payment_received"?`We confirm receipt of ${esc(amount)}.`:`Here is a billing update for ${esc(input.projectName||input.description||"your service")}.`}<br><br><strong>Outstanding balance: ${esc(balance)}</strong>${input.dueDate?`<br>Due: ${esc(input.dueDate)}${input.dueTime?` · ${esc(input.dueTime)}`:""}`:""}${schedule}`;
  const html=`<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:auto;padding:28px 18px"><div style="background:#fff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden"><div style="background:#123052;color:#fff;padding:22px 26px"><strong style="font-size:22px">Ken Code</strong><div style="color:#67e8f9;margin-top:5px">${esc(subject)}</div></div><div style="padding:26px;line-height:1.65">${body}<p style="margin-top:28px;color:#475569">${es?"Si tiene preguntas, responda a este correo.":"Reply to this email if you have any questions."}</p></div></div></div></body></html>`;
  const text=html.replace(/<br\s*\/?\s*>/gi,"\n").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
  return{subject,text,html};
}
