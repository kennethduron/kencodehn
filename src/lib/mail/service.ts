import "server-only";
import { Resend } from "resend";
import type { AdminUser } from "@/lib/admin/types";
import { hasPermission } from "@/lib/admin/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveInlineContentIds, sanitizeMailHtml, textFromHtml } from "./security";

export type MailFolder = "inbox" | "sent" | "drafts" | "archived" | "trash" | "follow-up";
export type Address = { email: string; name?: string };

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function roleTitle(admin: AdminUser) {
  if (admin.jobTitle?.trim()) return admin.jobTitle.trim();
  return { owner: "Owner", admin: "Administrador", manager: "Gerente", sales_agent: "Agente de ventas", viewer: "Consulta" }[admin.role];
}

function renderCorporateSignature(body: string, admin: AdminUser, identityEmail: string) {
  const values: Record<string, string> = {
    USER_NAME: admin.displayName || admin.preferredName || admin.email.split("@")[0],
    ROLE_OR_TITLE: roleTitle(admin),
    CORPORATE_EMAIL: identityEmail,
    COMPANY_NAME: "Ken Code",
    COMPANY_WEB: "kencodehn.com",
  };
  return body.replace(/\{\{\s*(USER_NAME|ROLE_OR_TITLE|CORPORATE_EMAIL|COMPANY_NAME|COMPANY_WEB)\s*\}\}/g, (_, key: string) => escapeHtml(values[key] || ""));
}

function signatureHtml(body: string, logoUrl?: string | null) {
  const cleanBody = sanitizeMailHtml(body, { signatureContent: true });
  if (!logoUrl) return cleanBody;
  return `${cleanBody}<p><img src="${escapeHtml(logoUrl)}" alt="Ken Code" width="420"></p>`;
}

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
  const [identityResult, templateResult, personalResult, corporateResult, assigneeResult] = await Promise.all([
    client.from("mail_identities").select("id,email,display_name,status,mail_identity_assignments!inner(profile_id,active,is_primary)").eq("mail_identity_assignments.profile_id", admin.uid).eq("mail_identity_assignments.active", true).eq("status", "active"),
    client.from("mail_templates").select("id,name,subject,body_html,locked,scope,version").eq("active", true).eq("status", "published").order("name").limit(100),
    client.from("mail_signatures").select("id,identity_id,name,body_html,logo_url,is_default").eq("profile_id", admin.uid).order("is_default", { ascending: false }).limit(20),
    client.from("corporate_mail_signatures").select("id,identity_id,name,body_html,logo_url,version,locked").eq("active", true).order("version", { ascending: false }).limit(20),
    maySuperviseMail(admin) ? client.from("profiles").select("id,name,display_name,role").eq("active", true).in("role", ["owner", "admin", "manager", "sales_agent"]).order("name").limit(200) : Promise.resolve({ data: [] }),
  ]);
  const identityRows = identityResult.data || [];
  const identities = identityRows.map((identity) => identity.id as string);
  const identityEmail = new Map(identityRows.map((identity) => [identity.id as string, String(identity.email)]));
  const personalSignatures = (personalResult.data || []).map((item) => ({ ...item, id: `personal:${item.id}`, source: "personal" as const, body_html: signatureHtml(item.body_html, item.logo_url) }));
  const corporateSignatures = (corporateResult.data || []).map((item) => {
    const email = item.identity_id ? identityEmail.get(item.identity_id) || "" : identityRows[0]?.email || "";
    return { ...item, id: `corporate:${item.id}`, source: "corporate" as const, is_default: true, template_html: signatureHtml(item.body_html, item.logo_url), body_html: signatureHtml(renderCorporateSignature(item.body_html, admin, String(email)), item.logo_url) };
  });
  const templates = templateResult.data || [];
  const signatures = [...personalSignatures, ...corporateSignatures];
  const assignees = assigneeResult.data || [];
  if (folder === "drafts") {
    let draftsQuery = client.from("mail_drafts").select("id,subject,to_addresses,updated_at,version,identity_id,body_text").eq("owner_id", admin.uid).order("updated_at", { ascending: false }).limit(26);
    if (cursor) draftsQuery = draftsQuery.lt("updated_at", cursor);
    if (search) draftsQuery = draftsQuery.ilike("subject", `%${search.replace(/[%_,()]/g, "")}%`);
    const { data: drafts, error } = await draftsQuery; if (error) throw error;
    return { folder, drafts: drafts || [], threads: [], identities: identityRows || [], templates: templates || [], signatures: signatures || [], assignees: assignees || [], nextCursor: drafts?.length === 26 ? drafts.at(-1)?.updated_at : null };
  }
  const messageSelection = folder === "sent"
    ? "mail_messages!inner(id,direction,delivery_status,from_address,to_addresses,sent_at,created_at,mail_attachments(id))"
    : "mail_messages(id,direction,delivery_status,from_address,to_addresses,sent_at,created_at,mail_attachments(id))";
  let query = client.from("mail_threads").select(`id,subject,state,assigned_to,is_important,follow_up_at,snippet,latest_message_at,last_outbound_at,identity_id,lead_id,client_id,project_id,add_on_id,proposal_id,mail_identities(email,display_name),mail_read_states(profile_id,unread),${messageSelection}`).eq("mail_read_states.profile_id", admin.uid).limit(26);
  if (!maySuperviseMail(admin)) query = identities.length ? query.or(`assigned_to.eq.${admin.uid},identity_id.in.(${identities.join(",")})`) : query.eq("assigned_to", admin.uid);
  if (folder === "sent") query = query.neq("state", "trash").not("last_outbound_at", "is", null).eq("mail_messages.direction", "outbound"); else if (folder === "archived") query = query.eq("state", "archived"); else if (folder === "trash") query = query.eq("state", "trash"); else query = query.eq("state", "inbox");
  if (folder === "follow-up") query = query.not("follow_up_at", "is", null);
  if (search) query = query.or(`subject.ilike.%${search.replace(/[%_,()]/g, "")}%,snippet.ilike.%${search.replace(/[%_,()]/g, "")}%`);
  const cursorColumn = folder === "sent" ? "last_outbound_at" : "latest_message_at";
  query = query.order(cursorColumn, { ascending: false });
  if (cursor) query = query.lt(cursorColumn, cursor);
  const { data, error } = await query; if (error) throw error;
  return { folder, threads: data || [], drafts: [], identities: identityRows || [], templates: templates || [], signatures: signatures || [], assignees: assignees || [], nextCursor: data?.length === 26 ? data.at(-1)?.[cursorColumn] : null };
}

