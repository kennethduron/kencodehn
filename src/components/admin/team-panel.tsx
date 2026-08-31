"use client";

import { Loader2, MailPlus, RefreshCw, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import type { AdminMember } from "@/lib/admin/types";
import type { ManageableAdminRole } from "@/lib/admin/authorization";
import { HONDURAS_TIME_ZONE } from "@/lib/time";
import { ConfirmDialog, Toast } from "./ui";

const ROLE_OPTIONS: Array<{ value: ManageableAdminRole; label: string }> = [
  { value: "sales_agent", label: "Sales Agent" },
  { value: "manager", label: "Manager" },
  { value: "viewer", label: "Viewer" },
  { value: "admin", label: "Admin" },
];

const INVITATION_LABELS: Record<string, string> = {
  pending: "Invitación pendiente",
  sent: "Correo de acceso enviado",
  failed: "Envío pendiente de reintento",
  accepted: "Acceso configurado",
};

function invitationPending(member: AdminMember) {
  return member.role !== "owner"
    && !member.lastLoginAt
    && Boolean(member.invitationStatus && ["pending", "sent", "failed"].includes(member.invitationStatus));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: HONDURAS_TIME_ZONE,
  }).format(new Date(value));
}

type PendingStatusChange = { member: AdminMember; active: boolean } | null;
type PendingDeletion = { member: AdminMember; reason: string } | null;

