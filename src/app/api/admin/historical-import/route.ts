import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import {
  completeHistoricalImport,
  createHistoricalAddOn,
  startHistoricalImport,
} from "@/lib/historical-import/data";

const schema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("start"),
      payload: z.object({ clientId: z.string().uuid() }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("complete"),
      payload: z
        .object({ sessionId: z.string().uuid(), enableReminders: z.boolean() })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("historical_add_on_create"),
      payload: z
        .object({
          sessionId: z.string().uuid(),
          clientId: z.string().uuid(),
          projectId: z.string().uuid(),
          name: z.string().trim().min(2).max(180),
          description: z.string().trim().min(2).max(8000),
          requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          amountMinor: z.string().regex(/^[1-9][0-9]{0,15}$/),
          currency: z.literal("USD"),
          requestedByClient: z.boolean(),
          paymentTerms: z.string().max(4000),
          workStatus: z.enum([
            "pending",
            "scheduled",
            "in_progress",
            "ready",
            "delivered",
          ]),
          actualDeliveryDate: z.union([
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            z.literal(""),
          ]),
          deliveryNotes: z.string().max(4000),
          estimatedDelivery: z.string().max(1000),
          monthlyAddOnMinor: z.string().regex(/^[0-9]{1,16}$/),
          monthlyStartDate: z.union([
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            z.literal(""),
          ]),
          monthlyBillingDay: z.number().int().min(1).max(28),
          monthlyBillingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          installments: z
            .array(
              z
                .object({
                  sequence: z.number().int().min(1).max(100),
                  label: z.string().trim().min(1).max(140),
                  amountMinor: z.string().regex(/^[1-9][0-9]{0,15}$/),
                  currency: z.literal("USD"),
                  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                  dueTime: z.union([
                    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
                    z.literal(""),
                  ]),
                  notes: z.string().max(1000),
                })
                .strict(),
            )
            .min(1)
            .max(100),
        })
        .strict(),
    })
    .strict(),
]);

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!["owner", "admin"].includes(admin.role)) {
    return NextResponse.json(
      { error: "Solo Owner o Admin puede registrar información histórica." },
      { status: 403 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Revise la información del proceso histórico." },
      { status: 400 },
    );
  try {
    const result =
      parsed.data.operation === "start"
        ? await startHistoricalImport(parsed.data.payload.clientId)
        : parsed.data.operation === "complete"
          ? await completeHistoricalImport(
              parsed.data.payload.sessionId,
              parsed.data.payload.enableReminders,
            )
          : await createHistoricalAddOn(parsed.data.payload);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error
        ? Number(error.status)
        : 400;
    return NextResponse.json(
      {
        error:
          status === 403
            ? "No tiene permiso para esta operación."
            : "No se pudo actualizar el registro histórico.",
      },
      { status },
    );
  }
}
