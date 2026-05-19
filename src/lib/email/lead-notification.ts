import type { LeadRecord } from "@/lib/leads";
import { sendClientLeadConfirmationEmail, sendNewLeadEmail } from "@/lib/email/service";

export async function sendLeadNotificationEmail(lead: LeadRecord, leadId: string) {
  return sendNewLeadEmail(lead, leadId);
}

export async function sendLeadClientConfirmationEmail(lead: LeadRecord, leadId: string) {
  return sendClientLeadConfirmationEmail(lead, leadId);
}
