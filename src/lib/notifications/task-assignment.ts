import "server-only";

import { sendOperationalNotificationEmail } from "@/lib/email/service";
import { sendPushToUser } from "@/lib/push/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TaskAssignmentRow = {
  id: string;
  title: string;
  lead_id: string | null;
  client_id: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
};

export async function dispatchTaskAssignment(taskId: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("tasks")
    .select("id,title,lead_id,client_id,assigned_to,assigned_at")
    .eq("id", taskId)
    .maybeSingle();
  if (error || !data?.assigned_to) return { push: "skipped", email: "skipped" } as const;
  const assignee = await client.from("profiles").select("active").eq("id", data.assigned_to).maybeSingle();
  if (assignee.error || assignee.data?.active !== true) return { push: "skipped", email: "skipped" } as const;

  const task = data as unknown as TaskAssignmentRow;
  const assigneeId = task.assigned_to!;
  const actionUrl = task.client_id ? `/admin/clientes/${task.client_id}` : task.lead_id ? `/admin/leads/${task.lead_id}` : "/admin/tareas";
  const assignmentKey = `${task.id}:${task.assigned_to}:${task.assigned_at || "created"}`;
  const message = task.title ? `Se le asignó la tarea «${task.title}».` : "Se le asignó una nueva tarea.";
  const [push, email] = await Promise.allSettled([
    sendPushToUser(assigneeId, {
      type: "task_assigned",
      title: "Nueva tarea asignada",
      message,
      actionUrl,
      relatedLeadId: task.lead_id,
      relatedTaskId: task.id,
      idempotencyKey: `task-assigned:${assignmentKey}:push`,
    }),
    sendOperationalNotificationEmail({
      profileId: assigneeId,
      event: "task_assigned",
      subject: "Nueva tarea asignada en Ken Code CRM",
      message,
      actionUrl,
      idempotencyKey: `task-assigned:${assignmentKey}:email`,
    }),
  ]);
  return {
    push: push.status === "fulfilled" ? push.value : { sent: 0, failed: 1, reason: "push_delivery_failed" },
    email: email.status === "fulfilled" ? email.value : { sent: false, reason: "email_delivery_failed" },
  };
}
