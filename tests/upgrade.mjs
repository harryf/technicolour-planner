// Regression test for the auto-update path: a deployed new version must fully load, not leave the
// app on a cached old page. Reproduces the GitHub-Pages condition (max-age caching) that twice left
// the installed app stuck on an old version.
import { fileURLToPath } from "node:url";
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { Suite, sleep } from "./lib/assert.mjs";
import { launchChrome, newPage } from "./lib/chrome.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const setVersion = (src, v) => src.replace(/const VERSION = "[^"]+"/, `const VERSION = "${v}"`);

// Static server that mimics GitHub Pages: Cache-Control: max-age=600 on everything.
function serveCached(rootDir) {
  const T = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
        const data = readFileSync(join(rootDir, p));
        res.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream", "Cache-Control": "max-age=600" });
        res.end(data);
      } catch { res.writeHead(404); res.end("nf"); }
    });
    server.listen(0, "127.0.0.1", () => resolve({ port: server.address().port, close: () => new Promise(r => server.close(r)) }));
  });
}

export async function runUpgrade() {
  const s = new Suite("Upgrade (real Chrome, cached server)");
  const chrome = await launchChrome(1); // second instance, distinct port
  if (!chrome) { s.skip("upgrade test", "no Chrome found"); return s; }

  const dir = mkdtempSync(join(tmpdir(), "tcp-upgrade-"));
  mkdirSync(join(dir, "app"));
  const APPDIR = join(dir, "app");
  const index = readFileSync(REPO + "index.html", "utf8");
  const sw = readFileSync(REPO + "service-worker.js", "utf8");
  const manifest = readFileSync(REPO + "manifest.webmanifest", "utf8");
  const write = (v) => {
    writeFileSync(join(APPDIR, "index.html"), setVersion(index, v));
    writeFileSync(join(APPDIR, "service-worker.js"), setVersion(sw, v));
    writeFileSync(join(APPDIR, "manifest.webmanifest"), manifest);
  };

  write("0.0.0-a");
  const server = await serveCached(dir);
  const APP = `http://127.0.0.1:${server.port}/app/`;
  let page;
  try {
    page = await newPage(chrome.port);
    await page.goto(APP);
    await sleep(3000); // service worker installs + claims
    const v1 = await page.eval("VERSION");
    s.ok("first version installs", v1 === "0.0.0-a", `VERSION=${v1}`);

    write("0.0.0-b"); // "deploy" a new version
    await page.eval("(async()=>{ const r=await navigator.serviceWorker.getRegistration(); await r.update(); document.dispatchEvent(new Event('visibilitychange')); return 'ok'; })()");
    await sleep(5000); // install (fresh precache) + activate + controllerchange + reload

    const v2 = await page.eval("VERSION");
    s.ok("update fully loads the new version (not a cached old page)", v2 === "0.0.0-b", `VERSION=${v2}`);
    const keys = JSON.parse(await page.eval("(async()=>JSON.stringify(await caches.keys()))()"));
    s.ok("cache rolled to the new version", keys.some(k => k.includes("0.0.0-b")) && !keys.some(k => k.includes("0.0.0-a")), keys.join(","));
  } catch (e) {
    s.ok("upgrade run completed without throwing", false, String(e && e.message || e));
  } finally {
    if (page) page.close();
    await server.close();
    chrome.kill();
  }
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await runUpgrade();
  s.print();
  process.exit(s.failed ? 1 : 0);
}
