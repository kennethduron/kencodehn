import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { buildCrmInvitationHandoffLink } from "../src/lib/admin/invitation.ts";

const apiUrl = process.env.SUPABASE_LOCAL_URL || "";
const publishableKey = process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY || "";
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY || "";
const parsedUrl = new URL(apiUrl);
if (!publishableKey || !serviceKey
  || !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
  throw new Error("Final acceptance E2E refuses non-loopback services.");
}

const service = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const runId = crypto.randomUUID().slice(0, 8);
const password = "Final-Acceptance-Local-2026!";
const nextPassword = "Final-Acceptance-Changed-2026!";
const profileId = crypto.randomUUID();
const inactiveId = crypto.randomUUID();
const invitedEmail = `invited.${runId}@example.test`;
const profileEmail = `profile.${runId}@example.test`;
const inactiveEmail = `inactive.${runId}@example.test`;
const createdAuthIds: string[] = [];
const photoPaths: string[] = [];

async function createConfirmedUser(id: string, email: string) {
  const result = await service.auth.admin.createUser({ id, email, password, email_confirm: true });
  if (result.error || !result.data.user) throw result.error ?? new Error("Local user was not created.");
  createdAuthIds.push(result.data.user.id);
}

async function login(email: string, candidatePassword = password) {
  const client = createClient(apiUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await client.auth.signInWithPassword({ email, password: candidatePassword });
  if (result.error) throw result.error;
  return client;
}

try {
  await createConfirmedUser(profileId, profileEmail);
  await createConfirmedUser(inactiveId, inactiveEmail);
  const profiles = await service.from("profiles").insert([
    { id: profileId, name: "", email: profileEmail, role: "owner", active: true },
    { id: inactiveId, name: "Inactive fixture", email: inactiveEmail, role: "viewer", active: false },
  ]);
  if (profiles.error) throw profiles.error;

  const profileClient = await login(profileEmail);
  const details = await profileClient.rpc("update_own_profile", {
    p_changes: { displayName: "Local Profile", preferredName: "Local", jobTitle: "QA", phone: "", locale: "es-HN" },
  });
  if (details.error) throw details.error;
  assert.equal(details.data.display_name, "Local Profile");
  assert.equal(details.data.role, "owner");
  assert.ok((await profileClient.rpc("update_own_profile", { p_changes: { role: "admin" } })).error);
  const reloadedProfileClient = await login(profileEmail);
  const persistedDetails = await reloadedProfileClient.from("profiles").select("display_name,preferred_name,job_title,phone,locale,role,active").eq("id", profileId).single();
  if (persistedDetails.error) throw persistedDetails.error;
  assert.deepEqual(persistedDetails.data, { display_name: "Local Profile", preferred_name: "Local", job_title: "QA", phone: "", locale: "es-HN", role: "owner", active: true });
  const invalidLoginClient = createClient(apiUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.ok((await invalidLoginClient.auth.signInWithPassword({ email: profileEmail, password: "Incorrect-Local-Password!" })).error);

  const inactiveClient = await login(inactiveEmail);
  assert.ok((await inactiveClient.rpc("update_own_profile", { p_changes: { displayName: "Rejected" } })).error);
  assert.ok((await profileClient.from("profiles").update({ name: "Rejected" }).eq("id", inactiveId)).error);

  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const firstPath = `${profileId}/${crypto.randomUUID()}.png`;
  const secondPath = `${profileId}/${crypto.randomUUID()}.png`;
  photoPaths.push(firstPath, secondPath);
  const firstUpload = await service.storage.from("profile-photos").upload(firstPath, png, { contentType: "image/png" });
  if (firstUpload.error) throw firstUpload.error;
  const firstReference = await profileClient.rpc("update_own_profile", { p_changes: { profilePhotoPath: firstPath } });
  if (firstReference.error) throw firstReference.error;
  assert.equal((await profileClient.storage.from("profile-photos").download(firstPath)).error, null);

  const secondUpload = await service.storage.from("profile-photos").upload(secondPath, png, { contentType: "image/png" });
  if (secondUpload.error) throw secondUpload.error;
  const secondReference = await profileClient.rpc("update_own_profile", { p_changes: { profilePhotoPath: secondPath } });
  if (secondReference.error) throw secondReference.error;
  assert.equal((await service.storage.from("profile-photos").remove([firstPath])).error, null);
  assert.ok((await profileClient.storage.from("profile-photos").download(firstPath)).error);
  assert.equal((await profileClient.storage.from("profile-photos").download(secondPath)).error, null);

  const removedReference = await profileClient.rpc("update_own_profile", { p_changes: { profilePhotoPath: null } });
  if (removedReference.error) throw removedReference.error;
  assert.equal((await service.storage.from("profile-photos").remove([secondPath])).error, null);
  const storedProfile = await service.from("profiles").select("profile_photo_path").eq("id", profileId).single();
  if (storedProfile.error) throw storedProfile.error;
  assert.equal(storedProfile.data.profile_photo_path, null);

  const invitation = await service.auth.admin.generateLink({
    type: "invite",
    email: invitedEmail,
    options: { redirectTo: "http://127.0.0.1:3000/admin/recovery?mode=invite" },
  });
  if (invitation.error || !invitation.data.user) throw invitation.error ?? new Error("Local invitation was not created.");
  const firstInviteHash = invitation.data.properties?.hashed_token;
  if (!firstInviteHash) throw new Error("Local invitation token hash was not generated.");
  const firstInviteLink = new URL(buildCrmInvitationHandoffLink(firstInviteHash, "invite"));
  const firstInviteFragment = new URLSearchParams(firstInviteLink.hash.slice(1));
  assert.equal(firstInviteLink.pathname, "/admin/recovery");
  assert.equal(firstInviteLink.searchParams.get("mode"), "invite");
  assert.equal(firstInviteFragment.get("type"), "invite");
  assert.equal(firstInviteFragment.get("token_hash"), firstInviteHash);
  assert.equal(firstInviteLink.searchParams.has("code"), false);
  createdAuthIds.push(invitation.data.user.id);
  const invitedProfile = await service.from("profiles").insert({
    id: invitation.data.user.id,
    name: "Invited fixture",
    email: invitedEmail,
    role: "sales_agent",
    active: true,
    invitation_status: "sent",
    invited_at: new Date(Date.now() - 120_000).toISOString(),
  });
  if (invitedProfile.error) throw invitedProfile.error;

  const claimedAt = new Date().toISOString();
  const claim = await service.rpc("claim_invitation_resend", { p_target: invitation.data.user.id, p_actor: profileId, p_now: claimedAt });
  if (claim.error) throw claim.error;
  assert.ok((await service.rpc("claim_invitation_resend", { p_target: invitation.data.user.id, p_actor: profileId, p_now: claimedAt })).error);
  const resend = await service.auth.admin.generateLink({
    type: "invite",
    email: invitedEmail,
    options: { redirectTo: "http://127.0.0.1:3000/admin/recovery?mode=invite" },
  });
  if (resend.error || resend.data.user?.id !== invitation.data.user.id) throw resend.error ?? new Error("Pending invitation was not renewed for the same user.");
  const secondInviteHash = resend.data.properties?.hashed_token;
  if (!secondInviteHash) throw new Error("Renewed invitation token hash was not generated.");
  assert.notEqual(firstInviteHash, secondInviteHash);
  const completed = await service.rpc("complete_invitation_resend", {
    p_target: invitation.data.user.id,
    p_actor: profileId,
    p_claimed_at: String(claim.data),
    p_sent: true,
    p_error: null,
  });
  if (completed.error) throw completed.error;

  const oldInviteClient = createClient(apiUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  assert.ok((await oldInviteClient.auth.verifyOtp({ token_hash: firstInviteHash, type: "invite" })).error);
  const invitedClient = createClient(apiUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const inviteVerification = await invitedClient.auth.verifyOtp({ token_hash: secondInviteHash, type: "invite" });
  if (inviteVerification.error || !inviteVerification.data.session) throw inviteVerification.error ?? new Error("Newest invitation was not accepted.");
  assert.ok((await invitedClient.auth.verifyOtp({ token_hash: secondInviteHash, type: "invite" })).error);
  await invitedClient.auth.signOut();

  const firstContinuation = await service.auth.admin.generateLink({
    type: "magiclink",
    email: invitedEmail,
    options: { redirectTo: "http://127.0.0.1:3000/auth/callback?next=%2Fadmin%2Frecovery%3Fmode%3Dinvite" },
  });
  const secondContinuation = await service.auth.admin.generateLink({
    type: "magiclink",
    email: invitedEmail,
    options: { redirectTo: "http://127.0.0.1:3000/auth/callback?next=%2Fadmin%2Frecovery%3Fmode%3Dinvite" },
  });
  const firstContinuationHash = firstContinuation.data.properties?.hashed_token;
  const secondContinuationHash = secondContinuation.data.properties?.hashed_token;
  if (firstContinuation.error || secondContinuation.error || !firstContinuationHash || !secondContinuationHash) {
    throw firstContinuation.error ?? secondContinuation.error ?? new Error("Pending account continuation links were not generated.");
  }
  assert.ok((await invitedClient.auth.verifyOtp({ token_hash: firstContinuationHash, type: "magiclink" })).error);
  const verification = await invitedClient.auth.verifyOtp({ token_hash: secondContinuationHash, type: "magiclink" });
  if (verification.error || !verification.data.session) throw verification.error ?? new Error("Newest continuation link was not accepted.");
  const continuationLink = new URL(buildCrmInvitationHandoffLink(secondContinuationHash, "magiclink"));
  const continuationFragment = new URLSearchParams(continuationLink.hash.slice(1));
  assert.equal(continuationLink.pathname, "/admin/recovery");
  assert.equal(continuationLink.searchParams.get("mode"), "invite");
  assert.equal(continuationFragment.get("type"), "magiclink");
  assert.equal(continuationFragment.get("token_hash"), secondContinuationHash);
  assert.equal(continuationLink.searchParams.has("code"), false);
  assert.equal((await invitedClient.auth.updateUser({ password: nextPassword })).error, null);
  assert.ok((await invitedClient.auth.verifyOtp({ token_hash: secondContinuationHash, type: "magiclink" })).error);
  const completedLogin = await login(invitedEmail, nextPassword);
  const claims = await completedLogin.auth.getClaims();
  assert.equal(claims.error, null);
  assert.ok(claims.data?.claims.amr?.some((entry) => typeof entry === "string" ? entry === "password" : entry.method === "password"));
  const loginRecord = await service.rpc("record_profile_login", { p_target: invitation.data.user.id });
  if (loginRecord.error) throw loginRecord.error;
  const acceptedProfile = await service.from("profiles").select("role,active,invitation_status").eq("id", invitation.data.user.id).single();
  if (acceptedProfile.error) throw acceptedProfile.error;
  assert.deepEqual(acceptedProfile.data, { role: "sales_agent", active: true, invitation_status: "accepted" });
  assert.ok((await service.rpc("claim_invitation_resend", { p_target: invitation.data.user.id, p_actor: profileId, p_now: new Date(Date.now() + 120_000).toISOString() })).error);

  console.log("Final product profile, invitation renewal and one-time link local E2E: PASS");
} finally {
  if (photoPaths.length) await service.storage.from("profile-photos").remove(photoPaths);
  if (createdAuthIds.length) await service.from("profiles").delete().in("id", createdAuthIds);
  for (const id of createdAuthIds.reverse()) await service.auth.admin.deleteUser(id);
}
