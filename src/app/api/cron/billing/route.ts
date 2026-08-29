import { timingSafeEqual } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { runBillingDelivery } from "@/lib/billing/automation";

export const dynamic="force-dynamic";
function authorized(request:NextRequest){const configured=process.env.BILLING_CRON_SECRET?.trim()??"";const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";if(!configured||configured.length!==supplied.length)return false;return timingSafeEqual(Buffer.from(configured),Buffer.from(supplied));}
export async function POST(request:NextRequest){if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});try{return NextResponse.json({ok:true,...await runBillingDelivery()});}catch(error){console.error("[Ken Code billing cron failed]",error instanceof Error?error.name:"unknown");return NextResponse.json({ok:false,error:"Billing delivery failed"},{status:500});}}
