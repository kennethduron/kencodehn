export const MAX_MAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const dangerousExtensions = new Set([
  "apk", "app", "bat", "bash", "bin", "cmd", "com", "cpl", "desktop", "dll",
  "dmg", "exe", "hta", "htm", "html", "iso", "jar", "js", "jse", "lnk",
  "mjs", "msi", "msp", "ps1", "reg", "scr", "sh", "svg", "url", "vbe",
  "vbs", "zsh",
]);

const dangerousMimeTypes = new Set([
  "application/java-archive",
  "application/javascript",
  "application/vnd.android.package-archive",
  "application/x-bat",
  "application/x-dosexec",
  "application/x-executable",
  "application/x-httpd-php",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-sh",
  "application/x-shellscript",
  "image/svg+xml",
  "text/html",
  "text/javascript",
]);

const extensionTypes: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

const imageTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const zipTypes = new Set([
  "application/zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const oleTypes = new Set(["application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint"]);
const signatureRequiredTypes = new Set(["application/pdf", ...imageTypes, ...zipTypes, ...oleTypes]);

export const MAIL_STORAGE_MIME_TYPES = [
  "application/octet-stream",
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
] as const;

export type AttachmentValidation =
  | { ok: true; contentType: string; previewable: boolean }
  | { ok: false; reason: "dangerous" | "empty" | "mismatch" | "too_large" };

function extensionOf(filename: string) {
  const match = /\.([^.]+)$/.exec(filename.trim().toLowerCase());
  return match?.[1] || "";
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function asciiPrefix(bytes: Uint8Array, length = 256) {
  return new TextDecoder("latin1").decode(bytes.slice(0, length)).trimStart().toLowerCase();
}

function detectSignature(bytes: Uint8Array) {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (new TextDecoder("latin1").decode(bytes.slice(0, 6)) === "GIF87a" || new TextDecoder("latin1").decode(bytes.slice(0, 6)) === "GIF89a") return "image/gif";
  if (new TextDecoder("latin1").decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder("latin1").decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])) return "application/zip";
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "application/x-ole-storage";
  if (startsWith(bytes, [0x4d, 0x5a]) || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return "application/x-executable";
  const prefix = asciiPrefix(bytes);
  if (prefix.startsWith("#!") || prefix.startsWith("<script") || prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.startsWith("<?php") || prefix.startsWith("<svg")) return "application/x-executable";
  return "";
}

function isProbablyText(bytes: Uint8Array) {
  const sample = bytes.slice(0, Math.min(bytes.length, 4096));
  if (!sample.length || sample.includes(0)) return false;
  let controls = 0;
  for (const byte of sample) if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) controls += 1;
  return controls / sample.length < 0.02;
}

export function sanitizeAttachmentFilename(value: string | null | undefined) {
  const cleaned = String(value || "archivo")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f\\/]/g, "_")
    .trim();
  return Array.from(cleaned || "archivo").slice(0, 255).join("");
}

export function sanitizeContentId(value: string | null | undefined) {
  const cleaned = String(value || "").replace(/[\r\n\u0000]/g, "").trim().replace(/^<|>$/g, "");
  return Array.from(cleaned).slice(0, 255).join("") || null;
}

export function normalizeContentId(value: string | null | undefined) {
  let cleaned = String(value || "").trim().replace(/^cid:/i, "").replace(/^<|>$/g, "");
  try { cleaned = decodeURIComponent(cleaned); } catch { /* Keep the provider value when it is not URI encoded. */ }
  return cleaned.normalize("NFC").toLowerCase();
}

export function validateMailAttachment(
  bytes: Uint8Array,
  filename: string,
  declaredContentType: string | null | undefined,
): AttachmentValidation {
  if (!bytes.length) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_MAIL_ATTACHMENT_BYTES) return { ok: false, reason: "too_large" };
  const extension = extensionOf(filename);
  const declared = String(declaredContentType || "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
  if (dangerousExtensions.has(extension) || dangerousMimeTypes.has(declared)) return { ok: false, reason: "dangerous" };

  const signature = detectSignature(bytes);
  if (signature === "application/x-executable") return { ok: false, reason: "dangerous" };
  const extensionType = extensionTypes[extension];

  if (signature === "application/x-ole-storage") {
    if (!extensionType || !oleTypes.has(extensionType)) return { ok: false, reason: "mismatch" };
    return { ok: true, contentType: extensionType, previewable: false };
  }
  if (signature === "application/zip") {
    const contentType = extensionType && zipTypes.has(extensionType) ? extensionType : extension === "zip" ? "application/zip" : "";
    if (!contentType) return { ok: false, reason: "mismatch" };
    return { ok: true, contentType, previewable: false };
  }
  if (signature) {
    if ((extensionType && extensionType !== signature) || (signatureRequiredTypes.has(declared) && declared !== signature)) return { ok: false, reason: "mismatch" };
    return { ok: true, contentType: signature, previewable: imageTypes.has(signature) || signature === "application/pdf" };
  }

  if (signatureRequiredTypes.has(declared) || (extensionType && !["text/plain", "text/csv"].includes(extensionType))) return { ok: false, reason: "mismatch" };
  if (extensionType === "text/plain" || extensionType === "text/csv" || declared === "text/plain" || declared === "text/csv") {
    if (!isProbablyText(bytes)) return { ok: false, reason: "mismatch" };
    const contentType = extensionType === "text/csv" || declared === "text/csv" ? "text/csv" : "text/plain";
    return { ok: true, contentType, previewable: false };
  }
  return { ok: true, contentType: "application/octet-stream", previewable: false };
}

export function isPreviewableAttachmentType(contentType: string) {
  return imageTypes.has(contentType) || contentType === "application/pdf";
}

export function isImageAttachmentType(contentType: string) {
  return imageTypes.has(contentType);
}

export function trustedResendAttachmentUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && new Set([
      "cdn.resend.app",
      "inbound-cdn.resend.com",
    ]).has(url.hostname);
  } catch {
    return false;
  }
}

export function contentDispositionHeader(filename: string, mode: "attachment" | "inline") {
  const safe = sanitizeAttachmentFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
