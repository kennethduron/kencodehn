import knowledgeBase from "@/content/ai-knowledge.json";
import { SAFE_AI_FALLBACK } from "@/lib/ai/guardrails";

type KnowledgeRecord = Record<string, unknown>;

type KnowledgeChunk = {
  id: string;
  title: string;
  answer: string;
  searchable: string;
  priority: number;
};

export type KnowledgeAnswer = {
  answer: string;
  matched: boolean;
};

const QUOTE_PATH = "/cotizar";
const CONTACT_PATH = "/contacto";
const WHATSAPP_URL = "https://wa.me/50499112211";

const STOP_WORDS = new Set([
  "a",
  "al",
  "and",
  "are",
  "como",
  "con",
  "cual",
  "cuales",
  "cuando",
  "de",
  "del",
  "do",
  "el",
  "en",
  "es",
  "for",
  "hay",
  "i",
  "in",
  "is",
  "la",
  "las",
  "los",
  "me",
  "mi",
  "of",
  "on",
  "para",
  "por",
  "que",
  "se",
  "the",
  "to",
  "tu",
  "un",
  "una",
  "what",
  "y",
]);

const BRAND_TOKENS = new Set(["ken", "code", "kencode", "kencodehn"]);

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeIntentText(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(toText).filter(Boolean) : [];
}

function tokensFrom(value: string) {
  const tokens = normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  const nonBrandTokens = tokens.filter((token) => !BRAND_TOKENS.has(token));
  return nonBrandTokens.length > 0 ? nonBrandTokens : tokens;
}

function compact(parts: Array<string | false | 0 | null | undefined>) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function hasAny(value: string, phrases: string[]) {
  return phrases.some((phrase) => value.includes(phrase));
}

function detectLanguage(message: string): "es" | "en" {
  const normalized = normalizeIntentText(message);
  const englishPattern =
    /(^|\s)(hello|hi|bye|thanks|services|quote|website|websites|business|businesses|restaurant|restaurants|clinic|clinics|store|stores|prices|pricing)(\s|$)/;

  return englishPattern.test(normalized) ||
    hasAny(normalized, ["thank you", "who are", "what do", "do you", "online store", "how much"])
    ? "en"
    : "es";
}

function responseForGreeting(locale: "es" | "en") {
  if (locale === "en") {
    return `Hi! I am Ken Code AI. I can help you understand Ken Code services, projects, quote options and contact channels. You can ask normally or start a quote at ${QUOTE_PATH}.`;
  }

  return `Hola, soy Ken Code AI. Puedo ayudarte a conocer los servicios de Ken Code, resolver dudas sobre proyectos, orientarte para cotizar o enviarte a WhatsApp. Puedes preguntarme con tus propias palabras.`;
}

function responseForFarewell(locale: "es" | "en") {
  if (locale === "en") {
    return `Thank you for writing. When you are ready, you can request a quote at ${QUOTE_PATH}, use ${CONTACT_PATH}, or message Ken Code on WhatsApp: ${WHATSAPP_URL}.`;
  }

  return `Gracias por escribir. Cuando quieras avanzar, puedes solicitar una cotizacion en ${QUOTE_PATH}, ir a ${CONTACT_PATH} o escribir directo por WhatsApp: ${WHATSAPP_URL}.`;
}

function responseForCompany(locale: "es" | "en") {
  if (locale === "en") {
    return `Ken Code is a premium international web studio. It builds modern websites, landing pages, e-commerce experiences, CRM-ready systems and digital solutions for businesses that want to look more trustworthy, attract clients and grow online.`;
  }

  return `Ken Code es un estudio web premium e internacional. Crea paginas web modernas, landing pages, e-commerce, bases CRM y soluciones digitales para negocios que quieren verse mas confiables, atraer clientes y crecer digitalmente.`;
}

function responseForServices(locale: "es" | "en") {
  if (locale === "en") {
    return `Ken Code offers landing pages, business websites, e-commerce/catalog sites, admin or CRM foundations, WhatsApp contact flows, basic SEO and email automation. For a specific recommendation, tell me what kind of business you have.`;
  }

  return `Ken Code ofrece landing pages, sitios web para negocios, e-commerce o catalogos, bases para panel administrativo/CRM, WhatsApp integrado, SEO basico y automatizacion de correos. Si me cuentas tu tipo de negocio, puedo recomendarte el camino mas adecuado.`;
}

