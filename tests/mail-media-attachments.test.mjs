import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  contentDispositionHeader,
  normalizeContentId,
  sanitizeAttachmentFilename,
  trustedResendAttachmentUrl,
  validateMailAttachment,
} from "../src/lib/mail/attachment-security.ts";
import {
  resolveInlineContentIds,
  sanitizeInboundMailHtml,
} from "../src/lib/mail/security.ts";
import { hasRevealableRemoteMailImages, revealRemoteMailImages } from "../src/lib/mail/media-presentation.ts";

const bytes = (...values) => new Uint8Array(values);
const text = (value) => new TextEncoder().encode(value);
const signatures = {
  pdf: text("%PDF-1.7\nfixture"),
  png: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1),
  jpeg: bytes(0xff, 0xd8, 0xff, 0xe0, 1),
  gif: text("GIF89a fixture"),
  webp: bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 1),
  zip: bytes(0x50, 0x4b, 0x03, 0x04, 1),
  ole: bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1),
};

const acceptedFixtures = [
  ["PDF", signatures.pdf, "cotización.pdf", "application/pdf", "application/pdf"],
  ["PNG CID", signatures.png, "logo.png", "image/png", "image/png"],
  ["JPEG CID", signatures.jpeg, "firma.jpg", "image/jpeg", "image/jpeg"],
  ["GIF", signatures.gif, "captura.gif", "image/gif", "image/gif"],
  ["WEBP", signatures.webp, "foto.webp", "image/webp", "image/webp"],
  ["DOCX", signatures.zip, "propuesta.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["XLSX", signatures.zip, "costos.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["PPTX", signatures.zip, "presentación.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ["ZIP", signatures.zip, "documentos.zip", "application/zip", "application/zip"],
  ["DOC", signatures.ole, "contrato.doc", "application/msword", "application/msword"],
  ["XLS", signatures.ole, "tabla.xls", "application/vnd.ms-excel", "application/vnd.ms-excel"],
  ["PPT", signatures.ole, "ventas.ppt", "application/vnd.ms-powerpoint", "application/vnd.ms-powerpoint"],
  ["CSV", text("cliente,total\nCar Zone,100"), "clientes.csv", "text/csv", "text/csv"],
  ["TXT", text("Seguimiento comercial seguro"), "nota.txt", "text/plain", "text/plain"],
  ["unknown safe", bytes(1, 2, 3, 4, 5), "evidence.dat", "application/octet-stream", "application/octet-stream"],
];

for (const [name, payload, filename, declared, expected] of acceptedFixtures) {
  test(`MIME fixture accepts ${name}`, () => {
    const result = validateMailAttachment(payload, filename, declared);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.contentType, expected);
  });
}

test("malformed empty MIME part is rejected", () => {
  assert.deepEqual(validateMailAttachment(bytes(), "vacío.txt", "text/plain"), { ok: false, reason: "empty" });
});

test("renamed executable is rejected from magic bytes", () => {
  assert.deepEqual(validateMailAttachment(bytes(0x4d, 0x5a, 1, 2), "factura.pdf", "application/pdf"), { ok: false, reason: "dangerous" });
});

test("script, HTML, SVG and shell MIME fixtures are rejected", () => {
  for (const fixture of [
    [text("<script>alert(1)</script>"), "x.txt", "text/plain"],
    [text("<!doctype html><p>x</p>"), "x.html", "text/html"],
    [text("<svg onload='x'>"), "x.svg", "image/svg+xml"],
    [text("#!/bin/sh\nrm -rf /"), "x.txt", "text/plain"],
  ]) assert.equal(validateMailAttachment(...fixture).ok, false);
});

test("MIME mismatch is rejected", () => {
  assert.deepEqual(validateMailAttachment(signatures.png, "reporte.pdf", "application/pdf"), { ok: false, reason: "mismatch" });
});

test("Unicode filename stays readable while control/path characters are removed", () => {
  assert.equal(sanitizeAttachmentFilename("  cotización_日本語\r\n/2026.pdf  "), "cotización_日本語___2026.pdf");
});

test("long filename is bounded to 255 Unicode code points", () => {
  assert.equal(Array.from(sanitizeAttachmentFilename(`${"á".repeat(400)}.pdf`)).length, 255);
});

test("Content-Disposition has ASCII fallback and RFC 5987 Unicode filename", () => {
  const header = contentDispositionHeader("cotización 2026.pdf", "attachment");
  assert.match(header, /^attachment; filename="cotizaci_n 2026\.pdf";/);
  assert.match(header, /filename\*=UTF-8''cotizaci%C3%B3n%202026\.pdf$/);
  assert.doesNotMatch(header, /[\r\n]/);
});

test("CID normalization handles brackets, prefix, case and encoding", () => {
  assert.equal(normalizeContentId("cid:%4Cogo%401"), "logo@1");
  assert.equal(normalizeContentId("<LOGO@1>"), "logo@1");
});

test("CID is resolved only against an inline image from the same message DTO", () => {
  const html = '<p>Logo <img src="cid:logo@1" alt="Logo"></p>';
  const resolved = resolveInlineContentIds(html, [{ id: "11111111-1111-4111-8111-111111111111", content_id: "<LOGO@1>", inline: true, content_type: "image/png" }]);
  assert.match(resolved, /attachments\?id=11111111-1111-4111-8111-111111111111&amp;mode=inline|attachments\?id=11111111-1111-4111-8111-111111111111&mode=inline/);
  assert.doesNotMatch(resolveInlineContentIds(html, [{ id: "other", content_id: "logo@1", inline: false, content_type: "image/png" }]), /id=other/);
});

test("unresolved CID never leaks the provider identifier as a browser URL", () => {
  assert.doesNotMatch(resolveInlineContentIds('<img src="cid:secret@sender">', []), /cid:|secret@sender/);
});

test("remote images are sanitized into an inert blocked state", () => {
  const clean = sanitizeInboundMailHtml('<p>Hola<img src="https://images.example/logo.png" onerror="steal()"></p>');
  assert.match(clean, /data-kc-remote-src="https:\/\/images\.example\/logo\.png"/);
  assert.doesNotMatch(clean, /\ssrc=|onerror/);
});

test("explicit reveal activates ordinary remote images without scripts", () => {
  const clean = sanitizeInboundMailHtml('<img src="https://images.example/logo.png"><script>alert(1)</script>');
  const shown = revealRemoteMailImages(clean);
  assert.match(shown, /src="https:\/\/images\.example\/logo\.png"/);
  assert.doesNotMatch(shown, /script|alert/);
});

test("one-pixel tracking image remains blocked after explicit reveal", () => {
  const clean = sanitizeInboundMailHtml('<img src="https://tracker.example/open.gif" width="1" height="1">');
  assert.match(clean, /data-kc-tracking-pixel="true"/);
  assert.doesNotMatch(revealRemoteMailImages(clean), /\ssrc=/);
  assert.equal(hasRevealableRemoteMailImages(clean), false);
});

test("only ordinary external images enable the per-message consent action", () => {
  const ordinary = sanitizeInboundMailHtml('<img src="https://images.example/photo.jpg" alt="Foto">');
  assert.equal(hasRevealableRemoteMailImages(ordinary), true);
  assert.equal(hasRevealableRemoteMailImages("<p>Mensaje histórico saneado</p>"), false);
});

test("malicious HTML elements, handlers, forms and URLs stay removed", () => {
  const clean = sanitizeInboundMailHtml('<iframe src="x"></iframe><form><input></form><object></object><a href="javascript:x" onclick="x">x</a>');
  assert.doesNotMatch(clean, /iframe|form|input|object|javascript|onclick/);
});

test("attachment URL trust is restricted to Resend HTTPS hosts", () => {
  assert.equal(trustedResendAttachmentUrl("https://inbound-cdn.resend.com/id?signature=x"), true);
  assert.equal(trustedResendAttachmentUrl("https://resend.com/path"), true);
  assert.equal(trustedResendAttachmentUrl("https://resend.com.evil.test/file"), false);
  assert.equal(trustedResendAttachmentUrl("http://inbound-cdn.resend.com/file"), false);
});

test("private media route keeps authorization and no-sniff controls", () => {
  const route = readFileSync("src/app/api/admin/mail/attachments/route.ts", "utf8");
  assert.match(route, /requirePermissionsFromRequest/);
  assert.match(route, /mayAccessThread/);
  assert.match(route, /validateMailAttachment/);
  assert.match(route, /X-Content-Type-Options/);
  assert.match(route, /Cross-Origin-Resource-Policy/);
  assert.match(route, /Content-Security-Policy/);
  assert.match(route, /private, no-store/);
});

test("Mail UI exposes consent, preview and download without auto-send", () => {
  const ui = readFileSync("src/components/admin/mail-workspace.tsx", "utf8");
  assert.match(ui, /Mostrar imágenes/);
  assert.match(ui, /revealRemoteMailImages/);
  assert.match(ui, /hasRevealableRemoteImages/);
  assert.match(ui, /se bloquearon al recibirlo/);
  assert.match(ui, /mode=inline/);
  assert.match(ui, /Descargar/);
  assert.match(ui, /loading="lazy"/);
  assert.match(ui, /sm:grid-cols-2/);
});

test("inbound webhook validates bytes before private storage and records rejections", () => {
  const webhook = readFileSync("src/app/api/webhooks/resend/route.ts", "utf8");
  assert.match(webhook, /trustedResendAttachmentUrl/);
  assert.match(webhook, /validateMailAttachment/);
  assert.match(webhook, /redirect: "error"/);
  assert.match(webhook, /rejectedAttachmentCount/);
  assert.match(webhook, /sanitizeContentId/);
});

test("outbound business mail stays multipart alternative without marketing headers", () => {
  const service = readFileSync("src/lib/mail/service.ts", "utf8");
  assert.match(service, /html: cleanHtml/);
  assert.match(service, /text: cleanText/);
  assert.doesNotMatch(service, /List-Unsubscribe|Feedback-ID|tracking/i);
});
