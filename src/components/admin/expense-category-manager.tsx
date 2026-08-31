"use client";

import { Loader2, Plus, Tags, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExpenseCategory } from "@/lib/finance/types";

async function mutate(operation: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/finance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No se pudo actualizar la categoría.");
}

export function ExpenseCategoryManager({ categories }: { categories: ExpenseCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const data = new FormData(event.currentTarget);
    try {
      await mutate("category_create", {
        name: String(data.get("name") || ""),
        description: String(data.get("description") || ""),
        sortOrder: Number(data.get("sortOrder") || 100),
      });
      setMessage("Categoría creada.");
      router.refresh();
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la categoría.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: ExpenseCategory) {
    setSaving(true);
    try {
      await mutate("category_update", {
        id: item.id,
        name: item.name,
        description: item.description,
        active: !item.active,
        sortOrder: item.sortOrder,
      });
      setMessage(item.active ? "Categoría desactivada." : "Categoría activada.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la categoría.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="kc-admin-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Tags size={19} /></span>
          <div>
            <h2 className="font-black text-kc-text">Categorías de gasto</h2>
            <p className="text-sm text-kc-muted">{categories.filter((item) => item.active).length} activas · editables por Owner/Admin</p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-black text-blue-700">
          {open ? <X size={17} /> : <Plus size={17} />} {open ? "Cerrar" : "Administrar categorías"}
        </button>
      </div>
      {message ? <p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800">{message}</p> : null}
      {open ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((item) => (
              <article key={item.id} className="rounded-xl border bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div><strong className="text-sm text-kc-text">{item.name}</strong><p className="mt-1 text-xs leading-5 text-kc-muted">{item.description}</p></div>
                  <span className={`rounded-full px-2 py-1 text-[.68rem] font-black ${item.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{item.active ? "Activa" : "Inactiva"}</span>
                </div>
                <button type="button" disabled={saving} onClick={() => toggle(item)} className="mt-3 min-h-11 text-sm font-black text-blue-700 disabled:opacity-50">{item.active ? "Desactivar" : "Activar"}</button>
              </article>
            ))}
          </div>
          <form onSubmit={create} className="grid content-start gap-3 rounded-xl border bg-white p-4">
            <h3 className="font-black text-kc-text">Nueva categoría</h3>
            <label className="grid gap-1 text-sm font-bold text-kc-muted">Nombre<input name="name" required minLength={2} maxLength={80} className="min-h-11 rounded-xl border px-3" /></label>
            <label className="grid gap-1 text-sm font-bold text-kc-muted">Descripción<textarea name="description" rows={3} maxLength={500} className="rounded-xl border p-3" /></label>
            <label className="grid gap-1 text-sm font-bold text-kc-muted">Orden<input name="sortOrder" type="number" min={0} max={10000} defaultValue={100} className="min-h-11 rounded-xl border px-3" /></label>
            <button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />} Crear categoría</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
