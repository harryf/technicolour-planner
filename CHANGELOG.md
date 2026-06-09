# Changelog, Technicolour Planner

Newest first. The version badge in the app footer shows the latest entry's "what's new."

## [1.0.6], 2026-06-09
- **Reliable "Open the App" detection.** Before, the page only knew the app was installed if it had
  been opened in its own window first, so a browser tab often still showed "Install". Now, on Chromium,
  if the browser never offers an install prompt (which only happens when the app is already installed),
  the gate shows "Open the App". The localStorage flag and getInstalledRelatedApps stay as fast paths.

## [1.0.5], 2026-06-09
- **"Open the App" when already installed.** Visiting the web page on a device where the planner is
  already installed now shows an "Open the App" button and a short "open it from your Desktop" note,
  instead of the install steps. Browsers can't launch an installed app from a tab, so the button
  guides you to open it rather than auto-launching.
- **Committed test suite** (`tests/`, run with `bun run test`): jsdom unit tests plus real-Chrome
  integration tests (service worker, offline reload, Office exports, install gate), and a CI workflow.

## [1.0.4], 2026-06-09
- **Choosing an existing folder loads it instead of overwriting.** When you point the app (in
  onboarding or in Settings) at a folder that already contains `Technicolour-Planner-Data.json`, it
  now reads that file and adopts your data, rather than replacing it with the starter content.

## [1.0.3], 2026-06-09
- **Automatic updates.** The app now updates itself: the service worker activates a new version and
  the page reloads once on the next open, so you always get the latest. The old manual "reload to
  update" prompt was hidden behind the install gate, so it never appeared. That is gone now.
- Tidied all of the in-app wording to plain sentences (removed em dashes and stray jargon).

## [1.0.0], built 2026-06-09 (pending deploy)
First real release, the prototype, turned into an installable, offline app.
- **Installable PWA**: own-window app, Start-menu/Dock icon, opens fully offline after first load
  (service worker precaches the shell + export libs; cache-first; gentle "new version, reload" toast).
- **Your data in a file you own**: first-run onboarding asks where to keep your work (File System
  Access), with a human-readable `.md` mirror next to the JSON, an IndexedDB cache, a one-click
  "reconnect" when the browser asks for permission again, and a graceful "keep it in this browser"
  fallback if you skip it.
- **Durable across updates**: schema versioning + auto-backup-before-migrate (keeps the last 10 backups).
- **Office exports for Google Drive**: `.xlsx` / `.docx` / `.pptx`, built on your computer (nothing
  uploaded), lazy-loaded so the app stays light.
- **Polish**: version badge + "what's new", "back up now", data-location display, "send feedback".
- Everything from the loved prototype preserved: colour-first board / library / turn-over, the four
  targets in your colours, hook picker, templates, balance bar, calm mode, seeded with your real work.

## [1.0.2], 2026-06-09
- **Fixed the install-screen layout.** The gate card used `class="card"`, which collided with the
  project-card rule (`display:flex`) and laid its text out as narrow columns. Renamed to `.gbox`
  (block, definite width, scrolls if tall), it now renders as a normal centered panel.

## [1.0.1], 2026-06-09
- **Fixed the first-load flash**: the service worker's first-load `controllerchange` no longer
  triggers a reload (only a user-accepted update does). The page no longer flashes/reloads on open.
- **Installed-app gate**: the planner detects whether it's running as the installed PWA
  (`display-mode: standalone`) vs a public browser tab. In a browser tab on the live URL it now shows
  a frosted install screen with one-click install (Mac + Windows steps, incl. adding a Desktop icon),
  so your data only shows in the installed app. Localhost dev is exempt.
- Onboarding now reliably appears on the installed app's first run if no data folder is set yet.

## [Unreleased]
- (next changes land here)
