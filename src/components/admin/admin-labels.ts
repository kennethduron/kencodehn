import type { LeadPriority, LeadStatus, TaskPriority, TaskStatus, TaskType } from "@/lib/admin/types";

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  conversation: "En conversacion",
  quoted: "Cotizacion enviada",
  won: "Ganado",
  lost: "Perdido",
};

export const leadPriorityLabels: Record<LeadPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completada",
  overdue: "Vencida",
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const taskTypeLabels: Record<TaskType, string> = {
  call: "Llamada",
  whatsapp: "WhatsApp",
  email: "Correo",
  meeting: "Reunion",
  proposal: "Propuesta",
  follow_up: "Seguimiento",
};

export function money(value: number) {
  return new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function shortDate(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }
  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function dateTime(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }
  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function timeAgo(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (Math.abs(diff) < minute) {
    return "Hace unos segundos";
  }
  if (diff < hour) {
    const minutes = Math.max(1, Math.round(diff / minute));
    return `Hace ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  }
  if (diff < day) {
    const hours = Math.max(1, Math.round(diff / hour));
    return `Hace ${hours} hora${hours === 1 ? "" : "s"}`;
  }
  if (diff < day * 30) {
    const days = Math.max(1, Math.round(diff / day));
    if (days === 1) {
      return "Ayer";
    }
    return `Hace ${days} dias`;
  }
  return shortDate(value);
}

export const notificationTypeLabels: Record<string, string> = {
  lead: "Lead",
  task: "Tarea",
  lead_new: "Lead nuevo",
  lead_status_changed: "Estado cambiado",
  lead_priority_changed: "Prioridad cambiada",
  note_added: "Nota agregada",
  task_created: "Tarea creada",
  task_updated: "Tarea actualizada",
  task_completed: "Tarea completada",
  task_overdue: "Tarea vencida",
  system: "Sistema",
};

export const notificationSeverityLabels: Record<string, string> = {
  info: "Info",
  success: "Exito",
  warning: "Atencion",
  danger: "Urgente",
};