export async function loadDraft(admin: AdminUser, draftId: string) {
  const client = createSupabaseAdminClient();
  const { data: draft, error } = await client.from("mail_drafts").select("id,thread_id,identity_id,to_addresses,cc_addresses,bcc_addresses,subject,body_html,version,signature_selection,lead_id,client_id,project_id,add_on_id,proposal_id").eq("id", draftId).eq("owner_id", admin.uid).maybeSingle();
  if (error || !draft) throw new Error("MAIL_FORBIDDEN");
  const { data: attachments } = await client.from("mail_attachments").select("id,filename,size_bytes").eq("draft_id", draftId).order("created_at");
  return { ...draft, attachments: attachments || [] };
}

export async function loadThread(admin: AdminUser, threadId: string) {
  if (!(await mayAccessThread(admin, threadId))) throw new Error("MAIL_FORBIDDEN");
  const client = createSupabaseAdminClient();
  const { data: thread, error } = await client.from("mail_threads").select("*,mail_identities(email,display_name)").eq("id", threadId).single(); if (error) throw error;
  const { data: messages, error: messageError } = await client.from("mail_messages").select("id,direction,delivery_status,from_address,to_addresses,cc_addresses,bcc_addresses,subject,body_html,body_text,sender_snapshot,signature_snapshot,sent_at,received_at,created_at,has_remote_images").eq("thread_id", threadId).order("created_at"); if (messageError) throw messageError;
  const messageIds = (messages || []).map((message) => message.id);
  const attachmentResult = messageIds.length
    ? await client.from("mail_attachments").select("id,message_id,filename,content_type,size_bytes,content_id,inline").in("message_id", messageIds).order("created_at")
    : { data: [], error: null };
  if (attachmentResult.error) throw attachmentResult.error;
  const attachments = new Map<string, typeof attachmentResult.data>();
  for (const attachment of attachmentResult.data || []) attachments.set(attachment.message_id, [...(attachments.get(attachment.message_id) || []), attachment]);
  return { thread, messages: (messages || []).map((message) => {
    const messageAttachments = attachments.get(message.id) || [];
    return {
      ...message,
      body_html: message.direction === "inbound" ? resolveInlineContentIds(message.body_html, messageAttachments) : message.body_html,
      attachments: messageAttachments,
    };
  }) };
}

