export type LeadStatus = "new" | "contacted" | "conversation" | "quoted" | "won" | "lost";
export type LeadPriority = "low" | "medium" | "high";
export type PaymentStatus = "not_started" | "pending" | "partial" | "paid" | "overdue" | "active";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "call" | "whatsapp" | "email" | "meeting" | "proposal" | "follow_up";
export type { AdminPermission, AdminRole, AdminUser } from "@/lib/admin/authorization";

export type AdminSettings = {
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  internalNotificationsEnabled: boolean;
  taskReminder1DayEnabled: boolean;
  taskReminder1HourEnabled: boolean;
  taskDueEnabled: boolean;
  taskOverdueEnabled: boolean;
  dailySummaryEnabled: boolean;
  notificationSoundEnabled: boolean;
  compactModeEnabled: boolean;
  updatedAt: string | null;
  updatedByUid: string | null;
  updatedBy: string | null;
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
  initialProjectAmount: number;
  monthlyFee: number;
  paymentStatus: PaymentStatus;
  billingStartDate: string | null;
  billingNotes: string;
  wonValue: number;
  lastContactAt: string | null;
  nextAction: string;
  followUpDate: string;
  followUpTime: string;
  followUpTimezone: string;
  followUpAt: string | null;
  tags: string[];
  assignedToUid: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  assignedAt: string | null;
  assignedByUid: string | null;
  assignedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminMember = {
  uid: string;
  name: string;
  email: string;
  role: import("@/lib/admin/authorization").AdminRole | null;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
  invitedAt: string | null;
  invitedByUid: string | null;
  invitationStatus: import("@/lib/admin/authorization").InvitationStatus | null;
  invitationLastSentAt: string | null;
  assignedLeadCount: number;
};

export type AssignableSalesAgent = {
  uid: string;
  name: string;
  email: string;
};

export type TaskAssignee = AssignableSalesAgent & {
  role: "owner" | "admin" | "sales_agent";
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
  timezone: string;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  type: TaskType;
  reminderAt: string | null;
  reminder1DaySentAt: string | null;
  reminder1HourSentAt: string | null;
  dueNotificationSentAt: string | null;
  completedAt: string | null;
  overdueEmailSentAt: string | null;
  overdueNotifiedAt: string | null;
  assignedToUid: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  assignedAt: string | null;
  assignedByUid: string | null;
  assignedByEmail: string | null;
  createdByUid: string | null;
  createdByEmail: string;
  createdBy: string;
  completedByUid: string | null;
  completedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminNotification = {
  id: string;
  title: string;
  message: string;
  type: "lead" | "task" | "lead_new" | "lead_status_changed" | "lead_priority_changed" | "note_added" | "task_created" | "task_updated" | "task_completed" | "task_reminder" | "task_due" | "task_overdue" | "system";
  severity: "info" | "success" | "warning" | "danger";
  leadId: string | null;
  taskId: string | null;
  actionUrl: string | null;
  recipientUid: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  read: boolean;
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  entityType: "lead" | "note" | "task" | "notification" | "user" | "system";
  entityId: string;
  leadId: string | null;
  taskId?: string | null;
  noteId?: string | null;
  action: string;
  title: string;
  description: string;
  before: unknown;
  after: unknown;
  userUid?: string;
  userEmail: string;
  previousAssignedToUid?: string | null;
  newAssignedToUid?: string | null;
  performedByUid?: string;
  performedByEmail?: string;
  actorUid?: string;
  actorEmail?: string;
  targetUid?: string;
  recipientUid?: string;
  createdAt: string;
};
