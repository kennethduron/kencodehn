"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PasswordField } from "./password-field";

export function RecoveryForm({ invitation = false }: { invitation?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [message, setMessage] = useState("Validando enlace seguro…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      setSessionReady(Boolean(data.session));
      setMessage(data.session ? "" : "El enlace es inválido, expiró o ya fue utilizado.");
    });
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 12) return setMessage("Use al menos 12 caracteres.");
    if (password !== confirmation) return setMessage("Las contraseñas no coinciden.");
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("No se pudo actualizar la contraseña. Solicite un enlace nuevo.");
      setBusy(false);
      return;
    }
    setMessage(invitation ? "Cuenta configurada correctamente." : "Contraseña actualizada correctamente.");
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/admin/login");
  }
  return <form onSubmit={submit} className="grid gap-4">
    <PasswordField id="new-password" label="Nueva contraseña" value={password} onChange={setPassword} autoComplete="new-password" />
    <PasswordField id="confirm-password" label="Confirmar contraseña" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
    {message ? <p role="status" className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-kc-muted">{message}</p> : null}
    <button disabled={!sessionReady || busy} className="min-h-12 rounded-xl bg-kc-electric px-5 text-sm font-black text-white disabled:opacity-50">{busy ? "Guardando…" : invitation ? "Configurar cuenta" : "Actualizar contraseña"}</button>
  </form>;
}
