import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasPermission, type AdminPermission } from "@/lib/admin/authorization";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { commercialMutation } from "@/lib/commercial/data";

const operations = ["lead_convert", "client_create", "client_update", "client_assign", "project_create", "project_update", "project_assign", "payment_plan_save", "payment_plan_activate", "recurring_service_save"] as const;
type Operation = (typeof operations)[number];
const requestSchema = z.object({
  operation: z.enum(operations),
  payload: z.record(z.string(), z.unknown()),
}).strict();

const permissionFor: Record<Operation, AdminPermission> = {
  lead_convert: "clients:edit",
  client_create: "clients:edit",
  client_update: "clients:edit",
  client_assign: "clients:assign",
  project_create: "projects:edit",
  project_update: "projects:edit",
  project_assign: "projects:assign",
  payment_plan_save: "commercial_plans:edit",
  payment_plan_activate: "commercial_plans:edit",
  recurring_service_save: "recurring_services:edit",
};

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDate = z.union([date, z.literal("")]);
const moneyMinor = z.string().regex(/^(0|[1-9][0-9]{0,15})$/);
const usd = z.literal("USD");
const seller = z.union([uuid, z.literal(""), z.null()]).optional();
const schemas: Record<Operation, z.ZodType> = {
  lead_convert: z.object({ leadId: uuid, clientSince: date.optional(), notes: z.string().max(5000).optional() }).strict(),
  client_create: z.object({ kind: z.enum(["individual","company"]).optional(), name: z.string().trim().min(2).max(160), company: z.string().max(200).optional(), email: z.union([z.string().email(), z.literal("")]).optional(), phone: z.string().max(60).optional(), whatsapp: z.string().max(60).optional(), country: z.string().regex(/^[A-Z]{2}$/).optional(), region: z.string().max(120).optional(), city: z.string().max(120).optional(), address: z.string().max(500).optional(), status: z.enum(["active", "inactive"]).optional(), clientSince: date.optional(), notes: z.string().max(5000).optional(), tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(), assignedToUid: seller }).strict(),
  client_update: z.object({ id: uuid, updates: z.object({ kind: z.enum(["individual","company"]).optional(), name: z.string().trim().min(2).max(160).optional(), company: z.string().max(200).optional(), email: z.union([z.string().email(), z.literal("")]).optional(), phone: z.string().max(60).optional(), whatsapp: z.string().max(60).optional(), country: z.string().regex(/^[A-Z]{2}$/).optional(), region: z.string().max(120).optional(), city: z.string().max(120).optional(), address: z.string().max(500).optional(), status: z.enum(["active", "inactive"]).optional(), clientSince: date.optional(), notes: z.string().max(5000).optional(), tags: z.array(z.string().trim().min(1).max(60)).max(30).optional() }).strict() }).strict(),
  client_assign: z.object({ id: uuid, assignedToUid: z.union([uuid, z.literal(""), z.null()]), reason: z.string().max(500).optional() }).strict(),
  project_create: z.object({ clientId: uuid, name: z.string().trim().min(2).max(180), description: z.string().max(8000).optional(), status: z.enum(["draft", "planning", "active", "on_hold", "completed", "cancelled"]).optional(), totalAmountMinor: moneyMinor, currency: usd.optional().default("USD"), soldAt: optionalDate.optional(), effectiveDate: date.optional(), startDate: optionalDate.optional(), targetEndDate: optionalDate.optional(), assignedToUid: seller }).strict(),
  project_update: z.object({ id: uuid, updates: z.object({ name: z.string().trim().min(2).max(180).optional(), description: z.string().max(8000).optional(), status: z.enum(["draft", "planning", "active", "on_hold", "completed", "cancelled"]).optional(), totalAmountMinor: moneyMinor.optional(), currency: usd.optional(), soldAt: optionalDate.optional(), effectiveDate: date.optional(), startDate: optionalDate.optional(), targetEndDate: optionalDate.optional() }).strict() }).strict(),
  project_assign: z.object({ id: uuid, assignedToUid: z.union([uuid, z.literal(""), z.null()]), reason: z.string().max(500).optional() }).strict(),
  payment_plan_save: z.object({ id: uuid.optional(), projectId: uuid, name: z.string().trim().min(2).max(140), installments: z.array(z.object({ label: z.string().trim().min(1).max(140), amountMinor: moneyMinor.refine((value)=>value!=="0"), currency: usd.optional().default("USD"), dueDate: optionalDate.optional(), dueTime: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),z.literal("")]).optional(), notes: z.string().max(1000).optional() }).strict()).max(60) }).strict(),
  payment_plan_activate: z.object({ id: uuid }).strict(),
  recurring_service_save: z.object({ projectId: uuid, name: z.string().trim().min(2).max(140), monthlyAmountMinor: moneyMinor.refine((value) => value !== "0"), currency: usd.optional().default("USD"), frequency: z.enum(["monthly", "quarterly", "yearly"]), startDate: date, billingDay: z.number().int().min(1).max(28), billingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timezone: z.literal("America/Tegucigalpa"), status: z.enum(["draft", "active", "paused", "cancelled"]) }).strict(),
};

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Solicitud comercial inválida." }, { status: 400 });
  if (!hasPermission(admin, permissionFor[body.data.operation])) return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
  const payload = schemas[body.data.operation].safeParse(body.data.payload);
  if (!payload.success) return NextResponse.json({ error: "Los datos comerciales no son válidos." }, { status: 400 });
  try {
    const result = await commercialMutation(body.data.operation, payload.data as Record<string, unknown>);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 400;
    return NextResponse.json({ error: status === 403 ? "No tienes acceso a este registro." : status === 404 ? "Registro no encontrado." : "No se pudo completar la operación comercial." }, { status });
  }
}
