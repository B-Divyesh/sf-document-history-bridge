# Document History Bridge

Document History Bridge is a local-first desktop utility for people who keep important office files outside Git. It watches existing folders, creates deduplicated SHA-256 snapshots, turns DOCX/ODT/PDF content into readable change sheets, and restores the exact bytes of an earlier version.

No document contents, extracted text, folder paths, or usage data leave the machine. The only network request made by the app is an optional license verification.

Website: [document-history-bridge.sociobot.in](https://document-history-bridge.sociobot.in)

## What v1 does

- Watches one or more existing folders while the app is running, without reorganizing originals.
- Captures DOCX, ODT, PDF, RTF, Markdown, and plain-text files into a content-addressed local archive.
- Extracts paragraphs and table cells from DOCX/ODT and text layers from PDFs.
- Compares any snapshot with the one before it using explicit added/removed proof marks.
- Restores exact earlier bytes after making a pre-restore safety snapshot.
- Clearly preserves, but does not preview, encrypted, image-only, or malformed formats.
- Free edition: one folder and the latest 30 versions per file. A $29 one-time Archive license unlocks unlimited folders and indexed snapshots. Comparison and safe restore remain free.

Non-goals for v1 are OCR, live coauthoring, cloud sync, and spreadsheet-native diffs.

## Install

Download the detected installer from the website or [GitHub Releases](https://github.com/B-Divyesh/sf-document-history-bridge/releases/latest).

macOS and Windows artifacts are unsigned until the operator adds signing certificates. On macOS, Control-click the app and choose **Open** on first launch. On Windows, review and accept the SmartScreen prompt.

Verified one-line installers:

```sh
curl -fsSL https://document-history-bridge.sociobot.in/install.sh | sh
```

```powershell
irm https://document-history-bridge.sociobot.in/install.ps1 | iex
```

Both scripts read the release manifest, download the matching installer, verify SHA-256, and print exactly what they did.

## Local development

Requirements: Node.js 22, Rust stable, and the [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run tauri dev       # desktop app
npm run dev:site        # landing site
```

Build everything with the work-order command:

```sh
npm run build
```

The desktop webview is written to `dist/app/`; the deployable static website is written to `dist/site/` with `index.html` at that root.

## Test and verify

```sh
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

`npm test` runs Vitest logic tests plus Playwright desktop/mobile and axe accessibility tests. Release binaries are built only by `.github/workflows/release.yml` on a `v*` tag or manual dispatch.

## Archive safety

The archive is stored under the OS-specific application data directory for `in.sociobot.document-history-bridge`. Objects are addressed by SHA-256 and written through temporary files. A restore captures the current original, prepares the replacement beside it, and rolls back if the final move fails. Uninstalling does not intentionally delete the archive.

Keep a separate backup for irreplaceable records. A local version history protects against editing mistakes; it is not a substitute for device-loss or disk-failure backup.

## Privacy and licensing

See [/privacy](https://document-history-bridge.sociobot.in/privacy/) and [/terms](https://document-history-bridge.sociobot.in/terms/). Purchases use the Sociobot billing API; no payment provider is embedded in the app or site.

The source is available under the [MIT License](LICENSE).
