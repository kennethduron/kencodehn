import type { Query } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AdminUser } from "@/lib/admin/types";

export type CleanupCounts = {
  leads: number;
  notes: number;
  tasks: number;
  notifications: number;
  activityLogs: number;
  emailLogs: number;
  pushLogs: number;
};

export const emptyCleanupCounts: CleanupCounts = {
  leads: 0,
  notes: 0,
  tasks: 0,
  notifications: 0,
  activityLogs: 0,
  emailLogs: 0,
  pushLogs: 0,
};

export function canRunMaintenance(admin: AdminUser) {
  return admin.role === "owner" || admin.role === "admin" || admin.permissions?.includes("settings:manage") === true;
}

async function countCollection(collection: keyof CleanupCounts) {
  const db = getAdminDb();
  if (!db) return 0;
  const snapshot = await db.collection(collection).count().get();
  return snapshot.data().count;
}

async function countWhere(collection: keyof CleanupCounts, field: string, value: string) {
  const db = getAdminDb();
  if (!db) return 0;
  const snapshot = await db.collection(collection).where(field, "==", value).count().get();
  return snapshot.data().count;
}

async function deleteQuery(query: Query) {
  const db = getAdminDb();
  if (!db) return 0;
  let deleted = 0;

  while (true) {
    const snapshot = await query.limit(450).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < 450) break;
  }

  return deleted;
}

export async function getCleanupSummary(): Promise<CleanupCounts> {
  return {
    leads: await countCollection("leads"),
    notes: await countCollection("notes"),
    tasks: await countCollection("tasks"),
    notifications: await countCollection("notifications"),
    activityLogs: await countCollection("activityLogs"),
    emailLogs: await countCollection("emailLogs"),
    pushLogs: await countCollection("pushLogs"),
  };
}

export async function getLeadDeletionSummary(leadId: string): Promise<CleanupCounts> {
  const db = getAdminDb();
  if (!db) return emptyCleanupCounts;
  const lead = await db.collection("leads").doc(leadId).get();
  return {
    leads: lead.exists ? 1 : 0,
    notes: await countWhere("notes", "leadId", leadId),
    tasks: await countWhere("tasks", "leadId", leadId),
    notifications: await countWhere("notifications", "leadId", leadId),
    activityLogs: await countWhere("activityLogs", "leadId", leadId),
    emailLogs: await countWhere("emailLogs", "relatedLeadId", leadId),
    pushLogs: await countWhere("pushLogs", "relatedLeadId", leadId),
  };
}

export async function deleteLeadCascade(leadId: string): Promise<CleanupCounts> {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }

  const deleted: CleanupCounts = { ...emptyCleanupCounts };
  deleted.notes = await deleteQuery(db.collection("notes").where("leadId", "==", leadId));
  deleted.tasks = await deleteQuery(db.collection("tasks").where("leadId", "==", leadId));
  deleted.notifications = await deleteQuery(db.collection("notifications").where("leadId", "==", leadId));
  deleted.activityLogs = await deleteQuery(db.collection("activityLogs").where("leadId", "==", leadId));
  deleted.emailLogs = await deleteQuery(db.collection("emailLogs").where("relatedLeadId", "==", leadId));
  deleted.pushLogs = await deleteQuery(db.collection("pushLogs").where("relatedLeadId", "==", leadId));

  const leadRef = db.collection("leads").doc(leadId);
  const lead = await leadRef.get();
  if (lead.exists) {
    await leadRef.delete();
    deleted.leads = 1;
  }

  return deleted;
}

export async function cleanupOperationalData(): Promise<CleanupCounts> {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }

  return {
    leads: await deleteQuery(db.collection("leads")),
    notes: await deleteQuery(db.collection("notes")),
    tasks: await deleteQuery(db.collection("tasks")),
    notifications: await deleteQuery(db.collection("notifications")),
    activityLogs: await deleteQuery(db.collection("activityLogs")),
    emailLogs: await deleteQuery(db.collection("emailLogs")),
    pushLogs: await deleteQuery(db.collection("pushLogs")),
  };
}
