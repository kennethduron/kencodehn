import "server-only";
import { Resend } from "resend";
import type { AdminUser } from "@/lib/admin/types";
import { hasPermission } from "@/lib/admin/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeMailHtml, textFromHtml } from "./security";

export type MailFolder = "inbox" | "sent" | "drafts" | "archived" | "trash" | "follow-up";
export type Address = { email: string; name?: string };

export function maySuperviseMail(admin: AdminUser) { return hasPermission(admin, "mail:supervise"); }
export async function assignedIdentityIds(admin: AdminUser) {
  const { data } = await createSupabaseAdminClient().from("mail_identity_assignments").select("identity_id").eq("profile_id", admin.uid).eq("active", true);
  return (data || []).map((item) => item.identity_id as string);
}
export async function mayUseIdentity(admin: AdminUser, identityId: string) { return (await assignedIdentityIds(admin)).includes(identityId); }
export async function mayAccessThread(admin: AdminUser, threadId: string) {
  if (maySuperviseMail(admin)) return true;
  const identities = await assignedIdentityIds(admin);
  const { data } = await createSupabaseAdminClient().from("mail_threads").select("assigned_to,identity_id").eq("id", threadId).maybeSingle();
  return Boolean(data && (data.assigned_to === admin.uid || identities.includes(data.identity_id)));
}

export async function listMail(admin: AdminUser, folder: MailFolder, search: string, cursor?: string | null) {
  const client = createSupabaseAdminClient();
  const identities = await assignedIdentityIds(admin);
  const { data: identityRows } = await client.from("mail_identities").select("id,email,display_name,status,mail_identity_assignments!inner(profile_id,active,is_primary)").eq("mail_identity_assignments.profile_id", admin.uid).eq("mail_identity_assignments.active", true).eq("status", "active");
  const { data: templates } = await client.from("mail_templates").select("id,name,subject,body_html").eq("active", true).order("name").limit(100);
  const { data: signatures } = await client.from("mail_signatures").select("id,identity_id,name,body_html,is_default").eq("profile_id", admin.uid).order("is_default", { ascending: false }).limit(20);
  if (folder === "drafts") {
    let draftsQuery = client.from("mail_drafts").select("id,subject,to_addresses,updated_at,version,identity_id,body_text").eq("owner_id", admin.uid).order("updated_at", { ascending: false }).limit(26);
    if (cursor) draftsQuery = draftsQuery.lt("updated_at", cursor);
    if (search) draftsQuery = draftsQuery.ilike("subject", `%${search.replace(/[%_,()]/g, "")}%`);
    const { data: drafts, error } = await draftsQuery; if (error) throw error;
    return { folder, drafts: drafts || [], threads: [], identities: identityRows || [], templates: templates || [], signatures: signatures || [], nextCursor: drafts?.length === 26 ? drafts.at(-1)?.updated_at : null };
  }
  let query = client.from("mail_threads").select("id,subject,state,assigned_to,is_important,follow_up_at,snippet,latest_message_at,identity_id,lead_id,client_id,project_id,add_on_id,proposal_id,mail_identities(email,display_name),mail_read_states(unread),mail_messages(id,direction,from_address,to_addresses,created_at)").order("latest_message_at", { ascending: false }).limit(26);
  if (!maySuperviseMail(admin)) query = identities.length ? query.or(`assigned_to.eq.${admin.uid},identity_id.in.(${identities.join(",")})`) : query.eq("assigned_to", admin.uid);
  if (folder === "archived") query = query.eq("state", "archived"); else if (folder === "trash") query = query.eq("state", "trash"); else query = query.eq("state", "inbox");
  if (folder === "follow-up") query = query.not("follow_up_at", "is", null);
  if (search) query = query.or(`subject.ilike.%${search.replace(/[%_,()]/g, "")}%,snippet.ilike.%${search.replace(/[%_,()]/g, "")}%`);
  if (cursor) query = query.lt("latest_message_at", cursor);
  const { data, error } = await query; if (error) throw error;
  const threads = (data || []).filter((thread) => folder !== "sent" || thread.mail_messages?.some((message: { direction: string }) => message.direction === "outbound"));
  return { folder, threads, drafts: [], identities: identityRows || [], templates: templates || [], signatures: signatures || [], nextCursor: data?.length === 26 ? data.at(-1)?.latest_message_at : null };
}

export async function loadThread(admin: AdminUser, threadId: string) {
  if (!(await mayAccessThread(admin, threadId))) throw new Error("MAIL_FORBIDDEN");
  const client = createSupabaseAdminClient();
  const { data: thread, error } = await client.from("mail_threads").select("*,mail_identities(email,display_name)").eq("id", threadId).single(); if (error) throw error;
  const { data: messages, error: messageError } = await client.from("mail_messages").select("id,direction,delivery_status,from_address,to_addresses,cc_addresses,bcc_addresses,subject,body_html,body_text,sender_snapshot,sent_at,received_at,created_at,has_remote_images").eq("thread_id", threadId).order("created_at"); if (messageError) throw messageError;
  await client.from("mail_read_states").upsert({ thread_id: threadId, profile_id: admin.uid, unread: false, last_read_at: new Date().toISOString() });
  return { thread, messages: messages || [] };
}

