"use client";

import { Loader2, MailPlus, RefreshCw, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import type { AdminMember } from "@/lib/admin/types";
import type { ManageableAdminRole } from "@/lib/admin/authorization";
import { ConfirmDialog, Toast } from "./ui";

const ROLE_OPTIONS: Array<{ value: ManageableAdminRole; label: string }> = [
  { value: "sales_agent", label: "Sales Agent" },
  { value: "manager", label: "Manager" },
  { value: "viewer", label: "Viewer" },
  { value: "admin", label: "Admin" },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
  sales_agent: "Sales Agent",
};

const INVITATION_LABELS: Record<string, string> = {
  pending: "Invitacion pendiente",
  sent: "Invitacion enviada",
  failed: "Fallo de envio",
  accepted: "Acceso configurado",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

type PendingStatusChange = { member: AdminMember; active: boolean } | null;

export function TeamPanel({ initialMembers, currentUserUid }: { initialMembers: AdminMember[]; currentUserUid: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", role: "sales_agent" as ManageableAdminRole });
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PendingStatusChange>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" | "info" }>({ message: "", variant: "success" });

  const activeCount = useMemo(() => members.filter((member) => member.active).length, [members]);
  const agentCount = useMemo(() => members.filter((member) => member.role === "sales_agent").length, [members]);

  function replaceMember(updated: AdminMember) {
    setMembers((current) => current.map((member) => (member.uid === updated.uid ? updated : member)));
  }

  async function patchMember(uid: string, changes: { role?: ManageableAdminRole; active?: boolean }) {
    setSavingUid(uid);
    setToast({ message: "", variant: "success" });
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const payload = await response.json();
      if (!response.ok || !payload.user) throw new Error(payload.message || "No se pudo actualizar el miembro.");
      replaceMember(payload.user);
      setToast({ message: "Miembro actualizado.", variant: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "No se pudo actualizar el miembro.", variant: "error" });
    } finally {
      setSavingUid(null);
    }
  }

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    setToast({ message: "", variant: "success" });
    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite),
      });
      const payload = await response.json();
      if (!response.ok || !payload.member) throw new Error(payload.message || "No se pudo preparar la invitacion.");
      setMembers((current) => [...current, payload.member].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)));
      setInvite({ name: "", email: "", role: "sales_agent" });
      setInviteOpen(false);
      setToast({
        message: payload.emailSent ? "Usuario creado e invitacion enviada." : "Usuario creado; el email fallo y puede reenviarse desde Equipo.",
        variant: payload.emailSent ? "success" : "info",
      });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "No se pudo preparar la invitacion.", variant: "error" });
    } finally {
      setInviting(false);
    }
  }

  async function resendInvite(member: AdminMember) {
    setSavingUid(member.uid);
    setToast({ message: "", variant: "success" });
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(member.uid)}/resend-invite`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.member) throw new Error(payload.message || "No se pudo reenviar la invitacion.");
      replaceMember(payload.member);
      setToast({
        message: payload.emailSent ? "Invitacion reenviada." : "El reenvio fallo; puedes volver a intentarlo sin crear otro usuario.",
        variant: payload.emailSent ? "success" : "error",
      });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "No se pudo reenviar la invitacion.", variant: "error" });
    } finally {
      setSavingUid(null);
    }
  }

  return (
    <div className="grid gap-6">
      <Toast message={toast.message} variant={toast.variant} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Equipo</p>
          <h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Usuarios del CRM</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-kc-muted">Administra membresia, roles y estado sin eliminar historial ni asignaciones.</p>
        </div>
        <button type="button" onClick={() => setInviteOpen((open) => !open)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-cyan px-4 text-sm font-black text-kc-bg transition hover:bg-kc-turquoise">
          <MailPlus size={17} aria-hidden="true" /> Invitar usuario
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="kc-admin-card p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-kc-muted">Miembros</p><p className="mt-2 text-3xl font-black text-kc-text">{members.length}</p></div>
        <div className="kc-admin-card p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-kc-muted">Activos</p><p className="mt-2 text-3xl font-black text-kc-lime">{activeCount}</p></div>
        <div className="kc-admin-card p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-kc-muted">Sales Agents</p><p className="mt-2 text-3xl font-black text-kc-cyan">{agentCount}</p></div>
      </div>

      {inviteOpen ? (
        <form onSubmit={submitInvite} className="kc-admin-card grid gap-4 p-5 md:grid-cols-3">
          <div className="md:col-span-3">
            <h2 className="font-display text-xl font-black text-kc-text">Nueva invitacion</h2>
            <p className="mt-1 text-sm text-kc-muted">Firebase generara un enlace seguro para establecer la credencial. Nunca se crea ni se envia una contrasena temporal.</p>
          </div>
          <label className="grid gap-2 text-sm font-bold text-kc-text">Nombre
            <input required minLength={2} maxLength={120} value={invite.name} onChange={(event) => setInvite((value) => ({ ...value, name: event.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 outline-none transition focus:border-kc-cyan/60" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kc-text">Email
            <input required type="email" maxLength={180} value={invite.email} onChange={(event) => setInvite((value) => ({ ...value, email: event.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 outline-none transition focus:border-kc-cyan/60" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kc-text">Rol
            <select value={invite.role} onChange={(event) => setInvite((value) => ({ ...value, role: event.target.value as ManageableAdminRole }))} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg-soft px-3 outline-none transition focus:border-kc-cyan/60">
              {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </label>
          <div className="flex gap-2 md:col-span-3 md:justify-end">
            <button type="button" onClick={() => setInviteOpen(false)} disabled={inviting} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-black text-kc-text disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={inviting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-cyan px-4 text-sm font-black text-kc-bg disabled:opacity-60">
              {inviting ? <Loader2 size={16} className="animate-spin" /> : <MailPlus size={16} />} Preparar invitacion
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-3">
        {members.map((member) => {
          const immutableOwner = member.role === "owner";
          const isSelf = member.uid === currentUserUid;
          const busy = savingUid === member.uid;
          return (
            <article key={member.uid} className="kc-admin-card grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(10rem,.7fr)_minmax(9rem,.6fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-display text-lg font-black text-kc-text">{member.name || "Sin nombre"}</h2>
                  {immutableOwner ? <span className="inline-flex items-center gap-1 rounded-full border border-kc-lime/25 bg-kc-lime/10 px-2 py-1 text-xs font-black text-kc-lime"><ShieldCheck size={13} /> Owner protegido</span> : null}
                  <span className={`rounded-full px-2 py-1 text-xs font-black ${member.active ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>{member.active ? "Activo" : "Inactivo"}</span>
                </div>
                <p className="mt-1 truncate text-sm text-kc-muted">{member.email || "Email no disponible"}</p>
                <p className="mt-2 text-xs leading-5 text-kc-muted">Creado: {formatDate(member.createdAt)} · Ultimo acceso: {formatDate(member.lastLoginAt)} · Leads asignados: {member.assignedLeadCount}</p>
                {member.invitationStatus ? <p className="mt-1 text-xs font-bold text-kc-cyan">{INVITATION_LABELS[member.invitationStatus]}{member.invitationLastSentAt ? ` · Ultimo envio: ${formatDate(member.invitationLastSentAt)}` : ""}</p> : null}
              </div>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-kc-muted">Rol
                {immutableOwner ? (
                  <span className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm normal-case tracking-normal text-kc-text">Owner</span>
                ) : (
                  <select disabled={busy || isSelf} value={member.role ?? "viewer"} onChange={(event) => patchMember(member.uid, { role: event.target.value as ManageableAdminRole })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg-soft px-3 text-sm normal-case tracking-normal text-kc-text disabled:cursor-not-allowed disabled:opacity-50">
                    {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                )}
              </label>
              <div className="text-sm text-kc-muted"><span className="block text-xs font-bold uppercase tracking-[0.14em]">Estado</span><span className="mt-2 block">{ROLE_LABELS[member.role ?? ""] ?? "Rol invalido"}</span></div>
              <div className="grid gap-2">
                {member.active && member.invitationStatus && ["pending", "sent", "failed"].includes(member.invitationStatus) ? (
                  <button type="button" disabled={busy || immutableOwner} onClick={() => resendInvite(member)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-cyan/25 px-4 text-sm font-black text-kc-cyan transition hover:bg-kc-cyan/10 disabled:opacity-40">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reenviar invitacion
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || immutableOwner || isSelf}
                  onClick={() => setPendingStatus({ member, active: !member.active })}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${member.active ? "border-rose-300/25 text-rose-200 hover:bg-rose-300/10" : "border-emerald-300/25 text-emerald-200 hover:bg-emerald-300/10"}`}
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : member.active ? <UserX size={16} /> : <UserCheck size={16} />}
                  {member.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={pendingStatus?.active ? "Activar usuario" : "Desactivar usuario"}
        description={pendingStatus ? (pendingStatus.active
          ? "El usuario recuperara acceso con su rol actual. Su historial y asignaciones se conservan."
          : `Este usuario tiene ${pendingStatus.member.assignedLeadCount} leads asignados. Se desactivara el acceso, pero los leads y su ownership se conservaran.`) : ""}
        confirmText={pendingStatus?.active ? "Activar" : "Desactivar"}
        variant={pendingStatus?.active ? "default" : "danger"}
        loading={Boolean(pendingStatus && savingUid === pendingStatus.member.uid)}
        onCancel={() => setPendingStatus(null)}
        onConfirm={async () => {
          if (!pendingStatus) return;
          await patchMember(pendingStatus.member.uid, { active: pendingStatus.active });
          setPendingStatus(null);
        }}
      />
    </div>
  );
}
