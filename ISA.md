---
project: technicolour-planner
effort: E3
phase: complete
progress: 87/89
mode: ALGORITHM
started: 2026-06-09
updated: 2026-06-10
---

# ISA, 🌈 Sarah's Amazing Technicolour Planner (PWA)

> Project ISA. System of record for the deployed PWA. Seeded from `../ISA.md` (the prototype's
> ISA, 34/34) + the PWA criteria in `IMPLEMENTATION_PLAN.md`. The prototype
> `../approach-2-app/index.html` is the behaviour spec; `../docs/ANALYSIS.md` is the intent.

## Problem

Sarah loved the prototype, but it's a single `file://` HTML page: not installable, no app window,
no offline guarantee beyond the browser tab, and its data lives only in `localStorage` (wiped if
the browser is reset or the site data cleared). To actually use it day-to-day she needs an
installed app that opens offline like a native program, keeps her data in a durable file she owns
(reachable in her cloud-synced folder, extractable in human-readable form), and updates cleanly
without her doing anything. See `IMPLEMENTATION_PLAN.md` for the full build plan.

## Vision

Sarah clicks an icon in her Start menu. The planner opens in its own window, no browser chrome,
no address bar, already showing *her* world in *her* colours. It works on the train with no
internet. Her data is a real file in her Google Drive folder, so it backs up by itself and she
can open it in Notepad if she ever wants. When we ship an improvement, she gets a gentle "new
version, reload to update" nudge; nothing breaks, nothing is lost. The euphoric surprise: **it
feels like a real app she installed, but it was free, took one click, and her data never left her
hands.**

## Out of Scope

- No backend, database server, accounts, auth, or multi-user.
- No live Google Drive API / OAuth, the synced-folder file trick replaces it.
- No Tauri / native `.exe` this round (revisit only if "install with zero internet" becomes hard).
- No redesign of the UI, this is a port + hardening of the prototype, not a rethink.
- No live Instagram API / auto-posting (carried from the prototype scope).

## Principles

- **Colour is data, not decoration**, two independent registers (type vs target/activity), never collide.
- **Redundant encoding**, every colour also carries a text/letter label.
- **One glance, then one click**, board answers what/when by colour; click answers where-am-I/what's-next.
- **Never trap her data**, source of truth is a plain file she owns; JSON + Markdown, always extractable.
- **No surprises**, stable layout, optional motion, explicit "you are here"; updates never block opening.
- **Degrade, never hard-fail**, non-Chromium or skipped onboarding still leaves a working app.
- **Seed with her real world**, not placeholder text.

## Constraints

- Buildless: vanilla HTML/CSS/JS, single primary `index.html`; hosting = static files only.
- PWA served over HTTPS (GitHub Pages) so service worker + install work.
- Source of truth = a user-chosen file via the File System Access API; IndexedDB caches data + the
  file handle; `localStorage` remains the fallback/seed path.
- File System Access is Chromium-only → graceful IndexedDB/localStorage fallback elsewhere.
- TypeScript/bun for any dev tooling (icon generation, local server, verification); no Python.
- The app makes **zero runtime network calls** after install (export libs vendored locally, lazy-loaded).
- Public repo `harryf/technicolour-planner`; `<meta robots noindex>` + robots.txt for v1 privacy.

## Goal

Turn the prototype into a deployed, installable PWA at `https://harryf.github.io/technicolour-planner/`
that: **(1)** installs to the OS and opens fully offline after first load; **(2)** stores Sarah's
data in a file she chooses on first run (with a human-readable `.md` mirror), cached in IndexedDB,
with a one-click reconnect when permission lapses and a graceful fallback if she skips it;
**(3)** survives our updates via schema versioning + auto-backup-before-migrate; **(4)** exports to
`.xlsx`/`.docx`/`.pptx` client-side for Google Drive; **(5)** shows a version badge, "what's new",
a "back up now", a data-location display, and a feedback button, all while preserving every
colour-first behaviour the prototype already shipped and seeded with her real projects/hooks/targets.

## Criteria

### Carried, prototype behaviour must survive the port (regression guard)
- [x] ISC-1: Ported `index.html` opens and renders the board with no server (localStorage path), no console errors.
- [x] ISC-2: App title/brand reads "Sarah's Amazing Technicolour Planner" (not "Studio Planner").
- [x] ISC-3: Seeded with ≥10 of Sarah's real projects on first open (Burton dogs / Carla / 1 TTT visible).
- [x] ISC-4: Hook library (≥20 hooks) renders in Turn-over, filterable by hook-type.
- [x] ISC-5: Cards show type colour + redundant R/P/S letter, and target split-colour stripes + text.
- [x] ISC-6: Weekly board: 7 day columns (FR/EN), "NO POST" Saturday default, dated projects auto-place.
- [x] ISC-7: Keys 1–4 / target chips filter live; balance bar shows per-target counts + under-served flag.
- [x] ISC-8: New Reel/Post/Story templates, hook picker, detail drawer, activity-coloured tasks all work.
- [x] ISC-9: Anti: no flashing, no autoplay motion, no surprise modal on normal (non-first) load.

