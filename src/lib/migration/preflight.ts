import { createCipheriv, createHash, scryptSync } from "node:crypto";

import {
  FIRESTORE_COLLECTION_TARGETS,
  targetUuidForFirebase,
  transformFirestoreDocument,
  type FirestoreCollection,
} from "./transform.ts";
import { FIREBASE_CRM_SOURCE_PROJECT_ID, assertFirebaseSourceProject } from "./guards.ts";

export const FIREBASE_PRODUCTION_PROJECT_ID = FIREBASE_CRM_SOURCE_PROJECT_ID;
export const EXPECTED_SOURCE_DOCUMENT_COUNT = 714;
export const EXPECTED_OPTIONAL_ORPHAN_COUNT = 10;
export const MIGRATION_COLLECTION_ORDER = [
  "adminUsers",
  "leads",
  "notes",
  "tasks",
  "notifications",
  "activityLogs",
  "emailLogs",
  "pushLogs",
  "deviceTokens",
  "adminSettings",
  "reminderEvents",
] as const satisfies readonly FirestoreCollection[];

export type SourceDocument = { id: string; data: Record<string, unknown> };
export type SourceCollections = Partial<Record<FirestoreCollection, readonly SourceDocument[]>>;
export type AuthUserSummaryInput = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  displayName?: string;
  providerIds?: readonly string[];
  hasPasswordHash?: boolean;
};

export function assertFirebaseProjectIdentity(actual: string | null | undefined, expected = FIREBASE_PRODUCTION_PROJECT_ID) {
  if (expected !== FIREBASE_PRODUCTION_PROJECT_ID) throw new Error("Expected Firebase project ID cannot be overridden.");
  return assertFirebaseSourceProject(actual);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return typeof value === "bigint" ? value.toString() : value;
}

export function deterministicChecksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function summarizeAuthUsers(users: readonly AuthUserSummaryInput[]) {
  const normalizedEmails = users.map((user) => user.email?.trim().toLowerCase()).filter(Boolean) as string[];
  const emailCounts = new Map<string, number>();
  for (const email of normalizedEmails) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  const providers: Record<string, number> = {};
  for (const user of users) {
    for (const provider of new Set(user.providerIds ?? [])) providers[provider] = (providers[provider] ?? 0) + 1;
  }
  return {
    total: users.length,
    emailVerified: users.filter((user) => user.emailVerified).length,
    emailUnverified: users.filter((user) => !user.emailVerified).length,
    disabled: users.filter((user) => user.disabled).length,
    passwordUsers: users.filter((user) => user.hasPasswordHash || user.providerIds?.includes("password")).length,
    displayNamePresent: users.filter((user) => Boolean(user.displayName?.trim())).length,
    displayNameMissing: users.filter((user) => !user.displayName?.trim()).length,
    invalidEmails: users.filter((user) => user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)).length,
    duplicateEmailGroups: [...emailCounts.values()].filter((count) => count > 1).length,
    providers: Object.fromEntries(Object.entries(providers).sort(([left], [right]) => left.localeCompare(right))),
  };
}

export type FirebaseScryptParameters = {
  memoryCost: number;
  rounds: number;
  saltSeparator: string;
  signerKey: string;
  parallelization?: number;
};

export function formatFirebaseScryptHash(passwordHash: string, passwordSalt: string, parameters: FirebaseScryptParameters) {
  const base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  for (const [field, value] of Object.entries({ passwordHash, passwordSalt, saltSeparator: parameters.saltSeparator, signerKey: parameters.signerKey })) {
    if (!value || !base64.test(value)) throw new Error(`Firebase scrypt ${field} must be valid base64.`);
  }
  if (!Number.isSafeInteger(parameters.memoryCost) || parameters.memoryCost <= 0) throw new Error("Firebase scrypt memoryCost is invalid.");
  if (!Number.isSafeInteger(parameters.rounds) || parameters.rounds <= 0) throw new Error("Firebase scrypt rounds is invalid.");
  const parallelization = parameters.parallelization ?? 1;
  if (!Number.isSafeInteger(parallelization) || parallelization <= 0) throw new Error("Firebase scrypt parallelization is invalid.");
  return `$fbscrypt$v=1,n=${parameters.memoryCost},r=${parameters.rounds},p=${parallelization},ss=${parameters.saltSeparator},sk=${parameters.signerKey}$${passwordSalt}$${passwordHash}`;
}

