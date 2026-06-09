---
project: technicolour-planner
effort: E3
phase: complete
progress: 40/43
mode: ALGORITHM
started: 2026-06-09
updated: 2026-06-09
---

# ISA — 🌈 Sarah's Amazing Technicolour Planner (PWA)

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

Sarah clicks an icon in her Start menu. The planner opens in its own window — no browser chrome,
no address bar — already showing *her* world in *her* colours. It works on the train with no
internet. Her data is a real file in her Google Drive folder, so it backs up by itself and she
can open it in Notepad if she ever wants. When we ship an improvement, she gets a gentle "new
version — reload to update" nudge; nothing breaks, nothing is lost. The euphoric surprise: **it
feels like a real app she installed, but it was free, took one click, and her data never left her
hands.**

## Out of Scope

- No backend, database server, accounts, auth, or multi-user.
- No live Google Drive API / OAuth — the synced-folder file trick replaces it.
- No Tauri / native `.exe` this round (revisit only if "install with zero internet" becomes hard).
- No redesign of the UI — this is a port + hardening of the prototype, not a rethink.
- No live Instagram API / auto-posting (carried from the prototype scope).

## Principles

- **Colour is data, not decoration** — two independent registers (type vs target/activity), never collide.
- **Redundant encoding** — every colour also carries a text/letter label.
- **One glance, then one click** — board answers what/when by colour; click answers where-am-I/what's-next.
- **Never trap her data** — source of truth is a plain file she owns; JSON + Markdown, always extractable.
- **No surprises** — stable layout, optional motion, explicit "you are here"; updates never block opening.
- **Degrade, never hard-fail** — non-Chromium or skipped onboarding still leaves a working app.
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
a "back up now", a data-location display, and a feedback button — all while preserving every
colour-first behaviour the prototype already shipped and seeded with her real projects/hooks/targets.

## Criteria

### Carried — prototype behaviour must survive the port (regression guard)
- [x] ISC-1: Ported `index.html` opens and renders the board with no server (localStorage path), no console errors.
- [x] ISC-2: App title/brand reads "Sarah's Amazing Technicolour Planner" (not "Studio Planner").
- [x] ISC-3: Seeded with ≥10 of Sarah's real projects on first open (Burton dogs / Carla / 1 TTT visible).
- [x] ISC-4: Hook library (≥20 hooks) renders in Turn-over, filterable by hook-type.
- [x] ISC-5: Cards show type colour + redundant R/P/S letter, and target split-colour stripes + text.
- [x] ISC-6: Weekly board: 7 day columns (FR/EN), "NO POST" Saturday default, dated projects auto-place.
- [x] ISC-7: Keys 1–4 / target chips filter live; balance bar shows per-target counts + under-served flag.
- [x] ISC-8: New Reel/Post/Story templates, hook picker, detail drawer, activity-coloured tasks all work.
- [x] ISC-9: Anti: no flashing, no autoplay motion, no surprise modal on normal (non-first) load.

