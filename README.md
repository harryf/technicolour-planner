# 🌈 Sarah's Amazing Technicolour Planner

A colour-first content planner for Sarah — an installable, offline-capable PWA. Her data lives in
a plain file she owns (in her own folder / cloud drive), so nothing is ever locked in.

> **Status:** v1.0.0 built & verified locally (jsdom 27/27 + real-Chrome SW/exports/screenshot).
> Deploy to GitHub Pages is the last step. Build plan: **[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)**;
> ideal-state + verification record: **[`ISA.md`](ISA.md)**.
>
> The prototype this is based on is `../approach-2-app/index.html` (design + behaviour spec); how
> Sarah thinks is in `../docs/ANALYSIS.md`.

## Install (once deployed)
1. Open `https://harryf.github.io/technicolour-planner/` in Chrome.
2. Click the install icon in the address bar (or ⋮ → "Install Sarah's Amazing Technicolour Planner").
3. First run asks where to keep your data — pick a folder (ideally your Google Drive / OneDrive folder).
4. After that it opens from your Start menu / Dock and works with no internet.

## What it is
- Installable PWA (own window, Start-menu/Dock icon); **opens offline** after first install.
- **Colour-first** board / library / turn-over views, ported unchanged from the loved prototype.
- Data source-of-truth = a **file Sarah chooses on first run** (recommend a Google Drive / OneDrive /
  iCloud folder for automatic backup), with a readable `.md` mirror — nothing is ever locked in.
- Export to JSON (always), plus `.xlsx` / `.docx` / `.pptx` for Google Drive — all client-side, no backend.
- Durable across updates (schema versioning + auto-backup-before-migrate).

## Dev / release
- Buildless: `index.html` (the app) + `manifest.webmanifest` + `service-worker.js` + `icons/` +
  `vendor/` (export libs) + `src/export.js`. Serve the folder over any static server to run locally.
- Release ritual: bump `VERSION` in `index.html` + `service-worker.js` (`CACHE`) + add a `CHANGELOG.md`
  entry → commit → `git tag vX.Y.Z` → `git push --tags`. Pages deploys; a GitHub Release is cut.

## For Sarah's requests & bugs
Send them to Harry (voice/text/screenshot) — they land in [`FEATURES.md`](FEATURES.md), get built,
and show up in your planner next time you open it. See [`CHANGELOG.md`](CHANGELOG.md) for what's new.