export function createFirebaseScryptHash(password: string, passwordSalt: string, parameters: FirebaseScryptParameters) {
  if (!password) throw new Error("Firebase scrypt test password is required.");
  const salt = Buffer.from(passwordSalt, "base64");
  const saltSeparator = Buffer.from(parameters.saltSeparator, "base64");
  const signerKey = Buffer.from(parameters.signerKey, "base64");
  if (!salt.length || !signerKey.length) throw new Error("Firebase scrypt parameters are incomplete.");
  const parallelization = parameters.parallelization ?? 1;
  const cost = 2 ** parameters.memoryCost;
  const key = scryptSync(password, Buffer.concat([salt, saltSeparator]), 32, {
    N: cost,
    r: parameters.rounds,
    p: parallelization,
    maxmem: Math.max(32 * 1024 * 1024, 256 * cost * parameters.rounds),
  });
  const cipher = createCipheriv("aes-256-ctr", key, Buffer.alloc(16));
  const passwordHash = Buffer.concat([cipher.update(signerKey), cipher.final()]).toString("base64");
  return { passwordHash, formatted: formatFirebaseScryptHash(passwordHash, passwordSalt, parameters) };
}

function valueString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function relationIssue(collection: FirestoreCollection, field: string, sourceId: string, target: keyof ReferenceIndex, classification: "OPTIONAL_ORPHAN" | "MANDATORY_ORPHAN") {
  return {
    collection,
    field,
    target,
    sourceRefHash: deterministicChecksum(`${collection}:${sourceId}:${field}`).slice(0, 16),
    targetRefHash: deterministicChecksum(`${target}:${sourceId}`).slice(0, 16),
    classification,
  };
}

type ReferenceIndex = {
  profile: ReadonlySet<string>;
  lead: ReadonlySet<string>;
  task: ReadonlySet<string>;
  note: ReadonlySet<string>;
  deviceToken: ReadonlySet<string>;
};

type ReferenceRule = {
  sourceFields: readonly string[];
  legacyField: string;
  target: keyof ReferenceIndex;
  mandatory: boolean;
};

