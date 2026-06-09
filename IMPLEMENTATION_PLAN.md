# Implementation Plan — Sarah's Amazing Technicolour Planner

> **Read this top-to-bottom before writing any code.** It is written to be executed *cold* —
> i.e. by a fresh context after a token-window re-compaction. Everything needed to go from the
> working prototype to the deployed PWA is here or pointed to from here.

---

## 0. Cold-start brief (who/what/where)

**What we're building:** a Progressive Web App (PWA) version of the content planner Sarah already
loved as a prototype. Sarah is a **tattoo artist in Lausanne** building an Instagram presence. She
**thinks in colour** (reads colour faster than text) and has **autism** — so the app must stay
predictable, low-surprise, and colour-first. She works in "states of mind" (brainstorm day / shoot
day / edit day). She is bilingual FR/EN.

**Read these first (they are the source of truth for *intent*):**
- `../docs/ANALYSIS.md` — how Sarah thinks; the four targets, the two colour languages, her dream.
- `../approach-2-app/index.html` — **the working prototype. This is the design + behaviour spec.**
  The PWA must preserve its look, feel, colour model, and seeded data. Do not redesign it; port it.
- `../ISA.md` — the prototype's ideal-state spec + verification (16/16 passing) we already built.
- This file — the build plan from prototype → PWA.

**The architecture decision (already made, with Harry, after a critique):** ship as an
**installable PWA**, *not* a Chrome extension (extensions need dev-mode/Web-Store friction, are
more exposed to Chrome churn, and wipe storage on removal). The PWA:
- installs to Start-menu/Dock with its own window,
- **loads fully offline after first install** (service worker precaches the shell; the app makes
  no runtime network calls),
- needs internet only for first install and to *receive* updates (updates never block opening).

**The storage decision:** the **source of truth is a real file Sarah chooses** (via the File
System Access API), ideally inside her cloud-synced folder (Google Drive / OneDrive / iCloud) so
it backs up passively and is "reachable in Drive" with **zero OAuth/backend**. IndexedDB is a local
cache + holds the file handle. This makes her data durable across browser resets and our updates,
and always extractable in human-readable form.

---

## 1. Goals / Non-goals

**Goals**
- Installable PWA; offline-capable after first load; own-window app feel.
- Data source-of-truth = a user-chosen file (JSON), with a human-readable Markdown mirror.
- **First-run asks Sarah where to store her data**, with a sensible cross-platform default and a
  guarantee it still works if she clicks past it.
- JSON import/export (universal escape hatch) + in-app export to `.xlsx` / `.docx` / `.pptx`
  (client-side, no backend) for Google Drive.
- Durable across our updates: schema versioning + auto-backup-before-migrate.
- A clean feature-request / bug loop (she → Harry → us → ship → she gets it next open).
- Preserve the prototype's exact colour-first UX and seeded-with-her-real-world content.

**Non-goals (explicitly out)**
- No backend, no database server, no accounts/auth, no multi-user.
- No live Google Drive API / OAuth (the synced-folder trick replaces it).
- No Tauri/native `.exe` this round (revisit only if "never needs internet even to install" becomes hard).
- No redesign of the UI — this is a port + hardening, not a rethink.

---

## 2. Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI  (ported from approach-2-app/index.html — unchanged look)│
│   Board · Library · Turn-over · Detail drawer · Settings      │
└───────────────┬─────────────────────────────────────────────┘
                │  calls
        ┌───────▼────────┐      ┌──────────────────────────────┐
        │  Store layer   │◄────►│ IndexedDB (cache + file handle│
        │ load/save/     │      │  + last-good snapshot)        │
        │ setLocation/   │      └──────────────────────────────┘
        │ export/import  │      ┌──────────────────────────────┐
        │ migrate        │◄────►│ File System Access API        │
        └───────┬────────┘      │  Technicolour-Planner-Data.json│  ◄── SOURCE OF TRUTH
                │               │  (+ .md mirror) in her folder │
                │               └──────────────────────────────┘
        ┌───────▼────────┐      ┌──────────────────────────────┐
        │ Export module  │      │ Service worker                │
        │ (lazy-loaded   │      │  precache shell → offline      │
        │  exceljs/docx/ │      │  cache-first + update toast    │
        │  pptxgenjs)    │      └──────────────────────────────┘
        └────────────────┘      + manifest.webmanifest + icons
