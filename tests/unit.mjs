// Unit / functional tests for index.html, run under jsdom (Node, not Bun: Bun's jsdom hits a Proxy error).
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Suite, sleep } from "./lib/assert.mjs";
import { DATE_MOCK_SOURCE } from "./lib/clock.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export async function runUnit() {
  const s = new Suite("Unit (jsdom)");
  const html = readFileSync(ROOT + "index.html", "utf8");
  const swSrc = readFileSync(ROOT + "service-worker.js", "utf8");

  const errs = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole: vc, url: "http://localhost/", pretendToBeVisual: true,
    beforeParse(window) { window.eval(DATE_MOCK_SOURCE); } }); // freeze "today" inside the seed week (deterministic board)
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
  s.ok("schema bumped to 6", ev("CURRENT_SCHEMA===6"), `CURRENT_SCHEMA=${ev("CURRENT_SCHEMA")}`);
  s.ok("seed pieces carry timestamps", ev("state.projects.every(p=>typeof p.createdAt==='string' && typeof p.updatedAt==='string')"), "createdAt/updatedAt on all");
  s.ok("migrate 2→4 backfills order", ev(`(()=>{const x=migrateState({schemaVersion:2,settings:{},projects:[{id:'a'},{id:'b'},{id:'c'}]});
    return x.schemaVersion===CURRENT_SCHEMA && x.projects.every(p=>p.createdAt) && x.projects[0].createdAt < x.projects[2].createdAt;})()`), "oldest→newest preserved");
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
  // dated library cards show the planned date (📅 + friendly dateLabel) next to the progress buttons
  ev("state.settings.libSort='recent'; libStatus='all'; renderLibrary();");
  s.ok("library cards show the planned date", ev(`(()=>{ const dated=state.projects.find(p=>p.date);
    const card=[...document.querySelectorAll('#libgrid .card')].find(c=>c.dataset.id===dated.id);
    const d=card&&card.querySelector('.carddate');
    return !!d && d.textContent.includes(dateLabel(dated.date)); })()`), "carddate = 📅 dateLabel");
  s.ok("undated library card shows no date line", ev(`(()=>{ const u=state.projects.find(p=>!p.date); if(!u) return true;
    const card=[...document.querySelectorAll('#libgrid .card')].find(c=>c.dataset.id===u.id);
    return !!card && !card.querySelector('.carddate'); })()`), "no date → no carddate");
  s.ok("board (compact) cards have no library date line", ev(`(()=>{ setView('board'); return ![...document.querySelectorAll('#board .card')].some(c=>c.querySelector('.carddate')); })()`), "compact omits carddate");
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
  s.ok("activities render as 4 usage cards", $$("#activityLegend .ucard").length===4, `${$$("#activityLegend .ucard").length}`);
  s.ok("every hook shows a usage card", $$("#hookList .ucard").length===ev("HOOKS.length"), `${$$("#hookList .ucard").length}/${ev("HOOKS.length")}`);
  s.ok("unused hooks are clearly marked", $$("#hookList .ucard.zero").length>0, `${$$("#hookList .ucard.zero").length} unused`);
  s.ok("usage cards show a count badge", $$("#targetLegend .ucard .ucount").length===4, "ucount present");
  s.ok("used cards default to OPEN (no click needed)", ev(`(()=>{ const c=[...document.querySelectorAll('#targetLegend .ucard')].find(x=>!x.classList.contains('zero')); return c.classList.contains('open') && c.querySelectorAll('.ubody .urow').length>0; })()`), "open by default");
  s.ok("clicking a piece row opens its editor", ev(`(()=>{ const r=document.querySelector('#targetLegend .ucard.open .urow'); r.click(); return openId!=null && document.getElementById('drawer').classList.contains('open'); })()`), "opens drawer");
  ev("closeDrawer();");

  // ---- NEW (v1.5.0): Turn-over sub-tabs, sort, default-open, activity row format ----
  ev("setView('turnover')");
  s.ok("Turn-over has 5 sub-tabs", $$("#turnoverTabs [data-sub]").length===5, $$("#turnoverTabs [data-sub]").map(b=>b.dataset.sub).join(","));
  s.ok("sub-tab order: targets,activities,story,hooks,tools", JSON.stringify($$("#turnoverTabs [data-sub]").map(b=>b.dataset.sub))===JSON.stringify(["targets","activities","story","hooks","tools"]), "priority order");
  s.ok("default sub-tab is Targets (only one visible)", !$("#sub-targets").hidden && $("#sub-activities").hidden && $("#sub-story").hidden && $("#sub-hooks").hidden, "targets shown, rest hidden");
  s.ok("Turn-over sort has 3 options, no colour", JSON.stringify($$("#turnoverSort [data-sort]").map(b=>b.dataset.sort))===JSON.stringify(["recent","date","title"]), "recent/date/title");
  s.ok("Turn-over default sort is 'recent'", ev("turnoverSort()==='recent' && state.settings.turnoverSort==='recent'"), ev("state.settings.turnoverSort"));
  // switching sub-tab shows the right panel + persists
  ev(`document.querySelector('#turnoverTabs [data-sub=\\"activities\\"]').click()`);
  s.ok("clicking Activities shows only that panel", $("#sub-activities").hidden===false && $("#sub-targets").hidden===true, "activities visible");
  s.ok("sub-tab choice persists", ev("state.settings.turnoverTab==='activities'"), ev("state.settings.turnoverTab"));
  s.ok("activity rows read 'Project → Task' with long date on right", ev(`(()=>{
    const r=document.querySelector('#activityLegend .ucard.open .urow.taskrow'); if(!r) return false;
    const proj=r.querySelector('.tproj'), arr=r.querySelector('.tarrow'), desc=r.querySelector('.tdesc');
    const when=r.querySelector('.when').textContent;
    const longDate = when==='no date' || /\\((today|this week|next week|last week|in \\d+ weeks|\\d+ weeks ago)\\)/.test(when);
    return !!proj && !!arr && !!desc && proj.textContent.length>0 && desc.textContent.length>0 && /→/.test(arr.textContent) && longDate; })()`), "project → task(focus) + dateLabel");
  s.ok("the task text is the visually-strong part (bold)", /\.tdesc\{[^}]*font-weight:700/.test(html.replace(/\s+/g,"")), "tdesc font-weight:700");
  // A→Z sort actually reorders pieces inside a card
  ev(`document.querySelector('#turnoverTabs [data-sub=\\"targets\\"]').click(); document.querySelector('#turnoverSort [data-sort=\\"title\\"]').click()`);
  s.ok("A→Z sort orders pieces inside a card", ev(`(()=>{
    const k=TARGET_ORDER.find(k=>state.projects.some(p=>(p.targets.length?p.targets:['discovery']).includes(k)));
    const pieces=state.projects.filter(p=>(p.targets.length?p.targets:['discovery']).includes(k));
    const exp=JSON.stringify(sortPiecesT(pieces).map(p=>p.title));
    const c=[...document.querySelectorAll('#targetLegend .ucard.open')][0];
    const got=JSON.stringify([...c.querySelectorAll('.ubody .urow .ttl')].map(e=>e.textContent));
    return exp===got; })()`), "DOM order matches sortPiecesT(title)");
  s.ok("sort choice persists", ev("state.settings.turnoverSort==='title'"), ev("state.settings.turnoverSort"));
  s.ok("new turnover settings are additive (defaulted on migrate)", ev("migrateState({schemaVersion:2,settings:{},projects:[]}).settings.turnoverTab==='targets'"), "defaulted");

  // ---- NEW: the "Show me:" target chips now filter the Turn-over tab too, same as Board/Library ----
  s.ok("matchesFilter respects activeFilters", ev(`(()=>{ activeFilters.clear(); activeFilters.add('retention');
    const a=matchesFilter({targets:['retention']}), b=matchesFilter({targets:['discovery']}); activeFilters.clear(); return a===true && b===false; })()`), "match vs non-match");
  s.ok("applyRowFilter dims non-matching rows (dim mode)", ev(`(()=>{ activeFilters.clear(); activeFilters.add('retention'); filterHide=false;
    const r=document.createElement('div'); r.className='urow'; applyRowFilter(r,{targets:['discovery']});
    const d=r.classList.contains('dim'); activeFilters.clear(); return d; })()`), "row .dim");
  s.ok("applyRowFilter hides non-matching rows (hide mode)", ev(`(()=>{ activeFilters.clear(); activeFilters.add('retention'); filterHide=true;
    const r=document.createElement('div'); r.className='urow'; applyRowFilter(r,{targets:['discovery']});
    const h=r.style.display==='none'; activeFilters.clear(); filterHide=false; return h; })()`), "row hidden");
  s.ok("applyCardFilter dims a card with no matching pieces", ev(`(()=>{ activeFilters.clear(); activeFilters.add('retention'); filterHide=false;
    const c=document.createElement('div'); c.className='ucard'; applyCardFilter(c,[{targets:['discovery']},{targets:['authority']}]);
    const d=c.classList.contains('dim'); activeFilters.clear(); return d; })()`), "card .dim");
  s.ok("a target chip actually dims Turn-over rows (integration)", ev(`(()=>{ setView('turnover'); state.settings.turnoverTab='targets'; activeFilters.clear(); filterHide=false; renderAll();
    const before=document.querySelectorAll('#view-turnover .urow.dim').length;
    activeFilters.add('retention'); renderAll();
    const after=document.querySelectorAll('#view-turnover .urow.dim').length;
    activeFilters.clear(); renderAll(); setView('board');
    return before===0 && after>0; })()`), "0 dimmed → some dimmed when 'retention' selected");

  ev("state.settings.turnoverTab='targets'; state.settings.turnoverSort='recent'; activeFilters.clear(); filterHide=false; setView('board')");

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

  // ---- NEW (v1.6.0): Board calendar view ----
  s.ok("calendar: boardMode is additive (defaulted on migrate)",
    ev("defaultState().settings.boardMode==='week' && migrateState({projects:[]}).settings.boardMode==='week'"),
    "boardMode defaulted");
  s.ok("calendar: Week/Calendar toggle switches view + persists", ev(`(()=>{ setView('board'); setBoardMode('calendar');
    const onCal = boardMode()==='calendar' && document.getElementById('calendar').hidden===false && document.getElementById('board').style.display==='none';
    setBoardMode('week');
    const onWeek = boardMode()==='week' && document.getElementById('calendar').hidden===true && document.getElementById('board').style.display!=='none';
    return onCal && onWeek; })()`), "calendar<->week + display toggling");
  s.ok("calendar: month helpers (monthOf/sameMonth)",
    ev("monthOf('2026-06-30').m===5 && monthOf('2026-07-01').m===6 && sameMonth(monthOf('2026-06-01'),monthOf('2026-06-30')) && !sameMonth(monthOf('2026-06-30'),monthOf('2026-07-01'))"),
    "June=5, July=6, same vs different");
  s.ok("calendar: range = earliest dated week .. one blank week past the latest", ev(`(()=>{
    const save0=state.projects; const cur=curWeekStart();
    const past=addDays(cur,-21), future=addDays(cur,14);
    state.projects=[{id:'a',date:past},{id:'b',date:future}];
    const w=calendarWeeks(); state.projects=save0;
    return w[0]===isoWeekStart(parseYMD(past)) && w[w.length-1]===addDays(isoWeekStart(parseYMD(future)),7); })()`),
    "starts at earliest, ends one week past latest");
  s.ok("calendar: a split week is shown once per month (duplicated), others once", ev(`(()=>{
    const save0=state.projects;
    state.projects=[{id:'x',date:addDays(curWeekStart(),42),title:'X',type:'reel',targets:['discovery'],stages:{},tasks:[],storyCodes:[]}]; // a 6-week span always crosses a month boundary
    setView('board'); setBoardMode('calendar');
    const rows=[...document.querySelectorAll('#calInner .cal-week')].map(r=>[...r.querySelectorAll('.cal-day')].map(c=>c.dataset.date).join(','));
    const counts={}; rows.forEach(sig=>counts[sig]=(counts[sig]||0)+1);
    const isBoundary=sig=>{ const ds=sig.split(','); return monthOf(ds[0]).m!==monthOf(ds[6]).m; };
    let ok=true, sawDup=false;
    for(const sig in counts){ if(isBoundary(sig)){ sawDup=true; if(counts[sig]!==2) ok=false; } else if(counts[sig]!==1) ok=false; }
    setBoardMode('week'); state.projects=save0; renderAll();
    return ok && sawDup; })()`), "boundary week x2, others x1");
  s.ok("calendar: wrong-month day is a greyed, inert ghost (visible, no add, not draggable)", ev(`(()=>{
    const save0=state.projects;
    state.projects=[{id:'g',date:'2026-07-01',title:'G',type:'reel',targets:['discovery'],stages:{},tasks:[],storyCodes:[]}];
    const tmp=document.createElement('div');
    calWeekRow(tmp,'2026-06-29',{y:2026,m:5}); // week Mon 29 Jun..Sun 5 Jul rendered under JUNE
    const jul1=[...tmp.querySelectorAll('.cal-day')].find(c=>c.dataset.date==='2026-07-01');
    const ghost=jul1.querySelector('.card.ghost');
    const r = jul1.classList.contains('offmonth') && !!ghost && !jul1.querySelector('.cal-add') && ghost.draggable===false;
    state.projects=save0; return r; })()`), "1 Jul under June = ghost + inert");
  s.ok("calendar: in-month day is active (add button + accepts a drop)", ev(`(()=>{
    const save0=state.projects; const cur=curWeekStart();
    state.projects=[{id:'d',date:addDays(cur,1),title:'D',type:'reel',targets:['discovery'],stages:{},tasks:[],storyCodes:[]}];
    setView('board'); setBoardMode('calendar');
    const card=document.querySelector('#calInner .card.mini');
    const target=[...document.querySelectorAll('#calInner .cal-day:not(.offmonth)')].find(c=>c.dataset.date!==state.projects[0].date && !c.querySelector('.card'));
    const tDate=target.dataset.date, hasAdd=!!target.querySelector('.cal-add');
    const evt=new window.Event('drop',{bubbles:true,cancelable:true});
    Object.defineProperty(evt,'dataTransfer',{value:{getData:()=>card.dataset.id}});
    target.dispatchEvent(evt);
    const moved=state.projects[0].date===tDate;
    setBoardMode('week'); state.projects=save0; renderAll();
    return hasAdd && moved; })()`), "add present + drop reschedules");
  s.ok("week nav is centred + bold like the Week/Calendar toggle",
    /\.weeknav\{[^}]*position:absolute/.test(html) && /\.weeknav button\{font-weight:700\}/.test(html) && !!$("#weekNav.weeknav"),
    "centred (absolute) + weight 700");
  s.ok("catch-up: 'next month' rolls to the first working day of next month", ev(`(()=>{
    const save0=state.projects;
    const od={id:'nm1',title:'NM',type:'reel',targets:['authority'],date:'2026-01-01',storyCodes:[],stages:{prep:false,shot:false,edited:false,posted:false},tasks:[]};
    state.projects=[od]; setView('board'); renderCatchup();
    const row=document.querySelector('#catchup .catchup-row');
    const btn=[...row.querySelectorAll('button')].find(b=>/next month/.test(b.textContent));
    btn.click();
    const exp=firstWorkdayFrom(firstOfNextMonth());
    const r = od.date===exp && monthOf(od.date).m===monthOf(firstOfNextMonth()).m && isWorkday(od.date);
    state.projects=save0; renderAll(); return r; })()`), "first working day, next month");
  s.ok("catch-up: a 'still to do' row drags onto the board to reschedule", ev(`(()=>{
    const save0=state.projects, wk0=state.weekStart;
    const od={id:'dg1',title:'DG',type:'reel',targets:['authority'],date:'2026-01-01',storyCodes:[],stages:{prep:false,shot:false,edited:false,posted:false},tasks:[]};
    state.projects=[od]; setBoardMode('week'); setView('board'); state.weekStart=curWeekStart(); renderAll();
    const row=document.querySelector('#catchup .catchup-row');
    const draggable = row.draggable===true;
    const targetDay=document.querySelector('#board .day'); const tDate=targetDay.dataset.date;
    const evt=new window.Event('drop',{bubbles:true,cancelable:true});
    Object.defineProperty(evt,'dataTransfer',{value:{getData:()=>od.id}});
    targetDay.dispatchEvent(evt);
    const moved = od.date===tDate;
    state.projects=save0; state.weekStart=wk0; renderAll();
    return draggable && moved; })()`), "row draggable + drop reschedules");
  s.ok("catch-up: drag image is the project only (no action buttons)", ev(`(()=>{
    const save0=state.projects;
    const od={id:'di1',title:'DI piece',type:'reel',targets:['authority'],date:'2026-01-01',storyCodes:[],stages:{prep:false,shot:false,edited:false,posted:false},tasks:[]};
    state.projects=[od]; setView('board'); renderCatchup();
    const row=document.querySelector('#catchup .catchup-row');
    let img=null; const dt={ setData(){}, setDragImage(el){ img=el; } };
    const e=new window.Event('dragstart',{bubbles:true}); Object.defineProperty(e,'dataTransfer',{value:dt});
    row.dispatchEvent(e);
    const ok = img && img.classList.contains('cu-main') && img.querySelectorAll('button.pill').length===0 && !!img.querySelector('.stripes') && /DI piece/.test(img.textContent);
    row.dispatchEvent(new window.Event('dragend',{bubbles:true}));
    state.projects=save0; renderAll(); return ok; })()`), "drag image = .cu-main, no .pill buttons");
  s.ok("calendar scrolls with the page (no inner scroll box)",
    !/\.cal-wrap\{[^}]*overflow/.test(html) && !/\.cal-wrap\{[^}]*max-height/.test(html),
    "no overflow/max-height on .cal-wrap");

  // ---- NEW (v2.0): quick wins ----
  // 1) multiple hooks per piece (single hook → array, lossless)
  s.ok("v2: single hook migrates to a hooks array (lossless)", ev(`(()=>{
    const x=migrateState({schemaVersion:3,settings:{},projects:[{id:'h',hook:'Fast cuts',tasks:[]}]});
    const p=x.projects[0];
    return x.schemaVersion===CURRENT_SCHEMA && Array.isArray(p.hooks) && p.hooks.length===1 && p.hooks[0]==='Fast cuts' && !('hook' in p) && p.storyboard==='';
  })()`), "hooks=['Fast cuts'], old key gone");
  s.ok("v2: hooks show as removable chips + an 'add hooks' button", ev(`(()=>{
    const p={id:'mh',title:'MH',type:'reel',targets:['discovery'],hooks:['Fast cuts'],storyboard:'',storyCodes:[],stages:{prep:false,shot:false,edited:false,posted:false},tasks:[]};
    state.projects.push(p); openDetail('mh');
    const chips=document.querySelectorAll('#d-scroll .hookchip');
    const hasAdd=!![...document.querySelectorAll('#d-scroll button')].find(b=>/add hooks/.test(b.textContent));
    const ok = chips.length===1 && /Fast cuts/.test(chips[0].textContent) && !!chips[0].querySelector('.x');
    closeDrawer(); state.projects=state.projects.filter(x=>x.id!=='mh');
    return ok && hasAdd;
  })()`), "1 chip + add button");
  s.ok("v2: picker attaches a 2nd hook and toggles it off", ev(`(()=>{
    const p={id:'mh2',title:'MH2',type:'reel',targets:['discovery'],hooks:['Fast cuts'],storyboard:'',storyCodes:[],stages:{},tasks:[]};
    state.projects.push(p); openHookPicker(p,()=>{});
    const item=[...document.querySelectorAll('#hookModalList .hook')].find(h=>/Opinion/.test(h.textContent));
    item.click(); const added=p.hooks.includes('Opinion');
    const sel=[...document.querySelectorAll('#hookModalList .hook')].find(h=>/Opinion/.test(h.textContent)).classList.contains('sel');
    item.click(); const removed=!p.hooks.includes('Opinion');
    document.getElementById('hookModal').classList.remove('open');
    state.projects=state.projects.filter(x=>x.id!=='mh2');
    return added && sel && removed;
  })()`), "toggle on (sel) then off");
  // 2) editable + reorderable tasks
  s.ok("v2: a task is editable in place (text + colour) and has a drag grip", ev(`(()=>{
    const p={id:'tk1',title:'TK',type:'reel',targets:['discovery'],hooks:[],storyboard:'',storyCodes:[],stages:{},
      tasks:[{id:'a',text:'first',activity:'shoot',done:false},{id:'b',text:'second',activity:'edit',done:false}]};
    state.projects.push(p); openDetail('tk1');
    const row=document.querySelector('#d-scroll .task');
    const editable=!!row.querySelector('input.taskedit') && !!row.querySelector('select.taskact') && !!row.querySelector('.grip');
    const ti=row.querySelector('input.taskedit'); ti.value='first-edited'; ti.dispatchEvent(new window.Event('input'));
    const sel=row.querySelector('select.taskact'); sel.value='brainstorm'; sel.dispatchEvent(new window.Event('change'));
    const r = editable && p.tasks[0].text==='first-edited' && p.tasks[0].activity==='brainstorm';
    closeDrawer(); state.projects=state.projects.filter(x=>x.id!=='tk1');
    return r;
  })()`), "edit text + activity, grip present");
  s.ok("v2: dragging a task reorders the list", ev(`(()=>{
    const p={id:'tk2',title:'TK2',type:'reel',targets:['discovery'],hooks:[],storyboard:'',storyCodes:[],stages:{},
      tasks:[{id:'a',text:'first',activity:'shoot',done:false},{id:'b',text:'second',activity:'edit',done:false}]};
    state.projects.push(p); openDetail('tk2');
    const rows=[...document.querySelectorAll('#d-scroll .task')];
    const evt=new window.Event('drop',{bubbles:true,cancelable:true});
    Object.defineProperty(evt,'dataTransfer',{value:{getData:()=>'0',types:['text/task-idx']}});
    rows[1].dispatchEvent(evt);
    const r = p.tasks[0].id==='b' && p.tasks[1].id==='a';
    closeDrawer(); state.projects=state.projects.filter(x=>x.id!=='tk2');
    return r;
  })()`), "drop row 0 onto row 1 swaps order");
  // 3) "Priority" task colour retired
  s.ok("v2: Priority activity removed (4 colours left)", ev("!('priority' in ACTIVITIES) && Object.keys(ACTIVITIES).length===4"), "no priority key");
  s.ok("v2: migration folds a 'priority' task into 'Just do it'", ev(`(()=>{
    const x=migrateState({schemaVersion:3,settings:{},projects:[{id:'pr',tasks:[{id:'t',text:'x',activity:'priority',done:false}]}]});
    return x.projects[0].tasks[0].activity==='justdo';
  })()`), "priority→justdo");
  s.ok("v2: actColor tolerates a retired key without crashing", ev("actColor('priority')===ACTIVITIES.justdo.color && actColor('shoot')===ACTIVITIES.shoot.color"), "fallback to justdo");
  // 4) Storyboard field
  s.ok("v2: Storyboard shows for reels, hidden for empty posts, shown once a post has content", ev(`(()=>{
    const reel={id:'sb1',title:'SB',type:'reel',targets:['discovery'],hooks:[],storyboard:'',storyCodes:[],stages:{},tasks:[]};
    const post={id:'sb2',title:'PB',type:'post',targets:['discovery'],hooks:[],storyboard:'',storyCodes:[],stages:{},tasks:[]};
    state.projects.push(reel,post);
    const lab=()=>[...document.querySelectorAll('#d-scroll label')].some(l=>/Storyboard/.test(l.textContent));
    openDetail('sb1'); const reelHas=lab();
    openDetail('sb2'); const postHidden=!lab();
    post.storyboard='structure here'; openDetail('sb2'); const postShown=lab();
    closeDrawer(); state.projects=state.projects.filter(x=>!['sb1','sb2'].includes(x.id));
    return reelHas && postHidden && postShown;
  })()`), "reel yes, empty post no, filled post yes");
  // 5) type filter (reels/posts/stories), an independent axis combined with the target filter
  s.ok("v2: Type filter chips exist (reel/post; story removed in v2.2)", $$('.chip[data-type]').length===2 && ["reel","post"].every(t=>!!$('.chip[data-type="'+t+'"]')) && !$('.chip[data-type="story"]'), `${$$('.chip[data-type]').length}`);
  s.ok("v2: type filter narrows by format and clears", ev(`(()=>{
    clearFilters(); const all=pieceMatches({type:'reel',targets:['discovery']});
    toggleTypeFilter('post'); const reelOut=pieceMatches({type:'reel',targets:['discovery']}); const postIn=pieceMatches({type:'post',targets:['discovery']});
    clearFilters(); const cleared=pieceMatches({type:'reel',targets:['discovery']});
    return all && !reelOut && postIn && cleared;
  })()`), "post-only hides reels");
  s.ok("v2: target + type filters combine with AND", ev(`(()=>{
    clearFilters(); toggleFilter('authority'); toggleTypeFilter('reel');
    const a=pieceMatches({type:'reel',targets:['authority']});
    const b=pieceMatches({type:'post',targets:['authority']});
    const c=pieceMatches({type:'reel',targets:['discovery']});
    clearFilters();
    return a && !b && !c;
  })()`), "authority AND reel only");

  // ---- NEW (v2.1): editable tools & hooks library ----
  s.ok("v2.1: library seeded (hooks + 5 tool dimensions)", ev(`Array.isArray(state.library.hooks) && state.library.hooks.length>0
    && Array.isArray(state.library.toolDims) && state.library.toolDims.length===5
    && state.library.toolDims[0].name==='Tool' && state.library.toolDims[0].items.length>0`), "hooks + Tool/Rule/Theme/Subject/Structure");
  s.ok("v2.1: migrating from schema 4 builds library + adds p.tools (lossless)", ev(`(()=>{
    const x=migrateState({schemaVersion:4,settings:{},projects:[{id:'a',hooks:['X'],tasks:[]}]});
    return x.schemaVersion===CURRENT_SCHEMA && x.library && Array.isArray(x.library.hooks) && Array.isArray(x.library.toolDims)
      && Array.isArray(x.projects[0].tools) && x.projects[0].hooks[0]==='X';
  })()`), "library built, tools=[], hooks kept");
  s.ok("v2.1: hook picker reads from the (editable) library", ev(`(()=>{
    const id='lh'+Math.random().toString(36).slice(2,7);
    state.library.hooks.push({id,label:'ZZ Test Hook',taps:['curiosity']});
    const p={id:'pk',title:'PK',type:'reel',targets:[],hooks:[],tools:[],storyboard:'',storyCodes:[],stages:{},tasks:[]};
    state.projects.push(p); openHookPicker(p,()=>{});
    const found=[...document.querySelectorAll('#hookModalList .hook')].some(h=>/ZZ Test Hook/.test(h.textContent));
    document.getElementById('hookModal').classList.remove('open');
    state.library.hooks=state.library.hooks.filter(h=>h.id!==id); state.projects=state.projects.filter(x=>x.id!=='pk');
    return found;
  })()`), "new library hook appears in picker");
  s.ok("v2.1: tool dimensions show for reels, not posts", ev(`(()=>{
    const reel={id:'tr',title:'TR',type:'reel',targets:[],hooks:[],tools:[],storyboard:'',storyCodes:[],stages:{},tasks:[]};
    const post={id:'tp',title:'TP',type:'post',targets:[],hooks:[],tools:[],storyboard:'',storyCodes:[],stages:{},tasks:[]};
    state.projects.push(reel,post);
    openDetail('tr'); const reelHas=!!document.querySelector('#d-scroll .toolgroup') && [...document.querySelectorAll('#d-scroll .tooldim-h')].some(e=>/Tool/.test(e.textContent));
    openDetail('tp'); const postNo=!document.querySelector('#d-scroll .toolgroup');
    closeDrawer(); state.projects=state.projects.filter(x=>!['tr','tp'].includes(x.id));
    return reelHas && postNo;
  })()`), "reel yes, post no");
  s.ok("v2.1: attaching a tool auto-adds its pillar (never auto-removes)", ev(`(()=>{
    const dim=state.library.toolDims[0];
    const it={id:'ti'+Math.random().toString(36).slice(2,7),label:'ZZ Auth Tool',pillars:['authority']}; dim.items.push(it);
    const p={id:'at',title:'AT',type:'reel',targets:[],hooks:[],tools:[],storyboard:'',storyCodes:[],stages:{},tasks:[]};
    state.projects.push(p); openDetail('at'); openToolPicker(p,dim);
    [...document.querySelectorAll('#hookModalList .hook')].find(h=>/ZZ Auth Tool/.test(h.textContent)).click();
    const attached = p.tools.includes(it.id) && p.targets.includes('authority');
    openToolPicker(p,dim);
    [...document.querySelectorAll('#hookModalList .hook')].find(h=>/ZZ Auth Tool/.test(h.textContent)).click();
    const stayed = !p.tools.includes(it.id) && p.targets.includes('authority');
    document.getElementById('hookModal').classList.remove('open'); closeDrawer();
    dim.items=dim.items.filter(x=>x.id!==it.id); state.projects=state.projects.filter(x=>x.id!=='at');
    return attached && stayed;
  })()`), "attach colours pillar; detach keeps it");
  s.ok("v2.1: Tools manager renders 5 dimension blocks + can add an item", ev(`(()=>{
    setView('turnover'); state.settings.turnoverTab='tools'; renderTurnover();
    const blocks=document.querySelectorAll('#toolManager .tooldim-block').length;
    const before=state.library.toolDims[0].items.length;
    const form=document.querySelector('#toolManager .tooldim-block .additem');
    form.querySelector('input').value='ZZ New Item';
    [...form.querySelectorAll('button')].find(b=>/add/.test(b.textContent)).click();
    const after=state.library.toolDims[0].items.length;
    state.library.toolDims[0].items=state.library.toolDims[0].items.filter(it=>it.label!=='ZZ New Item');
    state.settings.turnoverTab='targets'; setView('board');
    return blocks===5 && after===before+1;
  })()`), "5 blocks, add works");
  s.ok("v2.1: item edit forms start hidden (not the [hidden]+display gotcha)", ev(`(()=>{
    setView('turnover'); state.settings.turnoverTab='tools'; renderTurnover();
    const forms=[...document.querySelectorAll('#toolManager .ucard-edit')];
    const allHidden = forms.length>0 && forms.every(f=>f.hidden===true);
    state.settings.turnoverTab='targets'; setView('board');
    return allHidden;
  })()`) && /\.ucard-edit:not\(\[hidden\]\)\{display:flex\}/.test(html) && !/\.ucard-edit\{[^}]*display:flex/.test(html),
    "forms hidden + CSS guards with :not([hidden])");
  s.ok("v2.1: renaming a hook cascades to pieces; deleting strips it", ev(`(()=>{
    const hid='h'+Math.random().toString(36).slice(2,7);
    state.library.hooks.push({id:hid,label:'ZZ Ren',taps:[]});
    const p={id:'rc',title:'RC',type:'reel',targets:[],hooks:['ZZ Ren'],tools:[],storyboard:'',storyCodes:[],stages:{},tasks:[]};
    state.projects.push(p);
    setView('turnover'); state.settings.turnoverTab='hooks'; renderTurnover();
    let card=[...document.querySelectorAll('#hookList .ucard')].find(c=>/ZZ Ren/.test(c.textContent));
    card.querySelector('.iconbtn[aria-label="Edit"]').click();
    card.querySelector('.ucard-edit input').value='ZZ Ren2';
    [...card.querySelectorAll('.ucard-edit button')].find(b=>b.textContent==='Save').click();
    const renamed = p.hooks.includes('ZZ Ren2') && state.library.hooks.find(h=>h.id===hid).label==='ZZ Ren2';
    card=[...document.querySelectorAll('#hookList .ucard')].find(c=>/ZZ Ren2/.test(c.textContent));
    card.querySelector('.iconbtn[aria-label="Delete"]').click();
    const deleted = !state.library.hooks.some(h=>h.id===hid) && !p.hooks.includes('ZZ Ren2');
    state.projects=state.projects.filter(x=>x.id!=='rc'); state.settings.turnoverTab='targets'; setView('board');
    return renamed && deleted;
  })()`), "rename cascades, delete strips");
  s.ok("v2.1: browse-by-pillar dims tools that don't serve the filtered target", ev(`(()=>{
    const dim=state.library.toolDims[0];
    const a={id:'ba'+Math.random().toString(36).slice(2,6),label:'ZZ AuthOnly',pillars:['authority']};
    const d={id:'bd'+Math.random().toString(36).slice(2,6),label:'ZZ DiscOnly',pillars:['discovery']};
    dim.items.push(a,d);
    setView('turnover'); state.settings.turnoverTab='tools'; clearFilters(); toggleFilter('authority'); renderTurnover();
    const cA=[...document.querySelectorAll('#toolManager .ucard')].find(c=>/ZZ AuthOnly/.test(c.textContent));
    const cD=[...document.querySelectorAll('#toolManager .ucard')].find(c=>/ZZ DiscOnly/.test(c.textContent));
    const ok = cA && !cA.classList.contains('dim') && cD && cD.classList.contains('dim');
    clearFilters(); dim.items=dim.items.filter(x=>x.id!==a.id && x.id!==d.id);
    state.settings.turnoverTab='targets'; setView('board');
    return ok;
  })()`), "authority tool lit, discovery tool dimmed");

  // ---- NEW (v2.2): lightweight Stories area ----
  s.ok("v2.2: seed stories live in state.stories, none on the board", ev(`Array.isArray(state.stories) && state.stories.length>0 && state.projects.every(p=>p.type!=='story')`), "stories[] populated, no story projects");
  s.ok("v2.2: Stories tab exists and toggles the view", ev(`(()=>{ setView('stories');
    const shown=!document.getElementById('view-stories').hidden && document.getElementById('view-board').hidden;
    const tab=!!document.querySelector('.tabs [data-view="stories"]'); setView('board'); return shown && tab; })()`), "tab + view");
  s.ok("v2.2: '+ New' offers only reel + post (story removed)", ev(`[...document.querySelectorAll('#newMenu [data-new]')].map(b=>b.dataset.new).join(',')==='reel,post'`), "reel,post");
  s.ok("v2.2: migration 5→6 extracts a story project losslessly (legacy kept)", ev(`(()=>{
    const x=migrateState({schemaVersion:5,settings:{},library:{hooks:[],toolDims:[]},
      projects:[{id:'r1',type:'reel',title:'R',hooks:[],tools:[],tasks:[]},
                {id:'s1',type:'story',title:'S one',storyCodes:[3],date:'2026-06-10',stages:{posted:true},notes:'keep me'}]});
    return x.schemaVersion===6 && x.projects.length===1 && x.projects[0].type==='reel'
      && x.stories.length===1 && x.stories[0].text==='S one' && x.stories[0].codes[0]===3
      && x.stories[0].status==='posted' && x.stories[0].legacy && x.stories[0].legacy.notes==='keep me';
  })()`), "story moved, full original under .legacy");
  s.ok("v2.2: status cycles to-do → ready → posted → to-do", ev(`(()=>{
    const s=addStory({codes:[1],text:'ZZ cycle'}); const a=s.status; cycleStoryStatus(s); const b=s.status; cycleStoryStatus(s); const c=s.status; cycleStoryStatus(s); const d=s.status;
    state.stories=state.stories.filter(x=>x.id!==s.id);
    return a==='todo'&&b==='ready'&&c==='posted'&&d==='todo';
  })()`), "3-state lifecycle");
  s.ok("v2.2: a story added to the stack shows + filters by code", ev(`(()=>{
    const s=addStory({codes:[3],text:'ZZ question',date:null}); setView('stories'); renderStories();
    const inStack=[...document.querySelectorAll('#storyStack .storyrow')].some(r=>/ZZ question/.test(r.textContent));
    storyFilterCode=1; renderStoryStack(); const hiddenAt1=![...document.querySelectorAll('#storyStack .storyrow')].some(r=>/ZZ question/.test(r.textContent));
    storyFilterCode=null; renderStoryStack();
    state.stories=state.stories.filter(x=>x.id!==s.id); setView('board');
    return inStack && hiddenAt1;
  })()`), "appears in stack, code filter works");
  s.ok("v2.2: a dated story lands in its day column + weekly count", ev(`(()=>{
    const date=addDays(state.weekStart,2); const s=addStory({codes:[2],text:'ZZ planned',date});
    setView('stories'); renderStories();
    const col=[...document.querySelectorAll('#storyWeek .day')].find(c=>c.dataset.date===date);
    const inDay=!!col && [...col.querySelectorAll('.storyrow')].some(r=>/ZZ planned/.test(r.textContent));
    const countOk=(storyCountsForWeek(state.weekStart)[2]||0)>=1;
    state.stories=state.stories.filter(x=>x.id!==s.id); setView('board');
    return inDay && countOk;
  })()`), "day cell + count");
  s.ok("v2.2: dragging a story onto a day sets its date", ev(`(()=>{
    const s=addStory({codes:[1],text:'ZZ drag',date:null}); setView('stories'); renderStories();
    const col=document.querySelector('#storyWeek .day'); const tDate=col.dataset.date;
    const evt=new window.Event('drop',{bubbles:true,cancelable:true});
    Object.defineProperty(evt,'dataTransfer',{value:{getData:()=>s.id, types:['text/story']}});
    col.dispatchEvent(evt); const moved=s.date===tDate;
    state.stories=state.stories.filter(x=>x.id!==s.id); setView('board');
    return moved;
  })()`), "drop schedules the story");
  s.ok("v2.2: duplicate makes an undated to-do copy (for reuse)", ev(`(()=>{
    const s=addStory({codes:[2],text:'ZZ dup',date:addDays(state.weekStart,1),status:'ready'});
    const c=duplicateStory(s);
    const ok=c.id!==s.id && c.text===s.text && c.date===null && c.status==='todo' && JSON.stringify(c.codes)===JSON.stringify(s.codes);
    state.stories=state.stories.filter(x=>x.id!==s.id&&x.id!==c.id);
    return ok;
  })()`), "fresh undated copy");
  s.ok("v2.2: stories appear in the markdown mirror", ev(`(()=>{
    const s=addStory({codes:[3],text:'ZZ md story'}); const md=toMarkdown(state);
    state.stories=state.stories.filter(x=>x.id!==s.id);
    return /## Stories/.test(md) && /ZZ md story/.test(md);
  })()`), "## Stories + the line");

  // ---- FULL UPGRADE CHAIN from 1.x (Sarah may be on schema 1, 2 or 3) → current (6) ----
  s.ok("migration: schema 1 (early 1.x) → 6, lossless across the whole chain", ev(`(()=>{
    const old={ schemaVersion:1, settings:{lang:'en',lowstim:false,colors:{conversion:'#abcdef'}}, weekStart:'2026-06-08',
      projects:[
        {id:'r', type:'reel', title:'Old reel', targets:['discovery'], date:'2026-06-10', music:'m', hook:'Fast cuts', desc:'d', notes:'n',
         storyCodes:[], image:null, imageName:null, stages:{prep:true,shot:false,edited:false,posted:false}, tasks:[{id:'t',text:'x',activity:'priority',done:false}]},
        {id:'s', type:'story', title:'Old story', targets:['retention'], date:null, storyCodes:[2], notes:'5.0', stages:{prep:true,shot:true,edited:false,posted:false}}
      ]};
    const x=migrateState(JSON.parse(JSON.stringify(old)));
    const reel=x.projects.find(p=>p.id==='r');
    return x.schemaVersion===6
      && Array.isArray(x.settings.workdays) && x.settings.workdays.length===7        // 1→2
      && x.settings.colors.conversion==='#abcdef'                                    // settings kept
      && reel && reel.createdAt && reel.updatedAt                                    // 2→3 timestamps
      && Array.isArray(reel.hooks) && reel.hooks[0]==='Fast cuts' && !('hook' in reel) // 3→4 hook→hooks
      && typeof reel.storyboard==='string' && reel.tasks[0].activity==='justdo'      // 3→4 storyboard + priority retired
      && Array.isArray(reel.tools)                                                   // 4→5 tools
      && x.library && Array.isArray(x.library.hooks) && Array.isArray(x.library.toolDims) // 4→5 library
      && Array.isArray(x.stories) && x.stories.length===1 && x.stories[0].text==='Old story' // 5→6 story moved
      && x.stories[0].codes[0]===2 && x.stories[0].status==='ready' && x.stories[0].legacy   // status + lossless legacy
      && x.projects.every(p=>p.type!=='story');                                      // none left on the board
  })()`), "schema 1 → 6 end to end");
  s.ok("migration: no schemaVersion (pre-schema 1.x) → 6 without throwing", ev(`(()=>{
    let threw=false, x=null;
    try{ x=migrateState({settings:{lang:'en'}, projects:[{id:'a',type:'post',title:'P',targets:[],date:null,hook:'',stages:{},tasks:[]}]}); }catch(e){ threw=true; }
    return !threw && x.schemaVersion===6 && Array.isArray(x.stories) && !!x.library
      && Array.isArray(x.projects[0].hooks) && Array.isArray(x.projects[0].tools);
  })()`), "missing version normalizes");
  s.ok("migration: schema 3 (late 1.x: v1.4–1.6) → 6", ev(`(()=>{
    const x=migrateState({schemaVersion:3, settings:{workdays:[true,true,true,true,true,false,true],libSort:'recent',colors:{}}, weekStart:'2026-06-08',
      projects:[
        {id:'a',type:'reel',title:'A',targets:[],date:null,hooks:['Opinion'],desc:'',notes:'',storyboard:'',storyCodes:[],stages:{},tasks:[],createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'},
        {id:'b',type:'story',title:'B',storyCodes:[1],stages:{posted:true}}
      ]});
    return x.schemaVersion===6 && !!x.library && x.stories.length===1 && x.stories[0].status==='posted'
      && x.projects.length===1 && Array.isArray(x.projects[0].tools) && x.projects[0].hooks[0]==='Opinion';
  })()`), "schema 3 → 6");
  s.ok("migration: re-running migrateState is stable (no duplicate stories)", ev(`(()=>{
    const once=migrateState({schemaVersion:1,settings:{},projects:[{id:'s',type:'story',title:'X',storyCodes:[1],stages:{}}]});
    const n1=once.stories.length, p1=once.projects.length;
    const twice=migrateState(JSON.parse(JSON.stringify(once)));
    return n1===1 && p1===0 && twice.stories.length===1 && twice.projects.length===0;
  })()`), "idempotent extraction");

  ev("clearFilters(); setBoardMode('week'); setView('board')");

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
