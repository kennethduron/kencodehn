"use client";

import { Archive, AtSign, CheckCircle2, Loader2, Trash2, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { LifecycleInfo } from "@/lib/lifecycle/data";
import { ConfirmDialog, Toast } from "./ui";

type Profile = { id: string; email: string; display_name: string; name: string; role: string };
type Assignment = { id: string; profile_id: string; active: boolean; is_primary: boolean; profiles?: Profile | Profile[] };
type Identity = { id: string; local_part: string; email: string; display_name: string; status: string; mail_identity_assignments: Assignment[]; lifecycle: LifecycleInfo };
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
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/mail/identities", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) { setIdentities(body.identities); setProfiles(body.profiles); setSuggestions(body.suggestions); }
    else setError(body.error);
    setLoading(false);
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

  async function unassign(identityId: string, assignedProfile: string) {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/mail/identities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unassign", identityId, profileId: assignedProfile }) });
    setBusy(false);
    if (!response.ok) { const body = await response.json(); return setError(body.error); }
    setNotice("Asignación finalizada; el historial permanece intacto."); await load();
  }

  async function applyLifecycle() {
    if (!pendingLifecycle || reason.trim().length < 3) return;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/lifecycle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity: "mail_identity", id: pendingLifecycle.identity.id, action: pendingLifecycle.action, reason: reason.trim() }) });
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
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><strong className="block break-all text-sm">{identity.email}</strong><span className="text-xs text-kc-muted">{identity.display_name} · {identity.status === "active" ? "Activa" : "Inactiva"}</span></div><AtSign className="text-blue-700" size={18} /></div>
        <div className="mt-3 flex flex-wrap gap-2">{identity.mail_identity_assignments.filter((item) => item.active).map((assignment) => { const profile = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles; return <span key={assignment.id} className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full bg-blue-50 px-3 text-xs font-bold text-blue-800"><span className="truncate">{profile?.display_name || profile?.name || profile?.email || "Usuario"}{assignment.is_primary ? " · principal" : ""}</span><button type="button" onClick={() => unassign(identity.id, assignment.profile_id)} className="shrink-0 text-rose-700" aria-label={`Desasignar ${identity.email}`}>×</button></span>; })}{!identity.mail_identity_assignments.some((item) => item.active) ? <span className="text-xs text-kc-muted">Sin responsable activo</span> : null}</div>
        {identity.lifecycle.recommendedAction === "delete" ? <button type="button" onClick={() => setPendingLifecycle({ identity, action: "delete" })} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 px-3 text-sm font-black text-rose-700"><Trash2 size={16} /> Eliminar identidad</button> : identity.lifecycle.recommendedAction === "deactivate" && identity.status === "active" ? <button type="button" onClick={() => setPendingLifecycle({ identity, action: "deactivate" })} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-black text-slate-700"><Archive size={16} /> Desactivar identidad</button> : null}
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
    <ConfirmDialog open={Boolean(pendingLifecycle)} title={`${pendingLifecycle?.action === "delete" ? "Eliminar" : "Desactivar"} “${pendingLifecycle?.identity.email || "identidad"}”`} description={pendingLifecycle?.action === "delete" ? "Esta identidad no tiene correspondencia. Si continúa se eliminará definitivamente y sus asignaciones de configuración se retirarán." : "La identidad dejará de utilizarse para nuevos mensajes; la correspondencia existente se conservará."} confirmText={pendingLifecycle?.action === "delete" ? "Eliminar definitivamente" : "Desactivar identidad"} variant="danger" loading={busy} onCancel={() => { setPendingLifecycle(null); setReason(""); }} onConfirm={applyLifecycle}><label className="grid gap-2 text-sm font-bold">Motivo<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="rounded-xl border p-3" placeholder="Explique brevemente el motivo" /></label></ConfirmDialog>
  </div>;
}
