import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { createLeadRecord } from "@/lib/leads";

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

    const doc = await db.collection("leads").add(lead);

    return NextResponse.json({
      ok: true,
      persisted: true,
      leadId: doc.id,
      message: "Lead saved.",
    });
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