const REFERENCE_RULES: Partial<Record<FirestoreCollection, readonly ReferenceRule[]>> = {
  leads: [
    { sourceFields: ["assignedToUid"], legacyField: "assigned_to", target: "profile", mandatory: false },
    { sourceFields: ["assignedByUid"], legacyField: "assigned_by", target: "profile", mandatory: false },
  ],
  notes: [
    { sourceFields: ["leadId"], legacyField: "lead_id", target: "lead", mandatory: true },
    { sourceFields: ["createdBy"], legacyField: "author_id", target: "profile", mandatory: false },
  ],
  tasks: [
    { sourceFields: ["leadId"], legacyField: "lead_id", target: "lead", mandatory: false },
    { sourceFields: ["assignedToUid"], legacyField: "assigned_to", target: "profile", mandatory: false },
    { sourceFields: ["assignedByUid"], legacyField: "assigned_by", target: "profile", mandatory: false },
    { sourceFields: ["createdByUid"], legacyField: "created_by", target: "profile", mandatory: false },
    { sourceFields: ["completedByUid"], legacyField: "completed_by", target: "profile", mandatory: false },
  ],
  notifications: [
    { sourceFields: ["recipientUid"], legacyField: "recipient_id", target: "profile", mandatory: false },
    { sourceFields: ["leadId"], legacyField: "lead_id", target: "lead", mandatory: false },
    { sourceFields: ["taskId"], legacyField: "task_id", target: "task", mandatory: false },
  ],
  activityLogs: [
    { sourceFields: ["actorUid", "userUid", "performedByUid"], legacyField: "actor_id", target: "profile", mandatory: false },
    { sourceFields: ["recipientUid"], legacyField: "recipient_id", target: "profile", mandatory: false },
    { sourceFields: ["targetUid"], legacyField: "target_user_id", target: "profile", mandatory: false },
    { sourceFields: ["leadId"], legacyField: "lead_id", target: "lead", mandatory: false },
    { sourceFields: ["taskId"], legacyField: "task_id", target: "task", mandatory: false },
    { sourceFields: ["noteId"], legacyField: "note_id", target: "note", mandatory: false },
  ],
  emailLogs: [
    { sourceFields: ["relatedLeadId"], legacyField: "lead_id", target: "lead", mandatory: false },
    { sourceFields: ["relatedTaskId"], legacyField: "task_id", target: "task", mandatory: false },
    { sourceFields: ["relatedUserUid"], legacyField: "related_user_id", target: "profile", mandatory: false },
  ],
  pushLogs: [
    { sourceFields: ["relatedLeadId"], legacyField: "lead_id", target: "lead", mandatory: false },
    { sourceFields: ["relatedTaskId"], legacyField: "task_id", target: "task", mandatory: false },
    { sourceFields: ["tokenId"], legacyField: "device_token_id", target: "deviceToken", mandatory: false },
  ],
  deviceTokens: [
    { sourceFields: ["uid"], legacyField: "profile_id", target: "profile", mandatory: true },
    { sourceFields: ["disabledByUid"], legacyField: "disabled_by", target: "profile", mandatory: false },
  ],
  adminSettings: [
    { sourceFields: ["updatedByUid"], legacyField: "updated_by", target: "profile", mandatory: false },
  ],
  reminderEvents: [
    { sourceFields: ["taskId"], legacyField: "task_id", target: "task", mandatory: true },
    { sourceFields: ["recipientUid", "assignedToUid"], legacyField: "recipient_id", target: "profile", mandatory: true },
  ],
};

function normalizeReferences(collection: FirestoreCollection, document: SourceDocument, index: ReferenceIndex) {
  const data = { ...document.data };
  const orphanedReferences: Record<string, string> = {};
  const issues: ReturnType<typeof relationIssue>[] = [];
  const rules = [...(REFERENCE_RULES[collection] ?? [])];
  if (collection === "activityLogs" && data.entityType === "lead" && !valueString(data.leadId) && valueString(data.entityId)) {
    rules.push({ sourceFields: ["entityId"], legacyField: "lead_id", target: "lead", mandatory: false });
  }
  if (collection === "activityLogs" && data.entityType === "task" && !valueString(data.taskId) && valueString(data.entityId)) {
    rules.push({ sourceFields: ["entityId"], legacyField: "task_id", target: "task", mandatory: false });
  }
  for (const rule of rules) {
    const sourceId = rule.sourceFields.map((field) => valueString(data[field])).find(Boolean) ?? "";
    if (!sourceId || index[rule.target].has(sourceId)) continue;
    const classification = rule.mandatory ? "MANDATORY_ORPHAN" : "OPTIONAL_ORPHAN";
    issues.push(relationIssue(collection, rule.legacyField, sourceId, rule.target, classification));
    if (!rule.mandatory) {
      orphanedReferences[rule.legacyField] = sourceId;
      for (const field of rule.sourceFields) {
        if (field !== "entityId") delete data[field];
      }
    }
  }
  return { data, orphanedReferences, issues };
}

function buildReferenceIndex(collections: SourceCollections, authUsers: readonly AuthUserSummaryInput[]): ReferenceIndex {
  return {
    profile: new Set(authUsers.map((user) => user.uid)),
    lead: new Set((collections.leads ?? []).map((document) => document.id)),
    task: new Set((collections.tasks ?? []).map((document) => document.id)),
    note: new Set((collections.notes ?? []).map((document) => document.id)),
    deviceToken: new Set((collections.deviceTokens ?? []).map((document) => document.id)),
  };
}

