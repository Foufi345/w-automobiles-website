import path from "path";
import { test, expect, devices } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD;
const SAMPLE_PHOTO = path.join(
  process.cwd(),
  "public",
  "images",
  "showroom-hero.jpg"
);

const MOBILE_PROFILES = [
  { name: "iPhone 13", device: devices["iPhone 13"] },
  { name: "Pixel 7", device: devices["Pixel 7"] },
];

for (const profile of MOBILE_PROFILES) {
  test.describe(`Admin mobile E2E (${profile.name})`, () => {
    test.use({
      viewport: profile.device.viewport,
      userAgent: profile.device.userAgent,
      isMobile: true,
      hasTouch: true,
    });

    test("login page has zero horizontal overflow and >=16px inputs", async ({
      page,
    }) => {
      await page.goto("/admin/login");
      await expect(
        page.getByRole("heading", { name: /w automobiles/i })
      ).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);

      const fontSizes = await page.evaluate(() =>
        Array.from(document.querySelectorAll("input")).map((el) =>
          parseFloat(getComputedStyle(el).fontSize)
        )
      );
      for (const size of fontSizes) {
        expect(size).toBeGreaterThanOrEqual(16);
      }
    });

    test("full mobile flow: login -> add car with 3 photos -> feature -> Vendu -> delete", async ({
      page,
    }) => {
      test.skip(
        !ADMIN_EMAIL || !ADMIN_PASSWORD,
        "Set ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD to run authenticated mobile admin E2E."
      );

      const uniqueSuffix = `${profile.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
      const testModel = `MobileQA ${uniqueSuffix}`;

      // 1. Login
      await page.goto("/admin/login");
      await page.getByLabel(/email/i).fill(ADMIN_EMAIL!);
      await page.getByLabel(/mot de passe/i).fill(ADMIN_PASSWORD!);
      await page.getByRole("button", { name: /se connecter/i }).click();
      await page.waitForURL("**/admin");

      // Check zero horizontal overflow on /admin list
      const listOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(listOverflow).toBeLessThanOrEqual(0);

      // 2. Tap floating "+ Ajouter" button
      await page.getByRole("link", { name: /\+?\s*ajouter/i }).first().click();
      await page.waitForURL("**/admin/cars/new");

      // 3. Upload 3 photos
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([SAMPLE_PHOTO, SAMPLE_PHOTO, SAMPLE_PHOTO]);
      await expect(page.getByText(/photos 3/i)).toBeVisible({ timeout: 30_000 });

      // 4. Fill required car fields
      await page.getByLabel(/marque/i).fill("Audi");
      await page.getByLabel(/modèle/i).fill(testModel);
      await page.getByLabel(/prix \(dzd\)/i).fill("12500000");

      // Add an equipment tag via comma
      const featInput = page.getByLabel(/équipements/i);
      await featInput.fill("Caméra 360°,");
      await expect(page.getByText("Caméra 360°")).toBeVisible();

      // Save from mobile sticky bottom bar
      await page
        .getByRole("button", { name: /^enregistrer$/i })
        .last()
        .click();
      await page.waitForURL("**/admin*");

      // 5. Locate the newly created mobile card
      const card = page.locator("article", { hasText: testModel }).first();
      await expect(card).toBeVisible();

      // 6. Toggle "En vedette" and verify Undo toast
      await card
        .getByRole("switch", { name: /en vedette/i })
        .click();
      await expect(page.getByRole("button", { name: /annuler/i })).toBeVisible();

      // 7. Mark status as "Vendu"
      await card.getByLabel(/statut/i).selectOption("Vendu");
      await expect(page.getByText(/statut mis à jour : vendu/i)).toBeVisible();

      // 8. Delete via bottom-sheet confirmation
      await card.getByRole("button", { name: /supprimer/i }).click();
      await page
        .getByRole("button", { name: /supprimer définitivement/i })
        .click();
      await expect(card).toHaveCount(0);
    });
  });
}
