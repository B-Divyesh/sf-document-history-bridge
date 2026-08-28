import "./site.css";

type Platform = "macos-arm64" | "macos-x64" | "windows-x64" | "linux-x64";
type Manifest = { version: string; platforms: Record<string, { url: string; sha256: string; label?: string }> };
const manifestUrl = "https://github.com/B-Divyesh/sf-document-history-bridge/releases/latest/download/latest.json";
const releaseUrl = "https://github.com/B-Divyesh/sf-document-history-bridge/releases/latest";

async function platform(): Promise<Platform> {
  const ua = navigator.userAgent.toLowerCase();
  const machine = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform?.toLowerCase() || navigator.platform.toLowerCase();
  if (ua.includes("win") || machine.includes("win")) return "windows-x64";
  if (ua.includes("mac") || machine.includes("mac") || /iphone|ipad/.test(ua)) {
    const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (keys: string[]) => Promise<{ architecture?: string }> } }).userAgentData;
    const architecture = await uaData?.getHighEntropyValues?.(["architecture"]).catch(() => ({}));
    return architecture?.architecture === "x86" ? "macos-x64" : "macos-arm64";
  }
  return "linux-x64";
}

const labels: Record<Platform, string> = {
  "macos-arm64": "Download for Apple silicon Mac",
  "macos-x64": "Download for Intel Mac",
  "windows-x64": "Download for Windows",
  "linux-x64": "Download for Linux"
};

async function resolveDownload(): Promise<void> {
  const detected = await platform();
  const links = [document.querySelector<HTMLAnchorElement>("#primary-download"), document.querySelector<HTMLAnchorElement>("#secondary-download")].filter(Boolean) as HTMLAnchorElement[];
  links.forEach((link) => { link.href = releaseUrl; link.querySelector("span")!.textContent = labels[detected]; link.querySelector("small")!.textContent = "Opening release downloads…"; });
  try {
    const response = await fetch(manifestUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error("release manifest unavailable");
    const manifest = await response.json() as Manifest;
    const asset = manifest.platforms[detected];
    if (!asset?.url) throw new Error("installer unavailable");
    links.forEach((link) => { link.href = asset.url; link.querySelector("small")!.textContent = `${manifest.version} · Installer · SHA-256 published`; });
  } catch {
    links.forEach((link) => { link.querySelector("small")!.textContent = "Choose an installer on GitHub Releases"; });
    const note = document.querySelector("#download-note"); if (note) note.textContent = "Release downloads are temporarily unavailable here · browse every platform";
  }
  if (/iphone|ipad|android/i.test(navigator.userAgent)) {
    const note = document.querySelector("#download-note"); if (note) note.textContent = "Desktop app · open this page on macOS, Windows, or Linux to install";
  }
}

resolveDownload();
