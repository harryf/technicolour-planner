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

## [1.0.1] — 2026-06-09
- **Fixed the first-load flash**: the service worker's first-load `controllerchange` no longer
  triggers a reload (only a user-accepted update does). The page no longer flashes/reloads on open.
- **Installed-app gate**: the planner detects whether it's running as the installed PWA
  (`display-mode: standalone`) vs a public browser tab. In a browser tab on the live URL it now shows
  a frosted install screen with one-click install (Mac + Windows steps, incl. adding a Desktop icon),
  so your data only shows in the installed app. Localhost dev is exempt.
- Onboarding now reliably appears on the installed app's first run if no data folder is set yet.

## [Unreleased]
- (next changes land here)