function responseForQuote(locale: "es" | "en") {
  if (locale === "en") {
    return `You can request a quote at ${QUOTE_PATH}, contact Ken Code through ${CONTACT_PATH}, or send a direct WhatsApp message: ${WHATSAPP_URL}. Prices are personalized and depend on scope, sections, content and features.`;
  }

  return `Puedes solicitar una cotizacion en ${QUOTE_PATH}, contactar desde ${CONTACT_PATH} o escribir directo por WhatsApp: ${WHATSAPP_URL}. Los precios son personalizados y dependen del alcance, secciones, contenido y funciones.`;
}

function responseForWhatsapp(locale: "es" | "en") {
  if (locale === "en") {
    return `Yes. You can talk with Ken Code by WhatsApp here: ${WHATSAPP_URL}. It is a good channel for quick questions, quote context and next steps.`;
  }

  return `Si. Puedes hablar con Ken Code por WhatsApp aqui: ${WHATSAPP_URL}. Es una buena ruta para dudas rapidas, contexto de cotizacion y siguientes pasos.`;
}

function responseForPricing(locale: "es" | "en") {
  if (locale === "en") {
    return `Ken Code does not publish fixed prices in this assistant. Each project is quoted according to scope, sections, content and required features. The safest next step is to request a quote at ${QUOTE_PATH} or write by WhatsApp: ${WHATSAPP_URL}.`;
  }

  return `No manejo precios fijos ni invento tarifas. Ken Code trabaja con cotizacion personalizada segun alcance, secciones, contenido y funciones. Para una respuesta realista, solicita una cotizacion en ${QUOTE_PATH} o escribe por WhatsApp: ${WHATSAPP_URL}.`;
}

function getVerticalDetails(locale: "es" | "en", vertical: "restaurant" | "clinic" | "store" | "crm" | "ai") {
  if (locale === "en") {
    return {
      restaurant:
        "Yes. Ken Code builds restaurant websites and digital menus with mobile navigation, WhatsApp contact, location, hours and clear categories.",
      clinic:
        "Yes. Ken Code can help clinics and professional service businesses with a clear website for services, trust, contact forms and WhatsApp paths.",
      store:
        "Yes. Ken Code builds e-commerce and catalog experiences for stores that need products, categories, order paths and contact flows.",
      crm:
        "Yes. Ken Code can prepare CRM or admin-panel foundations to organize requests, notes, tasks and follow-up without exposing private data on the public site.",
      ai:
        "Yes. Ken Code can build modern websites with AI-assisted public guidance like Ken Code AI, using approved public knowledge when the project requires it.",
    }[vertical];
  }

  return {
    restaurant:
      "Si. Ken Code trabaja paginas web para restaurantes y menus digitales con navegacion movil, WhatsApp, ubicacion, horarios y categorias claras.",
    clinic:
      "Si. Ken Code puede ayudar a clinicas y negocios de servicios profesionales con una web clara para explicar servicios, generar confianza, recibir formularios y llevar consultas a WhatsApp.",
    store:
      "Si. Ken Code crea experiencias e-commerce y catalogos para tiendas que necesitan productos, categorias, rutas de pedido y contacto ordenado.",
    crm:
      "Si. Ken Code puede preparar bases CRM o paneles administrativos para organizar solicitudes, notas, tareas y seguimiento sin exponer datos privados en la web publica.",
    ai:
      "Si. Ken Code puede crear paginas web modernas con orientacion publica asistida por IA, como Ken Code AI, usando conocimiento publico aprobado cuando el proyecto lo necesita.",
  }[vertical];
}

function responseForVertical(locale: "es" | "en", vertical: "restaurant" | "clinic" | "store" | "crm" | "ai") {
  const details = getVerticalDetails(locale, vertical);

  if (locale === "en") {
    return `${details} To move forward, request a quote at ${QUOTE_PATH}, use ${CONTACT_PATH}, or write on WhatsApp: ${WHATSAPP_URL}.`;
  }

  return `${details} Para avanzar, solicita una cotizacion en ${QUOTE_PATH}, usa ${CONTACT_PATH} o escribe por WhatsApp: ${WHATSAPP_URL}.`;
}

