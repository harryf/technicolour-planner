// Runs the whole suite: jsdom unit tests, then real-Chrome browser tests. Exit code is non-zero on any failure.
import { runUnit } from "./unit.mjs";
import { runBrowser } from "./browser.mjs";
import { runUpgrade } from "./upgrade.mjs";

console.log("🌈 Technicolour Planner test suite");
const u = await runUnit();
u.print();
const b = await runBrowser();
b.print();
const up = await runUpgrade();
up.print();

const passed = u.passed + b.passed + up.passed;
const failed = u.failed + b.failed + up.failed;
console.log(`\nTOTAL: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
