# CLAUDE.md, 🌈 Sarah's Amazing Technicolour Planner

> **Keep this file current.** Whenever you make a *significant* change to how the project is
> structured, built, stored, or deployed, a new top-level file, a changed storage/data model, a
> new build/deploy step, a schema bump, a dependency added/removed, **update this CLAUDE.md in the
> same change** so the next session starts from the truth. If you only edited content/copy or fixed
> a small bug, you don't need to touch it. When in doubt, update it.

## What this is

A **colour-first content planner** for Sarah, a tattoo artist building an Instagram presence who
**thinks in colour** and has autism, so the UI is predictable, low-surprise, colour-as-primary,
with redundant text labels. It's an **installable, offline-capable PWA**. Her data lives in a
**plain file she owns**, never on a server.

- **Live:** https://harryf.github.io/technicolour-planner/  (public repo, `noindex` for now)
- **System of record:** [`ISA.md`](ISA.md), ideal-state criteria + verification evidence. Read it
  to understand *why* things are the way they are; update it when criteria change.
- **Build plan / history:** [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).
- **Intent (how Sarah thinks):** `../docs/ANALYSIS.md` (parent folder, **not** in this repo).
- **Original prototype (design spec):** `../approach-2-app/index.html` (parent folder).

## Core principle: buildless

There is **no bundler, no build step, no framework**. The app is plain HTML/CSS/JS. "Deploy" =
publish the static files. Keep it that way unless there's a compelling reason, simplicity is the
feature. Tooling/verification scripts use **bun + TypeScript** (never npm/Python).

## File structure

```
index.html              # THE APP, single file: inline CSS + all JS (UI, data model, Store, boot)
manifest.webmanifest    # PWA manifest (name, icons, display:standalone, start_url ".", scope ".")
service-worker.js       # precache shell + export libs, cache-first, auto-update on next open
icons/                  # icon-192.png, icon-512.png, icon-maskable-512.png (generated PNGs)
src/export.js           # ES module, exportXlsx/exportDocx/exportPptx (lazy-loaded on demand)
vendor/                 # UMD builds, lazy-loaded by src/export.js:
                        #   exceljs.min.js (window.ExcelJS), docx.umd.js (window.docx),
                        #   pptxgen.bundle.js (window.PptxGenJS)
.github/workflows/      # deploy.yml (Pages) + release.yml (GitHub Release on tag)
ISA.md                  # system of record (criteria + verification)
IMPLEMENTATION_PLAN.md  # the build plan
README.md               # Sarah-facing + dev notes
CHANGELOG.md            # per-release "what's new" (feeds the in-app version-badge text)
FEATURES.md             # feature/bug backlog, the Sarah → Harry → us → ship loop
robots.txt              # non-authoritative on a Pages subpath; the noindex META is the real control
tests/                  # committed test suite: unit.mjs (jsdom) + browser.mjs (Chrome) + run.mjs + lib/
package.json            # dev-only: the `test` scripts + jsdom devDependency (the app stays buildless)
```

`.gitignore` excludes Sarah's runtime data, **never commit** `*-Data.json`, `*-Data.md`,
`*-backup-*.json`, or the stray `${HOME}/` dir a PAI hook sometimes writes (purge with
`rm -rf '${HOME}'` if it reappears).

## Data model

`state` (one object, persisted as JSON):

```js
state = {
  projects: [ {
    id, title, type:"reel"|"post"|"story", targets:[...],   // targets ⊆ discovery|authority|conversion|retention
    date:"YYYY-MM-DD"|null, music, hook, desc, notes,
    storyCodes:[1..5], image:<dataURL>|null, imageName:<filename>|null,   // see Images below
    stages:{prep,shot,edited,posted}, tasks:[{id,text,activity,done}]   // activity ∈ brainstorm|shoot|edit|priority|justdo
  } ],
  settings: { lowstim:bool, colors:{<target>:<hex>},        // per-user colour remap
              workdays:[bool x7] },                          // Mon..Sun working/posting days (v1.2.0)
  weekStart, schemaVersion, updatedAt   // schemaVersion is 2 since v1.2.0
}
```

