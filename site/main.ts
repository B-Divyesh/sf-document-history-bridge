import "./site.css";
import { latestDownload, RELEASE_PAGE_URL, type Platform } from "./release";

async function platform(): Promise<Platform> {
  const ua = navigator.userAgent.toLowerCase();
  const machine = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform?.toLowerCase() || navigator.platform.toLowerCase();
  if (ua.includes("win") || machine.includes("win")) return "windows-x64";
  if (ua.includes("mac") || machine.includes("mac") || /iphone|ipad/.test(ua)) {
    const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (keys: string[]) => Promise<{ architecture?: string }> } }).userAgentData;
    const architecture = await uaData?.getHighEntropyValues?.(["architecture"]).catch(() => ({ architecture: undefined }));
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
  links.forEach((link) => {
    link.href = RELEASE_PAGE_URL;
    link.querySelector("span")?.replaceChildren(labels[detected]);
    link.querySelector("small")?.replaceChildren("Checking published downloads…");
  });
  const download = await latestDownload(detected);
  if (download) {
    links.forEach((link) => {
      link.href = download.url;
      link.querySelector("small")?.replaceChildren(`${download.version} · Installer`);
    });
  } else {
    links.forEach((link) => link.querySelector("small")?.replaceChildren("Downloads are being published · View Releases"));
    document.querySelector("#download-note")?.replaceChildren("Downloads are being published. The Releases page will show each installer when it is ready.");
  }
  if (/iphone|ipad|android/i.test(navigator.userAgent)) {
    document.querySelector("#download-note")?.replaceChildren("This is a desktop app. Open this page on macOS, Windows, or Linux to install it.");
  }
}

void resolveDownload().catch(() => {
  document.querySelector("#download-note")?.replaceChildren("Downloads are being published. Open GitHub Releases to check again.");
});
