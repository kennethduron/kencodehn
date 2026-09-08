"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

export type TaskRelationOption = {
  type: "client" | "lead";
  id: string;
  label: string;
  detail?: string;
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
  const [query, setQuery] = useState(value?.label || "");
  const [results, setResults] = useState<TaskRelationOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value && query === value.label) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
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
  }, [query, value]);

  return (
    <div className="relative min-w-0">
      <label className="grid gap-2 text-sm font-bold text-kc-muted">
        Relacionado con
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kc-muted" size={16} />
          <input
            value={query}
            disabled={disabled}
            role="combobox"
            aria-controls={listId}
            aria-expanded={open}
            aria-autocomplete="list"
            placeholder="Buscar cliente o prospecto"
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              if (value) onChange(null);
              setOpen(true);
            }}
            className="min-h-12 w-full rounded-xl border border-white/10 bg-kc-bg py-2 pl-10 pr-10 text-sm text-kc-text outline-none focus:border-kc-cyan"
          />
          {query ? (
            <button
              type="button"
              aria-label="Quitar relación"
              onClick={() => { setQuery(""); onChange(null); setOpen(true); }}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-kc-muted"
            >
              <X size={15} />
            </button>
          ) : null}
        </span>
      </label>
      {open ? (
        <div id={listId} role="listbox" className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-kc-bg-soft p-2 shadow-2xl">
          <button type="button" role="option" aria-selected={!value} onClick={() => { onChange(null); setQuery(""); setOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-kc-muted hover:bg-white/[0.06]">
            Sin relación
          </button>
          {results.map((item) => (
            <button key={`${item.type}:${item.id}`} type="button" role="option" aria-selected={value?.type === item.type && value.id === item.id} onClick={() => { onChange(item); setQuery(item.label); setOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]">
              <span className="block text-[.68rem] font-black uppercase tracking-[.14em] text-kc-cyan">{item.type === "client" ? "Cliente" : "Prospecto"}</span>
              <span className="mt-1 block text-sm font-black text-kc-text">{item.label}</span>
              {item.detail ? <span className="mt-0.5 block truncate text-xs text-kc-muted">{item.detail}</span> : null}
            </button>
          ))}
          {!loading && results.length === 0 ? <p className="px-3 py-4 text-sm text-kc-muted">No hay coincidencias en su alcance.</p> : null}
          {loading ? <p className="px-3 py-4 text-sm text-kc-muted">Buscando…</p> : null}
        </div>
      ) : null}
    </div>
  );
}
