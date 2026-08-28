# Document History Bridge — visual thesis

## Direction: the recovery broadsheet

Document History Bridge should feel like a trustworthy records desk, not a sync service. Its visual language is a monochrome typographic broadsheet: dense but legible columns, hairline rules, folio numbers, proofreader marks, and a warm paper ground. The app makes an invisible technical process—content-addressed versioning—read like a human audit trail. It is intentionally single-mode: an archive is a stable place, and the warm light treatment keeps the file content, not chrome, in command.

## Palette

- `paper #F2EFE7`: warm archival stock; the explicit page background.
- `paper-raised #FBFAF6`: current sheets and controls.
- `ink #171713`: primary type, 15.5:1 on paper.
- `ink-muted #59584F`: secondary copy, 6.3:1 on paper.
- `rule #A7A397`: structural lines, never the only state indicator.
- `proof #A63828`: insertions, warnings, active comparison; 5.8:1 on paper.
- `ledger #245D3A`: successful capture and exact restore; 7.1:1 on paper.
- `wash #DED9CC`: selected rows and quiet depth.
- `danger #842E25`: destructive/error copy, always paired with text or icon.

## Type

Two locally available system stacks avoid remote font requests and keep startup small.

- Display/editorial: Georgia, `Times New Roman`, serif. High-contrast forms evoke contracts and annual reports without imitating a newspaper brand.
- Interface/metadata: `Arial Narrow`, Arial, system sans-serif. Uppercase folios and tabular numbers give scanning rhythm.

Scale: 12 / 14 / 16 / 20 / 32 / clamp(44–76) px. Body is 16px minimum with 1.55 leading. Document excerpts top out near 72 characters. Snapshot dates use tabular figures.

## Spacing and layout

The base unit is 4px; primary intervals are 8, 12, 16, 24, 32, 48, 64, and 96px. Rules divide continuous editorial regions; boxes appear only for independent files or actions. Desktop app uses a three-part desk: watched files, a chronological spine, and comparison sheet. At 390px, the rail becomes a horizontal section switcher and details stack in reading order. Every interactive target is at least 44px.

## Interaction grammar

- A change is a proof mark: removed text is struck through, inserted text is underlined, and both include explicit labels.
- A snapshot is a folio on one vertical binding line; selecting it lifts its paper by 2px and darkens its left rule.
- Restore is described as copying an exact prior file over the original, with a pre-restore backup made first.
- Empty states resemble an unused index sheet. Errors are plain-language margin notes with an immediate next action.
- Keyboard: Tab reaches all controls; arrows move through timeline snapshots; Enter opens; Escape closes dialogs.

## Motion

Only state continuity moves: sheets settle upward over 180ms, timeline selection slides 2px, and notices fade over 220ms. No loops, parallax, or decorative motion. Under `prefers-reduced-motion: reduce`, transitions and smooth scrolling are removed; hierarchy remains through line weight, fill, and type.

## Asset plan and provenance

The hero is an original AI-generated editorial still life: stacked office-document leaves moving from disorder to a bound archival timeline, rendered as charcoal/ink printmaking on warm paper. It explains local provenance rather than decorating it. No interface screenshot, legible copy, people, brands, watermark, or logo. Product icons are hand-authored SVG line symbols in the application source.

### Prompt sheet

- Subject: a sequence of office-document pages, table grids and revision marks resolving into a neat chronological archive.
- World/materials: letterpress, charcoal, engraved linework, fibrous cream paper, black binder thread, a single proofreader-red mark.
- Light/lens: flat editorial overhead light, wide landscape crop, subtle cast-paper shadows, negative space toward upper left.
- Palette words: bone paper, soot black, graphite grey, restrained oxblood red, tiny ledger green.
- Negative list: no people, hands, laptops, cloud symbols, UI screenshots, logos, brands, text, letters, watermarks, glossy 3D, gradients, neon, blue.

Generation record: created 2026-08-28 with the Param Factory Azure image deployment via `/opt/fleet/lib/gen-image.sh`; original output and JSON prompt sidecar live in `assets/src/`. The generated work is original for this product. It is disclosed as AI-generated in the site footer.

The 1200×630 social preview is a center crop of that original image. The favicon is a hand-authored document-and-proof-mark SVG. The Apple touch icon is derived from the hand-authored application icon. No third-party visual assets are used.

## Responsive intent

The marketing page moves from a masthead and two-column lead to a single reading column. On mobile it drops decorative folio annotations, preserves the product proof points, and keeps the detected download action before the illustration. The application retains capture, comparison, and restore; secondary metadata collapses into disclosure rows rather than disappearing.
