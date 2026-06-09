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
    storyCodes:[1..5], image:<dataURL>|null,
    stages:{prep,shot,edited,posted}, tasks:[{id,text,activity,done}]   // activity ∈ brainstorm|shoot|edit|priority|justdo
  } ],
  settings: { lang:"en"|"fr", lowstim:bool, colors:{<target>:<hex>} },   // per-user colour remap
  weekStart, schemaVersion, updatedAt
}
```

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
  **auto-backs-up the file before migrating** (keeps last 10 `*-backup-*.json`).

## Install gate (browser tab vs installed app)

The app is meant to run as the **installed PWA**, not a public browser tab. `isStandalone()`
(`display-mode: standalone`/minimal-ui/window-controls-overlay, or iOS `navigator.standalone`)
decides. When **not** standalone **and** not localhost dev (`gateActive()`), a frosted overlay
(`#installGate`) covers the UI with install instructions + a one-click install button (wired via
`beforeinstallprompt`); `boot()` returns early so prompts/onboarding don't fire behind it. Installed
app or `localhost`/`127.0.0.1`/`file:` → no gate. Don't show Sarah's data in a public browser tab.

Note: updates are automatic. The service worker calls `skipWaiting()` on install and `clients.claim()`
on activate. The page reloads once on `controllerchange`, but only if it already had a controller at
load (a real update), so the first open never reloads. There is no manual update prompt. Keep the
`hadController` guard if you touch the SW update flow (it prevents a first-load reload).

## Icons

PNGs generated by a dependency-free `node:zlib` script (the four target colours as stripes; the
maskable one is full-bleed). The generator isn't committed; to regenerate, write a small bun/TS
script that emits 8-bit RGBA PNGs at 192/512/512 into `icons/` (see git history / `ISA.md` if you
need the exact approach). If you change the brand mark, regenerate all three.

## Build, verify, deploy

- **Run locally:** serve the folder with any static server, e.g. `python3 -m http.server 8731`,
  then open `http://127.0.0.1:8731/`. (Service worker + File System Access need `http`/`https`, not
  `file://`.)
- **Verify:** there is no test runner. Two harnesses are used (scripts live in `/tmp` during a
  session, recreate as needed):
  - **jsdom** functional harness (run under **Node**, not Bun, Bun's jsdom hits a Proxy error):
    loads `index.html`, drives the UI, asserts render/seed/Store/onboarding logic.
  - **Real Chrome** via the **DevTools Protocol** (launch `--headless=new --remote-debugging-port`,
    drive over the `/json` WebSocket with Node's global `WebSocket`): the only honest way to verify
    the service-worker cache, the offline shell, and the Office exports (the UMD libs hang jsdom).
    **Always re-verify under the real `/technicolour-planner/` subpath**, not just root, that's
    where Pages-specific path/scope bugs surface. (If the `Interceptor` skill is installed, prefer
    it for browser verification; it wasn't available when v1 shipped.)
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
  "Send feedback" button is a `mailto:` to Harry.
- This repo is **not** in PAI's `checkpoint-repos.txt`, commits here are deliberate, never
  auto-committed.

## Where to start a new session

1. Read this file, then `ISA.md` (criteria + what's verified) and `CHANGELOG.md` (recent state).
2. For a bug: reproduce in real Chrome first (open the live URL or a local serve), check console +
   network, *then* read code.
3. For a feature: check `FEATURES.md`, implement in `index.html` (and `src/export.js` if it touches
   the colour model or exports), verify with both harnesses, bump version, follow the release ritual.
