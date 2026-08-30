import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {requireAdminFromRequest} from "@/lib/admin/auth";
import {hasPermission} from "@/lib/admin/authorization";
import {addOnMutation} from "@/lib/add-ons/data";

const uuid=z.string().uuid();
const date=z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal("")]);
const minor=z.string().regex(/^[1-9][0-9]{0,15}$/);
const optionalMinor=z.string().regex(/^[0-9]{1,16}$/);
const proposal=z.object({title:z.string().trim().min(2).max(180),scope:z.string().trim().min(3).max(12000),amountMinor:minor,currency:z.literal("USD"),paymentTerms:z.string().max(4000),monthlyAddOnMinor:optionalMinor,estimatedDelivery:z.string().max(1000),validUntil:date,clientNotes:z.string().max(4000),internalNotes:z.string().max(4000)}).strict();
const schema=z.discriminatedUnion("operation",[
  z.object({operation:z.literal("module_create"),payload:z.object({clientId:uuid,projectId:uuid,name:z.string().trim().min(2).max(180),description:z.string().max(8000),requestDate:date,requestedByClient:z.boolean(),currency:z.literal("USD"),sellerId:z.union([uuid,z.literal("")]).optional(),notes:z.string().max(4000)}).strict()}).strict(),
  z.object({operation:z.literal("proposal_create"),payload:proposal.extend({addOnId:uuid}).strict()}).strict(),
  z.object({operation:z.literal("proposal_update"),payload:proposal.extend({proposalId:uuid}).strict()}).strict(),
  z.object({operation:z.enum(["proposal_mark_sent","proposal_accept","proposal_reject"]),payload:z.object({proposalId:uuid,decisionNotes:z.string().max(4000).optional(),effectiveDate:date.optional()}).strict()}).strict(),
  z.object({operation:z.literal("payment_plan_save"),payload:z.object({saleId:uuid,planId:z.union([uuid,z.literal("")]).optional(),name:z.string().trim().min(2).max(140),currency:z.literal("USD"),installments:z.array(z.object({sequence:z.number().int().min(1).max(100),label:z.string().trim().min(1).max(180),amountMinor:minor,currency:z.literal("USD"),dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),dueTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal("")),notes:z.string().max(1000)}).strict()).min(1).max(100)}).strict()}).strict(),
  z.object({operation:z.literal("payment_plan_activate"),payload:z.object({planId:uuid}).strict()}).strict(),
  z.object({operation:z.literal("recurring_configure"),payload:z.object({saleId:uuid,id:z.union([uuid,z.literal("")]).optional(),name:z.string().trim().min(2).max(180),monthlyAmountMinor:minor,currency:z.literal("USD"),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),billingDay:z.number().int().min(1).max(28),billingTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),status:z.enum(["draft","active","paused","cancelled"])}).strict()}).strict(),
  z.object({operation:z.literal("work_status_update"),payload:z.object({addOnId:uuid,status:z.enum(["pending","scheduled","in_progress","ready","delivered"]),plannedStartDate:date.optional(),targetDeliveryDate:date.optional(),actualDeliveryDate:date.optional(),notes:z.string().max(4000)}).strict()}).strict(),
  z.object({operation:z.literal("module_assign"),payload:z.object({addOnId:uuid,sellerId:z.union([uuid,z.literal("")]),reason:z.string().trim().min(2).max(1000)}).strict()}).strict(),
]);

export async function POST(request:NextRequest){
  const admin=await requireAdminFromRequest(request);
  if(!admin)return NextResponse.json({error:"No autorizado."},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Datos de modulo invalidos."},{status:400});
  const op=parsed.data.operation;
  const approval=["proposal_mark_sent","proposal_accept","proposal_reject","payment_plan_save","payment_plan_activate","recurring_configure","work_status_update","module_assign"].includes(op);
  const permission=approval?"modules:manage":op==="module_create"||op.startsWith("proposal_")?"modules:draft":"modules:view";
  if(!hasPermission(admin,permission))return NextResponse.json({error:"No tienes permiso para esta operacion comercial."},{status:403});
  if((op==="proposal_accept"||op==="proposal_reject")&&!hasPermission(admin,"module_proposals:approve"))return NextResponse.json({error:"Solo Owner o Admin puede decidir una propuesta."},{status:403});
  try{return NextResponse.json({ok:true,result:await addOnMutation(op,parsed.data.payload)});}
  catch(error){const status=typeof error==="object"&&error&&"status" in error?Number(error.status):400;return NextResponse.json({error:status===403?"Operacion no autorizada.":status===404?"Modulo no encontrado.":"La operacion fue rechazada para proteger la integridad comercial."},{status});}
}
