import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { financialMutation } from "@/lib/billing/data";

const uuid=z.string().uuid();
const minor=z.string().regex(/^[1-9][0-9]{0,15}$/);
const requestSchema=z.discriminatedUnion("operation",[
  z.object({operation:z.literal("payment_post"),payload:z.object({clientId:uuid,currency:z.literal("USD").optional().default("USD"),amountMinor:minor,paidAt:z.string().datetime({offset:true}),method:z.enum(["bank_transfer","cash","card","paypal","other"]),reference:z.string().max(240),notes:z.string().max(4000),notifyClient:z.boolean(),allocations:z.array(z.object({receivableId:uuid,amountMinor:minor}).strict()).min(1).max(100)}).strict()}).strict(),
  z.object({operation:z.literal("payment_reverse"),payload:z.object({id:uuid,reason:z.string().trim().min(3).max(1000)}).strict()}).strict(),
  z.object({operation:z.literal("receivable_cancel"),payload:z.object({id:uuid,reason:z.string().trim().min(3).max(1000)}).strict()}).strict(),
  z.object({operation:z.literal("client_billing_settings_update"),payload:z.object({clientId:uuid,billingEmail:z.union([z.string().email(),z.literal("")]),billingNotificationsEnabled:z.boolean(),paymentConfirmationEnabled:z.boolean(),locale:z.enum(["es","en"]),timezone:z.literal("America/Tegucigalpa")}).strict()}).strict(),
]);

export async function POST(request:NextRequest){
  const admin=await requireAdminFromRequest(request);if(!admin)return NextResponse.json({error:"No autorizado."},{status:401});
  const parsed=requestSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Datos financieros inválidos."},{status:400});
  const permission=parsed.data.operation==="client_billing_settings_update"
    ?"billing_settings:manage"
    :parsed.data.operation==="payment_reverse"||parsed.data.operation==="receivable_cancel"
      ?"financial:reverse"
      :"payments:manage";
  if(!hasPermission(admin,permission))return NextResponse.json({error:"No tienes permiso para modificar información financiera."},{status:403});
  try{return NextResponse.json({ok:true,result:await financialMutation(parsed.data.operation,parsed.data.payload)});}catch(error){const status=typeof error==="object"&&error&&"status" in error?Number(error.status):400;return NextResponse.json({error:status===403?"Operación financiera no autorizada.":status===404?"Registro financiero no encontrado.":"La operación fue rechazada para proteger la integridad financiera."},{status});}
}
