import sanitizeHtmlLibrary from "sanitize-html";
import { z } from "zod";
import { normalizeContentId } from "./attachment-security.ts";

export const emailAddressSchema = z.string().trim().toLowerCase().email().max(254).refine((value) => !/[\r\n]/.test(value));
export const recipientListSchema = z.array(emailAddressSchema).max(50);
export const safeSubjectSchema = z.string().trim().max(998).refine((value) => !/[\r\n]/.test(value), "Asunto inválido");
export const uuidSchema = z.string().uuid();

export function sanitizeMailHtml(value: string, options: { signatureContent?: boolean } = {}) {
  const signatureContent = options.signatureContent === true;
  return sanitizeHtmlLibrary(value, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "h2", "h3", "a", "span", "div", ...(signatureContent ? ["img"] : [])],
    allowedAttributes: {
      a: ["href", "title"],
      span: [],
      div: ["data-kc-signature"],
      blockquote: ["data-kc-quoted-history"],
      ...(signatureContent ? { img: ["src", "alt", "width", "height"] } : {}),
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    transformTags: { a: sanitizeHtmlLibrary.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
  });
}

function isTrackingPixel(attributes: Record<string, string>) {
  const width = Number.parseFloat(attributes.width || "");
  const height = Number.parseFloat(attributes.height || "");
  const style = (attributes.style || "").toLowerCase();
  return (Number.isFinite(width) && width <= 1) || (Number.isFinite(height) && height <= 1) || /(?:width|height)\s*:\s*(?:0|1)(?:px)?\b/.test(style);
}

/** Sanitizes inbound HTML while keeping images inert until their source is trusted. */
export function sanitizeInboundMailHtml(value: string) {
  return sanitizeHtmlLibrary(value, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "h2", "h3", "a", "span", "div", "img", "table", "thead", "tbody", "tr", "th", "td", "pre", "code"],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "width", "height", "data-kc-remote-src", "data-kc-tracking-pixel", "loading", "decoding", "referrerpolicy"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "cid"],
    allowedSchemesByTag: { img: ["cid"] },
    transformTags: {
      a: sanitizeHtmlLibrary.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
      img: (_tagName, attributes) => {
        const source = String(attributes.src || "").trim();
        const safeAttributes: Record<string, string> = {
          alt: String(attributes.alt || "Imagen del correo").slice(0, 300),
          loading: "lazy",
          decoding: "async",
          referrerpolicy: "no-referrer",
        };
        if (/^cid:/i.test(source)) {
          const contentId = normalizeContentId(source);
          if (contentId) safeAttributes.src = `cid:${contentId}`;
        } else {
          try {
            const url = new URL(source);
            if (url.protocol === "https:" || url.protocol === "http:") safeAttributes["data-kc-remote-src"] = url.toString();
          } catch { /* Invalid and non-CID image sources stay removed. */ }
        }
        if (isTrackingPixel(attributes)) safeAttributes["data-kc-tracking-pixel"] = "true";
        if (/^\d{1,4}$/.test(attributes.width || "")) safeAttributes.width = attributes.width;
        if (/^\d{1,4}$/.test(attributes.height || "")) safeAttributes.height = attributes.height;
        return { tagName: "img", attribs: safeAttributes };
      },
    },
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
  });
}

export function resolveInlineContentIds(
  value: string,
  attachments: Array<{ id: string; content_id?: string | null; inline?: boolean; content_type: string }>,
) {
  const matches = new Map(
    attachments
      .filter((attachment) => attachment.inline && attachment.content_id && /^image\/(?:gif|jpeg|png|webp)$/i.test(attachment.content_type))
      .map((attachment) => [normalizeContentId(attachment.content_id), attachment.id]),
  );
  return value.replace(/<img\b[^>]*\bsrc="cid:([^"]+)"[^>]*>/gi, (tag: string, rawId: string) => {
    const attachmentId = matches.get(normalizeContentId(rawId));
    return attachmentId ? tag.replace(/\bsrc="cid:[^"]+"/i, `src="/api/admin/mail/attachments?id=${encodeURIComponent(attachmentId)}&mode=inline"`) : "";
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
