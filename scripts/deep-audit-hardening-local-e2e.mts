import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(execFileSync("cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase status --output json"], {
  encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
}));
const url = String(status.API_URL);
if (!new URL(url).hostname.match(/^(127\.0\.0\.1|localhost)$/)) throw new Error("This test only runs against loopback Supabase.");
const service = createClient(url, String(status.SECRET_KEY), { auth: { persistSession: false, autoRefreshToken: false } });
const publishable = String(status.PUBLISHABLE_KEY);
const password = "Audit-Local-Only-2026!";
const users = {
  owner: { id: "71000000-0000-4000-8000-000000000001", email: "owner.deep-audit@example.test", role: "owner" },
  sales: { id: "71000000-0000-4000-8000-000000000002", email: "sales.deep-audit@example.test", role: "sales_agent" },
  second: { id: "71000000-0000-4000-8000-000000000003", email: "second.deep-audit@example.test", role: "sales_agent" },
} as const;

for (const user of Object.values(users)) {
  const created = await service.auth.admin.createUser({ id: user.id, email: user.email, password, email_confirm: true });
  if (created.error && created.error.status !== 422) throw created.error;
}
const now = new Date().toISOString();
const profiles = await service.from("profiles").upsert(Object.values(users).map((user) => ({
  id: user.id, name: user.role === "owner" ? "Owner fixture" : "Sales fixture", email: user.email,
  role: user.role, active: true, created_at: now, updated_at: now,
})));
if (profiles.error) throw profiles.error;

const username = await service.rpc("admin_update_profile", {
  p_target: users.sales.id, p_changes: { username: "NicoleGuerra" }, p_actor: users.owner.id,
});
if (username.error) throw username.error;
const profile = await service.from("profiles").select("username,username_canonical").eq("id", users.sales.id).single();
if (profile.error) throw profile.error;
assert.deepEqual(profile.data, { username: "NicoleGuerra", username_canonical: "nicoleguerra" });
const duplicate = await service.rpc("admin_update_profile", {
  p_target: users.second.id, p_changes: { username: "NICOLEGuerra" }, p_actor: users.owner.id,
});
assert.ok(duplicate.error, "canonical username uniqueness must be concurrency safe");
const changed = await service.rpc("admin_update_profile", {
  p_target: users.sales.id, p_changes: { username: "nicole.guerra" }, p_actor: users.owner.id,
});
if (changed.error) throw changed.error;
const history = await service.from("username_history").select("username_canonical,reserved_until,permanently_reserved").eq("profile_id", users.sales.id).single();
if (history.error) throw history.error;
assert.equal(history.data.username_canonical, "nicoleguerra");
assert.equal(history.data.permanently_reserved, false);
assert.ok(Date.parse(history.data.reserved_until) > Date.now());

const preferences = await service.from("user_notification_preferences").upsert({
  profile_id: users.sales.id, internal_enabled: true, push_enabled: false, email_enabled: false,
  event_preferences: {
    mail_received: { crm: true, push: true, email: true }, task_assigned: { crm: false, push: true, email: true },
    follow_up: { crm: true, push: true, email: true }, billing: { crm: true, push: true, email: true },
    proposal_activity: { crm: true, push: true, email: false }, team_activity: { crm: true, push: false, email: false },
  },
});
if (preferences.error) throw preferences.error;
const suppressed = await service.from("notifications").insert({
  firebase_id: `deep-audit-suppressed-${crypto.randomUUID()}`, recipient_id: users.sales.id,
  title: "Suppressed fixture", message: "Local only", type: "task_assigned", severity: "info",
}).select("id");
if (suppressed.error) throw suppressed.error;
assert.equal(suppressed.data.length, 0, "personal CRM preference suppresses the transactional internal insert");

