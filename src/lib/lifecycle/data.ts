import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const lifecycleEntities = ["lead", "client", "project", "module", "proposal", "task", "recurring_service", "add_on_recurring", "mail_identity", "payment", "receivable", "expense"] as const;
export type LifecycleEntity = (typeof lifecycleEntities)[number];
export type LifecycleInfo = {
  entity: LifecycleEntity;
  id: string;
  hasHistory: boolean;
  deleteAllowed: boolean;
  archiveAllowed: boolean;
  recommendedAction: "delete" | "archive" | "deactivate" | "cancel" | "reverse" | "none";
  reason: string;
};

function mapError(error: { code?: string; message?: string }) {
  const wrapped = new Error(error.message || "No se pudo consultar el ciclo de vida del registro.") as Error & { status?: number };
  wrapped.status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
  return wrapped;
}

export async function inspectRecordLifecycle(entity: LifecycleEntity, id: string): Promise<LifecycleInfo> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("record_lifecycle_inspect", { p_entity: entity, p_id: id });
  if (error) throw mapError(error);
  return data as LifecycleInfo;
}

export async function applyRecordLifecycle(entity: LifecycleEntity, id: string, action: "delete" | "archive" | "deactivate" | "cancel", reason: string) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("record_lifecycle_apply", { p_entity: entity, p_id: id, p_action: action, p_reason: reason });
  if (error) throw mapError(error);
  return data as Record<string, unknown>;
}
