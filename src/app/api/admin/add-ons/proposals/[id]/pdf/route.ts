import {NextRequest,NextResponse} from "next/server";
import {requireAdminFromRequest} from "@/lib/admin/auth";
import {hasPermission} from "@/lib/admin/authorization";
import {addOnMutation,getAddOn} from "@/lib/add-ons/data";
import {createProposalPdf} from "@/lib/add-ons/proposal-pdf";

export const runtime="nodejs";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const admin=await requireAdminFromRequest(request);
  if(!admin)return NextResponse.json({error:"No autorizado."},{status:401});
  if(!hasPermission(admin,"modules:manage"))return NextResponse.json({error:"No tienes permiso para exportar propuestas."},{status:403});
  const{id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Propuesta invalida."},{status:400});
  const addOnId=request.nextUrl.searchParams.get("module");
  if(!addOnId)return NextResponse.json({error:"Modulo requerido."},{status:400});
  try{
    const addOn=await getAddOn(addOnId);
    const proposal=addOn?.proposals.find(item=>item.id===id);
    if(!addOn||!proposal)return NextResponse.json({error:"Propuesta no encontrada."},{status:404});
    const pdf=await createProposalPdf({proposal,addOn});
    await addOnMutation("proposal_exported",{proposalId:id});
    return new NextResponse(Buffer.from(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${proposal.proposalNumber}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){const status=typeof error==="object"&&error&&"status" in error?Number(error.status):400;return NextResponse.json({error:status===403?"Exportacion no autorizada.":"No se pudo generar la propuesta."},{status});}
}
