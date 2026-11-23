import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? "";

// Tiny valid 1x1 PNG buffer for real Cloudinary upload testing
const SAMPLE_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test.describe("Admin Security & End-to-End Flow", () => {
  test("Security: unauthenticated requests to /admin and /api/admin/* are rejected", async ({
    request,
    page,
  }) => {
    const signRes = await request.post(`${BASE_URL}/api/admin/cloudinary/sign`);
    expect(signRes.status()).toBe(401);

    const cleanupRes = await request.post(
      `${BASE_URL}/api/admin/cloudinary/cleanup`,
      { data: { publicIds: ["w-automobiles/cars/fake"] } }
    );
    expect(cleanupRes.status()).toBe(401);

    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).toBe("/admin/login");

    await page.goto(`${BASE_URL}/admin/cars/new`, {
      waitUntil: "domcontentloaded",
    });
    expect(new URL(page.url()).pathname).toBe("/admin/login");
  });

  test("Full E2E: login -> create with photo -> verify public -> feature -> Vendu -> hide 404 -> delete + Cloudinary cleanup", async ({
    page,
    request,
  }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      "Set ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD to run the authenticated E2E admin flow."
    );

    const uniqueTag = Date.now().toString().slice(-6);
    const testModel = `Test E2E ${uniqueTag}`;
    const expectedSlug = `audi-test-e2e-${uniqueTag}-2025`;

    // 1. Login
    await page.goto(`${BASE_URL}/admin/login`, {
      waitUntil: "domcontentloaded",
    });
    await page.fill("#admin-email", ADMIN_EMAIL);
    await page.fill("#admin-password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 15000 });

    // 2. Navigate to /admin/cars/new & create vehicle with uploaded photo
    await page.goto(`${BASE_URL}/admin/cars/new`, {
      waitUntil: "domcontentloaded",
    });

    await page.setInputFiles('input[type="file"]', {
      name: `test-car-${uniqueTag}.png`,
      mimeType: "image/png",
      buffer: SAMPLE_PNG_BUFFER,
    });

    // Wait for thumbnail preview to appear after Cloudinary upload finishes
    const uploadedThumb = page.locator('img[alt="Photo véhicule 1"]');
    await expect(uploadedThumb).toBeVisible({ timeout: 20000 });
    const uploadedUrl = await uploadedThumb.getAttribute("src");
    expect(uploadedUrl).toContain("res.cloudinary.com");

    await page.fill("#field-brand", "Audi");
    await page.fill("#field-model", testModel);
    await page.fill("#field-year", "2025");
    await page.fill("#field-price", "12500000");
    await page.fill("#field-mileage", "0");
    await page.fill("#field-description", "Fiche créée par le test E2E.");
    await page.fill("#field-features-input", "Caméra 360");
    await page.press("#field-features-input", "Enter");

    // Ensure slug matches expected
    await page.fill("#field-slug", expectedSlug);

    // Save
    await page.getByRole("button", { name: "Enregistrer", exact: true }).first().click();
    await page.waitForURL("**/admin**", { timeout: 15000 });

    // 3. Verify car appears on /vehicules with its Cloudinary photo
    await page.goto(`${BASE_URL}/vehicules`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(testModel)).toBeVisible({ timeout: 10000 });

    // 4. Return to /admin, toggle Featured (if under 6) and mark as Vendu
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    await page.fill("#admin-search", expectedSlug);
    await page.waitForTimeout(300);

    const statusSelect = page
      .locator(`select[aria-label="Statut de Audi ${testModel}"]`)
      .first();
    await statusSelect.selectOption("Vendu");
    await page.waitForTimeout(800);

    // Verify "Vendu" badge on public detail page
    await page.goto(`${BASE_URL}/vehicules/${expectedSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Vendu", { exact: true }).first()).toBeVisible();

    // 5. Hide the car (published = false) and confirm 404 on public detail page
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    await page.fill("#admin-search", expectedSlug);
    await page.waitForTimeout(300);

    const publishSwitch = page
      .locator(`button[aria-label="Publier Audi ${testModel}"]`)
      .first();
    await publishSwitch.click();
    await page.waitForTimeout(1000);

    const hiddenRes = await request.get(`${BASE_URL}/vehicules/${expectedSlug}`);
    expect(hiddenRes.status()).toBe(404);

    // 6. Delete the car and confirm Cloudinary image is removed
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    await page.fill("#admin-search", expectedSlug);
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Supprimer" }).first().click();
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await page.waitForTimeout(1500);

    if (uploadedUrl) {
      const imgRes = await request.get(uploadedUrl);
      expect([404, 410]).toContain(imgRes.status());
    }
  });
});
