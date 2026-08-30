import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, devices, firefox, webkit, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright";

const baseUrl = process.env.PHASE3_QA_BASE_URL ?? "https://kencodehn.com";
const parsedBase = new URL(baseUrl);
if (parsedBase.protocol !== "https:" || parsedBase.hostname !== "kencodehn.com") throw new Error("Production visual QA is pinned to https://kencodehn.com.");
const engine = (process.argv.find((value) => value.startsWith("--engine="))?.split("=")[1] ?? "chromium") as "chromium" | "firefox" | "webkit";
if (!(["chromium", "firefox", "webkit"] as const).includes(engine)) throw new Error("Use --engine=chromium, firefox, or webkit.");

const launchers = { chromium, firefox, webkit } as const;
const outputDir = path.resolve("test-artifacts", "phase3-production-qa", engine);
const routes = [
  ["dashboard", "/admin"], ["clientes", "/admin/clientes"], ["proyectos", "/admin/proyectos"],
  ["cobros", "/admin/cobros"], ["pagos", "/admin/pagos"], ["finanzas", "/admin/finanzas"],
  ["gastos", "/admin/finanzas/gastos"], ["reportes", "/admin/finanzas/reportes"],
] as const;
const forbiddenTerms = /\b(UUID|UID|RLS|Provider|Migration|Cron|Supabase|Metadata|Foreign Key|Webhook|Logs)\b/i;
type QaResult = { engine: string; playwright: string; contexts: Array<{ label: string; viewport: string; routes: number; screenshots: number }>; checks: number; issues: string[]; hardware: false };
const result: QaResult = { engine, playwright: "1.60.0", contexts: [], checks: 0, issues: [], hardware: false };

async function authenticateInMemory(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-HN", timezoneId: "America/Tegucigalpa" });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  process.stdout.write(`LOGIN_REQUIRED:${engine}: Inicie sesión personalmente en la ventana. La sesión se mantendrá solo en memoria durante este proceso.\n`);
  await page.locator('nav[aria-label="Navegacion principal del CRM"]').first().waitFor({ state: "visible", timeout: 600_000 });
  const state = await context.storageState();
  await context.close();
  return state;
}