export type MailDeletionAssessment = { canDelete: boolean; reasonCode: string; reason: string; attachmentCount: number };

export async function assessMailThreadPermanentDeletion(admin: AdminUser, threadId: string): Promise<MailDeletionAssessment> {
  if (admin.role !== "owner") throw new Error("MAIL_HARD_DELETE_FORBIDDEN");
  if (!(await mayAccessThread(admin, threadId))) throw new Error("MAIL_FORBIDDEN");
  const client = createSupabaseAdminClient();
  const result = await client.rpc("assess_mail_thread_permanent_deletion", { p_thread: threadId, p_actor: admin.uid });
  if (result.error) throw result.error;
  const assessment = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!assessment) throw new Error("MAIL_NOT_FOUND");
  return { canDelete: assessment.can_delete === true, reasonCode: String(assessment.reason_code || "unknown"), reason: String(assessment.reason || "No pudimos comprobar esta conversación."), attachmentCount: Number(assessment.attachment_count || 0) };
}

export async function permanentlyDeleteMailThread(admin: AdminUser, threadId: string, reason: string) {
  const assessment = await assessMailThreadPermanentDeletion(admin, threadId);
  if (!assessment.canDelete) throw new Error(`MAIL_RETENTION_REQUIRED:${assessment.reason}`);
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("permanently_delete_mail_thread", {
    p_thread: threadId,
    p_actor: admin.uid,
    p_reason: reason,
  });
  if (error) {
    if (error.code === "55000") {
      const current = await assessMailThreadPermanentDeletion(admin, threadId).catch(() => null);
      throw new Error(`MAIL_RETENTION_REQUIRED:${current?.reason || "Esta conversación contiene historial empresarial que debe conservarse."}`);
    }
    if (error.code === "22023") throw new Error("MAIL_DELETE_REASON_REQUIRED");
    if (error.code === "P0002") throw new Error("MAIL_NOT_FOUND");
    throw error;
  }
  const removedAttachmentPaths = Array.isArray(data) ? data.map(String) : [];
  let cleanupPending = false;
  if (removedAttachmentPaths.length) {
    const removed = await client.storage.from("mail-attachments").remove(removedAttachmentPaths);
    cleanupPending = Boolean(removed.error);
    await client.from("mail_storage_cleanup_queue").update(cleanupPending
      ? { last_error: "storage_remove_failed" }
      : { completed_at: new Date().toISOString(), last_error: null }).in("storage_path", removedAttachmentPaths);
  }
  return { removedAttachmentPaths, cleanupPending };
}

