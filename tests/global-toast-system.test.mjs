import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const ui = read("src/components/admin/ui.tsx");
const shell = read("src/components/admin/admin-chrome.tsx");

test("global toast viewport owns all toast rendering", () => {
  assert.match(ui, /export function ToastViewport/);
  assert.match(shell, /<ToastViewport \/>/);
  assert.match(ui, /return null;\s*}\s*\n\s*export function ToastViewport/);
  assert.match(ui, /createPortal\(/);
});

test("toast durations follow the global severity policy", () => {
  assert.match(ui, /success: 3000/);
  assert.match(ui, /info: 3000/);
  assert.match(ui, /warning: 4500/);
  assert.match(ui, /error: 8000/);
});

test("global toast system deduplicates and stacks messages", () => {
  assert.match(ui, /item\.message === normalized && item\.variant === variant/);
  assert.match(ui, /sources\.includes\(source\)/);
  assert.match(ui, /flex-col gap-2/);
});

test("toast lifecycle clears on navigation and component unmount", () => {
  assert.match(ui, /pathname: string/);
  assert.match(ui, /item\.pathname === pathname/);
  assert.match(ui, /clearToastsOutsidePath\(pathname\)/);
  assert.match(ui, /releaseToastSource\(source\)/);
  assert.match(ui, /finishToastDismiss/);
});

test("toasts have polite and assertive accessible live regions", () => {
  assert.match(ui, /role=\{item\.variant === "error" \? "alert" : "status"\}/);
  assert.match(ui, /aria-live=\{item\.variant === "error" \? "assertive" : "polite"\}/);
  assert.match(ui, /aria-atomic="true"/);
  assert.match(ui, /aria-label="Cerrar mensaje"/);
  assert.match(ui, /focus-visible:outline/);
});

test("toast viewport is mobile-safe and does not block the application", () => {
  assert.match(ui, /pointer-events-none fixed inset-x-3/);
  assert.match(ui, /safe-area-inset-bottom/);
  assert.match(ui, /100dvh/);
  assert.match(ui, /sm:right-4/);
  assert.match(ui, /max-w|w-\[min\(24rem/);
  assert.match(ui, /pointer-events-auto grid h-8 w-8/);
});

test("toast dismissal animates cleanly and honors reduced motion", () => {
  assert.match(ui, /data-\[closing=true\]:translate-y-2/);
  assert.match(ui, /data-\[closing=true\]:opacity-0/);
  assert.match(ui, /motion-reduce:transition-none/);
});

test("CRM feature surfaces continue through the shared Toast component", () => {
  const consumers = [
    "profile-panel.tsx",
    "mail-workspace.tsx",
    "mail-identity-manager.tsx",
    "team-panel.tsx",
    "lead-list.tsx",
    "tasks-panel.tsx",
    "admin-settings-panel.tsx",
    "notifications-panel.tsx",
    "push-settings.tsx",
  ];
  for (const file of consumers) {
    const source = read(`src/components/admin/${file}`);
    assert.match(source, /import \{[^}]*Toast[^}]*\} from "\.\/ui"/);
    assert.match(source, /<Toast /);
  }
});
