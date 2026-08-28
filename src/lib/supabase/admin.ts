import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";

export function createSupabaseAdminClient() {
  const { url } = getPublicSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

