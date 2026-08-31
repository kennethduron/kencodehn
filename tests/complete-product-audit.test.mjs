import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync("src/components/admin/ui.tsx", "utf8");
const shell = readFileSync("src/components/admin/admin-chrome.tsx", "utf8");
const mail = readFileSync("src/components/admin/mail-workspace.tsx", "utf8");
const dashboard = readFileSync("src/components/admin/dashboard.tsx", "utf8");
const labels = readFileSync("src/components/admin/admin-labels.ts", "utf8");
const activity = readFileSync("src/lib/admin/activity.ts", "utf8");
const notificationPanel = readFileSync("src/components/admin/notifications-panel.tsx", "utf8");
const notificationDropdown = readFileSync("src/components/admin/notification-dropdown.tsx", "utf8");
const pushSettings = readFileSync("src/components/admin/push-settings.tsx", "utf8");
const pushService = readFileSync("src/lib/push/service.ts", "utf8");
const pushClient = readFileSync("src/lib/push/client.ts", "utf8");
const serviceWorker = readFileSync("src/app/firebase-messaging-sw.js/route.ts", "utf8");
const manifest = readFileSync("src/app/manifest.ts", "utf8");

test("shared tooltip renders through a root portal", () => {
  assert.match(ui, /createPortal\([\s\S]*document\.body/);
  assert.match(ui, /pointer-events-none fixed z-\[120\]/);
});

test("shared tooltip evaluates every viewport side", () => {
  for (const side of ["top", "right", "bottom", "left"]) assert.match(ui, new RegExp(`\\"${side}\\"`));
  assert.match(ui, /const fits/);
  assert.match(ui, /window\.innerWidth/);
  assert.match(ui, /window\.innerHeight/);
});

test("shared tooltip clamps to viewport padding", () => {
  assert.match(ui, /const padding = 12/);
  assert.match(ui, /Math\.min\(Math\.max\(point\.left/);
  assert.match(ui, /Math\.min\(Math\.max\(point\.top/);
});

test("shared tooltip repositions while scrolling and resizing", () => {
  assert.match(ui, /addEventListener\("resize", updatePosition\)/);
  assert.match(ui, /addEventListener\("scroll", updatePosition, true\)/);
});

test("shared tooltip is available on hover and keyboard focus", () => {
  assert.match(ui, /onMouseEnter=\{\(\) => setOpen\(true\)\}/);
  assert.match(ui, /onFocusCapture=\{\(\) => setOpen\(true\)\}/);
  assert.match(ui, /role="tooltip"/);
  assert.match(ui, /aria-describedby/);
});

test("desktop shell keeps dynamic viewport sidebar and sticky header", () => {
  assert.match(shell, /sticky top-0 hidden h-\[100dvh\]/);
  assert.match(shell, /kc-admin-header sticky top-0/);
});

test("mobile mail composer owns the dynamic viewport and safe areas", () => {
  assert.match(mail, /h-\[100dvh\] max-h-\[100dvh\]/);
  assert.match(mail, /safe-area-inset-top/);
  assert.match(mail, /safe-area-inset-bottom/);
  assert.match(mail, /min-h-0 flex-1 overflow-y-auto/);
});

test("dashboard activity uses business-safe presentation", () => {
  assert.match(dashboard, /formatActivityMessage\(item\)/);
  assert.match(activity, /La automatización gestionó un recordatorio/);
  assert.doesNotMatch(dashboard, /item\.description/);
});

test("corrected core CRM copy preserves Spanish orthography", () => {
  for (const value of ["En conversación", "Cotización enviada", "Reunión", "Éxito", "Atención"]) assert.match(labels, new RegExp(value));
  for (const value of ["Distribución actual", "Próximos seguimientos", "únicamente"]) assert.match(dashboard, new RegExp(value));
});

test("notification center updates the global unread badge immediately", () => {
  assert.match(notificationPanel, /dispatchEvent\(new CustomEvent\("kc:notifications-changed"/);
  assert.match(notificationDropdown, /addEventListener\("kc:notifications-changed"/);
  assert.match(notificationDropdown, /setUnreadCount\(Math\.max\(0, unread\)\)/);
});

test("push deep links are restricted to CRM routes", () => {
  assert.match(pushService, /safePushActionUrl/);
  assert.match(pushService, /\^\\\/admin/);
  assert.match(serviceWorker, /\^\\\/admin/);
});

test("background notification click focuses an existing CRM window", () => {
  assert.match(serviceWorker, /clients\.matchAll/);
  assert.match(serviceWorker, /existing\.navigate\(url\)/);
  assert.match(serviceWorker, /existing\.focus\(\)/);
});

test("push token lifecycle includes refresh and logout cleanup", () => {
  assert.match(pushSettings, /getCurrentPushToken/);
  assert.match(pushSettings, /method: "POST"/);
  assert.match(pushClient, /method: "DELETE"/);
  assert.match(shell, /unregisterCurrentPushDevice/);
});

test("inactive profiles cannot receive push deliveries", () => {
  assert.match(pushService, /profiles\?\.active === true/g);
});

test("Apple home-screen context has an installable manifest", () => {
  assert.match(manifest, /start_url: "\/admin"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /716x716/);
});
