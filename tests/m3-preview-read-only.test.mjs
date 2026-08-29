import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isCrmPreviewReadOnly,
  isPreviewMutationAllowed,
  isPreviewSafeMethod,
} from "../src/lib/data/preview-read-only.ts";

const proxy = fs.readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
const profileRoute = fs.readFileSync(new URL("../src/app/api/admin/me/route.ts", import.meta.url), "utf8");
const envExample = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");

test("preview read-only is opt-in and rejects malformed values", () => {
  assert.equal(isCrmPreviewReadOnly({}), false);
  assert.equal(isCrmPreviewReadOnly({ CRM_PREVIEW_READ_ONLY: "false" }), false);
  assert.equal(isCrmPreviewReadOnly({ CRM_PREVIEW_READ_ONLY: " true " }), true);
  assert.throws(() => isCrmPreviewReadOnly({ CRM_PREVIEW_READ_ONLY: "yes" }), /Unsupported/);
});

test("read-only mode permits only semantically safe HTTP methods", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) assert.equal(isPreviewSafeMethod(method), true);
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(isPreviewSafeMethod(method), false);
});

test("logout remains available without opening a generic mutation bypass", () => {
  assert.equal(isPreviewMutationAllowed("/api/admin/logout", "POST"), true);
  assert.equal(isPreviewMutationAllowed("/api/admin/logout", "DELETE"), false);
  assert.equal(isPreviewMutationAllowed("/api/admin/session", "POST"), false);
  assert.equal(isPreviewMutationAllowed("/api/leads", "POST"), false);
});

test("proxy guards every API route at the server boundary", () => {
  assert.match(proxy, /matcher:\s*"\/api\/:path\*"/);
  assert.match(proxy, /status:\s*423/);
  assert.match(proxy, /X-Ken-Code-Preview-Read-Only/);
  assert.match(proxy, /Cache-Control.*no-store/);
});

test("cron GET is treated as a mutation and blocked", () => {
  assert.match(proxy, /pathname\.startsWith\("\/api\/cron\/"\)/);
  assert.match(proxy, /isPreviewSafeMethod\(request\.method\)\s*&&\s*!cronMutation/);
});

test("profile validation skips last-login writes in read-only Preview", () => {
  assert.match(profileRoute, /getCrmAuthProvider\(\) === "supabase" && !isCrmPreviewReadOnly\(\)/);
  assert.match(profileRoute, /record_profile_login/);
});

test("Preview mode does not change the default Firebase provider pair", () => {
  assert.match(envExample, /CRM_DATA_PROVIDER=firebase/);
  assert.match(envExample, /CRM_AUTH_PROVIDER=firebase/);
  assert.match(envExample, /CRM_PREVIEW_READ_ONLY=false/);
});

test("guard contains no secret, identity, or token logging", () => {
  assert.doesNotMatch(proxy, /console\.|SUPABASE_SECRET_KEY|token|email/i);
});
