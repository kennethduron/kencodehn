"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { getFirebaseClient } from "@/lib/firebase/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CrmAuthProvider } from "@/lib/auth/provider";

export function AdminLogin({ authProvider = "firebase", missingServerEnv = [], missingClientEnv = [] }: { authProvider?: CrmAuthProvider; missingServerEnv?: string[]; missingClientEnv?: string[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const missing = [...missingServerEnv, ...missingClientEnv];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      if (authProvider === "supabase") {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
        const profileResponse = await fetch("/api/admin/me", { cache: "no-store" });
        if (!profileResponse.ok) {
          await supabase.auth.signOut();
          setMessage("La cuenta no tiene un perfil activo autorizado.");
          setIsSubmitting(false);
          return;
        }
        router.refresh();
        return;
      }
      const firebase = getFirebaseClient();
      if (!firebase.ok) {
        setMessage(`Faltan variables publicas de Firebase: ${firebase.missing.join(", ")}`);
        setIsSubmitting(false);
        return;
      }
      const credential = await signInWithEmailAndPassword(firebase.auth, email, password);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message || "No se pudo iniciar sesion.");
        setIsSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setMessage("Correo o contraseña incorrectos, o la cuenta no está disponible.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="kc-admin-theme grid min-h-screen place-items-center bg-kc-bg px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-kc-cyan/20 bg-kc-bg-soft p-6 shadow-[0_24px_70px_rgba(15,35,63,0.14)]">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-kc-cyan/35 bg-kc-cyan/10 text-kc-cyan">
          <LockKeyhole size={25} aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-black text-kc-text">CRM Ken Code</h1>
        <p className="mt-2 text-sm leading-6 text-kc-muted">Acceso privado para administrar leads, tareas y seguimientos. No hay registro publico.</p>

        {missing.length > 0 ? (
          <div className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100 [overflow-wrap:anywhere]">
            Faltan variables para probar el login: <strong>{missing.join(", ")}</strong>
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-bold text-kc-text">
            Correo
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text outline-none transition focus:border-kc-cyan"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kc-text">
            Contraseña
            <span className="relative block">
              <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="min-h-12 w-full rounded-xl border border-white/10 bg-kc-bg px-4 pr-14 text-kc-text outline-none transition focus:border-kc-cyan"
              required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 grid min-w-12 place-items-center rounded-r-xl text-kc-muted hover:text-kc-cyan" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
              </button>
            </span>
          </label>
          {authProvider === "supabase" ? <Link href="/admin/forgot-password" className="w-fit text-sm font-bold text-kc-cyan hover:underline">¿Olvidó su contraseña?</Link> : null}
          {message ? <p className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">{message}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting || missing.length > 0}
            className="min-h-12 rounded-xl bg-kc-electric px-5 text-sm font-black text-white shadow-[0_0_32px_rgba(0,109,255,0.28)] transition hover:bg-kc-cyan hover:text-kc-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Entrando..." : "Entrar al CRM"}
          </button>
        </form>
      </section>
    </main>
  );
}
