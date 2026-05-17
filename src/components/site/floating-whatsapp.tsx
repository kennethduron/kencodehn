import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { whatsappLink, type Locale } from "@/lib/site";

type FloatingWhatsAppProps = {
  locale?: Locale;
};

export function FloatingWhatsApp({ locale = "es" }: FloatingWhatsAppProps) {
  const message =
    locale === "es"
      ? "Hola Ken Code. Quiero informacion para una solucion web profesional."
      : "Hello Ken Code. I want information about a professional web solution.";

  return (
    <Link
      href={whatsappLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      title="WhatsApp"
      className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-kc-turquoise/45 bg-kc-turquoise text-kc-bg shadow-[0_0_34px_rgba(0,230,168,0.34)] transition hover:-translate-y-0.5 hover:bg-kc-lime hover:shadow-[0_0_44px_rgba(182,255,59,0.28)] sm:bottom-6 sm:right-6"
    >
      <MessageCircle size={26} aria-hidden="true" />
    </Link>
  );
}
