import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden bg-kc-bg px-4 py-8 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-kc-cyan/20 bg-kc-bg-soft/90 p-5 shadow-[0_0_80px_rgba(0,217,255,0.12)] sm:p-7">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-kc-cyan/35 bg-kc-cyan/10 text-kc-cyan"><ShieldCheck size={25} aria-hidden="true" /></div>
        <h1 className="mt-6 font-display text-2xl font-black text-kc-text sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-kc-muted">{description}</p>
        <div className="mt-6">{children}</div>
        <Link href="/admin" className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-kc-cyan hover:underline">Volver al acceso</Link>
      </section>
    </main>
  );
}
