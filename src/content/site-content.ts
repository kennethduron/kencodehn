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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/lib/site";

export type Service = {
  slug: string;
  title: string;
  summary: string;
  detail: string;
  icon: LucideIcon;
};

export type Project = {
  slug: string;
  name: string;
  category: string;
  description: string;
  result: string;
  problem: string;
  solution: string;
  image: string;
  imageAlt: string;
  externalUrl?: string;
  benefits: string[];
  relatedServices?: { label: string; href: string }[];
  gallery?: { image: string; imageAlt: string }[];
};

export type Package = {
  name: string;
  price: string;
  audience: string;
  includes: string[];
  featured?: boolean;
};

type SiteCopy = {
  services: Service[];
  faqs: { question: string; answer: string }[];
  projects: Project[];
  packages: Package[];
  benefits: { title: string; copy: string; icon: LucideIcon }[];
  process: string[];
  testimonials: { quote: string; name: string; role: string }[];
  strengths: string[];
  blogTopics: string[];
};

const images = {
  carZone: "/images/projects/carzoneaccesorios.jpg",
  casaBrava: "/images/projects/casabrava.jpg",
  bekysCake: "/images/projects/bekys_cake.jpg",
  haru: "/images/projects/logistic.jpg",
  kadsa: "/images/projects/kadsa.jpg",
  sariah: "/images/projects/sariahrivera.jpg",
  diaca: "/images/projects/cristian.jpg",
};

