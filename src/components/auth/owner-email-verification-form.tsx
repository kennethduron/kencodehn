"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, MailCheck, RotateCw, ShieldCheck } from "lucide-react";
import { normalizeOwnerEmailOtp, OWNER_EMAIL_OTP_COOLDOWN_SECONDS, OWNER_EMAIL_OTP_MAX_LENGTH } from "@/lib/auth/owner-email-verification";

type ApiResult = { ok?: boolean; verified?: boolean; message?: string; cooldownSeconds?: number };

export function OwnerEmailVerificationForm() {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(OWNER_EMAIL_OTP_COOLDOWN_SECONDS);
  const [status, setStatus] = useState<"idle" | "verifying" | "resending" | "verified">("idle");
  const [message, setMessage] = useState("El código es temporal y solo puede utilizarse una vez.");
  const busy = status === "verifying" || status === "resending";

  useEffect(() => {
    if (cooldown <= 0 || status === "verified") return;
    const timer = window.setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown, status]);

  async function callApi(payload: Record<string, unknown>) {
    const response = await fetch("/api/auth/owner-email-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({})) as ApiResult;
    return { response, result };
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || status === "verified") return;
    if (code.length < 6) {
      setMessage("Ingrese el código completo.");
      return;
    }
    setStatus("verifying");
    setMessage("Verificando de forma segura…");
    try {
      const { response, result } = await callApi({ action: "verify", code });
      if (!response.ok || !result.verified) {
        setStatus("idle");
        setMessage(result.message ?? "No pudimos verificar el código.");
        return;
      }
      setStatus("verified");
      setCode("");
      setMessage("Su correo fue verificado correctamente.");
    } catch {
      setStatus("idle");
      setMessage("No pudimos conectar con el servicio. Intente nuevamente.");
    }
  }

  async function resend() {
    if (busy || status === "verified" || cooldown > 0) return;
    setStatus("resending");
    setMessage("Solicitando un nuevo código…");
    try {
      const { response, result } = await callApi({ action: "request" });
      setStatus("idle");
      if (!response.ok || !result.ok) {
        if (response.status === 429) setCooldown(OWNER_EMAIL_OTP_COOLDOWN_SECONDS);
        setMessage(result.message ?? "No pudimos reenviar el código.");
        return;
      }
      setCode("");
      setCooldown(result.cooldownSeconds ?? OWNER_EMAIL_OTP_COOLDOWN_SECONDS);
      setMessage("Enviamos un código nuevo. El anterior dejó de ser válido.");
    } catch {
      setStatus("idle");
      setMessage("No pudimos conectar con el servicio. Intente nuevamente.");
    }
  }

  return (
    <main className="kc-admin-theme relative flex min-h-screen items-center justify-start overflow-hidden bg-kc-bg px-4 py-10 sm:justify-center sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-kc-electric/20 blur-3xl" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-kc-bg-soft p-5 shadow-[0_24px_70px_rgba(15,35,63,0.14)] sm:p-8" aria-labelledby="verification-title">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-kc-cyan/25 bg-kc-cyan/10 px-4 text-sm font-bold text-kc-cyan"><ShieldCheck aria-hidden="true" size={18} /> Ken Code</div>
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-kc-turquoise/10 text-kc-turquoise" aria-hidden="true"><MailCheck size={24} /></div>
        </div>
        {status === "verified" ? (
          <div className="py-10 text-center" role="status" aria-live="polite">
            <CheckCircle2 className="mx-auto text-kc-turquoise" size={52} aria-hidden="true" />
            <h1 id="verification-title" className="mt-5 font-display text-3xl font-black text-kc-text">Correo verificado</h1>
            <p className="mt-3 text-sm leading-6 text-kc-muted">La identidad del Owner quedó confirmada mediante el código enviado a su correo.</p>
          </div>
        ) : (
          <>
            <h1 id="verification-title" className="mt-7 font-display text-3xl font-black tracking-tight text-kc-text sm:text-4xl">Verifique su correo</h1>
            <p className="mt-3 text-sm leading-6 text-kc-muted sm:text-base">Hemos enviado un código temporal a su dirección de correo.</p>
            <form className="mt-7" onSubmit={verify} noValidate>
              <label htmlFor="owner-email-code" className="block text-sm font-bold text-kc-text">Código de verificación</label>
              <div className="relative mt-2">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-kc-muted" size={20} aria-hidden="true" />
                <input id="owner-email-code" name="one-time-code" type="text" inputMode="numeric" autoComplete="one-time-code" enterKeyHint="done" pattern="[0-9]*" maxLength={OWNER_EMAIL_OTP_MAX_LENGTH} value={code} onChange={(event) => setCode(normalizeOwnerEmailOtp(event.target.value))} onPaste={(event) => { event.preventDefault(); setCode(normalizeOwnerEmailOtp(event.clipboardData.getData("text"))); }} aria-describedby="owner-email-code-help owner-email-code-status" aria-invalid={message.includes("no es válido") || message.includes("vencido")} className="h-16 w-full rounded-2xl border border-white/15 bg-white/[0.04] pl-12 pr-4 text-center font-mono text-2xl font-black tracking-[0.28em] text-kc-text caret-kc-cyan transition placeholder:text-slate-700 focus:border-kc-cyan sm:text-3xl" placeholder="••••••••" disabled={busy} />
              </div>
              <p id="owner-email-code-help" className="mt-2 text-xs leading-5 text-kc-muted">Puede escribir o pegar el código completo. Nunca lo comparta con otra persona.</p>
              <button type="submit" disabled={busy || code.length < 6} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-kc-electric to-kc-cyan px-5 text-sm font-black text-white shadow-lg shadow-kc-electric/20 transition hover:brightness-110 disabled:opacity-50">
                {status === "verifying" ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />} Verificar correo
              </button>
            </form>
            <div className="mt-4 flex flex-col items-center gap-3 border-t border-white/10 pt-5">
              <button type="button" onClick={resend} disabled={busy || cooldown > 0} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold text-kc-text transition hover:border-kc-cyan/50 hover:text-kc-cyan disabled:opacity-50">
                {status === "resending" ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <RotateCw size={17} aria-hidden="true" />} {cooldown > 0 ? `Reenviar código en ${cooldown}s` : "Reenviar código"}
              </button>
              <p id="owner-email-code-status" role="status" aria-live="polite" className="min-h-10 text-center text-xs leading-5 text-kc-muted">{message}</p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
