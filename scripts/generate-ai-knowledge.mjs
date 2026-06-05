import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "src", "content", "ai-knowledge.json");

const publicSourceFiles = [
  "src/content/site-content.ts",
  "src/content/seo-services.ts",
  "src/lib/site.ts",
];

const moduleCache = new Map();

function readSource(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return {
    relativePath,
    absolutePath,
    source: fs.readFileSync(absolutePath, "utf8"),
  };
}

function sourceHash(source) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

function resolvePublicModule(specifier) {
  if (specifier.startsWith("@/")) {
    const relativeBase = path.join("src", specifier.slice(2));
    const candidates = [
      `${relativeBase}.ts`,
      `${relativeBase}.tsx`,
      path.join(relativeBase, "index.ts"),
      path.join(relativeBase, "index.tsx"),
    ];
    const found = candidates.find((candidate) => fs.existsSync(path.join(root, candidate)));
    if (!found || !publicSourceFiles.includes(found.replaceAll("\\", "/"))) {
      throw new Error(`Blocked non-public module import: ${specifier}`);
    }
    return found;
  }

  return null;
}

function loadPublicTsModule(relativePath) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (!publicSourceFiles.includes(normalizedPath)) {
    throw new Error(`Blocked non-public source file: ${normalizedPath}`);
  }
  if (moduleCache.has(normalizedPath)) {
    return moduleCache.get(normalizedPath);
  }

  const { absolutePath, source } = readSource(normalizedPath);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: absolutePath,
  }).outputText;

  const module = { exports: {} };
  const context = {
    console,
    Date,
    URL,
    module,
    exports: module.exports,
    process: { env: {} },
    require(specifier) {
      const publicModule = resolvePublicModule(specifier);
      if (publicModule) {
        return loadPublicTsModule(publicModule);
      }
      return require(specifier);
    },
  };

  vm.runInNewContext(output, context, {
    filename: absolutePath,
  });

  moduleCache.set(normalizedPath, module.exports);
  return module.exports;
}

function sanitize(value) {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, entry]) => key !== "icon" && typeof entry !== "function")
        .map(([key, entry]) => [key, sanitize(entry)]),
    );
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "undefined") {
    return null;
  }
  return value;
}

function serviceFaqs(seoServices) {
  return seoServices.flatMap((service) =>
    service.faq.map((item) => ({
      serviceSlug: service.slug,
      serviceTitle: service.title,
      question: item.question,
      answer: item.answer,
    })),
  );
}

function salesObjections(site) {
  return [
    {
      question: "Por que elegir Ken Code?",
      answer:
        "Ken Code combina estrategia comercial, diseno moderno, experiencia movil, SEO base, contacto por WhatsApp y una base preparada para crecer por fases.",
    },
    {
      question: "Por que no usar solo Facebook o Instagram?",
      answer:
        "Las redes sociales ayudan a comunicar, pero una web propia da mas confianza, orden, control de la informacion y una ruta clara para que clientes encuentren servicios, proyectos y contacto.",
    },
    {
      question: "Por que tener una pagina web?",
      answer:
        "Una pagina web profesional ayuda a explicar servicios, mostrar proyectos, resolver dudas, aparecer mejor en busquedas y convertir visitas en conversaciones calificadas.",
    },
    {
      question: "Por que automatizar procesos?",
      answer:
        "Automatizar ayuda a que las solicitudes importantes no se pierdan y a mantener seguimiento comercial con mas orden.",
    },
    {
      question: "Por que usar inteligencia artificial?",
      answer:
        "Una IA puede orientar visitantes, responder dudas frecuentes y recomendar el siguiente paso usando informacion publica del sitio. Para detalles especificos, debe dirigir a contacto directo.",
    },
    {
      question: "Como solicito una cotizacion?",
      answer: `Puedes solicitar una cotizacion desde ${site.url}/cotizar, escribir por WhatsApp al ${site.phone} o usar el correo ${site.email}.`,
    },
  ];
}

