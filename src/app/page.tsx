import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Check,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Headphones,
  Layers3,
  LineChart,
  MailCheck,
  MessageCircle,
  MonitorSmartphone,
  Rocket,
  SearchCheck,
  ShieldCheck,
  ShoppingCart,
  Star,
  Wand2,
} from "lucide-react";
import { QuoteForm } from "@/components/site/quote-form";

const whatsappUrl =
  "https://wa.me/50499112211?text=Hola%20Ken%20Code.%20Quiero%20cotizar%20un%20proyecto%20web%20profesional%20para%20mi%20negocio.%20Me%20gustar%C3%ADa%20recibir%20una%20propuesta%20y%20pr%C3%B3ximos%20pasos.";

const publicEmail = "kencodehn@gmail.com";
const publicPhone = "+504 9911-2211";
const siteUrl = "https://kencodehn.com";
const facebookUrl = "https://www.facebook.com/share/1CMt5EQ8Jo/?mibextid=wwXIfr";

const badges = [
  { label: "Diseño responsive", icon: MonitorSmartphone },
  { label: "SEO básico incluido", icon: SearchCheck },
  { label: "WhatsApp integrado", icon: MessageCircle },
  { label: "CRM para clientes", icon: Blocks },
  { label: "Soporte post-lanzamiento", icon: Headphones },
];

const services = [
  { title: "Landing pages", copy: "Paginas enfocadas en una oferta clara, rapidas de leer y listas para captar cotizaciones.", icon: Rocket },
  { title: "Sitios web para negocios", copy: "Presencia profesional con secciones, llamadas a la accion y estructura lista para crecer.", icon: MonitorSmartphone },
  { title: "E-commerce", copy: "Catalogos, productos y flujos de compra pensados para vender con confianza.", icon: ShoppingCart },
  { title: "Rediseño web", copy: "Actualizacion visual, velocidad, estructura y experiencia para negocios que ya tienen sitio.", icon: Wand2 },
  { title: "Formularios inteligentes", copy: "Campos claros, validacion y mensajes que preparan leads para seguimiento comercial.", icon: CheckCircle2 },
  { title: "Integracion WhatsApp", copy: "Botones y mensajes precargados para que el cliente escriba con menos friccion.", icon: MessageCircle },
  { title: "SEO basico", copy: "Titulos, descripciones, estructura semantica y rendimiento base para aparecer mejor.", icon: SearchCheck },
  { title: "Automatizacion de correos", copy: "Respuestas y avisos con Resend para que ningun contacto se pierda.", icon: MailCheck },
];

const projects = [
  {
    name: "Casa Brava Menu",
    problem: "El restaurante necesitaba presentar su menu de forma moderna, clara y facil de navegar en celular.",
    solution: "Menu digital responsive con categorias, imagenes, busqueda visual y experiencia rapida.",
    technologies: ["HTML", "CSS", "JavaScript", "Firebase"],
    result: "Clientes consultan productos con menos friccion y el equipo puede operar con una presencia mas profesional.",
    href: "#contacto",
  },
  {
    name: "Beky's Cake",
    problem: "La marca necesitaba lucir pasteles personalizados con mas confianza y recibir solicitudes ordenadas.",
    solution: "Sitio calido, visual y enfocado en cotizaciones con flujo de pedidos preparado.",
    technologies: ["JavaScript", "Supabase", "Firebase", "Vercel"],
    result: "Mejor presentacion de productos y una ruta mas directa para convertir visitas en pedidos.",
    href: "#contacto",
  },
  {
    name: "Haru Logistics Group",
    problem: "La empresa necesitaba explicar sus servicios logisticos con una imagen mas seria y confiable.",
    solution: "Web corporativa con servicios, rutas, seguimiento y contacto para prospectos.",
    technologies: ["HTML", "CSS", "JavaScript", "Firebase"],
    result: "Mayor claridad comercial y mejor percepcion profesional para clientes empresariales.",
    href: "#contacto",
  },
  {
    name: "KADSA",
    problem: "El catalogo de productos necesitaba mostrarse con orden y una experiencia simple para compradores.",
    solution: "Catalogo web responsive con estructura comercial, imagenes y contacto directo.",
    technologies: ["HTML", "CSS", "JavaScript"],
    result: "Productos mas faciles de explorar y una marca con presencia digital mas completa.",
    href: "#contacto",
  },
];