```

**Data flow**
- **Launch:** try the saved file handle (re-prompt permission with one click if lapsed) → read
  JSON = truth. If no handle / unsupported browser → read IndexedDB cache → else seed starter data.
- **Edit:** debounced autosave → write to **both** IndexedDB (instant) and the file (truth). Mirror
  `.md` on save (cheap).
- **Schema bump:** if `data.schemaVersion < CURRENT`, write `…-backup-<ISO>.json` first, then run
  the `migrate()` chain, then save.
- **Offline:** SW serves cached shell; all logic is local; file writes are local. Works with no net.

---

## 3. Storage design (the critical part)

### 3.1 Source of truth = a real file (File System Access API)
- APIs: `window.showSaveFilePicker()` / `showDirectoryPicker()` to choose location;
  `FileSystemFileHandle.createWritable()` to write; `.getFile()` to read.
- **Persist the handle** in IndexedDB so she picks once. On next launch, call
  `handle.queryPermission()/requestPermission()`; if it lapsed (common after full browser restart),
  show a single **"Reconnect your data file"** button.
- **Chromium-only** (Chrome/Edge). Sarah uses Chrome ✓. For any non-Chromium browser, **degrade
  gracefully**: IndexedDB-only + a persistent "set a data file / export a backup" reminder. Never
  hard-fail.

### 3.2 First-run: ask where to store data (Harry's explicit requirement)
Friendly 3-step onboarding modal on first launch:
1. **Welcome** (name + one line of what it is).
2. **"Where should I keep your work?"** → primary button **Choose folder** (opens
   `showDirectoryPicker`). Helper copy: *"Pick a folder for your planner file. Tip: choose your
   Google Drive / OneDrive / iCloud folder and it backs up automatically."* Default **filename**:
   `Technicolour-Planner-Data.json`.
   - **Sensible default & cross-platform note:** a web app *cannot* silently write to an arbitrary
     OS path (browser security) — the user must pick once. That's *why* "ask where" is the correct
     and only robust design, and it satisfies the requirement natively. The picker itself opens at
     the OS default (Documents/Downloads on Win/Mac). We *recommend* the synced folder in copy.
   - **Escape hatch:** a quiet **"Decide later"** link → falls back to IndexedDB-only with a
     standing reminder banner to set a file. Guarantees the app is usable even if she skips this.
3. **Done** → app opens seeded with her starter world (her real projects/hooks/targets from the
   prototype seed).
- `navigator.storage.persist()` requested on first run (asks Chrome not to evict storage).

### 3.3 Human-readable mirror
On each save, also write `Technicolour-Planner-Data.md` next to the JSON — a readable dump
(projects grouped by week, with type/targets/stages). Satisfies "extractable in human-friendly
form." Read path ignores the `.md` (JSON is canonical).

### 3.4 Schema versioning & safety
- `data.schemaVersion` integer; `CURRENT_SCHEMA` constant; ordered `migrations[]`.
- **Before** applying any migration: write `Technicolour-Planner-Data-backup-<ISO>.json`.
- Keep last N (e.g. 10) backups; prune oldest.
- The prototype already has a `migrate()` stub to build on.

---

## 4. Repository structure (this folder)

```
technicolour-planner/
  index.html               # entry; ported from prototype. Keep mostly single-file initially.
  manifest.webmanifest     # PWA manifest (name, icons, theme, display:standalone, start_url)
  service-worker.js        # precache shell, cache-first, update-available flow
  icons/                   # icon-192.png, icon-512.png, icon-maskable-512.png
  src/                     # extracted modules IF/WHEN we split (store.js, export.js, ui.js…)
  vendor/                  # minified UMD builds of exceljs / docx / pptxgenjs (lazy-loaded)
  package.json             # dev tooling only (a tiny local server, icon gen); NO heavy bundler
  README.md                # Sarah-facing usage + dev notes
  CHANGELOG.md             # per-release "what's new" (feeds the in-app update toast)
  FEATURES.md              # feature-request + bug backlog (the loop)
  ISA.md                   # project ISA (seed from ../ISA.md, expand for PWA criteria)
  IMPLEMENTATION_PLAN.md   # this file
  LICENSE                  # optional; repo is private → may omit
  .github/workflows/       # deploy.yml IF GitHub Pages; not needed for Cloudflare Pages
