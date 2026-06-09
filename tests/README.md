# Tests

A buildless test suite for the planner. Two layers:

- **Unit (jsdom)**, `tests/unit.mjs`: loads `index.html` in jsdom and checks rendering, the seed
  data, the Store API, schema migration, the markdown mirror, onboarding, the install gate (including
  the `.gbox` collision regression), the existing-folder load path (with a mocked directory picker),
  install detection, and the "Open the App" relabel.
- **Browser (real Chrome)**, `tests/browser.mjs`: drives headless Chrome over the DevTools Protocol.
  Serves the repo's parent folder so the app runs at the real `/technicolour-planner/` subpath, then
  checks the service worker cache, true offline reload, the three Office exports (valid OOXML zips),
  no first-load flash, and the install-detection relabel. Skips cleanly if no Chrome is found.

## Run

```sh
bun install        # one time: installs jsdom (the only dev dependency)
bun run test       # full suite (jsdom + Chrome)
bun run test:unit  # jsdom only
bun run test:browser
```

Note: the suite runs under **Node**, not Bun, because Bun's jsdom hits a Proxy error. `bun run`
just launches the npm scripts, which call `node`. Chrome is auto-detected on Mac, Windows, and Linux;
set `CHROME_PATH` to override (CI uses this).

CI runs the full suite on every push and pull request (see `.github/workflows/tests.yml`).
