import { formatHondurasDateTime, HONDURAS_TIME_ZONE_LABEL } from "@/lib/time";
import type { ActivityLog } from "@/lib/admin/types";

export type ActivityTone = "info" | "success" | "warning" | "danger";

const actionTitles: Record<string, string> = {
  lead_created: "Lead creado",
  lead_updated: "Lead actualizado",
  lead_status_changed: "Estado de lead actualizado",
  lead_priority_changed: "Prioridad de lead actualizada",
  lead_value_updated: "Informacion comercial actualizada",
  lead_tags_updated: "Tags actualizados",
  lead_followup_updated: "Fecha de seguimiento actualizada",
  lead_assigned: "Lead asignado",
  lead_reassigned: "Lead reasignado",
  lead_unassigned: "Lead dejado sin asignar",
  note_added: "Nota interna agregada",
  task_created: "Tarea creada",
  task_updated: "Tarea actualizada",
  task_completed: "Tarea completada",
  task_deleted: "Tarea eliminada",
  task_overdue: "Tarea vencida",
  notification_read: "Notificacion leida",
  notification_unread: "Notificacion marcada como no leida",
  notification_deleted: "Notificacion eliminada",
  notifications_read_all: "Notificaciones leidas",
  user_invited: "Usuario invitado",
  user_invitation_resent: "Invitacion reenviada",
  user_role_changed: "Rol de usuario actualizado",
  user_activated: "Usuario activado",
  user_deactivated: "Usuario desactivado",
};

export function formatActivityTitle(action: string) {
  return actionTitles[action] || "Actividad registrada";
}

function afterRecord(activity: ActivityLog) {
  return activity.after && typeof activity.after === "object" ? activity.after as Record<string, unknown> : {};
}

export function formatActivityMessage(activity: ActivityLog) {
  if (activity.description) {
    return activity.description;
  }
  const after = afterRecord(activity);
  if (activity.action === "lead_status_changed" && after.status) {
    return `Estado cambiado a ${String(after.status)}.`;
  }
  if (activity.action === "lead_priority_changed" && after.priority) {
    return `Prioridad cambiada a ${String(after.priority)}.`;
  }
  if (activity.action === "lead_value_updated") {
    if (after.monthlyFee !== undefined) {
      return `Mensualidad actualizada a ${String(after.monthlyFee)}.`;
    }
    if (after.initialProjectAmount !== undefined) {
      return `Monto inicial actualizado a ${String(after.initialProjectAmount)}.`;
    }
    if (after.estimatedValue !== undefined) {
      return `Valor estimado actualizado a ${String(after.estimatedValue)}.`;
    }
    return "Informacion comercial del lead actualizada.";
  }
  if (activity.action === "lead_followup_updated") {
    if (after.followUpAt) {
      return `Seguimiento programado para: ${formatHondurasDateTime(String(after.followUpAt))} ${HONDURAS_TIME_ZONE_LABEL}.`;
    }
    return "Se actualizo la fecha de seguimiento.";
  }
  if (activity.action === "lead_tags_updated") {
    return "Tags del lead actualizados.";
  }
  if (activity.action === "lead_assigned") {
    return `Lead asignado a ${String(after.assignedToName || after.assignedToEmail || "un vendedor")}.`;
  }
  if (activity.action === "lead_reassigned") {
    return `Lead reasignado de ${String(after.previousAssignedToName || after.previousAssignedToEmail || "otro vendedor")} a ${String(after.assignedToName || after.assignedToEmail || "un vendedor")}.`;
  }
  if (activity.action === "lead_unassigned") {
    return "Lead dejado sin asignar.";
  }
  if (activity.action === "user_invited") {
    return "Se preparo el acceso de un nuevo miembro del equipo.";
  }
  if (activity.action === "user_invitation_resent") {
    return "Se genero un nuevo enlace de acceso para el miembro del equipo.";
  }
  if (activity.action === "user_role_changed") {
    return `Rol cambiado de ${String(after.previousRole || "sin rol")} a ${String(after.newRole || "sin rol")}.`;
  }
  if (activity.action === "user_activated") return "El acceso del usuario fue activado.";
  if (activity.action === "user_deactivated") return "El acceso del usuario fue desactivado.";
  if (activity.action === "note_added") {
    return "Se agrego una nota interna al lead.";
  }
  if (activity.action === "task_created") {
    return "Se creo una tarea relacionada.";
  }
  if (activity.action === "task_completed") {
    return "La tarea fue marcada como completada.";
  }
  if (activity.action === "task_deleted") {
    return "La tarea fue eliminada.";
  }
  if (activity.action === "task_overdue") {
    return "La tarea vencio y requiere seguimiento.";
  }
  return "Cambio registrado en el CRM.";
}

export function mapActivityTone(activity: ActivityLog): ActivityTone {
  if (["lead_status_changed", "task_updated", "lead_followup_updated"].includes(activity.action)) return "info";
  if (["lead_created", "lead_assigned", "lead_reassigned", "note_added", "task_created", "task_completed", "user_invited", "user_invitation_resent", "user_activated"].includes(activity.action)) return "success";
  if (["lead_priority_changed", "lead_value_updated", "lead_tags_updated"].includes(activity.action)) return "warning";
  if (["lead_unassigned", "task_deleted", "task_overdue", "notification_deleted", "user_deactivated"].includes(activity.action)) return "danger";
  return "info";
}

export function activityHref(activity: ActivityLog) {
  if (activity.leadId) {
    return `/admin/leads/${activity.leadId}`;
  }
  if (activity.taskId) {
    return "/admin/tareas";
  }
  if (activity.entityType === "notification") {
    return "/admin/notificaciones";
  }
  if (activity.entityType === "user") {
    return "/admin/equipo";
  }
  return "/admin";
}
