import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_LOCAL_URL;
const publishableKey = process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY;
const mailpitUrl = process.env.SUPABASE_LOCAL_MAILPIT_URL;
if (!url || !publishableKey || !serviceKey || !mailpitUrl) throw new Error("Local Supabase test environment is incomplete.");
for (const candidate of [url, mailpitUrl]) {
  const parsed = new URL(candidate);
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") throw new Error("Local E2E refuses non-loopback services.");
}

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const password = "Sanitized-Pass-2026!";
const changedPassword = "Changed-Pass-2026!";
const identities = [
  { id: "10000000-0000-4000-8000-000000000001", email: "owner.m2b@example.test", role: "owner", active: true },
  { id: "10000000-0000-4000-8000-000000000002", email: "admin.m2b@example.test", role: "admin", active: true },
  { id: "10000000-0000-4000-8000-000000000003", email: "sales-a.m2b@example.test", role: "sales_agent", active: true },
  { id: "10000000-0000-4000-8000-000000000004", email: "sales-b.m2b@example.test", role: "sales_agent", active: true },
  { id: "10000000-0000-4000-8000-000000000005", email: "inactive.m2b@example.test", role: "viewer", active: false },
  { id: "10000000-0000-4000-8000-000000000006", email: "manager.m2b@example.test", role: "manager", active: true },
] as const;

for (const identity of identities) {
  const { error } = await service.auth.admin.createUser({ id: identity.id, email: identity.email, password, email_confirm: true });
  if (error && error.status !== 422) throw error;
  const reset = await service.auth.admin.updateUserById(identity.id, { password, email_confirm: true });
  if (reset.error) throw reset.error;
}
const now = new Date().toISOString();
const { error: profilesError } = await service.from("profiles").upsert(identities.map((identity) => ({
  id: identity.id,
  name: "Sanitized local fixture",
  email: identity.email,
  role: identity.role,
  active: identity.active,
  created_at: now,
  updated_at: now,
})));
if (profilesError) throw profilesError;

const cutoverResult = await service.from("admin_settings").select("automation_cutover_at,automation_baseline_completed_at").eq("id", "default").single();
if (cutoverResult.error || !cutoverResult.data.automation_cutover_at || !cutoverResult.data.automation_baseline_completed_at) throw cutoverResult.error ?? new Error("Automation baseline is missing.");
const reminderNow = new Date(Date.parse(cutoverResult.data.automation_cutover_at) + 2 * 24 * 60 * 60 * 1000);
const reminderTaskId = "30000000-0000-4000-8000-000000000001";
const { error: reminderFixtureCleanupError } = await service.from("tasks").delete().eq("id", reminderTaskId);
if (reminderFixtureCleanupError) throw reminderFixtureCleanupError;
const { error: reminderTaskError } = await service.from("tasks").insert({
  id: reminderTaskId,
  firebase_id: "local-reminder-task",
  title: "Sanitized reminder fixture",
  description: "",
  type: "follow_up",
  status: "pending",
  priority: "medium",
  timezone: "America/Tegucigalpa",
  due_at: new Date(reminderNow.getTime() + 30 * 60 * 1000).toISOString(),
  assigned_to: identities[2].id,
  assigned_at: now,
  created_by: identities[0].id,
  legacy_data: {},
  created_at: now,
  updated_at: now,
});
if (reminderTaskError) throw reminderTaskError;
const firstQueue = await service.rpc("enqueue_due_reminder_events", { p_now: reminderNow.toISOString() });
const secondQueue = await service.rpc("enqueue_due_reminder_events", { p_now: reminderNow.toISOString() });
if (firstQueue.error || secondQueue.error) throw firstQueue.error ?? secondQueue.error;
assert.equal(firstQueue.data, 1);
assert.equal(secondQueue.data, 0);
const { count: reminderCount, error: reminderCountError } = await service.from("reminder_events").select("id", { count: "exact", head: true });
if (reminderCountError) throw reminderCountError;
assert.equal(reminderCount, 1);
const claimed = await service.rpc("claim_due_reminder_events", { p_now: reminderNow.toISOString(), p_limit: 10 });
if (claimed.error) throw claimed.error;
assert.equal(claimed.data.length, 1);
const concurrentClaim = await service.rpc("claim_due_reminder_events", { p_now: reminderNow.toISOString(), p_limit: 10 });
if (concurrentClaim.error) throw concurrentClaim.error;
assert.equal(concurrentClaim.data.length, 0);
const completedReminder = await service.rpc("complete_reminder_event", {
  p_id: claimed.data[0].id, p_lease: claimed.data[0].lease_token, p_notification_status: "skipped", p_email_status: "skipped", p_push_status: "skipped", p_now: reminderNow.toISOString(),
});
if (completedReminder.error) throw completedReminder.error;
assert.equal(completedReminder.data, true);
const completedRow = await service.from("reminder_events").select("status,attempts").eq("id", claimed.data[0].id).single();
if (completedRow.error) throw completedRow.error;
assert.deepEqual(completedRow.data, { status: "completed", attempts: 1 });

