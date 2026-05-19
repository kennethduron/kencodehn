export type SeoService = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  problem: string;
  solution: string;
  benefits: string[];
  includes: string[];
  process: string[];
  relatedProjects: string[];
  relatedServices: string[];
  faq: { question: string; answer: string }[];
  keywords: string[];
  cta: string;
};

export const seoServices: SeoService[] = [
  {
    slug: "paginas-web-honduras",
    title: "Paginas web en Honduras",
    metaTitle: "Paginas web en Honduras para negocios | Ken Code",
    metaDescription:
      "Diseno y desarrollo de paginas web profesionales en Honduras para negocios que necesitan confianza, contactos, WhatsApp, SEO base y presencia digital moderna.",
    h1: "Paginas web en Honduras para negocios que quieren crecer con confianza",
    intro:
      "Ken Code crea paginas web profesionales para empresas, marcas y emprendedores en Honduras que necesitan una presencia digital seria, rapida y preparada para convertir visitas en conversaciones reales.",
    problem:
      "Muchos negocios en Honduras dependen solo de redes sociales. Eso limita la confianza, dificulta explicar servicios y hace que los clientes no encuentren informacion clara cuando buscan en Google.",
    solution:
      "Construimos una web ordenada, responsive y enfocada en negocio: servicios claros, formularios, WhatsApp, llamadas a la accion, SEO base y una estructura lista para crecer por fases.",
    benefits: ["Mayor confianza desde Google", "Contacto directo por WhatsApp", "Web rapida en celulares", "Contenido claro para vender", "SEO base local", "Formulario conectado al CRM"],
    includes: ["Estructura comercial", "Diseno responsive", "Secciones de servicios", "Formulario de contacto", "WhatsApp integrado", "Metadata SEO", "Sitemap y robots", "Soporte de lanzamiento"],
    process: ["Diagnostico del negocio", "Estructura de la pagina", "Diseno visual", "Desarrollo", "Revision en celular", "Lanzamiento", "Soporte inicial"],
    relatedProjects: ["bekys-cake", "asesoria-educativa-diaca", "sariah-rivera-servicios-legales"],
    relatedServices: ["paginas-web-para-negocios-locales", "landing-pages", "redisenio-web"],
    faq: [
      { question: "Cuanto cuesta una pagina web en Honduras?", answer: "Depende del alcance, cantidad de secciones, contenido y funciones. Ken Code trabaja con cotizacion personalizada para recomendar una solucion realista." },
      { question: "La pagina funciona en celular?", answer: "Si. Cada pagina se construye responsive para que se vea profesional en telefono, tablet y escritorio." },
      { question: "Puedo recibir mensajes por WhatsApp?", answer: "Si. Integramos WhatsApp con mensajes preparados para que el cliente contacte rapido desde las secciones importantes." },
    ],
    keywords: ["paginas web Honduras", "diseno web Honduras", "desarrollo web Honduras", "pagina web profesional Honduras"],
    cta: "Cotizar pagina web",
  },
  {
    slug: "landing-pages",
    title: "Landing pages",
    metaTitle: "Landing pages para vender servicios | Ken Code",
    metaDescription:
      "Landing pages profesionales para campanas, servicios y negocios que necesitan convertir visitas en clientes con mensajes claros, WhatsApp y formularios.",
    h1: "Landing pages enfocadas en convertir visitantes en clientes",
    intro:
      "Una landing page bien construida ayuda a presentar una oferta concreta, eliminar distracciones y guiar al visitante hacia una accion: escribir por WhatsApp, solicitar informacion o enviar una cotizacion.",
    problem:
      "Cuando una campana envia trafico a una pagina generica, el visitante se pierde entre demasiadas opciones y no entiende rapido por que debe contactar.",
    solution:
      "Creamos paginas de aterrizaje con una promesa clara, beneficios visibles, prueba de confianza, CTA fuerte y formulario conectado al flujo interno de leads.",
    benefits: ["Mensaje comercial directo", "Mas conversion para campanas", "Carga rapida", "Formulario profesional", "WhatsApp visible", "Medicion y estructura SEO base"],
    includes: ["Hero persuasivo", "Beneficios", "Seccion de confianza", "Preguntas frecuentes", "Formulario", "CTA final", "Open Graph", "SEO tecnico base"],
    process: ["Analisis de la oferta", "Definicion del mensaje", "Wireframe", "Diseno", "Desarrollo", "Pruebas", "Lanzamiento"],
    relatedProjects: ["bekys-cake", "casa-brava-menu", "kadsa"],
    relatedServices: ["paginas-web-honduras", "paginas-web-para-negocios-locales", "redisenio-web"],
    faq: [
      { question: "Para que sirve una landing page?", answer: "Sirve para enfocar una oferta especifica y aumentar la probabilidad de que el visitante contacte o solicite informacion." },
      { question: "Es mejor que una pagina completa?", answer: "Depende del objetivo. Para campanas o servicios puntuales, una landing suele convertir mejor. Para una marca completa, conviene un sitio web." },
      { question: "Puede conectarse con mi CRM?", answer: "Si. El formulario puede enviar leads al CRM privado de Ken Code o dejar la base lista para integraciones futuras." },
    ],
    keywords: ["landing pages", "landing page Honduras", "pagina de aterrizaje", "landing page para servicios"],
    cta: "Cotizar landing page",
  },
  {
    slug: "ecommerce",
    title: "Ecommerce",
    metaTitle: "Ecommerce y tiendas en linea | Ken Code",
    metaDescription:
      "Desarrollo de ecommerce, catalogos web y tiendas en linea para marcas que necesitan vender productos con claridad, confianza y contacto directo.",
    h1: "Ecommerce y tiendas en linea para marcas que quieren vender con orden",
    intro:
      "Ken Code ayuda a negocios que venden productos a presentar catalogos, categorias, informacion clave y rutas de pedido con una experiencia moderna y facil de usar.",
    problem:
      "Muchas marcas venden solo por mensajes sueltos, fotos dispersas o redes sociales. Eso hace dificil ordenar productos, explicar detalles y responder consultas repetidas.",
    solution:
      "Creamos una experiencia de ecommerce o catalogo web segun la etapa del negocio, con productos claros, llamados a la accion, WhatsApp y base preparada para crecer hacia pagos o panel.",
    benefits: ["Catalogo ordenado", "Mayor confianza visual", "Productos faciles de explorar", "Contacto directo", "Base escalable", "SEO para productos y categorias"],
    includes: ["Catalogo de productos", "Categorias", "Detalle de producto", "Ruta de pedido", "WhatsApp integrado", "SEO base", "Responsive", "Preparacion para pagos futuros"],
    process: ["Revision del catalogo", "Estructura de categorias", "Diseno de experiencia", "Carga inicial", "Pruebas de pedido", "Lanzamiento", "Mejoras posteriores"],
    relatedProjects: ["kadsa", "bekys-cake"],
    relatedServices: ["landing-pages", "paginas-web-para-negocios-locales", "crm-para-empresas"],
    faq: [
      { question: "Necesito pagos en linea desde el inicio?", answer: "No siempre. Algunos negocios empiezan con catalogo y pedidos por WhatsApp, y luego agregan pagos cuando el flujo esta validado." },
      { question: "Puedo mostrar productos sin vender directamente?", answer: "Si. Un catalogo web profesional puede generar consultas y ordenar la oferta sin checkout completo." },
      { question: "El ecommerce puede crecer por fases?", answer: "Si. Se puede iniciar con catalogo, luego agregar panel, pagos, inventario o automatizaciones." },
    ],
    keywords: ["ecommerce Honduras", "tienda en linea Honduras", "catalogo web", "desarrollo ecommerce"],
    cta: "Cotizar ecommerce",
  },
  {
    slug: "crm-para-empresas",
    title: "CRM para empresas",
    metaTitle: "CRM para empresas y seguimiento de leads | Ken Code",
    metaDescription:
      "CRM privado para empresas que necesitan organizar leads, tareas, notas, recordatorios, notificaciones y seguimiento comercial desde un panel profesional.",
    h1: "CRM para empresas que necesitan ordenar clientes, tareas y seguimiento",
    intro:
      "Un CRM ayuda a que las solicitudes no se pierdan. Ken Code prepara sistemas privados para organizar leads, notas, tareas, recordatorios y oportunidades de negocio.",
    problem:
      "Cuando los contactos llegan por WhatsApp, correo y formularios sin un sistema, es facil olvidar seguimientos, perder clientes potenciales o no saber que paso con cada oportunidad.",
    solution:
      "Construimos una base CRM privada conectada a la web publica, con leads, tareas, notificaciones, emails, activity logs y estructura segura para crecer con el negocio.",
    benefits: ["Leads centralizados", "Tareas con recordatorios", "Historial de actividad", "Notificaciones internas", "Emails automaticos", "Panel privado seguro"],
    includes: ["Dashboard", "Lista de leads", "Detalle de lead", "Notas internas", "Tareas", "Notificaciones", "Activity logs", "Arquitectura server-side"],
    process: ["Analisis del flujo comercial", "Modelo de datos", "Diseno del panel", "Integracion con formularios", "Pruebas de seguridad", "Lanzamiento", "Mejoras por uso real"],
    relatedProjects: ["kenneth-logistics-group", "sariah-rivera-servicios-legales"],
    relatedServices: ["paginas-web-honduras", "desarrollo-web-internacional", "ecommerce"],
    faq: [
      { question: "Un CRM reemplaza WhatsApp?", answer: "No. El CRM organiza el seguimiento; WhatsApp sigue siendo un canal de contacto rapido." },
      { question: "Puede conectarse al formulario de mi web?", answer: "Si. La idea es que cada solicitud llegue al sistema para dar seguimiento con mayor orden." },
      { question: "Es seguro?", answer: "El panel debe estar separado de la web publica, con rutas protegidas y operaciones sensibles server-side." },
    ],
    keywords: ["CRM para empresas", "CRM Honduras", "seguimiento de leads", "panel administrativo para negocios"],
    cta: "Cotizar CRM",
  },
  {
    slug: "paginas-web-para-restaurantes",
    title: "Paginas web para restaurantes",
    metaTitle: "Paginas web para restaurantes y menus digitales | Ken Code",
    metaDescription:
      "Paginas web para restaurantes con menu digital, contacto por WhatsApp, imagen profesional, navegacion movil y base SEO local.",
    h1: "Paginas web para restaurantes que quieren mostrar mejor su menu y recibir mas consultas",
    intro:
      "Los restaurantes necesitan una experiencia rapida, visual y facil desde celular. Ken Code crea menus digitales y paginas web que ayudan al cliente a decidir y contactar.",
    problem:
      "Si el menu esta perdido en redes sociales o en imagenes dificiles de leer, el cliente se frustra, pregunta de mas o se va con otra opcion.",
    solution:
      "Creamos paginas para restaurantes con categorias claras, fotos, informacion de contacto, horarios, ubicacion, WhatsApp y una experiencia movil pensada para decidir rapido.",
    benefits: ["Menu facil de navegar", "Mejor experiencia movil", "WhatsApp directo", "Imagen mas profesional", "SEO local", "Promociones y categorias ordenadas"],
    includes: ["Menu digital", "Categorias", "Seccion de ubicacion", "Horarios", "WhatsApp", "Galeria", "SEO local", "CTA para pedidos o reservas"],
    process: ["Revision del menu", "Organizacion por categorias", "Diseno visual", "Carga de productos", "Pruebas en celular", "Publicacion", "Ajustes de carta"],
    relatedProjects: ["casa-brava-menu", "bekys-cake"],
    relatedServices: ["paginas-web-honduras", "landing-pages", "paginas-web-para-negocios-locales"],
    faq: [
      { question: "Puedo tener solo un menu digital?", answer: "Si. Un menu digital puede ser una primera fase rapida para mejorar la experiencia de clientes desde celular." },
      { question: "Se puede conectar con WhatsApp?", answer: "Si. Los botones pueden llevar a pedidos, reservas o consultas por WhatsApp." },
      { question: "Sirve para Google?", answer: "Si. Una web bien estructurada ayuda a que el restaurante tenga una presencia mas clara para busquedas locales." },
    ],
    keywords: ["paginas web para restaurantes", "menu digital Honduras", "web para restaurante", "menu online"],
    cta: "Cotizar web para restaurante",
  },
  {
    slug: "paginas-web-para-negocios-locales",
    title: "Paginas web para negocios locales",
    metaTitle: "Paginas web para negocios locales | Ken Code",
    metaDescription:
      "Paginas web para negocios locales que necesitan verse profesionales, explicar servicios, recibir contactos y aparecer mejor ante clientes que buscan en internet.",
    h1: "Paginas web para negocios locales que quieren verse mas confiables",
    intro:
      "Una web profesional ayuda a que un negocio local no dependa solo de recomendaciones o redes sociales. Sirve para explicar, mostrar, responder dudas y convertir visitas en contactos.",
    problem:
      "Los clientes buscan informacion antes de escribir: servicios, horarios, ubicacion, fotos, confianza y formas de contacto. Si no encuentran eso, el negocio pierde oportunidades.",
    solution:
      "Creamos sitios claros para negocios locales con secciones esenciales, contacto rapido, SEO base, formularios y una imagen visual que transmite seriedad.",
    benefits: ["Presencia profesional", "Mas confianza", "Contacto rapido", "Informacion ordenada", "SEO local", "Base para crecer"],
    includes: ["Inicio", "Servicios", "Galeria o productos", "Contacto", "Formulario", "WhatsApp", "Preguntas frecuentes", "Sitemap"],
    process: ["Diagnostico", "Mapa de contenido", "Diseno", "Desarrollo", "Revision con el negocio", "Publicacion", "Soporte"],
    relatedProjects: ["bekys-cake", "asesoria-educativa-diaca", "kadsa"],
    relatedServices: ["paginas-web-honduras", "landing-pages", "redisenio-web"],
    faq: [
      { question: "Una web ayuda aunque ya tenga redes sociales?", answer: "Si. Las redes ayudan a comunicar, pero una web propia da mas confianza, orden y control sobre la informacion." },
      { question: "Puedo empezar con pocas secciones?", answer: "Si. Se puede iniciar con lo esencial y crecer cuando el negocio tenga mas contenido o necesidades." },
      { question: "Incluye SEO?", answer: "Incluye una base tecnica SEO: metadata, sitemap, robots, URLs limpias y contenido organizado." },
    ],
    keywords: ["paginas web para negocios locales", "web para negocios pequenos", "diseno web negocios", "sitios web para empresas"],
    cta: "Cotizar web para negocio",
  },
  {
    slug: "desarrollo-web-internacional",
    title: "Desarrollo web internacional",
    metaTitle: "Desarrollo web internacional y remoto | Ken Code",
    metaDescription:
      "Desarrollo web internacional para negocios que trabajan remoto con clientes de Honduras, Latinoamerica, Estados Unidos y otros mercados.",
    h1: "Desarrollo web internacional para negocios que atienden clientes en distintos mercados",
    intro:
      "Ken Code trabaja de forma remota con empresas, marcas y fundadores que necesitan una web profesional preparada para clientes locales e internacionales.",
    problem:
      "Cuando un negocio quiere vender fuera de su ciudad o pais, necesita una presencia digital clara, confiable y facil de entender para diferentes audiencias.",
    solution:
      "Construimos sitios bilingues o preparados para mercados internacionales, con estructura clara, SEO local e internacional, formularios y rutas de contacto sin friccion.",
    benefits: ["Trabajo remoto ordenado", "Base bilingue", "SEO internacional", "Contacto desde cualquier pais", "Imagen premium", "Proceso claro por etapas"],
    includes: ["Arquitectura bilingue", "Metadata por idioma", "Hreflang", "Open Graph", "Formulario", "WhatsApp", "Contenido comercial", "Preparacion para crecimiento"],
    process: ["Definicion de mercado", "Estructura de idiomas", "Mensaje comercial", "Diseno", "Desarrollo", "Pruebas internacionales", "Lanzamiento"],
    relatedProjects: ["kenneth-logistics-group", "sariah-rivera-servicios-legales", "kadsa"],
    relatedServices: ["paginas-web-honduras", "crm-para-empresas", "ecommerce"],
    faq: [
      { question: "Puedo trabajar con Ken Code desde otro pais?", answer: "Si. El proceso esta pensado para trabajo remoto con comunicacion clara y entregas por etapas." },
      { question: "Mi web puede estar en espanol e ingles?", answer: "Si. La arquitectura puede prepararse con rutas por idioma, metadata y alternates para buscadores." },
      { question: "Sirve para clientes en Estados Unidos?", answer: "Si. Se puede orientar el contenido y la experiencia a clientes internacionales manteniendo una base tecnica solida." },
    ],
    keywords: ["desarrollo web internacional", "web development Honduras", "remote web developer", "desarrollo web remoto"],
    cta: "Cotizar proyecto internacional",
  },
  {
    slug: "redisenio-web",
    title: "Redisenio web",
    metaTitle: "Redisenio web profesional para negocios | Ken Code",
    metaDescription:
      "Redisenio web para negocios que necesitan mejorar claridad, velocidad, experiencia movil, SEO base y conversion sin perder su identidad.",
    h1: "Redisenio web para convertir una pagina antigua en una presencia profesional",
    intro:
      "Si tu web se ve desactualizada, carga lento o no convierte visitantes, un redisenio puede mejorar la confianza, la claridad y el contacto comercial.",
    problem:
      "Una pagina antigua puede hacer que el negocio parezca descuidado, confundir al visitante o perder clientes por mala experiencia movil.",
    solution:
      "Reordenamos la estructura, mejoramos jerarquia visual, contenido, velocidad, responsive y llamados a la accion para que la web vuelva a trabajar por el negocio.",
    benefits: ["Mejor primera impresion", "Mas claridad", "Experiencia movil moderna", "SEO tecnico actualizado", "CTA visibles", "Base preparada para crecer"],
    includes: ["Auditoria visual", "Reestructura de contenido", "Nuevo diseno", "Responsive", "Optimización de metadata", "Formularios", "WhatsApp", "Lanzamiento asistido"],
    process: ["Revision del sitio actual", "Diagnostico", "Nueva estructura", "Diseno", "Migracion de contenido", "Pruebas", "Publicacion"],
    relatedProjects: ["asesoria-educativa-diaca", "sariah-rivera-servicios-legales", "kenneth-logistics-group"],
    relatedServices: ["paginas-web-honduras", "landing-pages", "desarrollo-web-internacional"],
    faq: [
      { question: "Puedo mantener mi dominio?", answer: "Si. El redisenio puede publicarse manteniendo el dominio actual, cuidando la configuracion para no perder continuidad." },
      { question: "Se puede mejorar el SEO?", answer: "Si. Se revisan metadata, estructura, URLs, contenido y sitemap para dejar una base tecnica mas ordenada." },
      { question: "Cuanto cambia la web actual?", answer: "Depende del diagnostico. A veces basta mejorar estructura y diseno; otras veces conviene reconstruir la experiencia completa." },
    ],
    keywords: ["redisenio web", "redisenio de paginas web", "mejorar sitio web", "web profesional para negocios"],
    cta: "Cotizar redisenio",
  },
];

export function getSeoService(slug: string) {
  return seoServices.find((service) => service.slug === slug);
}
