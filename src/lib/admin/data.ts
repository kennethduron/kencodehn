import { FieldValue, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { formatActivityMessage, formatActivityTitle } from "@/lib/admin/activity";
import { sendLeadStatusEmail } from "@/lib/email/service";
import { getAdminSettings } from "@/lib/admin/settings";
import {
  canAccessLead,
  canAccessNotification,
  canAccessTask,
  canAssignLead,
  isAssignableSalesAgent,
  isTaskAssigneeProfile,
  leadDataScopeForAdmin,
  notificationDataScopeForAdmin,
  resolveLeadAssignmentAction,
  resolveTaskAssigneeForRequest,
  taskDataScopeForAdmin,
} from "@/lib/admin/authorization";
import { HONDURAS_TIME_ZONE, getHondurasDatePart, getHondurasTimePart, hondurasDateTimeToIso } from "@/lib/time";
import type { ActivityLog, AdminLead, AdminNote, AdminNotification, AdminTask, AdminUser, LeadPriority, LeadStatus, PaymentStatus, TaskPriority, TaskStatus, TaskType } from "@/lib/admin/types";

export class LeadAccessError extends Error {
  constructor(message = "Lead no encontrado.") {
    super(message);
    this.name = "LeadAccessError";
  }
}

export class LeadAssignmentError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "LeadAssignmentError";
  }
}

export class TaskAccessError extends Error {
  constructor(public status = 404, message = "Tarea no encontrada.") {
    super(message);
    this.name = "TaskAccessError";
  }
}

export class NotificationAccessError extends Error {
  constructor(public status = 404, message = "Notificacion no encontrada.") {
    super(message);
    this.name = "NotificationAccessError";
  }
}

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

