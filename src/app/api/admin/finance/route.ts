import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { hasPermission,type AdminPermission } from "@/lib/admin/authorization";
import { financeMutation } from "@/lib/finance/data";

const uuid=z.string().uuid(),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/),minor=z.string().regex(/^[1-9][0-9]{0,15}$/);
const schema=z.discriminatedUnion("operation",[
  z.object({operation:z.literal("category_create"),payload:z.object({name:z.string().trim().min(2).max(80),description:z.string().max(500),sortOrder:z.number().int().min(0).max(10000)}).strict()}).strict(),
  z.object({operation:z.literal("category_update"),payload:z.object({id:uuid,name:z.string().trim().min(2).max(80),description:z.string().max(500),active:z.boolean(),sortOrder:z.number().int().min(0).max(10000)}).strict()}).strict(),
  z.object({operation:z.literal("expense_create"),payload:z.object({categoryId:uuid,description:z.string().trim().min(2).max(240),vendor:z.string().max(200),amountMinor:minor,currency:z.enum(["USD","HNL"]),expenseDate:date,paidAt:z.union([z.string().datetime({offset:true}),z.literal("")]),paymentMethod:z.enum(["bank_transfer","cash","card","paypal","other"]),reference:z.string().max(240),notes:z.string().max(4000),projectId:z.union([uuid,z.literal("")])}).strict()}).strict(),
  z.object({operation:z.literal("expense_reverse"),payload:z.object({id:uuid,reason:z.string().trim().min(3).max(1000)}).strict()}).strict(),
]);
const permissions:Record<string,AdminPermission>={category_create:"expenses:create",category_update:"expenses:create",expense_create:"expenses:create",expense_reverse:"expenses:reverse"};
export async function POST(request:NextRequest){const admin=await requireAdminFromRequest(request);if(!admin)return NextResponse.json({error:"No autorizado."},{status:401});const body=schema.safeParse(await request.json().catch(()=>null));if(!body.success)return NextResponse.json({error:"Los datos del gasto no son validos."},{status:400});if(!hasPermission(admin,permissions[body.data.operation]))return NextResponse.json({error:"No tienes permiso para esta accion financiera."},{status:403});try{return NextResponse.json({ok:true,result:await financeMutation(body.data.operation,body.data.payload)});}catch(error){const status=typeof error==="object"&&error&&"status" in error?Number(error.status):400;return NextResponse.json({error:status===403?"Operacion financiera no autorizada.":status===404?"Registro no encontrado.":"La operacion fue rechazada para proteger la integridad financiera."},{status});}}
