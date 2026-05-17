import Image from "next/image";
import { site } from "@/lib/site";

export function Logo() {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-kc-cyan/40 bg-kc-bg-soft shadow-[0_0_28px_rgba(0,217,255,0.2)]">
        <Image
          src={site.favicon}
          alt="Icono de Ken Code"
          width={44}
          height={44}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      <span className="leading-none">
        <span className="block font-display text-lg font-bold tracking-tight text-kc-text">
          {site.name}
        </span>
        <span className="block text-[0.67rem] font-semibold uppercase tracking-[0.22em] text-kc-cyan">
          Web Studio
        </span>
      </span>
    </span>
  );
}
