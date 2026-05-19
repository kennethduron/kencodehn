import { Resend } from "resend";
import { z } from "zod";
import type { AdminLead, AdminTask, LeadStatus } from "@/lib/admin/types";
import { getAdminDb } from "@/lib/firebase/admin";
import type { LeadRecord } from "@/lib/leads";
import { site } from "@/lib/site";
import {
  dailySummaryTemplate,
  leadStatusTemplate,
  newLeadTemplate,
  taskOverdueTemplate,
  taskReminderTemplate,
  type EmailTemplate,
} from "@/lib/email/templates";

export type EmailType = "lead_new" | "task_reminder" | "task_overdue" | "lead_status" | "daily_summary";

export type EmailSendResult = {
  sent: boolean;
  reason?:
    | "resend_not_configured"
    | "resend_from_missing"
    | "email_to_missing"
    | "resend_send_failed"
    | "invalid_email_input"
    | "sender_domain_not_allowed";
  id?: string | null;
  logged?: boolean;
};

type SendEmailInput = EmailTemplate & {
  type: EmailType;
  to?: string | null;
  relatedLeadId?: string | null;
  relatedTaskId?: string | null;
};

let resend: Resend | null = null;

const sendEmailSchema = z.object({
  type: z.enum(["lead_new", "task_reminder", "task_overdue", "lead_status", "daily_summary"]),
  to: z.string().email().optional().nullable(),
  subject: z.string().trim().min(3).max(180),
  text: z.string().trim().min(10).max(10000),
  html: z.string().trim().min(20).max(30000),
  relatedLeadId: z.string().trim().max(160).optional().nullable(),
  relatedTaskId: z.string().trim().max(160).optional().nullable(),
});

function getEmailTarget() {
  return process.env.ADMIN_NOTIFICATION_EMAIL || site.email;
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

function getSenderAddress(from: string) {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

function isAllowedSender(from: string) {
  const address = getSenderAddress(from);
  return address.endsWith(`@${site.domain}`);
}

async function logEmail(input: SendEmailInput, result: EmailSendResult) {
  const db = getAdminDb();
  if (!db) {
    return false;
  }
  try {
    await db.collection("emailLogs").add({
      type: input.type,
      to: input.to ?? getEmailTarget(),
      subject: input.subject,
      sent: result.sent,
      reason: result.reason ?? null,
      providerMessageId: result.id ?? null,
      relatedLeadId: input.relatedLeadId ?? null,
      relatedTaskId: input.relatedTaskId ?? null,
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.warn("[Ken Code email log failed]", error);
    return false;
  }
}

async function withLog(input: SendEmailInput, result: EmailSendResult): Promise<EmailSendResult> {
  const logged = await logEmail(input, result);
  return { ...result, logged };
}

export async function sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const to = input.to || getEmailTarget();
  const parsed = sendEmailSchema.safeParse({ ...input, to });
  if (!parsed.success) {
    console.warn("[Ken Code email input warning]", parsed.error.issues);
    return withLog({ ...input, to, subject: input.subject || "Email invalido" }, { sent: false, reason: "invalid_email_input" });
  }
  const from = process.env.RESEND_FROM_EMAIL;
  const client = getResendClient();

  if (!client) {
    return withLog(parsed.data, { sent: false, reason: "resend_not_configured" });
  }
  if (!from) {
    return withLog(parsed.data, { sent: false, reason: "resend_from_missing" });
  }
  if (!isAllowedSender(from)) {
    console.warn("[Ken Code email sender blocked]", getSenderAddress(from));
    return withLog(parsed.data, { sent: false, reason: "sender_domain_not_allowed" });
  }
  if (!to) {
    return withLog(parsed.data, { sent: false, reason: "email_to_missing" });
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to,
      subject: parsed.data.subject,
      text: parsed.data.text,
      html: parsed.data.html,
    });
    if (error) {
      console.warn("[Ken Code email send failed]", error);
      return withLog(parsed.data, { sent: false, reason: "resend_send_failed" });
    }
    return withLog(parsed.data, { sent: true, id: data?.id ?? null });
  } catch (error) {
    console.warn("[Ken Code email send exception]", error);
    return withLog(parsed.data, { sent: false, reason: "resend_send_failed" });
  }
}

export async function sendNewLeadEmail(lead: LeadRecord | Partial<AdminLead>, leadId: string) {
  const template = newLeadTemplate(lead, leadId);
  return sendEmail({ ...template, type: "lead_new", relatedLeadId: leadId });
}

export async function sendTaskReminderEmail(task: Partial<AdminTask>, reminderLabel?: string) {
  const template = taskReminderTemplate(task, reminderLabel);
  return sendEmail({
    ...template,
    type: "task_reminder",
    relatedLeadId: task.leadId ?? null,
    relatedTaskId: task.id ?? null,
  });
}

export async function sendTaskOverdueEmail(task: Partial<AdminTask>) {
  const template = taskOverdueTemplate(task);
  return sendEmail({
    ...template,
    type: "task_overdue",
    relatedLeadId: task.leadId ?? null,
    relatedTaskId: task.id ?? null,
  });
}

export async function sendLeadStatusEmail(lead: Partial<AdminLead> & { id: string }, status: LeadStatus) {
  const template = leadStatusTemplate(lead, status);
  return sendEmail({ ...template, type: "lead_status", relatedLeadId: lead.id });
}

export async function sendDailySummaryEmail(summary: Parameters<typeof dailySummaryTemplate>[0]) {
  const template = dailySummaryTemplate(summary);
  return sendEmail({ ...template, type: "daily_summary" });
}
