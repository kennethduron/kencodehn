"use client";

import { FormEvent, useMemo, useState } from "react";
import { Send } from "lucide-react";

const phone = "50499112211";

export function QuoteForm() {
  const [form, setForm] = useState({
    name: "",
    business: "",
    project: "Landing Page",
    budget: "",
    message: "",
  });

  const whatsappHref = useMemo(() => {
    const message = [
      "Hola Ken Coding. Quiero cotizar un proyecto web profesional.",
      `Nombre: ${form.name || "Por completar"}`,
      `Negocio: ${form.business || "Por completar"}`,
      `Tipo de proyecto: ${form.project}`,
      `Presupuesto estimado: ${form.budget || "Por definir"}`,
      `Detalles: ${form.message || "Por completar"}`,
      "Me gustaria recibir una propuesta y próximos pasos.",
    ].join("\n");

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [form]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.open(whatsappHref, "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={handleSubmit} className="kc-card rounded-2xl p-5 sm:p-6" aria-label="Formulario de cotizacion">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-kc-text">
          Nombre
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
            placeholder="Tu nombre"
            autoComplete="name"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-kc-text">
          Negocio
          <input
            value={form.business}
            onChange={(event) => updateField("business", event.target.value)}
            className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
            placeholder="Nombre de tu negocio"
            autoComplete="organization"
            required
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-kc-text">
          Proyecto
          <select
            value={form.project}
            onChange={(event) => updateField("project", event.target.value)}
            className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text"
          >
            <option>Landing Page</option>
            <option>Web Business</option>
            <option>Web Pro + CRM</option>
            <option>E-commerce</option>
            <option>Rediseño web</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-kc-text">
          Presupuesto
          <input
            value={form.budget}
            onChange={(event) => updateField("budget", event.target.value)}
            className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
            placeholder="Ej. L 8,000 - L 15,000"
            inputMode="text"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm font-bold text-kc-text">
        Detalles del proyecto
        <textarea
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          className="min-h-36 resize-y rounded-lg border border-kc-border bg-kc-bg/75 px-4 py-3 text-base font-medium leading-7 text-kc-text placeholder:text-kc-muted/70"
          placeholder="Cuéntame qué necesitas, qué vendes y cuándo quieres lanzar."
          required
        />
      </label>

      <button
        type="submit"
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-kc-electric px-5 py-3 text-sm font-black text-white shadow-[0_0_34px_rgba(0,109,255,0.34)] transition hover:bg-kc-cyan hover:text-kc-bg"
      >
        Enviar por WhatsApp
        <Send size={18} aria-hidden="true" />
      </button>
      <p className="mt-4 text-xs leading-6 text-kc-muted">
        Este formulario publico no muestra datos del CRM. Solo prepara tu mensaje para enviarlo por WhatsApp.
      </p>
    </form>
  );
}