```

**Build philosophy:** stay **buildless** (vanilla HTML/CSS/JS like the prototype) so hosting is
trivial static files and there's nothing to break. The only "build" is optionally generating icons
and vendoring the three export libs as static UMD files (lazy-loaded on first export so initial
load stays light).

---

## 5. Hosting & deploy — LOCKED

- **Host: GitHub Pages**, **public** repo `harryf/technicolour-planner`.
- **Live URL: `https://harryf.github.io/technicolour-planner/`** (project-site form
  `https://<user>.github.io/<repo>/`).
- **HTTPS** is provided by Pages (required for service worker / PWA install). ✓
- **Deploy via GitHub Actions** (`.github/workflows/deploy.yml`): builds/publishes the static site
  to Pages. Triggers: **push to `main`** (continuous) **and on tag push `v*`** (tagged releases),
  plus manual `workflow_dispatch`. No build step needed (static single file) — the workflow just
  uploads the repo as the Pages artifact and deploys it.
- A second workflow (`release.yml`) creates a **GitHub Release** when a `v*` tag is pushed, using
  the matching `CHANGELOG.md` section as the release notes.
- **Release ritual:** bump the in-app `VERSION` + add a `CHANGELOG.md` entry → commit → `git tag vX.Y.Z`
  → push tag → Actions deploys Pages + cuts the Release. Sarah's installed PWA picks up the new
  service worker on her next open.
- One-time setup: in repo **Settings ▸ Pages**, set **Source = GitHub Actions** (the workflow needs
  this; the deploy step also enables it via the `actions/configure-pages` action).

---

## 6. Migration from prototype → PWA (ordered, concrete)

1. **Port UI:** copy `../approach-2-app/index.html` here as `index.html`. Keep inline CSS/JS at
   first (lowest churn). Rename app/title to "Sarah's Amazing Technicolour Planner."
2. **Introduce a `Store` abstraction** and route the existing `load()/save()` through it:
   `Store.init()`, `Store.load()`, `Store.save(state)`, `Store.setLocation()`, `Store.export()`,
   `Store.import(file)`, `Store.backup()`, `Store.status()`. Back it with File System Access (truth)
   + IndexedDB (cache + handle). Replace the prototype's direct `localStorage` calls.
3. **First-run onboarding modal** (section 3.2): name file, choose folder, "decide later" fallback,
   `persist()` request.
