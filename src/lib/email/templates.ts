import type { AdminLead, AdminTask, LeadStatus } from "@/lib/admin/types";
import type { LeadRecord } from "@/lib/leads";
import { site } from "@/lib/site";

export type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

type LeadEmailData = Partial<LeadRecord | AdminLead> & { id?: string };
type SummaryData = {
  newLeads?: number;
  pendingTasks?: number;
  overdueTasks?: number;
  wonLeads?: number;
  activityCount?: number;
};

const brandColor = "#08d9d6";
const panelColor = "#0f172a";
const pageColor = "#020617";
const textColor = "#e5eefc";
const mutedColor = "#94a3b8";

function safe(value: unknown, fallback = "No disponible") {
  const text = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  return text || fallback;
}

function money(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? `$${amount.toLocaleString("en-US")}` : "Por definir";
}

function escapeHtml(value: unknown) {
  return safe(value, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function leadUrl(leadId?: string | null) {
  return leadId ? `${site.url}/admin/leads/${leadId}` : `${site.url}/admin`;
}

function taskUrl(task: Partial<AdminTask>) {
  return task.leadId ? `${site.url}/admin/leads/${task.leadId}` : `${site.url}/admin/tareas`;
}

function renderRows(rows: Array<[string, unknown]>) {
  return rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;color:${mutedColor};font-size:13px;width:38%;">${escapeHtml(label)}</td>
          <td style="padding:10px 0;color:${textColor};font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
}

function renderLayout(title: string, intro: string, rows: Array<[string, unknown]>, ctaLabel: string, ctaUrl: string) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:${pageColor};font-family:Inter,Arial,sans-serif;color:${textColor};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${pageColor};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:${panelColor};border:1px solid rgba(148,163,184,.22);border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:26px 28px 14px;">
                <div style="color:${brandColor};font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Ken Code CRM</div>
                <h1 style="margin:12px 0 8px;color:${textColor};font-size:26px;line-height:1.2;">${escapeHtml(title)}</h1>
                <p style="margin:0;color:${mutedColor};font-size:15px;line-height:1.7;">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid rgba(148,163,184,.18);border-bottom:1px solid rgba(148,163,184,.18);">
                  ${renderRows(rows)}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${brandColor};color:#03131a;text-decoration:none;font-weight:800;border-radius:12px;padding:13px 18px;">${escapeHtml(ctaLabel)}</a>
                <p style="margin:18px 0 0;color:${mutedColor};font-size:12px;line-height:1.6;">Este correo fue preparado por el CRM privado de Ken Code. Si el boton no abre, entra a ${escapeHtml(site.url)}/admin.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(title: string, intro: string, rows: Array<[string, unknown]>, ctaUrl: string) {
  const body = rows.map(([label, value]) => `${label}: ${safe(value)}`).join("\n");
  return `Ken Code CRM\n\n${title}\n${intro}\n\n${body}\n\nAbrir CRM: ${ctaUrl}`;
}

export function newLeadTemplate(lead: LeadEmailData, leadId: string): EmailTemplate {
  const url = leadUrl(leadId);
  const rows: Array<[string, unknown]> = [
    ["Cliente", lead.name],
    ["Empresa", lead.business],
    ["Correo", lead.email],
    ["Telefono", lead.phone],
    ["Proyecto", lead.project],
    ["Presupuesto", lead.budget],
    ["Mensaje", lead.message],
  ];
  const title = "Nuevo lead recibido";
  const intro = `${safe(lead.name, "Un nuevo cliente")} envio una solicitud desde la web publica.`;
  return {
    subject: `Nuevo lead: ${safe(lead.name, "Cliente")} - ${safe(lead.project, "Proyecto")}`,
    text: renderText(title, intro, rows, url),
    html: renderLayout(title, intro, rows, "Abrir lead en CRM", url),
  };
}

export function taskReminderTemplate(task: Partial<AdminTask>, reminderLabel = "Recordatorio de tarea"): EmailTemplate {
  const url = taskUrl(task);
  const rows: Array<[string, unknown]> = [
    ["Tipo de aviso", reminderLabel],
    ["Tarea", task.title],
    ["Lead", task.leadName],
    ["Fecha", task.date],
    ["Hora", task.time],
    ["Prioridad", task.priority],
    ["Tipo", task.type],
  ];
  const title = reminderLabel;
  const intro = "Hay una tarea programada que requiere seguimiento.";
  return {
    subject: `${reminderLabel}: ${safe(task.title, "Tarea pendiente")}`,
    text: renderText(title, intro, rows, url),
    html: renderLayout(title, intro, rows, "Ver tarea", url),
  };
}

export function taskOverdueTemplate(task: Partial<AdminTask>): EmailTemplate {
  const url = taskUrl(task);
  const rows: Array<[string, unknown]> = [
    ["Tarea", task.title],
    ["Lead", task.leadName],
    ["Vencia", `${safe(task.date)} ${safe(task.time, "")}`.trim()],
    ["Prioridad", task.priority],
    ["Descripcion", task.description],
  ];
  const title = "Tarea vencida";
  const intro = "Una tarea llego a su fecha limite y necesita atencion.";
  return {
    subject: `Tarea vencida: ${safe(task.title, "Seguimiento pendiente")}`,
    text: renderText(title, intro, rows, url),
    html: renderLayout(title, intro, rows, "Atender tarea", url),
  };
}

export function leadStatusTemplate(lead: LeadEmailData, status: LeadStatus): EmailTemplate {
  const url = leadUrl(lead.id);
  const title = status === "won" ? "Lead ganado" : status === "quoted" ? "Cotizacion enviada" : "Estado importante actualizado";
  const intro =
    status === "won"
      ? "Un lead fue marcado como ganado en el CRM."
      : status === "quoted"
        ? "Un lead avanzo a cotizacion enviada."
        : "Un lead tuvo un cambio importante de estado.";
  const rows: Array<[string, unknown]> = [
    ["Cliente", lead.name],
    ["Empresa", lead.business],
    ["Proyecto", lead.project],
    ["Estado", status],
    ["Valor estimado", money(lead.estimatedValue)],
    ["Proxima accion", lead.nextAction],
  ];
  return {
    subject: `${title}: ${safe(lead.name, "Lead")}`,
    text: renderText(title, intro, rows, url),
    html: renderLayout(title, intro, rows, "Abrir lead", url),
  };
}

export function dailySummaryTemplate(summary: SummaryData): EmailTemplate {
  const url = `${site.url}/admin`;
  const rows: Array<[string, unknown]> = [
    ["Leads nuevos", summary.newLeads ?? 0],
    ["Tareas pendientes", summary.pendingTasks ?? 0],
    ["Tareas vencidas", summary.overdueTasks ?? 0],
    ["Leads ganados", summary.wonLeads ?? 0],
    ["Eventos registrados", summary.activityCount ?? 0],
  ];
  const title = "Resumen diario del CRM";
  const intro = "Resumen preparado para revisar el estado comercial de Ken Code.";
  return {
    subject: "Resumen diario Ken Code CRM",
    text: renderText(title, intro, rows, url),
    html: renderLayout(title, intro, rows, "Abrir dashboard", url),
  };
}
