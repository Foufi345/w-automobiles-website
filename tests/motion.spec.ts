import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3004";
const WIDTHS = [360, 390, 768, 1024, 1440] as const;

function attachConsoleCollectors(page: Page) {
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on("pageerror", (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error") {
      errors.push(`[console.error] ${text}`);
    } else if (type === "warning") {
      warnings.push(`[console.warn] ${text}`);
    }
  });

  return { errors, warnings };
}

test.describe("Production Motion & Layout Verification", () => {
  test("(a) Home / loads 10 times: H1, subtitle and both CTAs visible in viewport within 3.5s", async ({
    browser,
  }) => {
    for (let run = 1; run <= 10; run++) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();
      const { errors, warnings } = attachConsoleCollectors(page);

      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3500);

      const heroState = await page.evaluate(() => {
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const h1 = document.querySelector("h1");
        const subtitle = document.querySelector("section p[data-hero-reveal]");
        const ctas = Array.from(
          document.querySelectorAll('section a[href="/vehicules"], section a[href*="wa.me"]')
        ).slice(0, 2);

        const inspect = (el: Element | null) => {
          if (!el) return null;
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return {
            opacity: parseFloat(style.opacity),
            visibility: style.visibility,
            inViewport:
              rect.width > 0 &&
              rect.height > 0 &&
              rect.top >= 0 &&
              rect.left >= 0 &&
              rect.bottom <= vh &&
              rect.right <= vw,
          };
        };

        return {
          h1: inspect(h1),
          subtitle: inspect(subtitle),
          ctas: ctas.map(inspect),
        };
      });

      expect(heroState.h1, `Run ${run}: H1 missing`).not.toBeNull();
      expect(heroState.h1!.opacity, `Run ${run}: H1 opacity`).toBe(1);
      expect(heroState.h1!.inViewport, `Run ${run}: H1 in viewport`).toBe(true);

      expect(heroState.subtitle, `Run ${run}: subtitle missing`).not.toBeNull();
      expect(heroState.subtitle!.opacity, `Run ${run}: subtitle opacity`).toBe(1);
      expect(heroState.subtitle!.inViewport, `Run ${run}: subtitle in viewport`).toBe(true);

      expect(heroState.ctas.length, `Run ${run}: two CTAs present`).toBe(2);
      for (const [idx, cta] of heroState.ctas.entries()) {
        expect(cta?.opacity, `Run ${run}: CTA #${idx + 1} opacity`).toBe(1);
        expect(cta?.inViewport, `Run ${run}: CTA #${idx + 1} in viewport`).toBe(true);
      }

      expect(errors, `Run ${run}: console errors`).toEqual([]);
      expect(warnings, `Run ${run}: console warnings`).toEqual([]);

      await context.close();
    }
  });

  test("(b) Navigate the 4 main pages and back: transition cover never remains visible", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const { errors, warnings } = attachConsoleCollectors(page);

    await page.addInitScript(() => {
      sessionStorage.setItem("w_preloader_seen", "1");
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const assertCoverHidden = async (stepLabel: string) => {
      await page.waitForFunction(
        () => {
          const cover = document.querySelector(".page-transition-cover");
          if (!cover) return true;
          const phase = cover.getAttribute("data-transition-phase");
          const style = getComputedStyle(cover);
          return phase === "idle" && style.pointerEvents === "none";
        },
        null,
        { timeout: 3000 }
      );

      const coverState = await page.evaluate(() => {
        const covers = Array.from(document.querySelectorAll(".page-transition-cover"));
        return covers.map((el) => {
          const style = getComputedStyle(el);
          return {
            phase: el.getAttribute("data-transition-phase"),
            pointerEvents: style.pointerEvents,
            clipPath: style.clipPath,
          };
        });
      });

      for (const c of coverState) {
        expect(c.phase, `${stepLabel}: cover phase`).toBe("idle");
        expect(c.pointerEvents, `${stepLabel}: cover pointer-events`).toBe("none");
        expect(
          c.clipPath.includes("100% 100%, 0% 100%") ||
            c.clipPath.includes("0% 0%, 100% 0%, 100% 0%, 0% 0%"),
          `${stepLabel}: cover clipPath collapsed (${c.clipPath})`
        ).toBe(true);
      }
    };

    for (const href of ["/vehicules", "/showroom", "/contact"]) {
      await page.locator(`header nav a[href="${href}"]`).click();
      await page.waitForURL(`**${href}**`, { timeout: 10000 });
      await assertCoverHidden(`Forward -> ${href}`);
    }

    for (const expectedPath of ["/showroom", "/vehicules", "/"]) {
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);
      expect(new URL(page.url()).pathname).toBe(expectedPath);
      await assertCoverHidden(`Back -> ${expectedPath}`);
    }

    expect(errors, "Navigation console errors").toEqual([]);
    expect(warnings, "Navigation console warnings").toEqual([]);

    await context.close();
  });

  test("(c) /vehicules: after 3s all 10 cards have opacity 1 and equal height per row", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const { errors, warnings } = attachConsoleCollectors(page);

    await page.addInitScript(() => {
      sessionStorage.setItem("w_preloader_seen", "1");
    });

    await page.goto(`${BASE_URL}/vehicules`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const cards = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".car-card")).map((card) => {
        const rect = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        return {
          opacity: parseFloat(style.opacity),
          top: Math.round(rect.top),
          height: Math.round(rect.height),
        };
      });
    });

    expect(cards.length).toBe(10);
    for (const [idx, c] of cards.entries()) {
      expect(c.opacity, `Card #${idx + 1} opacity`).toBe(1);
    }

    // Group cards by row (same top within 2px) and assert identical heights
    const rows = new Map<number, number[]>();
    for (const card of cards) {
      let matchedKey: number | null = null;
      for (const key of rows.keys()) {
        if (Math.abs(key - card.top) <= 2) {
          matchedKey = key;
          break;
        }
      }
      const key = matchedKey ?? card.top;
      const list = rows.get(key) ?? [];
      list.push(card.height);
      rows.set(key, list);
    }

    for (const [rowTop, heights] of rows.entries()) {
      const minH = Math.min(...heights);
      const maxH = Math.max(...heights);
      expect(maxH - minH, `Row at y=${rowTop} height spread (${heights.join(", ")})`).toBeLessThanOrEqual(2);
    }

    expect(errors, "/vehicules console errors").toEqual([]);
    expect(warnings, "/vehicules console warnings").toEqual([]);

    await context.close();
  });

  test("(d) No horizontal overflow at 360, 390, 768, 1024 and 1440 px across all routes", async ({
    browser,
  }) => {
    const routes = [
      "/",
      "/vehicules",
      "/vehicules/audi-a6-2025",
      "/showroom",
      "/contact",
      "/localisation",
    ];

    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const { errors, warnings } = attachConsoleCollectors(page);

      await page.addInitScript(() => {
        sessionStorage.setItem("w_preloader_seen", "1");
      });

      for (const route of routes) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(800);

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(
          overflow.scrollWidth,
          `Horizontal overflow on ${route} at ${width}px (${overflow.scrollWidth} > ${overflow.clientWidth})`
        ).toBeLessThanOrEqual(overflow.clientWidth);
      }

      expect(errors, `Console errors at ${width}px`).toEqual([]);
      expect(warnings, `Console warnings at ${width}px`).toEqual([]);

      await context.close();
    }
  });
});