4. **PWA shell:** add `manifest.webmanifest`, `<link rel="manifest">`, theme-color meta, icons; add
   `service-worker.js` (precache the file list; cache-first; on new SW, show a calm "New version —
   reload to update" toast). Register SW from `index.html`.
5. **Office export buttons:** `.xlsx` (exceljs), `.docx` (docx), `.pptx` (pptxgenjs) — all have
   browser builds (proven in `../approach-1-google/`). Vendor minified UMD; **lazy-load** the lib on
   first click so initial load stays light. Reuse the generator logic already written in
   `../approach-1-google/build_xlsx.ts` and `build_doc_and_slides.ts` (port to browser).
6. **Schema versioning + auto-backup-before-migrate** (section 3.4).
7. **Settings additions:** change data location · "Back up now" · persistent-storage status ·
   (existing) calm mode · colour remap · FR/EN. Show the **current data file path/name** so she
   never wonders where her data is.
8. **In-app version badge** (footer) reading a `VERSION` constant; "what's new" from CHANGELOG.
9. **Icons & polish:** generate maskable icons (her palette / a colourful tattoo-ish mark), set
   theme colour, verify install prompt.

---

## 7. Feature-request & bug loop

- `FEATURES.md` in repo = the backlog (status: idea / building / shipped). Sarah sends requests by
  voice/text/screenshot → Harry → us → implement → push → auto-deploy → she gets it next open.
- In-app **"Send feedback"** button (simple `mailto:` to Harry, prefilled with app version) so she
  can fire off a request from inside the app.
- `CHANGELOG.md` updated each release; the update toast surfaces "what's new."
- **Why the dependency is safe:** her data is a plain JSON/Markdown file *she owns* — if dev ever
  stops, the app is throwaway but nothing is locked in. State this in the README.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| File System Access is Chromium-only | Sarah uses Chrome ✓; graceful IndexedDB-only fallback otherwise |
| File permission lapses after browser restart | One-click "Reconnect your data file" on launch |
| Export libs are heavy → slow load | Lazy-load on first export; vendor minified UMD |
| Our update corrupts her data | `schemaVersion` + auto-backup-before-migrate + keep last 10 backups |
| Browser evicts storage | `navigator.storage.persist()`; file is truth, not the cache |
| She forgets where her data lives | Settings shows the file path; default to a synced folder |
| Lost/again-offline reinstall | Document that uninstall/clear-data needs one online reinstall |

---

## 9. Milestones (sequence to build)

- **M1 — Installable offline shell.** Port `index.html`; add manifest + icons + service worker;
  app installs and **opens offline**. (Verify: Lighthouse PWA pass; install; airplane-mode open.)
- **M2 — Store layer + "ask where to store data."** File-System-Access truth + IndexedDB cache +
  first-run onboarding + reconnect flow + `persist()`.
- **M3 — Durability.** Schema versioning + auto-backup-before-migrate + harden JSON import/export.
- **M4 — Office exports.** `.xlsx`/`.docx`/`.pptx` buttons, lazy-loaded, ported from approach-1 logic.
- **M5 — Polish.** Settings (change location, backup-now, persistent-storage status, version badge),
  icons, CHANGELOG, "Send feedback."
- **M6 — Test & deploy.** jsdom functional suite (extend the 16/16 we have) + headless-Chrome
  screenshot + Lighthouse PWA audit + manual install/offline test → deploy to Cloudflare Pages →
  hand URL to Sarah with a 3-line "install it" note.

---

## 10. Verification approach (carry the prototype's rigor)
- **Functional:** extend `verify_node.mjs` (jsdom) for the new Store/onboarding logic.
- **Visual:** headless-Chrome screenshots of board, onboarding, settings (as done for the prototype).
- **PWA:** Lighthouse PWA audit (installable, offline, manifest valid).
- **Offline:** load once online, then airplane-mode reload → must open and show data.
- **Round-trip:** create data → export JSON → clear → import → identical. Same for the `.md` mirror existence.
- **Install:** actually install on a real Chrome (Harry) and confirm own-window + offline launch.

---

## 11. Decisions — LOCKED (confirmed by Harry 2026-06-09)
1. **Host/visibility:** GitHub Pages, **public** repo `harryf/technicolour-planner`. ✅
2. **Repo name:** `technicolour-planner`. ✅
3. **URL:** `https://harryf.github.io/technicolour-planner/` (custom domain later if wanted). ✅
4. **Single-file** app. ✅
5. **Human-readable `.md` mirror** alongside JSON. ✅
6. **App name:** 🌈 **Sarah's Amazing Technicolour Planner**. ✅

> **PRIVACY — decided 2026-06-09 (Harry):** v1 ships PUBLIC **with Sarah's real details/seed data
> as-is** to get her installed fast. Mitigation for now: `<meta name="robots" content="noindex">` on
> the app + a `robots.txt` (the meta tag is the real control on a github.io project site). `docs/ANALYSIS.md`
> still stays OUT of the repo (it's in the parent folder, not committed). **Scrub later:** a future task
> will neutralise the public docs and likely restart the repo with dummy seed data. Track this in FEATURES.md.

---

## 12. First actions on kickoff (after re-compaction)
1. Re-read §0 pointers (`../docs/ANALYSIS.md`, `../approach-2-app/index.html`, `../ISA.md`, this file).
2. Confirm/inherit Harry's answers to §11 (assume defaults if silent).
3. Seed `ISA.md` for the PWA (E3+ project ISA) from `../ISA.md` + the PWA criteria implied above.
4. Execute M1 → M6 in order, verifying each milestone before the next.
