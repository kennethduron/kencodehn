export const CRM_DATA_PROVIDERS = ["firebase", "supabase"] as const;
export type CrmDataProvider = (typeof CRM_DATA_PROVIDERS)[number];

export function getCrmDataProvider(env: Record<string, string | undefined> = process.env): CrmDataProvider {
  const configured = env.CRM_DATA_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "firebase") return "firebase";
  if (configured === "supabase") return "supabase";
  throw new Error(`Unsupported CRM_DATA_PROVIDER: ${configured}`);
}

export function isSupabaseDataProviderEnabled(env: Record<string, string | undefined> = process.env) {
  return getCrmDataProvider(env) === "supabase";
}