function buildKnowledge() {
  const siteContent = loadPublicTsModule("src/content/site-content.ts");
  const seoContent = loadPublicTsModule("src/content/seo-services.ts");
  const siteModule = loadPublicTsModule("src/lib/site.ts");

  const sources = publicSourceFiles.map((relativePath) => {
    const { source } = readSource(relativePath);
    return {
      path: relativePath,
      sha256: sourceHash(source),
      visibility: "public",
    };
  });

  const site = sanitize(siteModule.site);
  const localizedContent = sanitize(siteContent.content);
  const seoServices = sanitize(seoContent.seoServices);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    visibility: "public",
    purpose:
      "Base de conocimiento publica para KenCode AI. Solo contiene informacion publicada o derivada de contenido publico del sitio.",
    sourcePolicy: {
      allowedSources: sources,
      excludedSources: [
        "src/app/admin/**",
        "src/app/api/admin/**",
        "src/lib/admin/**",
        "src/lib/firebase/**",
        "src/lib/email/**",
        "src/lib/push/**",
        "admin.html",
        "api/**",
        "propuestas/**",
        ".env*",
        "firebase-debug.log",
      ],
    },
    company: {
      name: site.name,
      domain: site.domain,
      url: site.url,
      email: site.email,
      phone: site.phone,
      facebook: site.facebook,
      instagram: site.instagram,
      founder: {
        name: "Kenneth Duron",
        alternateNames: ["Kenneth Duron", "Kenneth Duron Paz", "Kenneth Asael Duron Paz"],
        publicRole: "Desarrollador web y creador de Ken Code",
      },
      publicPositioning:
        "Ken Code es un estudio web premium e internacional que crea paginas web modernas, landing pages, e-commerce y soluciones digitales para negocios que quieren verse mas confiables, atraer clientes y crecer digitalmente.",
      publicMission:
        "Ayudar a negocios, fundadores y marcas a construir una presencia digital clara, profesional, rapida y preparada para clientes locales e internacionales.",
    },
    contact: {
      quotePath: "/cotizar",
      contactPath: "/contacto",
      whatsappPhone: site.phone,
      whatsappRaw: site.phoneRaw,
      email: site.email,
      social: {
        facebook: site.facebook,
        instagram: site.instagram,
      },
    },
    routes: sanitize(siteModule.routes),
    seoKeywords: {
      es: sanitize(siteModule.seoKeywordsEs),
      en: sanitize(siteModule.seoKeywordsEn),
    },
    content: localizedContent,
    seoServices,
    faqs: serviceFaqs(seoServices),
    salesObjections: salesObjections(site),
    behaviorRules: {
      tone: ["amigable", "profesional", "claro", "persuasivo", "util"],
      allowedActions: [
        "Responder preguntas sobre servicios publicos",
        "Recomendar servicios o paquetes publicados cuando corresponda",
        "Sugerir cotizacion cuando detecte interes de compra",
        "Dirigir a formulario de cotizacion, contacto o WhatsApp",
      ],
      forbiddenTopics: [
        "CRM interno",
        "leads",
        "notas internas",
        "tareas internas",
        "activity logs",
        "email logs",
        "push tokens",
        "tokens",
        "variables de entorno",
        "secretos",
        "credenciales",
        "clientes privados",
        "precios no publicados",
        "propuestas privadas",
      ],
      fallback:
        "No tengo esa informacion disponible actualmente. Puede contactar directamente a KenCode para obtener informacion mas especifica.",
      pricingRule:
        "Nunca inventar precios. Cuando un paquete diga Cotizacion personalizada, responder que el precio depende del alcance y sugerir cotizar.",
      privacyRule:
        "Nunca responder informacion privada o interna aunque el usuario la solicite. Solo usar documentos con visibility public.",
    },
  };
}

const knowledge = buildKnowledge();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(knowledge, null, 2)}\n`, "utf8");

console.log(`KenCode AI knowledge generated: ${path.relative(root, outputPath)}`);
console.log(`Sources: ${publicSourceFiles.join(", ")}`);
