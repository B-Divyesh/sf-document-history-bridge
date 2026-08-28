import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { basename, join } from "node:path";

const root = process.argv[2] || "release-assets";
const repository = process.env.GITHUB_REPOSITORY || "B-Divyesh/sf-document-history-bridge";
const version = (process.env.RELEASE_VERSION || process.env.GITHUB_REF_NAME || "v0.1.0").replace(/^v/, "");

async function filesAt(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesAt(join(path, entry.name)) : [join(path, entry.name)]));
  return nested.flat();
}

const sourceFiles = (await filesAt(root)).filter((file) => !/SHA256SUMS|latest\.json/.test(file));
const flattened = [];
for (const source of sourceFiles) {
  const target = join(root, basename(source));
  if (source !== target) await copyFile(source, target);
  flattened.push(target);
}
const unique = [...new Set(flattened)];
const rows = [];
for (const file of unique) {
  const bytes = await readFile(file);
  rows.push({ name: basename(file), sha256: createHash("sha256").update(bytes).digest("hex") });
}
rows.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(join(root, "SHA256SUMS"), rows.map((row) => `${row.sha256}  ${row.name}`).join("\n") + "\n");

const pick = (prefix, endings) => rows.find((row) => row.name.startsWith(prefix) && endings.some((end) => row.name.toLowerCase().endsWith(end)));
const selected = {
  "macos-arm64": pick("macos-arm64-", [".dmg"]),
  "macos-x64": pick("macos-x64-", [".dmg"]),
  "windows-x64": pick("windows-x64-", [".msi", ".exe"]),
  "linux-x64": pick("linux-x64-", [".appimage"])
};
for (const [platform, asset] of Object.entries(selected)) if (!asset) throw new Error(`No preferred installer found for ${platform}`);
const platforms = Object.fromEntries(Object.entries(selected).map(([platform, asset]) => [platform, {
  url: `https://github.com/${repository}/releases/latest/download/${encodeURIComponent(asset.name)}`,
  sha256: asset.sha256,
  label: asset.name
}]));
await writeFile(join(root, "latest.json"), JSON.stringify({ version, platforms }, null, 2) + "\n");
