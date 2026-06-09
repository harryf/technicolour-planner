# 🌈 Sarah's Amazing Technicolour Planner

A colour-first content planner for Sarah — an installable, offline-capable PWA. Her data lives in
a plain file she owns (in her own folder / cloud drive), so nothing is ever locked in.

> **Status:** planning complete, build not started. The full build plan is in
> **[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)** — read it first.
>
> The working prototype this is based on is `../approach-2-app/index.html` (that's the design +
> behaviour spec). How Sarah thinks is in `../docs/ANALYSIS.md`.

## What it will be
- Installable PWA (own window, Start-menu/Dock icon); **opens offline** after first install.
- **Colour-first** board / library / turn-over views, ported unchanged from the loved prototype.
- Data source-of-truth = a **file Sarah chooses on first run** (defaults sensible on Win/Mac;
  recommend a Google Drive / OneDrive / iCloud folder for automatic backup).
- Export to JSON (always), plus `.xlsx` / `.docx` / `.pptx` for Google Drive — all client-side, no backend.
- Durable across updates (schema versioning + auto-backup-before-migrate).

## For Sarah's requests & bugs
Send them to Harry (voice/text/screenshot) — they land in [`FEATURES.md`](FEATURES.md), get built,
and show up in your planner next time you open it. See [`CHANGELOG.md`](CHANGELOG.md) for what's new.
