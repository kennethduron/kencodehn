import "server-only";

import { addNote, assignLead, createTask, deleteNotification, deleteTask, getAccessibleLead, listActivityLogs, listLeads, listNotes, listNotifications, listTasks, markAllNotificationsRead, updateLead, updateNotificationRead, updateTask } from "@/lib/admin/data";
import { processTaskReminders } from "@/lib/admin/reminders";
import { getAdminSettings, updateAdminSettings } from "@/lib/admin/settings";
import { listAdminMembers } from "@/lib/admin/users";
import type { CrmRepositories } from "@/lib/data/repositories/types";

export function createFirebaseRepositories(): CrmRepositories {
  return {
    leads: { list: listLeads, get: getAccessibleLead, update: updateLead, assign: assignLead },
    notes: { list: (leadId) => listNotes(leadId), add: addNote },
    tasks: { list: listTasks, create: createTask, update: updateTask, remove: deleteTask },
    notifications: { list: listNotifications, setRead: updateNotificationRead, markAllRead: markAllNotificationsRead, remove: deleteNotification },
    activity: { list: listActivityLogs },
    users: { list: listAdminMembers },
    settings: { get: getAdminSettings, update: updateAdminSettings },
    reminders: { process: processTaskReminders },
  };
}
