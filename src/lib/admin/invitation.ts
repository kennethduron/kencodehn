export const CRM_INVITATION_SUBJECT = "Invitación al CRM interno de Ken Code";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function buildCrmInvitationEmail(name: string, credentialLink: string) {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(credentialLink);
  return {
    subject: CRM_INVITATION_SUBJECT,
    text: `Hola ${name}, fuiste invitado al sistema interno de Ken Code. Configura tu contraseña de forma segura usando este enlace: ${credentialLink}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#102033"><h1>Acceso al CRM de Ken Code</h1><p>Hola ${safeName},</p><p>Fuiste invitado al sistema interno de Ken Code.</p><p><a href="${safeLink}">Configurar mi acceso</a></p><p>El enlace es personal, vence por seguridad y solo puede utilizarse una vez.</p></div>`,
  };
}
