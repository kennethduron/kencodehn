import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const status = process.env.SUPABASE_LOCAL_URL && process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY && process.env.SUPABASE_LOCAL_SERVICE_KEY
  ? { API_URL: process.env.SUPABASE_LOCAL_URL, PUBLISHABLE_KEY: process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY, SECRET_KEY: process.env.SUPABASE_LOCAL_SERVICE_KEY }
  : JSON.parse(execFileSync("cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase status --output json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
assert.ok(["127.0.0.1", "localhost"].includes(new URL(status.API_URL).hostname), "Loopback only");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SECRET_KEY || status.SERVICE_ROLE_KEY, options);
const run = crypto.randomUUID().slice(0, 8);
const password = "Identity-Local-Only-2026!";
const roles = ["owner", "admin", "manager", "sales_agent", "viewer", "sales_agent"];
const people: Array<{ id: string; email: string; role: string; client: ReturnType<typeof createClient> }> = [];
for (const [index, role] of roles.entries()) {
  const email = `identity.${role}.${index}.${run}@example.test`;
  const user = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(user.error);
  const id = user.data.user!.id;
  assert.ifError((await service.from("profiles").upsert({ id, email, name: `Identity ${role}`, display_name: `Identity ${role}`, role, active: true })).error);
  const client = createClient(status.API_URL, status.PUBLISHABLE_KEY || status.ANON_KEY, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  people.push({ id, email, role, client });
}
const owner = people[0];
const made = await service.from("mail_identities").insert([0, 1].map((n) => ({ local_part: `identity-${run}-${n}`, display_name: "Old name", created_by: owner.id }))).select("*");
assert.ifError(made.error);
const [identity, other] = made.data!;
const thread = await service.from("mail_threads").insert({ identity_id: identity.id, subject: "Historical fixture", created_by: owner.id }).select("*").single(); assert.ifError(thread.error);
const message = await service.from("mail_messages").insert({ thread_id: thread.data.id, direction: "outbound", delivery_status: "sent", from_address: { email: identity.email, name: "Old name" }, to_addresses: [{ email: "fixture@example.test" }], body_text: "Immutable fixture; never delivered", sender_identity_id: identity.id, sent_by: owner.id, sent_at: new Date().toISOString() }).select("*").single(); assert.ifError(message.error);
const threadSnapshot = (await service.from("mail_threads").select("*").eq("id", thread.data.id).single()).data;
async function mutate(action: string, identityId = identity.id, profileId: string | null = null, previous: string | null = null, displayName: string | null = null) {
  const result = await owner.client.rpc("manage_mail_identity", { p_identity_id: identityId, p_action: action, p_profile_id: profileId, p_previous_profile_id: previous, p_display_name: displayName });
  assert.ifError(result.error);
}
async function assignments() { const result = await service.from("mail_identity_assignments").select("*").in("identity_id", [identity.id, other.id]).order("id"); assert.ifError(result.error); return result.data!; }
async function available(userId: string) { const result = await service.from("mail_identities").select("id,mail_identity_assignments!inner(profile_id,active,is_primary)").eq("status", "active").eq("mail_identity_assignments.profile_id", userId).eq("mail_identity_assignments.active", true); assert.ifError(result.error); return result.data!; }
for (const person of people.slice(1)) {
  for (const action of ["edit", "reactivate", "deactivate", "assign", "unassign", "reassign", "primary", "remove_primary"]) {
    assert.equal((await person.client.rpc("manage_mail_identity", { p_identity_id: identity.id, p_action: action, p_profile_id: person.id, p_display_name: "Denied" })).error?.code, "42501", `${person.role} denied ${action}`);
  }
  const direct = await person.client.from("mail_identities").update({ display_name: "Denied" }).eq("id", identity.id).select("id");
  assert.ok(direct.error || direct.data?.length === 0, "RLS denies direct writes");
  assert.equal((await service.from("mail_identities").select("display_name").eq("id", identity.id).single()).data.display_name, "Old name");
}
await mutate("assign", identity.id, owner.id);
await mutate("primary", identity.id, owner.id);
assert.equal((await available(owner.id)).find((row) => row.id === identity.id)?.mail_identity_assignments[0].is_primary, true);
const beforeDeactivate = await assignments();
await mutate("deactivate");
assert.deepEqual(await assignments(), beforeDeactivate, "Deactivation preserves assignment and primary preference");
assert.equal((await available(owner.id)).some((row) => row.id === identity.id), false);
await mutate("reactivate");
assert.deepEqual(await assignments(), beforeDeactivate, "Reactivation preserves assignments");
assert.equal((await available(owner.id)).some((row) => row.id === identity.id), true);
await mutate("edit", identity.id, null, null, "Ken Code");
const renamed = await service.from("mail_identities").select("*").eq("id", identity.id).single();
assert.equal(renamed.data.email, identity.email);
assert.equal(renamed.data.display_name, "Ken Code");
await mutate("assign", other.id, owner.id);
await mutate("primary", other.id, owner.id);
assert.equal((await assignments()).filter((row) => row.active && row.is_primary).length, 1);
assert.equal((await assignments()).find((row) => row.identity_id === other.id)?.is_primary, true);
await Promise.all([mutate("primary", identity.id, owner.id), mutate("primary", other.id, owner.id)]);
assert.equal((await assignments()).filter((row) => row.active && row.is_primary).length, 1, "Concurrent switches remain unique");
await mutate("primary", identity.id, owner.id);
await mutate("remove_primary", identity.id, owner.id);
assert.equal((await assignments()).filter((row) => row.active && row.is_primary).length, 0);
assert.equal((await available(owner.id)).length, 2);
await mutate("unassign", identity.id, owner.id);
assert.equal((await available(owner.id)).some((row) => row.id === identity.id), false);
assert.equal((await service.from("mail_identities").select("status").eq("id", identity.id).single()).data.status, "active");
await mutate("assign", identity.id, owner.id);
await mutate("reassign", identity.id, people[3].id, owner.id);
assert.equal((await available(owner.id)).some((row) => row.id === identity.id), false);
assert.equal((await available(people[3].id)).some((row) => row.id === identity.id), true);
assert.equal((await assignments()).find((row) => row.profile_id === people[3].id)?.is_primary, false);
const beforeInvalid = await assignments();
assert.ok((await owner.client.rpc("manage_mail_identity", { p_identity_id: identity.id, p_action: "reassign", p_profile_id: people[4].id, p_previous_profile_id: people[3].id })).error);
assert.deepEqual(await assignments(), beforeInvalid, "Failed reassignment is atomic");
assert.ifError((await service.from("profiles").update({ active: false }).eq("id", people[5].id)).error);
assert.ok((await owner.client.rpc("manage_mail_identity", { p_identity_id: identity.id, p_action: "assign", p_profile_id: people[5].id })).error);
assert.deepEqual((await service.from("mail_messages").select("*").eq("id", message.data.id).single()).data, message.data, "All historical message fields preserved");
assert.deepEqual((await service.from("mail_threads").select("*").eq("id", thread.data.id).single()).data, threadSnapshot, "Thread preserved");
assert.ok((await service.from("mail_audit_events").select("id").eq("identity_id", identity.id)).data!.length >= 10);
console.log(JSON.stringify({ status: "PASS", target: "loopback-only", actions: "all", concurrentPrimary: "PASS", history: "UNCHANGED", rls: "owner allowed; admin/manager/sales/viewer denied", externalEmails: 0, fixtureOwner: owner.email }, null, 2));