`settings.lang` may still exist in old saved data (the FR toggle was removed in v1.2.0); it's ignored,
the board is always English. **Schema is at 2**: migration `1→2` adds `settings.workdays` (default
`[T,T,T,T,T,F,T]`, Sat off) and auto-backs-up the file before migrating. A piece is "done/out the door"
when `stages.posted` is true.

**Two independent colour languages, keep them separate, never let them collide:**
- **type colour** (reel/post/story) + **target colour** (the 4-funnel stripes), describe the piece.
- **activity colour** (brainstorm/shoot/edit/priority/justdo), describes a *task inside* a piece.

The colour/label constants (`TARGETS`, `TYPES`, `ACTIVITIES`, `STORY_CODES`, `HOOKS`) are defined
near the top of `index.html`. If you change a colour or label, mirror it in `src/export.js`
(it re-declares the same model so the Office exports match the app).

## Storage model (the careful part)

Three tiers, owned by the `Store` object in `index.html`:

1. **Source of truth = a file Sarah picks** via the File System Access API (`showDirectoryPicker`).
   The directory handle is persisted in **IndexedDB**; data is written to
   `Technicolour-Planner-Data.json` + a human-readable `Technicolour-Planner-Data.md` mirror.
2. **IndexedDB snapshot**, instant cache + holds the handle.
3. **localStorage**, last-ditch fallback (also the no-File-System-Access-browser path).

