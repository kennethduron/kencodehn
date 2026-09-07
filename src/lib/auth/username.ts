export const USERNAME_LOGIN_ERROR = "Correo/usuario o contraseña incorrectos, o la cuenta no está disponible.";

export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "api", "auth", "billing", "kencode", "mail",
  "owner", "root", "security", "support", "system",
]);

export function canonicalUsername(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function validateUsername(value: string) {
  const canonical = canonicalUsername(value);
  if (canonical.length < 3 || canonical.length > 32) return { ok: false as const, reason: "El usuario debe tener entre 3 y 32 caracteres." };
  if (!/^[a-z0-9](?:[a-z0-9._]{1,30}[a-z0-9])$/.test(canonical) || /[._]{2}/.test(canonical)) {
    return { ok: false as const, reason: "Use letras, números, punto o guion bajo, sin separadores repetidos." };
  }
  if (RESERVED_USERNAMES.has(canonical)) return { ok: false as const, reason: "Ese usuario está reservado." };
  return { ok: true as const, canonical };
}
