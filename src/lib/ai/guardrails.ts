export const SAFE_AI_FALLBACK =
  "No tengo esa informacion disponible actualmente. Puede contactar directamente a Ken Code para obtener informacion mas especifica.";

type GuardrailMatch = {
  label: string;
  patterns: RegExp[];
};

export type GuardrailResult =
  | {
      blocked: true;
      reason: string;
      response: typeof SAFE_AI_FALLBACK;
    }
  | {
      blocked: false;
    };

function normalizeForGuardrails(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const forbiddenTopics: GuardrailMatch[] = [
  {
    label: "internal-crm-data",
    patterns: [
      /\bleads?\b/,
      /\bprospectos?\s+internos?\b/,
      /\b(datos?|informacion|registros?)\s+(del|de)\s+crm\b/,
      /\b(ver|leer|mostrar|listar|descargar|acceder)\s+(el\s+)?crm\b/,
      /\bcrm\s+(interno|privado)\b.*\b(ver|leer|mostrar|listar|descargar|acceder|datos?|leads?)\b/,
    ],
  },
  {
    label: "internal-notes",
    patterns: [/\bnotas?\s+internas?\b/, /\btareas?\s+internas?\b/, /\bseguimiento\s+interno\b/],
  },
  {
    label: "logs",
    patterns: [/\blogs?\b/, /\bactivity\s+logs?\b/, /\bemail\s+logs?\b/, /\bregistros?\s+internos?\b/],
  },
  {
    label: "secrets",
    patterns: [
      /\btokens?\b/,
      /\bpush\s+tokens?\b/,
      /\bapi\s*keys?\b/,
      /\bsecretos?\b/,
      /\bcredenciales?\b/,
      /\bvariables?\s+de\s+entorno\b/,
      /\benv\s+vars?\b/,
      /\b\.env\b/,
    ],
  },
  {
    label: "private-clients",
    patterns: [
      /\bclientes?\s+privados?\b/,
      /\bclientes?\s+internos?\b/,
      /\bdatos?\s+de\s+clientes?\b/,
      /\binformacion\s+de\s+clientes?\b/,
    ],
  },
  {
    label: "unpublished-pricing",
    patterns: [
      /\bprecios?\s+no\s+publicados?\b/,
      /\bprecios?\s+internos?\b/,
      /\bprecio\s+privado\b/,
      /\btarifas?\s+internas?\b/,
      /\bcotizaciones?\s+privadas?\b/,
      /\bpropuestas?\s+privadas?\b/,
    ],
  },
  {
    label: "internal-information",
    patterns: [
      /\binformacion\s+interna\b/,
      /\bdatos?\s+internos?\b/,
      /\bfirestore\b/,
      /\bfirebase\s+admin\b/,
      /\bbase\s+de\s+datos\s+privada\b/,
      /\bpanel\s+privado\b/,
    ],
  },
  {
    label: "prompt-injection",
    patterns: [
      /\bignora\s+(las\s+)?(reglas|instrucciones)\b/,
      /\brevela\s+(tu\s+)?(prompt|sistema|instrucciones)\b/,
      /\bsystem\s+prompt\b/,
      /\bdeveloper\s+message\b/,
    ],
  },
];

export function checkAiGuardrails(message: string): GuardrailResult {
  const normalizedMessage = normalizeForGuardrails(message);
  const match = forbiddenTopics.find((topic) => topic.patterns.some((pattern) => pattern.test(normalizedMessage)));

  if (!match) {
    return { blocked: false };
  }

  return {
    blocked: true,
    reason: match.label,
    response: SAFE_AI_FALLBACK,
  };
}
