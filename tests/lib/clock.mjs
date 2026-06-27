// Deterministic clock for the tests.
//
// The app reads "today" exactly once at load (`const TODAY = ymd(new Date())`) and the board opens on
// the week containing today. The shipped seed data is dated to a fixed week (Mon 8 .. Sun 14 Jun 2026),
// so as the real date drifts past that week the "board shows her seeded world" tests would find an empty
// current week and fail. Rather than change Sarah's real seed dates, we freeze "today" to a day inside
// the seed week before any app script runs, so those tests are deterministic forever.
//
// SEED_TODAY is a Wednesday inside the seed week. DATE_MOCK_SOURCE is injected into the page/jsdom
// window BEFORE the app script runs (jsdom: `beforeParse`; real Chrome: addScriptToEvaluateOnNewDocument).

export const SEED_TODAY = "2026-06-10";

export const DATE_MOCK_SOURCE = `(() => {
  const RealDate = Date;
  const FIXED = new RealDate(2026, 5, 10, 9, 0, 0).getTime(); // 10 Jun 2026, 09:00 local (inside the seed week)
  class MockDate extends RealDate {
    constructor(...a){ a.length ? super(...a) : super(FIXED); }
    static now(){ return FIXED; }
  }
  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;
  (typeof window !== "undefined" ? window : globalThis).Date = MockDate;
})();`;
