#!/usr/bin/env node
// Smoke-test one arcade game in headless Chrome. No dependencies.
//
//   node scripts/arcade-smoke.mjs <slug> [steps...]
//
// Steps run in the order given:
//   --play               start the game (same as pressing Play)
//   --advance <sec>      run the simulation for that many seconds, instantly (g.advance)
//   --wait <ms>          let real time pass (real frames, real timers)
//   --down <Code>        hold a key (KeyboardEvent.code, e.g. ArrowRight, Space, KeyA)
//   --up <Code>          release it
//   --tap <Code>         press, advance one frame, release
//   --click <x,y>        pointer click at stage fraction (0..1, 0..1), e.g. 0.5,0.5
//   --answer right|wrong answer the open question card
//   --eval "<js>"        evaluate in the page and print the result (window.__arcade is the game)
//   --shot <file.png>    save a screenshot
//   --size <WxH>         viewport, default 960x540 (give it before other steps)
//   --page <path>        open a different path under public/ instead of arcade/<slug>/index.html
// Exits 1 if the page logged an error or threw.
import { createServer } from "node:http";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const slug = args.shift();
if (!slug) { console.error("usage: node scripts/arcade-smoke.mjs <slug> [steps...]"); process.exit(2); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/favicon.ico") { res.writeHead(204); return res.end(); }
    if (p.endsWith("/")) p += "index.html";
    const file = join(ROOT, p);
    if (!file.startsWith(ROOT)) throw new Error("outside");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const profile = await mkdtemp(join(tmpdir(), "arcade-smoke-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, failed = false;
const cleanup = async () => { try { ws?.close(); } catch {} chrome.kill("SIGKILL"); server.close(); await sleep(150); await rm(profile, { recursive: true, force: true }).catch(() => {}); };
const killTimer = setTimeout(async () => { console.error("TIMEOUT after 120 s"); await cleanup(); process.exit(1); }, 120000);

try {
  let dport = 0;
  for (let i = 0; i < 100 && !dport; i++) {
    await sleep(100);
    try { dport = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); } catch {}
  }
  if (!dport) throw new Error("Chrome did not start");
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    const list = await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json();
    target = list.find((t) => t.type === "page");
    if (!target) await sleep(100);
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const waiting = new Map();
  const errors = [];
  let loaded = null;
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { const { r, j } = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? j(new Error(msg.error.message)) : r(msg.result); return; }
    if (msg.method === "Runtime.exceptionThrown") { const d = msg.params.exceptionDetails; errors.push("EXCEPTION " + (d.exception?.description || d.text) + (d.url ? ` (${d.url}:${d.lineNumber})` : "")); }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push("console.error " + msg.params.args.map((a) => a.description || a.value).join(" "));
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push("LOG " + msg.params.entry.text + " " + (msg.params.entry.url || ""));
    if (msg.method === "Page.loadEventFired") loaded?.();
  };
  const send = (method, params = {}) => new Promise((r, j) => { waiting.set(++id, { r, j }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error("eval failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  let size = [960, 540];
  let path = `arcade/${slug}/index.html`;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--size") size = args[i + 1].split("x").map(Number);
    if (args[i] === "--page") path = args[i + 1].replace(/^\/(?!\/)/, "");
  }
  await send("Emulation.setDeviceMetricsOverride", { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false });
  const done = new Promise((r) => (loaded = r));
  await send("Page.navigate", { url: /^https?:/.test(path) ? path : `http://127.0.0.1:${port}/${path}` });
  await Promise.race([done, sleep(15000)]);
  await sleep(600);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const v = args[i + 1];
    if (a === "--size" || a === "--page") { i++; continue; }
    if (a === "--play") { await evaluate(`window.__arcade.start()`); await sleep(120); }
    else if (a === "--advance") { i++; await evaluate(`window.__arcade.advance(${Number(v)})`); }
    else if (a === "--wait") { i++; await sleep(Number(v)); }
    else if (a === "--down") { i++; await evaluate(`window.__arcade.keys.press(${JSON.stringify(v)})`); }
    else if (a === "--up") { i++; await evaluate(`window.__arcade.keys.release(${JSON.stringify(v)})`); }
    else if (a === "--tap") { i++; await evaluate(`(()=>{const g=window.__arcade;g.keys.press(${JSON.stringify(v)});g.advance(1/60);g.keys.release(${JSON.stringify(v)});})()`); }
    else if (a === "--click") {
      i++;
      const [fx, fy] = v.split(",").map(Number);
      const box = await evaluate(`(()=>{const r=document.querySelector(".ak-stage").getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()`);
      const x = box[0] + box[2] * fx, y = box[1] + box[3] * fy;
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      await sleep(60);
    }
    else if (a === "--answer") { i++; await evaluate(`window.__arcade.answerOpen(${v !== "wrong"})`); await sleep(1100); }
    else if (a === "--eval") { i++; console.log("eval>", JSON.stringify(await evaluate(v))); }
    else if (a === "--shot") {
      i++;
      await sleep(250);
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(v, Buffer.from(data, "base64"));
      console.log("shot>", v);
    }
    else { console.error("unknown step", a); failed = true; }
  }
  const state = await evaluate(`window.__arcade ? window.__arcade.state : "NO __arcade (createGame was not called)"`);
  console.log("state>", state);
  if (errors.length) { failed = true; console.log("ERRORS:\n" + [...new Set(errors)].slice(0, 20).join("\n")); } else console.log("no page errors");
} catch (e) {
  failed = true;
  console.error("SMOKE FAILED:", e.message);
} finally {
  clearTimeout(killTimer);
  await cleanup();
}
process.exit(failed ? 1 : 0);
