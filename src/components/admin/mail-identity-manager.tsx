"use client";

import { Archive, AtSign, CheckCircle2, Loader2, Trash2, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { LifecycleInfo } from "@/lib/lifecycle/data";
import { ConfirmDialog, Toast } from "./ui";

type Profile = { id: string; email: string; display_name: string; name: string; role: string };
type Assignment = { id: string; profile_id: string; active: boolean; is_primary: boolean; profiles?: Profile | Profile[] };
type Identity = { id: string; local_part: string; email: string; display_name: string; status: string; mail_identity_assignments: Assignment[]; lifecycle: LifecycleInfo };
type ManagementAction = "edit" | "reactivate" | "assign" | "unassign" | "reassign" | "primary" | "remove_primary";
type PendingManagement = { identity: Identity; action: ManagementAction; profileId?: string };
type PendingLifecycle = { identity: Identity; action: "delete" | "deactivate" };

export function MailIdentityManager() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileId, setProfileId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pendingLifecycle, setPendingLifecycle] = useState<PendingLifecycle | null>(null);
  const [pending, setPending] = useState<PendingManagement | null>(null);
  const [editName, setEditName] = useState("");
  const [targetProfile, setTargetProfile] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/mail/identities", { cache: "no-store" });
      const body = await response.json();
      if (response.ok) { setIdentities(body.identities); setProfiles(body.profiles); setSuggestions(body.suggestions); }
      else setError(body.error);
    } catch { setError("No pudimos cargar las identidades. Recargue la página."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function selectProfile(value: string) {
    setProfileId(value);
    const profile = profiles.find((item) => item.id === value);
    if (profile) {
      const name = profile.display_name || profile.name || profile.email.split("@")[0];
      setDisplayName(name); setLocalPart(suggestions[value]?.[0] || ""); setConfirmed(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return setError("Confirme explícitamente la dirección antes de crearla.");
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/mail/identities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", localPart, displayName, profileId: profileId || undefined, confirmed: true }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setError(body.error);
    setNotice(`Identidad ${body.identity.email} creada.`); setLocalPart(""); setDisplayName(""); setProfileId(""); setConfirmed(false);
    await load();
  }

  const labels: Record<ManagementAction, string> = { edit: "Editar identidad", reactivate: "Reactivar identidad", assign: "Asignar responsable", unassign: "Desasignar de usuario", reassign: "Cambiar responsable", primary: "Establecer como principal", remove_primary: "Quitar como principal" };
  const profileName = (id?: string) => { const profile = profiles.find((item) => item.id === id); return profile?.display_name || profile?.name || profile?.email || "Usuario"; };
  function openManagement(identity: Identity, action: ManagementAction, profileId?: string) {
    setError(""); setPending({ identity, action, profileId }); setEditName(identity.display_name); setTargetProfile("");
  }
  async function applyManagement() {
    if (!pending) return;
    if (pending.action === "edit" && editName.trim().length < 2) return setError("Escriba un nombre visible de al menos dos caracteres.");
    if (["assign", "reassign"].includes(pending.action) && !targetProfile) return setError("Seleccione un usuario activo autorizado.");
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/mail/identities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: pending.action, identityId: pending.identity.id,
        ...(pending.action === "edit" ? { displayName: editName.trim() } : {}),
        ...(["assign", "reassign"].includes(pending.action) ? { profileId: targetProfile } : pending.profileId ? { profileId: pending.profileId } : {}),
        ...(pending.action === "reassign" ? { previousProfileId: pending.profileId } : {}),
      }) });
      const body = await response.json();
      if (!response.ok) return setError(body.error || "No pudimos actualizar la identidad.");
      setNotice("Configuración actualizada. La dirección y el historial permanecen intactos."); setPending(null); await load();
    } catch { setError("No pudimos conectar. Recargue la configuración antes de volver a intentar."); }
    finally { setBusy(false); }
  }

  async function applyLifecycle() {
    if (!pendingLifecycle) return;
    if (pendingLifecycle.action === "delete" && reason.trim().length < 3) return setError("Indique un motivo de al menos tres caracteres.");
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(pendingLifecycle.action === "delete" ? "/api/admin/lifecycle" : "/api/admin/mail/identities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingLifecycle.action === "delete" ? { entity: "mail_identity", id: pendingLifecycle.identity.id, action: "delete", reason: reason.trim() } : { identityId: pendingLifecycle.identity.id, action: "deactivate" }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(body.error || "No pudimos actualizar la identidad.");
    setNotice(pendingLifecycle.action === "delete" ? "Identidad sin uso eliminada de forma segura." : "Identidad desactivada; la correspondencia permanece intacta.");
    setPendingLifecycle(null); setReason(""); await load();
  }

  if (loading) return <div className="kc-admin-card grid min-h-64 place-items-center rounded-2xl border"><Loader2 className="animate-spin" /></div>;
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
    <Toast message={error || notice} variant={error ? "error" : "success"} />
    <section className="kc-admin-card min-w-0 rounded-2xl border p-5"><h2 className="font-display text-xl font-black">Direcciones de Ken Code</h2><div className="mt-4 grid gap-3">
      {identities.map((identity) => <article key={identity.id} className="rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><strong className="block break-all text-sm">{identity.email}</strong><p className="break-words text-sm">Nombre visible: {identity.display_name}</p><p className="text-xs text-kc-muted">Estado: {identity.status === "active" ? "Activa" : "Inactiva"}</p></div><AtSign className="text-blue-700" size={18} /></div>
        <div className="mt-3 grid gap-3">{identity.mail_identity_assignments.filter((item) => item.active).map((assignment) => <div key={assignment.id} className="min-w-0 rounded-xl bg-blue-50 p-3 text-sm">
          <p className="break-words">Responsable: {profileName(assignment.profile_id)}</p><p>Principal: {assignment.is_primary ? identity.status === "active" ? "Sí" : "Sí (no disponible mientras esté inactiva)" : "No"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={busy} type="button" className="min-h-11 rounded-xl border px-3 text-left text-xs font-bold" onClick={() => openManagement(identity, "reassign", assignment.profile_id)}>Cambiar responsable</button>
            {assignment.is_primary || identity.status === "active" ? <button disabled={busy} type="button" className="min-h-11 rounded-xl border px-3 text-left text-xs font-bold" onClick={() => openManagement(identity, assignment.is_primary ? "remove_primary" : "primary", assignment.profile_id)}>{assignment.is_primary ? "Quitar como principal" : "Establecer como principal"}</button> : null}
            <button disabled={busy} type="button" className="min-h-11 rounded-xl border px-3 text-left text-xs font-bold text-rose-700" onClick={() => openManagement(identity, "unassign", assignment.profile_id)}>Desasignar de usuario</button>
          </div>
        </div>)}{!identity.mail_identity_assignments.some((item) => item.active) ? <p className="text-sm text-kc-muted">Sin responsable activo · Principal: No</p> : null}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busy} type="button" onClick={() => openManagement(identity, "edit")} className="min-h-11 rounded-xl border px-3 text-sm font-bold">Editar identidad</button>
          {!identity.mail_identity_assignments.some((item) => item.active) ? <button disabled={busy} type="button" onClick={() => openManagement(identity, "assign")} className="min-h-11 rounded-xl border px-3 text-sm font-bold">Asignar responsable</button> : null}
          {identity.status !== "active" ? <button disabled={busy} type="button" onClick={() => openManagement(identity, "reactivate")} className="min-h-11 rounded-xl border border-blue-300 px-3 text-sm font-bold text-blue-700">Reactivar identidad</button> : <button disabled={busy} type="button" onClick={() => setPendingLifecycle({ identity, action: "deactivate" })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold"><Archive size={16} />Desactivar identidad</button>}
          {identity.lifecycle.deleteAllowed ? <button disabled={busy} type="button" onClick={() => setPendingLifecycle({ identity, action: "delete" })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-700"><Trash2 size={16} />Eliminar identidad</button> : null}
        </div>
        <p className="mt-2 text-xs leading-5 text-kc-muted">{identity.lifecycle.reason}</p>
      </article>)}
      {!identities.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-kc-muted">No hay identidades corporativas todavía.</p> : null}
    </div></section>
    <form onSubmit={create} className="kc-admin-card self-start rounded-2xl border p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserPlus size={18} /></span><h2 className="font-display text-xl font-black">Nueva identidad</h2></div><div className="mt-5 grid gap-4">
      <label className="grid gap-1.5 text-sm font-bold">Asignar inicialmente a<select value={profileId} onChange={(event) => selectProfile(event.target.value)} className="min-h-11 rounded-xl border px-3"><option value="">Sin asignar</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name || profile.name || profile.email} · {profile.role}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-bold">Nombre visible<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={160} required className="min-h-11 rounded-xl border px-3" /></label>
      <label className="grid gap-1.5 text-sm font-bold">Dirección<div className="flex min-w-0"><input value={localPart} onChange={(event) => { setLocalPart(event.target.value.toLowerCase()); setConfirmed(false); }} pattern="[a-z0-9][a-z0-9._-]*" maxLength={64} required className="min-h-11 min-w-0 flex-1 rounded-l-xl border px-3" /><span className="flex items-center rounded-r-xl border border-l-0 bg-slate-50 px-2 text-xs font-bold">@kencodehn.com</span></div>{profileId && suggestions[profileId]?.length ? <span className="flex flex-wrap gap-1">{suggestions[profileId].map((suggestion) => <button key={suggestion} type="button" onClick={() => { setLocalPart(suggestion); setConfirmed(false); }} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-normal">{suggestion}</button>)}</span> : null}</label>
      <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4" /><span><strong className="block">Confirmo esta dirección</strong><span className="break-all text-xs text-kc-muted">{localPart || "local-part"}@kencodehn.com pertenecerá a Ken Code.</span></span></label>
      <button type="submit" disabled={busy || !confirmed} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Crear identidad</button>
    </div></form>
    <ConfirmDialog open={Boolean(pending)} title={pending ? labels[pending.action] : "Identidad"} confirmText={pending?.action === "edit" ? "Guardar nombre visible" : pending ? labels[pending.action] : "Confirmar"} loading={busy} onCancel={() => setPending(null)} onConfirm={applyManagement} description={pending?.action === "unassign" ? "Esta persona dejará de poder enviar desde esta dirección. La identidad y su historial permanecerán intactos. Si era su principal, quedará sin esa selección predeterminada." : pending?.action === "reassign" ? "El responsable anterior dejará de poder enviar desde esta dirección y perderá esta selección principal. El nuevo responsable podrá utilizarla cuando esté activa. Establezca su principal por separado. El historial permanecerá intacto." : pending?.action === "primary" ? "Esta será la dirección predeterminada de este usuario en Redactar. Reemplazará su principal anterior, sin desasignar ninguna dirección." : pending?.action === "remove_primary" ? "El usuario conservará el acceso a esta dirección, pero quedará sin principal. En Redactar deberá seleccionar una dirección si tiene varias." : pending?.action === "edit" ? "Solo cambia el nombre visible para nuevos correos. La dirección y los mensajes históricos no cambian." : pending?.action === "reactivate" ? "Se recuperará esta misma identidad y su historial. Las asignaciones y la selección principal se conservan; si no tiene responsable, asígnelo después." : "Seleccione quién podrá utilizar esta dirección. La identidad principal se configura por separado."}>
      <p className="mb-3 break-all text-sm font-bold">{pending?.identity.email}</p>
      {pending?.action === "edit" ? <label className="grid gap-2 text-sm font-bold">Nombre visible<input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={160} className="min-h-11 min-w-0 rounded-xl border px-3" /></label> : null}
      {pending && ["assign", "reassign"].includes(pending.action) ? <label className="grid gap-2 text-sm font-bold">Asignar a<select value={targetProfile} onChange={(event) => setTargetProfile(event.target.value)} className="min-h-11 min-w-0 w-full rounded-xl border px-3"><option value="">Seleccione un usuario</option>{profiles.filter((profile) => !pending.identity.mail_identity_assignments.some((assignment) => assignment.active && assignment.profile_id === profile.id)).map((profile) => <option key={profile.id} value={profile.id}>{profileName(profile.id)} · {profile.role} · {profile.email}</option>)}</select></label> : null}
    </ConfirmDialog>
    <ConfirmDialog open={Boolean(pendingLifecycle)} title={`${pendingLifecycle?.action === "delete" ? "Eliminar" : "Desactivar"} “${pendingLifecycle?.identity.email || "identidad"}”`} description={pendingLifecycle?.action === "delete" ? "Esta identidad no tiene correspondencia. Si continúa se eliminará definitivamente y sus asignaciones de configuración se retirarán." : `${pendingLifecycle?.identity.mail_identity_assignments.filter((item) => item.active && item.is_primary).map((item) => `Esta es la identidad principal de ${profileName(item.profile_id)}. `).join("") || ""}Si la desactiva, dejará de estar disponible para enviar nuevos correos. Las asignaciones y la correspondencia existente se conservarán.`} confirmText={pendingLifecycle?.action === "delete" ? "Eliminar definitivamente" : "Desactivar identidad"} variant="danger" loading={busy} onCancel={() => { setPendingLifecycle(null); setReason(""); }} onConfirm={applyLifecycle}>{pendingLifecycle?.action === "delete" ? <label className="grid gap-2 text-sm font-bold">Motivo<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="rounded-xl border p-3" placeholder="Explique brevemente el motivo" /></label> : null}</ConfirmDialog>
  </div>;
}
