"use client";

import { usePathname } from "next/navigation";
import { FloatingWhatsApp } from "@/components/site/floating-whatsapp";
import type { Locale } from "@/lib/site";

export function FloatingContact() {
  const pathname = usePathname();
  const locale: Locale = pathname.startsWith("/en") ? "en" : "es";

  return <FloatingWhatsApp locale={locale} />;
}
