import {
  BarChart3,
  Blocks,
  CheckCircle2,
  Gauge,
  Headphones,
  MailCheck,
  MessageCircle,
  MonitorSmartphone,
  Rocket,
  SearchCheck,
  ShieldCheck,
  ShoppingCart,
  Wand2,
} from "lucide-react";

export const services = [
  {
    slug: "landing-pages",
    title: "Landing pages",
    summary: "Pages built for campaigns, service offers and qualified inquiries.",
    detail:
      "Clear structure, conversion copy, visible CTAs and a measurement-ready foundation for turning traffic into real conversations.",
    icon: Rocket,
  },
  {
    slug: "sitios-web-para-negocios",
    title: "Sitios web para negocios",
    summary: "Professional websites for brands that need clarity, trust and a global-ready presence.",
    detail:
      "Organized sections, responsive design, business-focused content and a scalable foundation for future growth.",
    icon: MonitorSmartphone,
  },
  {
    slug: "ecommerce",
    title: "E-commerce",
    summary: "Product catalogs and order flows for brands selling across markets.",
    detail:
      "Products, categories, purchase messaging and a structure ready for future payment integrations.",
    icon: ShoppingCart,
  },
  {
    slug: "crm-para-leads",
    title: "CRM para leads",
    summary: "A foundation for capturing, organizing and following up with leads from different channels.",
    detail:
      "At this stage the public positioning stays ready. The private CRM remains separate and will be handled in a later phase.",
    icon: Blocks,
  },
  {
    slug: "rediseno-web",
    title: "Rediseño web",
    summary: "Visual, structural and performance upgrades for existing websites.",
    detail:
      "Sharper hierarchy, cleaner navigation, mobile-first optimization and a more reliable digital presence.",
    icon: Wand2,
  },
  {
    slug: "whatsapp-integrado",
    title: "WhatsApp integrado",
    summary: "Direct contact flows for clients who prefer fast conversations.",
    detail:
      "Visible contact paths, professional messaging and direct quote links from key pages.",
    icon: MessageCircle,
  },
  {
    slug: "seo-basico",
    title: "SEO básico",
    summary: "Titles, descriptions, sitemap, robots and semantic structure for search engines.",
    detail:
      "Technical preparation for Google Search Console, Open Graph, Twitter cards and search-intent pages.",
    icon: SearchCheck,
  },
  {
    slug: "automatizacion-de-correos",
    title: "Automatización de correos",
    summary: "Email notifications and response flows so important contacts do not get lost.",
    detail:
      "Modern email flows with tools like Resend, prepared for a later operational phase.",
    icon: MailCheck,
  },
];

export const projects = [
  {
    slug: "casa-brava-menu",
    name: "Casa Brava Menu",
    category: "Menú digital",
    technologies: ["HTML", "CSS", "JavaScript", "Firebase"],
    result: "The menu became clearer on mobile and the restaurant can present products with a more modern digital image.",
    problem: "El restaurante necesitaba mostrar su menú de forma rápida, visual y fácil de navegar desde celular.",
    solution:
      "Se construyó un menú digital responsive con categorías claras, experiencia ligera y estructura lista para consulta inmediata.",
    screenshots: [],
  },
  {
    slug: "bekys-cake",
    name: "Beky's Cake",
    category: "Sitio para pedidos",
    technologies: ["JavaScript", "Supabase", "Firebase", "Vercel"],
    result: "The brand gained a clearer path to turn visitors into custom order requests.",
    problem: "La marca necesitaba presentar pasteles con confianza y recibir pedidos de forma más ordenada.",
    solution:
      "Se diseñó una experiencia cálida, visual y enfocada en cotizaciones con secciones pensadas para productos personalizados.",
    screenshots: [],
  },
  {
    slug: "haru-logistics-group",
    name: "Haru Logistics Group",
    category: "Web corporativa",
    technologies: ["HTML", "CSS", "JavaScript", "Firebase"],
    result: "The company communicates services with stronger credibility and makes B2B contact easier.",
    problem: "La empresa requería una presencia digital más confiable para explicar servicios logísticos y rutas.",
    solution:
      "Se creó una web corporativa con servicios, rutas, seguimiento y llamadas a la acción para clientes B2B.",
    screenshots: [],
  },
  {
    slug: "kadsa",
    name: "KADSA",
    category: "Catálogo web",
    technologies: ["HTML", "CSS", "JavaScript"],
    result: "Products became easier to explore and the brand feels more complete online.",
    problem: "El catálogo necesitaba orden, claridad y una experiencia simple para compradores.",
    solution:
      "Se organizó una interfaz responsive para mostrar productos y orientar al visitante hacia contacto comercial.",
    screenshots: [],
  },
];

export const packages = [
  {
    name: "Landing Page",
    price: "Custom quote",
    audience: "For campaigns, service offers and businesses that want to validate a clear digital offer.",
    includes: ["1 página profesional", "Copy orientado a ventas", "WhatsApp integrado", "SEO básico", "Deploy en Vercel"],
  },
  {
    name: "Web Business",
    price: "Custom quote",
    audience: "For established businesses that need a stronger and more complete online presence.",
    includes: ["Hasta 5 secciones", "Formulario de contacto", "Servicios o galería", "Open Graph", "Soporte post-lanzamiento"],
  },
  {
    name: "Web Pro + CRM",
    price: "Custom quote",
    audience: "For teams preparing commercial follow-up without mixing private operations into the public website.",
    includes: ["Landing premium", "Base lista para CRM futuro", "Arquitectura privada separada", "Automatizaciones base", "SEO avanzado inicial"],
    featured: true,
  },
  {
    name: "E-commerce",
    price: "Custom quote",
    audience: "For brands selling products and needing a clearer catalog, inquiries and order flow.",
    includes: ["Catálogo de productos", "Flujo de pedido", "Integración de contacto", "Base para pagos", "Estructura escalable"],
  },
];

export const benefits = [
  { title: "Global-ready delivery", copy: "Remote workflows, clear communication and web experiences ready for clients in different countries.", icon: Gauge },
  { title: "Contacto sin fricción", copy: "WhatsApp, correo y formularios visibles para que el cliente dé el siguiente paso desde cualquier zona horaria.", icon: MessageCircle },
  { title: "SEO internacional + local", copy: "Metadata, sitemap, robots, URLs limpias y keywords globales combinadas con búsqueda local.", icon: SearchCheck },
  { title: "Escalable por fases", copy: "Primero una web pública premium; después sistemas privados cuando el negocio lo necesite.", icon: ShieldCheck },
];

export const process = [
  "Diagnóstico",
  "Estructura",
  "Diseño",
  "Desarrollo",
  "Revisión",
  "Deploy",
  "Soporte",
];

export const testimonials = [
  {
    quote: "The website feels more professional and clients understand the offer faster from the first visit.",
    name: "Cliente de servicios",
    role: "Service business",
  },
  {
    quote: "The design helped present products with better structure and guide inquiries toward WhatsApp.",
    name: "Cliente e-commerce",
    role: "Marca de productos",
  },
  {
    quote: "Ken Code handled the details, speed and mobile experience. The site felt ready to sell.",
    name: "Cliente corporativo",
    role: "Servicios B2B",
  },
];

export const techStack = ["Next.js", "TypeScript", "Tailwind CSS", "Framer Motion", "Firebase", "Vercel"];

export const blogTopics = [
  "How a landing page helps service businesses sell internationally",
  "What a modern business website needs to earn trust",
  "International SEO and local SEO basics for growing brands",
];

export { BarChart3, CheckCircle2, Headphones };
