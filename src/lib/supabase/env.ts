export type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!url.startsWith("https://") || !url.endsWith(".supabase.co")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL.");
  }
  return { url, publishableKey };
}

