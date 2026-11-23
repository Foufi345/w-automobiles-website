import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const MOBILE_WIDTHS = [320, 360, 390, 768] as const;

const ROUTES = [
  "/",
  "/vehicules",
  "/showroom",
  "/contact",
  "/localisation",
  "/admin/login",
] as const;

test.describe("Mobile Foundation — Zero Horizontal Overflow", () => {
  for (const width of MOBILE_WIDTHS) {
    test(`No horizontal scroll at ${width}px across public and admin routes`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
      });
      const page = await context.newPage();

      await page.addInitScript(() => {
        sessionStorage.setItem("w_preloader_seen", "1");
      });

      for (const route of ROUTES) {
        await page.goto(`${BASE_URL}${route}`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(500);

        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(
          metrics.scrollWidth,
          `Overflow on ${route} at ${width}px (scrollWidth=${metrics.scrollWidth} > clientWidth=${metrics.clientWidth})`
        ).toBeLessThanOrEqual(metrics.clientWidth);
      }

      await context.close();
    });
  }
});