export const content: Record<Locale, SiteCopy> = {
  es: {
    services: [
      {
        slug: "landing-pages",
        title: "Páginas de aterrizaje",
        summary: "Páginas enfocadas en campañas, servicios y solicitudes calificadas.",
        detail:
          "Estructura clara, mensaje comercial, llamadas a la acción visibles y una experiencia pensada para convertir visitas en conversaciones reales.",
        icon: Rocket,
      },
      {
        slug: "sitios-web-para-negocios",
        title: "Sitios web para negocios",
        summary: "Presencia profesional para marcas que necesitan claridad, confianza y alcance internacional.",
        detail:
          "Secciones ordenadas, diseño responsive, contenido enfocado en negocio y una base preparada para crecer por etapas.",
        icon: MonitorSmartphone,
      },
      {
        slug: "ecommerce",
        title: "Tienda en línea",
        summary: "Catálogos y flujos de pedido para marcas que venden en diferentes mercados.",
        detail:
          "Productos, categorías, mensajes de compra y rutas de contacto listas para recibir consultas o pedidos con mayor orden.",
        icon: ShoppingCart,
      },
      {
        slug: "sistemas-contables-facturacion",
        title: "Sistemas administrativos, contables y facturación",
        summary: "Plataformas personalizadas para gestionar facturación, ventas, compras, inventario, clientes, cuentas por cobrar y pagar, libros contables, reportes financieros y procesos administrativos desde un solo sistema.",
        detail:
          "Puede incluir libro diario digital, libros contables, automatización de registros administrativos y contables, y apoyo para el control y revisión de movimientos, integrado con inventario, clientes, productos y proveedores según el alcance del negocio.",
        icon: Blocks,
      },
      {
        slug: "whatsapp-integrado",
        title: "WhatsApp integrado",
        summary: "Rutas de contacto directo para clientes que prefieren conversaciones rápidas.",
        detail:
          "Botones visibles, mensajes profesionales y enlaces de cotización desde las páginas importantes.",
        icon: MessageCircle,
      },
      {
        slug: "seo-basico",
        title: "SEO básico",
        summary: "Títulos, descripciones, sitemap, robots y estructura semántica para buscadores.",
        detail:
          "Preparación para Google Search Console, previews sociales, URLs limpias y contenido organizado para búsqueda local e internacional.",
        icon: SearchCheck,
      },
      {
        slug: "automatizacion-de-correos",
        title: "Automatización de correos",
        summary: "Notificaciones y respuestas iniciales para que los contactos importantes no se pierdan.",
        detail:
          "Flujos de comunicación preparados para responder mejor y mantener orden en solicitudes comerciales.",
        icon: MailCheck,
      },
    ],
    faqs: [
      {
        question: "¿Ken Code puede desarrollar sistemas contables o de facturación?",
        answer:
          "Sí. Podemos desarrollar sistemas contables y de facturación adaptados a las necesidades del negocio, incluyendo ventas, compras, cuentas por cobrar, cuentas por pagar, historial de pagos, saldos pendientes, reportes financieros y conexión con inventario o clientes. El alcance exacto se define según los procesos de cada empresa.",
      },
    ],
    projects: [
      {
        slug: "car-zone-accesorios",
        name: "Car Zone Accesorios",
        category: "Catálogo automotriz",
        description: "Plataforma digital para presentar accesorios automotrices, organizar productos y facilitar el contacto con clientes interesados.",
        result: "Presencia digital más profesional para mostrar productos y recibir consultas de clientes.",
        problem: "El negocio necesitaba una forma más clara y profesional de mostrar sus accesorios y facilitar el contacto con compradores.",
        solution:
          "Ken Code desarrolló una experiencia web enfocada en catálogo, presentación de productos y comunicación directa con clientes.",
        image: images.carZone,
        imageAlt: "Vista del proyecto Car Zone Accesorios desarrollado por Ken Code",
        externalUrl: "https://carzoneaccesorios.com",
        benefits: ["Catálogo digital", "Contacto más rápido", "Imagen profesional"],
      },
      {
        slug: "asesoria-educativa-diaca",
        name: "Asesoría Educativa DIACA",
        category: "Servicios educativos",
        description: "Sitio profesional para explicar servicios educativos y generar confianza familiar.",
        result: "Los visitantes entienden mejor la oferta y pueden contactar con mayor seguridad.",
        problem: "El servicio necesitaba comunicar orientación educativa de forma confiable, humana y ordenada.",
        solution:
          "Se organizó una web clara con beneficios, servicios y llamados a la acción para familias y estudiantes.",
        image: images.diaca,
        imageAlt: "Página web educativa DIACA desarrollada por Ken Code",
        externalUrl: "https://asesoriaeducativadiaca.com",
        benefits: ["Mensaje claro", "Confianza familiar", "Contacto sencillo"],
        relatedServices: [{ label: "Páginas web para negocios locales", href: "/servicios/paginas-web-para-negocios-locales" }],
        gallery: [],
      },
      {
        slug: "bekys-cake",
        name: "Beky's Cake",
        category: "Sitio para pedidos",
        description: "Web dulce y profesional para mostrar pasteles personalizados y recibir solicitudes.",
        result: "La marca tiene una ruta más clara para convertir visitantes en pedidos personalizados.",
        problem: "La marca necesitaba presentar pasteles con confianza y recibir pedidos de forma más ordenada.",
        solution:
          "Se diseñó una experiencia cálida, visual y enfocada en cotizaciones con secciones pensadas para productos personalizados.",
        image: images.bekysCake,
        imageAlt: "Sitio web para pastelería Beky's Cake desarrollado por Ken Code",
        externalUrl: "https://bekyscake.com",
        benefits: ["Diseño emocional", "Cotización rápida", "Confianza visual"],
        relatedServices: [
          { label: "Páginas web para negocios locales", href: "/servicios/paginas-web-para-negocios-locales" },
          { label: "Ecommerce", href: "/servicios/ecommerce" },
        ],
        gallery: [],
      },
      {
        slug: "casa-brava-menu",
        name: "Casa Brava Menú",
        category: "Menú digital",
        description: "Menú visual para restaurante con navegación rápida desde celular.",
        result: "El restaurante presenta productos con más claridad y una imagen digital moderna.",
        problem: "El restaurante necesitaba mostrar su menú de forma rápida, visual y fácil de navegar desde celular.",
        solution:
          "Se construyó una experiencia ligera con categorías claras, lectura cómoda y acceso directo para clientes que buscan decidir rápido.",
        image: images.casaBrava,
        imageAlt: "Página web para restaurante Casa Brava creada por Ken Code",
        externalUrl: "https://casabrava.web.app",
        benefits: ["Menú claro", "Experiencia móvil", "Contacto directo"],
        relatedServices: [{ label: "Páginas web para restaurantes", href: "/servicios/paginas-web-para-restaurantes" }],
        gallery: [],
      },
      {
        slug: "sariah-rivera-servicios-legales",
        name: "Sariah Rivera - Servicios Legales",
        category: "Servicios profesionales",
        description: "Web legal orientada a confianza, confidencialidad y contacto directo.",
        result: "La presencia digital comunica seriedad y facilita nuevas consultas profesionales.",
        problem: "El despacho necesitaba una imagen digital profesional para generar confianza desde la primera visita.",
        solution:
          "Se estructuró una web sobria, clara y orientada a explicar servicios legales con una ruta de contacto simple.",
        image: images.sariah,
        imageAlt: "Sitio web para servicios legales Sariah Rivera creado por Ken Code",
        externalUrl: "https://sariahrivera.web.app",
        benefits: ["Imagen profesional", "Confianza inicial", "Consulta directa"],
        relatedServices: [{ label: "Páginas web para negocios locales", href: "/servicios/paginas-web-para-negocios-locales" }],
        gallery: [],
      },
      {
        slug: "kadsa",
        name: "KADSA",
        category: "Catálogo web",
        description: "Catálogo visual para presentar productos con una experiencia elegante.",
        result: "Los productos son más fáciles de explorar y la marca se percibe más completa en línea.",
        problem: "El catálogo necesitaba orden, claridad y una experiencia simple para compradores.",
        solution:
          "Se organizó una interfaz responsive para mostrar productos y orientar al visitante hacia contacto comercial.",
        image: images.kadsa,
        imageAlt: "Catálogo ecommerce KADSA creado por Ken Code",
        externalUrl: "https://kadsa.web.app",
        benefits: ["Catálogo ordenado", "Marca más sólida", "Exploración fácil"],
        relatedServices: [{ label: "Ecommerce", href: "/servicios/ecommerce" }],
        gallery: [],
      },
      {
        slug: "kenneth-logistics-group",
        name: "Kenneth Logistics Group",
        category: "Web corporativa",
        description: "Presencia corporativa para comunicar servicios logísticos y contacto B2B.",
        result: "La empresa comunica servicios con mayor credibilidad y facilita el contacto comercial.",
        problem: "La empresa requería una presencia digital más confiable para explicar servicios logísticos y rutas.",
        solution:
          "Se creó una web corporativa con servicios, rutas, seguimiento y llamadas a la acción para clientes empresariales.",
        image: images.haru,
        imageAlt: "Página web de logística Kenneth Logistics Group desarrollada por Ken Code",
        externalUrl: "https://kennethlogisticsgroup.web.app/",
        benefits: ["Credibilidad B2B", "Servicios claros", "Contacto comercial"],
        relatedServices: [
          { label: "CRM para empresas", href: "/servicios/crm-para-empresas" },
          { label: "Desarrollo web internacional", href: "/servicios/desarrollo-web-internacional" },
        ],
        gallery: [],
      },
    ],
    packages: [
      {
        name: "Página de aterrizaje",
        price: "Cotización personalizada",
        audience: "Para campañas, servicios puntuales y negocios que quieren validar una oferta digital clara.",
        includes: ["1 página profesional", "Mensaje orientado a ventas", "WhatsApp integrado", "SEO básico", "Lanzamiento asistido"],
      },
      {
        name: "Web para negocios",
        price: "Cotización personalizada",
        audience: "Para negocios establecidos que necesitan una presencia en línea más fuerte y completa.",
        includes: ["Hasta 5 secciones", "Formulario de contacto", "Servicios o galería", "Previews para redes", "Soporte post-lanzamiento"],
      },
      {
        name: "Web Pro + Panel",
        price: "Cotización personalizada",
        audience: "Para equipos que necesitan una web profesional, un panel administrativo y sistemas personalizados de gestión interna, contabilidad o facturación adaptados a sus procesos.",
        includes: ["Web premium", "Panel administrativo según alcance", "Gestión interna, contable o de facturación", "Automatizaciones base", "SEO inicial avanzado"],
        featured: true,
      },
      {
        name: "Tienda en línea",
        price: "Cotización personalizada",
        audience: "Para marcas que venden productos y necesitan catálogo, consultas y flujo de pedido más claro.",
        includes: ["Catálogo de productos", "Flujo de pedido", "Contacto integrado", "Base para pagos", "Estructura escalable"],
      },
    ],
    benefits: [
      { title: "Alcance internacional", copy: "Trabajo remoto, comunicación clara y experiencias web listas para clientes de diferentes países.", icon: Gauge },
      { title: "Contacto sin fricción", copy: "WhatsApp, correo y formularios visibles para que el cliente dé el siguiente paso desde cualquier zona horaria.", icon: MessageCircle },
      { title: "SEO internacional + local", copy: "Metadata, sitemap, robots, URLs limpias y palabras clave globales combinadas con búsqueda local.", icon: SearchCheck },
      { title: "Operaciones conectadas", copy: "Podemos conectar inventario, ventas, clientes y contabilidad por etapas para mejorar el seguimiento y reducir trabajo manual.", icon: ShieldCheck },
    ],
    process: ["Diagnóstico", "Estructura", "Diseño", "Construcción", "Revisión", "Lanzamiento", "Soporte"],
    testimonials: [
      {
        quote: "La web se siente más profesional y los clientes entienden la oferta desde la primera visita.",
        name: "Cliente de servicios",
        role: "Negocio de servicios",
      },
      {
        quote: "El diseño ayudó a presentar productos con mejor estructura y guiar consultas hacia WhatsApp.",
        name: "Cliente e-commerce",
        role: "Marca de productos",
      },
      {
        quote: "Ken Code cuidó los detalles, la rapidez y la experiencia móvil. El sitio quedó listo para vender.",
        name: "Cliente corporativo",
        role: "Servicios empresariales",
      },
    ],
    strengths: ["Diseño moderno", "Página rápida", "Adaptada a celulares", "Contacto por WhatsApp", "Formularios profesionales", "SEO básico", "Sistemas administrativos, contables y facturación", "Soporte post-lanzamiento", "Experiencia profesional"],
    blogTopics: [
      "Cómo una landing page ayuda a vender servicios en internet",
      "Qué necesita una web moderna para generar confianza",
      "SEO local e internacional para negocios que quieren crecer",
    ],
  },
  en: {
    services: [
      {
        slug: "landing-pages",
        title: "Landing pages",
        summary: "Pages focused on campaigns, service offers and qualified inquiries.",
        detail:
          "Clear structure, sales messaging, visible calls to action and an experience designed to turn visits into real conversations.",
        icon: Rocket,
      },
      {
        slug: "business-websites",
        title: "Business websites",
        summary: "Professional presence for brands that need clarity, trust and international reach.",
        detail:
          "Organized sections, responsive design, business-focused content and a foundation prepared to grow in phases.",
        icon: MonitorSmartphone,
      },
      {
        slug: "ecommerce",
        title: "E-commerce",
        summary: "Catalogs and order flows for brands selling across markets.",
        detail:
          "Products, categories, purchase messages and contact paths ready to receive inquiries or orders with better structure.",
        icon: ShoppingCart,
      },
      {
        slug: "accounting-invoicing-systems",
        title: "Administrative, accounting and invoicing systems",
        summary: "Custom platforms to manage invoicing, sales, purchases, inventory, customers, accounts receivable and payable, accounting ledgers, financial reports and administrative processes from one system.",
        detail:
          "They can include a digital general ledger, other accounting ledgers, automated administrative and accounting entries, and support for transaction tracking and review, integrated with inventory, customers, products and suppliers depending on scope.",
        icon: Blocks,
      },
      {
        slug: "whatsapp-contact",
        title: "WhatsApp contact",
        summary: "Direct contact paths for clients who prefer fast conversations.",
        detail:
          "Visible buttons, professional messages and quote links from important pages.",
        icon: MessageCircle,
      },
      {
        slug: "basic-seo",
        title: "Basic SEO",
        summary: "Titles, descriptions, sitemap, robots and semantic structure for search engines.",
        detail:
          "Preparation for Google Search Console, social previews, clean URLs and content organized for local and international search.",
        icon: SearchCheck,
      },
      {
        slug: "email-automation",
        title: "Email automation",
        summary: "Notifications and initial responses so important contacts do not get lost.",
        detail:
          "Communication flows prepared to respond better and keep commercial requests organized.",
        icon: MailCheck,
      },
    ],
    faqs: [
      {
        question: "Can Ken Code build accounting or invoicing systems?",
        answer:
          "Yes. We can build accounting and invoicing systems tailored to the business, including sales, purchases, accounts receivable, accounts payable, payment history, outstanding balances, financial reports and integration with inventory or customers. The exact scope depends on each company's processes.",
      },
    ],
    projects: [
      {
        slug: "car-zone-accesorios",
        name: "Car Zone Accesorios",
        category: "Automotive catalog",
        description: "Digital platform to showcase automotive accessories, organize products, and make it easier for interested customers to get in touch.",
        result: "A more professional digital presence to display products and receive customer inquiries.",
        problem: "The business needed a clearer and more professional way to showcase its accessories and simplify communication with potential buyers.",
        solution:
          "Ken Code developed a web experience focused on catalog presentation, product visibility, and direct customer communication.",
        image: images.carZone,
        imageAlt: "Preview of the Car Zone Accesorios project developed by Ken Code",
        externalUrl: "https://carzoneaccesorios.com",
        benefits: ["Digital catalog", "Faster contact", "Professional image"],
      },
      {
        slug: "asesoria-educativa-diaca",
        name: "Asesoria Educativa DIACA",
        category: "Educational services",
        description: "Professional website to explain educational services and build family trust.",
        result: "Visitors understand the offer better and can contact with greater confidence.",
        problem: "The service needed to communicate educational guidance in a trustworthy, human and organized way.",
        solution:
          "A clear website was organized with benefits, services and calls to action for families and students.",
        image: images.diaca,
        imageAlt: "Asesoria Educativa DIACA professional website presentation",
        externalUrl: "https://asesoriaeducativadiaca.com",
        benefits: ["Clear message", "Family trust", "Easy contact"],
      },
      {
        slug: "bekys-cake",
        name: "Beky's Cake",
        category: "Order website",
        description: "Warm, professional website for custom cakes and quote requests.",
        result: "The brand has a clearer path to turn visitors into custom orders.",
        problem: "The brand needed to present cakes with confidence and receive orders with better structure.",
        solution:
          "A warm, visual experience was designed around quote requests and personalized product presentation.",
        image: images.bekysCake,
        imageAlt: "Beky's Cake website with custom cake presentation",
        externalUrl: "https://bekyscake.com",
        benefits: ["Emotional design", "Fast quotes", "Visual trust"],
      },
      {
        slug: "casa-brava-menu",
        name: "Casa Brava Menu",
        category: "Digital menu",
        description: "Visual restaurant menu with fast mobile navigation.",
        result: "The restaurant presents products more clearly with a modern digital image.",
        problem: "The restaurant needed to show its menu quickly, visually and easily from mobile.",
        solution:
          "A lightweight experience was built with clear categories, comfortable reading and direct access for clients who want to decide quickly.",
        image: images.casaBrava,
        imageAlt: "Casa Brava digital menu view created by Ken Code",
        externalUrl: "https://casabrava.web.app",
        benefits: ["Clear menu", "Mobile experience", "Direct contact"],
      },
      {
        slug: "sariah-rivera-servicios-legales",
        name: "Sariah Rivera - Legal Services",
        category: "Professional services",
        description: "Legal website focused on trust, confidentiality and direct contact.",
        result: "The digital presence communicates seriousness and makes consultations easier.",
        problem: "The practice needed a professional digital image to build trust from the first visit.",
        solution:
          "A sober, clear website was structured to explain legal services with a simple contact path.",
        image: images.sariah,
        imageAlt: "Sariah Rivera legal website developed by Ken Code",
        externalUrl: "https://sariahrivera.web.app",
        benefits: ["Professional image", "Initial trust", "Direct consultation"],
      },
      {
        slug: "kadsa",
        name: "KADSA",
        category: "Web catalog",
        description: "Visual catalog to present products with an elegant experience.",
        result: "Products are easier to explore and the brand feels more complete online.",
        problem: "The catalog needed order, clarity and a simple experience for buyers.",
        solution:
          "A responsive interface was organized to show products and guide visitors toward commercial contact.",
        image: images.kadsa,
        imageAlt: "KADSA web catalog with featured products",
        externalUrl: "https://kadsa.web.app",
        benefits: ["Organized catalog", "Stronger brand", "Easy browsing"],
      },
      {
        slug: "kenneth-logistics-group",
        name: "Kenneth Logistics Group",
        category: "Corporate website",
        description: "Corporate presence to communicate logistics services and B2B contact.",
        result: "The company communicates services with stronger credibility and easier commercial contact.",
        problem: "The company needed a more reliable digital presence to explain logistics services and routes.",
        solution:
          "A corporate website was created with services, routes, tracking and calls to action for business clients.",
        image: images.haru,
        imageAlt: "Kenneth Logistics Group corporate logistics website",
        externalUrl: "https://kennethlogisticsgroup.web.app/",
        benefits: ["B2B credibility", "Clear services", "Commercial contact"],
      },
    ],
    packages: [
      {
        name: "Landing Page",
        price: "Custom quote",
        audience: "For campaigns, specific services and businesses that want to validate a clear digital offer.",
        includes: ["1 professional page", "Sales-focused messaging", "WhatsApp contact", "Basic SEO", "Launch support"],
      },
      {
        name: "Web Business",
        price: "Custom quote",
        audience: "For established businesses that need a stronger and more complete online presence.",
        includes: ["Up to 5 sections", "Contact form", "Services or gallery", "Social previews", "Post-launch support"],
      },
      {
        name: "Web Pro + Panel",
        price: "Custom quote",
        audience: "For teams that need a professional website, an admin panel and custom systems for internal management, accounting or invoicing tailored to their processes.",
        includes: ["Premium website", "Admin panel based on scope", "Internal, accounting or invoicing management", "Base automations", "Advanced initial SEO"],
        featured: true,
      },
      {
        name: "E-commerce",
        price: "Custom quote",
        audience: "For brands selling products and needing a clearer catalog, inquiries and order flow.",
        includes: ["Product catalog", "Order flow", "Integrated contact", "Payment-ready base", "Scalable structure"],
      },
    ],
    benefits: [
      { title: "International reach", copy: "Remote work, clear communication and web experiences ready for clients in different countries.", icon: Gauge },
      { title: "Frictionless contact", copy: "WhatsApp, email and forms visible so clients can take the next step from any time zone.", icon: MessageCircle },
      { title: "International + local SEO", copy: "Metadata, sitemap, robots, clean URLs and global keywords combined with local search.", icon: SearchCheck },
      { title: "Connected operations", copy: "We can connect inventory, sales, customers and accounting in phases to improve tracking and reduce manual work.", icon: ShieldCheck },
    ],
    process: ["Diagnosis", "Structure", "Design", "Build", "Review", "Launch", "Support"],
    testimonials: [
      {
        quote: "The website feels more professional and clients understand the offer from the first visit.",
        name: "Service client",
        role: "Service business",
      },
      {
        quote: "The design helped present products with better structure and guide inquiries toward WhatsApp.",
        name: "E-commerce client",
        role: "Product brand",
      },
      {
        quote: "Ken Code handled the details, speed and mobile experience. The site felt ready to sell.",
        name: "Corporate client",
        role: "Business services",
      },
    ],
    strengths: ["Modern design", "Fast pages", "Mobile-ready", "WhatsApp contact", "Professional forms", "Basic SEO", "Administrative, accounting and invoicing systems", "Post-launch support", "Professional experience"],
    blogTopics: [
      "How a landing page helps service businesses sell online",
      "What a modern website needs to build trust",
      "Local and international SEO for growing businesses",
    ],
  },
};

export const services = content.es.services;
export const projects = content.es.projects;
export const packages = content.es.packages;
export const benefits = content.es.benefits;
export const process = content.es.process;
export const testimonials = content.es.testimonials;
export const strengths = content.es.strengths;
export const blogTopics = content.es.blogTopics;

export function getContent(locale: Locale) {
  return content[locale];
}

export { BarChart3, CheckCircle2, Headphones };
