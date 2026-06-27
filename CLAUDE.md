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
tests/                  # committed suite: unit.mjs (jsdom) + browser.mjs (Chrome) + upgrade.mjs (SW rollover)
                        #   + upgrade-data.mjs (real v1.3.3 file → current migrateState) + run.mjs + lib/
                        #   + fixtures/v1.3.3-state.json (frozen real v1.3.3 saved state, the migration input)
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
    id, createdAt:<ISO>, updatedAt:<ISO>,                   // per-piece timestamps (v1.4.0) — drive Library sort
    title, type:"reel"|"post"|"story", targets:[...],        // targets ⊆ discovery|authority|conversion|retention
    date:"YYYY-MM-DD"|null, music, hook, desc, notes,
    storyCodes:[1..5], image:<dataURL>|null, imageName:<filename>|null,   // see Images below
    stages:{prep,shot,edited,posted}, tasks:[{id,text,activity,done}]   // activity ∈ brainstorm|shoot|edit|priority|justdo
  } ],
  settings: { lowstim:bool, colors:{<target>:<hex>},        // per-user colour remap
              workdays:[bool x7],                            // Mon..Sun working/posting days (v1.2.0)
              libSort:"recent"|"date"|"colour"|"title",       // remembered Library sort (v1.4.0)
              turnoverTab, turnoverSort,                       // remembered Turn-over sub-tab + sort (v1.5.0)
              boardMode:"week"|"calendar" },                   // remembered Board view (v1.6.0)
  weekStart, schemaVersion, updatedAt   // schemaVersion is 3 since v1.4.0
}
```

`settings.lang` may still exist in old saved data (the FR toggle was removed in v1.2.0); it's ignored,
the board is always English. **Schema is at 3**: migration `1→2` adds `settings.workdays` (default
`[T,T,T,T,T,F,T]`, Sat off); migration `2→3` adds per-piece `createdAt`/`updatedAt` (backfilled from the
existing array order, oldest→newest, via `stampOrder()`, so no piece's relative order is lost). Both
auto-back-up the file before migrating. A piece is "done/out the door" when `stages.posted` is true.

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
- **Checkpoints** (in a `saves/` subfolder since v1.3.2): timestamped
  `Technicolour-Planner-checkpoint-<ISO>.json` copies. `Store.backup()` writes one on demand
  (Settings → "Save a checkpoint now"; downloads if no folder); `Store.checkpoint()` writes one
  silently on app start; `_backupRaw()` writes one before a schema migration. All three route into a
  **`saves/` subfolder** via `getSavesDir(true)` (mirrors `getImagesDir`), with a `|| this.dir` root
  fallback so it never hard-fails. `pruneBackups(savesDir)` keeps the last `MAX_BACKUPS` (20) **inside
  saves/**. `migrateSavesToSubfolder()` runs once on boot to sweep any pre-1.3.2 checkpoints out of the
  folder root into `saves/`, so the main folder holds just the two data files + `images/` + `saves/`.
  Import/Export live in Settings, not the header, because the live JSON + `.md` already mirror every change.
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

## Board calendar view (v1.6.0)

The Board has two modes, chosen by a **View: Week · Calendar** `.seg` (`#boardMode`) in the board
toolbar. The choice persists in `settings.boardMode` (default `"week"`; additive, defaulted in
`migrateState`/`defaultState`, **no schema bump**, still schema 3). `boardMode()` reads it,
`setBoardMode()` writes+saves, `syncBoardMode()` reflects the toggle and shows/hides the right
container. **Gotcha:** `.board` (`display:grid`) and `#weekNav` (`.row`, `display:flex`) set an
explicit `display`, which overrides the `[hidden]` attribute, so `syncBoardMode()` hides them with
`style.display='none'` (not `.hidden`); `#calendar` (plain block) uses `.hidden`. `renderAll()`'s
board branch calls `syncBoardMode()` then renders `renderCalendar()` or `renderBoard()` (catch-up
tray renders in both modes, so overdue pieces are handled either way).

