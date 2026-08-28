export type Platform = "macos-arm64" | "macos-x64" | "windows-x64" | "linux-x64";

export type GitHubAsset = {
  name?: unknown;
  browser_download_url?: unknown;
};

export type GitHubRelease = {
  tag_name?: unknown;
  html_url?: unknown;
  assets?: unknown;
};

export type ReleaseDownload = {
  version: string;
  url: string;
};

type CacheEntry = {
  cachedAt: number;
  release: GitHubRelease;
};

export const RELEASE_API_URL = "https://api.github.com/repos/B-Divyesh/sf-document-history-bridge/releases/latest";
export const RELEASE_PAGE_URL = "https://github.com/B-Divyesh/sf-document-history-bridge/releases/latest";
export const RELEASE_CACHE_KEY = "document-history-bridge:release:v1";
export const RELEASE_CACHE_TTL_MS = 60 * 60 * 1000;

const preferredAsset = (platform: Platform, name: string): boolean => {
  if (!name.startsWith(`${platform}-`)) return false;
  if (platform.startsWith("macos")) return name.toLowerCase().endsWith(".dmg");
  if (platform === "windows-x64") return name.toLowerCase().endsWith(".msi");
  return name.endsWith(".AppImage");
};

const fallbackAsset = (platform: Platform, name: string): boolean => {
  if (!name.startsWith(`${platform}-`)) return false;
  if (platform === "windows-x64") return name.toLowerCase().endsWith(".exe");
  if (platform === "linux-x64") return name.toLowerCase().endsWith(".deb");
  return false;
};

export function downloadFromRelease(release: GitHubRelease, platform: Platform): ReleaseDownload | null {
  if (typeof release.tag_name !== "string" || !Array.isArray(release.assets)) return null;
  const assets = release.assets.filter((asset): asset is GitHubAsset => !!asset && typeof asset === "object");
  const asset = assets.find((item) => typeof item.name === "string" && preferredAsset(platform, item.name))
    ?? assets.find((item) => typeof item.name === "string" && fallbackAsset(platform, item.name));
  if (!asset || typeof asset.browser_download_url !== "string") return null;
  try {
    const url = new URL(asset.browser_download_url);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    return { version: release.tag_name, url: url.href };
  } catch {
    return null;
  }
}

function readCache(storage: Storage, now: number, allowStale = false): GitHubRelease | null {
  try {
    const value = JSON.parse(storage.getItem(RELEASE_CACHE_KEY) || "null") as CacheEntry | null;
    if (!value || typeof value.cachedAt !== "number" || !value.release) return null;
    if (!allowStale && now - value.cachedAt >= RELEASE_CACHE_TTL_MS) return null;
    return value.release;
  } catch {
    return null;
  }
}

function writeCache(storage: Storage, release: GitHubRelease, now: number): void {
  try {
    storage.setItem(RELEASE_CACHE_KEY, JSON.stringify({ cachedAt: now, release } satisfies CacheEntry));
  } catch {
    // Downloads still work when storage is unavailable or full.
  }
}

export async function latestDownload(
  platform: Platform,
  options: { fetcher?: typeof fetch; storage?: Storage; now?: number } = {}
): Promise<ReleaseDownload | null> {
  const fetcher = options.fetcher ?? fetch;
  const storage = options.storage ?? localStorage;
  const now = options.now ?? Date.now();
  const fresh = readCache(storage, now);
  const freshDownload = fresh && downloadFromRelease(fresh, platform);
  if (freshDownload) return freshDownload;

  try {
    const response = await fetcher(RELEASE_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error("release metadata unavailable");
    const release = await response.json() as GitHubRelease;
    const download = downloadFromRelease(release, platform);
    if (!download) throw new Error("installer metadata unavailable");
    writeCache(storage, release, now);
    return download;
  } catch {
    const stale = readCache(storage, now, true);
    return stale ? downloadFromRelease(stale, platform) : null;
  }
}
