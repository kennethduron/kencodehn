import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { assertFirebaseSourceProject } from "./guards.ts";
import { MIGRATION_COLLECTION_ORDER, type AuthUserSummaryInput, type SourceCollections, type SourceDocument } from "./preflight.ts";

type JsonObject = Record<string, unknown>;

export function normalizeFirebaseBase64(value: string | undefined) {
  if (!value) return value;
  if (/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return value;
  if (/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return Buffer.from(value, "base64url").toString("base64");
  return value;
}

export type FirebaseAuthExportUser = AuthUserSummaryInput & {
  uid: string;
  passwordHash?: string;
  passwordSalt?: string;
};

export type FirebaseSourceSnapshot = {
  projectId: string;
  collections: SourceCollections;
  authUsers: FirebaseAuthExportUser[];
  scrypt: {
    algorithm: string;
    memoryCost: number;
    rounds: number;
    saltSeparator: string;
    signerKey: string;
  };
};

async function firebaseCliAccessToken() {
  const firebaseToolsAuth = join(dirname(process.execPath), "node_modules", "firebase-tools", "lib", "auth.js");
  const imported = await import(pathToFileURL(firebaseToolsAuth).href);
  const auth = (imported.default ?? imported) as {
    getGlobalDefaultAccount: () => { tokens?: { refresh_token?: string } } | undefined;
    getAccessToken: (refreshToken: string, scopes: string[]) => Promise<{ access_token?: string }>;
  };
  const refreshToken = auth.getGlobalDefaultAccount()?.tokens?.refresh_token;
  if (!refreshToken) throw new Error("Firebase CLI authentication is unavailable.");
  const result = await auth.getAccessToken(refreshToken, ["https://www.googleapis.com/auth/cloud-platform"]);
  if (!result.access_token) throw new Error("Firebase CLI could not obtain an access token.");
  return result.access_token;
}

async function googleJson(token: string, url: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Firebase source read failed (${response.status}).`);
  return response.json() as Promise<JsonObject>;
}

function decodeFirestoreValue(value: JsonObject): unknown {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("bytesValue" in value) return value.bytesValue;
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

async function readCollection(token: string, projectId: string, collection: string): Promise<SourceDocument[]> {
  const documents: SourceDocument[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await googleJson(token, `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}?${query}`);
    for (const raw of (response.documents as JsonObject[] | undefined) ?? []) {
      const name = String(raw.name ?? "");
      documents.push({ id: name.split("/").pop() ?? "", data: decodeFields((raw.fields ?? {}) as JsonObject) });
      if (documents.length > 50_000) throw new Error("Firebase collection safety limit exceeded.");
    }
    pageToken = typeof response.nextPageToken === "string" ? response.nextPageToken : "";
  } while (pageToken);
  return documents;
}

async function readAuthUsers(token: string, projectId: string) {
  const users: FirebaseAuthExportUser[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ maxResults: "500" });
    if (pageToken) query.set("nextPageToken", pageToken);
    const response = await googleJson(token, `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:batchGet?${query}`);
    for (const raw of (response.users as JsonObject[] | undefined) ?? []) {
      const providerInfo = Array.isArray(raw.providerUserInfo) ? raw.providerUserInfo as JsonObject[] : [];
      const passwordHash = normalizeFirebaseBase64(typeof raw.passwordHash === "string" ? raw.passwordHash : undefined);
      users.push({
        uid: String(raw.localId ?? ""),
        email: typeof raw.email === "string" ? raw.email : undefined,
        emailVerified: raw.emailVerified === true,
        disabled: raw.disabled === true,
        displayName: typeof raw.displayName === "string" ? raw.displayName : undefined,
        providerIds: [...new Set([
          ...providerInfo.map((provider) => String(provider.providerId ?? "")).filter(Boolean),
          ...(passwordHash ? ["password"] : []),
        ])],
        hasPasswordHash: Boolean(passwordHash),
        passwordHash,
        passwordSalt: normalizeFirebaseBase64(typeof raw.salt === "string" ? raw.salt : typeof raw.passwordSalt === "string" ? raw.passwordSalt : undefined),
      });
    }
    pageToken = typeof response.nextPageToken === "string" ? response.nextPageToken : "";
  } while (pageToken);
  return users;
}

export async function readFirebaseSourceSnapshot(projectId: string): Promise<FirebaseSourceSnapshot> {
  assertFirebaseSourceProject(projectId);
  const token = await firebaseCliAccessToken();
  const collections: SourceCollections = {};
  for (const collection of MIGRATION_COLLECTION_ORDER) {
    collections[collection] = await readCollection(token, projectId, collection);
  }
  const authUsers = await readAuthUsers(token, projectId);
  const config = await googleJson(token, `https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/config`);
  const signIn = (config.signIn ?? {}) as JsonObject;
  const hashConfig = (signIn.hashConfig ?? {}) as JsonObject;
  const scrypt = {
    algorithm: String(hashConfig.algorithm ?? ""),
    memoryCost: Number(hashConfig.memoryCost),
    rounds: Number(hashConfig.rounds),
    saltSeparator: String(hashConfig.saltSeparator ?? ""),
    signerKey: String(hashConfig.signerKey ?? ""),
  };
  if (scrypt.algorithm !== "SCRYPT" || scrypt.memoryCost !== 14 || scrypt.rounds !== 8 || !scrypt.saltSeparator || !scrypt.signerKey) {
    throw new Error("Firebase SCRYPT configuration does not match the verified source.");
  }
  return { projectId, collections, authUsers, scrypt };
}
