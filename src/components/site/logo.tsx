export function Logo() {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-kc-cyan/40 bg-kc-bg-soft shadow-[0_0_28px_rgba(0,217,255,0.2)]">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,217,255,0.38),transparent_48%),linear-gradient(135deg,rgba(0,109,255,0.6),rgba(0,230,168,0.2))]" />
        <span className="relative font-display text-sm font-black tracking-tight text-white">
          KC
        </span>
      </span>
      <span className="leading-none">
        <span className="block font-display text-lg font-bold tracking-tight text-kc-text">
          Ken Coding
        </span>
        <span className="block text-[0.67rem] font-semibold uppercase tracking-[0.22em] text-kc-cyan">
          Web Studio
        </span>
      </span>
    </span>
  );
}
