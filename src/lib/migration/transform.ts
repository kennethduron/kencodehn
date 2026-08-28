import { createHash } from "node:crypto";

export const FIRESTORE_COLLECTION_TARGETS = {
  adminUsers: "profiles",
  leads: "leads",
  notes: "lead_notes",
  tasks: "tasks",
  notifications: "notifications",
  activityLogs: "activity_logs",
  emailLogs: "email_logs",
  pushLogs: "push_logs",
  deviceTokens: "device_tokens",
  adminSettings: "admin_settings",
  reminderEvents: "reminder_events",
} as const;

export type FirestoreCollection = keyof typeof FIRESTORE_COLLECTION_TARGETS;
export type ProfileIdMap = ReadonlyMap<string, string> | Readonly<Record<string, string>>;

export type MigrationRow = {
  sourceCollection: FirestoreCollection;
  sourceId: string;
  targetTable: (typeof FIRESTORE_COLLECTION_TARGETS)[FirestoreCollection];
  targetId: string;
  row: Record<string, unknown>;
  checksum: string;
};

export type MigrationTransformOptions = {
  orphanedReferences?: Readonly<Record<string, string>>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CRM_ROLES = ["owner", "admin", "manager", "viewer", "sales_agent"] as const;
const LEAD_STATUSES = ["new", "contacted", "conversation", "quoted", "won", "lost"] as const;
const LEAD_PRIORITIES = ["low", "medium", "high"] as const;
const PAYMENT_STATUSES = ["not_started", "pending", "partial", "paid", "overdue", "active"] as const;
const TASK_STATUSES = ["pending", "in_progress", "completed", "overdue", "cancelled"] as const;
const TASK_PRIORITIES = ["low", "medium", "high"] as const;
const TASK_TYPES = ["call", "whatsapp", "email", "meeting", "proposal", "follow_up"] as const;
const INVITATION_STATUSES = ["pending", "sent", "failed", "accepted"] as const;
const REMINDER_KINDS = ["one_day", "one_hour", "due", "overdue"] as const;
const REMINDER_STATUSES = ["pending", "processing", "completed", "failed"] as const;
const DELIVERY_STATUSES = ["pending", "sent", "failed", "skipped"] as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed migration row.");
  return value as Record<string, unknown>;
}

function string(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function optionalString(value: unknown) {
  const normalized = string(value);
  return normalized || null;
}

function boolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => string(item)).filter(Boolean) : [];
}

function json(value: unknown) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function legacyData(data: Record<string, unknown>, options: MigrationTransformOptions) {
  const source = json(data) as Record<string, unknown>;
  const orphanedReferences = options.orphanedReferences ?? {};
  if (!Object.keys(orphanedReferences).length) return source;
  return {
    ...source,
    orphaned_references: {
      ...(source.orphaned_references && typeof source.orphaned_references === "object" && !Array.isArray(source.orphaned_references)
        ? source.orphaned_references as Record<string, unknown>
        : {}),
      ...orphanedReferences,
    },
  };
}

export function assertKnownValue<const T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value as T[number])) {
    throw new Error(`Unknown ${field}: ${String(value)}`);
  }
  return value as T[number];
}

function knownOrDefault<const T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number], field: string) {
  if (value === undefined || value === null || value === "") return fallback;
  return assertKnownValue(value, allowed, field);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function targetUuidForFirebase(collection: string, sourceId: string) {
  if (!collection.trim() || !sourceId.trim()) throw new Error("Firebase collection and ID are required.");
  const bytes = Buffer.from(createHash("sha256").update(`ken-code/firebase/${collection}/${sourceId}`).digest("hex").slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function resolveProfileId(firebaseUid: unknown, profileIds: ProfileIdMap) {
  const uid = optionalString(firebaseUid);
  if (!uid) return null;
  const resolved = typeof (profileIds as ReadonlyMap<string, string>).get === "function"
    ? (profileIds as ReadonlyMap<string, string>).get(uid)
    : (profileIds as Readonly<Record<string, string>>)[uid];
  if (!isUuid(resolved)) throw new Error(`Missing Supabase profile mapping for Firebase UID ${uid.slice(0, 6)}…`);
  return resolved;
}

export function moneyToMinorUnits(value: unknown) {
  if (value === null || value === undefined || value === "") return BigInt(0);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) {
      throw new Error("Invalid monetary value.");
    }
    const scaled = value * 100;
    if (Math.abs(scaled - Math.round(scaled)) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4) {
      throw new Error("Monetary values cannot have more than two decimal places.");
    }
    return BigInt(Math.round(scaled));
  }
  const normalized = String(value).trim().replace(/[$L\s]/g, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error(`Invalid monetary value: ${String(value)}`);
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function normalizeCurrency(value: unknown, fallback = "USD") {
  const currency = string(value, fallback).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Invalid currency: ${currency}`);
  return currency;
}

export function firestoreTimestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid epoch timestamp.");
    const milliseconds = Math.abs(value) < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(milliseconds);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid epoch timestamp.");
    return parsed.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid timestamp: ${value}`);
    return parsed.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  const candidate = record(value);
  if (typeof candidate.toDate === "function") return (candidate.toDate as () => Date)().toISOString();
  const seconds = candidate.seconds ?? candidate._seconds;
  const nanoseconds = candidate.nanoseconds ?? candidate._nanoseconds ?? 0;
  if (typeof seconds === "number" && typeof nanoseconds === "number") {
    return new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000)).toISOString();
  }
  throw new Error("Invalid Firestore timestamp.");
}

