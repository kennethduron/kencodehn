import sanitizeHtmlLibrary from "sanitize-html";
import { z } from "zod";

export const emailAddressSchema = z.string().trim().toLowerCase().email().max(254).refine((value) => !/[\r\n]/.test(value));
export const recipientListSchema = z.array(emailAddressSchema).max(50);
export const safeSubjectSchema = z.string().trim().max(998).refine((value) => !/[\r\n]/.test(value), "Asunto inválido");
export const uuidSchema = z.string().uuid();

export function sanitizeMailHtml(value: string) {
  return sanitizeHtmlLibrary(value, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "h2", "h3", "a", "span", "div"],
    allowedAttributes: { a: ["href", "title"], span: [], div: [] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtmlLibrary.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
  });
}

export function textFromHtml(value: string) {
  return sanitizeHtmlLibrary(value, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

export function normalizeLocalPart(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "").replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+|[._-]+$/g, "").slice(0, 64);
}

export function suggestLocalParts(displayName: string) {
  const parts = displayName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const first = parts[0] || ""; const last = parts.at(-1) || "";
  return [...new Set([first, `${first}${last}`, `${first[0] || ""}${last}`].map(normalizeLocalPart).filter(Boolean))].slice(0, 3);
}

export function replySubject(subject: string) { return /^re\s*:/i.test(subject) ? subject : `Re: ${subject || "(Sin asunto)"}`; }
export function forwardSubject(subject: string) { return /^(fwd?|rv)\s*:/i.test(subject) ? subject : `Fwd: ${subject || "(Sin asunto)"}`; }
export function parseHeaderReferences(value: string | null | undefined) { return (value?.match(/<[^>]+>/g) || []).slice(-50); }
