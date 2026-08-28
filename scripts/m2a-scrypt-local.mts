import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { assertFirebaseSourceProject } from "../src/lib/migration/guards.ts";
import { createFirebaseScryptHash } from "../src/lib/migration/preflight.ts";
import { targetUuidForFirebase } from "../src/lib/migration/transform.ts";

type JsonObject = Record<string, unknown>;

const projectId = process.argv.find((argument) => argument.startsWith("--project-id="))?.slice("--project-id=".length) ?? "";
assertFirebaseSourceProject(projectId);

function localCliEnvironment() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const commandArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", "npx.cmd supabase status -o env"]
    : ["supabase", "status", "-o", "env"];
  const output = execFileSync(command, commandArgs, { encoding: "utf8", windowsHide: true });
  return Object.fromEntries(output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) return [];
    const value = match[2].startsWith('"') && match[2].endsWith('"') ? match[2].slice(1, -1) : match[2];
    return [[match[1], value]];
  }));
}

async function cliAccessToken() {
  const firebaseToolsAuth = join(dirname(process.execPath), "node_modules", "firebase-tools", "lib", "auth.js");
  const imported = await import(pathToFileURL(firebaseToolsAuth).href);
  const auth = (imported.default ?? imported) as {
    getGlobalDefaultAccount: () => { tokens?: { refresh_token?: string } } | undefined;
    getAccessToken: (refreshToken: string, scopes: string[]) => Promise<{ access_token?: string }>;
  };
  const refreshToken = auth.getGlobalDefaultAccount()?.tokens?.refresh_token;
  if (!refreshToken) throw new Error("Firebase CLI authentication is unavailable.");
  const result = await auth.getAccessToken(refreshToken, ["https://www.googleapis.com/auth/cloud-platform"]);
  if (!result.access_token) throw new Error("Firebase CLI could not obtain a read token.");
  return result.access_token;
}

const local = localCliEnvironment();
const url = local.API_URL ?? "";
const secret = local.SERVICE_ROLE_KEY ?? "";
const publishable = local.ANON_KEY ?? "";
const parsed = new URL(url);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) throw new Error("SCRYPT validation refuses a non-local Supabase target.");
if (!secret || !publishable) throw new Error("Local Supabase credentials are unavailable.");

const token = await cliAccessToken();
const response = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/config`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!response.ok) throw new Error(`Firebase hash configuration read failed (${response.status}).`);
const config = await response.json() as JsonObject;
const signIn = (config.signIn ?? {}) as JsonObject;
const hashConfig = (signIn.hashConfig ?? {}) as JsonObject;
if (hashConfig.algorithm !== "SCRYPT" || Number(hashConfig.rounds) !== 8 || Number(hashConfig.memoryCost) !== 14) {
  throw new Error("Firebase SCRYPT effective parameters do not match the approved migration parameters.");
}
const parameters = {
  rounds: 8,
  memoryCost: 14,
  saltSeparator: String(hashConfig.saltSeparator ?? ""),
  signerKey: String(hashConfig.signerKey ?? ""),
  parallelization: 1,
};

const password = "M2A-local-vector-only-42!";
const passwordSalt = Buffer.from("kencode-m2a-local-salt", "utf8").toString("base64");
const { formatted } = createFirebaseScryptHash(password, passwordSalt, parameters);
const userId = targetUuidForFirebase("authUsers", "sanitized-m2a-scrypt-vector");
const email = "m2a-scrypt-vector@example.com";
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
await admin.auth.admin.deleteUser(userId);
const created = await admin.auth.admin.createUser({ id: userId, email, email_confirm: true, password_hash: formatted });
if (created.error || !created.data.user) throw new Error("Local Supabase Auth rejected the Firebase SCRYPT vector.");

const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.signInWithPassword({ email, password });
const passed = !login.error && login.data.user?.id === userId;
await client.auth.signOut();
await admin.auth.admin.deleteUser(userId);
if (!passed) throw new Error("Local Supabase Auth login failed for the Firebase SCRYPT vector.");

console.log(JSON.stringify({
  localOnly: true,
  sourceProject: projectId,
  algorithm: "SCRYPT",
  rounds: 8,
  memoryCost: 14,
  convertedToFirebaseScrypt: true,
  supabaseAuthLogin: "PASS",
  secretsLogged: false,
}, null, 2));
