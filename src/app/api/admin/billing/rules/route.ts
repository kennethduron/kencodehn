import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { billingRuleMutation } from "@/lib/billing/data";

const schema=z.object({id:z.string().uuid(),enabled:z.boolean(),sendTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).strict();
export async function PATCH(request:NextRequest){const admin=await requireAdminFromRequest(request);if(!admin)return NextResponse.json({error:"No autorizado."},{status:401});if(!hasPermission(admin,"billing_settings:manage"))return NextResponse.json({error:"No tienes permiso para administrar recordatorios."},{status:403});const body=schema.safeParse(await request.json().catch(()=>null));if(!body.success)return NextResponse.json({error:"Regla inválida."},{status:400});try{return NextResponse.json({ok:true,result:await billingRuleMutation(body.data.id,body.data.enabled,body.data.sendTime)});}catch{return NextResponse.json({error:"No se pudo actualizar la regla."},{status:400});}}
