import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { isSupabaseDataProviderEnabled } from "@/lib/data/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createLeadRecord } from "@/lib/leads";
import { notifyPublicLeadStaff, sendLeadClientConfirmationEmail, sendLeadNotificationEmail } from "@/lib/email/lead-notification";
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
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(8).max(40),
  project: optionalText("Solicitud web").pipe(z.string().max(120)),
  budget: optionalText("Por definir").pipe(z.string().max(80)),
  message: z.string().trim().min(3).max(2000),
  locale: z.enum(["es", "en"]).default("es"),
  sourcePath: z.enum(["/contacto", "/en/contact", "/cotizar", "/en/quote"]).default("/contacto"),
  submissionId: z.string().uuid(),
  website: z.string().max(0).optional().default(""),
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
    console.warn(`[Ken Code lead secondary failed] ${label}`, error instanceof Error ? error.name : "unknown_error");
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = normalizeLeadPayload(await request.json());
    const input = leadSchema.parse(payload);
    const { submissionId, website: _website, ...leadInput } = input;
    const lead = createLeadRecord(leadInput, {
      userAgent: request.headers.get("user-agent") ?? "unknown",
      referer: request.headers.get("referer") ?? "direct",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    });

    const useSupabase = isSupabaseDataProviderEnabled();
    const db = useSupabase ? null : getAdminDb();
    if (!useSupabase && !db) {
      console.info("[Ken Code lead pending persistence]", { provider: "firebase", persisted: false });
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

    let leadId: string;
    let created = true;
    if (useSupabase) {
      const { data, error } = await createSupabaseAdminClient().rpc("create_public_lead", { p_payload: { ...lead, submissionId } });
      if (error || !data) throw new Error(`Supabase public lead persistence failed (${error?.code ?? "unknown"}).`);
      leadId = String(data);
    } else {
      const leadRef = db!.collection("leads").doc(submissionId);
      try {
        await leadRef.create(lead);
      } catch (error) {
        const existing = await leadRef.get();
        if (!existing.exists) throw error;
        created = false;
      }
      leadId = leadRef.id;
    }
    const now = new Date().toISOString();
    const internalNotificationsEnabled = await safeSecondary(
      "settings",
      async () => (await getAdminSettings()).internalNotificationsEnabled,
      false,
    );

    const notificationId = await safeSecondary(
      "notification",
      async () => {
        if (useSupabase) return "created_transactionally";
        if (!internalNotificationsEnabled) return null;
        if (!created) return "already_created";
        const notificationDoc = await db!.collection("notifications").add({
          title: "Nueva solicitud recibida",
          message: `Nueva solicitud recibida de ${lead.name} para ${lead.project}.`,
          type: "lead_new",
          severity: "success",
          leadId,
          taskId: null,
          actionUrl: `/admin/leads/${leadId}`,
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
      () => useSupabase || !created ? Promise.resolve(null) :
        db!.collection("activityLogs").add({
          entityType: "lead",
          entityId: leadId,
          leadId,
          action: "lead_created",
          before: null,
          after: { source: "public_website", notificationId },
          userUid: "system",
          userEmail: "system",
          createdAt: now,
        }),
      null,
    );

    await safeSecondary(
      "staffChannels",
      async () => {
        if (useSupabase) return notifyPublicLeadStaff(lead, leadId);
        const [email, push] = await Promise.all([
          sendLeadNotificationEmail(lead, leadId),
          sendPushToAdmins({
            type: "lead_new",
            title: "Nueva solicitud desde el sitio web",
            message: `${lead.name} solicitó ${lead.project}.`,
            actionUrl: `/admin/leads/${leadId}`,
            relatedLeadId: leadId,
            idempotencyKey: `public-lead:${leadId}:push`,
          }),
        ]);
        return { recipients: 1, emailSent: email.sent ? 1 : 0, pushSent: push.sent };
      },
      { recipients: 0, emailSent: 0, pushSent: 0 },
    );
    const clientEmail = await safeSecondary(
      "clientEmail",
      () => sendLeadClientConfirmationEmail(lead, leadId),
      { sent: false as const, reason: "email_to_missing" as const, logged: false },
    );
    return NextResponse.json({
      ok: true,
      persisted: true,
      leadId,
      notificationCreated: Boolean(notificationId),
      confirmationQueued: clientEmail.sent,
      message: "Solicitud recibida correctamente.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn(
        "[Ken Code lead validation failed]",
        error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      );
      const fieldMessages: Record<string, string> = {
        name: "Ingrese un nombre válido.",
        business: "Revise el nombre del negocio.",
        email: "Ingrese un correo válido.",
        phone: "Ingrese un teléfono o WhatsApp válido.",
        project: "Seleccione el tipo de proyecto.",
        message: "Describa brevemente lo que necesita.",
      };
      const fieldErrors = Object.fromEntries(error.issues.flatMap((issue) => {
        const field = String(issue.path[0] ?? "");
        return fieldMessages[field] ? [[field, fieldMessages[field]]] : [];
      }));
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          message: "Revise los campos indicados e intente nuevamente.",
          fieldErrors,
        },
        { status: 400 },
      );
    }

    console.error("[Ken Code lead error]", error instanceof Error ? error.name : "unknown_error");
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