export function assertOwnerInvariant(collections: SourceCollections, authUsers: readonly AuthUserSummaryInput[]) {
  const owners = (collections.adminUsers ?? []).filter((document) => document.data.role === "owner" && document.data.active !== false);
  if (owners.length !== 1) throw new Error("Owner invariant requires exactly one active source Owner.");
  const ownerUid = valueString(owners[0].data.uid) || owners[0].id;
  const authMatches = authUsers.filter((user) => user.uid === ownerUid);
  if (authMatches.length !== 1) throw new Error("Owner invariant requires exactly one unambiguous Auth mapping.");
  const profileIds = new Map([[ownerUid, targetUuidForFirebase("authUsers", ownerUid)]]);
  const transformed = transformFirestoreDocument("adminUsers", owners[0].id, owners[0].data, profileIds);
  if (transformed.row.role !== "owner" || transformed.row.active !== true || transformed.row.id !== profileIds.get(ownerUid)) {
    throw new Error("Owner invariant did not produce one active owner profile.");
  }
  return { sourceOwners: 1, authUsers: 1, profiles: 1, role: "owner" as const, active: true };
}

export function prepareMigrationRows(collections: SourceCollections, authUsers: readonly AuthUserSummaryInput[]) {
  assertOwnerInvariant(collections, authUsers);
  const profileIds = new Map(authUsers.map((user) => [user.uid, targetUuidForFirebase("authUsers", user.uid)]));
  const referenceIndex = buildReferenceIndex(collections, authUsers);
  const rows: ReturnType<typeof transformFirestoreDocument>[] = [];
  let optionalOrphans = 0;
  for (const collection of MIGRATION_COLLECTION_ORDER) {
    for (const document of collections[collection] ?? []) {
      const normalized = normalizeReferences(collection, document, referenceIndex);
      const mandatory = normalized.issues.filter((issue) => issue.classification === "MANDATORY_ORPHAN");
      if (mandatory.length) throw new Error("Mandatory orphan relationship detected; migration is not ready.");
      optionalOrphans += normalized.issues.length;
      rows.push(transformFirestoreDocument(collection, document.id, normalized.data, profileIds, {
        orphanedReferences: normalized.orphanedReferences,
      }));
    }
  }
  return { rows, optionalOrphans, checksum: deterministicChecksum(rows.map((row) => row.checksum).sort()) };
}

function categorizeTransformError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/profile mapping|Auth UUID|mapped profile/i.test(message)) return "mapping";
  if (/money|monetary|currency/i.test(message)) return "money";
  if (/timestamp|civil date|due time/i.test(message)) return "date";
  if (/Unknown/i.test(message)) return "enum";
  if (/requires leadId|requires task|requires.*text/i.test(message)) return "relationship";
  return "malformed";
}

