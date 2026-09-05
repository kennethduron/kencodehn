import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeLocalPart, suggestLocalParts, uuidSchema } from "@/lib/mail/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { inspectRecordLifecycle } from "@/lib/lifecycle/data";

const createSchema = z.object({ action: z.literal("create"), localPart: z.string().max(100), displayName: z.string().trim().min(2).max(160), profileId: uuidSchema.optional(), confirmed: z.literal(true) }).strict();
const managementSchema = z.object({ action: z.enum(["edit", "reactivate", "deactivate", "assign", "unassign", "reassign", "primary", "remove_primary"]), identityId: uuidSchema, profileId: uuidSchema.optional(), previousProfileId: uuidSchema.optional(), displayName: z.string().trim().min(2).max(160).regex(/^[^\r\n]+$/).optional() }).strict();

export async function GET(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:manage_identities");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const client = createSupabaseAdminClient();
  const [identityResult, assignmentResult, profileResult] = await Promise.all([
    client
      .from("mail_identities")
      .select("id,local_part,email,display_name,status,created_at")
      .order("created_at"),
    client
      .from("mail_identity_assignments")
      .select("id,identity_id,profile_id,is_primary,active,assigned_at,unassigned_at")
      .order("assigned_at"),
    client
      .from("profiles")
      .select("id,email,display_name,name,active,role")
      .eq("active", true)
      .in("role", ["owner", "admin", "manager", "sales_agent"])
      .order("email"),
  ]);

  if (identityResult.error || assignmentResult.error || profileResult.error) {
    return NextResponse.json(
      { error: "No pudimos cargar las identidades corporativas." },
      { status: 500 },
    );
  }

  const profilesById = new Map(profileResult.data.map((profile) => [profile.id, profile]));
  const assignmentsByIdentity = new Map<string, Array<Record<string, unknown>>>();
  for (const assignment of assignmentResult.data) {
    const entries = assignmentsByIdentity.get(assignment.identity_id) || [];
    entries.push({
      ...assignment,
      profiles: profilesById.get(assignment.profile_id) || null,
    });
    assignmentsByIdentity.set(assignment.identity_id, entries);
  }

  const identities = await Promise.all(identityResult.data.map(async (identity) => ({
    ...identity,
    mail_identity_assignments: assignmentsByIdentity.get(identity.id) || [],
    lifecycle: await inspectRecordLifecycle("mail_identity", identity.id),
  })));
  const suggestions = Object.fromEntries(
    profileResult.data.map((profile) => [
      profile.id,
      suggestLocalParts(profile.display_name || profile.name || profile.email.split("@")[0]),
    ]),
  );

  return NextResponse.json({ identities, profiles: profileResult.data, suggestions });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermissionsFromRequest(request, "mail:manage_identities"); if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = await request.json().catch(() => null); const created = createSchema.safeParse(body); const client = createSupabaseAdminClient();
  if (created.success) { if (created.data.profileId) { const { data: target } = await client.from("profiles").select("id").eq("id", created.data.profileId).eq("active", true).in("role", ["owner", "admin", "manager", "sales_agent"]).maybeSingle(); if (!target) return NextResponse.json({ error: "Solo puede asignar usuarios activos y autorizados." }, { status: 400 }); } const localPart = normalizeLocalPart(created.data.localPart); if (localPart !== created.data.localPart.trim().toLowerCase() || localPart.length < 1) return NextResponse.json({ error: "Confirme una dirección normalizada válida." }, { status: 400 }); const result = await client.from("mail_identities").insert({ local_part: localPart, display_name: created.data.displayName, created_by: auth.admin.uid }).select("id,email").single(); if (result.error) return NextResponse.json({ error: result.error.code === "23505" ? "Esa identidad ya existe." : "No pudimos crear la identidad." }, { status: result.error.code === "23505" ? 409 : 500 }); if (created.data.profileId) { const assignmentResult = await client.from("mail_identity_assignments").insert({ identity_id: result.data.id, profile_id: created.data.profileId, assigned_by: auth.admin.uid, is_primary: false }); if (assignmentResult.error) return NextResponse.json({ error: "La identidad se creó sin responsable. Use Asignar responsable para completar la configuración." }, { status: 409 }); } await client.from("mail_audit_events").insert({ action: "mail_identity_created", actor_id: auth.admin.uid, identity_id: result.data.id, safe_metadata: { assigned: Boolean(created.data.profileId) } }); return NextResponse.json({ ok: true, identity: result.data }); }
  const management = managementSchema.safeParse(body);
  if (management.success) {
    const input = management.data;
    const session = await createSupabaseServerClient();
    const { error } = await session.rpc("manage_mail_identity", {
      p_identity_id: input.identityId, p_action: input.action,
      p_profile_id: input.profileId || null, p_previous_profile_id: input.previousProfileId || null,
      p_display_name: input.displayName ?? null,
    });
    if (error) return NextResponse.json({ error: "No pudimos actualizar la identidad. Verifique que el usuario esté activo y autorizado y recargue la configuración." }, { status: error.code === "42501" ? 403 : 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
}
