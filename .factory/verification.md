# Independent verification — FAIL

**Candidate:** `5fac03e79ed952770fd082ffe59d750c913821e8`  
**Live URL:** `https://document-history-bridge.sociobot.in`  
**Verified:** 2026-08-28

## Release decision

**FAIL.** The site and the supported-format archive/restore path are healthy, but the native archive silently ignores unsupported files while telling the user that the folder was captured. This violates the researched brief's explicit requirement to clearly flag unsupported encrypted/proprietary formats. For a history/recovery product, a user can reasonably infer that an important file is protected when it is not.

## Release-blocking defect

### P1 — Unsupported files are silently excluded from the archive

- Evidence: `capture_file` returns `Ok(false)` for any unsupported path at `src-tauri/src/lib.rs:197-199`. Both the initial folder walk (`src-tauri/src/lib.rs:319-334`) and recurring capture (`src-tauri/src/lib.rs:263-279`) discard that outcome without recording or returning a warning. The UI then unconditionally announces “Folder is watched. Existing documents were captured.” at `src/main.ts:166-168`.
- Reproduced boundary condition by tracing the real native capture flow for an unlisted spreadsheet extension, which the shipped allowlist explicitly rejects. The only format claim test is a unit-level allowlist assertion; it does not assert a visible rejection/recovery path.
- Required repair: after a folder scan, show a persistent, accessible summary naming skipped files and why (unsupported extension, encrypted/unreadable preview, or size limit). Do not report a fully captured folder when files were skipped. Add a claim-tagged end-to-end/native test that asserts the observable warning and recovery guidance.

## Other defect

### P2 — Hashed production assets are not immutable-cached

- Evidence: live `GET /assets/index-C4pv2oof.js`, CSS, and hero WebP all return `Cache-Control: public, must-revalidate, max-age=30`, the same as HTML. `public/staticwebapp.config.json` has no asset-specific immutable cache rule.
- Impact: does not break the first visit, but misses the stated production caching policy and forces unnecessary revalidation on every returning visit.
- Required repair: configure long-lived immutable caching for fingerprinted `/assets/*` files (and immutable versioned static media) while retaining short/no-cache HTML.

## Required claim checks

`.factory/claims.json` exists and contains 11 claims. Every listed command was run from this clean checkout after `npm ci`; all assertions passed once standard Tauri Linux prerequisites were installed.

| Claim | Result | Evidence |
| --- | --- | --- |
| `platform-download` | PASS | `npm run test:e2e -- --grep @claim:platform-download` (1 passed; 1 expected mobile skip) |
| `sample-comparison` | PASS | exact command (2 passed) |
| `demo-private` | PASS | exact command (2 passed) |
| `safe-restore` | PASS | exact command (2 passed) |
| `free-limits` | PASS | exact command (2 passed) |
| `native-history` | PASS | `cargo test --manifest-path src-tauri/Cargo.toml claim_native_history` |
| `app-privacy` | PASS | exact Vitest command |
| `format-support` | PASS, insufficient observable coverage | `cargo test --manifest-path src-tauri/Cargo.toml supported_formats_are_explicit` |
| `release-cache` | PASS | exact command (1 passed; 1 expected mobile skip) |
| `installer-checksum` | PASS | exact Vitest command |
| `release-matrix` | PASS | exact Vitest command |

The bare container initially lacked `glib-2.0` development metadata, so Cargo could not compile Tauri. I installed the documented Tauri Linux prerequisites (`libglib2.0-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`) without changing repository files, then reran the native checks successfully. This is an environment prerequisite, not an assertion failure.

## Build and automated checks

- `npm ci`: PASS; 0 audited vulnerabilities.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS. Output: `dist/app/` and `dist/site/`; landing JS 3.35 KB (1.42 KB gzip), demo JS 4.02 KB (1.68 KB gzip), landing CSS 11.04 KB (2.96 KB gzip), mobile hero 40.94 KB.
- `npm test`: PASS — Vitest 10/10; Playwright last-run status `passed`.
- `cargo test --manifest-path src-tauri/Cargo.toml`: PASS — 3/3 tests, including exact-byte restore and safety snapshot.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`: PASS.
- `/opt/fleet/lib/verify-url.sh` against the local production preview: PASS for `/` and `/demo/`; 200, title/lang, one h1, main landmark, no missing image alt/unlabelled buttons, no console/page errors.
- Axe via Playwright on live `/`, `/demo/`, `/privacy/`, `/terms/`, and `/404/`: zero serious/critical findings.

## Live deployment and product exercise

- **Cold first read: PASS.** The first screen says it tracks changes in office files, names people managing office files outside Git, and its first primary action is **Try it with sample data** with the result “Opens a browser demo. Nothing is saved.”
- **Demo: PASS.** A fresh `/demo/` context contains the persistent “Demo — sample data, nothing is saved” banner, Reset demo, and Start for real. Selecting `Records-policy.odt` displays “Removed: five” and “Added: seven”; sample restore announces that no computer file changed. Direct demo use makes no off-origin requests and uses `demo:document-history-bridge:selection`.
- **Desktop and mobile: PASS.** Live Chromium at 1440px and 390px had no horizontal overflow, console errors, or page errors. Keyboard Tab starts at the skip link and shows a solid visible `rgb(166, 56, 40)` focus outline; the demo list supports arrow selection.
- **Privacy/network: PASS.** Landing-page request log contained only the site origin plus the documented `https://api.github.com/repos/B-Divyesh/sf-document-history-bridge/releases/latest` request. No analytics, tracking, document upload, third-party font, or raw Azure/OpenAI request was observed. Direct demo testing made no off-origin request.
- **Security headers: PASS.** Live root returned CSP restricting scripts/styles/images to self and `connect-src` to self plus GitHub API, HSTS, `nosniff`, strict-origin referrer policy, and disabled camera/microphone/geolocation.
- **Billing allowance: PASS.** Repeated invalid-license verification requests to the documented Sociobot endpoint returned 30 × 200 followed by `429` at request 31 with `Retry-After: 1`; observed allowance was 30 requests in the tested window.
- **Release/install: PASS.** GitHub Releases API exposes v0.1.1 with macOS arm64/x64, Windows x64, and Linux x64 assets plus `SHA256SUMS` and `latest.json`. Downloaded Linux `.deb` SHA-256 `a67918e191def411dca295f7878debdea188704f050199cb7f0e08157170f27b` equals `SHA256SUMS`.
- **Candidate/live identity: PASS.** Rebuilding `5fac03e` produced byte-identical live `index.html`, demo/privacy/terms/404 HTML, JS/CSS bundles, and hero images. v0.1.1 contains the application code; commits between its tag and the candidate change only tests, evidence, and documentation.

## Notes

The preceding deployment-only release-metadata CORS failure is not present in this candidate: a fresh live browser request uses the GitHub API, has no console/page errors, and resolves the detected Linux installer.
