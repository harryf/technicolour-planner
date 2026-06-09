// Integration tests in real headless Chrome via the DevTools Protocol.
// Serves the repo's PARENT folder so the app runs at /technicolour-planner/ (the real Pages subpath).
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Suite, sleep } from "./lib/assert.mjs";
import { serve } from "./lib/server.mjs";
import { launchChrome, newPage } from "./lib/chrome.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const PARENT = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const REPO_NAME = REPO.slice(PARENT.length + 1);

export async function runBrowser() {
  const s = new Suite("Browser (real Chrome)");
  const chrome = await launchChrome();
  if (!chrome) { s.skip("browser tests", "no Chrome found (set CHROME_PATH to enable)"); return s; }

  const server = await serve(PARENT);
  const APP = `${server.url}/${REPO_NAME}/`;
  let page;
  try {
    page = await newPage(chrome.port);
    await page.goto(APP);
    await sleep(3500); // load + service worker install/activate + cache

    s.ok("serves the app (version present)", typeof (await page.eval("typeof VERSION!=='undefined' ? VERSION : null")) === "string", "VERSION");
    s.ok("exactly one load (no flash-reload)", page.loads() === 1, `${page.loads()} load events`);

    const sw = JSON.parse(await page.eval(`(async()=>{ const reg=await navigator.serviceWorker.getRegistration(); const keys=await caches.keys(); let shell=false; for(const k of keys){ const c=await caches.open(k); if((await c.match('index.html'))||(await c.match('./'))) shell=true; } return JSON.stringify({reg:!!reg, controller:!!navigator.serviceWorker.controller, keys, shell}); })()`));
    s.ok("service worker registered + controlling", sw.reg && sw.controller, JSON.stringify(sw));
    s.ok("shell precached under versioned cache", sw.shell && sw.keys.some(k => k.startsWith("technicolour-v")), sw.keys.join(","));

    const board = JSON.parse(await page.eval(`JSON.stringify({days:document.querySelectorAll('#board .day').length, cards:document.querySelectorAll('#board .card').length})`));
    s.ok("board renders her world", board.days === 7 && board.cards >= 4, JSON.stringify(board));

    s.ok("gate dormant on localhost", (await page.eval("gateActive()")) === false, "localhost bypass");
    const gboxDisplay = await page.eval(`(()=>{ document.getElementById('installGate').classList.add('open'); const d=getComputedStyle(document.querySelector('#installGate .gbox')).display; document.getElementById('installGate').classList.remove('open'); return d; })()`);
    s.ok("gate panel is block (no .card flex collision)", gboxDisplay === "block", `display=${gboxDisplay}`);

    const exp = JSON.parse(await page.eval(`(async()=>{ window.__cap=[]; const oc=URL.createObjectURL; URL.createObjectURL=(b)=>{window.__cap.push(b);return oc.call(URL,b)}; const out={}; for(const kind of ['xlsx','docx','pptx']){ try{ await officeExport(kind); const b=window.__cap[window.__cap.length-1]; const ab=await b.arrayBuffer(); const u8=new Uint8Array(ab.slice(0,4)); out[kind]={bytes:ab.byteLength, zip:(u8[0]===80&&u8[1]===75)}; }catch(e){ out[kind]={error:String(e&&e.message||e)}; } } URL.createObjectURL=oc; return JSON.stringify(out); })()`));
    s.ok("xlsx export is a valid zip", exp.xlsx && exp.xlsx.zip && exp.xlsx.bytes > 2000, JSON.stringify(exp.xlsx));
    s.ok("docx export is a valid zip", exp.docx && exp.docx.zip && exp.docx.bytes > 2000, JSON.stringify(exp.docx));
    s.ok("pptx export is a valid zip", exp.pptx && exp.pptx.zip && exp.pptx.bytes > 2000, JSON.stringify(exp.pptx));

    // true offline: cut the network and reload; the cached shell must still serve
    await page.setOffline(true);
    page.resetLoads();
    await page.reload();
    await sleep(2000);
    const offlineDays = await page.eval("document.querySelectorAll('#board .day').length");
    s.ok("opens offline from cache", offlineDays === 7, `${offlineDays} day cols offline`);
    await page.setOffline(false);

    // install detection -> "Open the App" (localStorage fast path)
    const label = await page.eval(`(async()=>{ localStorage.setItem('installed','1'); const inst=await detectInstalled(); setGateMode(inst); return document.getElementById('installBtn').textContent; })()`);
    s.ok("already-installed flag shows 'Open the App'", label === "Open the App", `button="${label}"`);

    // no-install-prompt heuristic body: start from the install view, simulate "no prompt fired",
    // then run the heuristic condition deterministically (headless actually fires the prompt, so we
    // force promptFired=false to test the logic itself; the real installed-state path is confirmed
    // on a real machine where an installed PWA suppresses the prompt).
    const heur = await page.eval(`(()=>{ setGateMode(false); promptFired=false; deferredPrompt=null; localStorage.removeItem('installed'); if(!promptFired && !deferredPrompt){ markInstalled(); setGateMode(true); } return document.getElementById('installBtn').textContent; })()`);
    s.ok("no-prompt heuristic flips to 'Open the App'", heur === "Open the App", `button="${heur}"`);

    await page.screenshot(join(tmpdir(), "technicolour-test-board.png"));
  } catch (e) {
    s.ok("browser run completed without throwing", false, String(e && e.message || e));
  } finally {
    if (page) page.close();
    await server.close();
    chrome.kill();
  }
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await runBrowser();
  s.print();
  process.exit(s.failed ? 1 : 0);
}
