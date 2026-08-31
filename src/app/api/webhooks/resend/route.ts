import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend, type EmailReceivedEvent } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseHeaderReferences, sanitizeMailHtml, textFromHtml } from "@/lib/mail/security";

export const runtime = "nodejs";
const allowedAttachments = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain"]);
function emailOnly(value: string) { return (value.match(/<([^>]+)>/)?.[1] || value).trim().toLowerCase(); }
function address(value: string) { const email = emailOnly(value); const name = value.includes("<") ? value.slice(0, value.lastIndexOf("<")).trim().replace(/^['"]|['"]$/g, "") : ""; return { email, ...(name ? { name } : {}) }; }
const outboundStatuses = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.failed": "failed",
  "email.suppressed": "failed",
  "email.bounced": "bounced",
  "email.complained": "complained",
} as const;

function safeErrorCategory(error: unknown) {
  const candidate = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : error instanceof Error
      ? error.name
      : "unknown";
  return candidate.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64) || "unknown";
}

async function markFailed(
  client: ReturnType<typeof createSupabaseAdminClient>,
  eventId: string,
  eventType: string,
  stage: string,
  error: unknown,
) {
  const errorCategory = safeErrorCategory(error);
  console.error("resend_webhook_failed", { eventType, stage, errorCategory });
  await client.from("mail_webhook_events").update({
    status: "failed",
    error_category: `${stage}:${errorCategory}`.slice(0, 128),
  }).eq("provider_event_id", eventId);
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim(); const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!secret || !apiKey) return NextResponse.json({ error: "Webhook no configurado." }, { status: 503 });
  const payload = await request.text(); const eventId = request.headers.get("svix-id") || ""; const timestamp = request.headers.get("svix-timestamp") || ""; const signature = request.headers.get("svix-signature") || "";
  if (!eventId || !timestamp || !signature) return NextResponse.json({ error: "Firma requerida." }, { status: 400 });
  const resend = new Resend(apiKey); let event;
  try { event = resend.webhooks.verify({ payload, headers: { id: eventId, timestamp, signature }, webhookSecret: secret }); } catch { return NextResponse.json({ error: "Firma inválida." }, { status: 401 }); }
  const client = createSupabaseAdminClient(); const hash = createHash("sha256").update(payload).digest("hex");
  const insertedEvent = await client.from("mail_webhook_events").insert({ provider_event_id: eventId, event_type: event.type, payload_hash: hash }).select("status").maybeSingle();
  if (insertedEvent.error?.code === "23505") { const { data: existing } = await client.from("mail_webhook_events").select("status,payload_hash").eq("provider_event_id", eventId).single(); if (!existing) return NextResponse.json({ error: "No pudimos validar el evento." }, { status: 500 }); if (existing.payload_hash !== hash) return NextResponse.json({ error: "Evento inconsistente." }, { status: 409 }); if (existing.status === "processed" || existing.status === "ignored") return NextResponse.json({ ok: true, duplicate: true }); }
  if (event.type in outboundStatuses) {
    let stage = "apply_delivery_status";
    try {
      const outbound = event as { type: keyof typeof outboundStatuses; created_at: string; data: { email_id?: string } };
      if (!outbound.data.email_id) throw new Error("provider_email_id_missing");
      const applied = await client.rpc("apply_mail_delivery_event", { p_provider_email_id: outbound.data.email_id, p_provider_event_id: eventId, p_status: outboundStatuses[outbound.type], p_occurred_at: outbound.created_at });
      if (applied.error) throw applied.error;
      const result = applied.data?.[0];
      if (result?.applied) await client.from("mail_audit_events").insert({ action: "mail_delivery_status_updated", identity_id: result.identity_id, thread_id: result.thread_id, message_id: result.message_id, safe_metadata: { provider: "resend", status: outboundStatuses[outbound.type] } });
      await client.from("mail_webhook_events").update({ status: result ? "processed" : "ignored", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
      return NextResponse.json({ ok: true, applied: Boolean(result?.applied) });
    } catch (error) {
      await markFailed(client, eventId, event.type, stage, error);
      return NextResponse.json({ error: "No pudimos procesar el evento." }, { status: 500 });
    }
  }
  if (event.type !== "email.received") { await client.from("mail_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId); return NextResponse.json({ ok: true, ignored: true }); }
  let stage = "retrieve_message";
  try {
    const receivedEvent = event as EmailReceivedEvent; const received = await resend.emails.receiving.get(receivedEvent.data.email_id); if (received.error || !received.data) throw new Error("provider_retrieve_failed");
    stage = "match_identity";
    const recipientEmails = received.data.to.map(emailOnly); const { data: identities, error: identitiesError } = await client.from("mail_identities").select("id,email").in("email", recipientEmails).eq("status", "active");
    if (identitiesError) throw identitiesError;
    const identity = identities?.[0]; if (!identity) { await client.from("mail_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId); return NextResponse.json({ ok: true, ignored: true }); }
    const headers = Object.fromEntries(Object.entries(received.data.headers || {}).map(([key, value]) => [key.toLowerCase(), value])); const inReplyTo = headers["in-reply-to"] || null; const references = parseHeaderReferences(headers.references);
    stage = "resume_partial_event";
    const existingMessage = await client.from("mail_messages").select("id,thread_id").eq("provider_email_id", received.data.id).eq("direction", "inbound").maybeSingle();
    if (existingMessage.error) throw existingMessage.error;
    let messageId: string | null = existingMessage.data?.id || null;
    let threadId: string | null = existingMessage.data?.thread_id || null;
    stage = "resolve_thread";
    if (!threadId && inReplyTo) { const { data: parent, error: parentError } = await client.from("mail_messages").select("thread_id").eq("message_id", inReplyTo).maybeSingle(); if (parentError) throw parentError; threadId = parent?.thread_id || null; }
    if (!threadId && references.length) { const { data: parent, error: parentError } = await client.from("mail_messages").select("thread_id").in("message_id", references).order("created_at", { ascending: false }).limit(1).maybeSingle(); if (parentError) throw parentError; threadId = parent?.thread_id || null; }
    const rawHtml = received.data.html || `<p>${(received.data.text || "").replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character] || character)).replace(/\n/g, "<br>")}</p>`; const hasRemoteImages = /<img\b[^>]*\bsrc\s*=\s*["']https?:/i.test(rawHtml); const cleanHtml = sanitizeMailHtml(rawHtml); const cleanText = (received.data.text || textFromHtml(cleanHtml)).slice(0, 1_000_000); const now = received.data.created_at || new Date().toISOString();
    if (!threadId) { stage = "create_thread"; const { data: assignments, error: assignmentError } = await client.from("mail_identity_assignments").select("profile_id").eq("identity_id", identity.id).eq("active", true).order("is_primary", { ascending: false }).limit(1); if (assignmentError) throw assignmentError; const created = await client.from("mail_threads").insert({ identity_id: identity.id, subject: received.data.subject || "(Sin asunto)", assigned_to: assignments?.[0]?.profile_id || null, snippet: cleanText.slice(0, 500), latest_message_at: now }).select("id").single(); if (created.error) throw created.error; threadId = created.data.id; }
    if (!messageId) {
      stage = "store_message";
      const message = await client.from("mail_messages").insert({ thread_id: threadId, direction: "inbound", delivery_status: "received", provider_email_id: received.data.id, provider_event_id: eventId, message_id: received.data.message_id, in_reply_to: inReplyTo, reference_ids: references, from_address: address(received.data.from), to_addresses: received.data.to.map(address), cc_addresses: (received.data.cc || []).map(address), bcc_addresses: (received.data.bcc || []).map(address), subject: received.data.subject || "(Sin asunto)", body_html: cleanHtml, body_text: cleanText, has_remote_images: hasRemoteImages, received_at: now }).select("id").single();
      if (message.error) throw message.error;
      messageId = message.data.id;
    }
    const threadUpdate = await client.from("mail_threads").update({ state: "inbox", subject: received.data.subject || "(Sin asunto)", snippet: cleanText.slice(0, 500), latest_message_at: now, updated_at: new Date().toISOString() }).eq("id", threadId);
    if (threadUpdate.error) throw threadUpdate.error;
    stage = "store_attachments";
    const attachmentList = await resend.emails.receiving.attachments.list({ emailId: received.data.id });
    if (attachmentList.error) throw attachmentList.error;
    for (const attachment of attachmentList.data?.data || []) { if (!allowedAttachments.has(attachment.content_type) || attachment.size > 10 * 1024 * 1024) continue; const existingAttachment = await client.from("mail_attachments").select("id").eq("message_id", messageId).eq("provider_attachment_id", attachment.id).maybeSingle(); if (existingAttachment.error || existingAttachment.data) { if (existingAttachment.error) throw existingAttachment.error; continue; } const download = await fetch(attachment.download_url); if (!download.ok) continue; const path = `${identity.id}/${threadId}/${crypto.randomUUID()}`; const uploaded = await client.storage.from("mail-attachments").upload(path, new Uint8Array(await download.arrayBuffer()), { contentType: attachment.content_type, upsert: false }); if (!uploaded.error) await client.from("mail_attachments").insert({ message_id: messageId, provider_attachment_id: attachment.id, storage_path: path, filename: (attachment.filename || "archivo").replace(/[\r\n]/g, "").slice(0, 255), content_type: attachment.content_type, size_bytes: attachment.size, content_id: attachment.content_id || null, inline: attachment.content_disposition === "inline" }); }
    stage = "notify_assignees";
    const { data: assignees, error: assigneesError } = await client.from("mail_identity_assignments").select("profile_id").eq("identity_id", identity.id).eq("active", true);
    if (assigneesError) throw assigneesError;
    const profileIds = [...new Set((assignees || []).map((assignment) => assignment.profile_id))];
    const { data: profiles, error: profilesError } = profileIds.length
      ? await client.from("profiles").select("id,email,display_name,name").in("id", profileIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    for (const assignment of assignees || []) {
      const profile = profilesById.get(assignment.profile_id);
      const readState = await client.from("mail_read_states").upsert({ thread_id: threadId, profile_id: assignment.profile_id, unread: true, last_read_at: now });
      if (readState.error) throw readState.error;
      const notification = await client.from("notifications").upsert({ firebase_id: `mail:${eventId}:${assignment.profile_id}`, recipient_id: assignment.profile_id, recipient_name: profile?.display_name || profile?.name || "", recipient_email: profile?.email || "", type: "mail_received", severity: "info", title: "Nuevo correo recibido", message: `Nuevo mensaje en ${identity.email}`, action_url: `/admin/mail?thread=${threadId}`, is_read: false, created_at: now, updated_at: now }, { onConflict: "firebase_id", ignoreDuplicates: true });
      if (notification.error) throw notification.error;
    }
    stage = "complete_event";
    const existingAudit = await client.from("mail_audit_events").select("id").eq("action", "mail_message_received").eq("message_id", messageId).maybeSingle();
    if (existingAudit.error) throw existingAudit.error;
    if (!existingAudit.data) {
      const audit = await client.from("mail_audit_events").insert({ action: "mail_message_received", identity_id: identity.id, thread_id: threadId, message_id: messageId, safe_metadata: { provider: "resend", attachmentCount: attachmentList.data?.data.length || 0 } });
      if (audit.error) throw audit.error;
    }
    const completedEvent = await client.from("mail_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
    if (completedEvent.error) throw completedEvent.error;
    return NextResponse.json({ ok: true });
  } catch (error) { await markFailed(client, eventId, event.type, stage, error); return NextResponse.json({ error: "No pudimos procesar el evento." }, { status: 500 }); }
}
