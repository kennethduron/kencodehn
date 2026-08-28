"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/admin/recovery`;
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    setMessage("Si la cuenta existe, recibirá un enlace seguro para continuar.");
    setBusy(false);
  }
  return <form onSubmit={submit} className="grid gap-4">
    <label htmlFor="recovery-email" className="grid gap-2 text-sm font-bold text-kc-text">Correo
      <input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text outline-none focus:border-kc-cyan" />
    </label>
    {message ? <p role="status" className="rounded-xl border border-kc-lime/25 bg-kc-lime/10 p-3 text-sm text-kc-text">{message}</p> : null}
    <button disabled={busy} className="min-h-12 rounded-xl bg-kc-electric px-5 text-sm font-black text-white disabled:opacity-50">{busy ? "Solicitando…" : "Enviar enlace seguro"}</button>
  </form>;
}