export function analyzeMigrationDryRun(collections: SourceCollections, authUsers: readonly AuthUserSummaryInput[]) {
  const profileIds = new Map(authUsers.map((user) => [user.uid, targetUuidForFirebase("authUsers", user.uid)]));
  const profileUids = new Set(authUsers.map((user) => user.uid));
  const referenceIndex = buildReferenceIndex(collections, authUsers);
  const relationshipIssues: ReturnType<typeof relationIssue>[] = [];
  const summaries: Record<string, { source: number; transformable: number; insertReady: number; missingRelationships: number; warnings: number; errors: number; skipped: number; errorCategories: Record<string, number> }> = {};
  const transformedChecksums: string[] = [];

  for (const collection of MIGRATION_COLLECTION_ORDER) {
    const documents = collections[collection] ?? [];
    const summary = { source: documents.length, transformable: 0, insertReady: 0, missingRelationships: 0, warnings: 0, errors: 0, skipped: 0, errorCategories: {} as Record<string, number> };
    for (const document of documents) {
      if (!document.data.createdAt) summary.warnings += 1;
      if (!document.data.updatedAt && ["adminUsers", "leads", "tasks", "notifications", "deviceTokens", "adminSettings", "reminderEvents"].includes(collection)) summary.warnings += 1;

      const normalized = normalizeReferences(collection, document, referenceIndex);
      relationshipIssues.push(...normalized.issues);
      const optionalIssues = normalized.issues.filter((issue) => issue.classification === "OPTIONAL_ORPHAN").length;
      const mandatoryIssues = normalized.issues.filter((issue) => issue.classification === "MANDATORY_ORPHAN").length;

      try {
        if (mandatoryIssues) throw new Error("Mandatory orphan relationship detected; migration aborted.");
        const transformed = transformFirestoreDocument(collection, document.id, normalized.data, profileIds, {
          orphanedReferences: normalized.orphanedReferences,
        });
        summary.transformable += 1;
        summary.insertReady += 1;
        summary.missingRelationships += optionalIssues;
        summary.warnings += optionalIssues;
        transformedChecksums.push(`${collection}:${document.id}:${transformed.checksum}`);
      } catch (error) {
        summary.errors += 1;
        const category = categorizeTransformError(error);
        summary.errorCategories[category] = (summary.errorCategories[category] ?? 0) + 1;
      }
    }
    summaries[FIRESTORE_COLLECTION_TARGETS[collection]] = summary;
  }

  const ownerDocuments = (collections.adminUsers ?? []).filter((document) => document.data.role === "owner" && document.data.active !== false);
  const resolvableOwners = ownerDocuments.filter((document) => profileUids.has(valueString(document.data.uid) || document.id));
  return {
    tables: summaries,
    relationships: {
      totalIssues: relationshipIssues.length,
      orphan: relationshipIssues.filter((issue) => issue.classification === "OPTIONAL_ORPHAN").length,
      optionalOrphan: relationshipIssues.filter((issue) => issue.classification === "OPTIONAL_ORPHAN").length,
      uniqueOptionalOrphanTargets: new Set(relationshipIssues.filter((issue) => issue.classification === "OPTIONAL_ORPHAN").map((issue) => issue.targetRefHash)).size,
      mandatoryOrphan: relationshipIssues.filter((issue) => issue.classification === "MANDATORY_ORPHAN").length,
      manualReview: relationshipIssues.filter((issue) => issue.classification === "MANDATORY_ORPHAN").length,
      byCollection: Object.fromEntries(MIGRATION_COLLECTION_ORDER.map((collection) => [collection, relationshipIssues.filter((issue) => issue.collection === collection).length])),
      byTarget: Object.fromEntries(Object.keys(referenceIndex).map((target) => [target, relationshipIssues.filter((issue) => issue.target === target).length])),
    },
    ownerMapping: {
      activeOwnerProfiles: ownerDocuments.length,
      resolvableOwnerProfiles: resolvableOwners.length,
      safe: ownerDocuments.length === 1 && resolvableOwners.length === 1,
    },
    checksum: deterministicChecksum(transformedChecksums.sort()),
  };
}

export function analyzeDuplicates(collections: SourceCollections, authUsers: readonly AuthUserSummaryInput[]) {
  const duplicateValues = (values: readonly string[]) => {
    const counts = new Map<string, number>();
    for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.values()].filter((count) => count > 1).length;
  };
  return {
    sourceIdGroups: Object.fromEntries(MIGRATION_COLLECTION_ORDER.map((collection) => [
      collection,
      duplicateValues((collections[collection] ?? []).map((document) => document.id)),
    ])),
    authEmailGroups: duplicateValues(authUsers.map((user) => user.email?.trim().toLowerCase() ?? "")),
    profileEmailGroups: duplicateValues((collections.adminUsers ?? []).map((document) => valueString(document.data.email).toLowerCase())),
    reminderDeterministicKeyGroups: duplicateValues((collections.reminderEvents ?? []).map((document) => valueString(document.data.deterministicKey))),
    deviceTokenGroups: duplicateValues((collections.deviceTokens ?? []).map((document) => valueString(document.data.token))),
  };
}

