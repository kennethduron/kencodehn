import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { createLeadRecord } from "@/lib/leads";
import { sendLeadClientConfirmationEmail, sendLeadNotificationEmail } from "@/lib/email/lead-notification";
import { sendPushToAdmins } from "@/lib/push/service";
import { getAdminSettings } from "@/lib/admin/settings";

export const runtime = "nodejs";

function optionalText(fallback = "") {
  return z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => value || fallback);
}

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  business: optionalText("No especificado").pipe(z.string().max(160)),
  email: z.union([z.string().trim().email().max(180), z.literal(""), z.null(), z.undefined()]).transform((value) => value || ""),
  phone: z.string().trim().min(8).max(40),
  project: optionalText("Solicitud web").pipe(z.string().max(120)),
  budget: optionalText("Por definir").pipe(z.string().max(80)),
  message: z.string().trim().min(3).max(2000),
  locale: z.enum(["es", "en"]).default("es"),
  sourcePath: z.string().trim().max(240).default("/cotizar"),
});

function normalizeLeadPayload(payload: unknown) {
  const input = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return {
    ...input,
    project: input.project ?? input.projectType ?? input.project_type,
    locale: input.locale ?? input.language ?? "es",
    sourcePath: input.sourcePath ?? (input.source ? `/${String(input.source).replace(/^\/+/, "")}` : undefined),
    budget: input.budget ?? "Por definir",
  };
}

async function safeSecondary<T>(label: string, action: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await action();
  } catch (error) {
    console.warn(`[Ken Code lead secondary failed] ${label}`, error);
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = normalizeLeadPayload(await request.json());
    const input = leadSchema.parse(payload);
    const lead = createLeadRecord(input, {
      userAgent: request.headers.get("user-agent") ?? "unknown",
      referer: request.headers.get("referer") ?? "direct",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    });

    const db = getAdminDb();
    if (!db) {
      console.info("[Ken Code lead pending Firebase config]", lead);
      return NextResponse.json(
        {
          ok: true,
          persisted: false,
          leadId: `pending_${Date.now()}`,
          reason: "firebase_not_configured",
          message: "Lead accepted. Firebase Admin credentials are pending.",
        },
        { status: 202 },
      );
    }

    const doc = await db.collection("leads").add(lead);
    const now = new Date().toISOString();
    const settings = await getAdminSettings();

    const notificationId = await safeSecondary(
      "notification",
      async () => {
        if (!settings.internalNotificationsEnabled) return null;
        const notificationDoc = await db.collection("notifications").add({
          title: "Nueva solicitud recibida",
          message: `Nueva solicitud recibida de ${lead.name} para ${lead.project}.`,
          type: "lead_new",
          severity: "success",
          leadId: doc.id,
          taskId: null,
          actionUrl: `/admin/leads/${doc.id}`,
          read: false,
          readAt: null,
          deletedAt: null,
          createdAt: now,
        });
        return notificationDoc.id;
      },
      null,
    );

    await safeSecondary(
      "activityLog",
      () =>
        db.collection("activityLogs").add({
          entityType: "lead",
          entityId: doc.id,
          leadId: doc.id,
          action: "lead_created",
          before: null,
          after: { source: "public_website", notificationId },
          userUid: "system",
          userEmail: "system",
          createdAt: now,
        }),
      null,
    );

    const email = await safeSecondary(
      "email",
      () => sendLeadNotificationEmail(lead, doc.id),
      { sent: false as const, reason: "resend_send_failed" as const, logged: false },
    );
    const clientEmail = await safeSecondary(
      "clientEmail",
      () => sendLeadClientConfirmationEmail(lead, doc.id),
      { sent: false as const, reason: "email_to_missing" as const, logged: false },
    );
    const push = await safeSecondary(
      "push",
      () =>
        sendPushToAdmins({
          type: "lead_new",
          title: "Nuevo lead recibido",
          message: `${lead.name} solicito ${lead.project}.`,
          actionUrl: `/admin/leads/${doc.id}`,
          relatedLeadId: doc.id,
        }),
      { sent: 0, failed: 0, reason: "push_failed" },
    );

    return NextResponse.json({
      ok: true,
      persisted: true,
      leadId: doc.id,
      notificationCreated: Boolean(notificationId),
      email,
      clientEmail,
      push,
      message: "Lead saved.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn(
        "[Ken Code lead validation failed]",
        error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      );
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          message: "Invalid lead payload.",
          issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
        { status: 400 },
      );
    }

    console.error("[Ken Code lead error]", error);
    return NextResponse.json(
      {
        ok: false,
        persisted: false,
        message: "Unable to process lead right now.",
      },
      { status: 500 },
    );
  }
}
