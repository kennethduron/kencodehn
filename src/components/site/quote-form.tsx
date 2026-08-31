"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, X, XCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/site";

type QuoteFormProps = {
  locale?: Locale;
};

type SubmitState = "idle" | "submitting" | "success" | "error";
type FormErrors = Partial<Record<"name" | "email" | "phone" | "project" | "message", string>>;
type LeadResponse = { ok?: boolean; persisted?: boolean; message?: string; fieldErrors?: FormErrors };

function newSubmissionId() {
  return crypto.randomUUID();
}

export function QuoteForm({ locale = "es" }: QuoteFormProps) {
  const pathname = usePathname();
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [feedback, setFeedback] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const submittingRef = useRef(false);
  const submissionIdRef = useRef("");
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({
    name: "",
    business: "",
    email: "",
    phone: "",
    project: locale === "es" ? "Página de aterrizaje" : "Landing Page",
    message: "",
  });

  const text = {
    es: {
      aria: "Formulario de cotización",
      name: "Nombre",
      namePlaceholder: "Tu nombre",
      business: "Negocio",
      businessPlaceholder: "Nombre de tu negocio",
      email: "Correo",
      emailPlaceholder: "tu@email.com",
      phone: "Teléfono o WhatsApp",
      phonePlaceholder: "+504 0000-0000",
      project: "Proyecto",
      details: "Detalles del proyecto",
      detailsPlaceholder: "Cuéntame qué necesitas, qué procesos quieres controlar y cuándo quieres lanzar.",
      submit: "Enviar solicitud",
      submitting: "Enviando solicitud",
      note: "Tu solicitud quedará registrada para seguimiento interno. WhatsApp sigue disponible para contacto directo.",
      success: "Hemos recibido tu solicitud. Nuestro equipo revisará la información y se pondrá en contacto contigo.",
      error: "No pudimos enviar la solicitud en este momento. Intenta nuevamente o usa WhatsApp directo.",
      invalidEmail: "Ingresa un correo válido.",
      requiredEmail: "Ingresa tu correo para recibir la confirmación.",
      invalidPhone: "Ingresa un número de WhatsApp válido.",
      requiredName: "Ingresa tu nombre.",
      requiredPhone: "Ingresa tu teléfono o WhatsApp.",
      requiredProject: "Selecciona el tipo de proyecto.",
      requiredMessage: "Cuéntame brevemente qué necesitas.",
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
      detailsPlaceholder: "Tell me what you need, which processes you want to manage and when you want to launch.",
      submit: "Send request",
      submitting: "Sending request",
      note: "Your request will be registered for internal follow-up. WhatsApp remains available for direct contact.",
      success: "We have received your request. Our team will review the information and contact you.",
      error: "We could not send the request right now. Please try again or use direct WhatsApp.",
      invalidEmail: "Enter a valid email.",
      requiredEmail: "Enter your email to receive confirmation.",
      invalidPhone: "Enter a valid WhatsApp number.",
      requiredName: "Enter your name.",
      requiredPhone: "Enter your phone or WhatsApp.",
      requiredProject: "Select the project type.",
      requiredMessage: "Briefly tell me what you need.",
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
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateForm() {
    const nextErrors: FormErrors = {};
    const email = form.email.trim();
    const phoneDigits = form.phone.replace(/[^\d]/g, "");

    if (form.name.trim().length < 2) nextErrors.name = text.requiredName;
    if (!email) nextErrors.email = text.requiredEmail;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = text.invalidEmail;
    if (phoneDigits.length < 8) nextErrors.phone = form.phone.trim() ? text.invalidPhone : text.requiredPhone;
    if (!form.project.trim()) nextErrors.project = text.requiredProject;
    if (form.message.trim().length < 3) nextErrors.message = text.requiredMessage;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const website = String(new FormData(event.currentTarget).get("website") || "");
    setSubmitState("submitting");
    setFeedback("");
    if (!validateForm()) {
      setSubmitState("idle");
      window.requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    submittingRef.current = true;
    submissionIdRef.current ||= newSubmissionId();

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
          submissionId: submissionIdRef.current,
          website,
        }),
      });

      const result = (await response.json().catch(() => null)) as LeadResponse | null;

      if (!response.ok || !result?.ok || result.persisted !== true) {
        if (response.status === 400 && result?.fieldErrors) {
          setErrors(result.fieldErrors);
          setSubmitState("error");
          setFeedback(result.message || text.error);
          return;
        }
        throw new Error("Lead request failed");
      }

      setSubmitState("success");
      setFeedback(text.success);
      submissionIdRef.current = newSubmissionId();
      setForm({
        name: "",
        business: "",
        email: "",
        phone: "",
        project: locale === "es" ? "Página de aterrizaje" : "Landing Page",
        message: "",
      });
    } catch (error) {
      setSubmitState("error");
      setFeedback(error instanceof Error && error.message !== "Lead request failed" ? error.message : text.error);
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="kc-card min-w-0 max-w-full rounded-2xl p-5 sm:p-6" aria-label={text.aria}>
        <input name="website" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-kc-text">
            {text.name}
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="min-h-12 w-full min-w-0 max-w-full rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
              placeholder={text.namePlaceholder}
              autoComplete="name"
              maxLength={120}
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "quote-name-error" : undefined}
            />
            {errors.name ? <span id="quote-name-error" className="text-xs font-bold text-red-300">{errors.name}</span> : null}
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-kc-text">
            {text.business}
            <input
              value={form.business}
              onChange={(event) => updateField("business", event.target.value)}
              className="min-h-12 w-full min-w-0 max-w-full rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
              placeholder={text.businessPlaceholder}
              autoComplete="organization"
              maxLength={160}
            />
          </label>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-kc-text">
            {text.email}
            <input
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="min-h-12 w-full min-w-0 max-w-full rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
              placeholder={text.emailPlaceholder}
              autoComplete="email"
              type="email"
              maxLength={180}
              required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "quote-email-error" : undefined}
            />
            {errors.email ? <span id="quote-email-error" className="text-xs font-bold text-red-300">{errors.email}</span> : null}
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-kc-text">
            {text.phone}
            <input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="min-h-12 w-full min-w-0 max-w-full rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text placeholder:text-kc-muted/70"
              placeholder={text.phonePlaceholder}
              autoComplete="tel"
              type="tel"
              maxLength={40}
              required
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "quote-phone-error" : undefined}
            />
            {errors.phone ? <span id="quote-phone-error" className="text-xs font-bold text-red-300">{errors.phone}</span> : null}
          </label>
        </div>

        <div className="mt-4">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-kc-text">
            {text.project}
            <select
              value={form.project}
              onChange={(event) => updateField("project", event.target.value)}
              className="min-h-12 w-full min-w-0 max-w-full rounded-lg border border-kc-border bg-kc-bg/75 px-4 text-base font-medium text-kc-text"
              aria-invalid={Boolean(errors.project)}
              aria-describedby={errors.project ? "quote-project-error" : undefined}
            >
              <option>{locale === "es" ? "Página de aterrizaje" : "Landing Page"}</option>
              <option>{locale === "es" ? "Web para negocios" : "Web Business"}</option>
              <option>Web Pro + Panel</option>
              <option>{locale === "es" ? "Sistema administrativo, contable o de facturación" : "Administrative, accounting or invoicing system"}</option>
              <option>{locale === "es" ? "Tienda en línea" : "E-commerce"}</option>
            </select>
            {errors.project ? <span id="quote-project-error" className="text-xs font-bold text-red-300">{errors.project}</span> : null}
          </label>
        </div>

        <label className="mt-4 grid min-w-0 gap-2 text-sm font-bold text-kc-text">
          {text.details}
          <textarea
            value={form.message}
            onChange={(event) => updateField("message", event.target.value)}
            className="min-h-36 w-full min-w-0 max-w-full resize-y rounded-lg border border-kc-border bg-kc-bg/75 px-4 py-3 text-base font-medium leading-7 text-kc-text placeholder:text-kc-muted/70"
            placeholder={text.detailsPlaceholder}
            maxLength={2000}
            required
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? "quote-message-error" : undefined}
          />
          {errors.message ? <span id="quote-message-error" className="text-xs font-bold text-red-300">{errors.message}</span> : null}
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
            <p className="min-w-0 flex-1 text-sm font-semibold leading-6">{feedback}</p>
            <button type="button" onClick={() => { setFeedback(""); setSubmitState("idle"); }} aria-label={locale === "es" ? "Cerrar mensaje" : "Close message"} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-kc-muted transition hover:bg-white/10 hover:text-kc-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-kc-cyan">
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
