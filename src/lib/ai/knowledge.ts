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
      ["proyectos portafolio casos portfolio work"],
      2,
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
