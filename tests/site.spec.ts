import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing page has one clear route to the installer", async ({ page }) => {
  await page.route("**/latest/download/latest.json", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: "0.1.0", platforms: { "linux-x64": { url: "https://example.test/app.AppImage", sha256: "abc" }, "macos-x64": { url: "https://example.test/app.dmg", sha256: "abc" }, "macos-arm64": { url: "https://example.test/app-arm.dmg", sha256: "abc" }, "windows-x64": { url: "https://example.test/app.msi", sha256: "abc" } } }) }));
  await page.goto("/");
  await expect(page).toHaveTitle(/Document History Bridge/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("#primary-download")).toHaveAttribute("href", /example\.test/);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact || ""))).toEqual([]);
});

test("legal pages and mobile layout remain usable", async ({ page }, testInfo) => {
  await page.goto("/privacy/");
  await expect(page.locator("h1")).toHaveCount(1);
  await page.goto("/terms/");
  await expect(page.locator("h1")).toContainText("Terms");
  if (testInfo.project.name === "mobile") {
    await page.goto("/");
    await expect(page.locator("#primary-download")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
