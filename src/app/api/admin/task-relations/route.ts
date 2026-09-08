import { NextRequest, NextResponse } from "next/server";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function safeSearch(value: string) {
  return value.trim().replace(/[%_,()]/g, "").slice(0, 100);
}

export async function GET(request: NextRequest) {
  const access = await requirePermissionsFromRequest(request, "tasks:view");
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });

  const search = safeSearch(request.nextUrl.searchParams.get("q") || "");
  const page = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("page") || 1) || 1));
  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const client = await createSupabaseServerClient();

  let clients = client
    .from("clients")
    .select("id,name,company,email,phone,created_at")
    .order("created_at", { ascending: false })
    .range(from, to);
  let leads = client
    .from("leads")
    .select("id,name,business,email,phone,created_at")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (search) {
    const pattern = `%${search}%`;
    clients = clients.or(`name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
    leads = leads.or(`name.ilike.${pattern},business.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
  }

  const [clientResult, leadResult] = await Promise.all([clients, leads]);
  if (clientResult.error || leadResult.error) {
    return NextResponse.json({ ok: false, message: "No pudimos consultar clientes y prospectos." }, { status: 500 });
  }
  const results = [
    ...(clientResult.data || []).map((item) => ({
      type: "client" as const,
      id: item.id,
      label: item.company || item.name,
      detail: [item.company ? item.name : "Cliente", item.email || item.phone].filter(Boolean).join(" · "),
    })),
    ...(leadResult.data || []).map((item) => ({
      type: "lead" as const,
      id: item.id,
      label: item.business || item.name,
      detail: [item.business ? item.name : "Prospecto", item.email || item.phone].filter(Boolean).join(" · "),
    })),
  ];
  return NextResponse.json(
    { ok: true, results, page, hasMore: (clientResult.data?.length || 0) === pageSize || (leadResult.data?.length || 0) === pageSize },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
