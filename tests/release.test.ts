import { describe, expect, it, vi } from "vitest";
import { downloadFromRelease, latestDownload, RELEASE_API_URL, RELEASE_CACHE_KEY, RELEASE_CACHE_TTL_MS, type GitHubRelease } from "../site/release";

const release: GitHubRelease = {
  tag_name: "v0.1.0",
  assets: [
    { name: "latest.json", browser_download_url: "https://github.com/example/latest.json" },
    { name: "linux-x64-Bridge.deb", browser_download_url: "https://github.com/example/Bridge.deb" },
    { name: "linux-x64-Bridge.AppImage", browser_download_url: "https://github.com/example/Bridge.AppImage" },
    { name: "windows-x64-Bridge-setup.exe", browser_download_url: "https://github.com/example/Bridge.exe" },
    { name: "windows-x64-Bridge.msi", browser_download_url: "https://github.com/example/Bridge.msi" }
  ]
};

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; }
  } satisfies Storage;
};

describe("release downloads", () => {
  it("selects the preferred installer from GitHub API assets", () => {
    expect(downloadFromRelease(release, "linux-x64")?.url).toMatch(/AppImage$/);
    expect(downloadFromRelease(release, "windows-x64")?.url).toMatch(/\.msi$/);
  });

  it("reads CORS-safe API metadata and caches it for one hour", async () => {
    const cache = storage();
    const fetcher = vi.fn(async () => new Response(JSON.stringify(release), { status: 200 }));
    expect((await latestDownload("linux-x64", { fetcher, storage: cache, now: 100 }))?.version).toBe("v0.1.0");
    expect(fetcher).toHaveBeenCalledWith(RELEASE_API_URL, expect.any(Object));
    expect(cache.getItem(RELEASE_CACHE_KEY)).toContain("v0.1.0");
    await latestDownload("linux-x64", { fetcher, storage: cache, now: 100 + RELEASE_CACHE_TTL_MS - 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses stale successful metadata when the API is offline", async () => {
    const cache = storage();
    cache.setItem(RELEASE_CACHE_KEY, JSON.stringify({ cachedAt: 0, release }));
    const fetcher = vi.fn(async () => { throw new TypeError("offline"); });
    expect((await latestDownload("windows-x64", { fetcher, storage: cache, now: RELEASE_CACHE_TTL_MS + 1 }))?.url).toMatch(/\.msi$/);
  });

  it("returns a calm empty result when no release exists", async () => {
    const fetcher = vi.fn(async () => new Response("not found", { status: 404 }));
    expect(await latestDownload("linux-x64", { fetcher, storage: storage() })).toBeNull();
  });
});
