"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [requestFailed, setRequestFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setRequestFailed(false);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/admin/recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    setRequestFailed(Boolean(error && error.status !== 429));
    setMessage(error && error.status !== 429
      ? "No pudimos procesar la solicitud. Inténtelo nuevamente."
      : error
        ? "Espere un minuto antes de solicitar otro enlace."
        : "Si existe una cuenta asociada a ese correo, recibirá instrucciones para restablecer su contraseña.");
    setBusy(false);
  }
  return <form onSubmit={submit} className="grid gap-4">
    <label htmlFor="recovery-email" className="grid gap-2 text-sm font-bold text-kc-text">Correo
      <input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text outline-none focus:border-kc-cyan" />
    </label>
    {message ? <p role={requestFailed ? "alert" : "status"} className={`rounded-xl border p-3 text-sm font-semibold ${requestFailed ? "border-rose-300/40 bg-rose-50 text-rose-800" : "border-emerald-300/40 bg-emerald-50 text-emerald-900"}`}>{message}</p> : null}
    <button disabled={busy} className="min-h-12 rounded-xl bg-kc-electric px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Solicitando…" : "Enviar enlace seguro"}</button>
  </form>;
}
