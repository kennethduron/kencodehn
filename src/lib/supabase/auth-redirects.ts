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

