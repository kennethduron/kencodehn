import type { ActivityLog } from "@/lib/admin/types";

export type ActivityTone = "info" | "success" | "warning" | "danger";

const actionTitles: Record<string, string> = {
  lead_created: "Lead creado",
  lead_updated: "Lead actualizado",
  lead_status_changed: "Estado de lead actualizado",
  lead_priority_changed: "Prioridad de lead actualizada",
  lead_value_updated: "Informacion comercial actualizada",
  lead_tags_updated: "Tags actualizados",
  lead_followup_updated: "Seguimiento actualizado",
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
    return "Seguimiento comercial actualizado.";
  }
  if (activity.action === "lead_tags_updated") {
    return "Tags del lead actualizados.";
  }
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
  if (["lead_created", "note_added", "task_created", "task_completed"].includes(activity.action)) return "success";
  if (["lead_priority_changed", "lead_value_updated", "lead_tags_updated"].includes(activity.action)) return "warning";
  if (["task_deleted", "task_overdue", "notification_deleted"].includes(activity.action)) return "danger";
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
  return "/admin";
}
