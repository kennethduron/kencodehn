import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listMail, loadDraft, loadThread, mayAccessThread, sendMail, type MailFolder } from "@/lib/mail/service";
import { recipientListSchema, safeSubjectSchema, uuidSchema, sanitizeMailHtml, textFromHtml } from "@/lib/mail/security";

const folderSchema = z.enum(["inbox", "sent", "drafts", "archived", "trash", "follow-up"]);
const sendSchema = z.object({ action: z.literal("send"), requestId: uuidSchema, threadId: uuidSchema.optional(), draftId: uuidSchema.optional(), identityId: uuidSchema, to: recipientListSchema.min(1), cc: recipientListSchema.default([]), bcc: recipientListSchema.default([]), subject: safeSubjectSchema, html: z.string().max(2_000_000) }).strict().refine((value) => value.to.length + value.cc.length + value.bcc.length <= 50, "Demasiados destinatarios");
const draftSchema = z.object({ action: z.literal("save_draft"), id: uuidSchema.optional(), version: z.number().int().positive().optional(), identityId: uuidSchema.nullable(), threadId: uuidSchema.nullable(), to: recipientListSchema, cc: recipientListSchema, bcc: recipientListSchema, subject: safeSubjectSchema, html: z.string().max(2_000_000), context: z.object({ leadId: uuidSchema.nullable().optional(), clientId: uuidSchema.nullable().optional(), projectId: uuidSchema.nullable().optional(), addOnId: uuidSchema.nullable().optional(), proposalId: uuidSchema.nullable().optional() }).strict().default({}) }).strict();
const stateSchema = z.object({ action: z.enum(["archive", "trash", "restore", "read", "unread", "important"]), threadId: uuidSchema, value: z.boolean().optional() }).strict();
const assignSchema = z.object({ action: z.literal("assign"), threadId: uuidSchema, profileId: uuidSchema.nullable() }).strict();
const followUpSchema = z.object({ action: z.literal("follow_up"), threadId: uuidSchema, dueAt: z.iso.datetime(), title: z.string().trim().min(2).max(180) }).strict();

