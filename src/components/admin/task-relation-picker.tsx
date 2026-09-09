"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TaskRelationOption = {
  type: "client" | "lead";
  id: string;
  label: string;
  detail?: string;
};

type DropdownPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

export function TaskRelationPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: TaskRelationOption | null;
  onChange: (value: TaskRelationOption | null) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedKey = value ? `${value.type}:${value.id}:${value.label}` : "";
  const previousSelectedKey = useRef(selectedKey);
  const [query, setQuery] = useState(value?.label || "");
  const [results, setResults] = useState<TaskRelationOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

  function close() {
    setOpen(false);
    setActiveIndex(-1);
    setLoading(false);
  }

  function select(option: TaskRelationOption | null) {
    previousSelectedKey.current = option ? `${option.type}:${option.id}:${option.label}` : "";
    onChange(option);
    setQuery(option?.label || "");
    close();
  }

  useEffect(() => {
    if (previousSelectedKey.current === selectedKey) return;
    previousSelectedKey.current = selectedKey;
    setQuery(value?.label || "");
    close();
  }, [selectedKey, value?.label]);

  useEffect(() => {
    if (!open) return;
    const isInside = (target: EventTarget | null) =>
      target instanceof Node && (
        rootRef.current?.contains(target) || listRef.current?.contains(target)
      );
    const handlePointerDown = (event: PointerEvent) => {
      if (isInside(event.target)) return;
      close();
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (isInside(event.target)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      inputRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled]);

  useEffect(() => {
    if (!open) {
      setDropdownPosition(null);
      return;
    }
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const width = Math.min(rect.width, viewportWidth - 16);
      const left = Math.min(Math.max(8, rect.left), viewportWidth - width - 8);
      const availableBelow = viewportHeight - rect.bottom - 12;
      setDropdownPosition({
        left,
        top: rect.bottom + 6,
        width,
        maxHeight: Math.max(96, Math.min(288, viewportHeight * 0.42, availableBelow)),
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setResults([]);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/task-relations?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (response.ok && body.ok) setResults(body.results || []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <label className="grid gap-2 text-sm font-bold text-kc-muted">
        Relacionado con
        <span className="relative block min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kc-muted" size={16} />
          <input
            ref={inputRef}
            value={query}
            disabled={disabled}
            role="combobox"
            aria-controls={listId}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            placeholder="Buscar cliente o prospecto"
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              if (value) {
                previousSelectedKey.current = "";
                onChange(null);
              }
              setOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={(event) => {
              const optionCount = results.length + 1;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((current) => current < 0 ? 0 : (current + 1) % optionCount);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((current) => current <= 0 ? optionCount - 1 : current - 1);
              } else if (event.key === "Enter" && open && activeIndex >= 0) {
                event.preventDefault();
                select(activeIndex === 0 ? null : results[activeIndex - 1]);
              }
            }}
            className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-kc-bg py-2 pl-10 pr-10 text-sm text-kc-text outline-none focus:border-kc-cyan"
          />
          {query ? (
            <button
              type="button"
              aria-label="Quitar relación"
              onClick={() => { previousSelectedKey.current = ""; setQuery(""); onChange(null); setOpen(true); setActiveIndex(-1); inputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-kc-muted outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-kc-cyan"
            >
              <X size={15} />
            </button>
          ) : null}
        </span>
      </label>
      {open && dropdownPosition ? createPortal(
        <div ref={listRef} id={listId} role="listbox" aria-label="Clientes y prospectos" style={{ ...dropdownPosition, backgroundColor: "var(--kc-admin-surface)" }} className="kc-admin-theme fixed z-[70] min-w-0 max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-slate-200 p-1.5 shadow-2xl shadow-slate-900/20">
          <button id={`${listId}-option-0`} type="button" role="option" aria-selected={!value} onClick={() => select(null)} className="flex min-h-11 w-full min-w-0 items-center rounded-lg px-2.5 py-1.5 text-left text-sm font-bold text-kc-muted outline-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kc-cyan">
            Sin relación
          </button>
          <div className="mx-2 border-t border-slate-200" aria-hidden="true" />
          {results.map((item, index) => (
            <button id={`${listId}-option-${index + 1}`} key={`${item.type}:${item.id}`} type="button" role="option" aria-selected={value?.type === item.type && value.id === item.id} onClick={() => select(item)} className="grid min-h-[3.75rem] w-full min-w-0 content-center gap-0.5 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kc-cyan">
              <span className="w-fit rounded-full border border-kc-cyan/20 bg-kc-cyan/5 px-1.5 py-0.5 text-[.6rem] font-black uppercase leading-none tracking-[.12em] text-kc-cyan">{item.type === "client" ? "Cliente" : "Prospecto"}</span>
              <span className="block min-w-0 truncate text-sm font-black leading-5 text-kc-text">{item.label}</span>
              {item.detail ? <span className="block min-w-0 truncate text-xs leading-4 text-kc-muted">{item.detail}</span> : null}
            </button>
          ))}
          {!loading && results.length === 0 ? <p className="px-2.5 py-3 text-sm text-kc-muted">No se encontraron clientes o prospectos.</p> : null}
          {loading ? <p className="px-2.5 py-3 text-sm text-kc-muted" role="status">Buscando…</p> : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
