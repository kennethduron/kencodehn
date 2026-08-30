import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox, webkit, type BrowserType, type Page } from "playwright";

const baseUrl = "https://kencodehn.com";
const outputDir = path.resolve("test-artifacts", "phase5-production-engine-qa");
const routes = ["/admin", "/admin/perfil", "/admin/mail", "/admin/mail/configuracion"];
const engines = { chromium, webkit, firefox } satisfies Record<string, BrowserType>;
const matrices = {
  chromium: [[320,844],[360,800],[375,812],[390,844],[412,915],[430,932],[768,1024],[820,1180],[1024,768],[1280,900],[1440,1000],[1920,1080],[844,390],[932,430],[1180,820]],
  webkit: [[390,844],[844,390],[834,1194],[1194,834]],
  firefox: [[390,844],[1440,1000]],
} as const;

async function geometry(page: Page) {
  return page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
}

await mkdir(outputDir, { recursive: true });
const results: Array<{ engine: string; viewport: string; routes: number; screenshots: number }> = [];
for (const [engine, launcher] of Object.entries(engines)) {
  const browser = await launcher.launch({ headless: true });
  try {
    for (const [width, height] of matrices[engine as keyof typeof matrices]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: "es-HN", timezoneId: "America/Tegucigalpa" });
      const page = await context.newPage();
      const failures: string[] = [];
      page.on("pageerror", (error) => failures.push(error.message));
      page.on("response", (response) => { if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`); });
      for (const route of routes) {
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        assert.ok(response && response.status() < 400, `${engine} ${width}x${height} ${route}: HTTP ${response?.status()}`);
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
        const size = await geometry(page);
        assert.ok(size.document <= size.viewport + 1 && size.body <= size.viewport + 1, `${engine} ${width}x${height} ${route}: horizontal overflow`);
        assert.equal(await page.locator('nav[aria-label="Navegación principal del CRM"]').count(), 0, `${engine} ${route}: private shell leaked without auth`);
        assert.ok((await page.locator("body").innerText()).includes("CRM Ken Code"), `${engine} ${route}: secure login missing`);
      }
      let screenshots = 0;
      if ((engine === "chromium" && [320,375,430,768,1440,1920].includes(width)) || (engine === "webkit" && [390,834].includes(width)) || (engine === "firefox" && width === 1440)) {
        await page.screenshot({ path: path.join(outputDir, `${engine}-${width}x${height}-mail-protection.png`), fullPage: true, animations: "disabled" });
        screenshots = 1;
      }
      assert.deepEqual(failures, [], `${engine} ${width}x${height}: runtime/server errors`);
      results.push({ engine, viewport: `${width}x${height}`, routes: routes.length, screenshots });
      await context.close();
    }
  } finally { await browser.close(); }
}

const report = { status: "PASS", scope: "Production multi-engine rendering, responsive geometry, and unauthenticated protection; authenticated interactions verified separately with Codex Browser.", hardware: false, credentialsCaptured: false, results };
await writeFile(path.join(outputDir, "result.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
