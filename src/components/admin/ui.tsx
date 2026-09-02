"use client";

import { Loader2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

export type ToastVariant = "success" | "info" | "warning" | "error";

export const TOAST_DURATIONS: Record<ToastVariant, number> = {
  success: 3000,
  info: 3000,
  warning: 4500,
  error: 8000,
};

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  closing: boolean;
  sources: string[];
  pathname: string;
};

let toastSequence = 0;
let toastItems: ToastItem[] = [];
const EMPTY_TOASTS: ToastItem[] = [];
const toastListeners = new Set<() => void>();

function emitToastStore() {
  toastListeners.forEach((listener) => listener());
}

function subscribeToastStore(listener: () => void) {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

function getToastSnapshot() {
  return toastItems;
}

function publishToast(source: string, message: string, variant: ToastVariant) {
  const normalized = message.trim();
  if (!normalized) return;
  const now = Date.now();
  const pathname = window.location.pathname;
  const duplicate = toastItems.find((item) => item.pathname === pathname && item.message === normalized && item.variant === variant);
  if (duplicate) {
    toastItems = toastItems.map((item) => item.id === duplicate.id
      ? { ...item, sources: item.sources.includes(source) ? item.sources : [...item.sources, source], createdAt: now, closing: false }
      : item);
    emitToastStore();
    return;
  }
  toastItems = toastItems
    .map((item) => ({ ...item, sources: item.sources.filter((candidate) => candidate !== source) }))
    .filter((item) => item.sources.length > 0);
  toastItems = [...toastItems, { id: ++toastSequence, message: normalized, variant, createdAt: now, closing: false, sources: [source], pathname }];
  emitToastStore();
}

function releaseToastSource(source: string) {
  toastItems = toastItems
    .map((item) => ({ ...item, sources: item.sources.filter((candidate) => candidate !== source) }))
    .filter((item) => item.sources.length > 0);
  emitToastStore();
}

function beginToastDismiss(id: number) {
  toastItems = toastItems.map((item) => item.id === id ? { ...item, closing: true } : item);
  emitToastStore();
}

function finishToastDismiss(id: number) {
  toastItems = toastItems.filter((item) => item.id !== id);
  emitToastStore();
}

function clearToastsOutsidePath(pathname: string) {
  const nextItems = toastItems.filter((item) => item.pathname === pathname);
  if (nextItems.length === toastItems.length) return;
  toastItems = nextItems;
  emitToastStore();
}

export function Toast({ message, variant = "success" }: { message: string; variant?: ToastVariant }) {
  const source = useId();
  useEffect(() => {
    if (message.trim()) publishToast(source, message, variant);
  }, [message, source, variant]);
  useEffect(() => () => releaseToastSource(source), [source]);
  return null;
}

export function ToastViewport() {
  const pathname = usePathname();
  const items = useSyncExternalStore(subscribeToastStore, getToastSnapshot, () => EMPTY_TOASTS);
  const visibleItems = items.filter((item) => item.pathname === pathname);

  useEffect(() => {
    clearToastsOutsidePath(pathname);
  }, [pathname]);

  useEffect(() => {
    const timers = visibleItems.map((item) => {
      if (item.closing) return window.setTimeout(() => finishToastDismiss(item.id), 180);
      const remaining = Math.max(0, TOAST_DURATIONS[item.variant] - (Date.now() - item.createdAt));
      return window.setTimeout(() => beginToastDismiss(item.id), remaining);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [visibleItems]);

  if (!visibleItems.length) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[calc(4.75rem+max(.75rem,env(safe-area-inset-bottom)))] z-[130] flex max-h-[calc(100dvh-7rem)] flex-col gap-2 overflow-y-auto sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[calc(4.5rem+env(safe-area-inset-top))] sm:w-[min(24rem,calc(100vw-2rem))]"
      aria-label="Mensajes de la aplicación"
    >
      {visibleItems.map((item) => {
        const tone = item.variant === "error"
          ? "border-rose-300 bg-rose-950 text-rose-50"
          : item.variant === "warning"
            ? "border-amber-300 bg-amber-950 text-amber-50"
            : item.variant === "info"
              ? "border-sky-300 bg-slate-950 text-sky-50"
              : "border-emerald-300 bg-slate-950 text-emerald-50";
        return (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            aria-live={item.variant === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            data-closing={item.closing}
            className={`pointer-events-none flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl shadow-black/25 transition duration-200 motion-reduce:transition-none data-[closing=true]:translate-y-2 data-[closing=true]:opacity-0 ${tone}`}
          >
            <span className="min-w-0 flex-1 break-words leading-5">{item.message}</span>
            <button
              type="button"
              onClick={() => beginToastDismiss(item.id)}
              className="pointer-events-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-current/20 text-current transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Cerrar mensaje"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
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
  const onCancelRef = useRef(onCancel);
  const loadingRef = useRef(loading);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pointerTriggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  if (open && !wasOpenRef.current && typeof document !== "undefined") {
    // Capture before the dialog commit: child autoFocus runs before effects and
    // would otherwise replace the real trigger as document.activeElement.
    const active = document.activeElement as HTMLElement | null;
    returnFocusRef.current = pointerTriggerRef.current ?? (active === document.body ? null : active);
  }
  wasOpenRef.current = open;
  useEffect(() => {
    if (open) return;
    function rememberPointerTrigger(event: Event) {
      pointerTriggerRef.current = (event.target as HTMLElement | null)?.closest<HTMLElement>("button, a[href]") ?? null;
    }
    document.addEventListener("pointerdown", rememberPointerTrigger, true);
    document.addEventListener("mousedown", rememberPointerTrigger, true);
    document.addEventListener("touchstart", rememberPointerTrigger, true);
    document.addEventListener("click", rememberPointerTrigger, true);
    return () => {
      document.removeEventListener("pointerdown", rememberPointerTrigger, true);
      document.removeEventListener("mousedown", rememberPointerTrigger, true);
      document.removeEventListener("touchstart", rememberPointerTrigger, true);
      document.removeEventListener("click", rememberPointerTrigger, true);
    };
  }, [open]);
  useEffect(() => {
    onCancelRef.current = onCancel;
    loadingRef.current = loading;
  }, [loading, onCancel]);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loadingRef.current) onCancelRef.current();
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
      returnFocusRef.current?.focus();
    };
  }, [open]);

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
