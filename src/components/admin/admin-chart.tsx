type ChartItem = {
  label: string;
  value: number;
  tone?: "cyan" | "green" | "lime" | "rose" | "blue" | "slate";
};

const toneClass = {
  cyan: "bg-kc-cyan",
  green: "bg-kc-turquoise",
  lime: "bg-kc-lime",
  rose: "bg-rose-300",
  blue: "bg-blue-300",
  slate: "bg-slate-400",
};

export function AdminBarChart({ title, description, items }: { title: string; description?: string; items: ChartItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <article className="kc-admin-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-black text-kc-text">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-kc-muted">{description}</p> : null}
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        {items.map((item) => {
          const width = `${Math.max((item.value / max) * 100, item.value > 0 ? 9 : 0)}%`;
          return (
            <div key={item.label} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-kc-muted">{item.label}</span>
                <span className="font-black text-kc-text">{item.value}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full ${toneClass[item.tone ?? "cyan"]}`} style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function AdminDonutMetric({ title, value, total, label }: { title: string; value: number; total: number; label: string }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  const background = `conic-gradient(var(--kc-turquoise) ${percent}%, rgba(255,255,255,0.08) 0)`;

  return (
    <article className="kc-admin-card p-5">
      <h2 className="font-display text-xl font-black text-kc-text">{title}</h2>
      <div className="mt-5 flex items-center gap-5">
        <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background }}>
          <div className="grid h-20 w-20 place-items-center rounded-full bg-kc-bg-soft text-center shadow-inner">
            <span className="font-display text-2xl font-black text-kc-text">{percent}%</span>
          </div>
        </div>
        <div>
          <p className="font-display text-3xl font-black text-kc-text">{value}</p>
          <p className="mt-1 text-sm leading-6 text-kc-muted">{label}</p>
        </div>
      </div>
    </article>
  );
}