export async function sendMail(admin: AdminUser, input: { requestId: string; threadId?: string; draftId?: string; identityId: string; to: string[]; cc: string[]; bcc: string[]; subject: string; html: string }) {
  if (!(await mayUseIdentity(admin, input.identityId))) throw new Error("MAIL_IDENTITY_FORBIDDEN");
  const client = createSupabaseAdminClient();
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await client.from("mail_audit_events").select("id", { count: "exact", head: true }).eq("actor_id", admin.uid).eq("action", "mail_message_sent").gte("created_at", minuteAgo);
  if ((count || 0) >= 10) throw new Error("MAIL_RATE_LIMIT");
  const { data: identity } = await client.from("mail_identities").select("id,email,display_name,status").eq("id", input.identityId).eq("status", "active").single();
  if (!identity) throw new Error("MAIL_IDENTITY_FORBIDDEN");
  let threadId = input.threadId;
  if (threadId && !(await mayAccessThread(admin, threadId))) throw new Error("MAIL_FORBIDDEN");
  if (!threadId) { const created = await client.from("mail_threads").insert({ identity_id: identity.id, subject: input.subject || "(Sin asunto)", assigned_to: admin.uid, snippet: textFromHtml(input.html).slice(0, 500), created_by: admin.uid }).select("id").single(); if (created.error) throw created.error; threadId = created.data.id; }
  const { data: previous } = await client.from("mail_messages").select("message_id,reference_ids").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const cleanHtml = sanitizeMailHtml(input.html); const cleanText = textFromHtml(cleanHtml);
  const providerAttachments: Array<{ filename: string; content: Buffer }> = [];
  if (input.draftId) {
    const { data: ownedDraft } = await client.from("mail_drafts").select("id").eq("id", input.draftId).eq("owner_id", admin.uid).maybeSingle();
    if (!ownedDraft) throw new Error("MAIL_FORBIDDEN");
    const { data: attachments } = await client.from("mail_attachments").select("storage_path,filename,size_bytes").eq("draft_id", input.draftId);
    if ((attachments || []).reduce((sum, item) => sum + Number(item.size_bytes), 0) > 25 * 1024 * 1024) throw new Error("MAIL_ATTACHMENT_LIMIT");
    for (const attachment of attachments || []) { const file = await client.storage.from("mail-attachments").download(attachment.storage_path); if (file.error || !file.data) throw new Error("MAIL_ATTACHMENT_MISSING"); providerAttachments.push({ filename: attachment.filename, content: Buffer.from(await file.data.arrayBuffer()) }); }
  }
  const outgoingMessageId = `<${input.requestId}@mail.kencodehn.com>`;
  const headers: Record<string, string> = { "Message-ID": outgoingMessageId }; if (previous?.message_id) { headers["In-Reply-To"] = previous.message_id; headers.References = [...(previous.reference_ids || []), previous.message_id].slice(-50).join(" "); }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const delivery = await resend.emails.send({ from: `${identity.display_name} <${identity.email}>`, to: input.to, cc: input.cc.length ? input.cc : undefined, bcc: input.bcc.length ? input.bcc : undefined, subject: input.subject || "(Sin asunto)", html: cleanHtml || "<p></p>", text: cleanText, headers, attachments: providerAttachments.length ? providerAttachments : undefined }, { idempotencyKey: `mail/${admin.uid}/${input.requestId}` });
  if (delivery.error || !delivery.data?.id) throw new Error("MAIL_PROVIDER_FAILED");
  const now = new Date().toISOString();
  const inserted = await client.from("mail_messages").insert({ thread_id: threadId, direction: "outbound", delivery_status: "sent", provider_email_id: delivery.data.id, message_id: outgoingMessageId, in_reply_to: previous?.message_id || null, reference_ids: previous?.message_id ? [...(previous.reference_ids || []), previous.message_id].slice(-50) : [], from_address: { email: identity.email, name: identity.display_name }, to_addresses: input.to.map((email) => ({ email })), cc_addresses: input.cc.map((email) => ({ email })), bcc_addresses: input.bcc.map((email) => ({ email })), subject: input.subject || "(Sin asunto)", body_html: cleanHtml, body_text: cleanText, sent_by: admin.uid, sender_identity_id: identity.id, sender_snapshot: { userId: admin.uid, name: admin.displayName || admin.email, identity: identity.email }, sent_at: now }).select("id").single();
  if (inserted.error) throw inserted.error;
  if (input.draftId) { await client.from("mail_attachments").update({ draft_id: null, message_id: inserted.data.id }).eq("draft_id", input.draftId); await client.from("mail_drafts").delete().eq("id", input.draftId).eq("owner_id", admin.uid); }
  await Promise.all([client.from("mail_threads").update({ state: "inbox", subject: input.subject || "(Sin asunto)", snippet: cleanText.slice(0, 500), latest_message_at: now, updated_at: now }).eq("id", threadId), client.from("mail_audit_events").insert({ action: "mail_message_sent", actor_id: admin.uid, identity_id: identity.id, thread_id: threadId, message_id: inserted.data.id, safe_metadata: { provider: "resend" } })]);
  return { threadId, messageId: inserted.data.id };
}
