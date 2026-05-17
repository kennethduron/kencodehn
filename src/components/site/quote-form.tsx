"use client";

import { FormEvent, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { site, type Locale } from "@/lib/site";

type QuoteFormProps = {
  locale?: Locale;
};

export function QuoteForm({ locale = "es" }: QuoteFormProps) {
  const [form, setForm] = useState({
    name: "",
    business: "",
    project: locale === "es" ? "Pagina de aterrizaje" : "Landing Page",
    budget: "",
    message: "",
  });

  const text = {
    es: {
      aria: "Formulario de cotizacion",
      name: "Nombre",
      namePlaceholder: "Tu nombre",
      business: "Negocio",
      businessPlaceholder: "Nombre de tu negocio",
      project: "Proyecto",
      budget: "Presupuesto",
      details: "Detalles del proyecto",
      detailsPlaceholder: "Cuentame que necesitas, que vendes y cuando quieres lanzar.",
      submit: "Enviar por WhatsApp",
      note: "Este formulario publico no muestra datos privados. Solo prepara tu mensaje para enviarlo por WhatsApp.",
      redesign: "Rediseno web",
      message: [
        "Hola Ken Code. Quiero cotizar un proyecto web profesional. Podemos trabajar de forma remota.",
        `Nombre: ${form.name || "Por completar"}`,
        `Negocio: ${form.business || "Por completar"}`,
        `Tipo de proyecto: ${form.project}`,
        `Presupuesto estimado: ${form.budget || "Por definir"}`,
        `Detalles: ${form.message || "Por completar"}`,
        "Me gustaria recibir una propuesta y proximos pasos.",
      ].join("\n"),
    },
    en: {
      aria: "Quote form",
      name: "Name",
      namePlaceholder: "Your name",
      business: "Business",
      businessPlaceholder: "Your business name",
      project: "Project",
      budget: "Budget",
      details: "Project details",
      detailsPlaceholder: "Tell me what you need, what you sell and when you want to launch.",
      submit: "Send by WhatsApp",
      note: "This public form does not show private data. It only prepares your message to send it through WhatsApp.",
      redesign: "Website redesign",
      message: [
        "Hello Ken Code. I want to quote a professional web project. We can work remotely.",
        `Name: ${form.name || "Pending"}`,
        `Business: ${form.business || "Pending"}`,
        `Project type: ${form.project}`,
        `Estimated budget: ${form.budget || "To define"}`,
        `Details: ${form.message || "Pending"}`,
        "I would like to receive a proposal and next steps.",
      ].join("\n"),
    },
  }[locale];

  const whatsappHref = useMemo(() => {
    return `https://wa.me/${site.phoneRaw}?text=${encodeURIComponent(text.message)}`;
  }, [text.message]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.open(whatsappHref, "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={handleSubmit} className="kc-card rounded-2xl p-5 sm:p-6" aria-label={text.aria}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-kc-text">
          {text.name}
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
            placeholder={text.namePlaceholder}
            autoComplete="name"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-kc-text">
          {text.business}
          <input
            value={form.business}
            onChange={(event) => updateField("business", event.target.value)}
            className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
            placeholder={text.businessPlaceholder}
            autoComplete="organization"
            required
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-kc-text">
          {text.project}
          <select
            value={form.project}
            onChange={(event) => updateField("project", event.target.value)}
            className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text"
          >
            <option>{locale === "es" ? "Pagina de aterrizaje" : "Landing Page"}</option>
            <option>{locale === "es" ? "Web para negocios" : "Web Business"}</option>
            <option>Web Pro + Panel</option>
            <option>{locale === "es" ? "Tienda en linea" : "E-commerce"}</option>
            <option>{text.redesign}</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-kc-text">
          {text.budget}
          <input
            value={form.budget}
            onChange={(event) => updateField("budget", event.target.value)}
            className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
            placeholder={locale === "es" ? "Ej. USD 500 - USD 1,500" : "Ex. USD 500 - USD 1,500"}
            inputMode="text"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm font-bold text-kc-text">
        {text.details}
        <textarea
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          className="min-h-36 resize-y rounded-lg border border-kc-border bg-kc-bg/75 px-4 py-3 text-base font-medium leading-7 text-kc-text placeholder:text-kc-muted/70"
          placeholder={text.detailsPlaceholder}
          required
        />
      </label>

      <button
        type="submit"
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-kc-electric px-5 py-3 text-sm font-black text-white shadow-[0_0_34px_rgba(0,109,255,0.34)] transition hover:bg-kc-cyan hover:text-kc-bg"
      >
        {text.submit}
        <Send size={18} aria-hidden="true" />
      </button>
      <p className="mt-4 text-xs leading-6 text-kc-muted">{text.note}</p>
    </form>
  );
}
