import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mayUseIdentity } from "@/lib/mail/service";
import { safeSubjectSchema, sanitizeMailHtml, uuidSchema } from "@/lib/mail/security";

const signatureSchema = z.object({
  action: z.literal("save_signature"),
  id: uuidSchema.optional(),
  identityId: uuidSchema.nullable(),
  name: z.string().trim().min(2).max(120),
  html: z.string().min(1).max(20_000),
  isDefault: z.boolean().default(true),
}).strict();

const templateSchema = z.object({
  action: z.literal("save_template"),
  id: uuidSchema.optional(),
  name: z.string().trim().min(2).max(120),
  subject: safeSubjectSchema,
  html: z.string().min(1).max(200_000),
  active: z.boolean().default(true),
}).strict();

export async function GET(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const client = createSupabaseAdminClient();
  const [signatureResult, templateResult, identityResult] = await Promise.all([
    client.from("mail_signatures").select("id,identity_id,name,body_html,is_default,updated_at").eq("profile_id", auth.admin.uid).order("updated_at", { ascending: false }),
    client.from("mail_templates").select("id,name,subject,body_html,active,updated_at").order("name"),
    client.from("mail_identities").select("id,email,display_name,mail_identity_assignments!inner(profile_id,active)").eq("mail_identity_assignments.profile_id", auth.admin.uid).eq("mail_identity_assignments.active", true).eq("status", "active"),
  ]);
  if (signatureResult.error || templateResult.error || identityResult.error) return NextResponse.json({ error: "No pudimos cargar la configuración de correo." }, { status: 500 });
  return NextResponse.json({
    signatures: signatureResult.data || [],
    templates: hasPermission(auth.admin, "mail:manage_templates") ? templateResult.data || [] : (templateResult.data || []).filter((item) => item.active),
    identities: identityResult.data || [],
    canManageTemplates: hasPermission(auth.admin, "mail:manage_templates"),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = await request.json().catch(() => null);
  const signature = signatureSchema.safeParse(body);
  const client = createSupabaseAdminClient();
  if (signature.success) {
    if (signature.data.identityId && !(await mayUseIdentity(auth.admin, signature.data.identityId))) return NextResponse.json({ error: "No tienes acceso a esa identidad." }, { status: 403 });
    const cleanHtml = sanitizeMailHtml(signature.data.html);
    if (!cleanHtml.trim()) return NextResponse.json({ error: "La firma no puede quedar vacía." }, { status: 400 });
    if (signature.data.isDefault) {
      let defaults = client.from("mail_signatures").update({ is_default: false, updated_at: new Date().toISOString() }).eq("profile_id", auth.admin.uid).eq("is_default", true);
      defaults = signature.data.identityId ? defaults.eq("identity_id", signature.data.identityId) : defaults.is("identity_id", null);
      await defaults;
    }
    const values = { profile_id: auth.admin.uid, identity_id: signature.data.identityId, name: signature.data.name, body_html: cleanHtml, is_default: signature.data.isDefault, updated_at: new Date().toISOString() };
    const result = signature.data.id
      ? await client.from("mail_signatures").update(values).eq("id", signature.data.id).eq("profile_id", auth.admin.uid).select("id").maybeSingle()
      : await client.from("mail_signatures").insert(values).select("id").single();
    if (result.error || !result.data) return NextResponse.json({ error: "No pudimos guardar la firma." }, { status: 500 });
    return NextResponse.json({ ok: true, id: result.data.id });
  }
  const template = templateSchema.safeParse(body);
  if (template.success) {
    if (!hasPermission(auth.admin, "mail:manage_templates")) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    const cleanHtml = sanitizeMailHtml(template.data.html);
    if (!cleanHtml.trim()) return NextResponse.json({ error: "La plantilla no puede quedar vacía." }, { status: 400 });
    const values = { name: template.data.name, subject: template.data.subject, body_html: cleanHtml, active: template.data.active, updated_by: auth.admin.uid, updated_at: new Date().toISOString() };
    const result = template.data.id
      ? await client.from("mail_templates").update(values).eq("id", template.data.id).select("id").maybeSingle()
      : await client.from("mail_templates").insert({ ...values, created_by: auth.admin.uid }).select("id").single();
    if (result.error || !result.data) return NextResponse.json({ error: "No pudimos guardar la plantilla." }, { status: 500 });
    await client.from("mail_audit_events").insert({ action: template.data.id ? "mail_template_updated" : "mail_template_created", actor_id: auth.admin.uid, safe_metadata: { templateId: result.data.id } });
    return NextResponse.json({ ok: true, id: result.data.id });
  }
  return NextResponse.json({ error: "Configuración inválida." }, { status: 400 });
}
