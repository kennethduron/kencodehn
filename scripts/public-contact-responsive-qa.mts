import { chromium, firefox, webkit, type BrowserType } from "playwright";

const baseUrl = process.env.CONTACT_QA_BASE_URL || "http://127.0.0.1:3000";
const viewports = [320, 360, 375, 390, 392, 412, 430, 600, 768, 820, 1024, 1280, 1440, 1920]
  .map((width) => ({ width, height: width < 600 ? 760 : 900, label: `${width}px` }));
const orientations = [
  { width: 844, height: 390, label: "phone-landscape" },
  { width: 1180, height: 820, label: "tablet-landscape" },
];

async function audit(engine: string, browserType: BrowserType) {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const viewport of [...viewports, ...orientations]) {
      await page.setViewportSize(viewport);
      await page.goto(`${baseUrl}/contacto`, { waitUntil: "domcontentloaded" });
      const result = await page.evaluate(() => {
        const form = document.querySelector<HTMLFormElement>('form[aria-label="Formulario de cotización"]');
        const textarea = form?.querySelector("textarea");
        const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
        const rootWidth = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll<HTMLElement>("body *")].filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > rootWidth + 1;
        });
        const fits = (element: Element | null | undefined) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          return rect.left >= -1 && rect.right <= rootWidth + 1;
        };
        return {
          rootWidth,
          scrollWidth: document.documentElement.scrollWidth,
          formFits: fits(form),
          textareaFits: fits(textarea),
          submitFits: fits(submit),
          floatingWidgets: document.querySelectorAll('.fixed[aria-label="Abrir Ken Code AI"], .fixed[aria-label="WhatsApp"]').length,
          offenders: offenders.slice(0, 5).map((element) => `${element.tagName}.${element.className}`),
        };
      });
      if (result.scrollWidth > result.rootWidth + 1 || !result.formFits || !result.textareaFits || !result.submitFits || result.floatingWidgets || result.offenders.length) {
        throw new Error(`${engine} ${viewport.label} failed: ${JSON.stringify(result)}`);
      }
    }
    console.log(`${engine}: ${viewports.length} widths + landscape PASS`);
  } finally {
    await browser.close();
  }
}

await audit("Chromium", chromium);
await audit("WebKit", webkit);
await audit("Firefox", firefox);
