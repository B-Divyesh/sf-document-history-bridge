const slug = "document-history-bridge";
const key = `sb_license:${slug}`;
const verdictKey = `${key}:verdict`;
export const checkoutUrl = `https://api.sociobot.in/api/v1/products/${slug}/checkout`;

type Verdict = { valid: boolean; checkedAt: number };

export function acceptLicenseFromUrl(): void {
  const url = new URL(location.href);
  const license = url.searchParams.get("license");
  if (!license) return;
  localStorage.setItem(key, license);
  url.searchParams.delete("license");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function saveLicense(token: string): void {
  localStorage.setItem(key, token.trim());
  localStorage.removeItem(verdictKey);
}

export function hasArchiveLicense(): boolean {
  const token = localStorage.getItem(key);
  if (!token) return false;
  try {
    const verdict = JSON.parse(localStorage.getItem(verdictKey) || "null") as Verdict | null;
    return !verdict || verdict.valid;
  } catch { return true; }
}

export async function verifyLicense(): Promise<boolean> {
  const token = localStorage.getItem(key);
  if (!token) return false;
  let cached: Verdict | null = null;
  try { cached = JSON.parse(localStorage.getItem(verdictKey) || "null"); } catch { /* recheck */ }
  if (cached && Date.now() - cached.checkedAt < 86_400_000) return cached.valid;
  try {
    const response = await fetch(`https://api.sociobot.in/api/v1/products/${slug}/verify?license=${encodeURIComponent(token)}`);
    const data = await response.json() as { valid: boolean };
    localStorage.setItem(verdictKey, JSON.stringify({ valid: data.valid, checkedAt: Date.now() } satisfies Verdict));
    return data.valid;
  } catch {
    return hasArchiveLicense();
  }
}
