import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox, webkit, type BrowserType, type Page } from "playwright";

const baseUrl = "https://kencodehn.com";
const outputDir = path.resolve("test-artifacts", "final-auth-production-qa");
const routes = [
  { label: "login", path: "/admin/login", heading: "Acceso al CRM", backLink: false },
  { label: "recovery", path: "/recuperar-contrasena", heading: "Recuperar contraseña", backLink: true },
  { label: "invitation", path: "/admin/recovery?mode=invite", heading: "Configurar cuenta", backLink: true },
] as const;
const availableEngines = { chromium, webkit, firefox } satisfies Record<string, BrowserType>;
const selectedEngine = process.env.FINAL_AUTH_QA_ENGINE;
if (selectedEngine && !(selectedEngine in availableEngines)) throw new Error("FINAL_AUTH_QA_ENGINE must be chromium, webkit or firefox.");
const engines = selectedEngine
  ? { [selectedEngine]: availableEngines[selectedEngine as keyof typeof availableEngines] }
  : availableEngines;
const matrices = {
  chromium: [[320,700],[360,780],[375,812],[390,844],[412,915],[430,932],[768,1024],[820,1180],[1024,768],[1280,800],[1440,900],[1920,1080],[844,390],[1194,834]],
  webkit: [[390,844],[844,390],[834,1194],[1194,834]],
  firefox: [[390,844],[1440,900]],
} as const;

type Result = { engine: string; viewport: string; routes: number; screenshots: number };
const results: Result[] = [];

async function geometry(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector("[data-auth-shell]");
    const style = shell ? getComputedStyle(shell) : null;
    return {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      shellWidth: shell?.getBoundingClientRect().width ?? 0,
      shellHeight: shell?.getBoundingClientRect().height ?? 0,
      paddingTop: Number.parseFloat(style?.paddingTop ?? "0"),
      paddingBottom: Number.parseFloat(style?.paddingBottom ?? "0"),
    };
  });
}

await mkdir(outputDir, { recursive: true });
for (const [engine, launcher] of Object.entries(engines)) {
  const browser = await launcher.launch({ headless: true });
  try {
    for (const [width, height] of matrices[engine as keyof typeof matrices]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: "es-HN", timezoneId: "America/Tegucigalpa" });
      const page = await context.newPage();
      const runtimeErrors: string[] = [];
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      page.on("response", (response) => { if (response.status() >= 500) runtimeErrors.push(`${response.status()} ${response.url()}`); });
      let screenshots = 0;

      for (const route of routes) {
        const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        assert.ok(response && response.status() < 400, `${engine} ${width}x${height} ${route.path}: HTTP ${response?.status()}`);
        assert.equal(await page.locator("[data-auth-shell]").count(), 1, `${engine} ${route.path}: Auth Shell missing`);
        assert.equal(await page.locator("header, footer").count(), 0, `${engine} ${route.path}: public chrome leaked`);
        assert.equal(await page.locator('a[href*="wa.me"]').count(), 0, `${engine} ${route.path}: WhatsApp leaked`);
        assert.equal(await page.getByText("Cotizar", { exact: true }).count(), 0, `${engine} ${route.path}: marketing navigation leaked`);
        assert.equal(await page.getByRole("heading", { name: route.heading, exact: true }).count(), 1, `${engine} ${route.path}: heading missing`);
        const size = await geometry(page);
        assert.ok(size.scrollWidth <= size.viewportWidth + 1, `${engine} ${width}x${height} ${route.path}: horizontal overflow`);
        assert.ok(size.shellWidth <= size.viewportWidth + 1, `${engine} ${width}x${height} ${route.path}: shell overflow`);
        assert.ok(size.shellHeight >= size.viewportHeight - 1, `${engine} ${width}x${height} ${route.path}: viewport height not covered`);
        assert.ok(size.paddingTop >= 31 && size.paddingBottom >= 31, `${engine} ${width}x${height} ${route.path}: safe padding missing`);
        if (route.backLink) {
          assert.equal(await page.getByRole("link", { name: "Volver al acceso", exact: true }).count(), 1, `${engine} ${route.path}: back link missing`);
        } else {
          assert.equal(await page.getByRole("link", { name: "¿Olvidó su contraseña?", exact: true }).count(), 1, `${engine} ${route.path}: recovery link missing`);
        }
      }

      if ((engine === "chromium" && [320,390,430,768,1440,1920,844].includes(width))
        || (engine === "webkit" && [390,834].includes(width))
        || (engine === "firefox" && width === 1440)) {
        await page.screenshot({ path: path.join(outputDir, `${engine}-${width}x${height}-invitation.png`), fullPage: true, animations: "disabled" });
        screenshots = 1;
      }
      assert.deepEqual(runtimeErrors, [], `${engine} ${width}x${height}: runtime/server errors`);
      results.push({ engine, viewport: `${width}x${height}`, routes: routes.length, screenshots });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

const report = {
  status: "PASS",
  target: baseUrl,
  scope: "Production auth layout, responsive geometry and unauthenticated invitation/recovery presentation.",
  credentialsCaptured: false,
  emailsSent: 0,
  hardware: false,
  results,
};
await writeFile(path.join(outputDir, "result.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
