// Runs the whole suite: jsdom unit tests, then real-Chrome browser tests. Exit code is non-zero on any failure.
import { runUnit } from "./unit.mjs";
import { runBrowser } from "./browser.mjs";
import { runUpgrade } from "./upgrade.mjs";
import { runUpgradeData } from "./upgrade-data.mjs";

console.log("🌈 Technicolour Planner test suite");
const u = await runUnit();
u.print();
const b = await runBrowser();
b.print();
const up = await runUpgrade();
up.print();
const ud = await runUpgradeData();
ud.print();

const passed = u.passed + b.passed + up.passed + ud.passed;
const failed = u.failed + b.failed + up.failed + ud.failed;
console.log(`\nTOTAL: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
