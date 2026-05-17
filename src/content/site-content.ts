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
    summary: "Páginas enfocadas en campañas, servicios y cotizaciones rápidas.",
    detail:
      "Estructura clara, copy orientado a ventas, CTA visibles y medición base para convertir tráfico en mensajes reales.",
    icon: Rocket,
  },
  {
    slug: "sitios-web-para-negocios",
    title: "Sitios web para negocios",
    summary: "Presencia profesional para marcas que necesitan explicar, inspirar confianza y vender mejor.",
    detail:
      "Secciones organizadas, diseño responsive, contenido comercial y base preparada para crecer con más páginas.",
    icon: MonitorSmartphone,
  },
  {
    slug: "ecommerce",
    title: "E-commerce",
    summary: "Catálogos y flujos de pedido para vender productos con una experiencia ordenada.",
    detail:
      "Productos, categorías, mensajes de compra y una estructura lista para futuras integraciones de pago.",
    icon: ShoppingCart,
  },
  {
    slug: "crm-para-leads",
    title: "CRM para leads",
    summary: "Base para capturar, ordenar y dar seguimiento a oportunidades comerciales.",
    detail:
      "En esta etapa solo dejamos preparada la visión pública. El CRM privado se trabajará después, separado y protegido.",
    icon: Blocks,
  },
  {
    slug: "rediseno-web",
    title: "Rediseño web",
    summary: "Actualización visual, estructura y velocidad para sitios que ya existen.",
    detail:
      "Mejor jerarquía, navegación más limpia, optimización mobile-first y una presencia digital más confiable.",
    icon: Wand2,
  },
  {
    slug: "whatsapp-integrado",
    title: "WhatsApp integrado",
    summary: "Botones y mensajes precargados para que el cliente escriba con menos fricción.",
    detail:
      "Rutas de contacto visibles, texto profesional y enlaces directos para cotización desde cualquier página.",
    icon: MessageCircle,
  },
  {
    slug: "seo-basico",
    title: "SEO básico",
    summary: "Titles, descripciones, sitemap, robots y estructura semántica lista para Google.",
    detail:
      "Preparación técnica para Google Search Console, Open Graph, Twitter cards y páginas con intención clara.",
    icon: SearchCheck,
  },
  {
    slug: "automatizacion-de-correos",
    title: "Automatización de correos",
    summary: "Respuestas y avisos para que ningún contacto importante se pierda.",
    detail:
      "Flujos base con herramientas modernas como Resend, preparados para una siguiente fase operativa.",
    icon: MailCheck,
  },
];

export const projects = [
  {
    slug: "casa-brava-menu",
    name: "Casa Brava Menu",
    category: "Menú digital",
    technologies: ["HTML", "CSS", "JavaScript", "Firebase"],
    result: "El menú quedó más claro en móvil y el restaurante puede presentar productos con una imagen más moderna.",
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
    result: "La marca ganó una ruta más directa para convertir visitas en solicitudes de pasteles personalizados.",
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
    result: "La empresa comunica sus servicios con más seriedad y facilita el contacto de prospectos empresariales.",
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
    result: "Los productos quedaron más fáciles de explorar y la marca se percibe más completa digitalmente.",
    problem: "El catálogo necesitaba orden, claridad y una experiencia simple para compradores.",
    solution:
      "Se organizó una interfaz responsive para mostrar productos y orientar al visitante hacia contacto comercial.",
    screenshots: [],
  },
];

export const packages = [
  {
    name: "Landing Page",
    price: "Desde L 8,000",
    audience: "Para campañas, servicios puntuales y negocios que quieren validar una oferta.",
    includes: ["1 página profesional", "Copy orientado a ventas", "WhatsApp integrado", "SEO básico", "Deploy en Vercel"],
  },
  {
    name: "Web Business",
    price: "Desde L 14,000",
    audience: "Para negocios establecidos que necesitan una presencia más completa.",
    includes: ["Hasta 5 secciones", "Formulario de contacto", "Servicios o galería", "Open Graph", "Soporte post-lanzamiento"],
  },
  {
    name: "Web Pro + CRM",
    price: "Desde L 22,000",
    audience: "Para equipos que quieren preparar seguimiento comercial sin mezclarlo con la web pública.",
    includes: ["Landing premium", "Base lista para CRM futuro", "Arquitectura privada separada", "Automatizaciones base", "SEO avanzado inicial"],
    featured: true,
  },
  {
    name: "E-commerce",
    price: "Desde L 28,000",
    audience: "Para marcas que venden productos y quieren ordenar catálogo, consultas y pedidos.",
    includes: ["Catálogo de productos", "Flujo de pedido", "Integración de contacto", "Base para pagos", "Estructura escalable"],
  },
];

export const benefits = [
  { title: "Velocidad y claridad", copy: "Páginas ligeras, responsive y fáciles de entender desde el primer vistazo.", icon: Gauge },
  { title: "Contacto sin fricción", copy: "WhatsApp, correo y formularios visibles para que el cliente dé el siguiente paso.", icon: MessageCircle },
  { title: "Base SEO lista", copy: "Metadata, sitemap, robots, URLs limpias y estructura semántica para indexación.", icon: SearchCheck },
  { title: "Escalable por fases", copy: "Primero web pública profesional; después CRM privado cuando llegue el momento.", icon: ShieldCheck },
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
    quote: "La página se siente más profesional y ahora los clientes entienden mejor lo que ofrecemos desde el primer vistazo.",
    name: "Cliente de servicios",
    role: "Negocio local",
  },
  {
    quote: "El diseño ayudó a presentar productos con más orden y a dirigir las consultas hacia WhatsApp.",
    name: "Cliente e-commerce",
    role: "Marca de productos",
  },
  {
    quote: "Ken Code cuidó los detalles, la velocidad y la versión móvil. El sitio se sintió listo para vender.",
    name: "Cliente corporativo",
    role: "Servicios B2B",
  },
];

export const techStack = ["Next.js", "TypeScript", "Tailwind CSS", "Framer Motion", "Firebase", "Vercel"];

export const blogTopics = [
  "Cómo una landing page ayuda a vender servicios en Honduras",
  "Qué debe tener una página web para restaurantes",
  "SEO básico para negocios locales",
];

export { BarChart3, CheckCircle2, Headphones };
