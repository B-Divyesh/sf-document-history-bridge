# Document History Bridge — verification handoff

## Independent verification result — FAIL (2026-08-28)

Candidate `5fac03e79ed952770fd082ffe59d750c913821e8` at `https://document-history-bridge.sociobot.in` **FAILS acceptance**. The complete independent evidence is in `.factory/verification.md`.

Findings:

1. **P1: unsupported files are silently skipped.** The native scan discards an unsupported extension without persisting or surfacing it, then the UI says existing documents were captured. This violates the brief’s requirement to clearly flag unsupported encrypted/proprietary formats and can leave a user believing an important file is recoverable when it is not.
2. **P2: static assets cache for only 30 seconds.** The live deployment does not use immutable caching for fingerprinted assets.

All listed claims, builds, unit/browser/native tests, accessibility checks, demo exercise, live privacy/request checks, release checksum, and rate-limit checks otherwise passed. The earlier production GitHub-release CORS failure is fixed and was not reproduced.

Do not release until the P1 warning/recovery path is implemented and verified with an observable claim test. See `.factory/verification.md` for exact commands and evidence.

---

# Prior builder repair handoff (superseded by independent verification)

## Repair outcome

- Reproduced the failed candidate at commit `d517fff`: Chromium requested `https://github.com/B-Divyesh/sf-document-history-bridge/releases/latest/download/latest.json`, which was blocked by CORS and wrote two console errors. The captured report is `.factory/evidence/pre-repair/verify.json`.
- The landing page now reads `https://api.github.com/repos/B-Divyesh/sf-document-history-bridge/releases/latest`, validates GitHub asset URLs, and uses those URLs only as navigation links.
- Successful release metadata is cached in local storage for exactly one hour. An expired cache is used only as a fallback when GitHub is unavailable.
- Missing or unusable metadata leaves both download actions pointed at GitHub Releases and shows “Downloads are being published.” All promise failures are caught.
- Focused unit and Chromium coverage asserts API selection, preferred platform assets, the one-hour boundary, stale-cache fallback, zero legacy-manifest requests, a clean empty-metadata console, and caught 404 behavior.
- The original Tauri 2 desktop artifact, release matrix, local-first archive, one-click sample demo, site structure, visual identity, pricing, and claim inventory remain in place.

## Product delivered

- Tauri 2 desktop app with a Vite/TypeScript interface and Rust archive core.
- Recursive watched-folder capture, content-addressed local snapshots, DOCX/ODT/PDF/RTF/Markdown/text extraction, word-level comparison, exact restore, and a pre-restore safety snapshot.
- Free edition for one folder and 30 snapshots per file. The $29 one-time Archive license removes those limits through the Sociobot billing API.
- Responsive static site in `dist/site`, isolated `/demo/`, privacy, terms, a designed 404 page, checksum-verifying shell/PowerShell installers, and original generated artwork.
- GitHub Actions release matrix for macOS arm64/x64, Windows x64, and Linux x64, including DMG, MSI/EXE, AppImage/DEB, `SHA256SUMS`, and `latest.json`.

## Exact verification evidence

Clean install and build command from the builder handoff:

```sh
npm ci && npm run build
```

Passed on 2026-08-28. It produced `dist/app/index.html` and `dist/site/index.html`.

Additional commands:

```sh
npm test
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
npm audit --omit=dev
VERIFY_NODE_MODULES=/work/repo/node_modules /opt/fleet/lib/verify-url.sh http://127.0.0.1:4173 .factory/evidence/local-root
VERIFY_NODE_MODULES=/work/repo/node_modules /opt/fleet/lib/verify-url.sh http://127.0.0.1:4173/demo/ .factory/evidence/local-demo
```

Results:

- Vitest: 10/10 passed.
- Playwright 1.58.2: 17 passed and 5 intentional project skips across desktop Chromium and iPhone 13 emulation.
- Browser coverage includes release API/cache/fallback, console and page errors, demo privacy, sample comparison/restore, keyboard arrow navigation, mobile overflow, route semantics, and axe scans.
- Axe integration: zero serious or critical findings on `/`, `/demo/`, `/privacy/`, `/terms/`, and `/404/` in both browser projects.
- Rust: 3/3 passed, including byte-exact restore with a safety snapshot and the advertised format allowlist.
- Rust formatting passed. Production dependency audit found zero vulnerabilities.
- Local `verify-url.sh`: root and demo returned 200 with zero console/page errors, one `<h1>`, one main landmark, `lang="en"`, titles, and no missing image alt text or unlabeled buttons.
- Local Lighthouse 12.8.2 mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.4 s, CLS 0, Total Blocking Time 0 ms.
- Production site bundles: landing JS 3.35 KB (1.42 KB gzip), demo JS 4.02 KB (1.68 KB gzip), landing CSS 11.04 KB (2.96 KB gzip), and mobile hero 40.94 KB.

All tests referenced by `.factory/claims.json` are included in those runs. The cache test exercises the network-unavailable path; the product makes no claim that the full site or desktop app works offline. The desktop app does not ship an automatic updater, so no updater manifest is advertised.

## Release and live identity

- Source release: `v0.1.1` at `https://github.com/B-Divyesh/sf-document-history-bridge/releases/tag/v0.1.1`.
- The CORS-enabled GitHub API returned `v0.1.1` with eight assets: six installers plus `latest.json` and `SHA256SUMS`.
- Downloaded the public Linux AppImage (77,945,336 bytes). SHA-256 was `71d3a0bc10303324a1fb22f832b36829810567d806a22c7f7cde1504e7fde718`, exactly matching `latest.json` and `SHA256SUMS`.
- Deployment class remains static. Deploy with `/opt/fleet/lib/deploy-static.sh document-history-bridge dist/site`.
- Live URL: `https://document-history-bridge.sociobot.in`.
- Azure Static Web Apps deployment `26243318-0a49-4ef9-94a9-2499e9a81f69` succeeded on 2026-08-28.
- A fresh live Chromium context made one GitHub API request, zero legacy `latest.json` requests, resolved the Linux action to the v0.1.1 AppImage, and recorded zero console/page errors.
- Live root and demo verification returned HTTP 200. CSP permits GitHub API connections and no third-party scripts; security headers, `robots.txt`, and the four-route sitemap are present.
- Post-deploy `verify-url.sh` reports and screenshots are under `.factory/evidence/live-root/` and `.factory/evidence/live-demo/`.

## Known gaps

- v1 intentionally has no OCR, spreadsheet-native diffing, real-time coauthoring, cloud sync, or background capture while the app is closed.
- PDF comparison requires an embedded text layer. Scans remain recoverable but show a preview warning.
- An HTTP 404 from GitHub is caught by the app and renders the calm publishing state. Chromium itself records failed HTTP resources in its network console; a valid API response with no matching installer produces no console error.
- The local manifest uses rollback-safe writes, but v1 has no archive relocation or external backup scheduler.

## Needs operator action

- Register the production paid product for slug `document-history-bridge` in the Sociobot billing engine and confirm its return URL.
- Add Apple notarization credentials and Windows Authenticode credentials to GitHub Actions when signing is available. v0.1.1 installers are unsigned, as disclosed on the site.
- Consider scheduled restore fixtures using a larger set of real-world DOCX, ODT, and PDF documents.
