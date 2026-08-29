import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isAllowedOwnerVerificationOrigin,
  isOwnerEmailOtpLengthValid,
  normalizeOwnerEmailOtp,
  OWNER_EMAIL_OTP_COOLDOWN_SECONDS,
  OWNER_EMAIL_OTP_TYPE,
  ownerEmailVerificationMessage,
} from "../src/lib/auth/owner-email-verification.ts";

const route = fs.readFileSync(new URL("../src/app/api/auth/owner-email-verification/route.ts", import.meta.url), "utf8");
const form = fs.readFileSync(new URL("../src/components/auth/owner-email-verification-form.tsx", import.meta.url), "utf8");
const config = fs.readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
const confirmation = fs.readFileSync(new URL("../supabase/templates/confirmation.html", import.meta.url), "utf8");
const magic = fs.readFileSync(new URL("../supabase/templates/magic-link.html", import.meta.url), "utf8");
const combinedRuntime = `${route}\n${form}`;

test("imported-user flow generates an official Supabase OTP without signup", () => {
  assert.match(route, /auth\.admin\.generateLink\(\{ type: "magiclink", email: owner\.email \}\)/);
  assert.match(route, /properties\?\.email_otp/);
  assert.doesNotMatch(route, /auth\.resend/);
  assert.doesNotMatch(route, /signInWithOtp/);
});

test("verification type matches the generated magic-link email OTP", () => {
  assert.equal(OWNER_EMAIL_OTP_TYPE, "email");
  assert.match(route, /verifyOtp\(\{ email: owner\.email, token: code, type: OWNER_EMAIL_OTP_TYPE \}\)/);
  assert.doesNotMatch(route, /type:\s*["'](?:signup|invite|recovery)["']/);
});

test("official templates contain Token and no direct-consume confirmation URL", () => {
  for (const template of [confirmation, magic]) {
    assert.match(template, /\{\{ \.Token \}\}/);
    assert.doesNotMatch(template, /ConfirmationURL|TokenHash|href=/i);
  }
});

test("templates provide a single Spanish Ken Code experience", () => {
  assert.equal((confirmation.match(/<h2>/g) ?? []).length, 1);
  assert.equal((magic.match(/<h2>/g) ?? []).length, 1);
  assert.doesNotMatch(`${confirmation}\n${magic}`, /Confirm your email address|Confirm email address|Your sign-in link/);
});

test("local Auth configuration mirrors production policy", () => {
  assert.match(config, /enable_signup = false/);
  assert.match(config, /enable_confirmations = true/);
  assert.match(config, /max_frequency = "60s"/);
  assert.match(config, /otp_length = 8/);
  assert.match(config, /otp_expiry = 3600/);
});

test("OTP input is numeric, paste-friendly and length bounded", () => {
  assert.equal(normalizeOwnerEmailOtp(" 12-34 56ab78 90"), "12345678");
  assert.equal(isOwnerEmailOtpLengthValid("123456"), true);
  assert.equal(isOwnerEmailOtpLengthValid("12345678"), true);
  assert.equal(isOwnerEmailOtpLengthValid("12345"), false);
});

test("expired OTP has a clear nontechnical message", () => {
  assert.equal(ownerEmailVerificationMessage("otp_expired"), "El código ha vencido. Solicite uno nuevo.");
  assert.doesNotMatch(ownerEmailVerificationMessage("otp_expired"), /otp_expired/);
});

test("invalid and used OTPs have a safe message", () => {
  assert.match(ownerEmailVerificationMessage("otp_invalid"), /no es válido|utilizado/);
});

test("resend cooldown is one minute and visual", () => {
  assert.equal(OWNER_EMAIL_OTP_COOLDOWN_SECONDS, 60);
  assert.match(form, /Reenviar código en/);
});

test("server relies on Supabase per-user rate limiting", () => {
  assert.match(route, /recovery_sent_at/);
  assert.match(route, /rate_limit/);
  assert.match(route, /cooldownSeconds/);
});

test("verification preserves Owner role and active status", () => {
  assert.match(route, /preserved\?\.role !== "owner" \|\| preserved\.active !== true/);
  assert.doesNotMatch(route, /updateUserById|email_confirm|email_confirmed_at\s*:/);
});

test("request cannot create an open redirect", () => {
  assert.doesNotMatch(route, /redirectTo|emailRedirectTo|searchParams|get\(["']next/);
  assert.equal(isAllowedOwnerVerificationOrigin("https://kencodehn.com", true), true);
  assert.equal(isAllowedOwnerVerificationOrigin("https://evil.example", true), false);
  assert.equal(isAllowedOwnerVerificationOrigin(null, true), false);
});

test("local origins are allowed only outside production", () => {
  assert.equal(isAllowedOwnerVerificationOrigin("http://127.0.0.1:3000", false), true);
  assert.equal(isAllowedOwnerVerificationOrigin("http://127.0.0.1:3000", true), false);
});

test("screen supports keyboard, paste, autofill and screen readers", () => {
  assert.match(form, /inputMode="numeric"/);
  assert.match(form, /autoComplete="one-time-code"/);
  assert.match(form, /onPaste=/);
  assert.match(form, /clipboardData\.getData\("text"\)/);
  assert.match(form, /aria-describedby=/);
  assert.match(form, /aria-live="polite"/);
  assert.match(form, /min-h-11/);
});

test("screen is fluid and avoids fixed viewport widths", () => {
  assert.match(form, /w-full max-w-md/);
  assert.match(form, /px-4/);
  assert.doesNotMatch(form, /w-\[(?:3[2-9][1-9]|[4-9]\d\d)px\]/);
});

test("verification route is gated and never cached", () => {
  assert.match(route, /OWNER_EMAIL_VERIFICATION_ENABLED/);
  assert.match(route, /Cache-Control.*no-store/);
});

test("tokens and secrets are never logged", () => {
  assert.doesNotMatch(combinedRuntime, /console\.(?:log|info|warn|error)|logger\./);
  assert.doesNotMatch(combinedRuntime, /SUPABASE_SECRET_KEY/);
});

test("raw technical OTP errors are not rendered", () => {
  assert.doesNotMatch(form, /otp_expired|token_hash|ConfirmationURL/);
});
