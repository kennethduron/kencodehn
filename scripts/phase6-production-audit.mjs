import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const expectedRef = "nvtrgrltyzrkljarvwff";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const secret = process.env.SUPABASE_SECRET_KEY || "";
const resendKey = process.env.RESEND_API_KEY || "";
const parsed = new URL(url);
if (parsed.protocol !== "https:" || parsed.hostname !== `${expectedRef}.supabase.co`) throw new Error("Phase 6 audit refuses an unexpected Supabase target.");
if (!secret || !resendKey) throw new Error("Phase 6 audit requires server-only Production credentials.");

const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const count = async (table) => {
  const result = await client.from(table).select("id", { count: "exact", head: true });
  if (result.error) throw new Error(`Count failed: ${table}:${result.error.code || "unknown"}`);
  return result.count || 0;
};
const group = (rows, key) => Object.fromEntries([...new Set(rows.map((row) => String(row[key])))].sort().map((value) => [value, rows.filter((row) => String(row[key]) === value).length]));

const tables = ["profiles","leads","clients","projects","project_add_ons","add_on_proposals","add_on_sales","receivables","payments","payment_allocations","expense_categories","expenses","tasks","notifications","activity_logs","email_logs","push_logs","device_tokens","mail_identities","mail_identity_assignments","mail_threads","mail_messages","mail_drafts","mail_attachments","mail_webhook_events","mail_audit_events"];
const [counts, profilesResult, ownersResult, assignmentsResult, schedulerResult, jobsResult, webhookEventsResult, messagesResult, profileObjects, attachmentObjects] = await Promise.all([
  Promise.all(tables.map(async (table) => [table, await count(table)])),
  client.from("profiles").select("id,role,active"),
  client.from("profiles").select("id").eq("role","owner").eq("active",true),
  client.from("mail_identity_assignments").select("identity_id,profile_id,is_primary,active,mail_identities(status)").eq("active",true),
  client.from("billing_scheduler_state").select("provider,generation_schedule,delivery_schedule,configured_at").eq("id","default").maybeSingle(),
  client.from("billing_job_runs").select("job_type,status,processed,sent,failed,skipped,error_category,started_at,finished_at,duration_ms").order("started_at",{ascending:false}).limit(20),
  client.from("mail_webhook_events").select("event_type,status,received_at,processed_at,error_category").order("received_at",{ascending:false}).limit(100),
  client.from("mail_messages").select("direction,delivery_status,provider_email_id,message_id,in_reply_to,reference_ids").order("created_at",{ascending:false}).limit(100),
  client.storage.from("profile-photos").list("",{limit:1000}),
  client.storage.from("mail-attachments").list("",{limit:1000}),
]);
for (const result of [profilesResult, ownersResult, assignmentsResult, schedulerResult, jobsResult, webhookEventsResult, messagesResult, profileObjects, attachmentObjects]) if (result.error) throw new Error(`Production read failed (${result.error.message || "unknown"}).`);

let confirmedOwners = 0;
for (const owner of ownersResult.data || []) {
  const result = await client.auth.admin.getUserById(owner.id);
  if (!result.error && (result.data.user?.email_confirmed_at || result.data.user?.confirmed_at)) confirmedOwners += 1;
}

const resend = new Resend(resendKey);
const [domainsResult, webhooksResult] = await Promise.all([resend.domains.list(), resend.webhooks.list()]);
if (domainsResult.error) throw new Error("Resend domain audit failed.");
if (webhooksResult.error) throw new Error("Resend webhook audit failed.");
const domain = domainsResult.data?.data?.find((item) => item.name === "kencodehn.com");
const webhooks = (webhooksResult.data?.data || []).map((item) => {
  const endpoint = new URL(item.endpoint);
  return { endpoint: `${endpoint.origin}${endpoint.pathname}`, status: item.status, events: [...item.events].sort() };
});

const jobs = jobsResult.data || [];
const webhookEvents = webhookEventsResult.data || [];
const messages = messagesResult.data || [];
const report = {
  target: { projectRef: expectedRef, projectName: "kencodehn", organization: "Ken Code" },
  providers: { auth: process.env.CRM_AUTH_PROVIDER, data: process.env.CRM_DATA_PROVIDER, fcmServerConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY), webPushSenderConfigured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID), webPushVapidConfigured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) },
  legacyEnvNamesPresent: ["NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY"].filter((name) => Boolean(process.env[name])),
  counts: Object.fromEntries(counts),
  profiles: { byRole: group(profilesResult.data || [], "role"), active: (profilesResult.data || []).filter((row) => row.active).length, inactive: (profilesResult.data || []).filter((row) => !row.active).length, activeOwners: (ownersResult.data || []).length, confirmedActiveOwners: confirmedOwners },
  mailIdentityAssignments: { active: (assignmentsResult.data || []).length, primary: (assignmentsResult.data || []).filter((row) => row.is_primary).length, activeIdentity: (assignmentsResult.data || []).filter((row) => { const identity = Array.isArray(row.mail_identities) ? row.mail_identities[0] : row.mail_identities; return identity?.status === "active"; }).length },
  scheduler: schedulerResult.data,
  naturalJobs: { inspected: jobs.length, byType: group(jobs,"job_type"), byStatus: group(jobs,"status"), sent: jobs.reduce((sum,row)=>sum+row.sent,0), failed: jobs.reduce((sum,row)=>sum+row.failed,0), latestStartedAt: jobs[0]?.started_at || null },
  resend: { domain: domain ? { status: domain.status, region: domain.region } : null, webhooks },
  webhookEvents: { inspected: webhookEvents.length, byType: group(webhookEvents,"event_type"), byStatus: group(webhookEvents,"status"), failed: webhookEvents.filter((row)=>row.status==="failed").length },
  messages: { inspected: messages.length, byDirection: group(messages,"direction"), byDelivery: group(messages,"delivery_status"), providerIdsPresent: messages.filter((row)=>Boolean(row.provider_email_id)).length, messageIdsPresent: messages.filter((row)=>Boolean(row.message_id)).length, repliesWithParent: messages.filter((row)=>Boolean(row.in_reply_to)).length },
  storage: { profilePhotos: profileObjects.data?.length || 0, mailAttachments: attachmentObjects.data?.length || 0 },
};
console.log(JSON.stringify(report,null,2));
