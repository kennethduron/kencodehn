import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dispatchLeadAssignment } from "./lead-assignment";
import { dispatchTaskAssignment } from "./task-assignment";

type AssignmentEvent = {
  id: string;
  event_type: "task_assigned" | "lead_assigned";
  entity_id: string;
  lease_token: string;
};

function deliveryFailed(result: Awaited<ReturnType<typeof dispatchTaskAssignment>> | Awaited<ReturnType<typeof dispatchLeadAssignment>>) {
  if (typeof result.push === "object" && "failed" in result.push && result.push.failed > 0) return true;
  if (typeof result.email === "object" && "reason" in result.email) {
    return ["resend_send_failed", "email_delivery_failed"].includes(String(result.email.reason || ""));
  }
  return false;
}

export async function processAssignmentNotificationEvents(input: {
  limit?: number;
  eventType?: AssignmentEvent["event_type"];
  entityId?: string;
} = {}) {
  const client = createSupabaseAdminClient();
  const worker = crypto.randomUUID();
  const claimed = await client.rpc("claim_assignment_notification_events", {
    p_worker: worker,
    p_limit: input.limit || 25,
    p_event_type: input.eventType || null,
    p_entity_id: input.entityId || null,
    p_now: new Date().toISOString(),
  });
  if (claimed.error) throw new Error(`Assignment delivery claim failed (${claimed.error.code || "unknown"}).`);
  let completed = 0;
  let failed = 0;
  for (const event of (claimed.data || []) as AssignmentEvent[]) {
    let succeeded = false;
    let reason: string | null = null;
    try {
      const result = event.event_type === "task_assigned"
        ? await dispatchTaskAssignment(event.entity_id)
        : await dispatchLeadAssignment(event.entity_id);
      succeeded = !deliveryFailed(result);
      reason = succeeded ? null : "channel_delivery_failed";
    } catch (error) {
      reason = error instanceof Error ? error.name : "delivery_failed";
    }
    const finished = await client.rpc("complete_assignment_notification_event", {
      p_id: event.id, p_worker: event.lease_token || worker, p_succeeded: succeeded,
      p_error: reason, p_now: new Date().toISOString(),
    });
    if (finished.error || finished.data !== true) throw new Error(`Assignment delivery completion failed (${finished.error?.code || "lease_mismatch"}).`);
    if (succeeded) completed += 1; else failed += 1;
  }
  return { claimed: (claimed.data || []).length, completed, failed };
}
