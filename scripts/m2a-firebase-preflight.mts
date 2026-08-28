import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  FIREBASE_PRODUCTION_PROJECT_ID,
  MIGRATION_COLLECTION_ORDER,
  analyzeDates,
  analyzeDuplicates,
  analyzeMigrationDryRun,
  analyzeMoney,
  assertFirebaseProjectIdentity,
  deterministicChecksum,
  prepareMigrationRows,
  summarizeAuthUsers,
  type AuthUserSummaryInput,
  type SourceCollections,
  type SourceDocument,
} from "../src/lib/migration/preflight.ts";

type JsonObject = Record<string, unknown>;

const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...rest] = argument.split("=");
  return [key, rest.length ? rest.join("=") : "true"];
}));

if (args.has("--write")) throw new Error("M2A is read-only; remote writes are disabled.");
const sourceRead = args.has("--source-read");
const projectId = args.get("--project-id") ?? "";

if (!sourceRead) {
  console.log(JSON.stringify({
    mode: "dry-run",
    remoteRead: false,
    remoteWrite: false,
    expectedProjectId: FIREBASE_PRODUCTION_PROJECT_ID,
    next: "Use --source-read with --project-id=kencode-81d66 for an aggregated, PII-safe preflight.",
  }, null, 2));
  process.exit(0);
}

assertFirebaseProjectIdentity(projectId);

async function cliAccessToken() {
  const firebaseToolsAuth = join(dirname(process.execPath), "node_modules", "firebase-tools", "lib", "auth.js");
  const imported = await import(pathToFileURL(firebaseToolsAuth).href);
  const auth = (imported.default ?? imported) as {
    getGlobalDefaultAccount: () => { tokens?: { refresh_token?: string } } | undefined;
    getAccessToken: (refreshToken: string, scopes: string[]) => Promise<{ access_token?: string }>;
  };
  const account = auth.getGlobalDefaultAccount();
  const refreshToken = account?.tokens?.refresh_token;
  if (!refreshToken) throw new Error("Firebase CLI authentication is unavailable.");
  const result = await auth.getAccessToken(refreshToken, ["https://www.googleapis.com/auth/cloud-platform"]);
  if (!result.access_token) throw new Error("Firebase CLI could not obtain a read token.");
  return result.access_token;
}

const token = await cliAccessToken();
async function googleJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Read-only Google API request failed (${response.status}).`);
  return response.json() as Promise<JsonObject>;
}

function decodeFirestoreValue(value: JsonObject): unknown {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("bytesValue" in value) return "[bytes-redacted]";
  if ("referenceValue" in value) return String(value.referenceValue).split("/").pop() ?? "";
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("arrayValue" in value) {
    const array = value.arrayValue as JsonObject;
    return Array.isArray(array.values) ? array.values.map((nested) => decodeFirestoreValue(nested as JsonObject)) : [];
  }
  if ("mapValue" in value) {
    const map = value.mapValue as JsonObject;
    return decodeFields((map.fields ?? {}) as JsonObject);
  }
  return null;
}

function decodeFields(fields: JsonObject) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value as JsonObject)]));
}

async function readCollection(collection: string): Promise<SourceDocument[]> {
  const documents: SourceDocument[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await googleJson(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}?${query}`);
    for (const raw of (response.documents as JsonObject[] | undefined) ?? []) {
      const name = String(raw.name ?? "");
      documents.push({ id: name.split("/").pop() ?? "", data: decodeFields((raw.fields ?? {}) as JsonObject) });
      if (documents.length > 50_000) throw new Error("Collection safety limit exceeded; preflight aborted.");
    }
    pageToken = typeof response.nextPageToken === "string" ? response.nextPageToken : "";
  } while (pageToken);
  return documents;
}

async function readAuthUsers() {
  const users: AuthUserSummaryInput[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ maxResults: "500" });
    if (pageToken) query.set("nextPageToken", pageToken);
    const response = await googleJson(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:batchGet?${query}`);
    for (const raw of (response.users as JsonObject[] | undefined) ?? []) {
      const providerInfo = Array.isArray(raw.providerUserInfo) ? raw.providerUserInfo as JsonObject[] : [];
      users.push({
        uid: String(raw.localId ?? ""),
        email: typeof raw.email === "string" ? raw.email : undefined,
        emailVerified: raw.emailVerified === true,
        disabled: raw.disabled === true,
        displayName: typeof raw.displayName === "string" ? raw.displayName : undefined,
        providerIds: [...new Set(providerInfo.map((provider) => String(provider.providerId ?? "")).filter(Boolean))],
        hasPasswordHash: typeof raw.passwordHash === "string" && raw.passwordHash.length > 0,
      });
    }
    pageToken = typeof response.nextPageToken === "string" ? response.nextPageToken : "";
  } while (pageToken);
  return users;
}

const collections: SourceCollections = {};
for (const collection of MIGRATION_COLLECTION_ORDER) collections[collection] = await readCollection(collection);
const users = await readAuthUsers();
const authSummary = summarizeAuthUsers(users);
const migration = analyzeMigrationDryRun(collections, users);
const prepared = prepareMigrationRows(collections, users);
const config = await googleJson(`https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/config`);
const signIn = (config.signIn ?? {}) as JsonObject;
const hashConfig = (signIn.hashConfig ?? {}) as JsonObject;
const latestTimestamps = Object.fromEntries(MIGRATION_COLLECTION_ORDER.map((collection) => {
  const timestamps = (collections[collection] ?? []).flatMap((document) => [document.data.updatedAt, document.data.createdAt])
    .filter((value): value is string => typeof value === "string" && !Number.isNaN(new Date(value).getTime()))
    .sort();
  return [collection, timestamps.at(-1) ?? null];
}));

console.log(JSON.stringify({
  mode: "dry-run",
  remoteRead: true,
  remoteWrite: false,
  projectId,
  auth: authSummary,
  passwordHash: {
    algorithm: hashConfig.algorithm ?? null,
    rounds: hashConfig.rounds ?? null,
    memoryCost: hashConfig.memoryCost ?? null,
    saltSeparatorPresent: Boolean(hashConfig.saltSeparator),
    signerKeyPresent: Boolean(hashConfig.signerKey),
  },
  collections: Object.fromEntries(MIGRATION_COLLECTION_ORDER.map((collection) => [collection, collections[collection]?.length ?? 0])),
  latestTimestamps,
  migration,
  readiness: {
    source: Object.values(collections).reduce((sum, documents) => sum + (documents?.length ?? 0), 0),
    transformable: Object.values(migration.tables).reduce((sum, table) => sum + table.transformable, 0),
    insertReady: prepared.rows.length,
    optionalOrphansPreserved: prepared.optionalOrphans,
    mandatoryOrphans: migration.relationships.mandatoryOrphan,
    checksum: prepared.checksum,
  },
  money: analyzeMoney(collections),
  dates: analyzeDates(collections),
  duplicates: analyzeDuplicates(collections, users),
  sourceFingerprint: deterministicChecksum({
    projectId,
    auth: authSummary,
    collections: Object.fromEntries(MIGRATION_COLLECTION_ORDER.map((collection) => [collection, collections[collection]?.length ?? 0])),
    latestTimestamps,
  }),
}, null, 2));
