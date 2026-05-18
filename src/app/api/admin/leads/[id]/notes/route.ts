import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { addNote, listNotes } from "@/lib/admin/data";

export const runtime = "nodejs";

const noteSchema = z.object({
  text: z.string().trim().min(2).max(2000),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const notes = await listNotes(id);
  return NextResponse.json({ ok: true, notes });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const { text } = noteSchema.parse(await request.json());
  await addNote(id, text, admin);
  const notes = await listNotes(id);
  return NextResponse.json({ ok: true, notes });
}