### M1, Installable offline shell
- [x] ISC-10: `manifest.webmanifest` exists with name, short_name, start_url, scope, display:standalone, theme/background colours.
- [x] ISC-11: `<link rel="manifest">` + theme-color meta present in `index.html`.
- [x] ISC-12: `icons/` contains real PNGs: icon-192.png, icon-512.png, icon-maskable-512.png (correct dimensions).
- [x] ISC-13: Manifest references all three icons with correct sizes/purposes (192+512 any, 512 maskable).
- [x] ISC-14: `service-worker.js` precaches the app shell (index.html, manifest, icons) under a versioned cache.
- [x] ISC-15: Service worker uses cache-first for same-origin GET and cleans up old caches on activate.
- [x] ISC-16: `index.html` registers the service worker (guarded to secure contexts; no-op on file://).
- [x] ISC-17: A new service worker version applies automatically on the next open (skipWaiting + activate; one controlled reload via the hadController guard), with no manual prompt. (Changed from the original toast model in v1.0.3, see Changelog.)
- [x] ISC-18: Served over a local HTTP server, the page loads; after caching, a second load with network blocked still serves the shell (offline proof).

### M2, Store layer + "ask where to store data"
- [x] ISC-19: A `Store` abstraction exists with init/load/save/setLocation/export/import/backup/status; UI calls route through it.
- [x] ISC-20: Store writes the data file via File System Access (`createWritable`) when a handle exists; reads via `getFile()`. (FU-1 closed: Harry's fresh-install test 2026-06-09 confirmed file write + existing-folder load.)
- [x] ISC-21: The file handle persists in IndexedDB so the location is chosen once. (FU-1 closed: confirmed in Harry's fresh-install test.)
- [x] ISC-22: On launch with a lapsed permission, a single "Reconnect your data file" action re-grants and loads. (FU-1 closed: confirmed in Harry's fresh-install test.)
- [x] ISC-23: First-run onboarding modal: welcome → "where to keep your work" (Choose folder) → done, seeded.
- [x] ISC-24: Onboarding has a "Decide later" escape hatch → IndexedDB/localStorage-only with a standing reminder banner.
- [x] ISC-25: `navigator.storage.persist()` is requested on first run.
- [x] ISC-26: On a non-Chromium / no-FSA browser, Store degrades to IndexedDB/localStorage and never throws.
- [x] ISC-27: Each save also writes a human-readable `Technicolour-Planner-Data.md` mirror next to the JSON.

### M3, Durability
- [x] ISC-28: Data carries `schemaVersion`; a `CURRENT_SCHEMA` constant and ordered `migrations[]` exist.
- [x] ISC-29: Before any migration runs, a `…-backup-<ISO>.json` is written; only last N (≥10) kept.
- [x] ISC-30: JSON import validates shape and refuses junk with a friendly message (no silent corruption).
- [x] ISC-31: Round-trip: export JSON → clear → import → identical project set.

### M4, Office exports (client-side, offline)
- [x] ISC-32: Export libs (exceljs/docx/pptxgenjs) are vendored locally in `vendor/` (no CDN at runtime).
- [x] ISC-33: Export module is lazy-loaded only on first export click (initial load stays light).
- [x] ISC-34: `.xlsx` export produces a valid workbook with her projects + colour encoding.
- [x] ISC-35: `.docx` export produces a valid project-notes document.
- [x] ISC-36: `.pptx` export produces a valid weekly-board slide deck.

### M5, Polish
- [x] ISC-37: Footer shows a version badge reading a `VERSION` constant; "what's new" surfaces the CHANGELOG entry.
- [x] ISC-38: Settings adds: change data location, "Back up now", persistent-storage status, current data-file name.
- [x] ISC-39: A "Send feedback" control opens a prefilled mailto to Harry including the app version.

### M6, Deploy + experiential guarantee
- [x] ISC-40: Live URL serves the real app (not the placeholder) over HTTPS with `noindex` intact. (Deployed 2026-06-09 on Harry's go; FU-2 closed.)
- [x] ISC-41: Antecedent: on first install Sarah sees HER projects in HER colours, in an own-window offline app, the recognition + "it's a real app" that makes it land.

### v1.0.1, first-load flash fix + installed-vs-browser gate
- [x] ISC-42: First load fires exactly one navigation, the SW's first-load `controllerchange` (from `clients.claim()`) no longer triggers a reload; only a user-accepted update does.
- [x] ISC-43: In a public browser tab (non-localhost, non-standalone) a frosted install-gate overlay covers the UI; it's dormant when running standalone (installed) or on localhost dev.
- [x] ISC-44: `beforeinstallprompt` is captured and an in-gate Install button triggers the prompt; Mac + Windows install steps (incl. dragging to the Desktop) are shown.

### v1.0.4–1.0.5: data safety, install UX, test suite
- [x] ISC-45: Choosing a folder that already holds `Technicolour-Planner-Data.json` loads it instead of overwriting (onboarding + Settings both adopt existing data).
- [x] ISC-46: In a browser tab on a device where the app is installed, the gate shows "Open the App" (not "Install"); detection via a localStorage flag + `getInstalledRelatedApps()`.
- [x] ISC-47: A committed test suite (`tests/`) runs via `bun run test` (jsdom unit + real-Chrome integration); a CI workflow runs it on push and PR.
- [x] ISC-48: Browser tests prove true offline reload (network emulated offline → cached shell renders) and that the three Office exports are valid OOXML zips.

### v1.0.6–1.0.8: reliable install detection, refocus auto-update, checkpoints
- [x] ISC-49: Timestamped checkpoints are written into the chosen folder, both on demand ("Save a checkpoint now") and automatically on app start, keeping the last 20.
- [x] ISC-50: Import/Export controls live in Settings, not the header (the live JSON + .md already mirror every change); "Restore from a file" and "Download a copy" remain as escape hatches.

### v1.0.9: updates actually land (no stale cached page)
- [x] ISC-51: Deploying a new version fully loads it: the SW precaches the shell with `cache:"reload"` (no stale page from the `max-age=600` HTTP cache), registers with `updateViaCache:"none"`, and reloads on a real `controllerchange` (ignoring only the first claim). Verified by `tests/upgrade.mjs`, which reproduces the cached-server failure and confirms the fix.

### v1.1.0: storage location in footer, images saved into the folder, WhatsApp feedback
- [x] ISC-52: The footer storage indicator shows the connected folder as `📁 <folder>/Technicolour-Planner-Data.json` when in file mode, and "Storage: this browser …" otherwise. (The File System Access API does not expose a folder's absolute OS path to a web app; the folder name is the deepest identifier available.)
- [x] ISC-53: Clicking the footer storage indicator opens the folder picker (change-location flow) via the shared `chooseLocation()`, the same path Settings uses; an existing folder's data is adopted, not clobbered.
- [x] ISC-54: Attaching an image while a folder is connected writes a copy of the file into that folder (`Technicolour-Planner-image-<projectId>-<ISO>.<ext>`) and stores only the filename in `p.imageName`, clearing the inline `p.image` data URL.
- [x] ISC-55: Attaching an image with no folder connected (or if the folder write fails) stores the inline `p.image` data URL and clears `p.imageName`, so the feature never hard-fails in localStorage mode.
- [x] ISC-56: A project whose image lives in the folder renders its thumbnail by reading the file back (object URL via `prewarmImages()` → `IMG_CACHE`), on both the board card and the detail drawer, through the single `imageSrcFor(p)` accessor.
- [x] ISC-57: Removing an image clears both `p.image` and `p.imageName`, revokes the cached object URL, and `removeEntry`s the copied file from the folder when present.
- [x] ISC-58: The "Send feedback" button opens a WhatsApp chat to `41796476540` via a `wa.me` link with a prefilled message; no `mailto:` remains in the app.
- [x] ISC-59: Anti: image attach/remove never throws or blocks the UI when folder permission has lapsed or File System Access is unavailable, it degrades to the inline data URL path (guarded by try/catch + perm checks).
- [x] ISC-60: Anti: the copied image files are not matched by `pruneBackups`' `backup|checkpoint` regex (so checkpoints never delete pictures) and are written only into Sarah's chosen folder, never the git repo.

### v1.1.1: tidier footer + images in a subfolder
- [x] ISC-61: The footer storage indicator shows the folder name only (`📁 <folder>`), not the data file path (refines ISC-52, which appended `/Technicolour-Planner-Data.json`).
- [x] ISC-62: Attached images are written into an `images/` subfolder of the data folder (`getImagesDir(true)` → `getDirectoryHandle("images",{create:true})`), and read/deleted from there; `readImageHandle()` falls back to the folder root so v1.1.0 images written at root still load (refines ISC-54/56/57).

### v1.1.2: window title, maximize, conditional filter controls
- [DEFERRED-VERIFY] ISC-63: The installed-app window title shows the app name once, not twice. Fix: manifest `name` is set identical to `<title>` (`🌈 Sarah's Amazing Technicolour Planner`) so Chrome's `{name} - {title}` window title collapses. Unit-asserted `manifest.name === <title>`; the installed-window render can't be probed headlessly → Harry confirms on reopen (FU-3).
- [DEFERRED-VERIFY] ISC-64: When launched as the installed app, the window opens at the full available screen size via `maximizeWindow()` (`moveTo(0,0)`+`resizeTo(availWidth,availHeight)`, standalone-only, try/catch). Best-effort (browser may refuse); code-verified + called in `boot()`; live behaviour confirmed by Harry on reopen (FU-3).
- [x] ISC-65: The `clear ✕` button is disabled/greyed (`disabled` + `.pill.disabled` opacity) when `activeFilters` is empty, and enabled once a filter is active.
- [x] ISC-66: The "hide non-matching" toggle is disabled when `activeFilters` is empty (and unticked + `filterHide` reset), and enabled once a colour filter is active.

### v1.2.0: roll the week over (autism-first), work-day preferences, French removed
- [x] ISC-67: The French/language option is gone (no `data-lang`, no `DOW_FR`, no "Français" in the markup); the board always uses English day names. `settings.lang` in old data is ignored, not a crash.
- [x] ISC-68: `settings.workdays` (7 bools, Mon..Sun) exists; Settings renders 7 day toggles (`#workdays`); toggling a day saves and re-renders the board.
- [x] ISC-69: Loading schema-1 data migrates to schema 2, adding `settings.workdays` (default `[T,T,T,T,T,F,T]`, Sat off), and the loader auto-backs-up the file before migrating.
- [x] ISC-70: A board day with `workdays[i]===false` renders greyed (`.day.dayoff`) and shows "NO POST" when empty; all 7 day columns always render (grid never changes shape).
- [x] ISC-71: The catch-up tray (`#catchup`) lists exactly the pieces dated before this week and not posted (`isOverdue`/`overduePieces`), oldest first; posted pieces never appear.
- [x] ISC-72: Tray "→ this week" / "→ next week" (`rollToWeek`) sets the date to the first **working** day of that week (skips days off) and never before today.
- [x] ISC-73: Tray "✓ posted" sets `stages.posted=true` and the piece leaves the tray (becomes history).
- [x] ISC-74: An empty catch-up tray shows the calm "All caught up ✓" state (predictable, always-present location).
- [x] ISC-75: Every board card carries a quick "→ next wk" button (`.rollbtn`) that reschedules to next week's first working day without opening the editor; `stopPropagation` so it doesn't open the card.
- [x] ISC-76: The detail drawer has "today" and "→ next week" quick-date buttons beside the date picker.
- [x] ISC-77: The Library filters by status, ordered **Still to do · Posted · All** and defaulting to **Still to do** (`libStatus="todo"`, `#libFilter`), so she lands on what's left; refined in v1.2.1.
- [x] ISC-78: Anti: no piece ever changes date or leaves the board/tray without an explicit tap (no auto-roll); the weekly grid always shows all 7 days (days off greyed, never removed); no past data is deleted (history stays in the Library); the v1→v2 migration backs up first and drops no existing fields.

### v1.2.2: friendlier detail drawer (autism-first editor)
- [x] ISC-79: The detail drawer is widened to about a third of a wide screen (`width:clamp(460px,33vw,820px)`, `max-width:96vw`); it still slides in from the right and never exceeds the viewport.
- [x] ISC-80: The Description/caption and Notes fields each have a clearly-labelled "⤢ Bigger" button (no magnifying-glass metaphor) that opens a roomy full-height editor overlay (`#bigEdit`) on top, synced live to the inline field, with a clear "✕ Close".
- [x] ISC-81: The confusing footer "Done" button is removed (it duplicated the close action and clashed with "Posted"); the only close affordance is the header "✕ Close".
- [x] ISC-82: Music and Hook sit on one row (`.field2`) to reduce scrolling; combined with the wider drawer the editor's scroll height drops (1188px → ~1092px at the same width).

### v1.2.3: editor button alignment + on-image picture control
- [x] ISC-83: Drawer buttons never wrap to multiple lines (`.drawer button{white-space:nowrap}`), so the date row's today / → next week / clear are all the same height (measured 38/38/38), and the hook "pick" button matches the input height.
- [x] ISC-84: The Music and Hook fields are vertically aligned (their inputs share the same top; measured equal); drawer widened to `clamp(520px,38vw,900px)` to make room.
- [x] ISC-85: The task activity `<select>` has space between its value and the dropdown arrow (`select{padding-right:30px}`).
- [x] ISC-86: When a piece has a picture, the editor shows the picture itself with on-image 📷 (change) and 🗑 (remove) icon buttons driving a hidden file input; with no picture it shows a "🖼 Add a picture" button (no bare file dialog).
- [x] ISC-87: The Image field label states wide/landscape (~1280×720) is ideal, matching the wide `object-fit:cover` thumbnail.

## Test Strategy

| isc | type | check | tool |
|-----|------|-------|------|
| ISC-1,3,5,6,7,8 | behaviour | jsdom execute + render assertions | node verify |
| ISC-2 | content | grep title/brand strings | Grep |
| ISC-10,13 | file | parse manifest JSON, assert fields/icons | node/Read |
| ISC-12 | file | stat PNGs, read IHDR dimensions | Bash |
| ISC-14,15,16,17 | code | grep SW cache logic + registration + toast | Grep/Read |
| ISC-18 | offline | serve via http, load, block network, reload | Interceptor/curl |
| ISC-19..27 | code+behaviour | grep Store API; jsdom drive onboarding/fallback | node verify |
| ISC-28,29,30,31 | behaviour | jsdom migrate + import/export round-trip | node verify |
| ISC-32 | file | stat vendor libs present | Bash |
| ISC-33 | code | grep dynamic import / lazy injection | Grep |
| ISC-34,35,36 | file | generate in headless run, validate OOXML zip | node verify |
| ISC-37,38,39 | content+behaviour | grep VERSION/footer/settings/mailto | Grep/jsdom |
| ISC-40 | deploy | curl live URL, assert app markers + noindex | curl |
| ISC-41 | experiential | headless-Chrome screenshot of installed-style board | Interceptor |
| ISC-52,53 | code+behaviour | grep footer label/onclick; jsdom asserts onclick + chooseLocation | Grep/jsdom |
| ISC-54,55,56,57 | behaviour | jsdom mock dir handle: attach writes file + sets imageName, fallback to data URL, imageSrcFor | node verify |
| ISC-58 | content | grep wa.me + FEEDBACK_WHATSAPP, assert no mailto | Grep/jsdom |
| ISC-59,60 | code | grep try/catch + perm guards; assert image name vs prune regex | Grep/jsdom |
| ISC-67,68 | code+behaviour | grep no data-lang/DOW_FR; jsdom counts 7 workday toggles | Grep/jsdom |
| ISC-69 | behaviour | jsdom migrate schema-1 → assert v2 + workdays[5]=false | node verify |
| ISC-70 | behaviour | jsdom set a day off, renderBoard, assert .dayoff + NO POST, 7 cols | node verify |
| ISC-71,72,73,74 | behaviour | jsdom + real-Chrome: overduePieces, rollToWeek skips off-day, posted leaves, empty state | node/Chrome |
| ISC-75,76,77 | code+behaviour | assert .rollbtn on cards, drawer quick dates, #libFilter 3 buttons | Grep/jsdom |
| ISC-78 | code | grep: no auto-roll path; grid always 7; migration backup-before | Grep |

## Features

| name | satisfies | depends_on | parallelizable |
|------|-----------|------------|----------------|
| Port prototype → repo index.html (rebrand) | ISC-1..9,2 |, | no |
| PWA manifest + icons + theme | ISC-10..13 | port | yes (icons) |
| Service worker + register + update toast | ISC-14..18 | manifest | no |
| Store layer (FSA + IndexedDB + mirror) | ISC-19..22,26,27 | port | no |
| First-run onboarding + persist + fallback | ISC-23..25 | store | no |
| Schema versioning + auto-backup + import guard | ISC-28..31 | store | no |
| Office export module (vendored, lazy) | ISC-32..36 | port | YES (Forge) |
| Polish: version badge, settings, feedback | ISC-37..39 | store | no |
| Deploy + live verify | ISC-40,41 | all | no |
| Footer storage location (clickable, change-folder) | ISC-52,53 | store | no |
| Image saved into folder (filename ref + cache) | ISC-54..57,59,60 | store | no |
| WhatsApp feedback | ISC-58 |, | yes |
| Remove French | ISC-67 |, | yes |
| Work-day preferences (greyed days-off) | ISC-68,69,70 | store | no |
| Catch-up tray + quick roll (autism-first) | ISC-71..76,78 | workdays | no |
| Library status filter | ISC-77 |, | yes |

## Decisions

- 2026-06-09: **Tier E3, classifier-confirmed.** Real external client work against a fully-locked
  plan; design exploration already done in the plan, so this run is execution. Project ISA → E3+
  structure (all required sections populated). ISC count 40 (E3 floor ≥32 met).
- 2026-06-09: **Delegation floor (soft), Forge on the one separable module only.** The single-file
  app must have one coherent colour/UX author to avoid drift, so the shell/Store/onboarding stay
  single-author. The Office export module (`src/export.js`) is the genuinely separable, completeness-
  heavy chunk (three formats) and is delegated to Forge in parallel, satisfying the Forge auto-include
  binding meaningfully rather than tokenistically. Show-your-math: a second delegation agent would only
  add coordination overhead on inseparable UI work.
- 2026-06-09: **localStorage retained as fallback, not removed.** M2 adds File System Access as the
  source of truth but keeps localStorage as the no-FSA / skipped-onboarding fallback so the app never
  hard-fails, satisfies the degrade-never-fail principle.
- 2026-06-09: **Repo deliberately NOT in checkpoint-repos.txt.** PAI's per-ISC auto-commit must not
  fire on Sarah's public repo; commits here are deliberate and reviewed.
- 2026-06-09: **Forge + Interceptor unavailable in this environment → graceful substitution.** Forge
  reported `unavailable` (codex CLI not installed) and correctly refused to silently fake output with
  Claude. I built `src/export.js` myself rather than block the milestone. Interceptor CLI is also not
  installed here, so web verification used real headless Chrome driven directly via the DevTools
  Protocol (Node 22 global WebSocket), still real Chrome, the rendering-accuracy bar Interceptor
  exists to meet. Both are environment gaps, not design changes.
- 2026-06-09: **Deploy gated despite "implement the plan".** Pushing to the public repo auto-deploys
  AND publishes Sarah's real personal/seed data. That is outward-facing + hard-to-reverse, so per the
  push/deploy permission boundary the build + local verification are done now and the push/tag is held
  for Harry's explicit confirm (FU-2).
- 2026-06-10 (v1.1.0): **"Full path" for storage is impossible by web platform design.** Harry asked
  the footer to show "the full path to the storage directory". The File System Access API deliberately
  withholds a folder's absolute OS path from web apps (privacy); `dirHandle.name` is the only identifier
  exposed. Decision: show `📁 <folder>/<JSON_NAME>` (the deepest available), and document the limit in
  the label/title and CLAUDE.md rather than chase an impossible absolute path.
- 2026-06-10 (v1.1.0): **Images stored as folder files, not inline, when a folder exists.** Harry asked
  attached images to be copied into the storage folder with the JSON remembering the location. Decision:
  in file mode write `Technicolour-Planner-image-<id>-<ISO>.<ext>` and store only `imageName`; in
  localStorage mode keep the inline `image` data URL (degrade-never-fail). A synchronous `IMG_CACHE`
  (object URLs) + `prewarmImages()` keeps board/drawer render synchronous without threading promises
  through every render path.
- 2026-06-10 (v1.2.3): **Editor alignment + on-image picture control.** Harry: the "→ next week" and
  hook "pick" buttons wrapped to multiple lines (taller than neighbours), Music/Hook weren't aligned, the
  task dropdown arrow was cramped, the picture should show the image itself with change/remove icons (not
  a file box), and the image hint should state ideal wide dimensions. Root cause of the misalignment was
  buttons wrapping in tight columns. Done: `white-space:nowrap` on drawer buttons + slightly wider drawer
  (`clamp(520px,38vw,900px)`) + inputs flex-grow; `select` right-padding; `.thumbwrap` with 📷/🗑 icons
  over the image and a "🖼 Add a picture" button when empty; label notes ~1280×720 landscape.
- 2026-06-10 (v1.2.2): **Friendlier detail drawer (autism-first editor).** Harry asked for a wider panel
  (~⅓), an expand affordance for caption/notes (explicitly NOT a magnifying glass, "think autism"),
  removal of the confusing "Done" button (really a close, clashed with "Posted"), and less scrolling.
  Done: drawer `clamp(460px,33vw,820px)`; `expandableField()` + `#bigEdit` roomy overlay with a labelled
  "⤢ Bigger"; footer "Done" removed, header now "✕ Close"; Music+Hook share a row. Note: measuring the
  drawer mid-slide reads as off-screen (its open transform animates from `translateX(100%)`), settle
  before asserting position, this cost a debugging detour and is now documented in CLAUDE.md.
- 2026-06-10 (v1.2.1): **Library defaults to "Still to do".** Harry: the two important views are
  still-to-do and posted; the Library now orders the filter **Still to do · Posted · All** and opens on
  Still to do, so she lands on what's left rather than the full list. ISC-77 refined.
- 2026-06-10 (v1.2.0): **"Roll the week over" designed autism-first; manual, never automatic.** Harry
  asked (grounded in `ANALYSIS.md`: predictable, low-surprise, nothing relies on memory, stable layout,
  never lose data) for a way to carry unfinished past work forward, day-off preferences, and quick
  reschedule. Two forks were put to Harry and both resolved to the autism-safe option: (1) a **manual
  catch-up tray she controls** over auto-roll (auto-move is a surprise on open); (2) **show days-off
  greyed, never hide columns** (stable grid shape). Decisions that follow: the rolling unit is the
  **piece** (it owns the date, not loose tasks); "done" = `stages.posted`; `rollToWeek` skips days off
  and never lands before today; nothing moves without a tap (ISC-78 anti); schema bumped 1 to 2 with
  backup-before-migrate. French removed (changed almost nothing; `lang` left in data, ignored).
- 2026-06-10 (v1.1.2): **Window title dedup, maximize-on-open, conditional filter controls.** Harry's
  screenshot3 showed the app name twice in the installed-window title (`{manifest name} - {document.title}`,
  which differed). Fix: set manifest `name` identical to `<title>`. Also: open the installed app at full
  screen size (`maximizeWindow()`, best-effort), grey out `clear ✕` when nothing's filtered, and
  disable/untick "hide non-matching" until a filter is active. Title + maximize are installed-window
  behaviours not probeable headlessly → ISC-63/64 DEFERRED-VERIFY, FU-3 (Harry confirms on reopen).
- 2026-06-10 (v1.1.1): **Footer shows folder name only; images moved to an `images/` subfolder.** Harry
  found `📁 Sarah/Technicolour-Planner-Data.json` too noisy and the flat folder messy as images pile up.
  refined: footer label is now `📁 <folder>`; new images write to `images/` via `getImagesDir(true)`.
  Back-compat kept, `readImageHandle()`/`deleteImageFile()` check the subfolder then the folder root, so
  v1.1.0 images already written at root still load and can be removed. ISC-61/62 added (52/54/56/57 refined).
- 2026-06-10 (v1.1.0): **Forge auto-include relaxed (soft floor), codex CLI still absent.** `command -v
  codex` → not installed, same environment gap as the build session. Show-your-math: this is a focused
  edit to one single-file app plus its committed suite; a second author would add drift risk on
  inseparable UI code. Verification leaned on the committed jsdom + real-Chrome suite (66/66) instead.

## Changelog

- conjectured: all-relative paths + relative SW registration would make the app work unchanged on the
  GitHub Pages subpath `/technicolour-planner/`. refuted_by: nothing, but the initial headless pass
  ran at root (`localhost/`), so the conjecture was untested where it most commonly fails (Pages
  subpath SW scope / manifest / icon resolution). learned: re-verified at the real subpath shape; SW
  scope, manifest href, icon href, and all 5 precached resources resolve correctly and the SW controls
  navigations after reload. criterion_now: ISC-18 verification explicitly includes a subpath probe.
- conjectured: reconnecting a lapsed file handle could safely reload the file as source-of-truth.
  refuted_by: advisor flagged that edits made while in cache/fallback mode would be silently clobbered
  by an older file on reconnect. learned: added an `updatedAt` content timestamp; reconnect now keeps
  whichever copy is newer and writes the winner back. criterion_now: ISC-22 covers conflict-aware reconnect.
- conjectured: a service worker that calls `clients.claim()` is harmless on first load. refuted_by:
  Harry reported a popup that "appears super fast then vanishes", reproduced via DevTools as 2 navigations
  (the first-load `controllerchange` from `clients.claim()` hit the update-reload handler). learned:
  guard the reload behind an explicit user-accepted-update flag so first-load control never reloads.
  criterion_now: ISC-42 asserts exactly one navigation on first load.
- conjectured: reusing `class="card"` for the install-gate panel was harmless. refuted_by: Harry's
  screenshot showed the gate text squished into narrow columns, the panel inherited the project-card
  rule `.card{display:flex}`, laying its children out as a flex row. learned: never reuse a styled
  utility/component class name for an unrelated container; renamed to `.gbox` (block, definite width,
  scrolls if tall). criterion_now: ISC-43 verification includes a rendered-panel screenshot probe
  (live gbox 520×601, was 520×1251).
- conjectured: a manual "reload to update" toast is a good update UX. refuted_by: Harry never saw it,
  because the toast sits behind the install gate (higher z-index) in a browser tab, so updates were
  never accepted and stale content (including the broken pre-fix layout) kept serving from cache.
  learned: switched to automatic updates (SW skipWaiting on install + clients.claim on activate; the
  page reloads once on controllerchange only when it already had a controller). criterion_now: ISC-17
  reframed as auto-update; the hadController guard preserves ISC-42 (no first-load reload).
- conjectured: AI-default prose (em dashes, "key/crucial", inline-header bullets) was fine for the
  app copy and docs. refuted_by: Harry flagged the em dashes against claude-writing-guide.md.
  learned: rewrote all created text (app strings, comments, docs) to plain sentences with no em
  dashes; left Sarah's own seed-data wording untouched. criterion_now: house style follows the guide.
- conjectured: on choosing a data folder, writing the current state to it is always safe. refuted_by:
  a fresh install (or a re-pick) against a folder that already held a planner file would overwrite the
  real data with the seed, since onboarding state is the seed. learned: setLocation now reads any
  existing `Technicolour-Planner-Data.json` in the chosen folder and adopts it; the caller loads that
  instead of saving over it. criterion_now: ISC-20 covers load-existing-on-folder-pick (no clobber).
- conjectured: throwaway verification scripts in /tmp are enough. refuted_by: every change risked
  silent regressions with nothing committed to catch them, and the manual harnesses were rebuilt each
  session. learned: committed a real suite (tests/: jsdom unit + real-Chrome integration via DevTools,
  a runner, and a CI workflow) so `bun run test` reproduces all verification. criterion_now: ISC-47/48
  require the suite to exist and pass, including a true-offline reload probe.
- conjectured: a browser tab can launch the installed PWA so "Open the App" could auto-open it.
  refuted_by: browsers expose no API to launch an installed app from a page (security). learned:
  detect installed state (localStorage flag + getInstalledRelatedApps) and relabel to "Open the App"
  with guidance to open from the Desktop; no auto-launch. criterion_now: ISC-46 checks the relabel.
- conjectured (v1.0.5): a localStorage flag set when the app runs standalone, plus
  getInstalledRelatedApps, is enough to detect "installed" from a browser tab. refuted_by: Harry had
  it installed but the tab still showed "Install": the flag is only set if the installed app has run
  since v1.0.5, and getInstalledRelatedApps proved unreliable. learned (v1.0.6): added the primary
  signal: on Chromium, if no install prompt fires within ~3s the app is already installed, so show
  "Open the App". criterion_now: ISC-46 also covers the no-prompt heuristic (tested deterministically).
- conjectured: header Import/Export buttons are core controls. refuted_by: the live JSON + .md mirror
  every change, so a manual export of the current state is redundant; the real value is a timestamped
  snapshot. learned: moved Import/Export into Settings, made "Save a checkpoint now" write a
  timestamped copy into the folder, and added an automatic checkpoint on every app start (last 20
  kept). criterion_now: ISC-49/50 cover folder checkpoints + the Settings move.
- conjectured (v1.0.7): checking for updates at cold launch is enough. refuted_by: Harry's installed
  window stayed on 1.0.5 because it was resumed, never cold-launched. learned: also call reg.update()
  on visibilitychange and hourly, so a long-open app self-updates. criterion_now: covered by the
  auto-update polling check in the unit suite.
- conjectured (v1.0.7/1.0.8): the auto-update path worked. refuted_by: Harry stayed stuck on old
  versions; a reproduction with a max-age server exposed TWO bugs: (1) the new SW precached a stale
  index.html from the HTTP cache (SW updated, page didn't), and (2) the `hadController` reload guard,
  captured once at load, was false on a first-ever load and never reloaded on same-session updates.
  learned: precache with `cache:"reload"`, register `updateViaCache:"none"`, and replace the guard
  with `firstControllerSeen` (ignore only the initial claim). criterion_now: ISC-51 + a committed
  upgrade test that reproduces the failure and proves the fix. Lesson: an update mechanism needs a
  real cross-version test, not version-bump-and-hope.
- conjectured (v1.1.0): storing the attached image inline in the JSON is fine. refuted_by: Harry asked
  for the picture to be a real copy in her folder with the JSON remembering only its location, inline
  data URLs also bloat the data file and aren't files she can open. learned: in file mode write the
  image into the folder and store only `imageName`; render reads it back via an object-URL cache, with
  the inline data URL kept solely as the no-folder fallback. criterion_now: ISC-54..57 (+ anti ISC-59/60).
- conjectured (v1.1.0): the footer could show the storage folder's full filesystem path. refuted_by:
  the File System Access API never exposes an absolute path to a web app by design. learned: show the
  folder name + data file (`📁 <folder>/<JSON_NAME>`), make it click-to-change, and state the platform
  limit in copy + docs. criterion_now: ISC-52/53.

## Verification

**Method mix:** jsdom functional harness (27/27) + real headless-Chrome via DevTools Protocol
(SW/cache, exports, screenshot) + static file/syntax/parse checks. Local server `127.0.0.1:8731`.

**Real-Chrome (DevTools Protocol), authoritative:**
- ISC-14/15/16/18 (offline shell): `caches.keys()` → `["technicolour-v1.0.0"]`, `shellCached:true`,
  `serviceWorker.controller:true`, `registration:true`. Cache-first + shell cached = opens offline.
- ISC-1/3/5/6/7/41 (board renders): 7 day columns, 6 cards this week, real titles
  (ttt design colour / Burton dogs / Carla / Healed, Nim), balance 8/3/3/3. Screenshot
  `/tmp/tcv/board.png` shows rainbow brand, her four target chips in her colours, balance bar with
  "light here" flags, weekly calendar with coloured day bars, today highlighted, graceful fallback banner.
- ISC-34/35/36 (Office exports): xlsx 12,563 B, docx 9,785 B, pptx 61,809 B, all `zip:true` (PK magic).
- ISC-1/9: zero console errors on load.
- ISC-10/11/13/16/18 (real subpath, advisor-driven): re-served at `…/technicolour-planner/` (Pages shape).
  SW `scope: …/technicolour-planner/`, active+controller true, manifest + icons resolve under subpath,
  all 5 shell resources precached, and after a reload the SW still controls and the board renders , 
  confirms the all-relative paths work on the deploy subpath, not just root.

**jsdom functional (27/27):** ISC-1,2,3,5,6,7,9,19,23,24,26,27,28,30,33,37,38,39 + library renders
all 14 projects + key-3 → conversion filter. (`/tmp/tcv/verify.mjs`.)

**Static:** ISC-10/13 manifest JSON valid (name/display/start_url/3 icons any+any+maskable);
ISC-12 icons 192×192, 512×512, 512×512 PNG (IHDR-confirmed); ISC-32 vendor libs present
(exceljs 948KB, docx 770KB, pptxgen 478KB); export.js + service-worker.js `node --check` clean.
ISC-34 xlsx also re-validated on disk: 4 sheets, `xl/workbook.xml` (`unzip -l`).

**Inspection-verified (no headless probe possible/needed):** ISC-4,8 (Turn-over hooks + drawer/templates , 
ported verbatim from the 16/16-verified prototype, jsdom render clean); ISC-11,17,25,29,31
(manifest link/theme meta; update-toast wiring; persist() request; auto-backup-before-migrate guard;
JSON round-trip logic).

**Live deploy (ISC-40, FU-2 closed):** Deployed 2026-06-09 to `https://harryf.github.io/technicolour-planner/`.
Live curl: real title/brand, `noindex` meta present, manifest link + SW registration present, old
placeholder text gone, onboarding markup live. All 8 shell resources HTTP 200 (manifest, SW, 2 icons,
src/export.js, 3 vendor libs). manifest valid (display:standalone, 3 icons). GitHub Release `v1.0.0` cut.

**FU-1 closed (2026-06-09):** Harry ran the fresh-install test and confirmed the File System Access
flow: install, pick folder, write data, and (v1.0.4) re-pick an existing folder loads it instead of
overwriting. ISC-20/21/22 now [x]. No deferred criteria remain.

**v1.0.4–1.0.5 (test suite, install UX):**
- ISC-45/46/47/48: the committed suite passes **49/49** (37 jsdom unit + 12 real-Chrome). Browser
  layer proves: SW cache shellCached + controller, board renders, exactly 1 load (no flash), gate
  dormant on localhost, `.gbox` computes `display:block` (collision regression), all 3 exports valid
  OOXML zips, **true offline reload renders from cache** (CDP network offline), and an installed
  device shows "Open the App". Unit layer proves the existing-folder load (mocked picker) and the
  install relabel. `bun run test` + CI workflow `.github/workflows/tests.yml`.

**v1.0.1 (deployed 2026-06-09), live-probed on `harryf.github.io`:**
- ISC-42 (flash fixed): reproduced first (DevTools: 2 navigations on v1.0.0); after fix, **exactly 1
  load event** on the live site. Root cause was the SW `clients.claim()` first-load `controllerchange`
  reloading; now guarded behind `window.__acceptedUpdate`.
- ISC-43 (install gate): live on `harryf.github.io` → `gateActive:true, gateOpen:true, gateVisible:true`;
  on localhost → `gateActive:false` (dev usable). Screenshot `/tmp/tcv/live-gate.png` shows the frosted
  overlay blurring the planner with the install card on top.
- ISC-44 (install): `installBtnExists:true`; `beforeinstallprompt` wired; Mac/Windows steps rendered.
- jsdom regression 27/27 after the changes (matchMedia guarded for jsdom).

**v1.1.0 (storage location, folder images, WhatsApp feedback):** full suite **66/66** (50 jsdom unit +
13 real-Chrome + 3 upgrade) via `node tests/run.mjs`.
- ISC-52/53: jsdom asserts `#dataLocation.onclick` is a function and the source wires `chooseLocation`;
  label format `st.name+"/"+JSON_NAME` present.
- ISC-54: jsdom mock dir handle, `writeFileTo(dir,name,File)` captured a write of `…image-p1-….png`
  to the folder (not inline). ISC-55: `imageSrcFor({image:'data:…'})` returns the data URL (fallback).
- ISC-56: `imageSrcFor`/`prewarmImages`/`imageNameFor`/`deleteImageFile` all defined; board + drawer
  read through `imageSrcFor`. ISC-57: remove path clears refs + `removeEntry` (source-verified).
- ISC-58: `FEEDBACK_WHATSAPP==="41796476540"`, `wa.me` present, **no `mailto:` anywhere** in the app.
- ISC-59: attach/remove wrapped in try/catch + `perm()` guards (source). ISC-60: image filename does
  not match `^Technicolour-Planner-(backup|checkpoint)-.*\.json$` (asserted), so prune never deletes it.
- Real-Chrome confirms the bump landed cleanly: `caches.keys()` → `["technicolour-v1.1.0"]`,
  controller+registration true, board 7 cols / 6 cards, all 3 exports valid zips, true offline reload,
  exactly 1 load (no flash). Upgrade test green (cross-version load).

**v1.1.1 (folder-only footer, images subfolder):** full suite **68/68** via `node tests/run.mjs`.
- ISC-61: jsdom asserts the footer label source is `el.textContent="📁 "+st.name;` and the old
  `st.name+"/"+JSON_NAME` form is gone.
- ISC-62: `getImagesDir` defined, `IMG_DIR==="images"`, source writes `writeFileTo(idir, name, f)` after
  `getDirectoryHandle(IMG_DIR,{create})`; `readImageHandle` checks `getImagesDir(false)` then root
  (legacy fallback). Real-Chrome layer green at the new version (cache rolled, board renders, exports OK).

**v1.1.2 (title, maximize, filter controls):** full suite **75/75** via `node tests/run.mjs`.
- ISC-63: unit asserts `manifest.name === <title>` (both `🌈 Sarah's Amazing Technicolour Planner`).
  Installed-window render is DEFERRED-VERIFY (FU-3, Harry reopens).
- ISC-64: `maximizeWindow` defined, called in `boot()`, `resizeTo(screen.availWidth,…)` present (source).
  Live window resize is DEFERRED-VERIFY (FU-3).
- ISC-65: jsdom drives `clearFilters()` → `#clearFilter.disabled===true`; `toggleFilter('discovery')` →
  `disabled===false`. ISC-66: same for `#filterMode`, plus checked-state resets to false + disabled on clear.

**v1.2.0 (roll the week over, work-days, French removed):** full suite **86/86** (70 jsdom + 13
real-Chrome + 3 upgrade) via `node tests/run.mjs`, plus a real-Chrome probe (`/tmp/probe120.mjs`,
screenshot `/tmp/tcv-120-board.png`).
- ISC-67: jsdom asserts no `data-lang`/`DOW_FR`/`Français`. ISC-68: 7 `#workdays` toggles render.
- ISC-69: `migrateState({schemaVersion:1,…})` → `schemaVersion===2`, `workdays.length===7`, `workdays[5]===false`.
- ISC-70: with a day off set, `#board .day.dayoff` ≥1 and `#board .nopost` ≥1; 7 columns always present.
- ISC-71/73: pushing a piece dated `2026-01-01` unposted → in `overduePieces()`; setting `stages.posted`
  removes it. ISC-72: with Monday off, `rollToWeek(p,nextWeekStart())` → date `2026-06-16` (Tue, Monday
  skipped), `isWorkday` true, `>= nextWeekStart()`. ISC-74: empty tray text matches `All caught up`.
- ISC-75: `#board .card .rollbtn` ≥1 (real-Chrome probe: 6). ISC-76: drawer source has
  `firstWorkday(nextWeekStart(), TODAY)`. ISC-77: `#libFilter` has 3 `[data-status]` buttons.
- **Real-Chrome probe** (authoritative for the user-facing tray): tray reads "Still to do (1), from
  earlier, not posted yet" with 1 row; 2 greyed days-off (Mon+Sat) + 1 "NO POST"; 6 card roll buttons;
  no "Français"; rolling the overdue piece moved it to Tue 2026-06-16 and emptied the tray. Screenshot
  shows greyed hatched Mon/Sat columns, the tray, and "→ next wk" on cards.

**v1.2.2 (friendlier drawer):** full suite **93/93** + real-Chrome screenshots
(`/tmp/tcv-drawer-settled.png`, `/tmp/tcv-bigedit.png`).
- ISC-79: settled drawer measured `width:460` at a 1100px window (clamp floor), flush-right, fully in
  the viewport (left 625, right 1085 incl. scrollbar); clamp gives ⅓ on wider screens. jsdom asserts the
  `clamp(460px,33vw,820px)` rule. ISC-80: jsdom opens a piece → 2 `.biggerbtn`; clicking one opens
  `#bigEdit` with `bigEditArea.value === field value`, then closes; real-Chrome shows the roomy 352px-tall
  editor. ISC-81: `#d-done` is null, `#d-close` text is "✕ Close". ISC-82: 1 `.field2` (Music+Hook);
  real-Chrome scrollHeight 1092 (was 1188).

**v1.2.3 (alignment + picture control):** full suite **100/100** + real-Chrome probe (`/tmp/tcv-align.png`).
- ISC-83: real-Chrome date-row heights `[42,38,38,38]` — the 3 buttons all 38px (input 42 by nature);
  source has `.drawer button{white-space:nowrap}`. ISC-84: Music/Hook input tops equal (702/702);
  drawer width 520 at a 1100px window (clamp floor), 38vw on wider. ISC-85: `select{padding-right:30px}`.
- ISC-86: jsdom — no image → `.addimg` button present, no `.thumbwrap`; with image → `.thumbwrap` has an
  `img` + 2 `.acts button` (📷/🗑); file input is `display:none`. Real-Chrome shows the icons on the image.
  ISC-87: label regex `wide / landscape works best, about 1280 × 720` present.
