import Link from "next/link";
import { Facebook, Mail, MessageCircle } from "lucide-react";
import { site, whatsappLink } from "@/lib/site";

type SocialLinksProps = {
  whatsappMessage: string;
  className?: string;
};

const iconClass =
  "group relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-kc-border bg-white/[0.05] text-kc-muted transition hover:border-kc-cyan/60 hover:bg-kc-cyan/10 hover:text-kc-cyan hover:shadow-[0_0_28px_rgba(0,217,255,0.14)]";

export function SocialLinks({ whatsappMessage, className = "" }: SocialLinksProps) {
  const items = [
    {
      label: "WhatsApp",
      href: whatsappLink(whatsappMessage),
      icon: MessageCircle,
    },
    {
      label: "Correo",
      href: `mailto:${site.email}`,
      icon: Mail,
    },
    {
      label: "Facebook",
      href: site.facebook,
      icon: Facebook,
    },
  ];

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            target={item.href.startsWith("http") ? "_blank" : undefined}
            rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className={iconClass}
            aria-label={item.label}
            title={item.label}
          >
            <Icon size={20} aria-hidden="true" />
            <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-kc-bg-soft px-2 py-1 text-xs font-semibold text-kc-text shadow-xl group-hover:block">
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