function detectVertical(normalized: string): "restaurant" | "clinic" | "store" | "crm" | "ai" | null {
  if (hasAny(normalized, ["restaurante", "restaurant", "menu digital", "menu online"])) return "restaurant";
  if (hasAny(normalized, ["clinica", "clinic", "consultorio", "medical", "salud"])) return "clinic";
  if (hasAny(normalized, ["tienda", "store", "ecommerce", "e commerce", "catalogo", "online store"])) return "store";
  if (hasAny(normalized, ["crm", "panel administrativo", "admin panel", "seguimiento"])) return "crm";
  if (hasAny(normalized, ["con ia", "inteligencia artificial", "ai website", "with ai", "pagina web con ia", "paginas web con ia"])) return "ai";
  return null;
}

function responseForBuyingIntent(locale: "es" | "en", vertical: ReturnType<typeof detectVertical>) {
  if (locale === "en") {
    const intro = vertical
      ? getVerticalDetails(locale, vertical)
      : `Sounds like you are ready to improve your digital presence. Ken Code can recommend a landing page, business website, e-commerce/catalog, CRM foundation or automation path depending on your goal.`;

    return `${intro}\n\nNext step: share your business type, goal and desired features at ${QUOTE_PATH}, through ${CONTACT_PATH}, or directly on WhatsApp: ${WHATSAPP_URL}.`;
  }

  const intro = vertical
    ? getVerticalDetails(locale, vertical)
    : `Suena como un buen momento para mejorar tu presencia digital. Ken Code puede recomendar una landing page, sitio web para negocio, e-commerce/catalogo, base CRM o automatizacion segun tu objetivo.`;

  return `${intro}\n\nSiguiente paso: comparte tu tipo de negocio, meta y funciones deseadas en ${QUOTE_PATH}, desde ${CONTACT_PATH} o directo por WhatsApp: ${WHATSAPP_URL}.`;
}

function hasBuyingIntent(normalized: string) {
  return (
    hasAny(normalized, [
      "necesito una pagina web",
      "necesito pagina web",
      "necesito una web",
      "quiero una pagina web",
      "quiero vender mas",
      "quiero automatizar mi negocio",
      "automatizar mi negocio",
      "quiero un sistema",
      "necesito un sistema",
      "necesito sistema",
      "necesito cotizacion",
      "quiero una cotizacion",
      "quiero cotizacion",
      "request a quote",
      "need a website",
      "want a website",
      "sell more",
      "automate my business",
      "need a system",
    ]) ||
    /\btengo\s+(un|una|mi)\s+(restaurante|clinica|tienda|negocio|empresa)\b/.test(normalized) ||
    /\bi\s+(have|own|need|want)\s+(a\s+)?(restaurant|clinic|store|business|website|system)\b/.test(normalized)
  );
}

function findConversationalAnswer(message: string): KnowledgeAnswer | null {
  const normalized = normalizeIntentText(message);
  const locale = detectLanguage(message);
  const vertical = detectVertical(normalized);

  if (!normalized) return null;

  if (hasBuyingIntent(normalized)) {
    return { answer: responseForBuyingIntent(locale, vertical), matched: true };
  }

  if (hasAny(normalized, ["precio", "precios", "cuanto cuesta", "tarifa", "costo", "prices", "pricing", "how much"])) {
    return { answer: responseForPricing(locale), matched: true };
  }

  if (hasAny(normalized, ["gracias", "muchas gracias", "adios", "hasta luego", "bye", "thank you", "thanks"])) {
    return { answer: responseForFarewell(locale), matched: true };
  }

  if (hasAny(normalized, ["hola", "buenos dias", "buenas tardes", "buenas noches", "hello", "hi"])) {
    return { answer: responseForGreeting(locale), matched: true };
  }

  if (hasAny(normalized, ["quienes son", "quien son", "que hace ken code", "who are", "what does ken code do"])) {
    return { answer: responseForCompany(locale), matched: true };
  }

  if (hasAny(normalized, ["que servicios ofrecen", "servicios ofrecen", "servicios tiene", "services do you offer", "what services"])) {
    return { answer: responseForServices(locale), matched: true };
  }

  if (hasAny(normalized, ["como puedo cotizar", "cotizar", "cotizacion", "quote"])) {
    return { answer: responseForQuote(locale), matched: true };
  }

  if (hasAny(normalized, ["whatsapp", "whats app"])) {
    return { answer: responseForWhatsapp(locale), matched: true };
  }

  if (vertical) {
    return { answer: responseForVertical(locale, vertical), matched: true };
  }

  return null;
}

