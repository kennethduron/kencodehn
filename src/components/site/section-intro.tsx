type SectionIntroProps = {
  eyebrow?: string;
  title: string;
  copy?: string;
  align?: "left" | "center";
};

export function SectionIntro({ eyebrow, title, copy, align = "center" }: SectionIntroProps) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? (
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">{eyebrow}</p>
      ) : null}
      <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-kc-text sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {copy ? <p className="mt-4 text-base leading-8 text-kc-muted sm:text-lg">{copy}</p> : null}
    </div>
  );
}
