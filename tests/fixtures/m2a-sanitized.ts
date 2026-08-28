export const SANITIZED_AUTH_USERS = [
  {
    uid: "fixture-owner-uid",
    email: "owner.fixture@example.com",
    emailVerified: true,
    disabled: false,
    displayName: "Fixture Owner",
    providerIds: ["password"],
    hasPasswordHash: true,
  },
  {
    uid: "fixture-agent-uid",
    email: "agent.fixture@example.com",
    emailVerified: false,
    disabled: false,
    displayName: "Fixture Agent",
    providerIds: ["password"],
    hasPasswordHash: true,
  },
] as const;

const historicalCreatedAt = "2025-03-10T14:00:00.000Z";
const historicalUpdatedAt = "2025-03-15T15:30:00.000Z";

export const SANITIZED_FIRESTORE = {
  adminUsers: [
    { id: "fixture-owner-uid", data: { uid: "fixture-owner-uid", name: "Fixture Owner", email: "owner.fixture@example.com", role: "owner", active: true, invitationStatus: "accepted", createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
    { id: "fixture-agent-uid", data: { uid: "fixture-agent-uid", name: "Fixture Agent", email: "agent.fixture@example.com", role: "sales_agent", active: true, invitationStatus: "accepted", createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
  ],
  leads: [
    { id: "fixture-lead-unassigned", data: { name: "Prospecto sin asignar", business: "Example North", email: "unassigned@example.com", phone: "+0000000001", project: "Website", status: "new", priority: "medium", estimatedValue: "1499.00", currency: "USD", billingStartDate: "2025-03-10", createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
    { id: "fixture-lead-agent", data: { name: "Prospecto asignado", business: "Example South", email: "assigned@example.com", phone: "+0000000002", project: "CRM", status: "contacted", priority: "high", estimatedValue: "25000.50", monthlyFee: "2900.00", currency: "HNL", assignedToUid: "fixture-agent-uid", assignedByUid: "fixture-owner-uid", assignedAt: historicalCreatedAt, createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
  ],
  notes: [
    { id: "fixture-note-agent", data: { leadId: "fixture-lead-agent", text: "Nota sanitizada de seguimiento.", createdBy: "fixture-agent-uid", createdByEmail: "agent.fixture@example.com", createdAt: historicalCreatedAt } },
  ],
  tasks: [
    { id: "fixture-task-legacy", data: { title: "Tarea legacy", type: "follow_up", status: "pending", priority: "low", date: "2025-03-11", createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
    { id: "fixture-task-agent", data: { leadId: "fixture-lead-agent", title: "Seguimiento asignado", type: "call", status: "pending", priority: "high", date: "2025-03-12", dueAt: "2025-03-12T14:00:00.000Z", assignedToUid: "fixture-agent-uid", assignedByUid: "fixture-owner-uid", createdByUid: "fixture-owner-uid", createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
  ],
  notifications: [
    { id: "fixture-notification-legacy", data: { type: "system", severity: "info", title: "Notificación legacy", message: "Registro global sanitizado.", read: false, createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
    { id: "fixture-notification-agent", data: { recipientUid: "fixture-agent-uid", leadId: "fixture-lead-agent", taskId: "fixture-task-agent", type: "task_reminder", severity: "warning", title: "Recordatorio", message: "Seguimiento pendiente.", read: false, createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
  ],
  activityLogs: [
    { id: "fixture-activity", data: { entityType: "lead", entityId: "fixture-lead-agent", leadId: "fixture-lead-agent", actorUid: "fixture-owner-uid", recipientUid: "fixture-agent-uid", action: "lead_assigned", title: "Asignación", description: "Fixture sanitizado.", createdAt: historicalCreatedAt } },
  ],
  emailLogs: [
    { id: "fixture-email-log", data: { type: "task_reminder", to: "agent.fixture@example.com", subject: "Recordatorio fixture", sent: false, reason: "fixture", relatedTaskId: "fixture-task-agent", relatedUserUid: "fixture-agent-uid", createdAt: historicalCreatedAt } },
  ],
  pushLogs: [
    { id: "fixture-push-log", data: { type: "task_reminder", title: "Recordatorio fixture", message: "Fixture local", sent: false, reason: "fixture", relatedTaskId: "fixture-task-agent", createdAt: historicalCreatedAt } },
  ],
  deviceTokens: [
    { id: "fixture-device-token", data: { uid: "fixture-agent-uid", token: "fixture-fcm-token-not-real", platform: "web", active: true, createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
  ],
  adminSettings: [
    { id: "default", data: { emailNotificationsEnabled: true, pushNotificationsEnabled: true, internalNotificationsEnabled: true, createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
  ],
  reminderEvents: [
    { id: "fixture-reminder-failed", data: { taskId: "fixture-task-agent", recipientUid: "fixture-agent-uid", kind: "one_day", dueAt: "2025-03-12T14:00:00.000Z", status: "failed", attempts: 1, notification: { status: "sent" }, email: { status: "failed", error: "sanitized" }, push: { status: "skipped" }, createdAt: historicalCreatedAt, updatedAt: historicalUpdatedAt } },
  ],
} as const;

export const LOCAL_FIXTURE_PASSWORD = "Local-only-M2A-fixture-42!";
