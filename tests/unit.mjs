// Unit / functional tests for index.html, run under jsdom (Node, not Bun: Bun's jsdom hits a Proxy error).
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Suite, sleep } from "./lib/assert.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export async function runUnit() {
  const s = new Suite("Unit (jsdom)");
  const html = readFileSync(ROOT + "index.html", "utf8");
  const swSrc = readFileSync(ROOT + "service-worker.js", "utf8");

  const errs = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole: vc, url: "http://localhost/", pretendToBeVisual: true });
  const { document: doc, window: win } = dom.window;
  await sleep(600); // let async boot() settle

  const $$ = sel => [...doc.querySelectorAll(sel)];
  const $ = sel => doc.querySelector(sel);
  const ev = expr => win.eval(expr);

  // ---- rendering + seed ----
  s.ok("renders 7-day board", !!$("#board") && $$("#board .day").length === 7, `${$$("#board .day").length} day cols`);
  s.ok("no jsdom errors on boot", errs.length === 0, errs.slice(0, 2).join(" | ") || "clean");
  s.ok("brand text", /Sarah's Amazing Technicolour Planner/.test($(".brand h1").textContent), $(".brand h1").textContent.trim());
  const nProj = ev("state.projects.length");
  const titles = JSON.parse(ev("JSON.stringify(state.projects.map(p=>p.title))"));
  s.ok("seeded >= 10 projects", nProj >= 10, `${nProj} projects`);
  s.ok("seeded with real titles", titles.includes("Burton dogs") && titles.includes("1 TTT / year"), "Burton dogs / 1 TTT");
  const badges = [...new Set($$("#board .badge").map(b => b.textContent))];
  s.ok("type letters R/P/S", badges.some(b => ["R", "P", "S"].includes(b)), badges.join(","));
  s.ok("target stripes", $$("#board .card .stripes i").length > 0, `${$$("#board .card .stripes i").length} stripes`);
  s.ok("target text tags", $$("#board .ttag").length > 0, `${$$("#board .ttag").length} tags`);
  s.ok("Saturday NO POST", $$(".nopost").length > 0, `${$$(".nopost").length}`);
  s.ok("dated projects auto-place", $$("#board .card").length >= 4, `${$$("#board .card").length} cards this week`);
  ev("setView('library')");
  s.ok("library renders all projects", $$("#libgrid .card").length === nProj, `${$$("#libgrid .card").length}/${nProj}`);
  ev("setView('board')");
  s.ok("balance has 4 segments", $$("#balance .bseg").length === 4, `${$$("#balance .bseg").length}`);
  s.ok("balance counts > 0", $$("#balance .bseg .n").some(n => Number(n.textContent) > 0), $$("#balance .bseg .n").map(n => n.textContent).join("/"));
  doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "3" }));
  s.ok("key 3 filters conversion", $('.chip[data-target="conversion"]').getAttribute("aria-pressed") === "true", "aria-pressed");
  doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape" }));

  // ---- anti-criteria ----
  s.ok("no flashing nodes", $$("marquee, blink").length === 0, "no marquee/blink");

  // ---- Store + data model ----
  s.ok("Store API present", ev("typeof Store==='object' && ['init','load','save','setLocation','backup','status'].every(k=>typeof Store[k]==='function')"), "init/load/save/setLocation/backup/status");
  s.ok("graceful no-FSA on this platform", ev("Store.status().mode==='local' && Store.fsa===false"), "mode=local");
  s.ok("migrate stamps schema + updatedAt", ev("(()=>{const x=migrateState({projects:[]});return x.schemaVersion===CURRENT_SCHEMA && typeof x.updatedAt==='string';})()"), "schemaVersion + updatedAt");
  s.ok("markdown mirror produced", /Technicolour Planner/.test(ev("toMarkdown(state).slice(0,60)")) && /MD_NAME/.test(html), "toMarkdown + MD write");
  s.ok("import guard present", /doesn't look like a planner export/.test(html), "validates shape");

  // ---- onboarding + install gate ----
  s.ok("onboarding shown on first run", $("#onbModal").classList.contains("open"), "onb open");
  s.ok("decide-later escape hatch", !!$("#onbLater"), "present");
  s.ok("gate dormant on localhost", ev("isLocalDev()===true && gateActive()===false"), "localdev bypass");
  s.ok("gate has no .card collision", $("#installGate .card") === null && $("#installGate .gbox") !== null, "uses .gbox not .card");

  // ---- NEW: existing-folder load (mock the directory picker) ----
  const existing = JSON.parse(await ev(`(async()=>{
    Store.fsa = true;
    window.showDirectoryPicker = async () => ({
      name: "TestFolder",
      queryPermission: async()=> "granted", requestPermission: async()=> "granted",
      getFileHandle: async (name) => {
        if(name === JSON_NAME) return { getFile: async()=> ({ text: async()=> JSON.stringify({projects:[{id:'x',title:'EXISTING DATA',type:'reel',targets:['authority'],storyCodes:[],stages:{},tasks:[]}], settings:{lang:'en',colors:{}}, weekStart:'2026-06-08', schemaVersion:1, updatedAt:'2026-06-09T00:00:00Z'}) }) };
        throw new Error('not found');
      },
      createWritable: async()=> ({ write: async()=>{}, close: async()=>{} }),
      entries: async function*(){},
    });
    const res = await Store.setLocation();
    return JSON.stringify({ existing: res.existing, title: res.state && res.state.projects[0].title });
  })()`));
  s.ok("setLocation loads existing folder file", existing.existing === true && existing.title === "EXISTING DATA", JSON.stringify(existing));

  const empty = JSON.parse(await ev(`(async()=>{
    Store.fsa = true;
    window.showDirectoryPicker = async () => ({
      name: "EmptyFolder", queryPermission: async()=> "granted", requestPermission: async()=> "granted",
      getFileHandle: async (name, opts) => { if(opts && opts.create) return { createWritable: async()=> ({ write: async()=>{}, close: async()=>{} }) }; throw new Error('not found'); },
      createWritable: async()=> ({ write: async()=>{}, close: async()=>{} }), entries: async function*(){},
    });
    const res = await Store.setLocation();
    return JSON.stringify({ existing: res.existing });
  })()`));
  s.ok("setLocation on empty folder does not claim existing", empty.existing === false, JSON.stringify(empty));

  // ---- NEW: install detection + Open-the-App relabel ----
  s.ok("detectInstalled true when flag set", await ev("(async()=>{ localStorage.setItem('installed','1'); return await detectInstalled(); })()") === true, "localStorage flag");
  s.ok("setGateMode open -> 'Open the App'", ev("(()=>{ setGateMode(true); const b=document.getElementById('installBtn'); return b.textContent==='Open the App' && b.dataset.mode==='open'; })()"), "button relabel");
  s.ok("setGateMode install -> 'Install the app'", ev("(()=>{ setGateMode(false); return /Install the app/.test(document.getElementById('installBtn').textContent); })()"), "button reset");
  s.ok("gate-mode resolver present", ev("typeof resolveGateMode === 'function' && typeof supportsInstallPrompt !== 'undefined'"), "resolveGateMode + heuristic");

  // ---- polish + wiring ----
  s.ok("version badge matches VERSION", $("#versionBadge").textContent === "v" + ev("VERSION"), $("#versionBadge").textContent);
  s.ok("settings data controls", !!$("#setLocationBtn") && !!$("#backupNowBtn"), "setLocation + backup");
  s.ok("feedback mailto", !!$("#feedbackBtn") && /mailto:/.test(html), "feedback");
  s.ok("office export lazy-loaded", /loadExporter/.test(html) && /import\("\.\/src\/export\.js"\)/.test(html), "dynamic import");
  s.ok("SW registration guarded", /register\("service-worker\.js"\)/.test(html) && /location\.protocol\.startsWith\("http"\)/.test(html), "guarded");

  // ---- auto-update mechanism (source-level) ----
  s.ok("page reload guarded by hadController", /hadController/.test(html), "no first-load reload");
  s.ok("service worker skipWaiting on install", /self\.skipWaiting\(\)/.test(swSrc), "auto-activate");
  s.ok("no em-dashes in app UI strings", checkNoEmDashUi(html), "writing guide");

  return s;
}

// The served HTML may contain em-dashes only inside Sarah's seed data (titles/desc/music/notes),
// never in UI copy. This counts em-dashes that are NOT on a seed-data line.
function checkNoEmDashUi(html) {
  const lines = html.split("\n");
  const seedKeys = ["title:", "desc:", "music:", "notes:", "P({"];
  for (const line of lines) {
    if (!line.includes("—")) continue;
    if (seedKeys.some(k => line.includes(k))) continue; // Sarah's own data, allowed
    return false;
  }
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await runUnit();
  s.print();
  process.exit(s.failed ? 1 : 0);
}