export function parseCivilDate(value: unknown): string | null {
  const candidate = optionalString(value);
  if (!candidate) return null;
  const date = candidate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid civil date: ${candidate}`);
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`Invalid civil date: ${candidate}`);
  }
  return date;
}

export function deterministicReminderIdentity(taskFirebaseId: string, kind: string, dueAt: string) {
  const parsedKind = assertKnownValue(kind, REMINDER_KINDS, "reminder kind");
  const instant = firestoreTimestampToIso(dueAt);
  if (!instant) throw new Error("Reminder due time is required.");
  return createHash("sha256").update(`${taskFirebaseId}|${parsedKind}|${instant}`).digest("hex");
}

function checksum(row: Record<string, unknown>) {
  const canonicalize = (value: unknown): unknown => {
    if (typeof value === "bigint") return value.toString();
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]));
    }
    return value;
  };
  const serialized = JSON.stringify(canonicalize(row));
  return createHash("sha256").update(serialized).digest("hex");
}

function base(collection: FirestoreCollection, sourceId: string, row: Record<string, unknown>, targetId = targetUuidForFirebase(collection, sourceId)): MigrationRow {
  return {
    sourceCollection: collection,
    sourceId,
    targetTable: FIRESTORE_COLLECTION_TARGETS[collection],
    targetId,
    row,
    checksum: checksum(row),
  };
}

export function transformFirestoreDocument(
  collection: FirestoreCollection,
  sourceId: string,
  input: unknown,
  profileIds: ProfileIdMap = {},
  options: MigrationTransformOptions = {},
): MigrationRow {
  if (!sourceId.trim()) throw new Error("Source ID is required.");
  const data = record(input);
  const id = targetUuidForFirebase(collection, sourceId);
  const createdAt = firestoreTimestampToIso(data.createdAt);
  const updatedAt = firestoreTimestampToIso(data.updatedAt) ?? createdAt;

  if (collection === "adminUsers") {
    const profileId = resolveProfileId(sourceId, profileIds) ?? resolveProfileId(data.uid, profileIds);
    if (!profileId) throw new Error("Supabase Auth UUID is required before migrating a profile.");
    const email = string(data.email).toLowerCase();
    if (!email.includes("@")) throw new Error("Profile email is invalid.");
    const row = {
      id: profileId,
      firebase_id: sourceId,
      firebase_uid: string(data.uid, sourceId),
      name: string(data.name ?? data.displayName),
      email,
      role: assertKnownValue(data.role, CRM_ROLES, "role"),
      active: data.active === undefined ? true : boolean(data.active),
      invitation_status: data.invitationStatus ? assertKnownValue(data.invitationStatus, INVITATION_STATUSES, "invitation status") : null,
      invited_at: firestoreTimestampToIso(data.invitedAt),
      invited_by: resolveProfileId(data.invitedByUid, profileIds),
      invitation_last_sent_at: firestoreTimestampToIso(data.invitationLastSentAt),
      invitation_error: optionalString(data.invitationError),
      last_login_at: firestoreTimestampToIso(data.lastLoginAt),
      metadata: {},
      created_at: createdAt,
      updated_at: updatedAt,
    };
    return base(collection, sourceId, row, profileId);
  }

  if (collection === "leads") {
    const row = {
      id,
      firebase_id: sourceId,
      name: string(data.name, "Sin nombre"),
      business: string(data.business ?? data.company),
      email: string(data.email).toLowerCase(),
      phone: string(data.phone),
      project: string(data.project, "Proyecto web"),
      budget: string(data.budget),
      message: string(data.message),
      locale: knownOrDefault(data.locale, ["es", "en"] as const, "es", "locale"),
      status: knownOrDefault(data.status, LEAD_STATUSES, "new", "lead status"),
      priority: knownOrDefault(data.priority, LEAD_PRIORITIES, "medium", "lead priority"),
      estimated_value_minor: moneyToMinorUnits(data.estimatedValue).toString(),
      initial_project_amount_minor: moneyToMinorUnits(data.initialProjectAmount ?? data.projectValue ?? data.estimatedValue).toString(),
      monthly_fee_minor: moneyToMinorUnits(data.monthlyFee).toString(),
      won_value_minor: moneyToMinorUnits(data.wonValue).toString(),
      currency: normalizeCurrency(data.currency),
      payment_status: knownOrDefault(data.paymentStatus, PAYMENT_STATUSES, "not_started", "payment status"),
      billing_start_date: parseCivilDate(data.billingStartDate),
      billing_notes: string(data.billingNotes),
      last_contact_at: firestoreTimestampToIso(data.lastContactAt),
      next_action: string(data.nextAction),
      follow_up_at: firestoreTimestampToIso(data.followUpAt),
      follow_up_timezone: string(data.followUpTimezone, "America/Tegucigalpa"),
      assigned_to: resolveProfileId(data.assignedToUid, profileIds),
      assigned_at: firestoreTimestampToIso(data.assignedAt),
      assigned_by: resolveProfileId(data.assignedByUid, profileIds),
      assigned_to_name: optionalString(data.assignedToName),
      assigned_to_email: optionalString(data.assignedToEmail),
      assigned_by_email: optionalString(data.assignedByEmail),
      source: string(data.source, "public_website"),
      source_path: string(data.sourcePath, "/cotizar"),
      metadata: json(data.metadata) ?? {},
      tags: stringArray(data.tags).length ? stringArray(data.tags) : stringArray(record(data.crm ?? {}).tags),
      legacy_crm: json(data.crm) ?? {},
      legacy_data: legacyData(data, options),
      created_at: createdAt,
      updated_at: updatedAt,
    };
    return base(collection, sourceId, row);
  }

  if (collection === "notes") {
    const leadId = string(data.leadId);
    if (!leadId || !string(data.text)) throw new Error("Note requires leadId and text.");
    return base(collection, sourceId, {
      id,
      firebase_id: sourceId,
      lead_id: targetUuidForFirebase("leads", leadId),
      body: string(data.text),
      author_id: resolveProfileId(data.createdBy, profileIds),
      author_firebase_uid: optionalString(data.createdBy),
      author_email: optionalString(data.createdByEmail),
      legacy_data: legacyData(data, options),
      created_at: createdAt,
    });
  }

  if (collection === "tasks") {
    const leadId = optionalString(data.leadId);
    const status = knownOrDefault(data.status, TASK_STATUSES, "pending", "task status");
    const completedAt = firestoreTimestampToIso(data.completedAt);
    return base(collection, sourceId, {
      id,
      firebase_id: sourceId,
      lead_id: leadId ? targetUuidForFirebase("leads", leadId) : null,
      title: string(data.title, "Tarea"),
      description: string(data.description),
      type: knownOrDefault(data.type, TASK_TYPES, "follow_up", "task type"),
      status,
      priority: knownOrDefault(data.priority, TASK_PRIORITIES, "medium", "task priority"),
      due_date: parseCivilDate(data.date),
      due_time: optionalString(data.time),
      timezone: string(data.timezone, "America/Tegucigalpa"),
      due_at: firestoreTimestampToIso(data.dueAt),
      reminder_at: firestoreTimestampToIso(data.reminderAt),
      reminder_one_day_sent_at: firestoreTimestampToIso(data.reminder1DaySentAt),
      reminder_one_hour_sent_at: firestoreTimestampToIso(data.reminder1HourSentAt),
      due_notification_sent_at: firestoreTimestampToIso(data.dueNotificationSentAt),
      overdue_email_sent_at: firestoreTimestampToIso(data.overdueEmailSentAt),
      overdue_notified_at: firestoreTimestampToIso(data.overdueNotifiedAt),
      assigned_to: resolveProfileId(data.assignedToUid, profileIds),
      assigned_at: firestoreTimestampToIso(data.assignedAt),
      assigned_by: resolveProfileId(data.assignedByUid, profileIds),
      assigned_to_name: optionalString(data.assignedToName),
      assigned_to_email: optionalString(data.assignedToEmail),
      assigned_by_email: optionalString(data.assignedByEmail),
      created_by: resolveProfileId(data.createdByUid, profileIds),
      created_by_email: optionalString(data.createdByEmail ?? data.createdBy),
      completed_at: completedAt,
      completed_by: resolveProfileId(data.completedByUid, profileIds),
      completed_by_email: optionalString(data.completedByEmail),
      legacy_data: legacyData(data, options),
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  if (collection === "notifications") {
    const leadId = optionalString(data.leadId);
    const taskId = optionalString(data.taskId);
    return base(collection, sourceId, {
      id,
      firebase_id: sourceId,
      recipient_id: resolveProfileId(data.recipientUid, profileIds),
      recipient_name: optionalString(data.recipientName),
      recipient_email: optionalString(data.recipientEmail),
      lead_id: leadId ? targetUuidForFirebase("leads", leadId) : null,
      task_id: taskId ? targetUuidForFirebase("tasks", taskId) : null,
      type: string(data.type, "system"),
      severity: knownOrDefault(data.severity, ["info", "success", "warning", "danger"] as const, "info", "notification severity"),
      title: string(data.title, "Notificación"),
      message: string(data.message),
      action_url: optionalString(data.actionUrl),
      is_read: boolean(data.read),
      read_at: firestoreTimestampToIso(data.readAt),
      deleted_at: firestoreTimestampToIso(data.deletedAt),
      legacy_data: legacyData(data, options),
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  if (collection === "activityLogs") {
    const leadId = options.orphanedReferences?.lead_id
      ? null
      : optionalString(data.leadId ?? (data.entityType === "lead" ? data.entityId : null));
    const taskId = options.orphanedReferences?.task_id
      ? null
      : optionalString(data.taskId ?? (data.entityType === "task" ? data.entityId : null));
    const noteId = optionalString(data.noteId);
    return base(collection, sourceId, {
      id,
      firebase_id: sourceId,
      entity_type: knownOrDefault(data.entityType, ["lead", "note", "task", "notification", "user", "system"] as const, "lead", "entity type"),
      entity_id: string(data.entityId),
      lead_id: leadId ? targetUuidForFirebase("leads", leadId) : null,
      task_id: taskId ? targetUuidForFirebase("tasks", taskId) : null,
      note_id: noteId ? targetUuidForFirebase("notes", noteId) : null,
      actor_id: resolveProfileId(data.actorUid ?? data.userUid ?? data.performedByUid, profileIds),
      actor_firebase_uid: optionalString(data.actorUid ?? data.userUid ?? data.performedByUid),
      actor_email: optionalString(data.actorEmail ?? data.userEmail ?? data.performedByEmail),
      recipient_id: resolveProfileId(data.recipientUid, profileIds),
      target_user_id: resolveProfileId(data.targetUid, profileIds),
      action: string(data.action, "activity"),
      title: string(data.title),
      description: string(data.description),
      before_data: json(data.before),
      after_data: json(data.after),
      metadata: Object.keys(options.orphanedReferences ?? {}).length
        ? { orphaned_references: options.orphanedReferences }
        : {},
      created_at: createdAt,
    });
  }

  if (collection === "deviceTokens") {
    const profileId = resolveProfileId(data.uid, profileIds);
    if (!profileId || !string(data.token)) throw new Error("Device token requires a mapped profile and token.");
    return base(collection, sourceId, {
      id,
      firebase_id: sourceId,
      profile_id: profileId,
      token: string(data.token),
      token_hash: createHash("sha256").update(string(data.token)).digest("hex"),
      platform: string(data.platform),
      user_agent: string(data.userAgent),
      active: data.active === undefined ? true : boolean(data.active),
      disabled_by: resolveProfileId(data.disabledByUid, profileIds),
      disabled_at: firestoreTimestampToIso(data.disabledAt),
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  if (collection === "emailLogs" || collection === "pushLogs") {
    const leadId = optionalString(data.relatedLeadId);
    const taskId = optionalString(data.relatedTaskId);
    const common = {
      id,
      firebase_id: sourceId,
      type: string(data.type, "system"),
      sent: boolean(data.sent),
      reason: optionalString(data.reason),
      lead_id: leadId ? targetUuidForFirebase("leads", leadId) : null,
      task_id: taskId ? targetUuidForFirebase("tasks", taskId) : null,
      idempotency_key: optionalString(data.idempotencyKey),
      metadata: json(data),
      created_at: createdAt,
    };
    if (collection === "emailLogs") {
      return base(collection, sourceId, {
        ...common,
        recipient: optionalString(data.to),
        subject: string(data.subject),
        provider_id: optionalString(data.providerId),
        provider_message_id: optionalString(data.providerMessageId),
        related_user_id: resolveProfileId(data.relatedUserUid, profileIds),
      });
    }
    const tokenId = optionalString(data.tokenId);
    return base(collection, sourceId, {
      ...common,
      device_token_id: tokenId ? targetUuidForFirebase("deviceTokens", tokenId) : null,
      title: string(data.title),
      message: string(data.message),
    });
  }

  if (collection === "adminSettings") {
    return base(collection, sourceId, {
      id: "default",
      firebase_id: sourceId,
      email_notifications_enabled: data.emailNotificationsEnabled !== false,
      push_notifications_enabled: data.pushNotificationsEnabled !== false,
      internal_notifications_enabled: data.internalNotificationsEnabled !== false,
      task_reminder_one_day_enabled: data.taskReminder1DayEnabled !== false,
      task_reminder_one_hour_enabled: data.taskReminder1HourEnabled !== false,
      task_due_enabled: data.taskDueEnabled !== false,
      task_overdue_enabled: data.taskOverdueEnabled !== false,
      daily_summary_enabled: boolean(data.dailySummaryEnabled),
      notification_sound_enabled: data.notificationSoundEnabled !== false,
      compact_mode_enabled: boolean(data.compactModeEnabled),
      updated_by: resolveProfileId(data.updatedByUid, profileIds),
      updated_by_email: optionalString(data.updatedBy),
      legacy_data: legacyData(data, options),
      created_at: createdAt,
      updated_at: updatedAt,
    }, "default");
  }

  const taskFirebaseId = string(data.taskId);
  const recipientId = resolveProfileId(data.recipientUid ?? data.assignedToUid, profileIds);
  if (!taskFirebaseId || !recipientId) throw new Error("Reminder event requires task and recipient mappings.");
  const kind = assertKnownValue(data.kind, REMINDER_KINDS, "reminder kind");
  const dueAt = firestoreTimestampToIso(data.dueAt);
  if (!dueAt) throw new Error("Reminder due time is required.");
  return base(collection, sourceId, {
    id,
    firebase_id: sourceId,
    deterministic_key: string(data.deterministicKey) || deterministicReminderIdentity(taskFirebaseId, kind, dueAt),
    task_id: targetUuidForFirebase("tasks", taskFirebaseId),
    recipient_id: recipientId,
    kind,
    status: knownOrDefault(data.status, REMINDER_STATUSES, "pending", "reminder status"),
    notification_status: knownOrDefault(record(data.notification ?? {}).status, DELIVERY_STATUSES, "pending", "notification delivery status"),
    notification_error: optionalString(record(data.notification ?? {}).error),
    email_status: knownOrDefault(record(data.email ?? {}).status, DELIVERY_STATUSES, "pending", "email delivery status"),
    email_error: optionalString(record(data.email ?? {}).error),
    push_status: knownOrDefault(record(data.push ?? {}).status, DELIVERY_STATUSES, "pending", "push delivery status"),
    push_error: optionalString(record(data.push ?? {}).error),
    attempts: Number.isInteger(data.attempts) && Number(data.attempts) >= 0 ? Number(data.attempts) : 0,
    lease_token: isUuid(data.leaseToken) ? data.leaseToken : null,
    lease_until: firestoreTimestampToIso(data.leaseUntil),
    retry_at: firestoreTimestampToIso(data.retryAt),
    completed_at: firestoreTimestampToIso(data.completedAt),
    metadata: json(data),
    created_at: createdAt,
    updated_at: updatedAt,
  });
}

export function migrationMapRow(result: MigrationRow) {
  return {
    source_system: "firebase",
    source_collection: result.sourceCollection,
    source_id: result.sourceId,
    target_table: result.targetTable,
    target_id: result.targetId,
    source_version: "firebase-v1",
    checksum: result.checksum,
  };
}
