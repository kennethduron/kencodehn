"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/site";

type QuoteFormProps = {
  locale?: Locale;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function QuoteForm({ locale = "es" }: QuoteFormProps) {
  const pathname = usePathname();
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({
    name: "",
    business: "",
    email: "",
    phone: "",
    project: locale === "es" ? "Pagina de aterrizaje" : "Landing Page",
    message: "",
  });

  const text = {
    es: {
      aria: "Formulario de cotizacion",
      name: "Nombre",
      namePlaceholder: "Tu nombre",
      business: "Negocio",
      businessPlaceholder: "Nombre de tu negocio",
      email: "Correo",
      emailPlaceholder: "tu@email.com",
      phone: "Telefono o WhatsApp",
      phonePlaceholder: "+504 0000-0000",
      project: "Proyecto",
      details: "Detalles del proyecto",
      detailsPlaceholder: "Cuentame que necesitas, que vendes y cuando quieres lanzar.",
      submit: "Enviar solicitud",
      submitting: "Enviando solicitud",
      note: "Tu solicitud quedara registrada para seguimiento interno. WhatsApp sigue disponible para contacto directo.",
      redesign: "Rediseno web",
      success: "Hemos recibido tu solicitud correctamente. Muy pronto nos comunicaremos contigo.",
      error: "No pudimos enviar la solicitud en este momento. Intenta nuevamente o usa WhatsApp directo.",
    },
    en: {
      aria: "Quote form",
      name: "Name",
      namePlaceholder: "Your name",
      business: "Business",
      businessPlaceholder: "Your business name",
      email: "Email",
      emailPlaceholder: "you@email.com",
      phone: "Phone or WhatsApp",
      phonePlaceholder: "+1 000 000 0000",
      project: "Project",
      details: "Project details",
      detailsPlaceholder: "Tell me what you need, what you sell and when you want to launch.",
      submit: "Send request",
      submitting: "Sending request",
      note: "Your request will be registered for internal follow-up. WhatsApp remains available for direct contact.",
      redesign: "Website redesign",
      success: "We have received your request successfully. We will contact you very soon.",
      error: "We could not send the request right now. Please try again or use direct WhatsApp.",
    },
  }[locale];

  useEffect(() => {
    if (submitState !== "success") return;

    const timeout = window.setTimeout(() => {
      setSubmitState("idle");
      setFeedback("");
    }, 5200);

    return () => window.clearTimeout(timeout);
  }, [submitState]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("submitting");
    setFeedback("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          locale,
          sourcePath: pathname,
        }),
      });

      const result = (await response.json().catch(() => null)) as { ok?: boolean; persisted?: boolean; message?: string } | null;

      if (!response.ok || !result?.ok || result.persisted !== true) {
        throw new Error("Lead request failed");
      }

      setSubmitState("success");
      setFeedback(text.success);
      setForm({
        name: "",
        business: "",
        email: "",
        phone: "",
        project: locale === "es" ? "Pagina de aterrizaje" : "Landing Page",
        message: "",
      });
    } catch {
      setSubmitState("error");
      setFeedback(text.error);
    }
  }

  return (
    <>
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
            {text.email}
            <input
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
              placeholder={text.emailPlaceholder}
              autoComplete="email"
              type="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kc-text">
            {text.phone}
            <input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="min-h-12 rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
              placeholder={text.phonePlaceholder}
              autoComplete="tel"
              required
            />
          </label>
        </div>

        <div className="mt-4">
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
          disabled={submitState === "submitting"}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-kc-electric px-5 py-3 text-sm font-black text-white shadow-[0_0_34px_rgba(0,109,255,0.34)] transition hover:bg-kc-cyan hover:text-kc-bg disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitState === "submitting" ? text.submitting : text.submit}
          {submitState === "submitting" ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
        </button>
        <p className="mt-4 text-xs leading-6 text-kc-muted">{text.note}</p>
      </form>

      <div
        aria-live="polite"
        className={`fixed left-4 right-4 top-24 z-[60] mx-auto max-w-md transition duration-300 sm:left-auto sm:right-6 ${
          feedback ? "translate-y-0 opacity-100" : "-translate-y-3 pointer-events-none opacity-0"
        }`}
      >
        {feedback ? (
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
              submitState === "success"
                ? "border-kc-turquoise/40 bg-kc-bg-soft/95 text-kc-text"
                : "border-red-400/40 bg-kc-bg-soft/95 text-kc-text"
            }`}
          >
            {submitState === "success" ? (
              <CheckCircle2 className="mt-0.5 shrink-0 text-kc-turquoise" size={22} aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 shrink-0 text-red-300" size={22} aria-hidden="true" />
            )}
            <p className="text-sm font-semibold leading-6">{feedback}</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
