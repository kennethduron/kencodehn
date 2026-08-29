export const CRM_PREVIEW_READ_ONLY_MESSAGE = "Preview Supabase en modo solo lectura.";

export function isCrmPreviewReadOnly(env: Record<string, string | undefined> = process.env) {
  const configured = env.CRM_PREVIEW_READ_ONLY?.trim().toLowerCase();
  if (!configured || configured === "false") return false;
  if (configured === "true") return true;
  throw new Error(`Unsupported CRM_PREVIEW_READ_ONLY: ${configured}`);
}

export function isPreviewSafeMethod(method: string) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function isPreviewMutationAllowed(pathname: string, method: string) {
  return pathname === "/api/admin/logout" && method.toUpperCase() === "POST";
}
