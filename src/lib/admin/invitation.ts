export const CRM_INVITATION_SUBJECT = "Invitación al CRM interno de Ken Code";

export type CrmInvitationVerificationType = "invite" | "magiclink";

const CRM_INVITATION_ONBOARDING_URL = "https://kencodehn.com/admin/recovery?mode=invite";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function buildCrmInvitationHandoffLink(
  tokenHash: string,
  type: CrmInvitationVerificationType,
) {
  const normalizedTokenHash = tokenHash.trim();
  if (!normalizedTokenHash) throw new Error("Invitation token hash is required.");
  const url = new URL(CRM_INVITATION_ONBOARDING_URL);
  const fragment = new URLSearchParams();
  fragment.set("token_hash", normalizedTokenHash);
  fragment.set("type", type);
  url.hash = fragment.toString();
  return url.toString();
}

export function buildCrmInvitationEmail(name: string, credentialLink: string, username?: string | null) {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(credentialLink);
  const normalizedUsername = username?.trim() || "";
  const usernameText = normalizedUsername ? ` Tu usuario es: ${normalizedUsername}.` : "";
  const usernameHtml = normalizedUsername
    ? `<p>Tu usuario para iniciar sesión es <strong>${escapeHtml(normalizedUsername)}</strong>. También puedes usar este correo.</p>`
    : "";
  return {
    subject: CRM_INVITATION_SUBJECT,
    text: `Hola ${name}, fuiste invitado al sistema interno de Ken Code.${usernameText} Configura tu contraseña de forma segura usando este enlace: ${credentialLink}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#102033"><h1>Acceso al CRM de Ken Code</h1><p>Hola ${safeName},</p><p>Fuiste invitado al sistema interno de Ken Code.</p>${usernameHtml}<p><a href="${safeLink}">Configurar mi acceso</a></p><p>El enlace es personal, vence por seguridad y solo puede utilizarse una vez.</p></div>`,
  };
}
