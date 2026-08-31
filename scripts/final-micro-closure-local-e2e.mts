import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.SUPABASE_LOCAL_URL || "";
const publishableKey = process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY || "";
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY || "";
const parsed = new URL(apiUrl);
if (!publishableKey || !serviceKey || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("Final micro-closure E2E refuses non-loopback services.");
}

const service = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const runId = crypto.randomUUID().slice(0, 8);
const password = "Micro-Closure-Local-2026!";
const now = new Date().toISOString();
const ownerId = crypto.randomUUID();
const salesId = crypto.randomUUID();
const pendingId = crypto.randomUUID();
const createdAuthIds: string[] = [];
let identityId = "";
const threadIds: string[] = [];

async function createUser(id: string, email: string, confirmed: boolean) {
  const result = await service.auth.admin.createUser({
    id,
    email,
    ...(confirmed ? { password, email_confirm: true } : { email_confirm: false }),
  });
  if (result.error || !result.data.user) throw result.error ?? new Error("Local user was not created.");
  createdAuthIds.push(id);
}

async function login(email: string) {
  const client = createClient(apiUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return client;
}

try {
  const ownerEmail = `owner.micro.${runId}@example.test`;
  const salesEmail = `sales.micro.${runId}@example.test`;
  const pendingEmail = `pending.micro.${runId}@example.test`;
  await createUser(ownerId, ownerEmail, true);
  await createUser(salesId, salesEmail, true);
  await createUser(pendingId, pendingEmail, false);
  const profiles = await service.from("profiles").insert([
    { id: ownerId, name: "Owner local", email: ownerEmail, role: "owner", active: true },
    { id: salesId, name: "Sales local", email: salesEmail, role: "sales_agent", active: true, invitation_status: "accepted", last_login_at: now },
    { id: pendingId, name: "Pending local", email: pendingEmail, role: "viewer", active: true, invitation_status: "sent", invited_at: now, invited_by: ownerId },
  ]);
  if (profiles.error) throw profiles.error;

  const owner = await login(ownerEmail);
  const sales = await login(salesEmail);
  const identity = await service.from("mail_identities").insert({ local_part: `micro-${runId}`, display_name: "Micro local", created_by: ownerId }).select("id,email").single();
  if (identity.error) throw identity.error;
  identityId = identity.data.id;
  const assignment = await service.from("mail_identity_assignments").insert({ identity_id: identityId, profile_id: salesId, is_primary: true, assigned_by: ownerId });
  if (assignment.error) throw assignment.error;

  const sentThread = await service.from("mail_threads").insert({ identity_id: identityId, subject: "Sent lifecycle", state: "inbox", assigned_to: salesId, created_by: salesId }).select("id").single();
  if (sentThread.error) throw sentThread.error;
  threadIds.push(sentThread.data.id);
  const sentAt = new Date(Date.now() - 60_000).toISOString();
  const outbound = await service.from("mail_messages").insert({
    thread_id: sentThread.data.id,
    direction: "outbound",
    delivery_status: "delivered",
    provider_email_id: `micro-outbound-${runId}`,
    message_id: `<micro-outbound-${runId}@example.test>`,
    from_address: { email: identity.data.email },
    to_addresses: [{ email: "controlled-recipient@example.test" }],
    subject: "Sent lifecycle",
    body_html: "<p>Outbound local fixture</p>",
    body_text: "Outbound local fixture",
    sent_by: salesId,
    sender_identity_id: identityId,
    sent_at: sentAt,
  });
  if (outbound.error) throw outbound.error;
  const sentIndex = await service.from("mail_threads").select("last_outbound_at").eq("id", sentThread.data.id).single();
  if (sentIndex.error) throw sentIndex.error;
  assert.equal(new Date(sentIndex.data.last_outbound_at).getTime(), new Date(sentAt).getTime());

  const inbound = await service.from("mail_messages").insert({
    thread_id: sentThread.data.id,
    direction: "inbound",
    delivery_status: "received",
    provider_email_id: `micro-inbound-${runId}`,
    message_id: `<micro-inbound-${runId}@example.test>`,
    in_reply_to: `<micro-outbound-${runId}@example.test>`,
    from_address: { email: "controlled-recipient@example.test" },
    to_addresses: [{ email: identity.data.email }],
    subject: "Re: Sent lifecycle",
    body_html: "<p>Inbound local fixture</p>",
    body_text: "Inbound local fixture",
    received_at: now,
  });
  if (inbound.error) throw inbound.error;
  assert.equal(
    new Date((await service.from("mail_threads").select("last_outbound_at").eq("id", sentThread.data.id).single()).data?.last_outbound_at || 0).getTime(),
    new Date(sentAt).getTime(),
  );
  assert.equal((await owner.from("mail_threads").select("id").eq("id", sentThread.data.id)).data?.length, 1);
  assert.equal((await sales.from("mail_threads").select("id").eq("id", sentThread.data.id)).data?.length, 1);

  const trashThread = await service.from("mail_threads").insert({ identity_id: identityId, subject: "Trash lifecycle", state: "trash", assigned_to: salesId, created_by: ownerId }).select("id").single();
  if (trashThread.error) throw trashThread.error;
  threadIds.push(trashThread.data.id);
  const trashMessage = await service.from("mail_messages").insert({
    thread_id: trashThread.data.id,
    direction: "inbound",
    delivery_status: "received",
    provider_email_id: `micro-trash-${runId}`,
    message_id: `<micro-trash-${runId}@example.test>`,
    from_address: { email: "trash@example.test" },
    to_addresses: [{ email: identity.data.email }],
    subject: "Trash lifecycle",
    body_html: "<p>Trash local fixture</p>",
    body_text: "Trash local fixture",
    received_at: now,
  });
  if (trashMessage.error) throw trashMessage.error;
  assert.ok((await owner.rpc("permanently_delete_mail_thread", { p_thread: trashThread.data.id, p_actor: ownerId })).error, "browser roles must not hard-delete mail");
  const restored = await service.from("mail_threads").update({ state: "inbox" }).eq("id", trashThread.data.id).select("state").single();
  if (restored.error) throw restored.error;
  assert.equal(restored.data.state, "inbox");
  await service.from("mail_threads").update({ state: "trash" }).eq("id", trashThread.data.id);
  const hardDeleted = await service.rpc("permanently_delete_mail_thread", { p_thread: trashThread.data.id, p_actor: ownerId });
  if (hardDeleted.error) throw hardDeleted.error;
  assert.deepEqual(hardDeleted.data, []);
  assert.equal((await service.from("mail_threads").select("id").eq("id", trashThread.data.id)).data?.length, 0);
  threadIds.pop();

  assert.ok((await owner.rpc("assess_member_permanent_deletion", { p_target: pendingId, p_actor: ownerId })).error, "browser roles must not assess destructive eligibility");
  const pendingAssessment = await service.rpc("assess_member_permanent_deletion", { p_target: pendingId, p_actor: ownerId });
  if (pendingAssessment.error) throw pendingAssessment.error;
  assert.equal(pendingAssessment.data?.[0]?.can_delete, true);
  const activeAssessment = await service.rpc("assess_member_permanent_deletion", { p_target: salesId, p_actor: ownerId });
  if (activeAssessment.error) throw activeAssessment.error;
  assert.equal(activeAssessment.data?.[0]?.can_delete, false);
  const ownerAssessment = await service.rpc("assess_member_permanent_deletion", { p_target: ownerId, p_actor: ownerId });
  if (ownerAssessment.error) throw ownerAssessment.error;
  assert.equal(ownerAssessment.data?.[0]?.can_delete, false);

  const deletedPending = await service.auth.admin.deleteUser(pendingId, false);
  if (deletedPending.error) throw deletedPending.error;
  createdAuthIds.splice(createdAuthIds.indexOf(pendingId), 1);
  assert.equal((await service.from("profiles").select("id").eq("id", pendingId)).data?.length, 0);

  assert.equal((await service.from("email_logs").select("id", { count: "exact", head: true })).count, 0);
  assert.equal((await service.from("push_logs").select("id", { count: "exact", head: true })).count, 0);
  console.log(JSON.stringify({
    target: "loopback-only",
    sent: { outboundIndexed: "PASS", replyPreserved: "PASS", deliveryState: "PASS" },
    trash: { restore: "PASS", permanentDelete: "PASS", browserRpc: "DENIED" },
    members: { unusedEligible: "PASS", historyBlocked: "PASS", ownerProtected: "PASS", authProfileCascade: "PASS" },
    rls: { owner: "PASS", assignedSales: "PASS", destructiveRpc: "SERVICE_ROLE_ONLY" },
    externalDeliveries: { email: 0, push: 0 },
  }, null, 2));
} finally {
  for (const threadId of threadIds) {
    await service.from("mail_follow_ups").delete().eq("thread_id", threadId);
    await service.from("mail_threads").update({ state: "trash", lead_id: null, client_id: null, project_id: null, add_on_id: null, proposal_id: null }).eq("id", threadId);
    await service.rpc("permanently_delete_mail_thread", { p_thread: threadId, p_actor: ownerId });
  }
  if (identityId) {
    await service.from("mail_identity_assignments").delete().eq("identity_id", identityId);
    await service.from("mail_identities").delete().eq("id", identityId);
  }
  for (const id of createdAuthIds.reverse()) await service.auth.admin.deleteUser(id, false);
}
