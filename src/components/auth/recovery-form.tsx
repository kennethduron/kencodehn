"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PasswordField } from "./password-field";

const INVITATION_VERIFICATION_TYPES = new Set(["invite", "magiclink"] as const);

export function RecoveryForm({ invitation = false }: { invitation?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [message, setMessage] = useState("Validando enlace seguro…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const validate = async () => {
      if (invitation && window.location.hash.length > 1) {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const tokenHash = fragment.get("token_hash");
        const type = fragment.get("type");
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
        if (tokenHash && (type === "invite" || type === "magiclink") && INVITATION_VERIFICATION_TYPES.has(type)) {
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          setSessionReady(!error && Boolean(data.session));
          setMessage(error || !data.session ? "El enlace es inválido, expiró o ya fue utilizado." : "");
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      setSessionReady(Boolean(data.session));
      setMessage(data.session ? "" : "El enlace es inválido, expiró o ya fue utilizado.");
    };
    void validate();
  }, [invitation]);
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