Key behaviours (don't regress these):
- **First run** → onboarding modal asks where to store data; "Decide later" → localStorage-only +
  a dismissible reminder banner. The app must **never hard-fail** if she skips it or uses a
  non-Chromium browser.
- **Permission lapses** after a browser restart (handles don't keep permission) → a one-click
  **"Reconnect"** banner; re-grant must happen inside the click (user gesture required).
- **Reconnect is conflict-aware**: `updatedAt` decides, keep the newer of (in-memory cache) vs
  (file), then write the winner back. Don't blindly reload the file over session edits.
- **Schema migrations**: bump `CURRENT_SCHEMA`, add a `migrations[fromVersion]` fn. The loader
  **auto-backs-up the file before migrating**.
- **Checkpoints**: timestamped `Technicolour-Planner-checkpoint-<ISO>.json` copies in the folder.
  `Store.backup()` writes one on demand (Settings → "Save a checkpoint now"; downloads if no folder);
  `Store.checkpoint()` writes one silently on app start (only if a folder is connected and permission
  is already granted). `pruneBackups()` keeps the last `MAX_BACKUPS` (20). Import/Export live in
  Settings, not the header, because the live JSON + `.md` already mirror every change.
- **Images** (v1.1.0, subfolder since v1.1.1): when a folder is connected, attaching a picture writes a
  copy into an **`images/` subfolder** of the data folder (`getImagesDir(true)` →
  `getDirectoryHandle("images",{create:true})`) as `Technicolour-Planner-image-<projectId>-<ISO>.<ext>`,
  and stores **only the filename** in `imageName` (JSON stays small, picture is a real file she owns,
  main folder stays tidy). With no folder, it falls back to the inline `image` data URL.
  `IMG_CACHE[projectId]` holds an object URL read back from disk so render stays synchronous;
  `prewarmImages()` fills it at boot / after reconnect / after a folder change, via `readImageHandle()`
  which checks `images/` first then the folder root (back-compat with v1.1.0 images written to root).
  `imageSrcFor(p)` (cache → inline data URL → none) is the single source for board + drawer thumbnails.
  Removing clears both refs and `removeEntry`s the file (subfolder, then root).
- **Footer storage location** (v1.1.0, folder-only label since v1.1.1): the footer `#dataLocation` shows
  `📁 <folder>` (just the folder name) and is clickable to change (or set) the folder via the shared
  `chooseLocation()` (same flow as Settings). Browsers don't expose a folder's absolute OS path to a web
  app, so the folder name is the deepest identifier available, this is a platform limit, not a TODO.

## Rolling work forward + work-day preferences (v1.2.0)

Grounded in `ANALYSIS.md` (autism: predictable, low-surprise, nothing relies on memory, stable layout,
never lose data). The unit that rolls is a **piece** (it owns the `date`), not a loose task.

- **Work-day preferences:** `settings.workdays` (7 bools, Mon..Sun). Settings shows 7 toggles
  (`#workdays`). `workdays()` reads them with a safe default. A board day with `workdays[i]===false`
  gets `.day.dayoff` (greyed, hatched) and shows "NO POST" when empty, this **generalises** the old
  hard-coded Saturday rule. **All 7 days always render** (stable grid), days off are never hidden.
- **Catch-up tray (`#catchup`, `renderCatchup()`):** a pinned strip above the board. `isOverdue(p)` =
  `p.date < curWeekStart() && !stages.posted`; `overduePieces()` lists them oldest-first. Each row has
  one tap: **→ this week** / **→ next week** (`rollToWeek`) / **✓ posted** / open. Empty → "All caught
  up ✓". **Nothing moves automatically**, this is the autism-safe contract (no surprises on open).
- **Quick reschedule:** `rollToWeek(p, weekStart)` sets the date to `firstWorkday(weekStart, notBefore)`,
  the first **working** day of that week (skips days off), never before today. Wired to the per-card
  `.rollbtn` ("→ next wk"), the drawer's **today** / **→ next week** buttons, and the tray. Drag-drop stays.
- **History:** nothing is deleted. Library has a status filter ordered **Still to do · Posted · All**
  (`libStatus`, default `"todo"`, `#libFilter`) so she lands on what's left; posted past pieces live
  there, not in the tray.

## Install gate (browser tab vs installed app)

The app is meant to run as the **installed PWA**, not a public browser tab. `isStandalone()`
(`display-mode: standalone`/minimal-ui/window-controls-overlay, or iOS `navigator.standalone`)
decides. When **not** standalone **and** not localhost dev (`gateActive()`), a frosted overlay
(`#installGate`) covers the UI with install instructions + a one-click install button (wired via
`beforeinstallprompt`); `boot()` returns early so prompts/onboarding don't fire behind it. Installed
app or `localhost`/`127.0.0.1`/`file:` → no gate. Don't show Sarah's data in a public browser tab.

**Window title (v1.1.2):** the installed PWA window shows `{manifest name} - {document.title}`; if those
differ the app name appears twice. Keep the manifest `name` **identical** to the `<title>` (both
`🌈 Sarah's Amazing Technicolour Planner`) so it shows once. A unit test asserts `manifest.name === <title>`.

**Maximize on open (v1.1.2):** `maximizeWindow()` (called first in `boot()`) does
`moveTo(0,0)`+`resizeTo(screen.availWidth, screen.availHeight)` when `isStandalone()`. Best-effort, browsers
may ignore it for security; it's a no-op in a tab and wrapped in try/catch.

**Filter controls (v1.1.2):** `renderAll()` greys out `#clearFilter` (`disabled`+`.disabled`) when
`activeFilters` is empty, and disables `#filterMode` ("hide non-matching") + unticks it until a colour
filter is active. `.pill.disabled,.pill:disabled` sets `opacity:.4;pointer-events:none`.

If the app is already installed on the device (tracked by a `localStorage` "installed" flag set when
it runs standalone, plus `navigator.getInstalledRelatedApps()`), the gate's button switches from
"Install the app" to "Open the App" via `setGateMode()`. Browsers can't launch an installed PWA from
a tab, so that button shows a short "open it from your Desktop" note; it does not auto-launch.

Note: updates are automatic. The service worker calls `skipWaiting()` on install and `clients.claim()`
on activate, and **precaches the shell with `cache: "reload"`** so it never caches a stale page from
the browser's HTTP cache (GitHub Pages serves with `max-age=600`). The page registers with
`updateViaCache: "none"` and calls `reg.update()` at launch, on `visibilitychange`, and hourly. It
reloads once on `controllerchange`, ignoring only the **first** one (the initial claim of an
uncontrolled page) via `firstControllerSeen`, so the first open never flashes but every later update
reloads. There is no manual update prompt. These three pieces (reload-precache, updateViaCache:none,
firstControllerSeen) are what make updates actually land; the upgrade test (`tests/upgrade.mjs`)
guards them. Two earlier "stuck on old version" bugs came from getting this wrong.

## Icons

PNGs generated by a dependency-free `node:zlib` script (the four target colours as stripes; the
maskable one is full-bleed). The generator isn't committed; to regenerate, write a small bun/TS
script that emits 8-bit RGBA PNGs at 192/512/512 into `icons/` (see git history / `ISA.md` if you
need the exact approach). If you change the brand mark, regenerate all three.

## Build, verify, deploy

- **Run locally:** serve the folder with any static server, e.g. `python3 -m http.server 8731`,
  then open `http://127.0.0.1:8731/`. (Service worker + File System Access need `http`/`https`, not
  `file://`.)
- **Verify:** committed test suite in `tests/`. Run `bun install` once, then `bun run test` (full),
  `bun run test:unit` (jsdom only), or `bun run test:browser` (Chrome only). It runs under **Node**,
  not Bun (Bun's jsdom hits a Proxy error); `bun run` just launches the npm scripts, which call `node`.
  - **jsdom unit tests** (`tests/unit.mjs`): render, seed, Store, schema migration, markdown mirror,
    onboarding, the `.gbox` gate collision regression, the existing-folder load (mocked picker),
    install detection, and the "Open the App" relabel.
  - **Real-Chrome integration** (`tests/browser.mjs`, DevTools Protocol): serves the repo's parent so
    the app runs at the real `/technicolour-planner/` subpath, then checks the service-worker cache,
    true offline reload, the three Office exports (valid OOXML zips), no first-load flash, and the
    install relabel. Skips cleanly if no Chrome (set `CHROME_PATH`). CI runs it on push and PR
    (`.github/workflows/tests.yml`). **When you add a behaviour, add a test.**
- **Deploy:** GitHub Pages via `.github/workflows/deploy.yml` (fires on push to `main` and on `v*`
  tags). `release.yml` cuts a GitHub Release on a `v*` tag. All asset paths are **relative** so the
  app works on the Pages subpath, keep them relative.

### Release ritual

1. Bump the version in **two** places: `VERSION` in `index.html` **and** `CACHE`/`VERSION` in
   `service-worker.js` (they must match, the SW cache name is how updates roll over).
2. Add a `CHANGELOG.md` entry (its text feeds the in-app "what's new").
3. Commit → `git tag vX.Y.Z` → `git push origin main --tags`.
4. Pages redeploys; Sarah's installed PWA shows the "new version, reload" toast next open.

## Conventions & guardrails

- **Don't redesign the UI.** This is Sarah's loved prototype, hardened. Preserve the colour-first
  board / library / turn-over UX and the seeded-with-her-real-world content.
- **Relative paths only** (Pages subpath). **Colour model in sync** across `index.html` ↔
  `src/export.js`. **No runtime network calls** after install (export libs are vendored).
- **Privacy:** the repo is public and currently ships Sarah's real seed data with a `noindex` meta
  (Harry's v1 call). A scrub (neutralise docs, dummy seed data, possibly fresh repo) is tracked in
  `FEATURES.md`, do it before any wider sharing.
- **Feedback loop:** requests/bugs land in `FEATURES.md` (Sarah → Harry → here → ship). The in-app
  "Send feedback" button opens a WhatsApp chat to Harry (`wa.me/<FEEDBACK_WHATSAPP>`) with a starter
  message (was a `mailto:` before v1.1.0).
- This repo is **not** in PAI's `checkpoint-repos.txt`, commits here are deliberate, never
  auto-committed.

## Where to start a new session

1. Read this file, then `ISA.md` (criteria + what's verified) and `CHANGELOG.md` (recent state).
2. For a bug: reproduce in real Chrome first (open the live URL or a local serve), check console +
   network, *then* read code.
3. For a feature: check `FEATURES.md`, implement in `index.html` (and `src/export.js` if it touches
   the colour model or exports), verify with both harnesses, bump version, follow the release ritual.