async function checkPage(page: Page, routeLabel: string, viewportLabel: string, screenshot: boolean) {
  const response = await page.goto(`${baseUrl}${routes.find(([label]) => label === routeLabel)?.[1]}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.ok(response && response.status() < 400, `${routeLabel} returned ${response?.status()}`);
  await page.locator('nav[aria-label="Navegacion principal del CRM"]').first().waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(250);
  const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth, height: window.innerHeight }));
  result.checks += 1;
  if (geometry.scrollWidth > geometry.width + 1) result.issues.push(`${engine}/${viewportLabel}/${routeLabel}: document overflow ${geometry.scrollWidth}>${geometry.width}`);
  const visibleText = await page.locator("main.kc-admin-theme").last().innerText();
  result.checks += 1;
  const forbidden = visibleText.match(forbiddenTerms);
  if (forbidden) result.issues.push(`${engine}/${viewportLabel}/${routeLabel}: technical term ${forbidden[0]}`);
  if (geometry.width <= 430) {
    const undersized = await page.locator("button:visible,input:visible,select:visible,textarea:visible").evaluateAll((elements) => elements.filter((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && (rect.height < 40 || rect.width < 40); }).length);
    result.checks += 1;
    if (undersized) result.issues.push(`${engine}/${viewportLabel}/${routeLabel}: ${undersized} undersized mobile controls`);
  }
  if (screenshot) await page.screenshot({ path: path.join(outputDir, `${viewportLabel}-${routeLabel}.png`), fullPage: true, animations: "disabled" });
}

async function checkDrawer(page: Page, viewportLabel: string) {
  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  const opener = page.getByRole("button", { name: "Abrir menu" }).first();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Menu principal" });
  await dialog.waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
  const close = page.getByRole("button", { name: "Cerrar menu" }).last();
  assert.equal(await close.evaluate((element) => document.activeElement === element), true);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await opener.click();
  await dialog.getByRole("link", { name: "Clientes" }).click();
  await dialog.waitFor({ state: "hidden" });
  result.checks += 6;
  await page.screenshot({ path: path.join(outputDir, `${viewportLabel}-mobile-navigation.png`), fullPage: true, animations: "disabled" });
}

async function checkSidebar(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("kc-crm-sidebar-collapsed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  const sidebar = page.locator('aside[aria-label="Barra lateral"]:visible');
  await sidebar.waitFor({ state: "visible" });
  await page.waitForTimeout(350);
  const expanded = await sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  await page.getByRole("button", { name: "Colapsar menu" }).click();
  await page.waitForTimeout(350);
  const collapsed = await sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  assert.ok(Math.abs(expanded - 264) <= 2, `expanded sidebar ${expanded}px`);
  assert.ok(Math.abs(collapsed - 72) <= 2, `collapsed sidebar ${collapsed}px`);
  assert.equal(await page.evaluate(() => localStorage.getItem("kc-crm-sidebar-collapsed")), "true");
  await page.reload({ waitUntil: "domcontentloaded" });
  await sidebar.waitFor({ state: "visible" });
  await page.waitForTimeout(350);
  assert.ok(Math.abs((await sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))) - 72) <= 2);
  await page.getByRole("button", { name: "Expandir menu" }).click();
  result.checks += 4;
}

async function runMatrix(browser: Browser, state: Awaited<ReturnType<typeof authenticateInMemory>>, label: string, options: BrowserContextOptions, viewports: Array<{ width: number; height: number }>, screenshotWidths: Set<number>) {
  const context: BrowserContext = await browser.newContext({ ...options, storageState: state, locale: "es-HN", timezoneId: "America/Tegucigalpa" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  page.on("console", (message) => { if (message.type() === "error" && !/^Failed to load resource:/i.test(message.text())) errors.push(message.text()); });
  let screenshots = 0;
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const viewportLabel = `${label}-${viewport.width}x${viewport.height}`;
    for (const [routeLabel] of routes) { const capture = screenshotWidths.has(viewport.width); await checkPage(page, routeLabel, viewportLabel, capture); if (capture) screenshots += 1; }
    if (viewport.width <= 430) await checkDrawer(page, viewportLabel);
  }
  if (engine === "chromium" && label === "desktop") await checkSidebar(page);
  for (const error of errors) if (!/favicon|Failed to load resource.*404/i.test(error)) result.issues.push(`${engine}/${label}: console ${error.slice(0, 240)}`);
  result.contexts.push({ label, viewport: viewports.map(({ width, height }) => `${width}x${height}`).join(","), routes: routes.length * viewports.length, screenshots });
  await context.close();
}

await mkdir(outputDir, { recursive: true });
const browser = await launchers[engine].launch({ headless: false });
try {
  const state = await authenticateInMemory(browser);
  if (engine === "chromium") {
    await runMatrix(browser, state, "desktop", {}, [{ width: 320, height: 844 }, { width: 360, height: 800 }, { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 820, height: 1180 }, { width: 1024, height: 768 }, { width: 1280, height: 900 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }, { width: 844, height: 390 }, { width: 932, height: 430 }, { width: 1180, height: 820 }], new Set([375, 1440]));
    await runMatrix(browser, state, "android-pixel-7", devices["Pixel 7"], [{ width: 412, height: 915 }, { width: 915, height: 412 }], new Set([412]));
  } else if (engine === "webkit") {
    await runMatrix(browser, state, "iphone", devices["iPhone 13"], [{ width: 390, height: 844 }, { width: 844, height: 390 }], new Set([390]));
    await runMatrix(browser, state, "ipad", devices["iPad Pro 11"], [{ width: 834, height: 1194 }, { width: 1194, height: 834 }], new Set([834]));
  } else {
    await runMatrix(browser, state, "desktop", {}, [{ width: 1440, height: 1000 }, { width: 390, height: 844 }], new Set([1440]));
  }
} finally {
  await browser.close();
}

await writeFile(path.join(outputDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
if (result.issues.length) throw new Error(`Production visual QA found ${result.issues.length} issue(s):\n${result.issues.join("\n")}`);
console.log(JSON.stringify({ ...result, status: "PASS", authStorage: "memory-only", credentialsCaptured: false }, null, 2));
