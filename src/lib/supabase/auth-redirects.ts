const PRODUCTION_ORIGINS = new Set([
  "https://kencodehn.com",
  "https://www.kencodehn.com",
]);

export const DEFAULT_SUPABASE_AUTH_REDIRECT = "https://kencodehn.com/admin";

export function resolveSupabaseAuthRedirect(value?: string | null) {
  if (!value) return DEFAULT_SUPABASE_AUTH_REDIRECT;
  let parsed: URL;
  try {
    parsed = new URL(value, DEFAULT_SUPABASE_AUTH_REDIRECT);
  } catch {
    return DEFAULT_SUPABASE_AUTH_REDIRECT;
  }
  if (!PRODUCTION_ORIGINS.has(parsed.origin)) return DEFAULT_SUPABASE_AUTH_REDIRECT;
  if (parsed.username || parsed.password || !parsed.pathname.startsWith("/admin")) {
    return DEFAULT_SUPABASE_AUTH_REDIRECT;
  }
  return parsed.toString();
}

export function resolveAdminNextPath(value: string | null | undefined, fallback = "/admin") {
  if (!fallback.startsWith("/admin")) throw new Error("Admin redirect fallback is invalid.");
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return fallback; }
  if (!decoded.startsWith("/admin") || decoded.startsWith("//") || /^(?:javascript|data):/i.test(decoded)) return fallback;
  const parsed = new URL(decoded, DEFAULT_SUPABASE_AUTH_REDIRECT);
  if (parsed.origin !== new URL(DEFAULT_SUPABASE_AUTH_REDIRECT).origin || !parsed.pathname.startsWith("/admin")) return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
