"use client";

import { Loader2, X } from "lucide-react";
import { useEffect } from "react";

export function Toast({ message, variant = "success" }: { message: string; variant?: "success" | "error" | "info" }) {
  if (!message) return null;
  const tone =
    variant === "error"
      ? "border-rose-300/30 bg-rose-950/95 text-rose-50"
      : variant === "info"
        ? "border-kc-cyan/30 bg-kc-bg-soft/95 text-kc-text"
        : "border-emerald-300/30 bg-kc-bg-soft/95 text-kc-text";
  return (
    <div role="status" aria-live="polite" className={`fixed right-4 top-20 z-[70] rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl shadow-black/30 ${tone}`}>
      {message}
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-[80] mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-kc-bg-soft px-2.5 py-1.5 text-xs font-bold text-kc-text opacity-0 shadow-xl shadow-black/30 transition group-hover:block group-hover:opacity-100 group-focus-within:block group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  title = "Confirmar accion",
  description = "Esta accion no se puede deshacer.",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default",
  loading = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onCancel, open]);

  if (!open) return null;
  const confirmClass = variant === "danger" ? "bg-rose-700 text-white hover:bg-rose-800" : "bg-kc-cyan text-white hover:bg-kc-electric";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button type="button" aria-label="Cancelar" className="absolute inset-0 cursor-pointer" onClick={loading ? undefined : onCancel} />
      <div className="kc-admin-card kc-modal-viewport relative w-full max-w-md p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="confirm-title" className="font-display text-2xl font-black text-kc-text">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-kc-muted">{description}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-kc-muted transition hover:text-kc-text disabled:cursor-not-allowed disabled:opacity-50" aria-label="Cancelar">
            <X size={17} />
          </button>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-black text-kc-text transition hover:border-kc-cyan/35 disabled:cursor-not-allowed disabled:opacity-50">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
