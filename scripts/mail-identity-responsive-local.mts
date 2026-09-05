import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium, webkit, type BrowserType } from "playwright";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.MAIL_LOCAL_APP_URL || "http://localhost:3011";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname), "Local app only");
const status = process.env.SUPABASE_LOCAL_URL && process.env.SUPABASE_LOCAL_SERVICE_KEY
  ? { API_URL: process.env.SUPABASE_LOCAL_URL, SECRET_KEY: process.env.SUPABASE_LOCAL_SERVICE_KEY }
  : JSON.parse(execFileSync("cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase status --output json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
assert.ok(["localhost", "127.0.0.1"].includes(new URL(status.API_URL).hostname), "Local Supabase only");
const service = createClient(status.API_URL, status.SECRET_KEY || status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const profile = await service.from("profiles").select("email").eq("role", "owner").like("email", "identity.owner.%@example.test").order("created_at", { ascending: false }).limit(1).single();
assert.ifError(profile.error);

const sizes = [320, 360, 375, 390, 412, 430, 600, 768, 820, 1024, 1280, 1440, 1920];
const engines: Array<[string, BrowserType]> = [["Chromium", chromium], ["WebKit", webkit]];
const results: Array<Record<string, unknown>> = [];
let authenticatedState: Awaited<ReturnType<import("playwright").BrowserContext["storageState"]>> | undefined;

for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-HN", storageState: authenticatedState });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
    if (!authenticatedState) {
      await page.getByLabel("Correo").fill(profile.data.email);
      await page.locator('input[type="password"]').fill("Identity-Local-Only-2026!");
      await page.getByRole("button", { name: /Entrar al CRM|Ingresar/ }).click();
      try { await page.getByRole("heading", { name: "Resumen comercial y operativo" }).waitFor({ timeout: 30_000 }); }
      catch (error) { console.error(name, "login diagnostic", page.url(), (await page.locator("body").innerText()).slice(0, 800)); throw error; }
      authenticatedState = await context.storageState();
    }
    await page.goto(`${baseUrl}/admin/mail/configuracion`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Direcciones de Ken Code" }).waitFor({ timeout: 30_000 });
    let checks = 0;
    for (const width of sizes) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth, buttons: Array.from(document.querySelectorAll("button")).filter((button) => ["Editar identidad", "Asignar responsable", "Cambiar responsable", "Establecer como principal", "Desasignar de usuario", "Desactivar identidad"].includes(button.textContent?.trim() || "")).map((button) => { const rect = button.getBoundingClientRect(); return { label: button.textContent?.trim(), width: rect.width, height: rect.height }; }) }));
      assert.ok(geometry.scrollWidth <= geometry.innerWidth + 1, `${name} ${width}: no horizontal overflow`);
      assert.ok(geometry.buttons.length >= 3, `${name} ${width}: identity actions remain rendered`);
      assert.ok(geometry.buttons.every((button) => button.width > 0 && button.height >= 44), `${name} ${width}: actions remain accessible`);
      checks += 1;
    }
    results.push({ engine: name, viewportChecks: checks, actionsAccessible: true, horizontalOverflow: false });
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ status: "PASS", target: "loopback-only", results, externalEmails: 0 }, null, 2));