function asRecord(value: unknown): KnowledgeRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as KnowledgeRecord) : {};
}

function addChunk(
  chunks: KnowledgeChunk[],
  id: string,
  title: string,
  answer: string,
  searchParts: string[] = [],
  priority = 1,
) {
  const cleanAnswer = answer.trim();
  if (!cleanAnswer) return;

  chunks.push({
    id,
    title,
    answer: cleanAnswer,
    searchable: normalizeText([title, cleanAnswer, ...searchParts].join(" ")),
    priority,
  });
}

function summarizeServices(services: unknown) {
  if (!Array.isArray(services)) return "";

  return services
    .map((service) => {
      const item = asRecord(service);
      const title = toText(item.title);
      const summary = toText(item.summary);
      return compact([title && `${title}:`, summary]);
    })
    .filter(Boolean)
    .join(" ");
}

function buildChunks(): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const root = asRecord(knowledgeBase);
  const company = asRecord(root.company);
  const contact = asRecord(root.contact);
  const content = asRecord(root.content);
  const spanishContent = asRecord(content.es);
  const englishContent = asRecord(content.en);

  addChunk(
    chunks,
    "company-profile",
    "Ken Code",
    compact([
      toText(company.publicPositioning),
      toText(company.publicMission),
      toText(asRecord(company.founder).publicRole),
    ]),
    [toText(company.name), toText(company.domain), toText(asRecord(company.founder).name)],
    3,
  );

  addChunk(
    chunks,
    "contact",
    "Contacto Ken Code",
    compact([
      `Puedes solicitar una cotización desde ${toText(contact.quotePath) || "/cotizar"}.`,
      `También puedes contactar por WhatsApp al ${toText(contact.whatsappPhone) || "+504 9911-2211"}`,
      `o por correo a ${toText(contact.email) || "kencodehn@gmail.com"}.`,
    ]),
    ["cotizar contacto whatsapp correo email"],
    3,
  );

  addChunk(
    chunks,
    "services-overview-es",
    "Servicios",
    summarizeServices(spanishContent.services),
    ["servicios ofrece paginas web landing ecommerce tienda seo whatsapp automatizacion"],
    2,
  );

  addChunk(
    chunks,
    "services-overview-en",
    "Services",
    summarizeServices(englishContent.services),
    ["services websites landing ecommerce seo whatsapp"],
    2,
  );

  for (const [locale, localeContent] of [
    ["es", spanishContent],
    ["en", englishContent],
  ] as const) {
    const services = Array.isArray(localeContent.services) ? localeContent.services : [];
    services.forEach((service, index) => {
      const item = asRecord(service);
      const title = toText(item.title);
      addChunk(
        chunks,
        `service-${locale}-${toText(item.slug) || index}`,
        title,
        compact([title && `${title}:`, toText(item.summary), toText(item.detail)]),
        [toText(item.slug)],
        2,
      );
    });

    const packages = Array.isArray(localeContent.packages) ? localeContent.packages : [];
    addChunk(
      chunks,
      `packages-overview-${locale}`,
      locale === "es" ? "Paquetes" : "Packages",
      packages
        .map((pack) => {
          const item = asRecord(pack);
          return compact([
            toText(item.name),
            toText(item.audience),
            toText(item.price) && `Precio: ${toText(item.price)}.`,
            textList(item.includes).length && `Incluye: ${textList(item.includes).join(", ")}.`,
          ]);
        })
        .filter(Boolean)
        .join(" "),
      ["paquetes precios cotizacion packages pricing"],
      2,
    );

    packages.forEach((pack, index) => {
      const item = asRecord(pack);
      const name = toText(item.name);
      addChunk(
        chunks,
        `package-${locale}-${index}`,
        name,
        compact([
          name && `${name}:`,
          toText(item.audience),
          toText(item.price) && `Precio: ${toText(item.price)}.`,
          textList(item.includes).length && `Incluye: ${textList(item.includes).join(", ")}.`,
        ]),
        textList(item.includes),
        2,
      );
    });

    const projects = Array.isArray(localeContent.projects) ? localeContent.projects : [];
    addChunk(
      chunks,
      `projects-overview-${locale}`,
      locale === "es" ? "Proyectos" : "Projects",
      projects
        .map((project) => {
          const item = asRecord(project);
          return compact([toText(item.name), toText(item.category), toText(item.description)]);
        })
        .filter(Boolean)
        .join(" "),
      ["proyectos proyecto trabajos realizados casos portafolio portfolio work"],
      5,
    );

    projects.forEach((project, index) => {
      const item = asRecord(project);
      const name = toText(item.name);
      addChunk(
        chunks,
        `project-${locale}-${toText(item.slug) || index}`,
        name,
        compact([
          name && `${name}:`,
          toText(item.category),
          toText(item.description),
          toText(item.result) && `Resultado: ${toText(item.result)}`,
        ]),
        [toText(item.problem), toText(item.solution), ...textList(item.benefits)],
        2,
      );
    });

    addChunk(
      chunks,
      `benefits-${locale}`,
      locale === "es" ? "Beneficios" : "Benefits",
      (Array.isArray(localeContent.benefits) ? localeContent.benefits : [])
        .map((benefit) => {
          const item = asRecord(benefit);
          return compact([toText(item.title), toText(item.copy)]);
        })
        .filter(Boolean)
        .join(" "),
      ["beneficios ventajas confianza alcance contacto seo"],
      1,
    );

    addChunk(
      chunks,
      `process-${locale}`,
      locale === "es" ? "Proceso" : "Process",
      textList(localeContent.process).join(", "),
      ["proceso etapas trabajo lanzamiento soporte"],
      1,
    );
  }

  const faqs = Array.isArray(root.faqs) ? root.faqs : [];
  faqs.forEach((faq, index) => {
    const item = asRecord(faq);
    addChunk(
      chunks,
      `faq-${index}`,
      toText(item.question),
      toText(item.answer),
      [toText(item.serviceTitle), toText(item.serviceSlug), toText(item.question)],
      4,
    );
  });

  const salesObjections = Array.isArray(root.salesObjections) ? root.salesObjections : [];
  salesObjections.forEach((objection, index) => {
    const item = asRecord(objection);
    addChunk(
      chunks,
      `sales-objection-${index}`,
      toText(item.question),
      toText(item.answer),
      [toText(item.question)],
      4,
    );
  });

  return chunks;
}

