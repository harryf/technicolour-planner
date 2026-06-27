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
  ev("setView('library'); libStatus='all'; renderLibrary();");
  s.ok("library renders all projects", $$("#libgrid .card").length === nProj, `${$$("#libgrid .card").length}/${nProj}`);
  ev("libStatus='todo'; setView('board')");
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

  // ---- Library sort (v? — created/updated timestamps + 4 sort options) ----
  s.ok("schema bumped to 3", ev("CURRENT_SCHEMA===3"), `CURRENT_SCHEMA=${ev("CURRENT_SCHEMA")}`);
  s.ok("seed pieces carry timestamps", ev("state.projects.every(p=>typeof p.createdAt==='string' && typeof p.updatedAt==='string')"), "createdAt/updatedAt on all");
  s.ok("migrate 2→3 backfills order", ev(`(()=>{const x=migrateState({schemaVersion:2,settings:{},projects:[{id:'a'},{id:'b'},{id:'c'}]});
    return x.schemaVersion===3 && x.projects.every(p=>p.createdAt) && x.projects[0].createdAt < x.projects[2].createdAt;})()`), "oldest→newest preserved");
  s.ok("default sort is 'recent'", ev("libSort()==='recent' && state.settings.libSort==='recent'"), ev("state.settings.libSort"));
  s.ok("touch() bumps updatedAt", ev(`(()=>{const p={id:'z',createdAt:'2000-01-01T00:00:00.000Z',updatedAt:'2000-01-01T00:00:00.000Z'};touch(p);return p.updatedAt>p.createdAt;})()`), "updatedAt moved forward");
  // sort comparators are deterministic on a synthetic set
  s.ok("sort 'recent' = newest first", ev(`(()=>{const L=[{id:'1',updatedAt:'2026-01-01T00:00:00Z',createdAt:'2026-01-01T00:00:00Z'},{id:'2',updatedAt:'2026-03-01T00:00:00Z',createdAt:'2026-03-01T00:00:00Z'}];
    return LIB_SORTS.recent.cmp(L[0],L[1])>0;})()`), "later updatedAt sorts first");
  s.ok("sort 'date' = undated last", ev(`(()=>{const dated={id:'d',date:'2026-05-01',updatedAt:'',createdAt:''},none={id:'n',date:null,updatedAt:'',createdAt:''};
    return LIB_SORTS.date.cmp(dated,none)<0 && LIB_SORTS.date.cmp(none,dated)>0;})()`), "dated before undated");
  s.ok("sort 'colour' = funnel order", ev(`(()=>{const disc={id:'a',targets:['discovery'],date:null},ret={id:'b',targets:['retention'],date:null};
    return LIB_SORTS.colour.cmp(disc,ret)<0;})()`), "discovery before retention");
  s.ok("sort 'title' = A→Z", ev(`(()=>{return LIB_SORTS.title.cmp({id:'a',title:'Apple'},{id:'b',title:'Zebra'})<0;})()`), "Apple before Zebra");
  // end-to-end: switching sort reorders the live grid and persists the choice
  ev("setView('library'); libStatus='all'; state.settings.libSort='title'; renderLibrary();");
  const sortedTitles = JSON.parse(ev("JSON.stringify([...document.querySelectorAll('#libgrid .card .ttl')].map(e=>e.textContent))"));
  const expectedAZ = JSON.parse(ev("JSON.stringify(sortProjects(state.projects).map(p=>p.title))"));
  s.ok("A→Z grid matches locale sort", JSON.stringify(sortedTitles)===JSON.stringify(expectedAZ), sortedTitles.slice(0,3).join(" | "));
  s.ok("sort buttons reflect choice", ev(`document.querySelector('#libSort [data-sort=\\"title\\"]').getAttribute('aria-pressed')==='true'`), "title pressed");
  ev("state.settings.libSort='recent'; libStatus='todo'; setView('board');");

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

  // NEW: timestamped checkpoint written into the saves/ subfolder (mock the dir + subdir handles)
  const chk = JSON.parse(await ev(`(async()=>{
    let written = null, askedFor = null;
    const subdir = (label)=>({ name:label,
      getFileHandle: async(n)=>({ createWritable: async()=>({ write: async(c)=>{ written = { name:n, len:String(c).length }; }, close: async()=>{} }) }),
      removeEntry: async()=>{}, entries: async function*(){} });
    Store.mode = "file";
    Store.dir = { name:"F", queryPermission: async()=>"granted", requestPermission: async()=>"granted",
      getDirectoryHandle: async(n)=>{ askedFor = n; return subdir(n); },
      getFileHandle: async(n)=>({ createWritable: async()=>({ write: async(c)=>{ written = { name:n, len:String(c).length }; }, close: async()=>{} }) }),
      removeEntry: async()=>{}, entries: async function*(){} };
    const name = await Store.checkpoint(state);
    return JSON.stringify({ name, written, askedFor });
  })()`));
  s.ok("checkpoint writes timestamped file to folder", /Technicolour-Planner-checkpoint-.*\.json/.test(chk.name) && chk.written && chk.written.name === chk.name, JSON.stringify(chk).slice(0, 90));
  s.ok("checkpoint routes into the saves/ subfolder", chk.askedFor === "saves", "askedFor=" + chk.askedFor);

  // ---- NEW: install detection + Open-the-App relabel ----
  s.ok("detectInstalled true when flag set", await ev("(async()=>{ localStorage.setItem('installed','1'); return await detectInstalled(); })()") === true, "localStorage flag");
  s.ok("setGateMode open -> 'Open the App'", ev("(()=>{ setGateMode(true); const b=document.getElementById('installBtn'); return b.textContent==='Open the App' && b.dataset.mode==='open'; })()"), "button relabel");
  s.ok("setGateMode install -> 'Install the app'", ev("(()=>{ setGateMode(false); return /Install the app/.test(document.getElementById('installBtn').textContent); })()"), "button reset");
  s.ok("gate-mode resolver present", ev("typeof resolveGateMode === 'function' && typeof supportsInstallPrompt !== 'undefined'"), "resolveGateMode + heuristic");

  // ---- polish + wiring ----
  s.ok("version badge matches VERSION", $("#versionBadge").textContent === "v" + ev("VERSION"), $("#versionBadge").textContent);
  s.ok("settings data controls", !!$("#setLocationBtn") && !!$("#backupNowBtn"), "setLocation + checkpoint");
  s.ok("import/export moved into Settings", !!$("#settingsModal #exportBtn") && !!$("#settingsModal #importBtn") && $("header #exportBtn") === null, "not in header");
  s.ok("Store.checkpoint present", ev("typeof Store.checkpoint==='function'"), "startup checkpoint method");
  s.ok("feedback opens WhatsApp", !!$("#feedbackBtn") && ev('FEEDBACK_WHATSAPP')==="41796476540" && /wa\.me/.test(html) && !/mailto:/.test(html), "wa.me, no mailto");

  // ---- NEW (v1.1.0): clickable storage location + image-to-folder ----
  s.ok("footer location is clickable", ev('typeof document.getElementById("dataLocation").onclick==="function"') && /chooseLocation/.test(html), "onclick + chooseLocation");
  s.ok("location label shows folder only (no file)", /el\.textContent="📁 "\+st\.name;/.test(html) && !/st\.name\+"\/"\+JSON_NAME/.test(html), "folder name only");
  s.ok("images go in a subfolder", ev("typeof getImagesDir==='function' && IMG_DIR==='images'") && /getDirectoryHandle\(IMG_DIR/.test(html) && /writeFileTo\(idir, name, f\)/.test(html), "images/ subdir write");
  s.ok("image read falls back to legacy root", /readImageHandle/.test(html) && /getImagesDir\(false\)/.test(html), "subfolder then root");
  s.ok("image helpers present", ev("typeof imageSrcFor==='function' && typeof prewarmImages==='function' && typeof imageNameFor==='function' && typeof deleteImageFile==='function'"), "imageSrcFor/prewarm/name/delete");
  s.ok("image filename is project-scoped + timestamped", ev(`(()=>{ const n=imageNameFor({id:'abc'},{name:'x.JPG'}); return /^Technicolour-Planner-image-abc-.*\\.jpg$/.test(n); })()`), "named per project + ext");
  s.ok("imageSrcFor falls back to inline data url", ev(`imageSrcFor({id:'q', image:'data:image/png;base64,AA'})==='data:image/png;base64,AA'`), "data url fallback");
  s.ok("attach writes file in file mode (not inline)", await ev(`(async()=>{
    let wrote=null; Store.mode="file";
    Store.dir={ name:"F", queryPermission:async()=>"granted", requestPermission:async()=>"granted",
      getFileHandle:async(n,o)=>({ createWritable:async()=>({ write:async(c)=>{ wrote={name:n,isFile:(c&&c.name)||false}; }, close:async()=>{} }) }),
      removeEntry:async()=>{}, entries:async function*(){} };
    const f=new File([new Uint8Array([1,2,3])],"shot.png",{type:"image/png"});
    const name=imageNameFor({id:'p1'},f);
    await writeFileTo(Store.dir,name,f);
    return JSON.stringify({ wrote, named:/image-p1-.*\\.png$/.test(name) });
  })()`).then(r=>{ const o=JSON.parse(r); return o.named && o.wrote && /image-p1-/.test(o.wrote.name); }), "file written to folder");
  s.ok("image file not caught by backup pruning regex", !/^Technicolour-Planner-(backup|checkpoint)-.*\.json$/.test("Technicolour-Planner-image-p1-2026.png"), "images survive prune");

  // ---- NEW (v1.3.2): checkpoints live in a saves/ subfolder ----
  s.ok("saves subfolder helpers present", ev("typeof getSavesDir==='function' && SAVES_DIR==='saves' && typeof migrateSavesToSubfolder==='function'"), "getSavesDir + SAVES_DIR + migrate");
  s.ok("all three checkpoint writers target getSavesDir", (html.match(/getSavesDir\(true\)\) \|\| this\.dir/g)||[]).length>=3, "_backupRaw + backup + checkpoint");
  s.ok("legacy checkpoints swept into saves on boot", /migrateSavesToSubfolder\(\)/.test(html) && /sweep any root checkpoints/.test(html), "boot calls migrate");
  s.ok("migrate moves a root checkpoint into saves and deletes the original", await ev(`(async()=>{
    let movedTo=null, removed=null;
    const sub={ name:"saves", getFileHandle:async(n)=>({ createWritable:async()=>({ write:async(c)=>{ movedTo={name:n,len:String(c).length}; }, close:async()=>{} }) }), removeEntry:async()=>{}, entries:async function*(){} };
    Store.mode="file";
    Store.dir={ name:"F", queryPermission:async()=>"granted", requestPermission:async()=>"granted",
      getDirectoryHandle:async()=>sub,
      getFileHandle:async(n)=>({ getFile:async()=>({ text:async()=>'{"projects":[]}' }) }),
      removeEntry:async(n)=>{ removed=n; },
      entries:async function*(){ yield ["Technicolour-Planner-checkpoint-2026-01-01.json",{kind:"file"}]; yield ["Technicolour-Planner-Data.json",{kind:"file"}]; } };
    await migrateSavesToSubfolder();
    return JSON.stringify({ movedTo, removed });
  })()`).then(r=>{ const o=JSON.parse(r); return o.movedTo && /checkpoint-2026/.test(o.movedTo.name) && /checkpoint-2026/.test(o.removed||""); }), "moved + removed root copy");
  s.ok("office export lazy-loaded", /loadExporter/.test(html) && /import\("\.\/src\/export\.js"\)/.test(html), "dynamic import");
  s.ok("SW registration guarded", /register\("service-worker\.js"/.test(html) && /location\.protocol\.startsWith\("http"\)/.test(html), "guarded");

  // ---- auto-update mechanism (source-level) ----
  s.ok("update reload ignores the first claim only", /firstControllerSeen/.test(html), "no first-load reload, later updates reload");
  s.ok("service worker skipWaiting on install", /self\.skipWaiting\(\)/.test(swSrc), "auto-activate");
  s.ok("precache bypasses HTTP cache", /cache: "reload"/.test(swSrc) && /updateViaCache: "none"/.test(html), "no stale precache");
  s.ok("update check on refocus + interval", /visibilitychange/.test(html) && /setInterval\(check/.test(html), "auto-update polling");
  s.ok("no em-dashes in app UI strings", checkNoEmDashUi(html), "writing guide");

  // ---- NEW (v1.1.2): title dedup, maximize, conditional clear / hide-non-matching ----
  const manifest = JSON.parse(readFileSync(ROOT + "manifest.webmanifest", "utf8"));
  const titleText = ($("title") && $("title").textContent || "").trim();
  s.ok("manifest name matches <title> (no doubled window title)", manifest.name === titleText, `${manifest.name} == ${titleText}`);
  s.ok("maximize-on-open helper present + called", ev("typeof maximizeWindow==='function'") && /maximizeWindow\(\)/.test(html) && /resizeTo\(screen\.availWidth/.test(html), "resizeTo availWidth/Height");
  // Drive the filter state: empty → both disabled; one active → both enabled.
  ev("clearFilters()");
  s.ok("clear greyed when nothing to clear", ev('document.getElementById("clearFilter").disabled===true'), "clear disabled");
  s.ok("hide-non-matching disabled when nothing to match", ev('document.getElementById("filterMode").disabled===true'), "filterMode disabled");
  ev("toggleFilter('discovery')");
  s.ok("clear enabled once a filter is active", ev('document.getElementById("clearFilter").disabled===false'), "clear enabled");
  s.ok("hide-non-matching enabled once there's something to match", ev('document.getElementById("filterMode").disabled===false'), "filterMode enabled");
  s.ok("clearing again unticks + disables hide-non-matching", ev("(()=>{ const fm=document.getElementById('filterMode'); fm.checked=true; filterHide=true; clearFilters(); return fm.checked===false && fm.disabled===true; })()"), "untick on clear");
  ev("clearFilters()");

  // ---- NEW (v1.2.0): French removed, workdays, catch-up tray, library filter, quick roll ----
  s.ok("French option removed", !/data-lang/.test(html) && !/DOW_FR/.test(html) && !/Français/.test(html), "no lang toggle");
  s.ok("migration v1->v2 adds workdays (Sat off)", ev("(()=>{ const x=migrateState({projects:[],schemaVersion:1,settings:{lang:'en',colors:{}}}); return x.schemaVersion===CURRENT_SCHEMA && Array.isArray(x.settings.workdays) && x.settings.workdays.length===7 && x.settings.workdays[5]===false; })()"), "workdays[5]=false");
  ev("state.settings.workdays=[true,true,true,true,true,false,true]; renderBoard();");
  s.ok("day-off greyed + NO POST when empty", $$("#board .day.dayoff").length>=1 && $$("#board .nopost").length>=1, `${$$("#board .day.dayoff").length} dayoff, ${$$("#board .nopost").length} nopost`);
  s.ok("settings renders 7 workday toggles", (()=>{ ev("buildSettings()"); return $$("#workdays button").length===7; })(), `${$$("#workdays button").length} toggles`);
  s.ok("catch-up tray flags a past unposted piece", ev(`(()=>{ state.projects.push({id:'ovd1',title:'OVERDUE',type:'reel',targets:['authority'],date:'2026-01-01',storyCodes:[],stages:{prep:false,shot:false,edited:false,posted:false},tasks:[]}); return overduePieces().some(p=>p.id==='ovd1'); })()`), "overdue selected");
  s.ok("roll to next week lands on a working day (skips days off)", ev(`(()=>{ state.settings.workdays=[false,true,true,true,true,false,true]; const p=state.projects.find(x=>x.id==='ovd1'); rollToWeek(p, nextWeekStart()); return isWorkday(p.date) && p.date>=nextWeekStart(); })()`), "working day, next week");
  s.ok("mark posted removes it from catch-up", ev(`(()=>{ const p=state.projects.find(x=>x.id==='ovd1'); p.stages.posted=true; return !overduePieces().some(x=>x.id==='ovd1'); })()`), "posted leaves tray");
  s.ok("catch-up shows 'All caught up' when none overdue", ev(`(()=>{ state.projects=state.projects.filter(p=>!isOverdue(p)); renderCatchup(); return /All caught up/.test(document.getElementById('catchup').textContent); })()`), "empty state");
  s.ok("library filter present, ordered todo/posted/all, default todo", !!$("#libFilter") && $$("#libFilter [data-status]").map(b=>b.dataset.status).join(",")==="todo,posted,all" && /let libStatus="todo"/.test(html) && $('#libFilter [data-status="todo"]').getAttribute("aria-pressed")==="true", "todo first + selected");
  s.ok("quick next-week button on board cards", $$("#board .card .rollbtn").length>=1 && /→ next wk/.test(html), `${$$("#board .card .rollbtn").length} rollbtns`);
  s.ok("detail drawer has today + next-week quick dates", /firstWorkday\(nextWeekStart\(\), TODAY\)/.test(html), "drawer quick dates");

  // ---- NEW (v1.3.3): week label = relative prefix + dotted dates, no slash/dash ----
  s.ok("weekPrefix reads the relative week", ev(`weekPrefix(curWeekStart())==="This week" && weekPrefix(nextWeekStart())==="Next week" && weekPrefix(addDays(curWeekStart(),-7))==="Last week" && weekPrefix(addDays(curWeekStart(),14))==="2 weeks from now" && weekPrefix(addDays(curWeekStart(),-14))==="2 weeks ago"`), "this/next/last/±2");
  s.ok("week label shows prefix + dotted range, no slash or dash", ev(`(()=>{ state.weekStart=curWeekStart(); renderBoard(); const t=document.getElementById('weekLabel').textContent; return /^This week · /.test(t) && /\\d+\\.\\d+ to \\d+\\.\\d+\\.\\d{4}/.test(t) && !t.includes('/') && !t.includes('–') && !t.includes('—'); })()`), "This week · 8.6 to 14.6.2026");
  s.ok("day-column dates use dots not slashes", ev(`(()=>{ renderBoard(); const dts=[...document.querySelectorAll('#board .dt')]; return dts.length===7 && dts.every(e=>/^\\d+\\.\\d+$/.test(e.textContent.trim())); })()`), "Mon 8.6 etc");

  // ---- NEW (v1.2.2): wider drawer, 'Bigger' editor, no confusing Done button ----
  s.ok("confusing 'Done' button removed from drawer", $("#d-done")===null, "no d-done");
  s.ok("close button clearly labelled", /✕ Close/.test($("#d-close").textContent), $("#d-close").textContent.trim());
  s.ok("drawer widened toward a third+", /\.drawer\{[^}]*width:clamp\(520px,38vw,900px\)/.test(html), "clamp 38vw");
  s.ok("big editor overlay present", !!$("#bigEdit") && !!$("#bigEditArea"), "bigEdit modal");
  ev("openDetail(state.projects[0].id)");
  s.ok("description + notes have a 'Bigger' button", $$("#d-scroll .biggerbtn").length>=2, `${$$("#d-scroll .biggerbtn").length} bigger`);
  s.ok("music + hook share a row", $$("#d-scroll .field2").length>=1, `${$$("#d-scroll .field2").length} field2`);
  s.ok("'Bigger' opens roomy editor synced to the field, then closes", ev(`(()=>{ const b=document.querySelector('#d-scroll .biggerbtn'); b.click(); const m=document.getElementById('bigEdit'); const ta=document.querySelector('#d-scroll textarea'); const area=document.getElementById('bigEditArea'); const ok=m.classList.contains('open') && area.value===ta.value; document.getElementById('bigEditClose').click(); return ok && !m.classList.contains('open'); })()`), "open+sync+close");
  ev("closeDrawer()");

  // ---- NEW (v1.2.3): aligned buttons, wider drawer, image thumbnail actions, dimensions hint ----
  s.ok("drawer buttons don't wrap (so heights align)", /\.drawer button\{white-space:nowrap\}/.test(html), "nowrap");
  s.ok("drawer widened for alignment", /\.drawer\{[^}]*width:clamp\(520px,38vw,900px\)/.test(html), "clamp 38vw");
  s.ok("task dropdown has room for its arrow", /select\{padding-right:30px\}/.test(html), "select padding-right");
  s.ok("image field hints ideal wide dimensions", /wide \/ landscape works best, about 1280 × 720/.test(html), "dimensions hint");
  s.ok("no-image: shows 'Add a picture' button, not a bare file dialog", ev(`(()=>{ const p=state.projects[0]; p.image=null; p.imageName=null; delete IMG_CACHE[p.id]; openDetail(p.id); return !!document.querySelector('#d-scroll .addimg') && !document.querySelector('#d-scroll .thumbwrap'); })()`), "addimg");
  s.ok("with image: shows the picture + change/remove icons on it", ev(`(()=>{ const p=state.projects[0]; p.image='data:image/png;base64,AA'; openDetail(p.id); const tw=document.querySelector('#d-scroll .thumbwrap'); return !!tw && !!tw.querySelector('img') && tw.querySelectorAll('.acts button').length===2; })()`), "thumbwrap + 2 icons");
  s.ok("file input hidden (icons drive it)", ev(`(()=>{ const fi=document.querySelector('#d-scroll input[type=file]'); return !!fi && fi.style.display==='none'; })()`), "hidden file input");
  ev("closeDrawer()");

  // ---- NEW (v1.2.4): human-friendly date hint (weekday + this/next week) ----
  s.ok("date hint reads 'today' for today", ev("/\\(today\\)$/.test(dateLabel(TODAY))"), ev("dateLabel(TODAY)"));
  s.ok("date hint reads 'next week' for next week", ev("/\\(next week\\)$/.test(dateLabel(addDays(nextWeekStart(),1)))"), "next week");
  s.ok("date hint leads with a weekday name", ev("/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) /.test(dateLabel(TODAY))"), "weekday");
  s.ok("drawer shows the date hint under the picker", ev(`(()=>{ const p=state.projects.find(x=>x.date)||state.projects[0]; p.date=TODAY; openDetail(p.id); const h=document.querySelector('#d-scroll .datehint'); return !!h && /\\(today\\)$/.test(h.textContent); })()`), "datehint in drawer");
  ev("closeDrawer()");

  // ---- NEW (v1.3.0): Turn-over usage index + 'New' disabled there ----
  ev("setView('turnover')");
  s.ok("'New' button greyed on Turn-over", ev('document.getElementById("newBtn").disabled===true'), "disabled");
  s.ok("'New' button enabled on Board", ev("(()=>{ setView('board'); const d=document.getElementById('newBtn').disabled; setView('turnover'); return d===false; })()"), "enabled on board");
  s.ok("targets render as 4 usage cards", $$("#targetLegend .ucard").length===4, `${$$("#targetLegend .ucard").length}`);
  s.ok("story codes render as 5 usage cards", $$("#storyLegend .ucard").length===5, `${$$("#storyLegend .ucard").length}`);
  s.ok("activities render as 5 usage cards", $$("#activityLegend .ucard").length===5, `${$$("#activityLegend .ucard").length}`);
  s.ok("every hook shows a usage card", $$("#hookList .ucard").length===ev("HOOKS.length"), `${$$("#hookList .ucard").length}/${ev("HOOKS.length")}`);
  s.ok("unused hooks are clearly marked", $$("#hookList .ucard.zero").length>0, `${$$("#hookList .ucard.zero").length} unused`);
  s.ok("usage cards show a count badge", $$("#targetLegend .ucard .ucount").length===4, "ucount present");
  s.ok("a used target expands to its pieces", ev(`(()=>{ const c=[...document.querySelectorAll('#targetLegend .ucard')].find(x=>!x.classList.contains('zero')); c.querySelector('.uh').click(); return c.classList.contains('open') && c.querySelectorAll('.ubody .urow').length>0; })()`), "expand → pieces");
  s.ok("clicking a piece row opens its editor", ev(`(()=>{ const r=document.querySelector('#targetLegend .ucard.open .urow'); r.click(); return openId!=null && document.getElementById('drawer').classList.contains('open'); })()`), "opens drawer");
  ev("closeDrawer(); setView('board')");

  // ---- NEW (v1.3.1): calmer grouped Settings ----
  s.ok("settings grouped into 4 calm sections", $$("#settingsModal .set-group").length===4, `${$$("#settingsModal .set-group").length} groups`);
  s.ok("settings has a sticky header + clear Close", !!$("#settingsModal .set-head") && /✕ Close/.test($("#settingsClose").textContent), $("#settingsClose").textContent.trim());
  s.ok("settings body scrolls", /\.set-body\{overflow:auto/.test(html), "scroll body");
  s.ok("all wired settings controls still present", ["lowstim","workdays","colorRemap","dataStatus","setLocationBtn","backupNowBtn","importBtn","exportBtn","persistStatus","xlsxBtn","docxBtn","pptxBtn"].every(id=>!!$("#settingsModal #"+id)), "ids intact");
  s.ok("no duplicate footer note (noise removed)", !/Use ⬇ Export \(top\) for a plain JSON backup/.test(html), "trimmed");

  // ---- NEW (v1.3.2): Calm mode actually calms ----
  s.ok("calm mode kills all motion", /body\.lowstim \*[^{]*\{[^}]*transition:none !important/.test(html) && /animation:none !important/.test(html), "transition+animation off");
  s.ok("calm mode pastel-shifts (hue kept, neon gone)", /body\.lowstim\{[^}]*filter:saturate\(\.7\) brightness\(1\.02\)/.test(html), "saturate+brightness");
  s.ok("calm mode removes shadows + hover flash", /body\.lowstim[^]*box-shadow:none !important/.test(html) && /body\.lowstim button:hover\{ background:var\(--panel\)/.test(html), "no shadow, no hover flash");
  s.ok("OS reduce-motion preference honoured", /@media \(prefers-reduced-motion: reduce\)/.test(html), "prefers-reduced-motion block");
  s.ok("calm mode is described in settings (the 'define' ask)", /Stops all movement, softens the colours/.test(html), "what-it-does help line");
  s.ok("calm toggle adds the lowstim body class", ev(`(()=>{ document.body.classList.remove('lowstim'); const cb=document.getElementById('lowstim'); cb.checked=true; cb.onchange({target:cb}); const on=document.body.classList.contains('lowstim'); cb.checked=false; cb.onchange({target:cb}); return on && !document.body.classList.contains('lowstim'); })()`), "toggle on/off");

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
