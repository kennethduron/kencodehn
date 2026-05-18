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