const taskId = "72000000-0000-4000-8000-000000000001";
const taskInsert = await service.from("tasks").insert({
  id: taskId, firebase_id: "deep-audit-task", title: "Local assignment", type: "follow_up", status: "pending",
  priority: "medium", timezone: "America/Tegucigalpa", assigned_to: users.sales.id, assigned_at: now,
  created_by: users.owner.id, legacy_data: {}, created_at: now, updated_at: now,
});
if (taskInsert.error) throw taskInsert.error;
const queuedTask = await service.from("assignment_notification_events").select("id,event_type,recipient_id,state").eq("entity_id", taskId).single();
if (queuedTask.error) throw queuedTask.error;
assert.deepEqual({ event_type: queuedTask.data.event_type, recipient_id: queuedTask.data.recipient_id, state: queuedTask.data.state }, { event_type: "task_assigned", recipient_id: users.sales.id, state: "pending" });
const worker = crypto.randomUUID();
const claim = await service.rpc("claim_assignment_notification_events", { p_worker: worker, p_limit: 10, p_event_type: "task_assigned", p_entity_id: taskId, p_now: now });
if (claim.error) throw claim.error;
assert.equal(claim.data.length, 1);
assert.equal((await service.rpc("claim_assignment_notification_events", { p_worker: crypto.randomUUID(), p_limit: 10, p_event_type: "task_assigned", p_entity_id: taskId, p_now: now })).data.length, 0);
const complete = await service.rpc("complete_assignment_notification_event", { p_id: claim.data[0].id, p_worker: claim.data[0].lease_token, p_succeeded: true, p_now: now });
if (complete.error) throw complete.error;
assert.equal(complete.data, true);

const lead = await service.rpc("create_public_lead", { p_payload: {
  name: "Local Lead", business: "Example", email: "lead.deep-audit@example.test", phone: "+504 0000-0000",
  project: "Audit", budget: "USD", message: "Local only", locale: "es", sourcePath: "/contacto",
  submissionId: "73000000-0000-4000-8000-000000000001", metadata: {}, createdAt: now, updatedAt: now,
} });
if (lead.error) throw lead.error;
const assignment = await service.from("leads").update({ assigned_to: users.sales.id, assigned_at: now, assigned_by: users.owner.id }).eq("id", lead.data);
if (assignment.error) throw assignment.error;
assert.equal((await service.from("assignment_notification_events").select("id", { count: "exact", head: true }).eq("entity_id", lead.data).eq("event_type", "lead_assigned")).count, 1);

const identity = await service.from("mail_identities").insert({ local_part: "deep-audit", display_name: "Deep Audit", created_by: users.owner.id }).select("id").single();
if (identity.error) throw identity.error;
const firstSignature = await service.rpc("publish_corporate_mail_signature", {
  p_current: null, p_identity: identity.data.id, p_name: "Ken Code", p_body_html: "<p>{{USER_NAME}}</p>", p_logo_url: null, p_actor: users.owner.id,
});
if (firstSignature.error) throw firstSignature.error;
const secondSignature = await service.rpc("publish_corporate_mail_signature", {
  p_current: firstSignature.data.id, p_identity: identity.data.id, p_name: "Ken Code", p_body_html: "<p>{{USER_NAME}} · {{CORPORATE_EMAIL}}</p>", p_logo_url: null, p_actor: users.owner.id,
});
if (secondSignature.error) throw secondSignature.error;
assert.equal(secondSignature.data.version, 2);
assert.equal((await service.from("corporate_mail_signatures").select("id", { count: "exact", head: true }).eq("identity_id", identity.data.id).eq("active", true)).count, 1);
assert.equal((await service.from("corporate_mail_signatures").select("id", { count: "exact", head: true }).eq("logical_id", (await service.from("corporate_mail_signatures").select("logical_id").eq("id", firstSignature.data.id).single()).data?.logical_id)).count, 2);

const firstTemplate = await service.rpc("publish_mail_template", { p_current: null, p_name: "Seguimiento", p_subject: "Seguimiento", p_body_html: "<p>Hola</p>", p_active: true, p_actor: users.owner.id });
if (firstTemplate.error) throw firstTemplate.error;
const secondTemplate = await service.rpc("publish_mail_template", { p_current: firstTemplate.data.id, p_name: "Seguimiento", p_subject: "Seguimiento", p_body_html: "<p>Hola de nuevo</p>", p_active: true, p_actor: users.owner.id });
if (secondTemplate.error) throw secondTemplate.error;
assert.equal(secondTemplate.data.version, 2);
assert.equal((await service.from("mail_templates").select("id", { count: "exact", head: true }).eq("active", true)).count, 1);

const browser = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await browser.auth.signInWithPassword({ email: users.sales.email, password });
if (signedIn.error) throw signedIn.error;
assert.ok((await browser.from("assignment_notification_events").select("id")).error, "assignment outbox is service-only");

console.log(JSON.stringify({
  target: "loopback-only", username: "PASS", usernameHistory: "PASS", internalPreference: "PASS",
  assignmentOutbox: { task: "PASS", lead: "PASS", lease: "PASS", idempotency: "PASS" },
  corporateSignatureVersions: 2, templateVersions: 2, serviceOnlyOutbox: "PASS", externalDeliveriesAttempted: 0,
}, null, 2));
