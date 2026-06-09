# Changelog — Technicolour Planner

Newest first. The in-app update toast surfaces the latest entry's "what's new."

## [1.0.0] — built 2026-06-09 (pending deploy)
First real release — the prototype, turned into an installable, offline app.
- **Installable PWA**: own-window app, Start-menu/Dock icon, opens fully offline after first load
  (service worker precaches the shell + export libs; cache-first; gentle "new version — reload" toast).
- **Your data in a file you own**: first-run onboarding asks where to keep your work (File System
  Access), with a human-readable `.md` mirror next to the JSON, an IndexedDB cache, a one-click
  "reconnect" when the browser asks for permission again, and a graceful "keep it in this browser"
  fallback if you skip it.
- **Durable across updates**: schema versioning + auto-backup-before-migrate (keeps the last 10 backups).
- **Office exports for Google Drive**: `.xlsx` / `.docx` / `.pptx`, built on your computer (nothing
  uploaded), lazy-loaded so the app stays light.
- **Polish**: version badge + "what's new", "back up now", data-location display, "send feedback".
- Everything from the loved prototype preserved: colour-first board / library / turn-over, the four
  targets in your colours, hook picker, templates, balance bar, calm mode — seeded with your real work.

## [Unreleased]
- (next changes land here)
