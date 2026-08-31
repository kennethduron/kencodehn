import assert from "node:assert/strict";
import { chromium, firefox, webkit, type BrowserType } from "playwright";

const baseUrl = process.env.KC_QA_BASE_URL ?? "https://kencodehn.com";
const parsedBaseUrl = new URL(baseUrl);
assert.ok(
  (parsedBaseUrl.protocol === "https:" && parsedBaseUrl.hostname === "kencodehn.com")
    || (parsedBaseUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedBaseUrl.hostname)),
  "QA base URL must be Ken Code Production or loopback development.",
);
const routes = ["/admin/login", "/recuperar-contrasena"];
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 1180, height: 820 },
];

const requestedEngine = process.argv.find((value) => value.startsWith("--engine="))?.split("=")[1];
const engines: Array<[string, BrowserType]> = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
].filter(([engine]) => !requestedEngine || engine === requestedEngine) as Array<[string, BrowserType]>;
assert.ok(engines.length > 0, "Use --engine=chromium, firefox, or webkit.");

const result: Array<Record<string, unknown>> = [];

for (const [engine, launcher] of engines) {
  const browser = await launcher.launch({ headless: true });
  try {
    const version = browser.version();
    const context = await browser.newContext({ locale: "es-HN", timezoneId: "America/Tegucigalpa" });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        assert.ok(response && response.status() < 400, `${engine} ${route} returned ${response?.status()}`);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(400);
        const evaluatePage = () => page.evaluate(() => {
          const visible = (element: Element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
          };
          const text = document.body.innerText;
          const undersized = [...document.querySelectorAll("button,a,input")]
            .filter(visible)
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.height < 40 && !element.closest("p");
            })
            .map((element) => element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName);
          return {
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            marketingNavigation: /\b(?:Servicios|Paquetes|Cotizar)\b/.test(text),
            floatingSalesWidgets: Boolean(document.querySelector('[aria-label*="WhatsApp" i], [aria-label*="chat" i]')),
            inputZoomRisk: [...document.querySelectorAll("input")].filter(visible).some((input) => Number.parseFloat(getComputedStyle(input).fontSize) < 16),
            undersized,
          };
        });
        let audit;
        try {
          audit = await evaluatePage();
        } catch (error) {
          if (!(error instanceof Error) || !/Execution context was destroyed/i.test(error.message)) throw error;
          await page.waitForLoadState("domcontentloaded");
          await page.waitForTimeout(500);
          audit = await evaluatePage();
        }
        assert.equal(audit.overflow, false, `${engine} ${route} ${viewport.width} overflow`);
        assert.equal(audit.marketingNavigation, false, `${engine} ${route} inherited marketing navigation`);
        assert.equal(audit.floatingSalesWidgets, false, `${engine} ${route} inherited a floating public widget`);
        if (viewport.width < 640) assert.equal(audit.inputZoomRisk, false, `${engine} ${route} has iOS input zoom risk`);
        assert.deepEqual(audit.undersized, [], `${engine} ${route} has undersized controls: ${audit.undersized.join(", ")}`);
        result.push({ engine, version, route, viewport: `${viewport.width}x${viewport.height}`, ...audit });
      }
    }
    assert.deepEqual(pageErrors, [], `${engine} page errors: ${pageErrors.join(" | ")}`);
    await context.close();
  } finally {
    await browser.close();
  }
}

console.log(JSON.stringify({ status: "PASS", checks: result.length, result }, null, 2));
