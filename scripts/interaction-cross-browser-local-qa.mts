import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium, firefox, webkit, type BrowserType } from "playwright";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(execFileSync("cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase status --output json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const service = createClient(status.API_URL, status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const target = await service.from("receivables").select("id").eq("payment_state", "open").not("recurring_service_id", "is", null).limit(1).single();
if (target.error) throw target.error;

const engines: Array<[string, BrowserType, Array<[number, number]>]> = [
  ["Chromium", chromium, [[320, 700], [360, 780], [375, 812], [390, 844], [392, 820], [412, 915], [430, 932], [480, 820], [600, 900], [768, 1024], [820, 1180], [912, 1180], [1024, 768], [1280, 800], [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440], [568, 320], [667, 375], [740, 360], [844, 390], [932, 430], [1180, 820], [1194, 834]]],
  ["WebKit", webkit, [[320, 700], [390, 844], [430, 932], [768, 1024], [834, 1194], [844, 390], [1194, 834]]],
  ["Firefox", firefox, [[390, 844], [1440, 900], [1920, 1080]]],
];
const result: Array<Record<string, unknown>> = [];
let authenticatedState: Awaited<ReturnType<import("playwright").BrowserContext["storageState"]>> | undefined;

for (const [name, engine, viewports] of engines) {
  console.log(`${name}: starting`);
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-HN", timezoneId: "America/Tegucigalpa", storageState: authenticatedState });
    const page = await context.newPage();
    const clientErrors: string[] = [];
    page.on("pageerror", (error) => clientErrors.push(error.message));
    await page.goto("http://localhost:3000/admin", { waitUntil: "domcontentloaded" });
    if (!authenticatedState) {
      await page.getByLabel("Correo").fill("manager.interaction@example.test");
      await page.locator('input[type="password"]').fill("Interaction-Local-Only-2026!");
      await page.waitForTimeout(750);
      await page.getByRole("button", { name: /Entrar al CRM|Ingresar/ }).click();
    }
    try {
      await page.locator('nav[aria-label="Navegación principal del CRM"]').waitFor({ state: "attached", timeout: 30_000 });
    } catch (error) {
      console.log(name, "login diagnostic", page.url(), (await page.locator("body").innerText()).slice(0, 500));
      throw error;
    }
    if (!authenticatedState) authenticatedState = await context.storageState();
    await page.goto(`http://localhost:3000/admin/cobros/${target.data.id}`, { waitUntil: "domcontentloaded" });
    const opener = page.getByRole("button", { name: "Cancelar este período" });
    await opener.click();
    const dialog = page.getByRole("dialog");
    const reason = dialog.getByLabel("Motivo");
    await reason.click();
    let billingRequests = 0;
    page.on("request", (request) => { if (request.url().includes("/api/admin/billing")) billingRequests += 1; });
    const phrase = "Registro duplicado. Se creó durante la carga histórica y deseo eliminarlo.\nLínea dos: ñ, á, 123.";
    await reason.pressSequentially(phrase, { delay: 2 });
    assert.equal(await reason.inputValue(), phrase, `${name}: continuous typing`);
    assert.equal(await reason.evaluate((node) => document.activeElement === node), true, `${name}: focus retained`);
    await reason.press("ControlOrMeta+A");
    await reason.pressSequentially("Texto reemplazado con acentos y ñ.");
    await reason.press("Backspace");
    await reason.pressSequentially("ñ");
    assert.equal(await reason.inputValue(), "Texto reemplazado con acentos y ññ", `${name}: edit controls`);
    assert.equal(billingRequests, 0, `${name}: no request per keystroke`);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForTimeout(50);
    const focusState = await opener.evaluate((node) => ({ returned: document.activeElement === node, active: document.activeElement?.outerHTML.slice(0, 180) }));
    if (!focusState.returned) console.log(name, focusState);
    assert.equal(focusState.returned, true, `${name}: focus returned to opener`);

    let geometryChecks = 0;
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await opener.click();
      const geometry = await dialog.evaluate((node) => { const rect = node.getBoundingClientRect(); const panel = node.querySelector<HTMLElement>(".kc-modal-viewport")?.getBoundingClientRect(); return { document: document.documentElement.scrollWidth, viewport: innerWidth, left: panel?.left ?? -1, right: panel?.right ?? innerWidth + 1, top: panel?.top ?? -1, bottom: panel?.bottom ?? innerHeight + 1, height: innerHeight, dialogLeft: rect.left }; });
      assert.ok(geometry.document <= geometry.viewport + 1, `${name} ${width}x${height}: overflow`);
      assert.ok(geometry.left >= 0 && geometry.right <= width + 1, `${name} ${width}x${height}: horizontal modal bounds`);
      assert.ok(geometry.top >= 0 && geometry.bottom <= height + 1, `${name} ${width}x${height}: vertical modal bounds`);
      await page.keyboard.press("Escape");
      geometryChecks += 1;
    }
    assert.deepEqual(clientErrors, [], `${name}: no client exceptions`);
    result.push({ engine: name, version: browser.version(), typing: "PASS", focusReturn: "PASS", noNetworkPerKeystroke: true, geometryChecks });
    await context.close();
  } finally {
    await browser.close();
  }
}

console.log(JSON.stringify({ status: "PASS", hardware: false, results: result }, null, 2));
