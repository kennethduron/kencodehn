import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createFirebaseScryptHash } from "../src/lib/migration/preflight.ts";
import { ownerEmailVerificationTemplate } from "../src/lib/auth/owner-email-template.ts";

const url = process.env.SUPABASE_LOCAL_URL;
const publishable = process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_LOCAL_SERVICE_KEY;
const mailpit = process.env.SUPABASE_LOCAL_MAILPIT_URL;
if (!url || !publishable || !secret || !mailpit) throw new Error("Local Supabase environment is incomplete.");
for (const candidate of [url, mailpit]) {
  if (!["127.0.0.1", "localhost"].includes(new URL(candidate).hostname)) throw new Error("Owner OTP E2E refuses non-loopback services.");
}

const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const id = "90000000-0000-4000-8000-000000000004";
const email = "imported-owner-otp@example.test";
const password = "Imported-Owner-OTP-2026!";
const passwordSalt = Buffer.from("owner-otp-local-salt", "utf8").toString("base64");
const parameters = {
  rounds: 8,
  memoryCost: 14,
  saltSeparator: Buffer.from("ken-code-local", "utf8").toString("base64"),
  signerKey: Buffer.from("sanitized-local-firebase-signer-key-32-bytes", "utf8").toString("base64"),
  parallelization: 1,
};
const { formatted } = createFirebaseScryptHash(password, passwordSalt, parameters);

type Message = { ID?: string; Id?: string; Subject?: string };
async function messages() {
  const response = await fetch(`${mailpit}/api/v1/messages`);
  if (!response.ok) throw new Error("Local Mailpit is unavailable.");
  const body = await response.json() as { messages?: Message[] } | Message[];
  return Array.isArray(body) ? body : body.messages ?? [];
}

await service.from("profiles").delete().eq("id", id);
await service.auth.admin.deleteUser(id);
const created = await service.auth.admin.createUser({ id, email, email_confirm: false, password_hash: formatted, user_metadata: { imported_from: "firebase" } });
if (created.error || !created.data.user) throw created.error ?? new Error("Imported fixture was not created.");
assert.equal(created.data.user.id, id);
assert.equal(created.data.user.email_confirmed_at, undefined);
const now = new Date().toISOString();
const profile = await service.from("profiles").insert({ id, email, name: "Imported Owner OTP", role: "owner", active: true, firebase_uid: "sanitized-owner-otp", created_at: now, updated_at: now });
if (profile.error) throw profile.error;
assert.ok((await client.auth.signInWithPassword({ email, password })).error);

const before = new Set((await messages()).map((item) => item.ID ?? item.Id ?? ""));
const generated = await service.auth.admin.generateLink({ type: "magiclink", email });
if (generated.error || !generated.data.properties?.email_otp) throw generated.error ?? new Error("Supabase did not generate an official OTP.");
assert.equal(generated.data.user.id, id);
const otp = generated.data.properties.email_otp;
const template = ownerEmailVerificationTemplate(otp);
const sent = await fetch(`${mailpit}/api/v1/send`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    From: { Email: "notificaciones@kencodehn.com", Name: "Ken Code" },
    To: [{ Email: email }],
    Subject: template.subject,
    Text: template.text,
    HTML: template.html,
  }),
});
if (!sent.ok) throw new Error("Local Mailpit delivery failed.");

let emailMessage: Message | undefined;
for (let attempt = 0; attempt < 30 && !emailMessage; attempt += 1) {
  emailMessage = (await messages()).find((item) => !before.has(item.ID ?? item.Id ?? "") && String(item.Subject ?? "").includes("Código de verificación"));
  if (!emailMessage) await new Promise((resolve) => setTimeout(resolve, 200));
}
if (!emailMessage) throw new Error("Official OTP email was not captured.");
const messageId = emailMessage.ID ?? emailMessage.Id;
const detailResponse = await fetch(`${mailpit}/api/v1/message/${messageId}`);
const detail = await detailResponse.json() as Record<string, unknown>;
const html = String(detail.HTML ?? detail.Html ?? detail.Text ?? "");
assert.doesNotMatch(html, /ConfirmationURL|Confirm your email address|href=/i);
const tokenMatch = html.match(/(?<!\d)(\d{8})(?!\d)/);
if (!tokenMatch || tokenMatch[1] !== otp) throw new Error("Official OTP was not present in the local message.");

const invalid = await client.auth.verifyOtp({ email, token: "00000000", type: "email" });
assert.ok(invalid.error);
const verified = await client.auth.verifyOtp({ email, token: otp, type: "email" });
if (verified.error || verified.data.user?.id !== id) throw verified.error ?? new Error("Official OTP verification failed.");
const after = await service.auth.admin.getUserById(id);
if (after.error || !after.data.user) throw after.error ?? new Error("Imported fixture disappeared.");
assert.ok(after.data.user.email_confirmed_at);
const preservedProfile = await service.from("profiles").select("role,active").eq("id", id).single();
assert.deepEqual(preservedProfile.data, { role: "owner", active: true });
await client.auth.signOut();
const login = await client.auth.signInWithPassword({ email, password });
if (login.error || login.data.user?.id !== id) throw login.error ?? new Error("Firebase SCRYPT password no longer authenticates.");
await client.auth.signOut();
const used = await client.auth.verifyOtp({ email, token: otp, type: "email" });
assert.ok(used.error);

const expiredId = "90000000-0000-4000-8000-000000000005";
const expiredEmail = "imported-expired-otp@example.test";
await service.auth.admin.deleteUser(expiredId);
const expiredUser = await service.auth.admin.createUser({ id: expiredId, email: expiredEmail, email_confirm: false, password_hash: formatted });
if (expiredUser.error) throw expiredUser.error;
const expiredLink = await service.auth.admin.generateLink({ type: "magiclink", email: expiredEmail });
const expiredOtp = expiredLink.data.properties?.email_otp;
if (expiredLink.error || !expiredOtp) throw expiredLink.error ?? new Error("Expired OTP fixture was not generated.");
execFileSync("docker", ["exec", "supabase_db_kencodehn", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `update auth.users set recovery_sent_at=now()-interval '2 hours' where id='${expiredId}'`], { stdio: "ignore", windowsHide: true });
const expired = await client.auth.verifyOtp({ email: expiredEmail, token: expiredOtp, type: "email" });
assert.ok(expired.error);
assert.equal(expired.error.code, "otp_expired");
await service.auth.admin.deleteUser(expiredId);

await service.from("profiles").delete().eq("id", id);
await service.auth.admin.deleteUser(id);
console.log(JSON.stringify({
  target: "loopback-only",
  importedFirebaseScryptUser: true,
  officialGeneration: "admin.generateLink/magiclink/email_otp",
  verificationType: "email",
  emailConfirmed: true,
  invalidOtpRejected: true,
  usedOtpRejected: true,
  expiredOtpRejected: true,
  resendPolicyValidatedSeparately: true,
  importedPasswordStillValid: true,
  ownerRolePreserved: true,
  activePreserved: true,
  directConsumeLinkPresent: false,
  productionEmailsSent: 0,
  sensitiveValuesLogged: false,
}, null, 2));
