import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (getCrmAuthProvider() !== "supabase") return NextResponse.json({ ok: false }, { status: 404 });
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  const { error } = await createSupabaseAdminClient().rpc("record_password_changed", { p_target: admin.uid });
  if (error) return NextResponse.json({ ok: false, message: "No se pudo registrar el evento de seguridad." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