function mailError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "MAIL_FAILED";
  if (message.includes("FORBIDDEN")) return NextResponse.json({ error: "No tienes acceso a esta conversación." }, { status: 403 });
  if (message.includes("RATE_LIMIT")) return NextResponse.json({ error: "Espera un momento antes de enviar otro correo." }, { status: 429 });
  if (message.includes("PROVIDER")) return NextResponse.json({ error: "El proveedor no pudo enviar el correo. El borrador permanece disponible." }, { status: 502 });
  return NextResponse.json({ error: "No pudimos completar la operación de correo." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use"); if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const folder = folderSchema.safeParse(request.nextUrl.searchParams.get("folder") || "inbox");
  const search = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 120); const cursor = request.nextUrl.searchParams.get("cursor"); const threadId = request.nextUrl.searchParams.get("thread");
  const draftId = request.nextUrl.searchParams.get("draft");
  if (!folder.success) return NextResponse.json({ error: "Carpeta inválida." }, { status: 400 });
  try { const list = await listMail(auth.admin, folder.data as MailFolder, search, cursor); const thread = threadId && uuidSchema.safeParse(threadId).success ? await loadThread(auth.admin, threadId) : null; const draft = draftId && uuidSchema.safeParse(draftId).success ? await loadDraft(auth.admin, draftId) : null; return NextResponse.json({ ...list, selected: thread, selectedDraft: draft }); } catch (error) { return mailError(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use"); if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = await request.json().catch(() => null);
  const sent = sendSchema.safeParse(body);
  if (sent.success) { try { return NextResponse.json({ ok: true, ...(await sendMail(auth.admin, sent.data)) }); } catch (error) { return mailError(error); } }
  const draft = draftSchema.safeParse(body);
  if (draft.success) {
    const client = createSupabaseAdminClient(); const cleanHtml = sanitizeMailHtml(draft.data.html); const now = new Date().toISOString();
    const values = { owner_id: auth.admin.uid, thread_id: draft.data.threadId, identity_id: draft.data.identityId, to_addresses: draft.data.to.map((email) => ({ email })), cc_addresses: draft.data.cc.map((email) => ({ email })), bcc_addresses: draft.data.bcc.map((email) => ({ email })), subject: draft.data.subject, body_html: cleanHtml, body_text: textFromHtml(cleanHtml), lead_id: draft.data.context.leadId || null, client_id: draft.data.context.clientId || null, project_id: draft.data.context.projectId || null, add_on_id: draft.data.context.addOnId || null, proposal_id: draft.data.context.proposalId || null, updated_at: now };
    if (draft.data.id) { const nextVersion = (draft.data.version || 1) + 1; const result = await client.from("mail_drafts").update({ ...values, version: nextVersion }).eq("id", draft.data.id).eq("owner_id", auth.admin.uid).eq("version", draft.data.version || 1).select("id,version,updated_at").maybeSingle(); if (result.error) return mailError(result.error); if (!result.data) return NextResponse.json({ error: "El borrador cambió en otra sesión. Recargue antes de sobrescribirlo." }, { status: 409 }); return NextResponse.json({ ok: true, draft: result.data }); }
    const result = await client.from("mail_drafts").insert({ ...values, created_at: now }).select("id,version,updated_at").single(); return result.error ? mailError(result.error) : NextResponse.json({ ok: true, draft: result.data });
  }
  const state = stateSchema.safeParse(body);
  if (state.success) {
    if (!(await mayAccessThread(auth.admin, state.data.threadId))) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    const client = createSupabaseAdminClient(); const now = new Date().toISOString();
    if (state.data.action === "read" || state.data.action === "unread") await client.from("mail_read_states").upsert({ thread_id: state.data.threadId, profile_id: auth.admin.uid, unread: state.data.action === "unread", last_read_at: now });
    else { const update = state.data.action === "important" ? { is_important: state.data.value ?? true, updated_at: now } : { state: state.data.action === "archive" ? "archived" : state.data.action === "trash" ? "trash" : "inbox", updated_at: now }; await client.from("mail_threads").update(update).eq("id", state.data.threadId); }
    await client.from("mail_audit_events").insert({ action: `mail_thread_${state.data.action}`, actor_id: auth.admin.uid, thread_id: state.data.threadId }); return NextResponse.json({ ok: true });
  }
  const assign = assignSchema.safeParse(body);
  if (assign.success) { if (!hasPermission(auth.admin, "mail:assign_threads") || !(await mayAccessThread(auth.admin, assign.data.threadId))) return NextResponse.json({ error: "No autorizado." }, { status: 403 }); const client = createSupabaseAdminClient(); if (assign.data.profileId) { const target = await client.from("profiles").select("id").eq("id", assign.data.profileId).eq("active", true).in("role", ["owner", "admin", "manager", "sales_agent"]).maybeSingle(); if (target.error || !target.data) return NextResponse.json({ error: "Responsable inválido." }, { status: 400 }); } await client.from("mail_threads").update({ assigned_to: assign.data.profileId, updated_at: new Date().toISOString() }).eq("id", assign.data.threadId); await client.from("mail_audit_events").insert({ action: "mail_thread_assigned", actor_id: auth.admin.uid, thread_id: assign.data.threadId, safe_metadata: { assignedTo: assign.data.profileId } }); return NextResponse.json({ ok: true }); }
  const follow = followUpSchema.safeParse(body);
  if (follow.success) { if (!(await mayAccessThread(auth.admin, follow.data.threadId))) return NextResponse.json({ error: "No autorizado." }, { status: 403 }); const client = createSupabaseAdminClient(); const now = new Date().toISOString(); const due = new Date(follow.data.dueAt); const id = crypto.randomUUID(); await client.from("mail_follow_ups").insert({ thread_id: follow.data.threadId, assigned_to: auth.admin.uid, due_at: follow.data.dueAt, created_by: auth.admin.uid }); await client.from("tasks").insert({ id, firebase_id: `mail:${id}`, title: follow.data.title, type: "email", status: "pending", priority: "medium", due_date: due.toISOString().slice(0, 10), due_time: due.toISOString().slice(11, 19), timezone: "America/Tegucigalpa", due_at: follow.data.dueAt, assigned_to: auth.admin.uid, assigned_at: now, assigned_by: auth.admin.uid, created_by: auth.admin.uid, created_by_email: auth.admin.email, created_at: now, updated_at: now, legacy_data: { source: "ken_code_mail", threadId: follow.data.threadId } }); await client.from("mail_threads").update({ follow_up_at: follow.data.dueAt, updated_at: now }).eq("id", follow.data.threadId); return NextResponse.json({ ok: true, taskId: id }); }
  return NextResponse.json({ error: "Solicitud de correo inválida." }, { status: 400 });
}
