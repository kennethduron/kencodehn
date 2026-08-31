import { chromium, firefox, webkit, type BrowserType } from "playwright";

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const engines: Array<[string, BrowserType]> = [["Chromium", chromium], ["WebKit", webkit], ["Firefox", firefox]];

for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.name));
    await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded" });
    const workerSource = await page.evaluate(async () => {
      const response = await window.fetch("/firebase-messaging-sw.js", { cache: "no-store" });
      if (!response.ok) throw new Error("worker_unavailable");
      return response.text();
    });
    await page.evaluate((source) => {
      // Compilation is intentional: it catches WebKit lexer/parser failures
      // before notification permission or a real subscription is requested.
      new Function(source);
    }, workerSource);
    if (errors.length) throw new Error(`${name} page errors: ${errors.join(",")}`);
    console.log(`${name}: notification worker syntax PASS`);
  } finally {
    await browser.close();
  }
}
