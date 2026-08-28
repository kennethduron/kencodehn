import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canAccessNotification,
  canAccessTask,
  canAssignTask,
  defaultPermissionsForRole,
  notificationDataScopeForAdmin,
  resolveTaskAssigneeForRequest,
  taskDataScopeForAdmin,
} from "../src/lib/admin/authorization.ts";
import {
  canClaimReminderEvent,
  channelStatusFromResult,
  classifyTaskReminder,
  reminderEventCompletion,
  reminderEventId,
  reminderLegacyField,
} from "../src/lib/admin/reminder-policy.ts";
import { hondurasDateTimeToIso } from "../src/lib/time.ts";

const user = (role, uid = role) => ({ uid, email: `${uid}@example.test`, role, active: true, permissions: defaultPermissionsForRole(role) });
const owner = user("owner");
const admin = user("admin");
const salesA = user("sales_agent", "agent-a");
const salesB = user("sales_agent", "agent-b");
const settings = { taskReminder1DayEnabled: true, taskReminder1HourEnabled: true, taskDueEnabled: true, taskOverdueEnabled: true };
const now = Date.parse("2026-08-27T14:00:00.000Z");
const task = (overrides = {}) => ({ id: "task-1", dueAt: "2026-08-28T14:00:00.000Z", status: "pending", ...overrides });

