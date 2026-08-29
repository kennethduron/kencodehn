export const OWNER_EMAIL_OTP_TYPE = "email" as const;
export const OWNER_EMAIL_OTP_MIN_LENGTH = 6;
export const OWNER_EMAIL_OTP_MAX_LENGTH = 8;
export const OWNER_EMAIL_OTP_COOLDOWN_SECONDS = 60;

export type OwnerEmailVerificationAction = "request" | "verify";

export function normalizeOwnerEmailOtp(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, OWNER_EMAIL_OTP_MAX_LENGTH) : "";
}

export function isOwnerEmailOtpLengthValid(value: string) {
  return value.length >= OWNER_EMAIL_OTP_MIN_LENGTH && value.length <= OWNER_EMAIL_OTP_MAX_LENGTH;
}

export function ownerEmailVerificationMessage(code?: string, status?: number) {
  const normalized = String(code ?? "").toLowerCase();
  if (normalized.includes("expired")) return "El código ha vencido. Solicite uno nuevo.";
  if (normalized.includes("rate") || status === 429) return "Espere un minuto antes de solicitar otro código.";
  if (normalized.includes("invalid") || normalized.includes("not_found")) return "El código no es válido o ya fue utilizado.";
  return "No pudimos verificar el código. Revíselo e intente nuevamente.";
}

export function isAllowedOwnerVerificationOrigin(origin: string | null, production: boolean) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin === "https://kencodehn.com" || parsed.origin === "https://www.kencodehn.com") return true;
    return !production && ["localhost", "127.0.0.1"].includes(parsed.hostname) && ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