const notifications = [
  { id: "20000000-0000-4000-8000-000000000001", firebase_id: "local-owner-own", recipient_id: identities[0].id, title: "Owner", message: "Fixture" },
  { id: "20000000-0000-4000-8000-000000000002", firebase_id: "local-admin-own", recipient_id: identities[1].id, title: "Admin", message: "Fixture" },
  { id: "20000000-0000-4000-8000-000000000003", firebase_id: "local-agent-a", recipient_id: identities[2].id, title: "Agent A", message: "Fixture" },
  { id: "20000000-0000-4000-8000-000000000004", firebase_id: "local-agent-b", recipient_id: identities[3].id, title: "Agent B", message: "Fixture" },
  { id: "20000000-0000-4000-8000-000000000005", firebase_id: "local-legacy", recipient_id: null, title: "Legacy", message: "Fixture" },
].map((row) => ({ ...row, type: "system", severity: "info", is_read: false, read_at: null, legacy_data: {}, created_at: now, updated_at: now }));
const { error: notificationsError } = await service.from("notifications").upsert(notifications);
if (notificationsError) throw notificationsError;

async function authenticated(email: string, candidatePassword = password) {
  const client = createClient(url!, publishableKey!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: candidatePassword });
  if (error) throw error;
  return client;
}
async function visibleNotificationIds(email: string) {
  const client = await authenticated(email);
  const { data, error } = await client.from("notifications").select("id").order("id");
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

assert.deepEqual(await visibleNotificationIds(identities[0].email), [notifications[0].id, notifications[4].id]);
assert.deepEqual(await visibleNotificationIds(identities[1].email), [notifications[1].id, notifications[4].id]);
assert.deepEqual(await visibleNotificationIds(identities[2].email), [notifications[2].id]);
assert.deepEqual(await visibleNotificationIds(identities[3].email), [notifications[3].id]);
assert.deepEqual(await visibleNotificationIds(identities[4].email), []);

const mutationOwner = await authenticated(identities[0].email);
const mutationAgentA = await authenticated(identities[2].email);
const mutationAgentB = await authenticated(identities[3].email);
const mutationManager = await authenticated(identities[5].email);
const publicLeadPayload = {
  name: "Sanitized local lead", business: "Example fixture", email: "lead.m2b@example.test", phone: "+504 0000-0000",
  project: "Local readiness", budget: "USD", message: "Sanitized local-only mutation fixture", locale: "es", sourcePath: "/contacto",
  submissionId: "40000000-0000-4000-8000-000000000001",
  metadata: { fixture: true }, createdAt: now, updatedAt: now,
};
const publicLead = await service.rpc("create_public_lead", { p_payload: publicLeadPayload });
if (publicLead.error || !publicLead.data) throw publicLead.error ?? new Error("Local public lead was not created.");
const leadId = String(publicLead.data);
const duplicatePublicLead = await service.rpc("create_public_lead", { p_payload: publicLeadPayload });
if (duplicatePublicLead.error) throw duplicatePublicLead.error;
assert.equal(String(duplicatePublicLead.data), leadId);
const publicLeadCount = await service.from("leads").select("id", { count: "exact", head: true }).eq("public_submission_key", publicLeadPayload.submissionId);
if (publicLeadCount.error) throw publicLeadCount.error;
assert.equal(publicLeadCount.count, 1);
const publicLeadNotifications = await service.from("notifications").select("recipient_id,action_url").eq("lead_id", leadId).eq("type", "lead_new");
if (publicLeadNotifications.error) throw publicLeadNotifications.error;
assert.deepEqual(new Set(publicLeadNotifications.data.map((row) => row.recipient_id)), new Set([identities[0].id, identities[1].id, identities[5].id]));
assert.ok(publicLeadNotifications.data.every((row) => row.action_url === `/admin/leads/${leadId}`));
assert.equal((await mutationManager.from("notifications").select("id").eq("lead_id", leadId)).data?.length, 1);
assert.equal((await mutationAgentA.from("notifications").select("id").eq("lead_id", leadId)).data?.length, 0);
const assignment = await mutationOwner.rpc("crm_write", { p_operation: "lead_assign", p_payload: { id: leadId, assignedToUid: identities[2].id } });
if (assignment.error) throw assignment.error;
assert.equal(assignment.data.changed, true);
const duplicateAssignment = await mutationOwner.rpc("crm_write", { p_operation: "lead_assign", p_payload: { id: leadId, assignedToUid: identities[2].id } });
if (duplicateAssignment.error) throw duplicateAssignment.error;
assert.equal(duplicateAssignment.data.changed, false);
assert.equal((await mutationAgentA.rpc("crm_write", { p_operation: "lead_update", p_payload: { id: leadId, updates: { priority: "high" } } })).error, null);
assert.equal((await mutationManager.rpc("crm_write", { p_operation: "lead_update", p_payload: { id: leadId, updates: { status: "contacted" } } })).error, null);
assert.ok((await mutationAgentB.rpc("crm_write", { p_operation: "lead_update", p_payload: { id: leadId, updates: { priority: "low" } } })).error);
const note = await mutationAgentA.rpc("crm_write", { p_operation: "note_add", p_payload: { leadId, body: "Sanitized local note" } });
if (note.error || !note.data?.id) throw note.error ?? new Error("Local note was not created.");
const task = await mutationAgentA.rpc("crm_write", { p_operation: "task_create", p_payload: { input: { title: "Sanitized local task", leadId, date: "2026-09-01", time: "09:00", assignedToUid: identities[2].id } } });
if (task.error || !task.data?.id) throw task.error ?? new Error("Local task was not created.");
assert.equal((await mutationAgentA.rpc("crm_write", { p_operation: "task_update", p_payload: { id: task.data.id, updates: { status: "completed" } } })).error, null);
assert.ok((await mutationAgentB.rpc("crm_write", { p_operation: "task_update", p_payload: { id: task.data.id, updates: { status: "pending" } } })).error);
assert.equal((await mutationOwner.rpc("crm_write", { p_operation: "task_delete", p_payload: { id: task.data.id } })).error, null);
const ownerNotification = (await mutationOwner.from("notifications").select("id").eq("recipient_id", identities[0].id).limit(1)).data?.[0];
if (!ownerNotification) throw new Error("Local owner notification missing.");
assert.equal((await mutationOwner.rpc("crm_write", { p_operation: "notification_read", p_payload: { id: ownerNotification.id, read: true } })).error, null);
assert.equal((await mutationOwner.rpc("crm_write", { p_operation: "settings_update", p_payload: { settings: {
  emailNotificationsEnabled: true, pushNotificationsEnabled: true, internalNotificationsEnabled: true,
  taskReminder1DayEnabled: true, taskReminder1HourEnabled: true, taskDueEnabled: true, taskOverdueEnabled: true,
  dailySummaryEnabled: false, notificationSoundEnabled: true, compactModeEnabled: false,
} } })).error, null);
const deletedLead = await mutationOwner.rpc("delete_lead_cascade", { p_lead: leadId });
if (deletedLead.error) throw deletedLead.error;
assert.equal(deletedLead.data.leads, 1);
const anonymous = createClient(url, publishableKey, { auth: { persistSession: false } });
assert.ok((await anonymous.rpc("crm_write", { p_operation: "notifications_read_all", p_payload: {} })).error);

const wrongPasswordClient = createClient(url, publishableKey, { auth: { persistSession: false } });
assert.ok((await wrongPasswordClient.auth.signInWithPassword({ email: identities[0].email, password: "Definitely-Wrong-2026!" })).error);

type MailMessage = { ID?: string; Id?: string; Subject?: string };
async function messages(): Promise<MailMessage[]> {
  const response = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!response.ok) throw new Error("Local email sink is unavailable.");
  const body = await response.json() as { messages?: MailMessage[] } | MailMessage[];
  return Array.isArray(body) ? body : body.messages ?? [];
}
async function waitForMessage(subjectFragment: string, previousIds: Set<string>) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const found = (await messages()).find((message) => {
      const id = message.ID ?? message.Id ?? "";
      return !previousIds.has(id) && String(message.Subject ?? "").includes(subjectFragment);
    });
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Expected local email was not captured (${subjectFragment}).`);
}
async function messageBody(message: MailMessage) {
  const id = message.ID ?? message.Id;
  if (!id) throw new Error("Local email has no message ID.");
  const response = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
  if (!response.ok) throw new Error("Local email body is unavailable.");
  return await response.json() as Record<string, unknown>;
}
function confirmationUrl(body: Record<string, unknown>) {
  const html = String(body.HTML ?? body.Html ?? body.Text ?? "").replaceAll("&amp;", "&");
  const href = html.match(/href=["']([^"']+)["']/i)?.[1];
  if (!href) throw new Error("Local security email has no confirmation URL.");
  return new URL(href);
}

let before = new Set((await messages()).map((message) => message.ID ?? message.Id ?? ""));
const recoveryClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const { error: recoveryRequestError } = await recoveryClient.auth.resetPasswordForEmail(identities[1].email, { redirectTo: "http://127.0.0.1:3000/auth/callback?next=/admin/recovery" });
if (recoveryRequestError) throw recoveryRequestError;
const recoveryMessage = await waitForMessage("Recupere", before);
const recoveryLink = confirmationUrl(await messageBody(recoveryMessage));
const recoveryHash = recoveryLink.searchParams.get("token") ?? recoveryLink.searchParams.get("token_hash");
if (!recoveryHash) throw new Error("Recovery token hash missing.");
assert.ok((await recoveryClient.auth.verifyOtp({ token_hash: recoveryHash, type: "recovery" })).data.session);
assert.equal((await recoveryClient.auth.updateUser({ password: changedPassword })).error, null);
assert.equal((await authenticated(identities[1].email, changedPassword)).auth !== undefined, true);
assert.ok((await createClient(url, publishableKey).auth.verifyOtp({ token_hash: "invalid-local-token", type: "recovery" })).error);

before = new Set((await messages()).map((message) => message.ID ?? message.Id ?? ""));
const inviteEmail = `invite.${crypto.randomUUID().slice(0, 8)}.m2b@example.test`;
const { data: invitation, error: invitationError } = await service.auth.admin.inviteUserByEmail(inviteEmail, { redirectTo: "http://127.0.0.1:3000/auth/callback?next=/admin/recovery?invitation=1" });
if (invitationError || !invitation.user) throw invitationError ?? new Error("Local invitation user missing.");
const { error: inviteProfileError } = await service.from("profiles").insert({ id: invitation.user.id, name: "Invited fixture", email: inviteEmail, role: "viewer", active: true });
if (inviteProfileError) throw inviteProfileError;
const inviteMessage = await waitForMessage("Invitación", before);
assert.equal((await messageBody(inviteMessage)).Subject?.toString().includes("Ken Code"), true);

before = new Set((await messages()).map((message) => message.ID ?? message.Id ?? ""));
const ownerClient = await authenticated(identities[0].email);
const { error: reauthError } = await ownerClient.auth.reauthenticate();
if (reauthError) throw reauthError;
const reauthMessage = await waitForMessage("Código de verificación", before);
const reauthBody = await messageBody(reauthMessage);
const reauthText = `${String(reauthBody.Text ?? "")} ${String(reauthBody.HTML ?? reauthBody.Html ?? "")}`;
const nonce = reauthText.match(/\b\d{6,8}\b/)?.[0];
if (!nonce) throw new Error("Local reauthentication OTP missing.");
assert.equal((await ownerClient.auth.updateUser({ password: changedPassword, nonce })).error, null);
await ownerClient.auth.signOut();
await authenticated(identities[0].email, changedPassword);
assert.equal((await service.rpc("record_profile_login", { p_target: identities[0].id })).error, null);
assert.equal((await service.rpc("record_password_changed", { p_target: identities[0].id })).error, null);

const localMailSubjects = (await messages()).map((message) => String(message.Subject ?? ""));
assert.ok(localMailSubjects.some((subject) => subject.includes("Recupere")));
assert.ok(localMailSubjects.some((subject) => subject.includes("Invitación")));
assert.ok(localMailSubjects.some((subject) => subject.includes("Código de verificación")));

console.log(JSON.stringify({
  target: "loopback-only",
  auth: { login: "PASS", wrongPassword: "PASS", recovery: "PASS", reauthenticationPasswordChange: "PASS", invitation: "PASS" },
  rls: { owner: "PASS", admin: "PASS", salesAgent: "PASS", inactive: "PASS" },
  reminders: { firstQueue: 1, duplicateQueue: 0, claimed: 1, concurrentClaim: 0, completed: 1, idempotency: "PASS", productionDeliveriesAttempted: 0 },
  repositories: { atomicMutations: "PASS", managerLeadUpdate: "PASS", ownershipDenial: "PASS", duplicateAssignment: "PASS", cascadeCleanup: "PASS" },
  localEmailsCaptured: { recovery: 1, invitation: 1, reauthentication: 1 },
  productionEmailsSent: 0,
  piiLogged: false,
  secretsLogged: false,
}, null, 2));