const chunks = buildChunks();

function scoreChunk(chunk: KnowledgeChunk, queryTokens: string[]) {
  let score = 0;

  for (const token of queryTokens) {
    if (chunk.searchable.includes(token)) {
      score += token.length > 5 ? 2 : 1;
    }
  }

  return score * chunk.priority;
}

export function findKnowledgeAnswer(message: string): KnowledgeAnswer {
  const conversationalAnswer = findConversationalAnswer(message);
  if (conversationalAnswer) {
    return conversationalAnswer;
  }

  const queryTokens = tokensFrom(message);

  if (queryTokens.length === 0) {
    return {
      answer: SAFE_AI_FALLBACK,
      matched: false,
    };
  }

  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTokens) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);

  const minimumScore = Math.max(3, Math.ceil(queryTokens.length * 1.5));
  const best = ranked[0];

  if (!best || best.score < minimumScore) {
    return {
      answer: SAFE_AI_FALLBACK,
      matched: false,
    };
  }

  const related = ranked
    .filter((result) => result.chunk.id !== best.chunk.id && result.score >= best.score * 0.75)
    .slice(0, 1)
    .map((result) => result.chunk.answer);

  return {
    answer: [best.chunk.answer, ...related].join("\n\n"),
    matched: true,
  };
}