test("Owner conserva scope global de tareas", () => assert.equal(taskDataScopeForAdmin(owner), "global"));
test("Admin conserva scope global de tareas", () => assert.equal(taskDataScopeForAdmin(admin), "global"));
test("Sales Agent usa scope assigned", () => assert.equal(taskDataScopeForAdmin(salesA), "assigned"));
test("Manager no obtiene modulo de tareas", () => assert.equal(taskDataScopeForAdmin(user("manager")), "none"));
test("Viewer no obtiene modulo de tareas", () => assert.equal(taskDataScopeForAdmin(user("viewer")), "none"));
test("Owner puede leer cualquier tarea", () => assert.equal(canAccessTask(owner, { assignedToUid: "agent-b" }), true));
test("Admin puede leer cualquier tarea", () => assert.equal(canAccessTask(admin, { assignedToUid: "agent-b" }), true));
test("Sales Agent lee su tarea independiente", () => assert.equal(canAccessTask(salesA, { assignedToUid: "agent-a" }), true));
test("Sales Agent no lee tarea de otro", () => assert.equal(canAccessTask(salesA, { assignedToUid: "agent-b" }), false));
test("Sales Agent no lee tarea legacy sin responsable", () => assert.equal(canAccessTask(salesA, {}), false));
test("Tarea ligada exige ownership coincidente del lead", () => assert.equal(canAccessTask(salesA, { assignedToUid: "agent-a", leadId: "lead-1", leadAssignedToUid: "agent-a" }), true));
test("Tarea ligada a lead ajeno queda oculta", () => assert.equal(canAccessTask(salesA, { assignedToUid: "agent-a", leadId: "lead-1", leadAssignedToUid: "agent-b" }), false));
test("Owner y Admin pueden seleccionar responsable", () => { assert.equal(canAssignTask(owner), true); assert.equal(canAssignTask(admin), true); });
test("Sales Agent no puede reasignar su tarea", () => assert.equal(canAssignTask(salesA), false));
test("Sales Agent queda forzado a su propio UID", () => assert.deepEqual(resolveTaskAssigneeForRequest(salesA), { ok: true, assignedToUid: "agent-a" }));
test("Sales Agent no puede forjar otro assignee", () => assert.deepEqual(resolveTaskAssigneeForRequest(salesA, "agent-b"), { ok: false }));
test("Sales Agent puede crear una tarea personal para si", () => assert.deepEqual(resolveTaskAssigneeForRequest(salesA, null), { ok: true, assignedToUid: "agent-a" }));
test("Sales Agent puede completar solo su tarea", () => { assert.equal(canAccessTask(salesA, { assignedToUid: "agent-a" }), true); assert.equal(canAccessTask(salesA, { assignedToUid: "agent-b" }), false); });
test("Sales Agent no puede crear tarea ligada a lead de B", () => assert.equal(canAccessTask(salesA, { assignedToUid: "agent-a", leadId: "lead-b", leadAssignedToUid: "agent-b" }), false));
test("Admin puede asignar una tarea de forma explicita", () => assert.deepEqual(resolveTaskAssigneeForRequest(admin, "agent-a"), { ok: true, assignedToUid: "agent-a" }));
test("Sales Agent no tiene delete fisico", () => assert.equal(salesA.permissions.includes("tasks:delete"), false));
test("Owner ve notificaciones propias y legacy", () => assert.equal(notificationDataScopeForAdmin(owner), "personal_with_legacy"));
test("Admin ve notificaciones propias y legacy", () => assert.equal(notificationDataScopeForAdmin(admin), "personal_with_legacy"));
test("Sales Agent solo ve notificaciones personales", () => assert.equal(notificationDataScopeForAdmin(salesA), "personal"));
test("Sales Agent puede leer su notificacion", () => assert.equal(canAccessNotification(salesA, { recipientUid: "agent-a" }), true));
test("Sales Agent no puede leer notificacion ajena", () => assert.equal(canAccessNotification(salesA, { recipientUid: "agent-b" }), false));
test("Sales Agent no puede marcar leida una notificacion ajena", () => assert.equal(canAccessNotification(salesA, { recipientUid: "agent-b" }), false));
test("Sales Agent no ve notificacion legacy global", () => assert.equal(canAccessNotification(salesA, {}), false));
test("Owner puede conservar notificaciones legacy", () => assert.equal(canAccessNotification(owner, {}), true));
test("Un usuario inactivo no accede a tareas o notificaciones", () => { const inactive = { ...salesA, active: false }; assert.equal(canAccessTask(inactive, { assignedToUid: "agent-a" }), false); assert.equal(canAccessNotification(inactive, { recipientUid: "agent-a" }), false); });
test("ventana de un dia clasifica 1day", () => assert.equal(classifyTaskReminder(task(), settings, now), "1day"));
test("ventana de una hora clasifica 1hour", () => assert.equal(classifyTaskReminder(task({ dueAt: new Date(now + 30 * 60_000).toISOString() }), settings, now), "1hour"));
test("instante de vencimiento clasifica due", () => assert.equal(classifyTaskReminder(task({ dueAt: new Date(now).toISOString() }), settings, now), "due"));
test("tarea atrasada clasifica overdue", () => assert.equal(classifyTaskReminder(task({ dueAt: new Date(now - 60 * 60_000).toISOString() }), settings, now), "overdue"));
test("fecha historica pasada se mantiene como overdue", () => assert.equal(classifyTaskReminder(task({ dueAt: "2025-03-10T14:00:00.000Z" }), settings, now), "overdue"));
test("tarea completada no genera recordatorio", () => assert.equal(classifyTaskReminder(task({ status: "completed" }), settings, now), null));
test("tarea cancelada no genera recordatorio", () => assert.equal(classifyTaskReminder(task({ status: "cancelled" }), settings, now), null));
test("flag legacy evita repetir el mismo recordatorio", () => assert.equal(classifyTaskReminder(task({ reminder1DaySentAt: "2026-08-27T14:01:00Z" }), settings, now), null));
test("setting desactivado impide el canal temporal", () => assert.equal(classifyTaskReminder(task(), { ...settings, taskReminder1DayEnabled: false }, now), null));
test("event ID es deterministico por tarea, tipo y vencimiento", () => assert.equal(reminderEventId("task/1", "due", "2026-08-27T14:00:00Z"), reminderEventId("task/1", "due", "2026-08-27T14:00:00Z")));
test("tipos diferentes producen event IDs distintos", () => assert.notEqual(reminderEventId("task-1", "due", task().dueAt), reminderEventId("task-1", "overdue", task().dueAt)));
test("evento inexistente puede reclamarse", () => assert.equal(canClaimReminderEvent(null, now), true));
test("evento completado no vuelve a reclamarse", () => assert.equal(canClaimReminderEvent({ status: "completed" }, now), false));
test("lease activo bloquea cron concurrente", () => assert.equal(canClaimReminderEvent({ status: "processing", leaseUntil: new Date(now + 60_000).toISOString() }, now), false));
test("lease vencido permite recuperacion", () => assert.equal(canClaimReminderEvent({ status: "processing", leaseUntil: new Date(now - 1).toISOString() }, now), true));
test("retry futuro evita reintento prematuro", () => assert.equal(canClaimReminderEvent({ status: "failed", retryAt: new Date(now + 60_000).toISOString() }, now), false));
test("retry vencido permite reintentar", () => assert.equal(canClaimReminderEvent({ status: "failed", retryAt: new Date(now - 1).toISOString() }, now), true));
test("canales sent/skipped completan el evento", () => assert.equal(reminderEventCompletion(["sent", "skipped", "sent"]), "completed"));
test("un canal failed mantiene el evento reintentable", () => assert.equal(reminderEventCompletion(["sent", "failed", "skipped"]), "failed"));
test("destinatario inexistente se considera canal omitido", () => assert.equal(channelStatusFromResult(false, "email_to_missing"), "skipped"));
test("fallo real de proveedor se conserva como failed", () => assert.equal(channelStatusFromResult(false, "resend_send_failed"), "failed"));
test("campos legacy corresponden a cada clase", () => { assert.equal(reminderLegacyField("1day"), "reminder1DaySentAt"); assert.equal(reminderLegacyField("overdue"), "overdueNotifiedAt"); });
test("fecha Honduras se convierte a UTC sin depender del host", () => assert.equal(hondurasDateTimeToIso("2026-08-27", "08:30"), "2026-08-27T14:30:00.000Z"));
test("medianoche Honduras respeta el borde UTC del dia", () => assert.equal(hondurasDateTimeToIso("2026-08-27", "00:00"), "2026-08-27T06:00:00.000Z"));
test("GET tasks no invoca procesador de recordatorios", () => { const source = readFileSync("src/app/api/admin/tasks/route.ts", "utf8"); assert.doesNotMatch(source, /checkOverdueTasks|processTaskReminders/); });
test("pagina tareas no invoca procesador de recordatorios", () => { const source = readFileSync("src/app/admin/tareas/page.tsx", "utf8"); assert.doesNotMatch(source, /checkOverdueTasks|processTaskReminders/); });
test("listar notifications no contiene escrituras", () => { const source = readFileSync("src/lib/admin/data.ts", "utf8"); const body = source.slice(source.indexOf("export async function listNotifications"), source.indexOf("export async function createNotification")); assert.doesNotMatch(body, /\.set\(|\.update\(|\.create\(|\.commit\(/); });
test("badge recibe notificaciones ya scoped por servidor", () => { const tasksPage = readFileSync("src/app/admin/tareas/page.tsx", "utf8"); assert.match(tasksPage, /repositories\.notifications\.list\(admin\)/); assert.match(tasksPage, /notifications\.filter/); });
test("cron conserva autenticacion CRON_SECRET", () => { const source = readFileSync("src/app/api/cron/task-reminders/route.ts", "utf8"); assert.match(source, /CRON_SECRET/); assert.match(source, /timingSafeEqual/); });
test("cron no usa push global", () => assert.doesNotMatch(readFileSync("src/lib/admin/reminders.ts", "utf8"), /sendPushToAdmins/));
test("cron entrega push por UID", () => assert.match(readFileSync("src/lib/admin/reminders.ts", "utf8"), /sendPushToUser\(claim\.task\.assignedToUid/));
test("cron usa eventos determinísticos", () => assert.match(readFileSync("src/lib/admin/reminders.ts", "utf8"), /collection\("reminderEvents"\)\.doc\(id\)/));
test("notification de reminder queda vinculada al destinatario de task", () => assert.match(readFileSync("src/lib/admin/reminders.ts", "utf8"), /recipientUid: claim\.task\.assignedToUid/));
test("reminder de A no usa lista global de destinatarios", () => { const source = readFileSync("src/lib/admin/reminders.ts", "utf8"); assert.doesNotMatch(source, /listDeviceTokens|ADMIN_NOTIFICATION_EMAIL|sendPushToAdmins/); });
test("programacion Vercel es diaria y apunta al cron correcto", () => { const config = JSON.parse(readFileSync("vercel.json", "utf8")); assert.deepEqual(config.crons, [{ path: "/api/cron/task-reminders", schedule: "0 14 * * *" }]); });
test("indices incluyen tareas, notificaciones y actividad personal", () => { const groups = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes.map((index) => `${index.collectionGroup}:${index.fields.map((field) => field.fieldPath).join(",")}`); assert.ok(groups.includes("tasks:assignedToUid,createdAt")); assert.ok(groups.includes("notifications:recipientUid,createdAt")); assert.ok(groups.includes("tasks:status,dueAt")); assert.ok(groups.includes("activityLogs:recipientUid,createdAt")); });
test("rules mantienen todas las escrituras cliente bloqueadas", () => assert.doesNotMatch(readFileSync("firestore.rules", "utf8"), /allow write: if true/));
