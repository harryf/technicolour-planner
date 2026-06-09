// Tiny test-result collector. No dependencies, plain output.

export class Suite {
  constructor(name) { this.name = name; this.results = []; }
  ok(id, cond, note = "") { this.results.push({ id, pass: !!cond, note }); return !!cond; }
  eq(id, actual, expected, note = "") {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    return this.ok(id, pass, note || `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
  skip(id, note = "") { this.results.push({ id, pass: true, skipped: true, note }); }
  get passed() { return this.results.filter(r => r.pass).length; }
  get failed() { return this.results.filter(r => !r.pass).length; }
  print() {
    console.log(`\n${this.name}`);
    for (const r of this.results) {
      const mark = r.skipped ? "  -" : (r.pass ? "  ok" : "  FAIL");
      console.log(`${mark} ${r.id}${r.note ? ": " + r.note : ""}`);
    }
    console.log(`  (${this.passed} passed, ${this.failed} failed)`);
  }
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
