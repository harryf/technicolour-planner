// Launch headless Chrome and drive it over the DevTools Protocol (no dependencies).
// Returns null from launchChrome() when no Chrome binary is found, so callers can skip browser tests.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sleep } from "./assert.mjs";

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find(p => existsSync(p)) || null;
}

export async function launchChrome(portOffset = 0) {
  const bin = findChrome();
  if (!bin) return null;
  const port = 9000 + (process.pid % 1000) + portOffset; // offset lets a run launch a second instance
  const userDir = join(tmpdir(), `tcp-test-chrome-${process.pid}-${portOffset}`);
  const proc = spawn(bin, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--window-size=1100,820", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) break; } catch {}
    await sleep(150);
  }
  return { port, kill: () => { try { proc.kill(); } catch {} } };
}

// Open a fresh page (CDP target) and return a small driver.
export async function newPage(port) {
  const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); let loads = 0;
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Page.loadEventFired") loads++;
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cmd("Page.enable");
  await cmd("Runtime.enable");
  return {
    cmd,
    loads: () => loads,
    resetLoads() { loads = 0; },
    async goto(url) { await cmd("Page.navigate", { url }); },
    async reload() { await cmd("Page.reload", {}); },
    async eval(expr, awaitPromise = true) {
      const r = await cmd("Runtime.evaluate", { expression: expr, awaitPromise, returnByValue: true });
      if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
      return r.result ? r.result.result.value : undefined;
    },
    async setOffline(offline) {
      await cmd("Network.enable");
      await cmd("Network.emulateNetworkConditions", { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    },
    async screenshot(path) {
      const s = await cmd("Page.captureScreenshot", { format: "png" });
      if (s.result && s.result.data) writeFileSync(path, Buffer.from(s.result.data, "base64"));
    },
    close() { ws.close(); },
  };
}
