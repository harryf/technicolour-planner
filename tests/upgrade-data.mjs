// Cross-version DATA migration test: proves a real v1.3.3 (schema 2) file — the exact shape Sarah is
// running — upgrades cleanly under the CURRENT migrateState. The fixture in fixtures/v1.3.3-state.json
// was captured by booting the real v1.3.3 app (git tag v1.3.3) in jsdom and dumping its persisted state.
// Regenerate it only if the v1.3.3 persisted shape ever needs re-capturing (it shouldn't — it's frozen).
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Suite, sleep } from "./lib/assert.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export async function runUpgradeData() {
  const s = new Suite("Data migration (v1.3.3 → current, jsdom)");
  const html = readFileSync(ROOT + "index.html", "utf8");
  const fixture = JSON.parse(readFileSync(ROOT + "tests/fixtures/v1.3.3-state.json", "utf8"));

  const vc = new VirtualConsole();
  const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole: vc, url: "http://localhost/", pretendToBeVisual: true });
  const { window: win } = dom.window;
  await sleep(600);
  // Run the CURRENT migrator on the real old file. Returns the migrated state as JSON.
  const migrate = (obj) => JSON.parse(win.eval(`JSON.stringify(migrateState(${JSON.stringify(obj)}))`));

  // ---- sanity: the fixture really is the old format ----
  s.ok("fixture is real v1.3.3 (schema 2)", fixture.schemaVersion === 2, `schema=${fixture.schemaVersion}`);
  s.ok("fixture has Sarah's pieces", fixture.projects.length >= 10, `${fixture.projects.length} pieces`);
  s.ok("fixture has NO timestamps yet", fixture.projects.every(p => !("createdAt" in p) && !("updatedAt" in p)), "no created/updated");
  s.ok("fixture has NO libSort yet", !("libSort" in fixture.settings), "no libSort");
  const beforeTitles = fixture.projects.map(p => p.title);

  // ---- the upgrade ----
  const after = migrate(fixture);
  s.ok("migrates to schema 4", after.schemaVersion === 4, `schema=${after.schemaVersion}`);
  s.ok("no pieces lost", after.projects.length === fixture.projects.length, `${after.projects.length}/${fixture.projects.length}`);
  s.ok("every piece gets timestamps", after.projects.every(p => typeof p.createdAt === "string" && typeof p.updatedAt === "string"), "created+updated on all");
  s.ok("piece order preserved", JSON.stringify(after.projects.map(p => p.title)) === JSON.stringify(beforeTitles), "titles identical, same order");
  const ts = after.projects.map(p => p.createdAt);
  s.ok("timestamps monotonic (oldest→newest)", ts.every((t, i) => i === 0 || t >= ts[i - 1]), "non-decreasing");
  s.ok("default sort added", after.settings.libSort === "recent", `libSort=${after.settings.libSort}`);

  // ---- her settings survive untouched ----
  s.ok("workdays preserved", JSON.stringify(after.settings.workdays) === JSON.stringify(fixture.settings.workdays), JSON.stringify(after.settings.workdays));
  s.ok("colour remap preserved", JSON.stringify(after.settings.colors) === JSON.stringify(fixture.settings.colors), "colors intact");
  s.ok("calm-mode pref preserved", after.settings.lowstim === fixture.settings.lowstim, `lowstim=${after.settings.lowstim}`);

  // ---- no per-piece data loss (spot-check a fully-populated piece) ----
  const before0 = fixture.projects[0], after0 = after.projects[0];
  s.ok("piece keeps its content", after0.title === before0.title && after0.type === before0.type &&
    JSON.stringify(after0.targets) === JSON.stringify(before0.targets) && after0.date === before0.date &&
    JSON.stringify(after0.stages) === JSON.stringify(before0.stages) && JSON.stringify(after0.tasks) === JSON.stringify(before0.tasks),
    "title/type/targets/date/stages/tasks all intact");

  // ---- idempotent: re-running the migrator changes nothing (no re-stamp, no reorder) ----
  const again = migrate(after);
  s.ok("re-migrate is a no-op", again.schemaVersion === 4 &&
    JSON.stringify(again.projects.map(p => [p.title, p.createdAt, p.updatedAt])) ===
    JSON.stringify(after.projects.map(p => [p.title, p.createdAt, p.updatedAt])), "timestamps + order stable");

  // ---- functional: after upgrade, default sort puts the newest-created piece top-left ----
  const sortedTitles = JSON.parse(win.eval(`(()=>{ const st=migrateState(${JSON.stringify(fixture)});
    return JSON.stringify(sortProjects(st.projects).map(p=>p.title)); })()`));
  s.ok("'Recently worked on' = newest first", sortedTitles[0] === beforeTitles[beforeTitles.length - 1], `top: ${sortedTitles[0]}`);

  // ---- a hand-crafted, messy but realistic schema-2 file also survives ----
  const messy = {
    schemaVersion: 2,
    settings: { lang: "en", lowstim: true, colors: { conversion: "#123456" }, workdays: [true, false, true, true, true, true, false] },
    weekStart: "2026-06-08", updatedAt: "2026-06-20T10:00:00.000Z",
    projects: [
      { id: "p_old1", type: "post", targets: ["conversion"], date: "2026-06-10", music: "", hook: "", desc: "d", notes: "",
        storyCodes: [], image: null, imageName: "Technicolour-Planner-image-p_old1-2026.png",
        stages: { prep: true, shot: true, edited: true, posted: true }, tasks: [{ id: "t1", text: "x", activity: "edit", done: true }], title: "Posted piece" },
      { id: "p_old2", type: "story", targets: [], date: null, title: "Minimal idea" }, // missing optional arrays on purpose
    ],
  };
  let messyOut = null, threw = false;
  try { messyOut = migrate(messy); } catch (e) { threw = true; }
  s.ok("messy schema-2 file migrates without throwing", !threw && messyOut && messyOut.schemaVersion === 4, threw ? "threw" : "schema 4");
  s.ok("messy file: both pieces timestamped", !!messyOut && messyOut.projects.every(p => p.createdAt && p.updatedAt), "all stamped");
  s.ok("messy file: custom workdays + colours kept", !!messyOut &&
    JSON.stringify(messyOut.settings.workdays) === JSON.stringify(messy.settings.workdays) &&
    messyOut.settings.colors.conversion === "#123456", "settings intact");
  s.ok("messy file: posted/tasks/imageName survive", !!messyOut && messyOut.projects[0].stages.posted === true &&
    messyOut.projects[0].tasks.length === 1 && messyOut.projects[0].imageName === "Technicolour-Planner-image-p_old1-2026.png", "content intact");

  // ---- live boot: Sarah opens the updated app with her v1.3.3 file already in storage ----
  // Pre-seed localStorage with the real v1.3.3 file, then boot the CURRENT app and confirm it loads
  // and upgrades on open (proves the boot/load plumbing, not just migrateState in isolation).
  const vc2 = new VirtualConsole();
  const errs2 = [];
  vc2.on("jsdomError", e => errs2.push(e.message));
  const dom2 = new JSDOM(html, {
    runScripts: "dangerously", virtualConsole: vc2, url: "http://localhost/", pretendToBeVisual: true,
    beforeParse(window) { window.localStorage.setItem("technicolour_planner_v1", JSON.stringify(fixture)); },
  });
  const win2 = dom2.window;
  await sleep(700); // let boot() load from storage + migrate
  s.ok("boot loads her file (no clean reseed)", win2.eval("state.projects.length") === fixture.projects.length,
    `${win2.eval("state.projects.length")} pieces loaded`);
  s.ok("boot upgraded her file to schema 4", win2.eval("state.schemaVersion") === 4, `schema=${win2.eval("state.schemaVersion")}`);
  s.ok("boot stamped every piece", win2.eval("state.projects.every(p=>!!p.createdAt && !!p.updatedAt)"), "timestamps present after boot");
  s.ok("boot kept her piece order", win2.eval(`JSON.stringify(state.projects.map(p=>p.title))`) === JSON.stringify(beforeTitles), "same order");
  s.ok("boot had no jsdom errors", errs2.length === 0, errs2.slice(0, 2).join(" | ") || "clean");

  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await runUpgradeData();
  s.print();
  process.exit(s.failed ? 1 : 0);
}
