import "server-only";

import { getCrmDataProvider } from "@/lib/data/provider";
import { assertCrmProviderCombination } from "@/lib/auth/provider";
import type { CrmRepositories } from "@/lib/data/repositories/types";

export async function createCrmRepositories(): Promise<CrmRepositories> {
  assertCrmProviderCombination();
  if (getCrmDataProvider() === "supabase") {
    const { createSupabaseRepositories } = await import("@/lib/data/repositories/supabase");
    return createSupabaseRepositories();
  }
  const { createFirebaseRepositories } = await import("@/lib/data/repositories/firebase");
  return createFirebaseRepositories();
}
