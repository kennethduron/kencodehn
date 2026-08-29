import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { isCrmPreviewReadOnly } from "@/lib/data/preview-read-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  if (getCrmAuthProvider() === "supabase" && !isCrmPreviewReadOnly()) {
    const { error } = await createSupabaseAdminClient().rpc("record_profile_login", { p_target: admin.uid });
    if (error) return NextResponse.json({ ok: false, message: "No se pudo registrar el acceso." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, admin });
}
