import Image from "next/image";
import { site } from "@/lib/site";

type LogoProps = {
  variant?: "header" | "footer";
};

export function Logo({ variant = "header" }: LogoProps) {
  const isFooter = variant === "footer";

  return (
    <span className="inline-flex items-center" aria-label="Ken Code">
      <span
        className={`relative grid place-items-center overflow-hidden rounded-xl bg-kc-bg-soft shadow-[0_0_28px_rgba(0,217,255,0.18)] ${
          isFooter ? "h-24 w-24" : "h-14 w-14"
        }`}
      >
        <Image
          src={site.brandLogo}
          alt="Ken Code logo"
          width={isFooter ? 96 : 56}
          height={isFooter ? 96 : 56}
          className="h-full w-full object-contain"
          priority
        />
      </span>
    </span>
  );
}
