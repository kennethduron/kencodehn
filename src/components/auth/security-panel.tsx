"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PasswordField } from "./password-field";

export function SecurityPanel({ email }: { email: string }) {
  const [nonce, setNonce] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function requestVerification() {
    setBusy(true);
    const { error } = await createSupabaseBrowserClient().auth.reauthenticate();
    setMessage(error ? "No se pudo iniciar la verificación." : "Revise su correo e ingrese el código de verificación.");
    setVerificationSent(!error);
    setBusy(false);
  }
  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (!verificationSent || nonce.trim().length < 6) return setMessage("Primero complete la verificación por correo.");
    if (password.length < 12) return setMessage("Use al menos 12 caracteres.");
    if (password !== confirmation) return setMessage("Las contraseñas no coinciden.");
    setBusy(true);
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password, nonce: nonce.trim() });
    if (!error) await fetch("/api/admin/security/password-changed", { method: "POST" });
    setMessage(error ? "El código es inválido, expiró o ya fue utilizado." : "Contraseña actualizada de forma segura.");
    if (!error) { setNonce(""); setPassword(""); setConfirmation(""); setVerificationSent(false); }
    setBusy(false);
  }
  return <div className="grid gap-6">
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-kc-muted">Correo de la cuenta</p><p className="mt-2 break-all font-bold text-kc-text">{email}</p></div>
    <form onSubmit={updatePassword} className="grid max-w-xl gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div><h2 className="font-display text-xl font-black text-kc-text">Cambiar contraseña</h2><p className="mt-2 text-sm leading-6 text-kc-muted">Requiere un código de un solo uso enviado al correo de la cuenta.</p></div>
      <button type="button" onClick={requestVerification} disabled={busy} className="min-h-12 rounded-xl border border-kc-cyan/35 px-4 text-sm font-black text-kc-cyan disabled:opacity-50">Enviar verificación por correo</button>
      <label htmlFor="reauth-nonce" className="grid gap-2 text-sm font-bold text-kc-text">Código de verificación<input id="reauth-nonce" value={nonce} onChange={(event) => setNonce(event.target.value)} inputMode="numeric" autoComplete="one-time-code" disabled={!verificationSent} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text disabled:opacity-50" /></label>
      <PasswordField id="security-password" label="Nueva contraseña" value={password} onChange={setPassword} autoComplete="new-password" />
      <PasswordField id="security-confirm" label="Confirmar contraseña" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
      {message ? <p role="status" className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-kc-muted">{message}</p> : null}
      <button disabled={!verificationSent || busy} className="min-h-12 rounded-xl bg-kc-electric px-5 text-sm font-black text-white disabled:opacity-50">{busy ? "Guardando…" : "Actualizar contraseña"}</button>
    </form>
  </div>;
}