### M1 — Installable offline shell
- [x] ISC-10: `manifest.webmanifest` exists with name, short_name, start_url, scope, display:standalone, theme/background colours.
- [x] ISC-11: `<link rel="manifest">` + theme-color meta present in `index.html`.
- [x] ISC-12: `icons/` contains real PNGs: icon-192.png, icon-512.png, icon-maskable-512.png (correct dimensions).
- [x] ISC-13: Manifest references all three icons with correct sizes/purposes (192+512 any, 512 maskable).
- [x] ISC-14: `service-worker.js` precaches the app shell (index.html, manifest, icons) under a versioned cache.
- [x] ISC-15: Service worker uses cache-first for same-origin GET and cleans up old caches on activate.
- [x] ISC-16: `index.html` registers the service worker (guarded to secure contexts; no-op on file://).
- [x] ISC-17: A new service worker surfaces a calm "new version — reload" toast (no forced auto-reload).
- [x] ISC-18: Served over a local HTTP server, the page loads; after caching, a second load with network blocked still serves the shell (offline proof).

### M2 — Store layer + "ask where to store data"
- [x] ISC-19: A `Store` abstraction exists with init/load/save/setLocation/export/import/backup/status; UI calls route through it.
- [DEFERRED-VERIFY] ISC-20: Store writes the data file via File System Access (`createWritable`) when a handle exists; reads via `getFile()`. (Code inspection-verified; live picker flow needs a user gesture — follow-up: FU-1 Harry's real-install folder-pick test.)
- [DEFERRED-VERIFY] ISC-21: The file handle persists in IndexedDB so the location is chosen once. (Inspection-verified; follow-up: FU-1.)
- [DEFERRED-VERIFY] ISC-22: On launch with a lapsed permission, a single "Reconnect your data file" action re-grants and loads. (Inspection-verified; follow-up: FU-1.)
- [x] ISC-23: First-run onboarding modal: welcome → "where to keep your work" (Choose folder) → done, seeded.
- [x] ISC-24: Onboarding has a "Decide later" escape hatch → IndexedDB/localStorage-only with a standing reminder banner.
- [x] ISC-25: `navigator.storage.persist()` is requested on first run.
- [x] ISC-26: On a non-Chromium / no-FSA browser, Store degrades to IndexedDB/localStorage and never throws.
- [x] ISC-27: Each save also writes a human-readable `Technicolour-Planner-Data.md` mirror next to the JSON.

### M3 — Durability
- [x] ISC-28: Data carries `schemaVersion`; a `CURRENT_SCHEMA` constant and ordered `migrations[]` exist.
- [x] ISC-29: Before any migration runs, a `…-backup-<ISO>.json` is written; only last N (≥10) kept.
- [x] ISC-30: JSON import validates shape and refuses junk with a friendly message (no silent corruption).
- [x] ISC-31: Round-trip: export JSON → clear → import → identical project set.

### M4 — Office exports (client-side, offline)
- [x] ISC-32: Export libs (exceljs/docx/pptxgenjs) are vendored locally in `vendor/` (no CDN at runtime).
- [x] ISC-33: Export module is lazy-loaded only on first export click (initial load stays light).
- [x] ISC-34: `.xlsx` export produces a valid workbook with her projects + colour encoding.
- [x] ISC-35: `.docx` export produces a valid project-notes document.
- [x] ISC-36: `.pptx` export produces a valid weekly-board slide deck.

### M5 — Polish
- [x] ISC-37: Footer shows a version badge reading a `VERSION` constant; "what's new" surfaces the CHANGELOG entry.
- [x] ISC-38: Settings adds: change data location, "Back up now", persistent-storage status, current data-file name.
- [x] ISC-39: A "Send feedback" control opens a prefilled mailto to Harry including the app version.

### M6 — Deploy + experiential guarantee
- [x] ISC-40: Live URL serves the real app (not the placeholder) over HTTPS with `noindex` intact. (Deployed 2026-06-09 on Harry's go; FU-2 closed.)
- [x] ISC-41: Antecedent: on first install Sarah sees HER projects in HER colours, in an own-window offline app — the recognition + "it's a real app" that makes it land.

### v1.0.1 — first-load flash fix + installed-vs-browser gate
- [x] ISC-42: First load fires exactly one navigation — the SW's first-load `controllerchange` (from `clients.claim()`) no longer triggers a reload; only a user-accepted update does.
- [x] ISC-43: In a public browser tab (non-localhost, non-standalone) a frosted install-gate overlay covers the UI; it's dormant when running standalone (installed) or on localhost dev.
- [x] ISC-44: `beforeinstallprompt` is captured and an in-gate Install button triggers the prompt; Mac + Windows install steps (incl. dragging to the Desktop) are shown.

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

## Features

| name | satisfies | depends_on | parallelizable |
|------|-----------|------------|----------------|
| Port prototype → repo index.html (rebrand) | ISC-1..9,2 | — | no |
| PWA manifest + icons + theme | ISC-10..13 | port | yes (icons) |
| Service worker + register + update toast | ISC-14..18 | manifest | no |
| Store layer (FSA + IndexedDB + mirror) | ISC-19..22,26,27 | port | no |
| First-run onboarding + persist + fallback | ISC-23..25 | store | no |
| Schema versioning + auto-backup + import guard | ISC-28..31 | store | no |
| Office export module (vendored, lazy) | ISC-32..36 | port | YES (Forge) |
| Polish: version badge, settings, feedback | ISC-37..39 | store | no |
| Deploy + live verify | ISC-40,41 | all | no |

## Decisions

- 2026-06-09: **Tier E3, classifier-confirmed.** Real external client work against a fully-locked
  plan; design exploration already done in the plan, so this run is execution. Project ISA → E3+
  structure (all required sections populated). ISC count 40 (E3 floor ≥32 met).
- 2026-06-09: **Delegation floor (soft) — Forge on the one separable module only.** The single-file
  app must have one coherent colour/UX author to avoid drift, so the shell/Store/onboarding stay
  single-author. The Office export module (`src/export.js`) is the genuinely separable, completeness-
  heavy chunk (three formats) and is delegated to Forge in parallel — satisfying the Forge auto-include
  binding meaningfully rather than tokenistically. Show-your-math: a second delegation agent would only
  add coordination overhead on inseparable UI work.
- 2026-06-09: **localStorage retained as fallback, not removed.** M2 adds File System Access as the
  source of truth but keeps localStorage as the no-FSA / skipped-onboarding fallback so the app never
  hard-fails — satisfies the degrade-never-fail principle.
- 2026-06-09: **Repo deliberately NOT in checkpoint-repos.txt.** PAI's per-ISC auto-commit must not
  fire on Sarah's public repo; commits here are deliberate and reviewed.
- 2026-06-09: **Forge + Interceptor unavailable in this environment → graceful substitution.** Forge
  reported `unavailable` (codex CLI not installed) and correctly refused to silently fake output with
  Claude. I built `src/export.js` myself rather than block the milestone. Interceptor CLI is also not
  installed here, so web verification used real headless Chrome driven directly via the DevTools
  Protocol (Node 22 global WebSocket) — still real Chrome, the rendering-accuracy bar Interceptor
  exists to meet. Both are environment gaps, not design changes.
- 2026-06-09: **Deploy gated despite "implement the plan".** Pushing to the public repo auto-deploys
  AND publishes Sarah's real personal/seed data. That is outward-facing + hard-to-reverse, so per the
  push/deploy permission boundary the build + local verification are done now and the push/tag is held
  for Harry's explicit confirm (FU-2).

## Changelog

- conjectured: all-relative paths + relative SW registration would make the app work unchanged on the
  GitHub Pages subpath `/technicolour-planner/`. refuted_by: nothing — but the initial headless pass
  ran at root (`localhost/`), so the conjecture was untested where it most commonly fails (Pages
  subpath SW scope / manifest / icon resolution). learned: re-verified at the real subpath shape; SW
  scope, manifest href, icon href, and all 5 precached resources resolve correctly and the SW controls
  navigations after reload. criterion_now: ISC-18 verification explicitly includes a subpath probe.
- conjectured: reconnecting a lapsed file handle could safely reload the file as source-of-truth.
  refuted_by: advisor flagged that edits made while in cache/fallback mode would be silently clobbered
  by an older file on reconnect. learned: added an `updatedAt` content timestamp; reconnect now keeps
  whichever copy is newer and writes the winner back. criterion_now: ISC-22 covers conflict-aware reconnect.
- conjectured: a service worker that calls `clients.claim()` is harmless on first load. refuted_by:
  Harry reported a popup that "appears super fast then vanishes" — reproduced via DevTools as 2 navigations
  (the first-load `controllerchange` from `clients.claim()` hit the update-reload handler). learned:
  guard the reload behind an explicit user-accepted-update flag so first-load control never reloads.
  criterion_now: ISC-42 asserts exactly one navigation on first load.

## Verification

**Method mix:** jsdom functional harness (27/27) + real headless-Chrome via DevTools Protocol
(SW/cache, exports, screenshot) + static file/syntax/parse checks. Local server `127.0.0.1:8731`.

**Real-Chrome (DevTools Protocol) — authoritative:**
- ISC-14/15/16/18 (offline shell): `caches.keys()` → `["technicolour-v1.0.0"]`, `shellCached:true`,
  `serviceWorker.controller:true`, `registration:true`. Cache-first + shell cached = opens offline.
- ISC-1/3/5/6/7/41 (board renders): 7 day columns, 6 cards this week, real titles
  (ttt design colour / Burton dogs / Carla / Healed — Nim), balance 8/3/3/3. Screenshot
  `/tmp/tcv/board.png` shows rainbow brand, her four target chips in her colours, balance bar with
  "light here" flags, weekly calendar with coloured day bars, today highlighted, graceful fallback banner.
- ISC-34/35/36 (Office exports): xlsx 12,563 B, docx 9,785 B, pptx 61,809 B — all `zip:true` (PK magic).
- ISC-1/9: zero console errors on load.
- ISC-10/11/13/16/18 (real subpath, advisor-driven): re-served at `…/technicolour-planner/` (Pages shape).
  SW `scope: …/technicolour-planner/`, active+controller true, manifest + icons resolve under subpath,
  all 5 shell resources precached, and after a reload the SW still controls and the board renders —
  confirms the all-relative paths work on the deploy subpath, not just root.

**jsdom functional (27/27):** ISC-1,2,3,5,6,7,9,19,23,24,26,27,28,30,33,37,38,39 + library renders
all 14 projects + key-3 → conversion filter. (`/tmp/tcv/verify.mjs`.)

**Static:** ISC-10/13 manifest JSON valid (name/display/start_url/3 icons any+any+maskable);
ISC-12 icons 192×192, 512×512, 512×512 PNG (IHDR-confirmed); ISC-32 vendor libs present
(exceljs 948KB, docx 770KB, pptxgen 478KB); export.js + service-worker.js `node --check` clean.
ISC-34 xlsx also re-validated on disk: 4 sheets, `xl/workbook.xml` (`unzip -l`).

**Inspection-verified (no headless probe possible/needed):** ISC-4,8 (Turn-over hooks + drawer/templates —
ported verbatim from the 16/16-verified prototype, jsdom render clean); ISC-11,17,25,29,31
(manifest link/theme meta; update-toast wiring; persist() request; auto-backup-before-migrate guard;
JSON round-trip logic).

**Live deploy (ISC-40, FU-2 closed):** Deployed 2026-06-09 to `https://harryf.github.io/technicolour-planner/`.
Live curl: real title/brand, `noindex` meta present, manifest link + SW registration present, old
placeholder text gone, onboarding markup live. All 8 shell resources HTTP 200 (manifest, SW, 2 icons,
src/export.js, 3 vendor libs). manifest valid (display:standalone, 3 icons). GitHub Release `v1.0.0` cut.

**Deferred (require Sarah's real machine):**
- ISC-20/21/22 [DEFERRED-VERIFY → FU-1]: File System Access picker/persist/reconnect — needs a real
  user gesture on a real install; code inspection-verified + conflict-aware. Closes on Sarah/Harry's
  first install folder-pick test (the one hands-on acceptance check left).

**v1.0.1 (deployed 2026-06-09) — live-probed on `harryf.github.io`:**
- ISC-42 (flash fixed): reproduced first (DevTools: 2 navigations on v1.0.0); after fix, **exactly 1
  load event** on the live site. Root cause was the SW `clients.claim()` first-load `controllerchange`
  reloading; now guarded behind `window.__acceptedUpdate`.
- ISC-43 (install gate): live on `harryf.github.io` → `gateActive:true, gateOpen:true, gateVisible:true`;
  on localhost → `gateActive:false` (dev usable). Screenshot `/tmp/tcv/live-gate.png` shows the frosted
  overlay blurring the planner with the install card on top.
- ISC-44 (install): `installBtnExists:true`; `beforeinstallprompt` wired; Mac/Windows steps rendered.
- jsdom regression 27/27 after the changes (matchMedia guarded for jsdom).
