import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const apiPattern = "**/repos/B-Divyesh/sf-document-history-bridge/releases/latest";
const oldManifestPattern = "**/releases/latest/download/latest.json";
const release = {
  tag_name: "v0.1.0",
  html_url: "https://github.com/B-Divyesh/sf-document-history-bridge/releases/tag/v0.1.0",
  assets: [
    { name: "linux-x64-Document.History.Bridge.AppImage", browser_download_url: "https://github.com/B-Divyesh/sf-document-history-bridge/releases/download/v0.1.0/linux.AppImage" },
    { name: "macos-arm64-Document.History.Bridge.dmg", browser_download_url: "https://github.com/B-Divyesh/sf-document-history-bridge/releases/download/v0.1.0/arm64.dmg" },
    { name: "macos-x64-Document.History.Bridge.dmg", browser_download_url: "https://github.com/B-Divyesh/sf-document-history-bridge/releases/download/v0.1.0/x64.dmg" },
    { name: "windows-x64-Document.History.Bridge.msi", browser_download_url: "https://github.com/B-Divyesh/sf-document-history-bridge/releases/download/v0.1.0/windows.msi" }
  ]
};

function captureErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("@claim:platform-download reads the GitHub API and links the detected installer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop platform assertion");
  const errors = captureErrors(page);
  let apiRequests = 0;
  let oldManifestRequests = 0;
  await page.route(apiPattern, async (route) => { apiRequests += 1; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(release) }); });
  await page.route(oldManifestPattern, async (route) => { oldManifestRequests += 1; await route.abort(); });
  await page.goto("/");
  await expect(page.locator("#primary-download")).toHaveAttribute("href", /github\.com\/B-Divyesh\/.*\/windows\.msi$/);
  await expect(page.locator("#primary-download small")).toContainText("v0.1.0");
  expect(apiRequests).toBe(1);
  expect(oldManifestRequests).toBe(0);
  expect(errors).toEqual([]);
});

test("@claim:release-cache successful metadata is reused for an hour when the network is unavailable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop cache assertion");
  const errors = captureErrors(page);
  let apiRequests = 0;
  await page.route(apiPattern, async (route) => {
    apiRequests += 1;
    if (apiRequests === 1) await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(release) });
    else await route.abort("internetdisconnected");
  });
  await page.goto("/");
  await expect(page.locator("#primary-download")).toHaveAttribute("href", /windows\.msi$/);
  await page.reload();
  await expect(page.locator("#primary-download")).toHaveAttribute("href", /windows\.msi$/);
  expect(apiRequests).toBe(1);
  expect(errors).toEqual([]);
});

test("missing installer metadata shows a calm publishing state with a clean console", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop fallback assertion");
  const errors = captureErrors(page);
  await page.route(apiPattern, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tag_name: "v0.1.0", assets: [] }) }));
  await page.goto("/");
  await expect(page.locator("#primary-download")).toHaveAttribute("href", "https://github.com/B-Divyesh/sf-document-history-bridge/releases/latest");
  await expect(page.locator("#primary-download small")).toContainText("Downloads are being published");
  await expect(page.locator("#download-note")).toContainText("Releases page");
  expect(errors).toEqual([]);
});

test("a missing GitHub release is caught and renders the publishing state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop fallback assertion");
  const uncaught: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));
  await page.route(apiPattern, async (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not Found" }) }));
  await page.goto("/");
  await expect(page.locator("#primary-download small")).toContainText("Downloads are being published");
  expect(uncaught).toEqual([]);
});

test("@claim:sample-comparison compares added and removed sample words", async ({ page }) => {
  await page.goto("/demo/");
  await page.getByRole("option", { name: /Records-policy/ }).click();
  await expect(page.locator("#demo-sheet del")).toContainText("five");
  await expect(page.locator("#demo-sheet ins")).toContainText("seven");
});

test("@claim:demo-private keeps the sample flow on the product origin", async ({ page }) => {
  const offOrigin: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4173") offOrigin.push(request.url());
  });
  await page.goto("/demo/");
  await page.getByRole("option", { name: /Meeting-notes/ }).click();
  await page.getByRole("button", { name: "Restore this sample version" }).click();
  expect(offOrigin).toEqual([]);
  expect(await page.evaluate(() => [...Object.keys(localStorage)].every((key) => key.startsWith("demo:")))).toBe(true);
});

test("@claim:safe-restore explains the sample restore outcome", async ({ page }) => {
  await page.goto("/demo/");
  await page.getByRole("button", { name: "Restore this sample version" }).click();
  await expect(page.getByRole("status")).toHaveText("Sample restored. No file on your computer was changed.");
});

test("@claim:free-limits states and displays the free edition limits", async ({ page }) => {
  await page.route(apiPattern, async (route) => route.fulfill({ status: 404, body: "{}" }));
  await page.goto("/");
  await expect(page.locator(".price-free")).toContainText("one folder");
  await expect(page.locator(".price-free")).toContainText("30 snapshots per file");
  await expect(page.locator(".price-paid")).toContainText("$29 once");
  await expect(page.locator(".price-paid")).toContainText("unlimited folders");
});

test("demo supports arrow keys, reset, and start-for-real cleanup", async ({ page }) => {
  await page.goto("/demo/");
  const first = page.getByRole("option", { name: /Proposal/ });
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: /Records-policy/ })).toBeFocused();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(first).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Start for real" }).click();
  await expect(page).toHaveURL(/\/#download$/);
  expect(await page.evaluate(() => localStorage.getItem("demo:document-history-bridge:selection"))).toBeNull();
});

test("all routes have semantic structure and no serious accessibility findings", async ({ page }) => {
  await page.route(apiPattern, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(release) }));
  for (const path of ["/", "/demo/", "/privacy/", "/terms/", "/404/"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    const results = await new AxeBuilder({ page: page as never }).analyze();
    expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact || "")), path).toEqual([]);
  }
});

test("landing remains usable at a 390px mobile viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile project only");
  await page.route(apiPattern, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(release) }));
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Try it with sample data/ })).toBeInViewport();
  await expect(page.locator("#primary-download")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
