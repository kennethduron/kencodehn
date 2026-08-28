export type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  // Keep these references static: Next.js only inlines NEXT_PUBLIC_* names it can see at build time.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  if (!publishableKey) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured.");
  const parsed = new URL(url);
  const hosted = parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  const local = process.env.NODE_ENV !== "production"
    && parsed.protocol === "http:"
    && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (!hosted && !local) throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a hosted Supabase URL or a loopback development URL.");
  return { url, publishableKey };
}
