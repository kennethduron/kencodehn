import { Resend } from "resend";
import type { LeadRecord } from "@/lib/leads";
import { site } from "@/lib/site";

let resend: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendLeadNotificationEmail(lead: LeadRecord, leadId: string) {
  const client = getResend();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!client || !from) {
    return {
      sent: false,
      reason: !client ? "resend_not_configured" : "resend_from_missing",
    };
  }

  const crmUrl = `${site.url}/admin/leads/${leadId}`;
  const html = `
    <div style="font-family:Arial,sans-serif;background:#020617;color:#e5edf8;padding:24px">
      <div style="max-width:620px;margin:0 auto;background:#0b1120;border:1px solid rgba(148,163,184,.22);border-radius:16px;padding:24px">
        <h1 style="margin:0 0 12px;color:#00d9ff">Nueva solicitud recibida en Ken Code</h1>
        <p style="line-height:1.7">Un nuevo lead lleno el formulario publico y ya esta disponible en el CRM.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          ${[
            ["Nombre", lead.name],
            ["Empresa", lead.business],
            ["WhatsApp", lead.phone],
            ["Correo", lead.email],
            ["Tipo de proyecto", lead.project],
            ["Presupuesto", lead.budget || "Sin definir"],
            ["Idioma", lead.locale.toUpperCase()],
            ["Mensaje", lead.message],
          ]
            .map(([label, value]) => `<tr><td style="padding:10px;border-top:1px solid rgba(148,163,184,.16);color:#94a3b8">${label}</td><td style="padding:10px;border-top:1px solid rgba(148,163,184,.16);color:#f8fafc">${value}</td></tr>`)
            .join("")}
        </table>
        <p style="margin-top:22px"><a href="${crmUrl}" style="background:#006dff;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Abrir en CRM</a></p>
      </div>
    </div>
  `;

  const { data, error } = await client.emails.send({
    from,
    to: site.email,
    subject: "Nueva solicitud recibida en Ken Code",
    html,
  });

  if (error) {
    console.warn("[Ken Code Resend notification warning]", error);
    return { sent: false, reason: "resend_send_failed" };
  }

  return { sent: true, id: data?.id ?? null };
}