export function analyzeMoney(collections: SourceCollections) {
  const fields = ["estimatedValue", "initialProjectAmount", "projectValue", "monthlyFee", "wonValue"];
  const result = { inspected: 0, nullOrMissing: 0, strings: 0, negative: 0, overPrecision: 0, nonFinite: 0, extraordinary: 0, missingCurrency: 0 };
  for (const document of collections.leads ?? []) {
    if (!valueString(document.data.currency)) result.missingCurrency += 1;
    for (const field of fields) {
      const value = document.data[field];
      result.inspected += 1;
      if (value === null || value === undefined || value === "") { result.nullOrMissing += 1; continue; }
      if (typeof value === "string") result.strings += 1;
      const normalized = typeof value === "string" ? Number(value.replace(/[$L,\s]/g, "")) : Number(value);
      if (!Number.isFinite(normalized)) { result.nonFinite += 1; continue; }
      if (normalized < 0) result.negative += 1;
      if (Math.abs(normalized * 100 - Math.round(normalized * 100)) > Number.EPSILON * Math.max(1, Math.abs(normalized * 100)) * 4) result.overPrecision += 1;
      if (Math.abs(normalized) >= 100_000_000) result.extraordinary += 1;
    }
  }
  return result;
}

export function analyzeDates(collections: SourceCollections) {
  const dateFields: Partial<Record<FirestoreCollection, readonly string[]>> = {
    leads: ["billingStartDate", "followUpAt", "createdAt", "updatedAt"],
    tasks: ["date", "dueAt", "completedAt", "createdAt", "updatedAt"],
    notifications: ["createdAt", "updatedAt", "readAt", "deletedAt"],
    activityLogs: ["createdAt"],
    reminderEvents: ["dueAt", "retryAt", "leaseUntil", "completedAt", "createdAt", "updatedAt"],
  };
  const summary = { inspected: 0, missing: 0, firestoreTimestamp: 0, isoString: 0, dateOnly: 0, epoch: 0, malformed: 0 };
  for (const [collection, fields] of Object.entries(dateFields) as Array<[FirestoreCollection, readonly string[]]>) {
    for (const document of collections[collection] ?? []) {
      for (const field of fields) {
        summary.inspected += 1;
        const value = document.data[field];
        if (value === null || value === undefined || value === "") { summary.missing += 1; continue; }
        if (typeof value === "number") { summary.epoch += 1; if (!Number.isFinite(value)) summary.malformed += 1; continue; }
        if (typeof value === "string") {
          if (/^\d{4}-\d{2}-\d{2}$/.test(value)) summary.dateOnly += 1;
          else if (!Number.isNaN(new Date(value).getTime())) summary.isoString += 1;
          else summary.malformed += 1;
          continue;
        }
        if (typeof value === "object" && value && ("seconds" in value || "_seconds" in value || "toDate" in value)) summary.firestoreTimestamp += 1;
        else summary.malformed += 1;
      }
    }
  }
  return summary;
}

export function assertSanitizedFixture(value: unknown, forbiddenValues: readonly string[] = []) {
  const serialized = JSON.stringify(value);
  for (const forbidden of forbiddenValues.filter(Boolean)) {
    if (serialized.includes(forbidden)) throw new Error("Sanitized fixture contains source PII.");
  }
  if (/(BEGIN[ ]PRIVATE[ ]KEY|"passwordHash"\s*:|"passwordSalt"\s*:|refresh[_-]token|sb[_-]secret_)/i.test(serialized)) {
    throw new Error("Sanitized fixture contains credentials or password material.");
  }
  return true;
}
