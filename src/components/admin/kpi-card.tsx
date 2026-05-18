import type { LucideIcon } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  accent?: "cyan" | "green" | "lime" | "rose" | "blue" | "slate";
  icon: LucideIcon;
};

const accentClass = {
  cyan: "from-kc-cyan/20 text-kc-cyan ring-kc-cyan/25",
  green: "from-kc-turquoise/20 text-kc-turquoise ring-kc-turquoise/25",
  lime: "from-kc-lime/20 text-kc-lime ring-kc-lime/25",
  rose: "from-rose-300/20 text-rose-200 ring-rose-300/25",
  blue: "from-blue-400/20 text-blue-200 ring-blue-300/25",
  slate: "from-slate-300/16 text-slate-200 ring-white/10",
};

export function KpiCard({ label, value, detail, accent = "cyan", icon: Icon }: KpiCardProps) {
  return (
    <article className="kc-admin-card group min-h-36 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-kc-muted">{label}</p>
          <p className="mt-3 font-display text-3xl font-black leading-none text-kc-text sm:text-4xl">{value}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br to-white/[0.03] ring-1 ${accentClass[accent]}`}>
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
      {detail ? <p className="mt-4 text-xs font-semibold leading-5 text-kc-muted">{detail}</p> : null}
    </article>
  );
}
