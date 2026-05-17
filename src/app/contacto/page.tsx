import Link from "next/link";
import { Facebook, MailCheck, MessageCircle } from "lucide-react";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { QuoteForm } from "@/components/site/quote-form";
import { createMetadata, site, whatsappLink } from "@/lib/site";

export const metadata = createMetadata({
  title: "Contacto",
  description:
    "Contacta a Ken Code por WhatsApp, correo o Facebook para cotizar una página web profesional, landing page o e-commerce en Honduras.",
  path: "/contacto",
  keywords: ["contacto desarrollo web Honduras", "cotizar página web Honduras"],
});

const contactSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contacto Ken Code",
  url: `${site.url}/contacto`,
  about: {
    "@type": "ProfessionalService",
    name: site.name,
    email: site.email,
    telephone: site.phone,
  },
};

export default function ContactPage() {
  const contactItems = [
    { label: "WhatsApp", value: site.phone, href: whatsappLink("Hola Ken Code. Quiero información para una página web."), icon: MessageCircle },
    { label: "Correo", value: site.email, href: `mailto:${site.email}?subject=Cotización web Ken Code`, icon: MailCheck },
    { label: "Facebook", value: "Ken Code en Facebook", href: site.facebook, icon: Facebook },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={contactSchema} />
      <PageHero
        eyebrow="Contacto"
        title="Hablemos de la página web que necesita tu negocio."
        copy="Puedes escribirme por WhatsApp, correo o Facebook. Si ya tienes una idea clara, usa el formulario y te respondo con próximos pasos."
      />
      <section className="kc-shell grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="grid gap-4">
          {contactItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-kc-cyan/45"
              >
                <Icon className="text-kc-turquoise" size={24} aria-hidden="true" />
                <h2 className="mt-4 font-display text-xl font-black text-kc-text">{item.label}</h2>
                <p className="mt-2 text-sm leading-7 text-kc-muted">{item.value}</p>
              </Link>
            );
          })}
        </div>
        <QuoteForm />
      </section>
    </main>
  );
}
