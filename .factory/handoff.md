# Document History Bridge — v0.1.0 handoff

## What shipped

- Tauri 2 desktop app with a Vite/TypeScript interface and Rust local archive core.
- Recursive watched-folder capture every four seconds while the app runs; originals are read-only except after an explicit restore confirmation.
- Deduplicated SHA-256 object store plus a human-readable manifest in the OS application-data directory.
- Local text/table extraction for DOCX and ODT, text-layer extraction for PDF, plus RTF/Markdown/plain text support.
- Chronological file history, word-level added/removed proof marks, exact-file restore, pre-restore safety capture, and rollback if replacement fails.
- Explicit preview warnings for encrypted, image-only, malformed, and unsupported documents; their bytes are still archived when the extension is supported.
- Free tier of one watched folder and 30 indexed versions per file. $29 one-time Archive license unlocks unlimited folders and versions through the Sociobot billing API, with cached daily verification and paste-to-restore.
- Responsive, OS-detecting static product site in `dist/site`, privacy and terms pages, checksum-verifying shell/PowerShell installers, and original generated artwork.
- GitHub Actions matrix for macOS arm64/x64, Windows x64, and Linux x64; it publishes installer bundles, `SHA256SUMS`, and `latest.json` to a tagged release.

## Run and verify

```sh
npm ci
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

`npm run build` writes the desktop webview to `dist/app` and the deployable site to `dist/site` (with `dist/site/index.html` at the root).

Verification on 2026-08-28:

- `npm test`: passed — 3 Vitest checks and 4 Playwright checks across desktop Chromium and a 390px-class mobile viewport.
- Playwright axe scan: 0 serious or critical findings.
- `cargo test`: passed — 2 Rust format/extraction checks.
- `cargo fmt --check`: passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Production sizes: site JS 2.55 KB / CSS 8.59 KB; app JS 12.89 KB / CSS 9.23 KB; mobile hero WebP 40.9 KB; desktop hero WebP 160.4 KB. All figures are uncompressed except where Vite also reports gzip.
- Lighthouse mobile: Performance 100, Accessibility 100, Best Practices 96, SEO 92; LCP 1.4 s, CLS 0, Total Blocking Time 0 ms. Run against the local Vite production preview in headless Chromium.
- Visual inspection: desktop full-page and responsive mobile behavior reviewed; no horizontal overflow at 390px.

## Release

- Source tag: `v0.1.0`.
- Workflow: `.github/workflows/release.yml`.
- Release URL: `https://github.com/B-Divyesh/sf-document-history-bridge/releases/tag/v0.1.0`.
- Release manifest: `https://github.com/B-Divyesh/sf-document-history-bridge/releases/latest/download/latest.json`.
- Published assets: Apple silicon DMG, Intel Mac DMG, Windows MSI and setup EXE, Linux AppImage and DEB, plus `SHA256SUMS` and `latest.json`.
- Public verification: downloaded the 77,863,416-byte Linux AppImage through the URL in `latest.json`; its SHA-256 was `399bc7a2c3cb0fb82924e12fc3e983b98121be839488d9c927a1a23a2ba3a2f2`, exactly matching both the manifest and `SHA256SUMS`.
- Installer verification: ran `public/install.sh` with an isolated temporary home; it fetched the public manifest, verified that hash, installed the executable under `.local/bin`, and reported the destination.

## Known gaps

- v1 intentionally has no OCR, spreadsheet-native diffing, real-time coauthoring, cloud sync, or background capture while the app is closed.
- PDF comparison depends on an embedded text layer. Scans remain exactly recoverable but show a preview warning.
- File-system permissions are preserved during restore where the OS allows it; creation/modified timestamps naturally reflect the explicit restore operation. Embedded document metadata is preserved because snapshot bytes are never converted for restoration.
- The local manifest is durable and recoverable through rollback-safe writes, but v1 has no in-app archive relocation or external backup scheduler.
- Lighthouse SEO is 92 because the local preview has no production crawl metadata/robots response; performance and accessibility budgets are met.

## Needs operator action

- Register the production paid product for slug `document-history-bridge` in the Sociobot billing engine and confirm its return URL. No product ID is hardcoded.
- Deploy `dist/site` at `https://document-history-bridge.sociobot.in` after the release is public so platform buttons resolve to real assets.
- Add `APPLE_CERTIFICATE`, certificate password/team/notarization credentials, and `WINDOWS_CERT_PFX` plus its password to GitHub Actions when signing is available. The v0.1.0 workflow intentionally produces unsigned artifacts; users are warned on the site and in README.
- Consider scheduled end-to-end restore fixtures with real-world DOCX/ODT/PDF corpora for regression coverage.
