# Document History Bridge

Track changes and restore earlier versions of office files without moving them to cloud storage.

Document History Bridge is a Tauri 2 desktop app for people who manage important files outside Git. It watches chosen folders, stores local snapshots, shows text changes, and restores exact earlier bytes.

The app supports DOCX, ODT, PDF, RTF, Markdown, and text files. Image-only, encrypted, and damaged files remain recoverable but may not have a text preview.

The free edition watches one folder and keeps 30 snapshots per file. A $29 one-time Archive license removes both limits. Comparison and restore remain free.

Website: [document-history-bridge.sociobot.in](https://document-history-bridge.sociobot.in)

## Try the sample project

Open the [browser demo](https://document-history-bridge.sociobot.in/demo/). It includes three office files with two snapshots each.

The desktop first-run screen also has **Load sample project**. Both demos are separate from your real archive. See [.factory/demo.md](.factory/demo.md) for reset and isolation details.

## Install

Download the detected installer from the website or [GitHub Releases](https://github.com/B-Divyesh/sf-document-history-bridge/releases/latest).

macOS and Windows installers are unsigned. On macOS, Control-click the app and choose **Open**. On Windows, review the SmartScreen notice before continuing.

The website reads release data from GitHub’s CORS-enabled API. It caches successful metadata for one hour and links directly to release assets.

Verified one-line installers:

```sh
curl -fsSL https://document-history-bridge.sociobot.in/install.sh | sh
```

```powershell
irm https://document-history-bridge.sociobot.in/install.ps1 | iex
```

These scripts download `latest.json`, verify the chosen asset’s SHA-256 value, and report the installed path.

## Run locally

Use Node.js 22 and Rust stable. Linux native tests also need the [Tauri 2 system packages](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run tauri dev
npm run dev:site
```

Build the desktop webview and static website:

```sh
npm run build
```

The desktop webview is written to `dist/app/`. The deployable website is written to `dist/site/`.

## Test

```sh
npm test
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

`npm test` runs unit tests and Playwright checks for browser, mobile, keyboard, accessibility, privacy, cache, and fallback behavior. Product claims and their exact commands are listed in [.factory/claims.json](.factory/claims.json).

Release binaries are built by [.github/workflows/release.yml](.github/workflows/release.yml) for macOS, Windows, and Linux.

## Privacy and safety

The desktop app has no analytics, ads, account system, or cloud document storage. Optional license checks contact only the Sociobot billing API.

A restore first records the current file. Keep a separate backup for device loss or disk failure.

Read the [privacy policy](https://document-history-bridge.sociobot.in/privacy/) and [terms](https://document-history-bridge.sociobot.in/terms/).

## License

[MIT](LICENSE)
