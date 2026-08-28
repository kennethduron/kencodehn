import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createCrmRepositories } from "@/lib/data/repositories";

export const runtime = "nodejs";

const noteSchema = z.object({
  text: z.string().trim().min(2).max(2000),
}).strict();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, ["leads:view", "notes:view"]);
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const { id } = await params;
  const repositories = await createCrmRepositories();
  if (!(await repositories.leads.get(id, access.admin))) return NextResponse.json({ ok: false, message: "Lead no encontrado." }, { status: 404 });
  const notes = await repositories.notes.list(id, access.admin);
  return NextResponse.json({ ok: true, notes });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, ["leads:view", "notes:edit"]);
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const admin = access.admin;
  const { id } = await params;
  const repositories = await createCrmRepositories();
  if (!(await repositories.leads.get(id, admin))) return NextResponse.json({ ok: false, message: "Lead no encontrado." }, { status: 404 });
  const parsed = noteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Nota invalida.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { text } = parsed.data;
  try {
    await repositories.notes.add(id, text, admin);
    const notes = await repositories.notes.list(id, admin);
    return NextResponse.json({ ok: true, notes });
  } catch (error) {
    if (error instanceof Error && "status" in error) return NextResponse.json({ ok: false, message: error.message }, { status: Number(error.status) || 400 });
    throw error;
  }
}
