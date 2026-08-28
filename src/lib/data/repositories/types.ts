import type { AdminLead, AdminMember, AdminNotification, AdminTask, AdminUser } from "@/lib/admin/types";

export type CrmRepositories = {
  leads: {
    list(admin: AdminUser): Promise<AdminLead[]>;
    get(id: string, admin: AdminUser): Promise<AdminLead | null>;
  };
  tasks: {
    list(admin: AdminUser, leadId?: string): Promise<AdminTask[]>;
  };
  notifications: {
    list(admin: AdminUser): Promise<AdminNotification[]>;
  };
  users: {
    list(): Promise<AdminMember[]>;
  };
  reminders: {
    process(now?: Date): Promise<unknown>;
  };
};

