import "server-only";

import { sendOperationalNotificationEmail } from "@/lib/email/service";
import { sendPushToUser } from "@/lib/push/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function dispatchLeadAssignment(leadId: string) {
  const client = createSupabaseAdminClient();
  const leadResult = await client.from("leads").select("id,name,business,assigned_to,assigned_at").eq("id", leadId).maybeSingle();
  const lead = leadResult.data;
  if (leadResult.error || !lead?.assigned_to) return { push: "skipped", email: "skipped" } as const;
  const assignee = await client.from("profiles").select("active").eq("id", lead.assigned_to).maybeSingle();
  if (assignee.error || assignee.data?.active !== true) return { push: "skipped", email: "skipped" } as const;
  const label = String(lead.business || lead.name || "un Lead");
  const message = `Se le asignó ${label}.`;
  const assignmentKey = `${lead.id}:${lead.assigned_to}:${lead.assigned_at || "assigned"}`;
  const actionUrl = `/admin/leads/${lead.id}`;
  const [push, email] = await Promise.allSettled([
    sendPushToUser(lead.assigned_to, {
      type: "proposal_activity",
      title: "Nuevo Lead asignado",
      message,
      actionUrl,
      relatedLeadId: lead.id,
      idempotencyKey: `lead-assigned:${assignmentKey}:push`,
    }),
    sendOperationalNotificationEmail({
      profileId: lead.assigned_to,
      event: "proposal_activity",
      subject: "Nuevo Lead asignado en Ken Code CRM",
      message,
      actionUrl,
      idempotencyKey: `lead-assigned:${assignmentKey}:email`,
    }),
  ]);
  return {
    push: push.status === "fulfilled" ? push.value : { sent: 0, failed: 1, reason: "push_delivery_failed" },
    email: email.status === "fulfilled" ? email.value : { sent: false, reason: "email_delivery_failed" },
  };
}
