"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordField({ id, label, value, onChange, autoComplete, minLength = 12 }: {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  autoComplete: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-kc-text">
      {label}
      <span className="relative block">
        <input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} minLength={minLength} required className="min-h-12 w-full rounded-xl border border-white/10 bg-kc-bg px-4 pr-14 text-kc-text outline-none transition focus:border-kc-cyan" />
        <button type="button" onClick={() => setVisible((current) => !current)} className="absolute inset-y-0 right-0 grid min-w-12 place-items-center rounded-r-xl text-kc-muted hover:text-kc-cyan" aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}>
          {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}
