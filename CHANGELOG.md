# Changelog, Technicolour Planner

Newest first. The version badge in the app footer shows the latest entry's "what's new."

## [1.3.2], 2026-06-10
- **Calm mode actually calms now.** Turning it on stops all movement, softens the colours into gentle
  pastels (your colour codes stay clear, just quieter), and removes shadows. There's a short line in
  Settings saying exactly what it does. It also follows your device's "reduce motion" setting on its own.
- **Tidier folder.** Your automatic checkpoints now tuck into a **"saves"** subfolder, so your main
  folder ends up with just the two data files plus **images** and **saves**. Old checkpoints sitting in
  the main folder are moved into "saves" for you the next time you open the app.

## [1.2.3], 2026-06-10
- **Tidier, better-aligned editor.** Buttons no longer wrap onto two lines, so the date row
  (today / → next week / clear) and the hook's "pick" button line up at the same height, and Music and
  Hook are properly aligned. The panel is a little wider to make room.
- **Nicer picture control.** When a piece has a picture, the editor now shows the **picture itself** with
  a 📷 (change) and 🗑 (remove) icon on it, instead of a plain file box. With no picture yet, there's a
  clear **"🖼 Add a picture"** button. The label notes that **wide / landscape (about 1280 × 720)** looks
  best, since the picture is shown in a wide format.
- The task **activity dropdown** now has room around its little arrow.

## [1.2.2], 2026-06-10
- **The edit panel is friendlier.** It's wider now (about a third of the screen) with less scrolling.
  The **Description / caption** and **Notes** each have a clear **"⤢ Bigger"** button that opens a roomy,
  full-height writing space on top, no squinting into a small box. **Music** and **Hook** sit side by
  side to save room. The confusing **"Done"** button is gone (it was really just a close button); there's
  one clear **"✕ Close"** at the top.

## [1.2.1], 2026-06-10
- **Library opens on "Still to do".** The Library filter is now ordered **Still to do · Posted · All**
  and starts on **Still to do**, so you land straight on what's left to do. "Posted" is everything
  already done; "All" is everything.

## [1.2.0], 2026-06-10
- **Roll the week over.** A new **"Still to do"** strip sits above the board and gathers anything from
  earlier weeks you never posted. Each one has a single tap: **→ this week**, **→ next week**, or
  **✓ posted**. Nothing ever moves on its own, you decide, and posted pieces drop out into your history.
- **Set the days you work.** In Settings, pick which weekdays you work (Sarah, Mondays are off by
  default for you now). Days you don't work show greyed with "NO POST" and are skipped when rolling
  something forward, so nothing lands on a day off.
- **Quick reschedule.** Every card on the board has a little **"→ next wk"**, and the detail panel has
  **today** and **→ next week** buttons next to the date, so you don't have to pick a date by hand.
- **Library filter.** Filter your library by **All / Still to do / Posted** to look back over what's done.
- **French removed** from settings (it changed almost nothing), and your data file quietly upgrades to
  remember your work-day choices (a backup is written before the upgrade).

## [1.1.2], 2026-06-10
- **Window title, full-screen, and tidier filter buttons.** The app name no longer appears twice in the
  window title (the manifest name now matches the page title). The installed app opens at the full size
  of your screen. The "clear ✕" button is greyed out when there's no filter to clear, and "hide
  non-matching" is only active (and only stays ticked) when a colour filter is switched on.

## [1.1.1], 2026-06-10
- **Tidier footer + tidier folder.** The footer now shows just your data folder's name (not the file
  inside it). Attached pictures now go into an `images` subfolder of your data folder, so the main
  folder stays clean instead of filling up with image files. Pictures saved before this update are
  still found (the app checks the old location too).

## [1.1.0], 2026-06-10
- **Your storage folder, front and centre.** The footer now shows where your data lives
  (`📁 YourFolder/Technicolour-Planner-Data.json`) and you can click it to change the folder any
  time, the same as in Settings. (Browsers don't let a web app see a folder's full computer path,
  so it shows the folder's name, which is the most they'll reveal.)
- **Pictures are saved into your folder.** When you attach an image to a piece and you have a data
  folder connected, the app now saves a copy of the picture into that folder and remembers its file
  name, instead of stuffing the image inside the JSON. Your data file stays small and your pictures
  are real files you own. With no folder connected it still works, keeping the image inline as before.
- **"Send feedback" now opens WhatsApp** straight to Harry, with a starter message, instead of email.

## [1.0.9], 2026-06-09
- **Fixed updates getting stuck on an old version.** GitHub Pages serves files with a 10-minute cache,
  so when a new version installed, the service worker was precaching a stale `index.html` from the
  browser cache: the worker updated but the page stayed old. The service worker now fetches shell
  files with `cache: "reload"` (bypassing the HTTP cache) and registers with `updateViaCache: "none"`,
  so a new version loads fully. Reproduced the failure and confirmed the fix with an automated test.

## [1.0.8], 2026-06-09
- **Checkpoints, and a tidier header.** The live data file already updates on every change, so the
  header's Import/Export buttons were redundant; they moved into Settings. "Save a checkpoint now"
  writes a timestamped copy into your folder (was a plain download), and the app saves one
  automatically each time it starts. The last 20 checkpoints are kept. Settings also has "Restore
  from a file" and "Download a copy" as escape hatches.

## [1.0.7], 2026-06-09
- **Installed app picks up updates on its own.** It previously only checked for a new version at cold
  launch, so a window left open (or resumed) stayed on the old version. It now also re-checks when you
  switch back to the app and once an hour, then applies the update with its usual one reload.

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
