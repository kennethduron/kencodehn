import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionsFromRequest } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeLocalPart, suggestLocalParts, uuidSchema } from "@/lib/mail/security";
import { inspectRecordLifecycle } from "@/lib/lifecycle/data";

const createSchema = z.object({ action: z.literal("create"), localPart: z.string().max(100), displayName: z.string().trim().min(2).max(160), profileId: uuidSchema.optional(), confirmed: z.literal(true) }).strict();
const assignmentSchema = z.object({ action: z.enum(["assign", "unassign"]), identityId: uuidSchema, profileId: uuidSchema, primary: z.boolean().optional() }).strict();

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
  if (created.success) { const localPart = normalizeLocalPart(created.data.localPart); if (localPart !== created.data.localPart.trim().toLowerCase() || localPart.length < 1) return NextResponse.json({ error: "Confirme una dirección normalizada válida." }, { status: 400 }); const result = await client.from("mail_identities").insert({ local_part: localPart, display_name: created.data.displayName, created_by: auth.admin.uid }).select("id,email").single(); if (result.error) return NextResponse.json({ error: result.error.code === "23505" ? "Esa identidad ya existe." : "No pudimos crear la identidad." }, { status: result.error.code === "23505" ? 409 : 500 }); if (created.data.profileId) await client.from("mail_identity_assignments").insert({ identity_id: result.data.id, profile_id: created.data.profileId, assigned_by: auth.admin.uid, is_primary: true }); await client.from("mail_audit_events").insert({ action: "mail_identity_created", actor_id: auth.admin.uid, identity_id: result.data.id, safe_metadata: { assigned: Boolean(created.data.profileId) } }); return NextResponse.json({ ok: true, identity: result.data }); }
  const assignment = assignmentSchema.safeParse(body);
  if (assignment.success) { if (assignment.data.action === "assign") { const { data: profile } = await client.from("profiles").select("active").eq("id", assignment.data.profileId).maybeSingle(); if (!profile?.active) return NextResponse.json({ error: "Solo puede asignar usuarios activos." }, { status: 400 }); const result = await client.from("mail_identity_assignments").insert({ identity_id: assignment.data.identityId, profile_id: assignment.data.profileId, assigned_by: auth.admin.uid, is_primary: assignment.data.primary || false }); if (result.error) return NextResponse.json({ error: "No pudimos asignar la identidad." }, { status: 409 }); } else await client.from("mail_identity_assignments").update({ active: false, unassigned_at: new Date().toISOString(), is_primary: false }).eq("identity_id", assignment.data.identityId).eq("profile_id", assignment.data.profileId).eq("active", true); await client.from("mail_audit_events").insert({ action: `mail_identity_${assignment.data.action}ed`, actor_id: auth.admin.uid, identity_id: assignment.data.identityId, safe_metadata: { profileId: assignment.data.profileId } }); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
}
