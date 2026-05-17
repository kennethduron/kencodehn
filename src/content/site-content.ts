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
  projects: Project[];
  packages: Package[];
  benefits: { title: string; copy: string; icon: LucideIcon }[];
  process: string[];
  testimonials: { quote: string; name: string; role: string }[];
  strengths: string[];
  blogTopics: string[];
};

const images = {
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
        title: "Paginas de aterrizaje",
        summary: "Paginas enfocadas en campanas, servicios y solicitudes calificadas.",
        detail:
          "Estructura clara, mensaje comercial, llamadas a la accion visibles y una experiencia pensada para convertir visitas en conversaciones reales.",
        icon: Rocket,
      },
      {
        slug: "sitios-web-para-negocios",
        title: "Sitios web para negocios",
        summary: "Presencia profesional para marcas que necesitan claridad, confianza y alcance internacional.",
        detail:
          "Secciones ordenadas, diseno responsive, contenido enfocado en negocio y una base preparada para crecer por etapas.",
        icon: MonitorSmartphone,
      },
      {
        slug: "ecommerce",
        title: "Tienda en linea",
        summary: "Catalogos y flujos de pedido para marcas que venden en diferentes mercados.",
        detail:
          "Productos, categorias, mensajes de compra y rutas de contacto listas para recibir consultas o pedidos con mayor orden.",
        icon: ShoppingCart,
      },
      {
        slug: "panel-administrativo",
        title: "Panel administrativo",
        summary: "Base privada para organizar contactos, solicitudes y seguimiento comercial.",
        detail:
          "La web publica queda preparada para una fase privada posterior, sin mezclar informacion interna con la experiencia del cliente.",
        icon: Blocks,
      },
      {
        slug: "rediseno-web",
        title: "Rediseno web",
        summary: "Mejoras visuales, estructurales y de rendimiento para sitios existentes.",
        detail:
          "Jerarquia mas clara, navegacion simple, optimizacion para celulares y una presencia digital mas confiable.",
        icon: Wand2,
      },
      {
        slug: "whatsapp-integrado",
        title: "WhatsApp integrado",
        summary: "Rutas de contacto directo para clientes que prefieren conversaciones rapidas.",
        detail:
          "Botones visibles, mensajes profesionales y enlaces de cotizacion desde las paginas importantes.",
        icon: MessageCircle,
      },
      {
        slug: "seo-basico",
        title: "SEO basico",
        summary: "Titulos, descripciones, sitemap, robots y estructura semantica para buscadores.",
        detail:
          "Preparacion para Google Search Console, previews sociales, URLs limpias y contenido organizado para busqueda local e internacional.",
        icon: SearchCheck,
      },
      {
        slug: "automatizacion-de-correos",
        title: "Automatizacion de correos",
        summary: "Notificaciones y respuestas iniciales para que los contactos importantes no se pierdan.",
        detail:
          "Flujos de comunicacion preparados para responder mejor y mantener orden en solicitudes comerciales.",
        icon: MailCheck,
      },
    ],
    projects: [
      {
        slug: "casa-brava-menu",
        name: "Casa Brava Menu",
        category: "Menu digital",
        description: "Menu visual para restaurante con navegacion rapida desde celular.",
        result: "El restaurante presenta productos con mas claridad y una imagen digital moderna.",
        problem: "El restaurante necesitaba mostrar su menu de forma rapida, visual y facil de navegar desde celular.",
        solution:
          "Se construyo una experiencia ligera con categorias claras, lectura comoda y acceso directo para clientes que buscan decidir rapido.",
        image: images.casaBrava,
        imageAlt: "Vista del menu digital de Casa Brava creado por Ken Code",
        externalUrl: "https://casabrava.web.app",
        benefits: ["Menu claro", "Experiencia movil", "Contacto directo"],
      },
      {
        slug: "bekys-cake",
        name: "Beky's Cake",
        category: "Sitio para pedidos",
        description: "Web dulce y profesional para mostrar pasteles personalizados y recibir solicitudes.",
        result: "La marca tiene una ruta mas clara para convertir visitantes en pedidos personalizados.",
        problem: "La marca necesitaba presentar pasteles con confianza y recibir pedidos de forma mas ordenada.",
        solution:
          "Se diseno una experiencia calida, visual y enfocada en cotizaciones con secciones pensadas para productos personalizados.",
        image: images.bekysCake,
        imageAlt: "Sitio web de Beky's Cake con presentacion de pasteles personalizados",
        externalUrl: "https://bekyscake.com",
        benefits: ["Diseno emocional", "Cotizacion rapida", "Confianza visual"],
      },
      {
        slug: "asesoria-educativa-diaca",
        name: "Asesoria Educativa DIACA",
        category: "Servicios educativos",
        description: "Sitio profesional para explicar servicios educativos y generar confianza familiar.",
        result: "Los visitantes entienden mejor la oferta y pueden contactar con mayor seguridad.",
        problem: "El servicio necesitaba comunicar orientacion educativa de forma confiable, humana y ordenada.",
        solution:
          "Se organizo una web clara con beneficios, servicios y llamados a la accion para familias y estudiantes.",
        image: images.diaca,
        imageAlt: "Sitio web de Asesoria Educativa DIACA con presentacion profesional",
        externalUrl: "https://asesoriaeducativadiaca.com",
        benefits: ["Mensaje claro", "Confianza familiar", "Contacto sencillo"],
      },
      {
        slug: "sariah-rivera-servicios-legales",
        name: "Sariah Rivera - Servicios Legales",
        category: "Servicios profesionales",
        description: "Web legal orientada a confianza, confidencialidad y contacto directo.",
        result: "La presencia digital comunica seriedad y facilita nuevas consultas profesionales.",
        problem: "El despacho necesitaba una imagen digital profesional para generar confianza desde la primera visita.",
        solution:
          "Se estructuro una web sobria, clara y orientada a explicar servicios legales con una ruta de contacto simple.",
        image: images.sariah,
        imageAlt: "Sitio web legal de Sariah Rivera desarrollado por Ken Code",
        externalUrl: "https://sariahrivera.web.app",
        benefits: ["Imagen profesional", "Confianza inicial", "Consulta directa"],
      },
      {
        slug: "kadsa",
        name: "KADSA",
        category: "Catalogo web",
        description: "Catalogo visual para presentar productos con una experiencia elegante.",
        result: "Los productos son mas faciles de explorar y la marca se percibe mas completa en linea.",
        problem: "El catalogo necesitaba orden, claridad y una experiencia simple para compradores.",
        solution:
          "Se organizo una interfaz responsive para mostrar productos y orientar al visitante hacia contacto comercial.",
        image: images.kadsa,
        imageAlt: "Catalogo web de KADSA con productos destacados",
        externalUrl: "https://kadsa.web.app",
        benefits: ["Catalogo ordenado", "Marca mas solida", "Exploracion facil"],
      },
      {
        slug: "kenneth-logistics-group",
        name: "Kenneth Logistics Group",
        category: "Web corporativa",
        description: "Presencia corporativa para comunicar servicios logisticos y contacto B2B.",
        result: "La empresa comunica servicios con mayor credibilidad y facilita el contacto comercial.",
        problem: "La empresa requeria una presencia digital mas confiable para explicar servicios logisticos y rutas.",
        solution:
          "Se creo una web corporativa con servicios, rutas, seguimiento y llamadas a la accion para clientes empresariales.",
        image: images.haru,
        imageAlt: "Web corporativa de Kenneth Logistics Group con enfoque logistico",
        externalUrl: "https://kennethlogisticsgroup.web.app/",
        benefits: ["Credibilidad B2B", "Servicios claros", "Contacto comercial"],
      },
    ],
    packages: [
      {
        name: "Pagina de aterrizaje",
        price: "Cotizacion personalizada",
        audience: "Para campanas, servicios puntuales y negocios que quieren validar una oferta digital clara.",
        includes: ["1 pagina profesional", "Mensaje orientado a ventas", "WhatsApp integrado", "SEO basico", "Lanzamiento asistido"],
      },
      {
        name: "Web para negocios",
        price: "Cotizacion personalizada",
        audience: "Para negocios establecidos que necesitan una presencia en linea mas fuerte y completa.",
        includes: ["Hasta 5 secciones", "Formulario de contacto", "Servicios o galeria", "Previews para redes", "Soporte post-lanzamiento"],
      },
      {
        name: "Web Pro + Panel",
        price: "Cotizacion personalizada",
        audience: "Para equipos que quieren preparar seguimiento comercial sin mezclar operaciones privadas con la web publica.",
        includes: ["Web premium", "Base lista para panel futuro", "Area privada separada", "Automatizaciones base", "SEO inicial avanzado"],
        featured: true,
      },
      {
        name: "Tienda en linea",
        price: "Cotizacion personalizada",
        audience: "Para marcas que venden productos y necesitan catalogo, consultas y flujo de pedido mas claro.",
        includes: ["Catalogo de productos", "Flujo de pedido", "Contacto integrado", "Base para pagos", "Estructura escalable"],
      },
    ],
    benefits: [
      { title: "Alcance internacional", copy: "Trabajo remoto, comunicacion clara y experiencias web listas para clientes de diferentes paises.", icon: Gauge },
      { title: "Contacto sin friccion", copy: "WhatsApp, correo y formularios visibles para que el cliente de el siguiente paso desde cualquier zona horaria.", icon: MessageCircle },
      { title: "SEO internacional + local", copy: "Metadata, sitemap, robots, URLs limpias y palabras clave globales combinadas con busqueda local.", icon: SearchCheck },
      { title: "Crecimiento por fases", copy: "Primero una web publica premium; despues sistemas privados cuando el negocio lo necesite.", icon: ShieldCheck },
    ],
    process: ["Diagnostico", "Estructura", "Diseno", "Construccion", "Revision", "Lanzamiento", "Soporte"],
    testimonials: [
      {
        quote: "La web se siente mas profesional y los clientes entienden la oferta desde la primera visita.",
        name: "Cliente de servicios",
        role: "Negocio de servicios",
      },
      {
        quote: "El diseno ayudo a presentar productos con mejor estructura y guiar consultas hacia WhatsApp.",
        name: "Cliente e-commerce",
        role: "Marca de productos",
      },
      {
        quote: "Ken Code cuido los detalles, la rapidez y la experiencia movil. El sitio quedo listo para vender.",
        name: "Cliente corporativo",
        role: "Servicios empresariales",
      },
    ],
    strengths: ["Diseno moderno", "Pagina rapida", "Adaptada a celulares", "Contacto por WhatsApp", "Formularios profesionales", "SEO basico", "Panel administrativo", "Soporte post-lanzamiento", "Experiencia profesional"],
    blogTopics: [
      "Como una landing page ayuda a vender servicios en internet",
      "Que necesita una web moderna para generar confianza",
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
        slug: "admin-panel",
        title: "Admin panel",
        summary: "Private foundation to organize contacts, requests and commercial follow-up.",
        detail:
          "The public website stays ready for a future private phase without mixing internal information into the customer experience.",
        icon: Blocks,
      },
      {
        slug: "website-redesign",
        title: "Website redesign",
        summary: "Visual, structural and performance improvements for existing websites.",
        detail:
          "Sharper hierarchy, simpler navigation, mobile optimization and a more reliable digital presence.",
        icon: Wand2,
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
    projects: [
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
        audience: "For teams preparing commercial follow-up without mixing private operations into the public website.",
        includes: ["Premium website", "Future panel foundation", "Separate private area", "Base automations", "Advanced initial SEO"],
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
      { title: "Phased growth", copy: "First a premium public website; later private systems when the business needs them.", icon: ShieldCheck },
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
    strengths: ["Modern design", "Fast pages", "Mobile-ready", "WhatsApp contact", "Professional forms", "Basic SEO", "Admin panel", "Post-launch support", "Professional experience"],
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
