export type LeadStatus = "new" | "contacted" | "conversation" | "quoted" | "won" | "lost";
export type LeadPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "call" | "whatsapp" | "email" | "meeting" | "proposal" | "follow_up";

export type AdminUser = {
  uid: string;
  email: string;
  role: "owner" | "admin";
};

export type AdminLead = {
  id: string;
  name: string;
  business: string;
  email: string;
  phone: string;
  project: string;
  budget: string;
  message: string;
  locale: "es" | "en";
  sourcePath: string;
  source: string;
  status: LeadStatus;
  priority: LeadPriority;
  estimatedValue: number;
  wonValue: number;
  lastContactAt: string | null;
  nextAction: string;
  followUpAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type AdminNote = {
  id: string;
  leadId: string;
  text: string;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
};

export type AdminTask = {
  id: string;
  title: string;
  description: string;
  leadId: string | null;
  leadName: string | null;
  date: string;
  time: string;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  type: TaskType;
  reminderAt: string | null;
  completedAt: string | null;
  overdueNotifiedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminNotification = {
  id: string;
  title: string;
  message: string;
  type: "lead" | "task" | "system";
  leadId: string | null;
  taskId: string | null;
  read: boolean;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  entityType: "lead" | "note" | "task" | "notification";
  entityId: string;
  leadId: string | null;
  taskId?: string | null;
  noteId?: string | null;
  action: string;
  before: unknown;
  after: unknown;
  userEmail: string;
  createdAt: string;
};
