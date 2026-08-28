import "server-only";

import { getAccessibleLead, listLeads, listNotifications, listTasks } from "@/lib/admin/data";
import { processTaskReminders } from "@/lib/admin/reminders";
import { listAdminMembers } from "@/lib/admin/users";
import type { CrmRepositories } from "@/lib/data/repositories/types";

export function createFirebaseRepositories(): CrmRepositories {
  return {
    leads: { list: listLeads, get: getAccessibleLead },
    tasks: { list: listTasks },
    notifications: { list: listNotifications },
    users: { list: listAdminMembers },
    reminders: { process: processTaskReminders },
  };
}

