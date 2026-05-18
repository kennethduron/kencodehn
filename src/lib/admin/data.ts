import { FieldValue, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { formatActivityMessage, formatActivityTitle } from "@/lib/admin/activity";
import type { ActivityLog, AdminLead, AdminNote, AdminNotification, AdminTask, AdminUser, LeadPriority, LeadStatus, TaskPriority, TaskStatus, TaskType } from "@/lib/admin/types";

function toIso(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeStatus(value: unknown): LeadStatus {
  if (value === "contacted" || value === "conversation" || value === "quoted" || value === "won" || value === "lost") {
    return value;
  }
  return "new";
}

function normalizePriority(value: unknown): LeadPriority {
  if (value === "low" || value === "high") {
    return value;
  }
  return "medium";
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  if (value === "in_progress" || value === "completed" || value === "overdue") {
    return value;
  }
  return "pending";
}

function normalizeTaskPriority(value: unknown): TaskPriority {
  if (value === "low" || value === "high") {
    return value;
  }
  return "medium";
}

function normalizeTaskType(value: unknown): TaskType {
  if (value === "call" || value === "whatsapp" || value === "email" || value === "meeting" || value === "proposal") {
    return value;
  }
  return "follow_up";
}

function normalizeNotificationType(value: unknown): AdminNotification["type"] {
  const valid = ["lead", "task", "lead_new", "lead_status_changed", "lead_priority_changed", "note_added", "task_created", "task_updated", "task_completed", "task_overdue", "system"];
  return valid.includes(String(value)) ? String(value) as AdminNotification["type"] : "system";
}

function normalizeSeverity(value: unknown): AdminNotification["severity"] {
  if (value === "success" || value === "warning" || value === "danger") {
    return value;
  }
  return "info";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
}

export function mapLead(doc: QueryDocumentSnapshot<DocumentData>): AdminLead {
  const data = doc.data();
  return {
    id: doc.id,
    name: String(data.name ?? "Sin nombre"),
    business: String(data.business ?? data.company ?? "Sin empresa"),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    project: String(data.project ?? "Proyecto web"),
    budget: String(data.budget ?? ""),
    message: String(data.message ?? ""),
    locale: data.locale === "en" ? "en" : "es",
    sourcePath: String(data.sourcePath ?? "/cotizar"),
    source: String(data.source ?? "public_website"),
    status: normalizeStatus(data.status),
    priority: normalizePriority(data.priority),
    estimatedValue: toNumber(data.estimatedValue),
    wonValue: toNumber(data.wonValue),
    lastContactAt: toIso(data.lastContactAt),
    nextAction: String(data.nextAction ?? ""),
    followUpAt: toIso(data.followUpAt),
    tags: toStringArray(data.tags).length ? toStringArray(data.tags) : toStringArray(data.crm?.tags),
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(data.updatedAt) ?? toIso(data.createdAt) ?? new Date(0).toISOString(),
  };
}

export function mapNote(doc: QueryDocumentSnapshot<DocumentData>): AdminNote {
  const data = doc.data();
  return {
    id: doc.id,
    leadId: String(data.leadId ?? ""),
    text: String(data.text ?? ""),
    createdBy: String(data.createdBy ?? ""),
    createdByEmail: String(data.createdByEmail ?? ""),
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
  };
}

export function mapTask(doc: QueryDocumentSnapshot<DocumentData>): AdminTask {
  const data = doc.data();
  return {
    id: doc.id,
    title: String(data.title ?? "Tarea"),
    description: String(data.description ?? ""),
    leadId: data.leadId ? String(data.leadId) : null,
    leadName: data.leadName ? String(data.leadName) : null,
    date: String(data.date ?? ""),
    time: String(data.time ?? ""),
    dueAt: toIso(data.dueAt),
    priority: normalizeTaskPriority(data.priority),
    status: normalizeTaskStatus(data.status),
    type: normalizeTaskType(data.type),
    reminderAt: toIso(data.reminderAt),
    completedAt: toIso(data.completedAt),
    overdueNotifiedAt: toIso(data.overdueNotifiedAt),
    createdBy: String(data.createdBy ?? ""),
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(data.updatedAt) ?? new Date(0).toISOString(),
  };
}

export function mapNotification(doc: QueryDocumentSnapshot<DocumentData>): AdminNotification {
  const data = doc.data();
  return {
    id: doc.id,
    title: String(data.title ?? "Notificacion"),
    message: String(data.message ?? ""),
    type: normalizeNotificationType(data.type),
    severity: normalizeSeverity(data.severity),
    leadId: data.leadId ? String(data.leadId) : null,
    taskId: data.taskId ? String(data.taskId) : null,
    actionUrl: data.actionUrl ? String(data.actionUrl) : null,
    read: Boolean(data.read),
    readAt: toIso(data.readAt),
    deletedAt: toIso(data.deletedAt),
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
  };
}

export function mapActivityLog(doc: QueryDocumentSnapshot<DocumentData>): ActivityLog {
  const data = doc.data();
  const draft = {
    id: doc.id,
    entityType: data.entityType === "note" || data.entityType === "task" || data.entityType === "notification" || data.entityType === "system" ? data.entityType : "lead",
    entityId: String(data.entityId ?? ""),
    leadId: data.leadId ? String(data.leadId) : data.entityType === "lead" ? String(data.entityId ?? "") : null,
    taskId: data.taskId ? String(data.taskId) : null,
    noteId: data.noteId ? String(data.noteId) : null,
    action: String(data.action ?? "activity"),
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    before: data.before ?? null,
    after: data.after ?? null,
    userEmail: String(data.userEmail ?? ""),
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
  } satisfies ActivityLog;
  return {
    ...draft,
    title: draft.title || formatActivityTitle(draft.action),
    description: draft.description || formatActivityMessage(draft),
  };
}

export async function addActivityLog(entry: Omit<ActivityLog, "id" | "createdAt" | "title" | "description"> & { title?: string; description?: string }) {
  const db = getAdminDb();
  if (!db) {
    return;
  }
  const draft = {
    id: "draft",
    createdAt: new Date().toISOString(),
    title: entry.title || "",
    description: entry.description || "",
    ...entry,
  } as ActivityLog;
  await db.collection("activityLogs").add({
    ...entry,
    title: entry.title || formatActivityTitle(entry.action),
    description: entry.description || formatActivityMessage(draft),
    createdAt: draft.createdAt,
  });
}

export async function listActivityLogs(leadId?: string, limit = 100) {
  const db = getAdminDb();
  if (!db) {
    return [];
  }
  const snapshot = leadId
    ? await db.collection("activityLogs").where("leadId", "==", leadId).limit(limit).get()
    : await db.collection("activityLogs").orderBy("createdAt", "desc").limit(limit).get();
  return snapshot.docs.map(mapActivityLog).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listLeads() {
  const db = getAdminDb();
  if (!db) {
    return [];
  }

  const snapshot = await db.collection("leads").orderBy("createdAt", "desc").limit(200).get();
  return snapshot.docs.map(mapLead);
}

export async function getLead(id: string) {
  const db = getAdminDb();
  if (!db) {
    return null;
  }
  const doc = await db.collection("leads").doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return mapLead(doc as QueryDocumentSnapshot<DocumentData>);
}

export async function listNotes(leadId: string) {
  const db = getAdminDb();
  if (!db) {
    return [];
  }
  const snapshot = await db.collection("notes").where("leadId", "==", leadId).limit(100).get();
  return snapshot.docs.map(mapNote).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listTasks(leadId?: string) {
  const db = getAdminDb();
  if (!db) {
    return [];
  }
  const snapshot = leadId
    ? await db.collection("tasks").where("leadId", "==", leadId).limit(200).get()
    : await db.collection("tasks").orderBy("createdAt", "desc").limit(200).get();
  return snapshot.docs.map(mapTask).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function checkOverdueTasks(admin?: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    return [];
  }
  const now = new Date();
  const snapshot = await db.collection("tasks").where("status", "in", ["pending", "in_progress"]).limit(200).get();
  const changed: string[] = [];

  for (const doc of snapshot.docs) {
    const task = mapTask(doc);
    if (!task.dueAt || new Date(task.dueAt) >= now || task.overdueNotifiedAt) {
      continue;
    }
    const notifiedAt = now.toISOString();
    await doc.ref.set({ status: "overdue", overdueNotifiedAt: notifiedAt, updatedAt: notifiedAt }, { merge: true });
    await createNotification({
      title: "Tarea vencida",
      message: `${task.title}${task.leadName ? ` para ${task.leadName}` : ""} vencio y requiere seguimiento.`,
      type: "task_overdue",
      severity: "danger",
      leadId: task.leadId,
      taskId: task.id,
      actionUrl: task.leadId ? `/admin/leads/${task.leadId}` : "/admin/tareas",
    });
    await addActivityLog({
      entityType: "task",
      entityId: task.id,
      leadId: task.leadId,
      taskId: task.id,
      action: "task_overdue",
      before: { status: task.status },
      after: { status: "overdue", overdueNotifiedAt: notifiedAt },
      userEmail: admin?.email ?? "system",
    });
    changed.push(task.id);
  }
  return changed;
}

export async function listNotifications() {
  const db = getAdminDb();
  if (!db) {
    return [];
  }
  const snapshot = await db.collection("notifications").orderBy("createdAt", "desc").limit(100).get();
  return snapshot.docs.map(mapNotification).filter((notification) => !notification.deletedAt);
}

export async function createNotification(input: {
  title: string;
  message: string;
  type: AdminNotification["type"];
  severity?: AdminNotification["severity"];
  leadId?: string | null;
  taskId?: string | null;
  actionUrl?: string | null;
}) {
  const db = getAdminDb();
  if (!db) {
    return null;
  }
  const now = new Date().toISOString();
  const doc = await db.collection("notifications").add({
    title: input.title,
    message: input.message,
    type: input.type,
    severity: input.severity ?? "info",
    leadId: input.leadId ?? null,
    taskId: input.taskId ?? null,
    actionUrl: input.actionUrl ?? null,
    read: false,
    readAt: null,
    deletedAt: null,
    createdAt: now,
  });
  return doc.id;
}

export async function updateLead(id: string, updates: Partial<AdminLead>, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const ref = db.collection("leads").doc(id);
  const before = await ref.get();
  const payload = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(payload, { merge: true });
  const beforeData = before.exists ? before.data() : null;
  const changedFields = Object.keys(updates);
  const primaryAction = changedFields.includes("status")
    ? "lead_status_changed"
    : changedFields.includes("priority")
      ? "lead_priority_changed"
      : changedFields.some((field) => ["nextAction", "followUpAt", "lastContactAt"].includes(field))
        ? "lead_followup_updated"
        : changedFields.includes("tags")
          ? "lead_tags_updated"
          : changedFields.includes("estimatedValue")
            ? "lead_value_updated"
            : "lead_updated";
  if (primaryAction === "lead_status_changed") {
    await createNotification({
      title: "Estado de lead actualizado",
      message: `${String(beforeData?.name ?? "Lead")} cambio a ${String(updates.status)}.`,
      type: "lead_status_changed",
      severity: updates.status === "won" ? "success" : updates.status === "lost" ? "warning" : "info",
      leadId: id,
      actionUrl: `/admin/leads/${id}`,
    });
  }
  if (primaryAction === "lead_priority_changed") {
    await createNotification({
      title: "Prioridad de lead actualizada",
      message: `${String(beforeData?.name ?? "Lead")} ahora tiene prioridad ${String(updates.priority)}.`,
      type: "lead_priority_changed",
      severity: updates.priority === "high" ? "warning" : "info",
      leadId: id,
      actionUrl: `/admin/leads/${id}`,
    });
  }
  await addActivityLog({
    entityType: "lead",
    entityId: id,
    leadId: id,
    action: primaryAction,
    before: beforeData,
    after: payload,
    userEmail: admin.email,
  });
}

export async function addNote(leadId: string, text: string, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const now = new Date().toISOString();
  const doc = await db.collection("notes").add({
    leadId,
    text,
    createdBy: admin.uid,
    createdByEmail: admin.email,
    createdAt: now,
  });
  await db.collection("leads").doc(leadId).set({ updatedAt: now }, { merge: true });
  await createNotification({
    title: "Nota agregada",
    message: `Se agrego una nota interna al lead.`,
    type: "note_added",
    severity: "info",
    leadId,
    actionUrl: `/admin/leads/${leadId}`,
  });
  await addActivityLog({
    entityType: "note",
    entityId: doc.id,
    leadId,
    noteId: doc.id,
    action: "note_added",
    before: null,
    after: { leadId, text },
    userEmail: admin.email,
  });
  return doc.id;
}

export async function createTask(input: Partial<AdminTask>, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const now = new Date().toISOString();
  const dueAt = input.date ? new Date(`${input.date}T${input.time || "09:00"}:00`).toISOString() : null;
  const payload = {
    title: input.title || "Seguimiento",
    description: input.description || "",
    leadId: input.leadId || null,
    leadName: input.leadName || null,
    date: input.date || "",
    time: input.time || "",
    dueAt,
    priority: normalizeTaskPriority(input.priority),
    status: normalizeTaskStatus(input.status),
    type: normalizeTaskType(input.type),
    reminderAt: dueAt,
    completedAt: input.status === "completed" ? now : null,
    overdueNotifiedAt: null,
    createdBy: admin.email,
    createdAt: now,
    updatedAt: now,
  };
  const doc = await db.collection("tasks").add(payload);
  const notificationId = await createNotification({
    title: "Nueva tarea creada",
    message: `${payload.title}${payload.leadName ? ` para ${payload.leadName}` : ""}.`,
    type: "task_created",
    severity: payload.priority === "high" ? "warning" : "info",
    leadId: payload.leadId,
    taskId: doc.id,
    actionUrl: payload.leadId ? `/admin/leads/${payload.leadId}` : "/admin/tareas",
  });
  await addActivityLog({
    entityType: "task",
    entityId: doc.id,
    leadId: payload.leadId,
    taskId: doc.id,
    action: "task_created",
    before: null,
    after: { ...payload, notificationId },
    userEmail: admin.email,
  });
  return doc.id;
}

export async function updateTask(id: string, updates: Partial<AdminTask>, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const ref = db.collection("tasks").doc(id);
  const before = await ref.get();
  const beforeData = before.exists ? before.data() : {};
  const date = updates.date ?? String(beforeData?.date ?? "");
  const time = updates.time ?? String(beforeData?.time ?? "");
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { ...updates, updatedAt: now };
  if (updates.date !== undefined || updates.time !== undefined) {
    payload.dueAt = date ? new Date(`${date}T${time || "09:00"}:00`).toISOString() : null;
    payload.reminderAt = payload.dueAt;
    payload.overdueNotifiedAt = null;
  }
  if (updates.status === "completed") {
    payload.completedAt = now;
  }
  if (updates.status && updates.status !== "completed") {
    payload.completedAt = null;
  }
  await ref.set(payload, { merge: true });
  if (updates.status === "completed") {
    await createNotification({
      title: "Tarea completada",
      message: `${String(beforeData?.title ?? updates.title ?? "Tarea")} fue marcada como completada.`,
      type: "task_completed",
      severity: "success",
      leadId: beforeData?.leadId ? String(beforeData.leadId) : null,
      taskId: id,
      actionUrl: beforeData?.leadId ? `/admin/leads/${beforeData.leadId}` : "/admin/tareas",
    });
  } else if (Object.keys(updates).some((field) => ["title", "description", "date", "time", "priority", "type"].includes(field))) {
    await createNotification({
      title: "Tarea actualizada",
      message: `${String(beforeData?.title ?? updates.title ?? "Tarea")} fue actualizada.`,
      type: "task_updated",
      severity: updates.priority === "high" ? "warning" : "info",
      leadId: beforeData?.leadId ? String(beforeData.leadId) : null,
      taskId: id,
      actionUrl: beforeData?.leadId ? `/admin/leads/${beforeData.leadId}` : "/admin/tareas",
    });
  }
  await addActivityLog({
    entityType: "task",
    entityId: id,
    leadId: before.exists ? String(before.data()?.leadId ?? "") || null : null,
    taskId: id,
    action: "task_updated",
    before: before.exists ? before.data() : null,
    after: payload,
    userEmail: admin.email,
  });
}

export async function deleteTask(id: string, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const ref = db.collection("tasks").doc(id);
  const before = await ref.get();
  await ref.delete();
  await addActivityLog({
    entityType: "task",
    entityId: id,
    leadId: before.exists ? String(before.data()?.leadId ?? "") || null : null,
    taskId: id,
    action: "task_deleted",
    before: before.exists ? before.data() : null,
    after: null,
    userEmail: admin.email,
  });
}

export async function updateNotificationRead(id: string, read: boolean, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  await db.collection("notifications").doc(id).set({ read, readAt: read ? new Date().toISOString() : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await addActivityLog({
    entityType: "notification",
    entityId: id,
    leadId: null,
    action: read ? "notification_read" : "notification_unread",
    before: null,
    after: { read },
    userEmail: admin.email,
  });
}

export async function markAllNotificationsRead(admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const now = new Date().toISOString();
  const snapshot = await db.collection("notifications").where("read", "==", false).limit(100).get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.set(doc.ref, { read: true, readAt: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
  await batch.commit();
  await addActivityLog({
    entityType: "notification",
    entityId: "all",
    leadId: null,
    action: "notifications_read_all",
    before: null,
    after: { count: snapshot.size },
    userEmail: admin.email,
  });
}

export async function deleteNotification(id: string, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  await db.collection("notifications").doc(id).set({ deletedAt: new Date().toISOString(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await addActivityLog({
    entityType: "notification",
    entityId: id,
    leadId: null,
    action: "notification_deleted",
    before: null,
    after: { deletedAt: true },
    userEmail: admin.email,
  });
}
