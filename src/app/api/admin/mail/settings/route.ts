import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import { mayUseIdentity } from "@/lib/mail/service";
import { safeSubjectSchema, sanitizeMailHtml, uuidSchema } from "@/lib/mail/security";

const signatureSchema = z.object({
  action: z.literal("save_signature"), id: uuidSchema.optional(), identityId: uuidSchema.nullable(),
  name: z.string().trim().min(2).max(120), html: z.string().min(1).max(20_000),
  logoUrl: z.url().max(1000).nullable().optional(), isDefault: z.boolean().default(true),
}).strict();

const corporateSignatureSchema = z.object({
  action: z.literal("save_corporate_signature"), id: uuidSchema.optional(), identityId: uuidSchema.nullable(),
  name: z.string().trim().min(2).max(120), html: z.string().min(1).max(50_000),
  logoUrl: z.url().max(1000).nullable().optional(),
}).strict();

const templateSchema = z.object({
  action: z.literal("save_template"), id: uuidSchema.optional(), name: z.string().trim().min(2).max(120),
  subject: safeSubjectSchema, html: z.string().min(1).max(200_000), active: z.boolean().default(true),
  locked: z.literal(true).default(true),
}).strict();

function validAssetUrl(value?: string | null) {
  if (!value) return true;
  try {
    const candidate = new URL(value);
    const storage = new URL(getPublicSupabaseConfig().url);
    return candidate.origin === storage.origin
      && candidate.pathname.startsWith("/storage/v1/object/public/mail-signature-assets/");
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const client = createSupabaseAdminClient();
  const identityQuery = auth.admin.role === "owner"
    ? client.from("mail_identities").select("id,email,display_name").eq("status", "active").order("email")
    : client.from("mail_identities").select("id,email,display_name,mail_identity_assignments!inner(profile_id,active)").eq("mail_identity_assignments.profile_id", auth.admin.uid).eq("mail_identity_assignments.active", true).eq("status", "active");
  const [signatureResult, corporateResult, templateResult, identityResult] = await Promise.all([
    client.from("mail_signatures").select("id,identity_id,name,body_html,logo_url,is_default,updated_at").eq("profile_id", auth.admin.uid).order("updated_at", { ascending: false }),
    client.from("corporate_mail_signatures").select("id,logical_id,version,identity_id,name,body_html,logo_url,active,locked,created_at").eq("active", true).order("created_at", { ascending: false }),
    client.from("mail_templates").select("id,logical_id,version,name,subject,body_html,active,locked,scope,status,updated_at").order("name"),
    identityQuery,
  ]);
  if (signatureResult.error || corporateResult.error || templateResult.error || identityResult.error) {
    return NextResponse.json({ error: "No pudimos cargar la configuración de correo." }, { status: 500 });
  }
  return NextResponse.json({
    signatures: signatureResult.data || [], corporateSignatures: corporateResult.data || [],
    templates: hasPermission(auth.admin, "mail:manage_templates") ? templateResult.data || [] : (templateResult.data || []).filter((item) => item.active),
    identities: identityResult.data || [], canManageTemplates: hasPermission(auth.admin, "mail:manage_templates"),
    canManageCorporate: auth.admin.role === "owner",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:use");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = await request.json().catch(() => null);
  const client = createSupabaseAdminClient();

  const signature = signatureSchema.safeParse(body);
  if (signature.success) {
    if (signature.data.identityId && !(await mayUseIdentity(auth.admin, signature.data.identityId))) {
      return NextResponse.json({ error: "No tienes acceso a esa identidad." }, { status: 403 });
    }
    if (!validAssetUrl(signature.data.logoUrl)) return NextResponse.json({ error: "La imagen de firma no es válida." }, { status: 400 });
    const cleanHtml = sanitizeMailHtml(signature.data.html, { signatureContent: true });
    if (!cleanHtml.trim()) return NextResponse.json({ error: "La firma no puede quedar vacía." }, { status: 400 });
    if (signature.data.isDefault) {
      let defaults = client.from("mail_signatures").update({ is_default: false, updated_at: new Date().toISOString() }).eq("profile_id", auth.admin.uid).eq("is_default", true);
      defaults = signature.data.identityId ? defaults.eq("identity_id", signature.data.identityId) : defaults.is("identity_id", null);
      const reset = await defaults;
      if (reset.error) return NextResponse.json({ error: "No pudimos actualizar la firma predeterminada." }, { status: 500 });
    }
    const values = { profile_id: auth.admin.uid, identity_id: signature.data.identityId, name: signature.data.name, body_html: cleanHtml, logo_url: signature.data.logoUrl || null, is_default: signature.data.isDefault, updated_at: new Date().toISOString() };
    const result = signature.data.id
      ? await client.from("mail_signatures").update(values).eq("id", signature.data.id).eq("profile_id", auth.admin.uid).select("id").maybeSingle()
      : await client.from("mail_signatures").insert(values).select("id").single();
    if (result.error || !result.data) return NextResponse.json({ error: "No pudimos guardar la firma." }, { status: 500 });
    return NextResponse.json({ ok: true, id: result.data.id });
  }

  const corporate = corporateSignatureSchema.safeParse(body);
  if (corporate.success) {
    if (auth.admin.role !== "owner") return NextResponse.json({ error: "Solo el Owner puede administrar la firma corporativa." }, { status: 403 });
    if (!validAssetUrl(corporate.data.logoUrl)) return NextResponse.json({ error: "La imagen corporativa no es válida." }, { status: 400 });
    const cleanHtml = sanitizeMailHtml(corporate.data.html, { signatureContent: true });
    if (!cleanHtml.trim()) return NextResponse.json({ error: "La firma corporativa no puede quedar vacía." }, { status: 400 });
    const published = await client.rpc("publish_corporate_mail_signature", {
      p_current: corporate.data.id || null, p_identity: corporate.data.identityId, p_name: corporate.data.name,
      p_body_html: cleanHtml, p_logo_url: corporate.data.logoUrl || null, p_actor: auth.admin.uid,
    });
    if (published.error || !published.data) {
      const changed = published.error?.code === "40001";
      return NextResponse.json({ error: changed ? "La firma corporativa cambió; recargue la página." : "Ya existe una firma corporativa activa para ese alcance." }, { status: 409 });
    }
    await client.from("mail_audit_events").insert({ action: corporate.data.id ? "corporate_signature_versioned" : "corporate_signature_created", actor_id: auth.admin.uid, safe_metadata: { signatureId: published.data.id, version: published.data.version } });
    return NextResponse.json({ ok: true, ...published.data });
  }

  const template = templateSchema.safeParse(body);
  if (template.success) {
    if (!hasPermission(auth.admin, "mail:manage_templates") || auth.admin.role !== "owner") {
      return NextResponse.json({ error: "Solo el Owner puede publicar plantillas corporativas." }, { status: 403 });
    }
    const cleanHtml = sanitizeMailHtml(template.data.html);
    if (!cleanHtml.trim()) return NextResponse.json({ error: "La plantilla no puede quedar vacía." }, { status: 400 });
    const published = await client.rpc("publish_mail_template", {
      p_current: template.data.id || null, p_name: template.data.name, p_subject: template.data.subject,
      p_body_html: cleanHtml, p_active: template.data.active, p_actor: auth.admin.uid,
    });
    if (published.error || !published.data) {
      const changed = published.error?.code === "40001";
      return NextResponse.json({ error: changed ? "La plantilla cambió; recargue la página." : "No pudimos guardar la plantilla." }, { status: changed ? 409 : 500 });
    }
    await client.from("mail_audit_events").insert({ action: template.data.id ? "mail_template_versioned" : "mail_template_created", actor_id: auth.admin.uid, safe_metadata: { templateId: published.data.id, version: published.data.version } });
    return NextResponse.json({ ok: true, ...published.data });
  }
  return NextResponse.json({ error: "Configuración inválida." }, { status: 400 });
}
