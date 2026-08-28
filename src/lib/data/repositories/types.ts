import type { ActivityLog, AdminLead, AdminMember, AdminNote, AdminNotification, AdminSettings, AdminTask, AdminUser } from "@/lib/admin/types";

export type LeadAssignmentResult = {
  lead: AdminLead | null;
  changed: boolean;
};

export type CrmRepositories = {
  leads: {
    list(admin: AdminUser): Promise<AdminLead[]>;
    get(id: string, admin: AdminUser): Promise<AdminLead | null>;
    update(id: string, updates: Partial<AdminLead>, admin: AdminUser): Promise<void>;
    assign(id: string, assignedToUid: string | null, admin: AdminUser): Promise<LeadAssignmentResult>;
  };
  notes: {
    list(leadId: string, admin: AdminUser): Promise<AdminNote[]>;
    add(leadId: string, body: string, admin: AdminUser): Promise<string>;
  };
  tasks: {
    list(admin: AdminUser, leadId?: string): Promise<AdminTask[]>;
    create(input: Partial<AdminTask>, admin: AdminUser): Promise<string>;
    update(id: string, updates: Partial<AdminTask>, admin: AdminUser): Promise<void>;
    remove(id: string, admin: AdminUser): Promise<void>;
  };
  notifications: {
    list(admin: AdminUser): Promise<AdminNotification[]>;
    setRead(id: string, read: boolean, admin: AdminUser): Promise<void>;
    markAllRead(admin: AdminUser): Promise<void>;
    remove(id: string, admin: AdminUser): Promise<void>;
  };
  activity: { list(admin: AdminUser, leadId?: string, limit?: number): Promise<ActivityLog[]> };
  users: {
    list(): Promise<AdminMember[]>;
  };
  settings: {
    get(): Promise<AdminSettings>;
    update(settings: Omit<AdminSettings, "updatedAt" | "updatedByUid" | "updatedBy">, admin: AdminUser): Promise<AdminSettings>;
  };
  reminders: {
    process(now?: Date): Promise<unknown>;
  };
};
