"use client";

import { Archive, Ellipsis, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LifecycleEntity, LifecycleInfo } from "@/lib/lifecycle/data";
import { ConfirmDialog, Toast } from "./ui";

const labels: Record<LifecycleInfo["recommendedAction"], string> = {
  delete: "Eliminar definitivamente",
  archive: "Archivar",
  deactivate: "Desactivar",
  cancel: "Cancelar",
  reverse: "Usar reversión financiera",
  none: "Sin acciones disponibles",
};

export function LifecycleActions({ entity, id, name, info, returnTo }: { entity: LifecycleEntity; id: string; name: string; info: LifecycleInfo; returnTo: string }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "archive" | "deactivate" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    function close(event: MouseEvent) { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", close); window.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", escape); };
  }, []);
  const recommended = info.recommendedAction;
  const actionable = recommended === "delete" || recommended === "archive" || recommended === "deactivate" || recommended === "cancel";
  async function apply() {
    if (!confirming || reason.trim().length < 3) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/lifecycle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entity, id, action: confirming, reason: reason.trim() }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo completar la acción.");
      setConfirming(null); setReason("");
      if (confirming === "delete") router.push(returnTo); else router.refresh();
      setMessage(confirming === "delete" ? "Registro eliminado de forma segura." : "Estado actualizado; el historial se conservó.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo completar la acción."); }
    finally { setBusy(false); }
  }
  return <div ref={menuRef} className="relative">
    {message ? <Toast message={message} variant={message.startsWith("No") ? "error" : "success"} /> : null}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-black text-slate-800"><Ellipsis size={18} /> Más acciones</button>
    {open ? <div role="menu" className="absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border bg-white p-2 shadow-2xl">
      <p className="px-3 py-2 text-xs leading-5 text-kc-muted">{info.reason}</p>
      {actionable ? <button role="menuitem" type="button" onClick={() => { setConfirming(recommended); setOpen(false); }} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left font-black ${recommended === "delete" ? "text-rose-700 hover:bg-rose-50" : "text-slate-800 hover:bg-slate-50"}`}>{recommended === "delete" ? <Trash2 size={17} /> : <Archive size={17} />}{labels[recommended]}</button> : null}
    </div> : null}
    <ConfirmDialog open={Boolean(confirming)} title={`${confirming === "delete" ? "Eliminar" : labels[confirming ?? "none"]} “${name}”`} description={confirming === "delete" ? "Este registro no tiene actividad relacionada. Si continúa se eliminará definitivamente." : "El registro se conservará para mantener el historial de Ken Code."} confirmText={confirming === "delete" ? "Eliminar definitivamente" : labels[confirming ?? "none"]} variant="danger" loading={busy} onCancel={() => { setConfirming(null); setReason(""); }} onConfirm={apply}>
      <label className="grid gap-2 text-sm font-bold">Motivo<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="rounded-xl border p-3" placeholder="Explique brevemente el motivo" /></label>
    </ConfirmDialog>
  </div>;
}
