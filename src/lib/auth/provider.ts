import { getCrmDataProvider, type CrmDataProvider } from "@/lib/data/provider";

export const CRM_AUTH_PROVIDERS = ["firebase", "supabase"] as const;
export type CrmAuthProvider = (typeof CRM_AUTH_PROVIDERS)[number];

export function getCrmAuthProvider(env: Record<string, string | undefined> = process.env): CrmAuthProvider {
  const configured = env.CRM_AUTH_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "firebase") return "firebase";
  if (configured === "supabase") return "supabase";
  throw new Error(`Unsupported CRM_AUTH_PROVIDER: ${configured}`);
}

export function assertCrmProviderCombination(input: {
  auth?: CrmAuthProvider;
  data?: CrmDataProvider;
  env?: Record<string, string | undefined>;
} = {}) {
  const env = input.env ?? process.env;
  const auth = input.auth ?? getCrmAuthProvider(env);
  const data = input.data ?? getCrmDataProvider(env);
  if (auth !== data) {
    throw new Error(`Unsupported CRM provider combination: auth=${auth}, data=${data}.`);
  }
  return { auth, data };
}
