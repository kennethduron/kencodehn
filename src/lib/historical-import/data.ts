import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

export type HistoricalImportSession = {
  id: string;
  clientId: string;
  status: "active" | "completed";
  remindersPaused: boolean;
  remindersReenabled: boolean;
  startedAt: string;
  completedAt: string | null;
};

function mapSession(row: Row): HistoricalImportSession {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    status: row.status === "completed" ? "completed" : "active",
    remindersPaused:
      row.status === "active" || !Boolean(row.reminders_reenabled),
    remindersReenabled: Boolean(row.reminders_reenabled),
    startedAt: String(row.started_at),
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
  };
}

export async function getActiveHistoricalImport(clientId: string) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("historical_import_sessions")
    .select("id,client_id,status,reminders_reenabled,started_at,completed_at")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw new Error("No se pudo consultar el registro histórico.");
  const row = (data?.[0] ?? null) as Row | null;
  return row ? mapSession(row) : null;
}

async function run(functionName: string, args: Record<string, unknown>) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc(functionName, args);
  if (error) {
    const wrapped = new Error(
      error.message || "No se pudo actualizar el registro histórico.",
    ) as Error & { status?: number };
    wrapped.status =
      error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    throw wrapped;
  }
  return (data ?? {}) as Record<string, unknown>;
}

export function startHistoricalImport(clientId: string) {
  return run("historical_import_start", { p_client_id: clientId });
}

export function completeHistoricalImport(
  sessionId: string,
  enableReminders: boolean,
) {
  return run("historical_import_complete", {
    p_session_id: sessionId,
    p_enable_reminders: enableReminders,
  });
}

export function createHistoricalAddOn(payload: Record<string, unknown>) {
  return run("historical_add_on_create", { p_payload: payload });
}