export function TeamPanel({ initialMembers, currentUserUid }: { initialMembers: AdminMember[]; currentUserUid: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", role: "sales_agent" as ManageableAdminRole });
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PendingStatusChange>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" | "info" }>({ message: "", variant: "success" });

  const activeCount = useMemo(() => members.filter((member) => member.active && !invitationPending(member)).length, [members]);
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
      if (!response.ok || !payload.member) throw new Error(payload.message || "No se pudo preparar la invitación.");
      setMembers((current) => [...current, payload.member].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)));
      setInvite({ name: "", email: "", role: "sales_agent" });
      setInviteOpen(false);
      setToast({
        message: payload.emailSent ? "Usuario creado e invitación enviada." : "Usuario creado; el correo falló y puede reenviarse desde Equipo.",
        variant: payload.emailSent ? "success" : "info",
      });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "No se pudo preparar la invitación.", variant: "error" });
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
      if (!response.ok || !payload.member) throw new Error(payload.message || "No se pudo reenviar la invitación.");
      replaceMember(payload.member);
      setToast({
        message: payload.emailSent ? "Invitación reenviada." : "El reenvío falló; puede volver a intentarlo sin crear otro usuario.",
        variant: payload.emailSent ? "success" : "error",
      });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "No se pudo reenviar la invitación.", variant: "error" });
    } finally {
      setSavingUid(null);
    }
  }

  async function preparePermanentDeletion(member: AdminMember) {
    setSavingUid(member.uid);
    setToast({ message: "", variant: "success" });
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(member.uid)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.assessment) throw new Error(payload.message || "No pudimos comprobar el historial del miembro.");
      if (!payload.assessment.canDelete) {
        setToast({ message: payload.assessment.reason, variant: "info" });
        return;
      }
      setPendingDeletion({ member, reason: payload.assessment.reason });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "No pudimos comprobar el historial del miembro.", variant: "error" });
    } finally {
      setSavingUid(null);
    }
  }

  async function permanentlyDeleteMember(member: AdminMember) {
    setSavingUid(member.uid);
    setToast({ message: "", variant: "success" });
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(member.uid)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.deleted) throw new Error(payload.message || "No pudimos eliminar el miembro.");
      setMembers((current) => current.filter((item) => item.uid !== member.uid));
      setPendingDeletion(null);
      setToast({ message: "Miembro eliminado definitivamente.", variant: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "No pudimos eliminar el miembro.", variant: "error" });
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
          <p className="mt-2 max-w-2xl text-sm leading-6 text-kc-muted">Administre membresías, roles y estado sin eliminar historial ni asignaciones.</p>
        </div>
        <button type="button" onClick={() => setInviteOpen((open) => !open)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-cyan px-4 text-sm font-black text-kc-bg transition hover:bg-kc-turquoise">
          <MailPlus size={17} aria-hidden="true" /> Invitar usuario
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="kc-admin-card p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-kc-muted">Miembros</p><p className="mt-2 text-3xl font-black text-kc-text">{members.length}</p></div>
        <div className="kc-admin-card p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-kc-muted">Con acceso activo</p><p className="mt-2 text-3xl font-black text-kc-lime">{activeCount}</p></div>
        <div className="kc-admin-card p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-kc-muted">Agentes de ventas</p><p className="mt-2 text-3xl font-black text-kc-cyan">{agentCount}</p></div>
      </div>

      {inviteOpen ? (
        <form onSubmit={submitInvite} className="kc-admin-card grid gap-4 p-5 md:grid-cols-3">
          <div className="md:col-span-3">
            <h2 className="font-display text-xl font-black text-kc-text">Nueva invitación</h2>
            <p className="mt-1 text-sm text-kc-muted">El sistema enviará un enlace seguro para configurar el acceso. Nunca se crea ni se envía una contraseña temporal.</p>
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
              {inviting ? <Loader2 size={16} className="animate-spin" /> : <MailPlus size={16} />} Enviar invitación
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-3">
        {members.map((member) => {
          const immutableOwner = member.role === "owner";
          const isSelf = member.uid === currentUserUid;
          const busy = savingUid === member.uid;
          const pendingInvitation = invitationPending(member);
          const statusLabel = !member.active ? "Inactivo" : pendingInvitation ? "Invitación pendiente" : "Activo";
          const statusClass = !member.active
            ? "bg-rose-400/10 text-rose-700"
            : pendingInvitation ? "bg-amber-400/15 text-amber-800" : "bg-emerald-400/10 text-emerald-700";
          return (
            <article key={member.uid} className="kc-admin-card grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(10rem,.7fr)_minmax(9rem,.6fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-display text-lg font-black text-kc-text">{member.name || (immutableOwner ? "Owner" : "Nombre no configurado")}</h2>
                  {immutableOwner ? <span className="inline-flex items-center gap-1 rounded-full border border-kc-lime/25 bg-kc-lime/10 px-2 py-1 text-xs font-black text-kc-lime"><ShieldCheck size={13} /> Owner protegido</span> : null}
                  <span className={`rounded-full px-2 py-1 text-xs font-black ${statusClass}`}>{statusLabel}</span>
                </div>
                <p className="mt-1 truncate text-sm text-kc-muted">{member.email || "Email no disponible"}</p>
                <p className="mt-2 text-xs leading-5 text-kc-muted">Creado: {formatDate(member.createdAt)} · Último acceso: {formatDate(member.lastLoginAt)} · Leads asignados: {member.assignedLeadCount}</p>
                {member.invitationStatus ? <p className="mt-1 text-xs font-bold text-kc-cyan">{INVITATION_LABELS[member.invitationStatus]}{member.invitationLastSentAt ? ` · Último envío: ${formatDate(member.invitationLastSentAt)}` : ""}</p> : null}
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
              <div className="text-sm text-kc-muted"><span className="block text-xs font-bold uppercase tracking-[0.14em]">Estado</span><span className="mt-2 block">{!member.active ? "Acceso desactivado" : pendingInvitation ? "Esperando aceptación" : "Acceso habilitado"}</span></div>
              <div className="grid gap-2">
                {member.active && member.invitationStatus && ["pending", "sent", "failed"].includes(member.invitationStatus) ? (
                  <button type="button" disabled={busy || immutableOwner} onClick={() => resendInvite(member)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-cyan/25 px-4 text-sm font-black text-kc-cyan transition hover:bg-kc-cyan/10 disabled:opacity-40">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reenviar invitación
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
                {!immutableOwner && !isSelf ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void preparePermanentDeletion(member)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300/25 px-4 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
                    Eliminar definitivamente
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={pendingStatus?.active ? "Activar usuario" : "Desactivar usuario"}
        description={pendingStatus ? (pendingStatus.active
          ? "El usuario recuperará acceso con su rol actual. Su historial y asignaciones se conservan."
          : `Este usuario tiene ${pendingStatus.member.assignedLeadCount} leads asignados. Se desactivará el acceso, pero los leads y su responsable se conservarán.`) : ""}
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
      <ConfirmDialog
        open={Boolean(pendingDeletion)}
        title="Eliminar miembro definitivamente"
        description={pendingDeletion ? `${pendingDeletion.reason} Se eliminarán su cuenta de acceso y su invitación pendiente. Esta acción no podrá recuperarse.` : ""}
        confirmText="Eliminar definitivamente"
        variant="danger"
        loading={Boolean(pendingDeletion && savingUid === pendingDeletion.member.uid)}
        onCancel={() => setPendingDeletion(null)}
        onConfirm={async () => {
          if (pendingDeletion) await permanentlyDeleteMember(pendingDeletion.member);
        }}
      />
    </div>
  );
}
