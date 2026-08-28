import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createCrmRepositories } from "@/lib/data/repositories";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "leads:view");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const leads = await (await createCrmRepositories()).leads.list(access.admin);
  return NextResponse.json({ ok: true, leads });
}
