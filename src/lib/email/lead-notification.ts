import type { LeadRecord } from "@/lib/leads";
import { sendClientLeadConfirmationEmail, sendNewLeadEmail, sendOperationalNotificationEmail } from "@/lib/email/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/service";

export async function sendLeadNotificationEmail(lead: LeadRecord, leadId: string) {
  return sendNewLeadEmail(lead, leadId);
}

export async function sendLeadClientConfirmationEmail(lead: LeadRecord, leadId: string) {
  return sendClientLeadConfirmationEmail(lead, leadId);
}

export async function notifyPublicLeadStaff(lead: LeadRecord, leadId: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("active", true)
    .in("role", ["owner", "admin", "manager", "viewer"]);
  if (error) throw new Error(`Public lead recipient lookup failed (${error.code ?? "unknown"}).`);

  const recipients = (data ?? []).map((profile) => String(profile.id));
  const actionUrl = `/admin/leads/${leadId}`;
  const subject = "Nueva solicitud desde el sitio web";
  const identity = lead.business && lead.business !== "No especificado" ? `${lead.name} · ${lead.business}` : lead.name;
  const message = `${identity} solicitó información sobre ${lead.project}.`;
  const deliveries = await Promise.all(recipients.map(async (profileId) => {
    const [email, push] = await Promise.all([
      sendOperationalNotificationEmail({
        profileId,
        event: "proposal_activity",
        subject,
        message,
        actionUrl,
        idempotencyKey: `public-lead:${leadId}:email:${profileId}`,
      }),
      sendPushToUser(profileId, {
        type: "lead_new",
        title: subject,
        message,
        actionUrl,
        relatedLeadId: leadId,
        idempotencyKey: `public-lead:${leadId}:push`,
      }),
    ]);
    return { profileId, email, push };
  }));

  return {
    recipients: recipients.length,
    emailSent: deliveries.filter((delivery) => delivery.email.sent).length,
    pushSent: deliveries.reduce((count, delivery) => count + delivery.push.sent, 0),
  };
}
