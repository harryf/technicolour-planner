// Runs the whole suite: jsdom unit tests, then real-Chrome browser tests. Exit code is non-zero on any failure.
import { runUnit } from "./unit.mjs";
import { runBrowser } from "./browser.mjs";

console.log("🌈 Technicolour Planner test suite");
const u = await runUnit();
u.print();
const b = await runBrowser();
b.print();

const passed = u.passed + b.passed;
const failed = u.failed + b.failed;
console.log(`\nTOTAL: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
