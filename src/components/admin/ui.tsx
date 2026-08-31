"use client";

import { Loader2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

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

export function Tooltip({
  label,
  children,
  placement = "top",
}: {
  label: string;
  children: React.ReactNode;
  placement?: "top" | "right" | "bottom" | "left";
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; side: "top" | "right" | "bottom" | "left" } | null>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const triggerElement = triggerRef.current;
    const tooltipElement = tooltipRef.current;
    if (!triggerElement || !tooltipElement) return;
    const trigger = triggerElement.getBoundingClientRect();
    const tooltip = tooltipElement.getBoundingClientRect();

    const gap = 8;
    const padding = 12;
    const opposite = { top: "bottom", right: "left", bottom: "top", left: "right" } as const;
    const candidates = [placement, opposite[placement], "right", "left", "bottom", "top"]
      .filter((side, index, values) => values.indexOf(side) === index) as Array<"top" | "right" | "bottom" | "left">;

    function coordinates(side: "top" | "right" | "bottom" | "left") {
      if (side === "top") return { left: trigger.left + (trigger.width - tooltip.width) / 2, top: trigger.top - tooltip.height - gap };
      if (side === "bottom") return { left: trigger.left + (trigger.width - tooltip.width) / 2, top: trigger.bottom + gap };
      if (side === "left") return { left: trigger.left - tooltip.width - gap, top: trigger.top + (trigger.height - tooltip.height) / 2 };
      return { left: trigger.right + gap, top: trigger.top + (trigger.height - tooltip.height) / 2 };
    }

    const fits = (point: { left: number; top: number }) =>
      point.left >= padding &&
      point.top >= padding &&
      point.left + tooltip.width <= window.innerWidth - padding &&
      point.top + tooltip.height <= window.innerHeight - padding;
    const side = candidates.find((candidate) => fits(coordinates(candidate))) ?? placement;
    const point = coordinates(side);
    setPosition({
      side,
      left: Math.min(Math.max(point.left, padding), Math.max(padding, window.innerWidth - tooltip.width - padding)),
      top: Math.min(Math.max(point.top, padding), Math.max(padding, window.innerHeight - tooltip.height - padding)),
    });
  }, [placement]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {children}
      {mounted && open
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              data-placement={position?.side ?? placement}
              className="pointer-events-none fixed z-[120] max-w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-white/10 bg-kc-bg-soft px-2.5 py-1.5 text-center text-xs font-bold leading-5 text-kc-text shadow-xl shadow-black/30"
              style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
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
  title = "Confirmar acción",
  description = "Esta acción no se puede deshacer.",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default",
  loading = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
      if (event.key === "Tab") {
        const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') ?? []);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [loading, onCancel, open]);

  if (!open) return null;
  const confirmClass = variant === "danger" ? "bg-rose-700 text-white hover:bg-rose-800" : "bg-kc-cyan text-white hover:bg-kc-electric";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button type="button" aria-label="Cancelar" className="absolute inset-0 cursor-pointer" onClick={loading ? undefined : onCancel} />
      <div ref={panelRef} className="kc-admin-card kc-modal-viewport relative w-full max-w-md p-5">
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
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={loading} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
