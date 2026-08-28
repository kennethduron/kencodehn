import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { addNote, listNotes } from "@/lib/admin/data";

export const runtime = "nodejs";

const noteSchema = z.object({
  text: z.string().trim().min(2).max(2000),
}).strict();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, ["leads:view", "notes:view"]);
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const { id } = await params;
  const notes = await listNotes(id);
  return NextResponse.json({ ok: true, notes });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermissionsFromRequest(request, ["leads:view", "notes:edit"]);
  if (!access.ok) return NextResponse.json({ ok: false, message: access.message }, { status: access.status });
  const admin = access.admin;
  const { id } = await params;
  const parsed = noteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Nota invalida.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { text } = parsed.data;
  await addNote(id, text, admin);
  const notes = await listNotes(id);
  return NextResponse.json({ ok: true, notes });
}
