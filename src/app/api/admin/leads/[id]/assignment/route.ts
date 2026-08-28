import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { parseLeadAssignmentInput } from "@/lib/admin/authorization";
import { createCrmRepositories } from "@/lib/data/repositories";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, "leads:assign");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const parsed = parseLeadAssignmentInput(await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: "Asignacion invalida." }, { status: 400 });
  }
  const { id } = await params;
  try {
    const result = await (await createCrmRepositories()).leads.assign(id, parsed.assignedToUid, access.admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: Number(error.status) || 400 });
    }
    throw error;
  }
}
