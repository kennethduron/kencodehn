import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { listAssignableSalesAgents } from "@/lib/admin/users";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "leads:assign");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  return NextResponse.json({ ok: true, agents: await listAssignableSalesAgents(access.admin) });
}
