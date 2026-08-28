import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product claims", () => {
  it("@claim:app-privacy limits app networking to optional license checks", () => {
    const source = readFileSync("src/license.ts", "utf8");
    const tauri = readFileSync("src-tauri/tauri.conf.json", "utf8");
    const packages = readFileSync("package.json", "utf8");
    expect(source.match(/https:\/\/[^`\"]+/g)).toEqual([
      "https://api.sociobot.in/api/v1/products/${slug}/checkout",
      "https://api.sociobot.in/api/v1/products/${slug}/verify?license=${encodeURIComponent(token)}"
    ]);
    expect(source).toContain("https://api.sociobot.in/api/v1/products/${slug}/verify");
    expect(tauri).toContain("connect-src 'self' https://api.sociobot.in");
    expect(packages).not.toMatch(/analytics|segment|sentry|telemetry/i);
  });

  it("@claim:installer-checksum makes both one-line installers verify SHA-256", () => {
    const shell = readFileSync("public/install.sh", "utf8");
    const powershell = readFileSync("public/install.ps1", "utf8");
    expect(shell).toContain("sha256sum");
    expect(shell).toContain('[ "$ACTUAL" = "$EXPECTED" ]');
    expect(powershell).toContain("Get-FileHash -Algorithm SHA256");
    expect(powershell).toContain("Checksum verification failed. Nothing was installed.");
  });

  it("@claim:release-matrix builds each desktop platform and publishes release metadata", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    for (const platform of ["macos-arm64", "macos-x64", "windows-x64", "linux-x64", "SHA256SUMS", "latest.json"]) {
      expect(workflow).toContain(platform);
    }
    expect(workflow).toContain("tauri-apps/tauri-action");
    expect(workflow).toContain("softprops/action-gh-release");
  });
});