const process = [
  "Consulta inicial",
  "Propuesta",
  "Diseño",
  "Desarrollo",
  "Revision",
  "Lanzamiento",
  "Soporte",
];

const packages = [
  {
    name: "Landing Page",
    price: "Para campañas y servicios",
    features: ["1 pagina profesional", "Copy orientado a ventas", "WhatsApp integrado", "SEO basico"],
    icon: Rocket,
  },
  {
    name: "Web Business",
    price: "Para negocios establecidos",
    features: ["Hasta 5 secciones", "Formulario de contacto", "Galeria o servicios", "Deploy en Vercel"],
    icon: Layers3,
  },
  {
    name: "Web Pro + CRM",
    price: "Para seguimiento comercial",
    features: ["Landing premium", "Panel privado en fase CRM", "Leads y notas internas", "Automatizaciones base"],
    icon: LineChart,
    featured: true,
  },
  {
    name: "E-commerce",
    price: "Para vender productos",
    features: ["Catalogo de productos", "Flujo de pedidos", "Integracion de contacto", "Base para pagos"],
    icon: ShoppingCart,
  },
];

const techStack = [
  "HTML",
  "CSS",
  "JavaScript",
  "React",
  "Next.js",
  "TypeScript",
  "Tailwind",
  "Firebase",
  "Vercel",
  "Resend",
];

const testimonials = [
  {
    quote:
      "La pagina se siente mas profesional y ahora los clientes entienden mejor lo que ofrecemos desde el primer vistazo.",
    name: "Cliente de servicios",
    role: "Negocio local",
  },
  {
    quote:
      "El diseño nos ayudo a presentar productos con mas orden y a dirigir las consultas hacia WhatsApp.",
    name: "Cliente e-commerce",
    role: "Marca de productos",
  },
  {
    quote:
      "Ken Code cuido los detalles, la velocidad y la version movil. Eso hizo que el sitio se sintiera listo para vender.",
    name: "Cliente corporativo",
    role: "Servicios B2B",
  },
];

const faqs = [
  {
    question: "Cuanto tarda un sitio web profesional?",
    answer:
      "Depende del alcance, pero una landing puede estar lista en pocos dias y un sitio business suele requerir mas revisiones de contenido, diseño y pruebas.",
  },
  {
    question: "La pagina incluye version movil?",
    answer:
      "Si. La experiencia se diseña mobile-first para que se vea bien en celulares, tablets y escritorio.",
  },
  {
    question: "Puedo conectar WhatsApp y formularios?",
    answer:
      "Si. La landing puede dirigir clientes a WhatsApp y preparar formularios para que en una fase posterior entren al CRM privado.",
  },
  {
    question: "El CRM estara en la pagina publica?",
    answer:
      "No. El CRM/Admin va separado en rutas privadas como /admin y solo se construira en su propia fase con login y Firebase Auth.",
  },
];

const businessSchema = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Ken Code",
  url: siteUrl,
  logo: `${siteUrl}/images/logo-kenneth.jpg`,
  image: `${siteUrl}/images/logo-kenneth.jpg`,
  email: publicEmail,
  telephone: publicPhone,
  areaServed: ["Honduras", "Latinoamérica", "Estados Unidos"],
  address: {
    "@type": "PostalAddress",
    addressCountry: "HN",
  },
  sameAs: [facebookUrl, "https://github.com/kennethduron/kencodehn"],
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: publicPhone,
      contactType: "sales",
      availableLanguage: ["es", "en"],
      url: "https://wa.me/50499112211",
    },
  ],
  makesOffer: [
    "Desarrollo web",
    "Landing pages",
    "CRM",
    "E-commerce",
    "Diseño web",
    "SEO básico",
  ],
};

function SectionIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.24em] text-kc-cyan">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-kc-text sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-kc-muted sm:text-lg">{copy}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden pt-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />
      <section id="inicio" className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,0.22),transparent_34rem)]" />
        <div className="kc-shell grid min-h-[calc(100vh-5rem)] items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div className="max-w-4xl">
            <p className="inline-flex rounded-full border border-kc-cyan/30 bg-kc-cyan/10 px-4 py-2 text-sm font-bold text-kc-cyan shadow-[0_0_30px_rgba(0,217,255,0.14)]">
              Ken Code Web Studio
            </p>
            <h1 className="mt-6 max-w-5xl font-display text-4xl font-black leading-[1.04] text-kc-text sm:text-5xl lg:text-7xl">
              Sitios web profesionales que convierten visitantes en clientes
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-kc-muted sm:text-lg">
              En Ken Code creo páginas modernas, rápidas y enfocadas en ventas para negocios que quieren verse más profesionales, recibir más cotizaciones y crecer en línea.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#contacto"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-kc-electric px-6 py-3 text-sm font-black text-white shadow-[0_0_38px_rgba(0,109,255,0.38)] transition hover:bg-kc-cyan hover:text-kc-bg"
              >
                Solicitar cotización
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="#proyectos"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-kc-border bg-white/5 px-6 py-3 text-sm font-bold text-kc-text transition hover:border-kc-turquoise hover:text-kc-turquoise"
              >
                Ver proyectos
                <ExternalLink size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {badges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.label}
                    className="flex min-h-12 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-kc-muted"
                  >
                    <Icon className="text-kc-turquoise" size={18} aria-hidden="true" />
                    <span>{badge.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="kc-hero-panel relative overflow-hidden rounded-2xl border border-kc-cyan/20 bg-kc-card p-4 shadow-[0_0_90px_rgba(0,217,255,0.12)] sm:p-6">
            <div className="relative rounded-xl border border-white/10 bg-kc-bg/72 p-5">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-kc-lime" />
                  <span className="h-3 w-3 rounded-full bg-kc-cyan" />
                  <span className="h-3 w-3 rounded-full bg-kc-electric" />
                </div>
                <span className="rounded-full border border-kc-lime/30 bg-kc-lime/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-kc-lime">
                  Online
                </span>
              </div>
              <div className="grid gap-4">
                {[
                  ["Visitas", "+38%", "Clientes entienden la oferta mas rapido"],
                  ["Cotizaciones", "24/7", "WhatsApp y formulario siempre visibles"],
                  ["Confianza", "Alta", "Diseño premium, velocidad y SEO base"],
                ].map(([label, value, copy]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-bold text-kc-muted">{label}</p>
                      <p className="font-display text-2xl font-black text-kc-cyan">{value}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-kc-muted">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="kc-shell py-16 lg:py-24" aria-labelledby="problema-title">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-red-200">El problema</p>
            <h2 id="problema-title" className="mt-3 font-display text-3xl font-bold text-kc-text sm:text-4xl">
              Muchos negocios pierden clientes antes de recibir el primer mensaje.
            </h2>
            <p className="mt-4 text-base leading-8 text-kc-muted">
              Una pagina lenta, desordenada o poco confiable hace que el visitante dude, compare con otro proveedor y se vaya. Si el negocio no se ve profesional, la venta empieza cuesta arriba.
            </p>
          </div>
          <div className="rounded-2xl border border-kc-turquoise/25 bg-kc-turquoise/[0.05] p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-kc-turquoise">La solucion</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-kc-text sm:text-4xl">
              Ken Code convierte tu presencia digital en una ruta clara hacia la cotizacion.
            </h2>
            <p className="mt-4 text-base leading-8 text-kc-muted">
              Diseño moderno, formularios, WhatsApp, SEO, soporte y una base lista para conectar con un CRM interno privado cuando llegue la fase correspondiente.
            </p>
          </div>
        </div>
      </section>

      <section id="servicios" className="border-y border-white/10 bg-white/[0.025] py-16 lg:py-24">
        <div className="kc-shell">
          <SectionIntro
            eyebrow="Servicios"
            title="Todo lo que necesita una pagina para verse bien y vender mejor."
            copy="Cada servicio se enfoca en claridad, confianza y contacto directo con clientes reales."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className="kc-card rounded-xl p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-lg border border-kc-cyan/25 bg-kc-cyan/10 text-kc-cyan">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold text-kc-text">{service.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-kc-muted">{service.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="proyectos" className="kc-shell py-16 lg:py-24">
        <SectionIntro
          eyebrow="Proyectos"
          title="Casos reales construidos para negocios que necesitaban verse mas profesionales."
          copy="Cada proyecto resuelve un problema comercial concreto: explicar mejor, generar confianza o facilitar el contacto."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {projects.map((project) => (
            <article key={project.name} className="kc-card rounded-2xl p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-display text-2xl font-black text-kc-text">{project.name}</h3>
                  <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-kc-cyan">Caso real</p>
                </div>
                <Link
                  href={project.href}
                  target={project.href.startsWith("http") ? "_blank" : undefined}
                  rel={project.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-kc-border px-4 py-2 text-sm font-bold text-kc-text transition hover:border-kc-cyan hover:text-kc-cyan"
                >
                  Cotizar similar
                  <ExternalLink size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-bold text-kc-text">Problema</p>
                  <p className="mt-2 text-sm leading-7 text-kc-muted">{project.problem}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-kc-text">Solucion</p>
                  <p className="mt-2 text-sm leading-7 text-kc-muted">{project.solution}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {project.technologies.map((tech) => (
                  <span key={tech} className="rounded-full border border-kc-turquoise/25 bg-kc-turquoise/10 px-3 py-1 text-xs font-bold text-kc-turquoise">
                    {tech}
                  </span>
                ))}
              </div>
              <p className="mt-5 rounded-xl border border-kc-lime/20 bg-kc-lime/[0.06] p-4 text-sm leading-7 text-kc-muted">
                <strong className="text-kc-lime">Resultado: </strong>
                {project.result}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-kc-bg-soft/55 py-16 lg:py-24">
        <div className="kc-shell">
          <SectionIntro
            eyebrow="Proceso"
            title="Un camino ordenado desde la idea hasta el lanzamiento."
            copy="Trabajo por etapas para que sepas que se esta construyendo, que falta y cuando tu sitio queda listo para recibir clientes."
          />
          <div className="mt-10 grid gap-3 md:grid-cols-7">
            {process.map((step, index) => (
              <div key={step} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-kc-electric text-sm font-black text-white">
                  {index + 1}
                </span>
                <p className="mt-4 text-sm font-bold leading-6 text-kc-text">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="paquetes" className="kc-shell py-16 lg:py-24">
        <SectionIntro
          eyebrow="Paquetes"
          title="Opciones claras segun la etapa de tu negocio."
          copy="Puedes iniciar simple y escalar hacia automatizaciones, formularios avanzados o CRM privado cuando el proyecto lo necesite."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-4">
          {packages.map((plan) => {
            const Icon = plan.icon;
            return (
              <article
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.featured
                    ? "border-kc-lime/45 bg-kc-lime/[0.07] shadow-[0_0_54px_rgba(182,255,59,0.12)]"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <Icon className={plan.featured ? "text-kc-lime" : "text-kc-cyan"} size={28} aria-hidden="true" />
                <h3 className="mt-5 font-display text-2xl font-black text-kc-text">{plan.name}</h3>
                <p className="mt-2 text-sm font-bold text-kc-muted">{plan.price}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm leading-6 text-kc-muted">
                      <Check className="mt-0.5 shrink-0 text-kc-turquoise" size={17} aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="#contacto"
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white/8 px-4 py-2 text-sm font-black text-kc-text transition hover:bg-kc-cyan hover:text-kc-bg"
                >
                  Cotizar paquete
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] py-16 lg:py-24">
        <div className="kc-shell">
          <SectionIntro
            eyebrow="Tecnologias"
            title="Stack moderno para sitios rapidos, escalables y listos para Vercel."
            copy="Uso herramientas probadas para construir interfaces limpias, publicar rapido y dejar base para automatizacion."
          />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {techStack.map((tech) => (
              <span key={tech} className="rounded-lg border border-kc-border bg-kc-bg-soft/75 px-4 py-3 text-sm font-black text-kc-text shadow-[0_0_30px_rgba(0,217,255,0.06)]">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonios" className="kc-shell py-16 lg:py-24">
        <SectionIntro
          eyebrow="Testimonios"
          title="Clientes que necesitaban presencia digital con mejor percepcion y conversion."
          copy="La meta no es solo verse bonito: es que el cliente entienda, confie y escriba."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure key={testimonial.name} className="kc-card rounded-2xl p-6">
              <div className="flex gap-1 text-kc-lime" aria-label="5 estrellas">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} size={17} fill="currentColor" aria-hidden="true" />
                ))}
              </div>
              <blockquote className="mt-5 text-base leading-8 text-kc-text">"{testimonial.quote}"</blockquote>
              <figcaption className="mt-6 text-sm text-kc-muted">
                <strong className="block text-kc-cyan">{testimonial.name}</strong>
                {testimonial.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-kc-bg-soft/55 py-16 lg:py-24">
        <div className="kc-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-kc-cyan">FAQ</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-kc-text sm:text-4xl">
              Preguntas frecuentes antes de cotizar.
            </h2>
          </div>
          <div className="grid gap-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold text-kc-text">
                  {faq.question}
                  <span className="text-kc-cyan transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-7 text-kc-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="contacto" className="kc-shell py-16 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-kc-cyan">Contacto</p>
            <h2 className="mt-3 font-display text-3xl font-black leading-tight text-kc-text sm:text-5xl">
              ¿Listo para que tu negocio tenga una página web profesional?
            </h2>
            <p className="mt-5 text-base leading-8 text-kc-muted">
              Cuentame que vendes, que necesitas y que resultado esperas. Te respondo con una ruta clara para convertir esa idea en una pagina publica lista para generar confianza.
            </p>
            <div className="mt-7 grid gap-3">
              <a
                href={`mailto:${publicEmail}?subject=Cotización%20web%20Ken%20Code`}
                className="flex items-center gap-3 text-sm font-semibold text-kc-muted transition hover:text-kc-cyan"
              >
                <MailCheck className="text-kc-turquoise" size={19} aria-hidden="true" />
                <span>{publicEmail}</span>
              </a>
              <a
                href="tel:+50499112211"
                className="flex items-center gap-3 text-sm font-semibold text-kc-muted transition hover:text-kc-cyan"
              >
                <MessageCircle className="text-kc-turquoise" size={19} aria-hidden="true" />
                <span>{publicPhone}</span>
              </a>
              {[
                { icon: ShieldCheck, text: "La informacion privada queda fuera del sitio publico." },
                { icon: MessageCircle, text: "WhatsApp directo para cotizaciones rapidas." },
                { icon: Gauge, text: "Landing enfocada en velocidad, claridad y conversion." },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-center gap-3 text-sm font-semibold text-kc-muted">
                    <Icon className="text-kc-turquoise" size={19} aria-hidden="true" />
                    <span>{item.text}</span>
                  </div>
                );
              })}
            </div>
            <Link
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-kc-lime px-6 py-3 text-sm font-black text-kc-bg shadow-[0_0_36px_rgba(182,255,59,0.24)] transition hover:bg-kc-turquoise"
            >
              Quiero cotizar mi proyecto
              <MessageCircle size={18} aria-hidden="true" />
            </Link>
          </div>
          <QuoteForm />
        </div>
      </section>

      <section className="kc-shell pb-16">
        <div className="rounded-2xl border border-kc-cyan/25 bg-[linear-gradient(135deg,rgba(0,109,255,0.24),rgba(0,230,168,0.12))] p-6 text-center shadow-[0_0_80px_rgba(0,217,255,0.12)] sm:p-10">
          <BadgeCheck className="mx-auto text-kc-lime" size={34} aria-hidden="true" />
          <h2 className="mt-4 font-display text-3xl font-black text-kc-text sm:text-5xl">
            ¿Listo para que tu negocio tenga una página web profesional?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-kc-muted">
            Hagamos que tu marca se vea seria, moderna y lista para recibir mas clientes.
          </p>
          <Link
            href="#contacto"
            className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-kc-electric px-6 py-3 text-sm font-black text-white transition hover:bg-kc-cyan hover:text-kc-bg"
          >
            Quiero cotizar mi proyecto
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
