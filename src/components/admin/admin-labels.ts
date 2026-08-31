import type { LeadPriority, LeadStatus, PaymentStatus, TaskPriority, TaskStatus, TaskType } from "@/lib/admin/types";
import { formatHondurasDate, formatHondurasDateTime } from "@/lib/time";

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  conversation: "En conversación",
  quoted: "Cotización enviada",
  won: "Ganado",
  lost: "Perdido",
};

export const leadPriorityLabels: Record<LeadPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  not_started: "Sin iniciar",
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  overdue: "Vencido",
  active: "Mensualidad activa",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completada",
  overdue: "Vencida",
  cancelled: "Cancelada",
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
  meeting: "Reunión",
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
  return formatHondurasDate(value);
}

export function dateTime(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }
  return formatHondurasDateTime(value);
}

export function leadSourceLabel(source?: string | null) {
  return source === "public_website" ? "Formulario web" : source || "Sin origen";
}

export function leadSourcePageLabel(sourcePath?: string | null) {
  if (sourcePath === "/contacto" || sourcePath === "/en/contact") return "Contacto";
  if (sourcePath === "/cotizar" || sourcePath === "/en/quote") return "Cotización";
  return sourcePath || "Sin página registrada";
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
    return `Hace ${days} días`;
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
  task_reminder: "Recordatorio",
  task_due: "Tarea en hora",
  task_overdue: "Tarea vencida",
  payment_due_7_days: "Cobro próximo",
  payment_due_3_days: "Cobro próximo",
  payment_due_today: "Cobro para hoy",
  payment_overdue: "Cobro vencido",
  payment_received: "Pago recibido",
  module: "Módulo",
  mail_received: "Correo recibido",
  mail_assigned: "Conversación asignada",
  mail_follow_up: "Seguimiento de correo",
  system: "Sistema",
};

export const notificationSeverityLabels: Record<string, string> = {
  info: "Info",
  success: "Éxito",
  warning: "Atención",
  danger: "Urgente",
};