- **Layout:** `#calendar` (`.cal-wrap`, the vertical scroller) wraps `#calInner`. A sticky Mon..Sun
  header (`.cal-dows`, carrying the board's day-hue bars) sits on top; then per-week rows (`.cal-week`,
  a 7-col grid) under month separators (`.cal-month`, e.g. *July 2026*). `.cal-inner{min-width:760px}`
  so it scrolls horizontally on a narrow window rather than squishing.
- **Range (`calendarWeeks()`):** week-start Mondays from the earlier of (this week / earliest dated
  piece) through **one blank week past the latest dated piece** (never earlier than next week), so
  there's always a row to plan into and we never render the whole year. (YYYY-MM-DD strings compare
  lexicographically, so the date maths is plain string compares.)
- **Split weeks shown twice (Sarah's ask):** a week that straddles a month boundary is rendered once
  under **each** month. `renderCalendar()` opens the Monday-side month section and renders the week
  (`calWeekRow(inner, ws, section)`); if the Sunday-side month differs it emits that month's separator
  and renders the **same week again** under it. In each copy, `calWeekRow` greys the days that belong
  to the *other* month as **`.offmonth` "ghost" cells**: the planned pieces still show (so she can see
  what's there) but the cell is **inert** (no `.cal-add`, no drop target) and the ghost cards are
  `draggable=false` + `.ghost` (`pointer-events:none`). `monthOf()`/`sameMonth()` are the helpers.
- **Cards + interaction:** calendar cells use a `mini` `projectCard` variant (`{compact:true,mini:true}`
  → colour stripe + type badge + title only; the `mini` flag skips thumb/meta/stages/rollbtn). Active
  (in-month) cells get a hover-revealed **`＋`** add button and a drop target (`calDropHandlers`,
  identical to the week board's drop: set `p.date`, `touch`, `save`, `renderAll`). Today is outlined,
  non-workdays hatch (`.dayoff`) only on in-month days.

## Library card date (v1.5.2)

`projectCard()` shows the piece's planned date on **Library cards only** (`!compact`, so the Board's
compact cards are unaffected): a `.carddate` span (`📅 ` + friendly `dateLabel()`) appended into the
`.stages` row with `flex-basis:100%`, so it sits on its **own line under** the progress squares,
**left-aligned** (`.stages` is `flex-wrap:wrap`). Only rendered when `p.date` is set; undated cards show nothing.

## Library sort (v1.4.0)

The Library toolbar has a **Filter:**-labelled status seg (`#libFilter`: **To do** · **Posted** · **All**)
and a **Sort:**-labelled sort control (`#libSort`, same `.seg` look) with four options:
**Recent** (default), **Planned**, **Colour**, **A → Z** (button text only — `data-sort` keys are still
`recent/date/colour/title`, so logic + tests are unaffected by the labels). The choice persists in
`settings.libSort` (autism-safe: it sticks across opens), is reflected by `aria-pressed` via
`syncLibSortButtons()`, and is applied by `sortProjects()` reading the `LIB_SORTS` comparator map in
`renderLibrary()`. Every comparator is **fully deterministic** (explicit tiebreaks down to `id`) so the
same data always lays out identically — stable layout matters here. Sort drivers: `_ts(p)` =
`updatedAt||createdAt` ("recently worked on", newest first), `date` (scheduled date asc, undated last),
`colour` (grouped into funnel bands by primary target via `_targetRank()` in `TARGET_ORDER`, then date),
`title` (locale A→Z). `touch(p)` stamps `updatedAt` on every edit — wired into `softSave()` (all drawer
edits, keyed on `openId`), `rollToWeek()`, and the board drag-drop `drop` handler. New/seed pieces get
timestamps at creation (`newProject()` stamps now; `seedProjects()` returns `stampOrder(...)`).

## Turn-over tab (usage index, v1.3.0; sub-tabbed + sortable since v1.5.0)

The Turn-over tab is the **colour-first usage index** for her reference vocabulary (`renderTurnover()`).
Each category renders as `.ucard`s (built by `usageCard()`): a colour swatch + label/desc + a **count
badge** ("3 pieces" / "not used yet"); each row is a `.urow` that opens the editor (`openDetail`).
- **Targets** → pieces having that target. **Story codes** → pieces with that code. **Hooks** → pieces
  whose `p.hook` matches (so unused hooks show "not used yet" + `.zero` dimming, answering "which hooks
  haven't I used"); the hook-type filter chips still narrow the list. **Activities** → *tasks* with that
  activity across all pieces (noun "task"), showing done state.
- **Sub-tabs (v1.5.0):** to kill the long vertical scroll, the four categories are now **sub-tabs**
  (`#turnoverTabs`, `.subtabs` styled like the main `.tabs`) shown one at a time — order **Targets ·
  Activities · Story codes · Hooks** (`#sub-targets/-activities/-story/-hooks` `.subpanel`s; non-active
  ones get `hidden`). The active sub-tab persists in `settings.turnoverTab` (default `"targets"`).
  `renderTurnover()` always renders **all** legends into the DOM (cheap; keeps querySelectors + tests
  simple) and `syncTurnoverControls()` toggles which `.subpanel` is visible + reflects the controls.
- **Sort (v1.5.0):** a shared `.seg` control (`#turnoverSort`) with **Recent** (default),
  **Planned**, **A → Z** (button text only; `data-sort` keys still `recent/date/title`) — *no "Colour"*
  (each card already is a colour). Persisted in
  `settings.turnoverSort`. `sortPiecesT()` reuses the Library `LIB_SORTS` `recent/date/title` comparators
  for piece rows; `sortTasksT()` sorts activity task rows by parent-piece (recent/date) or task text (A→Z).
  **Cards keep their canonical order** (funnel order, code order, etc.) — only the rows inside them sort,
  so the layout stays stable/learnable; only the *contents* reorder.
- **Default-open (v1.5.0):** `usageCard(...,{open:true})` opens every **used** card on render (she sees
  contents without clicking); **zero-use cards stay closed** (so Hooks doesn't explode into ~29 open
  cards — only the ones she's used). Clicking a card header still toggles it within the session.
- **Activity rows (v1.5.0):** `taskUrow()` main label reads **"Project → Task"** — `.tproj` (project,
  muted context, shrinks/ellipsis first) + `.tarrow` ("→", muted) + `.tdesc` (**the task text — the bold
  focus**, `font-weight:700`); `.urow.taskrow .ttl` is a flexbox so a long project name truncates before
  the task does. **Date on the right** long-form via `dateLabel()` (same as the Targets sub-tab, e.g.
  "Sunday 28 Jun (this week)" / "no date"). `✓` prefix + line-through when done; built with DOM nodes
  (no innerHTML — titles/tasks are user data). Replaces the old task-text-only label + "✓ done · project".
- **Target filter (v1.5.1):** the global "Show me:" chips / balance bar (`activeFilters` + `filterHide`)
  now apply to Turn-over too, the same way as Board/Library. `matchesFilter(p)` mirrors `projectCard`'s
  raw `p.targets.some(...)`; `applyRowFilter(row,piece)` dims (`.urow.dim`) or hides non-matching rows,
  and `applyCardFilter(card,pieces)` dims/hides (`.ucard.dim`) a card whose pieces none match. Wired in
  `pieceUrow`/`taskUrow` (rows) and `renderTurnover`/`renderTurnoverHooks` (cards). `renderAll()` already
  re-renders Turn-over on filter change, so the chips, balance bar, `1`–`4` keys and Esc all work there.
- Zero-use cards get `.zero` (dimmed, no expand). `renderHookList()` is untouched (still powers the
  hook-picker modal). Both new settings (`turnoverTab`, `turnoverSort`) are **additive** — defaulted in
  `migrateState`/`defaultState`, **no schema bump** (still schema 3).
- **"+ New" is disabled on this tab** (`setView` sets `#newBtn.disabled` when `v==="turnover"`) — you
  can't create a piece here; add from Board/Library. `button:disabled{opacity:.45}`.

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
  - **Upgrade — SW rollover** (`tests/upgrade.mjs`, real Chrome): a "deployed" new version must fully
    replace the cached old page (guards the two historic "stuck on old version" bugs).
  - **Upgrade — data migration** (`tests/upgrade-data.mjs`, jsdom): runs the **real saved state of the
    previous release** (`tests/fixtures/v1.3.3-state.json`, captured from the `v1.3.3` tag) through the
    current `migrateState`, plus a live boot from pre-seeded `localStorage`. Asserts no data loss, order
    preserved, settings kept, idempotency. **On every schema bump, recapture a fixture from the prior
    tag and add a `<prev>→<new>` case** so each release proves it upgrades the version users actually run.
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
- **Detail drawer (the piece editor), built by `openDetail()`** (v1.2.2): `.drawer` is
  `width:clamp(460px,33vw,820px)` (≈⅓ of a wide screen). It slides in via `transform` (the closed state
  is `translateX(100%)`, so measuring it before the transition settles reads as off-screen, that's the
  animation, not a bug). Long-text fields use `expandableField()` (a labelled **"⤢ Bigger"** button, no
  magnifying-glass metaphor) which opens `#bigEdit`, a roomy full-height editor overlaid on top, synced
  live to the inline textarea. Music + Hook share a `.field2` 2-col row to cut scrolling. The header has
  one clear **"✕ Close"**; there is deliberately **no "Done" button** (it confused with "Posted").
  v1.2.3 alignment: drawer widened to `clamp(520px,38vw,900px)`; `.drawer button{white-space:nowrap}` so
  buttons never wrap to two lines (kept the date row + hook "pick" at one consistent height);
  `.drawer .row>input{flex:1}` lets the text/date input grow while buttons keep natural width;
  `select{padding-right:30px}` gives the task activity dropdown arrow room. **Image control** (v1.2.3):
  when a piece has a picture, `openDetail` renders `.thumbwrap` (the image with on-image 📷 change + 🗑
  remove icon buttons) driving a hidden file input; with no picture it shows a "🖼 Add a picture" button.
  The Image field label states wide/landscape (~1280×720) is ideal, since the thumb is `object-fit:cover`.
  **Date hint** (v1.2.4): under the date picker, a `.datehint` shows `dateLabel(p.date)`, a plain-language
  reading like "Tuesday 9 Jun (this week)" / "(next week)" / "(today)" / "(N weeks ago/in N weeks)",
  refreshed on every date change (most people don't read raw dates). No date → a gentle "No date yet" note.
  **Week heading** (v1.3.3): `#weekLabel` is prefixed by `weekPrefix(state.weekStart)` ("This week" /
  "Next week" / "Last week" / "N weeks from now" / "N weeks ago") and the range reads in Swiss dotted form
  "8.6 to 14.6.2026" (the word "to", no slash, no dash). The same dotted `d.m` date format is used on the
  day-column headers (`.dt`) and the card date badge, so all three stay consistent. Sarah is in Lausanne,
  dd.mm with dots is the local convention.
- **Settings dialog (v1.3.1)** is grouped into four calm `.set-group` sections (Look & feel · My week ·
  My data · Export a copy) inside `.settings-box` (sticky `.set-head` + scrolling `.set-body`). It's a
  presentation regroup only, every wired control keeps its ID (`lowstim`, `workdays`, `colorRemap`,
  `dataStatus`, `setLocationBtn`, `backupNowBtn`, `importBtn`, `exportBtn`, `persistStatus`,
  `xlsxBtn/docxBtn/pptxBtn`); `buildSettings()` still fills `workdays` + `colorRemap`.
- **Calm mode (`body.lowstim`, meaningful since v1.3.2)** is a real reduction in stimulation, *not* a
  removal of colour, the whole app is colour-first, so the rule **pastel-shifts** (`filter:saturate(.7)
  brightness(1.02)`, hues kept and still distinct) rather than desaturating to grey. It also kills all
  motion (`body.lowstim *{transition:none!important;animation:none!important}`), drops shadows
  (`box-shadow:none!important`), removes the button hover-flash, and softens chrome/focus. A separate
  `@media (prefers-reduced-motion: reduce)` block kills motion for everyone regardless of the toggle.
  Guardrail: when touching calm mode, keep colours legible (never `saturate(0)`); the unit suite asserts
  the motion-kill, the pastel filter, the no-shadow/no-hover-flash, the media query, and the toggle wiring.
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
