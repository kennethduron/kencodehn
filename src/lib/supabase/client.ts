"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}

