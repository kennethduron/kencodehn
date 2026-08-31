import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { site } from "@/lib/site";

export function AuthShell({
  title,
  description,
  children,
  showBackLink = true,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  showBackLink?: boolean;
}) {
  return (
    <main data-auth-shell className="kc-auth-layout kc-admin-theme grid place-items-center overflow-x-hidden bg-kc-bg px-4 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-kc-border bg-kc-bg-soft p-5 shadow-[0_24px_70px_rgba(15,35,63,0.14)] sm:p-7">
        <div className="flex items-center gap-3">
          <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-blue-200 bg-slate-950 shadow-[0_10px_28px_rgba(15,35,63,0.16)]">
            <Image src={site.brandLogo} alt="Ken Code" width={56} height={56} className="h-full w-full object-contain" priority />
          </span>
          <div><p className="font-display text-lg font-black text-kc-text">Ken Code</p><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">CRM seguro</p></div>
        </div>
        <h1 className="mt-6 font-display text-2xl font-black text-kc-text sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-kc-muted">{description}</p>
        <div className="mt-6">{children}</div>
        {showBackLink ? <Link href="/admin/login" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-black text-blue-700 underline decoration-2 decoration-blue-300 underline-offset-4 transition hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"><ArrowLeft size={17} aria-hidden="true" /> Volver al acceso</Link> : null}
      </section>
    </main>
  );
}
