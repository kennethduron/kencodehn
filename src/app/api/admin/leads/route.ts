import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { listLeads } from "@/lib/admin/data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const leads = await listLeads();
  return NextResponse.json({ ok: true, leads });
}
