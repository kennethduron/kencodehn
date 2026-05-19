import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { createLeadRecord } from "@/lib/leads";
import { sendLeadNotificationEmail } from "@/lib/email/lead-notification";
import { sendPushToAdmins } from "@/lib/push/service";

export const runtime = "nodejs";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  business: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(6).max(40),
  project: z.string().trim().min(2).max(120),
  budget: z.string().trim().max(80).default(""),
  message: z.string().trim().min(10).max(2000),
  locale: z.enum(["es", "en"]).default("es"),
  sourcePath: z.string().trim().max(240).default("/cotizar"),
});

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
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

    try {
      const doc = await db.collection("leads").add(lead);
      const now = new Date().toISOString();
      await db.collection("notifications").add({
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
      await db.collection("activityLogs").add({
        entityType: "lead",
        entityId: doc.id,
        leadId: doc.id,
        action: "lead_created",
        before: null,
        after: { source: "public_website", notification: true },
        userEmail: "system",
        createdAt: now,
      });
      const email = await sendLeadNotificationEmail(lead, doc.id);
      const push = await sendPushToAdmins({
        type: "lead_new",
        title: "Nuevo lead recibido",
        message: `${lead.name} solicito ${lead.project}.`,
        actionUrl: `/admin/leads/${doc.id}`,
        relatedLeadId: doc.id,
      });

      return NextResponse.json({
        ok: true,
        persisted: true,
        leadId: doc.id,
        notificationCreated: true,
        email,
        push,
        message: "Lead saved.",
      });
    } catch (error) {
      console.warn("[Ken Code lead pending Firestore write]", error);
      console.info("[Ken Code lead pending CRM persistence]", lead);
      return NextResponse.json(
        {
          ok: true,
          persisted: false,
          leadId: `pending_${Date.now()}`,
          reason: "firebase_write_unavailable",
          message: "Lead accepted. Firebase persistence is pending configuration.",
        },
        { status: 202 },
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
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
        message: "Unable to process lead right now.",
      },
      { status: 500 },
    );
  }
}