async function resolveSignature(admin: AdminUser, identityId: string, selection?: string | null) {
  const client = createSupabaseAdminClient();
  const [kind, rawId] = selection?.split(":") || [];
  const identity = await client.from("mail_identities").select("email").eq("id", identityId).maybeSingle();
  if (!identity.data?.email) return null;
  if (kind === "personal" && rawId) {
    const result = await client.from("mail_signatures").select("id,identity_id,name,body_html,logo_url").eq("id", rawId).eq("profile_id", admin.uid).maybeSingle();
    if (result.data && (!result.data.identity_id || result.data.identity_id === identityId)) return { selection: selection!, source: "personal", version: 1, html: signatureHtml(result.data.body_html, result.data.logo_url), name: result.data.name, logoUrl: result.data.logo_url };
  }
  if (kind === "corporate" && rawId) {
    const result = await client.from("corporate_mail_signatures").select("id,identity_id,name,body_html,logo_url,version").eq("id", rawId).eq("active", true).maybeSingle();
    if (result.data && (!result.data.identity_id || result.data.identity_id === identityId)) return { selection: selection!, source: "corporate", version: result.data.version, html: signatureHtml(renderCorporateSignature(result.data.body_html, admin, identity.data.email), result.data.logo_url), name: result.data.name, logoUrl: result.data.logo_url };
  }
  const corporate = await client.from("corporate_mail_signatures").select("id,identity_id,name,body_html,logo_url,version").eq("active", true).or(`identity_id.eq.${identityId},identity_id.is.null`).order("identity_id", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (corporate.data) return { selection: `corporate:${corporate.data.id}`, source: "corporate", version: corporate.data.version, html: signatureHtml(renderCorporateSignature(corporate.data.body_html, admin, identity.data.email), corporate.data.logo_url), name: corporate.data.name, logoUrl: corporate.data.logo_url };
  const personal = await client.from("mail_signatures").select("id,identity_id,name,body_html,logo_url").eq("profile_id", admin.uid).eq("is_default", true).or(`identity_id.eq.${identityId},identity_id.is.null`).order("identity_id", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (!personal.data) return null;
  return { selection: `personal:${personal.data.id}`, source: "personal", version: 1, html: signatureHtml(personal.data.body_html, personal.data.logo_url), name: personal.data.name, logoUrl: personal.data.logo_url };
}

function insertSignatureBeforeQuote(body: string, signature: { selection: string; html: string } | null) {
  if (!signature) return body;
  const block = `<div data-kc-signature="${signature.selection}">${signature.html}</div>`;
  const quoteAt = body.search(/<blockquote\b[^>]*data-kc-quoted-history/i);
  return quoteAt >= 0 ? `${body.slice(0, quoteAt)}${block}<br><br>${body.slice(quoteAt)}` : `${body}${body ? "<br><br>" : ""}${block}`;
}

export async function sendMail(admin: AdminUser, input: { requestId: string; threadId?: string; draftId?: string; identityId: string; signatureId?: string | null; to: string[]; cc: string[]; bcc: string[]; subject: string; html: string }) {
  if (!(await mayUseIdentity(admin, input.identityId))) throw new Error("MAIL_IDENTITY_FORBIDDEN");
  const client = createSupabaseAdminClient();
  const { data: completed } = await client.from("mail_messages").select("id,thread_id,sender_identity_id").eq("client_request_id", input.requestId).maybeSingle();
  if (completed) {
    if (completed.sender_identity_id !== input.identityId || !(await mayAccessThread(admin, completed.thread_id))) throw new Error("MAIL_FORBIDDEN");
    return { threadId: completed.thread_id, messageId: completed.id };
  }
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await client.from("mail_audit_events").select("id", { count: "exact", head: true }).eq("actor_id", admin.uid).eq("action", "mail_message_sent").gte("created_at", minuteAgo);
  if ((count || 0) >= 10) throw new Error("MAIL_RATE_LIMIT");
  const { data: identity } = await client.from("mail_identities").select("id,email,display_name,status").eq("id", input.identityId).eq("status", "active").single();
  if (!identity) throw new Error("MAIL_IDENTITY_FORBIDDEN");
  let threadId = input.threadId;
  if (threadId && !(await mayAccessThread(admin, threadId))) throw new Error("MAIL_FORBIDDEN");
  if (!threadId) { const created = await client.from("mail_threads").upsert({ id: input.requestId, identity_id: identity.id, subject: input.subject || "(Sin asunto)", assigned_to: admin.uid, snippet: textFromHtml(input.html).slice(0, 500), created_by: admin.uid }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle(); if (created.error) throw created.error; threadId = created.data?.id || input.requestId; }
  const { data: previous } = await client.from("mail_messages").select("message_id,reference_ids").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const cleanBody = sanitizeMailHtml(input.html);
  const resolvedSignature = await resolveSignature(admin, input.identityId, input.signatureId);
  const cleanHtml = insertSignatureBeforeQuote(cleanBody, resolvedSignature); const cleanText = textFromHtml(cleanHtml);
  const providerAttachments: Array<{ filename: string; content: Buffer }> = [];
  if (input.draftId) {
    const { data: ownedDraft } = await client.from("mail_drafts").select("id").eq("id", input.draftId).eq("owner_id", admin.uid).maybeSingle();
    if (!ownedDraft) throw new Error("MAIL_FORBIDDEN");
    const { data: attachments } = await client.from("mail_attachments").select("storage_path,filename,size_bytes").eq("draft_id", input.draftId);
    if ((attachments || []).reduce((sum, item) => sum + Number(item.size_bytes), 0) > 25 * 1024 * 1024) throw new Error("MAIL_ATTACHMENT_LIMIT");
    for (const attachment of attachments || []) { const file = await client.storage.from("mail-attachments").download(attachment.storage_path); if (file.error || !file.data) throw new Error("MAIL_ATTACHMENT_MISSING"); providerAttachments.push({ filename: attachment.filename, content: Buffer.from(await file.data.arrayBuffer()) }); }
  }
  const headers: Record<string, string> = {}; if (previous?.message_id) { headers["In-Reply-To"] = previous.message_id; headers.References = [...(previous.reference_ids || []), previous.message_id].slice(-50).join(" "); }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const delivery = await resend.emails.send({ from: `${identity.display_name} <${identity.email}>`, to: input.to, cc: input.cc.length ? input.cc : undefined, bcc: input.bcc.length ? input.bcc : undefined, subject: input.subject || "(Sin asunto)", html: cleanHtml || "<p></p>", text: cleanText, headers, attachments: providerAttachments.length ? providerAttachments : undefined }, { idempotencyKey: `mail/${admin.uid}/${input.requestId}` });
  if (delivery.error || !delivery.data?.id) throw new Error("MAIL_PROVIDER_FAILED");
  let providerMessageId = "";
  for (let attempt = 0; attempt < 4 && !providerMessageId; attempt += 1) {
    const providerEmail = await resend.emails.get(delivery.data.id);
    providerMessageId = String((providerEmail.data as ({ message_id?: string } | null))?.message_id || "");
    if (!providerMessageId && attempt < 3) await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
  }
  if (!providerMessageId) throw new Error("MAIL_PROVIDER_METADATA_PENDING");
  const now = new Date().toISOString();
  const inserted = await client.from("mail_messages").insert({ thread_id: threadId, direction: "outbound", delivery_status: "sent", provider_email_id: delivery.data.id, client_request_id: input.requestId, message_id: providerMessageId, in_reply_to: previous?.message_id || null, reference_ids: previous?.message_id ? [...(previous.reference_ids || []), previous.message_id].slice(-50) : [], from_address: { email: identity.email, name: identity.display_name }, to_addresses: input.to.map((email) => ({ email })), cc_addresses: input.cc.map((email) => ({ email })), bcc_addresses: input.bcc.map((email) => ({ email })), subject: input.subject || "(Sin asunto)", body_html: cleanHtml, body_text: cleanText, sent_by: admin.uid, sender_identity_id: identity.id, sender_snapshot: { userId: admin.uid, name: admin.displayName || admin.email, identity: identity.email }, signature_snapshot: resolvedSignature ? { selection: resolvedSignature.selection, source: resolvedSignature.source, version: resolvedSignature.version, name: resolvedSignature.name, logoUrl: resolvedSignature.logoUrl, html: resolvedSignature.html } : {}, sent_at: now }).select("id").single();
  if (inserted.error) throw inserted.error;
  if (input.draftId) { await client.from("mail_attachments").update({ draft_id: null, message_id: inserted.data.id }).eq("draft_id", input.draftId); await client.from("mail_drafts").delete().eq("id", input.draftId).eq("owner_id", admin.uid); }
  await Promise.all([client.from("mail_threads").update({ state: "inbox", subject: input.subject || "(Sin asunto)", snippet: cleanText.slice(0, 500), latest_message_at: now, updated_at: now }).eq("id", threadId), client.from("mail_audit_events").insert({ action: "mail_message_sent", actor_id: admin.uid, identity_id: identity.id, thread_id: threadId, message_id: inserted.data.id, safe_metadata: { provider: "resend" } })]);
  return { threadId, messageId: inserted.data.id };
}
