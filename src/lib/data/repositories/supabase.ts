import "server-only";

import type { CrmRepositories } from "@/lib/data/repositories/types";

function inactive(): never {
  throw new Error("Supabase CRM repositories are schema-ready but intentionally inactive until M2 cutover work.");
}

export function createSupabaseRepositories(): CrmRepositories {
  return {
    leads: { list: async () => inactive(), get: async () => inactive() },
    tasks: { list: async () => inactive() },
    notifications: { list: async () => inactive() },
    users: { list: async () => inactive() },
    reminders: { process: async () => inactive() },
  };
}