function normalizePaymentStatus(value: unknown): PaymentStatus {
  if (value === "pending" || value === "partial" || value === "paid" || value === "overdue" || value === "active") {
    return value;
  }
  return "not_started";
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  if (value === "in_progress" || value === "completed" || value === "overdue" || value === "cancelled") {
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
  const valid = ["lead", "task", "lead_new", "lead_status_changed", "lead_priority_changed", "note_added", "task_created", "task_updated", "task_completed", "task_reminder", "task_due", "task_overdue", "system"];
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
  const followUpAt = toIso(data.followUpAt);
  const followUpDate = String(data.followUpDate ?? "") || getHondurasDatePart(followUpAt);
  const followUpTime = String(data.followUpTime ?? "") || getHondurasTimePart(followUpAt);
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
    initialProjectAmount: toNumber(data.initialProjectAmount ?? data.projectValue ?? data.estimatedValue),
    monthlyFee: toNumber(data.monthlyFee),
    paymentStatus: normalizePaymentStatus(data.paymentStatus),
    billingStartDate: toIso(data.billingStartDate),
    billingNotes: String(data.billingNotes ?? ""),
    wonValue: toNumber(data.wonValue),
    lastContactAt: toIso(data.lastContactAt),
    nextAction: String(data.nextAction ?? ""),
    followUpDate,
    followUpTime,
    followUpTimezone: String(data.followUpTimezone ?? HONDURAS_TIME_ZONE),
    followUpAt,
    tags: toStringArray(data.tags).length ? toStringArray(data.tags) : toStringArray(data.crm?.tags),
    assignedToUid: data.assignedToUid ? String(data.assignedToUid) : null,
    assignedToName: data.assignedToName ? String(data.assignedToName) : null,
    assignedToEmail: data.assignedToEmail ? String(data.assignedToEmail) : null,
    assignedAt: toIso(data.assignedAt),
    assignedByUid: data.assignedByUid ? String(data.assignedByUid) : null,
    assignedByEmail: data.assignedByEmail ? String(data.assignedByEmail) : null,
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
    timezone: String(data.timezone ?? HONDURAS_TIME_ZONE),
    dueAt: toIso(data.dueAt),
    priority: normalizeTaskPriority(data.priority),
    status: normalizeTaskStatus(data.status),
    type: normalizeTaskType(data.type),
    reminderAt: toIso(data.reminderAt),
    reminder1DaySentAt: toIso(data.reminder1DaySentAt),
    reminder1HourSentAt: toIso(data.reminder1HourSentAt),
    dueNotificationSentAt: toIso(data.dueNotificationSentAt),
    completedAt: toIso(data.completedAt),
    overdueEmailSentAt: toIso(data.overdueEmailSentAt),
    overdueNotifiedAt: toIso(data.overdueNotifiedAt),
    assignedToUid: data.assignedToUid ? String(data.assignedToUid) : null,
    assignedToName: data.assignedToName ? String(data.assignedToName) : null,
    assignedToEmail: data.assignedToEmail ? String(data.assignedToEmail) : null,
    assignedAt: toIso(data.assignedAt),
    assignedByUid: data.assignedByUid ? String(data.assignedByUid) : null,
    assignedByEmail: data.assignedByEmail ? String(data.assignedByEmail) : null,
    createdByUid: data.createdByUid ? String(data.createdByUid) : null,
    createdByEmail: String(data.createdByEmail ?? data.createdBy ?? ""),
    createdBy: String(data.createdBy ?? data.createdByEmail ?? ""),
    completedByUid: data.completedByUid ? String(data.completedByUid) : null,
    completedByEmail: data.completedByEmail ? String(data.completedByEmail) : null,
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
    recipientUid: data.recipientUid ? String(data.recipientUid) : null,
    recipientName: data.recipientName ? String(data.recipientName) : null,
    recipientEmail: data.recipientEmail ? String(data.recipientEmail) : null,
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
    entityType: data.entityType === "note" || data.entityType === "task" || data.entityType === "notification" || data.entityType === "user" || data.entityType === "system" ? data.entityType : "lead",
    entityId: String(data.entityId ?? ""),
    leadId: data.leadId ? String(data.leadId) : data.entityType === "lead" ? String(data.entityId ?? "") : null,
    taskId: data.taskId ? String(data.taskId) : null,
    noteId: data.noteId ? String(data.noteId) : null,
    action: String(data.action ?? "activity"),
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    before: data.before ?? null,
    after: data.after ?? null,
    userUid: data.userUid ? String(data.userUid) : undefined,
    userEmail: String(data.userEmail ?? ""),
    previousAssignedToUid: data.previousAssignedToUid ? String(data.previousAssignedToUid) : data.previousAssignedToUid === null ? null : undefined,
    newAssignedToUid: data.newAssignedToUid ? String(data.newAssignedToUid) : data.newAssignedToUid === null ? null : undefined,
    performedByUid: data.performedByUid ? String(data.performedByUid) : undefined,
    performedByEmail: data.performedByEmail ? String(data.performedByEmail) : undefined,
    actorUid: data.actorUid ? String(data.actorUid) : undefined,
    actorEmail: data.actorEmail ? String(data.actorEmail) : undefined,
    targetUid: data.targetUid ? String(data.targetUid) : undefined,
    recipientUid: data.recipientUid ? String(data.recipientUid) : undefined,
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

export async function listActivityLogs(admin: AdminUser, leadId?: string, limit = 100) {
  const db = getAdminDb();
  if (!db) {
    return [];
  }
  const snapshot = leadId
    ? await db.collection("activityLogs").where("leadId", "==", leadId).limit(limit).get()
    : leadDataScopeForAdmin(admin) === "assigned"
      ? await db.collection("activityLogs").where("recipientUid", "==", admin.uid).orderBy("createdAt", "desc").limit(limit).get()
      : await db.collection("activityLogs").orderBy("createdAt", "desc").limit(limit).get();
  return snapshot.docs.map(mapActivityLog).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listLeads(admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    return [];
  }

  const base = db.collection("leads");
  const query = leadDataScopeForAdmin(admin) === "assigned"
    ? base.where("assignedToUid", "==", admin.uid).orderBy("createdAt", "desc").limit(200)
    : base.orderBy("createdAt", "desc").limit(200);
  const snapshot = await query.get();
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

export async function getAccessibleLead(id: string, admin: AdminUser) {
  const lead = await getLead(id);
  return lead && canAccessLead(admin, lead) ? lead : null;
}

export async function assignLead(id: string, assignedToUid: string | null, admin: AdminUser) {
  if (!canAssignLead(admin)) throw new LeadAssignmentError(403, "No tienes permiso para asignar leads.");
  const db = getAdminDb();
  if (!db) throw new LeadAssignmentError(500, "Firebase Admin no esta configurado.");
  const leadRef = db.collection("leads").doc(id);
  const targetRef = assignedToUid ? db.collection("adminUsers").doc(assignedToUid) : null;
  const activityRef = db.collection("activityLogs").doc();
  const newAssigneeNotificationRef = db.collection("notifications").doc();
  const previousAssigneeNotificationRef = db.collection("notifications").doc();
  const newAssigneeNotificationActivityRef = db.collection("activityLogs").doc();
  const previousAssigneeNotificationActivityRef = db.collection("activityLogs").doc();
  const settings = await getAdminSettings();
  const now = new Date().toISOString();

  const changed = await db.runTransaction(async (transaction) => {
    const leadSnapshot = await transaction.get(leadRef);
    if (!leadSnapshot.exists) throw new LeadAssignmentError(404, "Lead no encontrado.");
    const leadData = leadSnapshot.data() ?? {};
    let targetData: DocumentData | null = null;
    if (targetRef) {
      const targetSnapshot = await transaction.get(targetRef);
      if (!targetSnapshot.exists) throw new LeadAssignmentError(400, "El vendedor seleccionado no existe.");
      targetData = targetSnapshot.data() ?? {};
      if (!isAssignableSalesAgent(targetData)) {
        throw new LeadAssignmentError(400, "El usuario seleccionado no es un vendedor activo.");
      }
    }

    const previousAssignedToUid = leadData.assignedToUid ? String(leadData.assignedToUid) : null;
    const assignmentAction = resolveLeadAssignmentAction(previousAssignedToUid, assignedToUid);
    if (assignmentAction === "unchanged") return false;
    const previousAssignedToName = leadData.assignedToName ? String(leadData.assignedToName) : null;
    const previousAssignedToEmail = leadData.assignedToEmail ? String(leadData.assignedToEmail) : null;
    const assignedToName = targetData ? String(targetData.name ?? targetData.displayName ?? "").trim() || null : null;
    const assignedToEmail = targetData ? String(targetData.email ?? "").trim().toLowerCase() || null : null;
    const action = assignmentAction === "assigned" ? "lead_assigned" : assignmentAction === "reassigned" ? "lead_reassigned" : "lead_unassigned";
    const after = {
      previousAssignedToUid,
      previousAssignedToName,
      previousAssignedToEmail,
      assignedToUid,
      assignedToName,
      assignedToEmail,
      assignedAt: assignedToUid ? now : null,
    };

    transaction.set(leadRef, {
      assignedToUid,
      assignedToName,
      assignedToEmail,
      assignedAt: assignedToUid ? now : null,
      assignedByUid: admin.uid,
      assignedByEmail: admin.email,
      updatedAt: now,
    }, { merge: true });
    transaction.create(activityRef, {
      entityType: "lead",
      entityId: id,
      leadId: id,
      action,
      title: formatActivityTitle(action),
      description: action === "lead_unassigned"
        ? "Lead dejado sin asignar."
        : action === "lead_reassigned"
          ? `Lead reasignado de ${previousAssignedToName || previousAssignedToEmail || "otro vendedor"} a ${assignedToName || assignedToEmail || "un vendedor"}.`
          : `Lead asignado a ${assignedToName || assignedToEmail || "un vendedor"}.`,
      before: { assignedToUid: previousAssignedToUid, assignedToName: previousAssignedToName, assignedToEmail: previousAssignedToEmail },
      after,
      previousAssignedToUid,
      newAssignedToUid: assignedToUid,
      performedByUid: admin.uid,
      performedByEmail: admin.email,
      userUid: admin.uid,
      userEmail: admin.email,
      actorUid: admin.uid,
      actorEmail: admin.email,
      createdAt: now,
    });
    if (settings.internalNotificationsEnabled && assignedToUid) {
      const title = assignmentAction === "reassigned" ? "Prospecto reasignado" : "Nuevo prospecto asignado";
      const message = `${String(leadData.name ?? "Un prospecto")} fue asignado a tu cartera.`;
      transaction.create(newAssigneeNotificationRef, {
        title,
        message,
        type: "lead",
        severity: "info",
        leadId: id,
        taskId: null,
        actionUrl: `/admin/leads/${id}`,
        recipientUid: assignedToUid,
        recipientName: assignedToName,
        recipientEmail: assignedToEmail,
        read: false,
        readAt: null,
        deletedAt: null,
        createdAt: now,
      });
      transaction.create(newAssigneeNotificationActivityRef, {
        entityType: "notification",
        entityId: newAssigneeNotificationRef.id,
        leadId: id,
        action: "notification_created",
        title: "Notificacion creada",
        description: "Se notifico al nuevo responsable del prospecto.",
        before: null,
        after: { type: "lead", recipientUid: assignedToUid },
        recipientUid: assignedToUid,
        userUid: admin.uid,
        userEmail: admin.email,
        actorUid: admin.uid,
        actorEmail: admin.email,
        createdAt: now,
      });
    }
    if (settings.internalNotificationsEnabled && previousAssignedToUid && previousAssignedToUid !== assignedToUid) {
      const message = assignedToUid
        ? `${String(leadData.name ?? "Un prospecto")} fue reasignado a otro responsable.`
        : `${String(leadData.name ?? "Un prospecto")} fue retirado de tu cartera.`;
      transaction.create(previousAssigneeNotificationRef, {
        title: assignedToUid ? "Prospecto reasignado" : "Asignacion retirada",
        message,
        type: "lead",
        severity: "info",
        leadId: id,
        taskId: null,
        actionUrl: "/admin/leads",
        recipientUid: previousAssignedToUid,
        recipientName: previousAssignedToName,
        recipientEmail: previousAssignedToEmail,
        read: false,
        readAt: null,
        deletedAt: null,
        createdAt: now,
      });
      transaction.create(previousAssigneeNotificationActivityRef, {
        entityType: "notification",
        entityId: previousAssigneeNotificationRef.id,
        leadId: id,
        action: "notification_created",
        title: "Notificacion creada",
        description: "Se notifico al responsable anterior del cambio de asignacion.",
        before: null,
        after: { type: "lead", recipientUid: previousAssignedToUid },
        recipientUid: previousAssignedToUid,
        userUid: admin.uid,
        userEmail: admin.email,
        createdAt: now,
      });
    }
    return true;
  });

  return { lead: await getLead(id), changed };
}

export async function listNotes(leadId: string) {
  const db = getAdminDb();
  if (!db) {
    return [];
  }
  const snapshot = await db.collection("notes").where("leadId", "==", leadId).limit(100).get();
  return snapshot.docs.map(mapNote).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function filterTasksForAdmin(admin: AdminUser, tasks: AdminTask[]) {
  const db = getAdminDb();
  if (!db || taskDataScopeForAdmin(admin) !== "assigned") return tasks.slice(0, 200);
  const leadIds = Array.from(new Set(tasks.map((task) => task.leadId).filter((value): value is string => Boolean(value))));
  const leadAssignments = new Map<string, string | null>();
  if (leadIds.length) {
    const leadSnapshots = await db.getAll(...leadIds.map((leadId) => db.collection("leads").doc(leadId)));
    leadSnapshots.forEach((snapshot) => {
      const data = snapshot.data();
      leadAssignments.set(snapshot.id, data?.assignedToUid ? String(data.assignedToUid) : null);
    });
  }
  return tasks.filter((task) => canAccessTask(admin, {
    assignedToUid: task.assignedToUid,
    leadId: task.leadId,
    leadAssignedToUid: task.leadId ? leadAssignments.get(task.leadId) ?? null : null,
  })).slice(0, 200);
}

export async function listTasks(admin: AdminUser, leadId?: string) {
  const db = getAdminDb();
  if (!db) {
    return [];
  }
  const scope = taskDataScopeForAdmin(admin);
  if (scope === "none") return [];
  const base = db.collection("tasks");
  const query = scope === "assigned"
    ? leadId
      ? base.where("assignedToUid", "==", admin.uid).where("leadId", "==", leadId).limit(200)
      : base.where("assignedToUid", "==", admin.uid).orderBy("createdAt", "desc").limit(300)
    : leadId
      ? base.where("leadId", "==", leadId).limit(200)
      : base.orderBy("createdAt", "desc").limit(200);
  const snapshot = await query.get();
  const tasks = snapshot.docs.map(mapTask).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return filterTasksForAdmin(admin, tasks);
}

export async function getTask(id: string) {
  const db = getAdminDb();
  if (!db) return null;
  const snapshot = await db.collection("tasks").doc(id).get();
  return snapshot.exists ? mapTask(snapshot as QueryDocumentSnapshot<DocumentData>) : null;
}

export async function getAccessibleTask(id: string, admin: AdminUser) {
  const task = await getTask(id);
  if (!task) return null;
  if (taskDataScopeForAdmin(admin) === "global") return canAccessTask(admin, task) ? task : null;
  const lead = task.leadId ? await getLead(task.leadId) : null;
  return canAccessTask(admin, {
    assignedToUid: task.assignedToUid,
    leadId: task.leadId,
    leadAssignedToUid: lead?.assignedToUid ?? null,
  }) ? task : null;
}

export async function listNotifications(admin: AdminUser) {
  const db = getAdminDb();
  if (!db || notificationDataScopeForAdmin(admin) === "none") return [];
  const personalSnapshot = await db.collection("notifications")
    .where("recipientUid", "==", admin.uid)
    // Equality stays server-scoped without requiring a composite index during the Firebase shadow window.
    .limit(200)
    .get();
  const notifications = personalSnapshot.docs.map(mapNotification);
  if (notificationDataScopeForAdmin(admin) === "personal_with_legacy") {
    const legacySnapshot = await db.collection("notifications").orderBy("createdAt", "desc").limit(200).get();
    legacySnapshot.docs.map(mapNotification).filter((notification) => !notification.recipientUid).forEach((notification) => {
      if (!notifications.some((item) => item.id === notification.id)) notifications.push(notification);
    });
  }
  return notifications
    .filter((notification) => !notification.deletedAt && canAccessNotification(admin, notification))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
}

export async function createNotification(input: {
  title: string;
  message: string;
  type: AdminNotification["type"];
  severity?: AdminNotification["severity"];
  leadId?: string | null;
  taskId?: string | null;
  actionUrl?: string | null;
  recipientUid: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  actorUid?: string | null;
  actorEmail?: string | null;
}) {
  const db = getAdminDb();
  if (!db) {
    return null;
  }
  const settings = await getAdminSettings();
  if (!settings.internalNotificationsEnabled) {
    return null;
  }
  const now = new Date().toISOString();
  const doc = db.collection("notifications").doc();
  const activity = db.collection("activityLogs").doc();
  const batch = db.batch();
  batch.create(doc, {
    title: input.title,
    message: input.message,
    type: input.type,
    severity: input.severity ?? "info",
    leadId: input.leadId ?? null,
    taskId: input.taskId ?? null,
    actionUrl: input.actionUrl ?? null,
    recipientUid: input.recipientUid,
    recipientName: input.recipientName ?? null,
    recipientEmail: input.recipientEmail ?? null,
    read: false,
    readAt: null,
    deletedAt: null,
    createdAt: now,
  });
  batch.create(activity, {
    entityType: "notification",
    entityId: doc.id,
    leadId: input.leadId ?? null,
    taskId: input.taskId ?? null,
    action: "notification_created",
    title: "Notificacion creada",
    description: "Se creo una notificacion privada para su destinatario.",
    before: null,
    after: { type: input.type, recipientUid: input.recipientUid },
    recipientUid: input.recipientUid,
    userUid: input.actorUid ?? "system",
    userEmail: input.actorEmail ?? "system",
    createdAt: now,
  });
  await batch.commit();
  return doc.id;
}

export async function updateLead(id: string, updates: Partial<AdminLead>, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const ref = db.collection("leads").doc(id);
  const payload = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  const beforeData = await db.runTransaction(async (transaction) => {
    const before = await transaction.get(ref);
    if (!before.exists) throw new LeadAccessError();
    const data = before.data() ?? {};
    if (!canAccessLead(admin, { assignedToUid: data.assignedToUid ? String(data.assignedToUid) : null })) {
      throw new LeadAccessError();
    }
    transaction.set(ref, payload, { merge: true });
    return data;
  });
  const changedFields = Object.keys(updates);
  const primaryAction = changedFields.includes("status")
    ? "lead_status_changed"
    : changedFields.includes("priority")
      ? "lead_priority_changed"
      : changedFields.some((field) => ["nextAction", "followUpAt", "followUpDate", "followUpTime", "followUpTimezone", "lastContactAt"].includes(field))
        ? "lead_followup_updated"
        : changedFields.includes("tags")
          ? "lead_tags_updated"
          : changedFields.some((field) => ["estimatedValue", "initialProjectAmount", "monthlyFee", "paymentStatus", "billingStartDate", "billingNotes"].includes(field))
            ? "lead_value_updated"
            : "lead_updated";
  if (primaryAction === "lead_status_changed") {
    const recipientUid = beforeData?.assignedToUid ? String(beforeData.assignedToUid) : admin.uid;
    await createNotification({
      title: "Estado de lead actualizado",
      message: `${String(beforeData?.name ?? "Lead")} cambio a ${String(updates.status)}.`,
      type: "lead_status_changed",
      severity: updates.status === "won" ? "success" : updates.status === "lost" ? "warning" : "info",
      leadId: id,
      actionUrl: `/admin/leads/${id}`,
      recipientUid,
      recipientName: beforeData?.assignedToName ? String(beforeData.assignedToName) : null,
      recipientEmail: beforeData?.assignedToEmail ? String(beforeData.assignedToEmail) : admin.email,
      actorUid: admin.uid,
      actorEmail: admin.email,
    });
    if (updates.status === "won" || updates.status === "quoted") {
      await sendLeadStatusEmail(
        {
          id,
          name: String(beforeData?.name ?? ""),
          business: String(beforeData?.business ?? ""),
          email: String(beforeData?.email ?? ""),
          phone: String(beforeData?.phone ?? ""),
          project: String(beforeData?.project ?? ""),
          budget: String(beforeData?.budget ?? ""),
          message: String(beforeData?.message ?? ""),
          status: updates.status,
          priority: beforeData?.priority === "high" || beforeData?.priority === "low" ? beforeData.priority : "medium",
          estimatedValue: toNumber(beforeData?.estimatedValue),
          initialProjectAmount: toNumber(beforeData?.initialProjectAmount ?? beforeData?.projectValue ?? beforeData?.estimatedValue),
          monthlyFee: toNumber(beforeData?.monthlyFee),
          paymentStatus: normalizePaymentStatus(beforeData?.paymentStatus),
          billingStartDate: toIso(beforeData?.billingStartDate),
          billingNotes: String(beforeData?.billingNotes ?? ""),
          nextAction: String(beforeData?.nextAction ?? ""),
        },
        updates.status,
      );
    }
  }
  if (primaryAction === "lead_priority_changed") {
    const recipientUid = beforeData?.assignedToUid ? String(beforeData.assignedToUid) : admin.uid;
    await createNotification({
      title: "Prioridad de lead actualizada",
      message: `${String(beforeData?.name ?? "Lead")} ahora tiene prioridad ${String(updates.priority)}.`,
      type: "lead_priority_changed",
      severity: updates.priority === "high" ? "warning" : "info",
      leadId: id,
      actionUrl: `/admin/leads/${id}`,
      recipientUid,
      recipientName: beforeData?.assignedToName ? String(beforeData.assignedToName) : null,
      recipientEmail: beforeData?.assignedToEmail ? String(beforeData.assignedToEmail) : admin.email,
      actorUid: admin.uid,
      actorEmail: admin.email,
    });
  }
  await addActivityLog({
    entityType: "lead",
    entityId: id,
    leadId: id,
    action: primaryAction,
    before: beforeData,
    after: payload,
    userUid: admin.uid,
    userEmail: admin.email,
  });
}

export async function addNote(leadId: string, text: string, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const now = new Date().toISOString();
  const doc = db.collection("notes").doc();
  const leadRef = db.collection("leads").doc(leadId);
  const notePayload = {
    leadId,
    text,
    createdBy: admin.uid,
    createdByEmail: admin.email,
    createdAt: now,
  };
  const leadData = await db.runTransaction(async (transaction) => {
    const leadSnapshot = await transaction.get(leadRef);
    if (!leadSnapshot.exists) throw new LeadAccessError();
    const leadData = leadSnapshot.data() ?? {};
    if (!canAccessLead(admin, { assignedToUid: leadData.assignedToUid ? String(leadData.assignedToUid) : null })) {
      throw new LeadAccessError();
    }
    transaction.create(doc, notePayload);
    transaction.set(leadRef, { updatedAt: now }, { merge: true });
    return leadData;
  });
  await createNotification({
    title: "Nota agregada",
    message: `Se agrego una nota interna al lead.`,
    type: "note_added",
    severity: "info",
    leadId,
    actionUrl: `/admin/leads/${leadId}`,
    recipientUid: leadData.assignedToUid ? String(leadData.assignedToUid) : admin.uid,
    recipientName: leadData.assignedToName ? String(leadData.assignedToName) : null,
    recipientEmail: leadData.assignedToEmail ? String(leadData.assignedToEmail) : admin.email,
    actorUid: admin.uid,
    actorEmail: admin.email,
  });
  await addActivityLog({
    entityType: "note",
    entityId: doc.id,
    leadId,
    noteId: doc.id,
    action: "note_added",
    before: null,
    after: { leadId, text },
    userUid: admin.uid,
    userEmail: admin.email,
  });
  return doc.id;
}

export async function createTask(input: Partial<AdminTask>, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const assignee = resolveTaskAssigneeForRequest(admin, input.assignedToUid);
  if (!assignee.ok) throw new TaskAccessError(403, "No puedes asignar la tarea a ese usuario.");
  const now = new Date().toISOString();
  const dueAt = hondurasDateTimeToIso(input.date, input.time || "09:00");
  const taskRef = db.collection("tasks").doc();
  const activityRef = db.collection("activityLogs").doc();
  const notificationRef = db.collection("notifications").doc();
  const notificationActivityRef = db.collection("activityLogs").doc();
  const assigneeRef = db.collection("adminUsers").doc(assignee.assignedToUid);
  const leadRef = input.leadId ? db.collection("leads").doc(input.leadId) : null;
  const settings = await getAdminSettings();

  await db.runTransaction(async (transaction) => {
    const assigneeSnapshot = await transaction.get(assigneeRef);
    if (!assigneeSnapshot.exists || !isTaskAssigneeProfile(assigneeSnapshot.data() ?? {})) {
      throw new TaskAccessError(400, "El responsable seleccionado no esta activo o no puede recibir tareas.");
    }
    const assigneeData = assigneeSnapshot.data() ?? {};
    const leadSnapshot = leadRef ? await transaction.get(leadRef) : null;
    if (leadRef && !leadSnapshot?.exists) throw new TaskAccessError(404, "Lead no encontrado.");
    const leadData = leadSnapshot?.data() ?? null;
    const leadAssignedToUid = leadData?.assignedToUid ? String(leadData.assignedToUid) : null;
    if (taskDataScopeForAdmin(admin) === "assigned" && (!leadData || !canAccessLead(admin, { assignedToUid: leadAssignedToUid }))) {
      throw new TaskAccessError(404, "Lead no encontrado.");
    }
    if (assigneeData.role === "sales_agent" && leadData && leadAssignedToUid !== assignee.assignedToUid) {
      throw new TaskAccessError(400, "La tarea y el lead deben pertenecer al mismo vendedor.");
    }
    const assignedToName = String(assigneeData.name ?? assigneeData.displayName ?? "").trim() || null;
    const assignedToEmail = String(assigneeData.email ?? "").trim().toLowerCase() || null;
    const status = normalizeTaskStatus(input.status);
    const payload = {
      title: input.title || "Seguimiento",
      description: input.description || "",
      leadId: input.leadId || null,
      leadName: leadData ? String(leadData.name ?? "Sin nombre") : null,
      date: input.date || "",
      time: input.time || "",
      timezone: HONDURAS_TIME_ZONE,
      dueAt,
      priority: normalizeTaskPriority(input.priority),
      status,
      type: normalizeTaskType(input.type),
      reminderAt: dueAt,
      reminder1DaySentAt: null,
      reminder1HourSentAt: null,
      dueNotificationSentAt: null,
      completedAt: status === "completed" ? now : null,
      completedByUid: status === "completed" ? admin.uid : null,
      completedByEmail: status === "completed" ? admin.email : null,
      overdueEmailSentAt: null,
      overdueNotifiedAt: null,
      assignedToUid: assignee.assignedToUid,
      assignedToName,
      assignedToEmail,
      assignedAt: now,
      assignedByUid: admin.uid,
      assignedByEmail: admin.email,
      createdByUid: admin.uid,
      createdByEmail: admin.email,
      createdBy: admin.email,
      createdAt: now,
      updatedAt: now,
    };
    transaction.create(taskRef, payload);
    transaction.create(activityRef, {
      entityType: "task",
      entityId: taskRef.id,
      leadId: payload.leadId,
      taskId: taskRef.id,
      action: "task_created",
      title: formatActivityTitle("task_created"),
      description: "Se creo una tarea y se asigno un responsable.",
      before: null,
      after: payload,
      recipientUid: assignee.assignedToUid,
      userUid: admin.uid,
      userEmail: admin.email,
      actorUid: admin.uid,
      actorEmail: admin.email,
      createdAt: now,
    });
    if (settings.internalNotificationsEnabled) {
      transaction.create(notificationRef, {
        title: "Nueva tarea asignada",
        message: `${payload.title}${payload.leadName ? ` para ${payload.leadName}` : ""}.`,
        type: "task_created",
        severity: payload.priority === "high" ? "warning" : "info",
        leadId: payload.leadId,
        taskId: taskRef.id,
        actionUrl: payload.leadId ? `/admin/leads/${payload.leadId}` : "/admin/tareas",
        recipientUid: assignee.assignedToUid,
        recipientName: assignedToName,
        recipientEmail: assignedToEmail,
        read: false,
        readAt: null,
        deletedAt: null,
        createdAt: now,
      });
      transaction.create(notificationActivityRef, {
        entityType: "notification",
        entityId: notificationRef.id,
        leadId: payload.leadId,
        taskId: taskRef.id,
        action: "notification_created",
        title: "Notificacion creada",
        description: "Se notifico al responsable de la nueva tarea.",
        before: null,
        after: { type: "task_created", recipientUid: assignee.assignedToUid },
        recipientUid: assignee.assignedToUid,
        userUid: admin.uid,
        userEmail: admin.email,
        actorUid: admin.uid,
        actorEmail: admin.email,
        createdAt: now,
      });
    }
  });
  return taskRef.id;
}

export async function updateTask(id: string, updates: Partial<AdminTask>, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const ref = db.collection("tasks").doc(id);
  const activityRef = db.collection("activityLogs").doc();
  const notificationRef = db.collection("notifications").doc();
  const notificationActivityRef = db.collection("activityLogs").doc();
  const now = new Date().toISOString();
  const settings = await getAdminSettings();
  await db.runTransaction(async (transaction) => {
    const before = await transaction.get(ref);
    if (!before.exists) throw new TaskAccessError();
    const beforeData = before.data() ?? {};
    const beforeTask = mapTask(before as QueryDocumentSnapshot<DocumentData>);
    const currentLeadRef = beforeTask.leadId ? db.collection("leads").doc(beforeTask.leadId) : null;
    const currentLeadSnapshot = currentLeadRef ? await transaction.get(currentLeadRef) : null;
    const currentLeadAssignedToUid = currentLeadSnapshot?.data()?.assignedToUid ? String(currentLeadSnapshot.data()?.assignedToUid) : null;
    if (!canAccessTask(admin, {
      assignedToUid: beforeTask.assignedToUid,
      leadId: beforeTask.leadId,
      leadAssignedToUid: currentLeadAssignedToUid,
    })) throw new TaskAccessError();

    const nextLeadId = updates.leadId !== undefined ? updates.leadId : beforeTask.leadId;
    const nextLeadRef = nextLeadId ? db.collection("leads").doc(nextLeadId) : null;
    const nextLeadSnapshot = nextLeadRef
      ? currentLeadRef?.path === nextLeadRef.path ? currentLeadSnapshot : await transaction.get(nextLeadRef)
      : null;
    if (nextLeadRef && !nextLeadSnapshot?.exists) throw new TaskAccessError(404, "Lead no encontrado.");
    const nextLeadData = nextLeadSnapshot?.data() ?? null;
    const nextLeadAssignedToUid = nextLeadData?.assignedToUid ? String(nextLeadData.assignedToUid) : null;
    if (taskDataScopeForAdmin(admin) === "assigned" && nextLeadData && !canAccessLead(admin, { assignedToUid: nextLeadAssignedToUid })) {
      throw new TaskAccessError(404, "Lead no encontrado.");
    }

    let nextAssignedToUid = beforeTask.assignedToUid;
    if (updates.assignedToUid !== undefined || taskDataScopeForAdmin(admin) === "assigned") {
      const resolved = resolveTaskAssigneeForRequest(admin, updates.assignedToUid ?? beforeTask.assignedToUid);
      if (!resolved.ok) throw new TaskAccessError(403, "No puedes reasignar esta tarea.");
      nextAssignedToUid = resolved.assignedToUid;
    }
    if (!nextAssignedToUid) throw new TaskAccessError(400, "La tarea necesita un responsable activo.");
    const assigneeRef = db.collection("adminUsers").doc(nextAssignedToUid);
    const assigneeSnapshot = await transaction.get(assigneeRef);
    if (!assigneeSnapshot.exists || !isTaskAssigneeProfile(assigneeSnapshot.data() ?? {})) {
      throw new TaskAccessError(400, "El responsable seleccionado no esta activo o no puede recibir tareas.");
    }
    const assigneeData = assigneeSnapshot.data() ?? {};
    if (assigneeData.role === "sales_agent" && nextLeadData && nextLeadAssignedToUid !== nextAssignedToUid) {
      throw new TaskAccessError(400, "La tarea y el lead deben pertenecer al mismo vendedor.");
    }

    const payload: Record<string, unknown> = { updatedAt: now };
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.priority !== undefined) payload.priority = normalizeTaskPriority(updates.priority);
    if (updates.type !== undefined) payload.type = normalizeTaskType(updates.type);
    if (updates.status !== undefined) payload.status = normalizeTaskStatus(updates.status);
    if (updates.leadId !== undefined) {
      payload.leadId = nextLeadId ?? null;
      payload.leadName = nextLeadData ? String(nextLeadData.name ?? "Sin nombre") : null;
    }
    const date = updates.date ?? beforeTask.date;
    const time = updates.time ?? beforeTask.time;
    if (updates.date !== undefined) payload.date = updates.date;
    if (updates.time !== undefined) payload.time = updates.time;
    if (updates.date !== undefined || updates.time !== undefined) {
      payload.dueAt = hondurasDateTimeToIso(date, time || "09:00");
      payload.reminderAt = payload.dueAt;
      payload.timezone = HONDURAS_TIME_ZONE;
      payload.reminder1DaySentAt = null;
      payload.reminder1HourSentAt = null;
      payload.dueNotificationSentAt = null;
      payload.overdueEmailSentAt = null;
      payload.overdueNotifiedAt = null;
    }
    const assignmentChanged = nextAssignedToUid !== beforeTask.assignedToUid;
    const assignedToName = String(assigneeData.name ?? assigneeData.displayName ?? "").trim() || null;
    const assignedToEmail = String(assigneeData.email ?? "").trim().toLowerCase() || null;
    if (assignmentChanged) {
      payload.assignedToUid = nextAssignedToUid;
      payload.assignedToName = assignedToName;
      payload.assignedToEmail = assignedToEmail;
      payload.assignedAt = now;
      payload.assignedByUid = admin.uid;
      payload.assignedByEmail = admin.email;
    }
    const completed = updates.status === "completed" && beforeTask.status !== "completed";
    const cancelled = updates.status === "cancelled" && beforeTask.status !== "cancelled";
    if (completed) {
      payload.completedAt = now;
      payload.completedByUid = admin.uid;
      payload.completedByEmail = admin.email;
    } else if (updates.status && updates.status !== "completed") {
      payload.completedAt = null;
      payload.completedByUid = null;
      payload.completedByEmail = null;
    }
    const action = assignmentChanged
      ? beforeTask.assignedToUid ? "task_reassigned" : "task_assigned"
      : completed ? "task_completed"
        : cancelled ? "task_cancelled"
          : "task_updated";
    transaction.set(ref, payload, { merge: true });
    transaction.create(activityRef, {
      entityType: "task",
      entityId: id,
      leadId: nextLeadId ?? null,
      taskId: id,
      action,
      title: formatActivityTitle(action),
      description: action === "task_completed"
        ? "La tarea fue marcada como completada."
        : action === "task_cancelled"
          ? "La tarea fue cancelada."
          : assignmentChanged
            ? "La tarea fue reasignada de forma explicita."
            : "La tarea fue actualizada.",
      before: beforeData,
      after: payload,
      recipientUid: nextAssignedToUid,
      userUid: admin.uid,
      userEmail: admin.email,
      actorUid: admin.uid,
      actorEmail: admin.email,
      createdAt: now,
    });
    if (settings.internalNotificationsEnabled) {
      const notificationType = completed ? "task_completed" : "task_updated";
      transaction.create(notificationRef, {
        title: completed ? "Tarea completada" : assignmentChanged ? "Tarea asignada" : cancelled ? "Tarea cancelada" : "Tarea actualizada",
        message: `${String(beforeData.title ?? updates.title ?? "Tarea")} ${completed ? "fue completada" : assignmentChanged ? "fue asignada a tu cuenta" : cancelled ? "fue cancelada" : "fue actualizada"}.`,
        type: notificationType,
        severity: completed ? "success" : cancelled ? "warning" : updates.priority === "high" ? "warning" : "info",
        leadId: nextLeadId ?? null,
        taskId: id,
        actionUrl: nextLeadId ? `/admin/leads/${nextLeadId}` : "/admin/tareas",
        recipientUid: nextAssignedToUid,
        recipientName: assignedToName,
        recipientEmail: assignedToEmail,
        read: false,
        readAt: null,
        deletedAt: null,
        createdAt: now,
      });
      transaction.create(notificationActivityRef, {
        entityType: "notification",
        entityId: notificationRef.id,
        leadId: nextLeadId ?? null,
        taskId: id,
        action: "notification_created",
        title: "Notificacion creada",
        description: "Se notifico al responsable de la tarea.",
        before: null,
        after: { type: notificationType, recipientUid: nextAssignedToUid },
        recipientUid: nextAssignedToUid,
        userUid: admin.uid,
        userEmail: admin.email,
        actorUid: admin.uid,
        actorEmail: admin.email,
        createdAt: now,
      });
    }
  });
}

export async function deleteTask(id: string, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const ref = db.collection("tasks").doc(id);
  const activityRef = db.collection("activityLogs").doc();
  await db.runTransaction(async (transaction) => {
    const before = await transaction.get(ref);
    if (!before.exists) throw new TaskAccessError();
    const task = mapTask(before as QueryDocumentSnapshot<DocumentData>);
    if (!canAccessTask(admin, task)) throw new TaskAccessError();
    transaction.delete(ref);
    transaction.create(activityRef, {
      entityType: "task",
      entityId: id,
      leadId: task.leadId,
      taskId: id,
      action: "task_deleted",
      title: formatActivityTitle("task_deleted"),
      description: "La tarea fue eliminada por un administrador.",
      before: before.data(),
      after: null,
      recipientUid: task.assignedToUid,
      userUid: admin.uid,
      userEmail: admin.email,
      actorUid: admin.uid,
      actorEmail: admin.email,
      createdAt: new Date().toISOString(),
    });
  });
}

export async function updateNotificationRead(id: string, read: boolean, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const ref = db.collection("notifications").doc(id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new NotificationAccessError();
    const data = snapshot.data() ?? {};
    if (!canAccessNotification(admin, { recipientUid: data.recipientUid ? String(data.recipientUid) : null })) {
      throw new NotificationAccessError();
    }
    transaction.set(ref, { read, readAt: read ? new Date().toISOString() : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  await addActivityLog({
    entityType: "notification",
    entityId: id,
    leadId: null,
    action: read ? "notification_read" : "notification_unread",
    before: null,
    after: { read },
    userUid: admin.uid,
    userEmail: admin.email,
  });
}

export async function markAllNotificationsRead(admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const now = new Date().toISOString();
  const accessible = (await listNotifications(admin)).filter((notification) => !notification.read);
  const batch = db.batch();
  accessible.forEach((notification) => batch.set(db.collection("notifications").doc(notification.id), { read: true, readAt: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
  await batch.commit();
  await addActivityLog({
    entityType: "notification",
    entityId: "all",
    leadId: null,
    action: "notifications_read_all",
    before: null,
    after: { count: accessible.length },
    userUid: admin.uid,
    userEmail: admin.email,
  });
}

export async function deleteNotification(id: string, admin: AdminUser) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const ref = db.collection("notifications").doc(id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new NotificationAccessError();
    const data = snapshot.data() ?? {};
    if (!canAccessNotification(admin, { recipientUid: data.recipientUid ? String(data.recipientUid) : null })) {
      throw new NotificationAccessError();
    }
    transaction.set(ref, { deletedAt: new Date().toISOString(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  await addActivityLog({
    entityType: "notification",
    entityId: id,
    leadId: null,
    action: "notification_deleted",
    before: null,
    after: { deletedAt: true },
    userUid: admin.uid,
    userEmail: admin.email,
  });
}
