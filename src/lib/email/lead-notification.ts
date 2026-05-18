import type { LeadRecord } from "@/lib/leads";
import { sendNewLeadEmail } from "@/lib/email/service";

export async function sendLeadNotificationEmail(lead: LeadRecord, leadId: string) {
  return sendNewLeadEmail(lead, leadId);
}
