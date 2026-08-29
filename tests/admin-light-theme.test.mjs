import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("src/app/globals.css", "utf8");
const chrome = readFileSync("src/components/admin/admin-chrome.tsx", "utf8");
const login = readFileSync("src/components/admin/admin-login.tsx", "utf8");
const authShell = readFileSync("src/components/auth/auth-shell.tsx", "utf8");
const verification = readFileSync("src/components/auth/owner-email-verification-form.tsx", "utf8");
const loading = readFileSync("src/app/admin/loading.tsx", "utf8");
const leads = readFileSync("src/components/admin/lead-list.tsx", "utf8");
const dialogs = readFileSync("src/components/admin/ui.tsx", "utf8");
const password = readFileSync("src/components/auth/password-field.tsx", "utf8");

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

test("CRM theme centralizes a light workspace palette without changing public root tokens", () => {
  assert.match(css, /\.kc-admin-theme\s*\{/);
  for (const token of ["--kc-admin-workspace", "--kc-admin-surface", "--kc-admin-sidebar", "--kc-admin-text", "--kc-admin-muted", "--kc-admin-border", "--kc-admin-primary"]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /:root\s*\{[\s\S]*--kc-bg: #020617/);
  assert.match(chrome, /kc-admin-theme min-h-screen/);
  assert.match(login, /kc-admin-theme/);
  assert.match(authShell, /kc-admin-theme/);
  assert.match(verification, /kc-admin-theme/);
  assert.match(loading, /kc-admin-theme/);
});

test("core light theme color pairs meet WCAG AA contrast", () => {
  assert.ok(contrast("#10233f", "#ffffff") >= 4.5, "primary text");
  assert.ok(contrast("#52627a", "#ffffff") >= 4.5, "secondary text");
  assert.ok(contrast("#64748b", "#ffffff") >= 4.5, "placeholder text");
  assert.ok(contrast("#0759b8", "#ffffff") >= 4.5, "primary action/link");
  assert.ok(contrast("#9f1239", "#fff1f2") >= 4.5, "danger state");
  assert.ok(contrast("#bec9d8", "#14243d") >= 4.5, "sidebar secondary text");
});

test("forms, date controls, disabled states, and focus inherit accessible light tokens", () => {
  assert.match(css, /\.kc-admin-theme input,[\s\S]*\.kc-admin-theme select/);
  assert.match(css, /input::placeholder/);
  assert.match(css, /color-scheme: light/);
  assert.match(css, /filter: none/);
  assert.match(css, /\.kc-admin-theme input:disabled/);
  assert.match(css, /outline: 3px solid var\(--kc-cyan\)/);
});

test("large lead tables switch to mobile cards and never become an uncontrolled overflow", () => {
  assert.match(leads, /kc-responsive-table hidden overflow-hidden[\s\S]*xl:block/);
  assert.match(leads, /kc-mobile-cards grid gap-4 xl:hidden/);
  assert.match(leads, /table-fixed/);
  assert.match(css, /overflow-x: hidden/);
});

test("mobile navigation remains horizontally controlled with touch-sized targets", () => {
  assert.match(chrome, /aria-label="Navegacion movil del CRM"/);
  assert.match(chrome, /overflow-x-auto/);
  assert.match(chrome, /min-h-12 min-w-\[4\.5rem\]/);
  assert.match(chrome, /aria-label="Cerrar sesion" className="inline-flex min-h-11 min-w-11/);
  assert.match(chrome, /aria-label="Abrir menu"/);
  assert.match(chrome, /aria-label="Cerrar menu"/);
});

test("dialogs stay inside the viewport and password controls remain accessible", () => {
  assert.match(dialogs, /kc-modal-viewport/);
  assert.match(css, /max-height: calc\(100dvh - 2rem\)/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(password, /min-w-12/);
  assert.match(password, /aria-label=\{visible \?/);
  assert.match(password, /autoComplete=\{autoComplete\}/);
});
