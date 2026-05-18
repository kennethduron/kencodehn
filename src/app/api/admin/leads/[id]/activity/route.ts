import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { listActivityLogs } from "@/lib/admin/data";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const activity = await listActivityLogs(id);
  return NextResponse.json({ ok: true, activity });
}
