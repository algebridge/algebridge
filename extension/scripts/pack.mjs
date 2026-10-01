#!/usr/bin/env node
// Builds the Chrome Web Store zip for AlgeBridge Hints and checks it.
//
//   npm run extension:pack
//
// 1. Copies the extension into extension/dist/build, leaving out test/,
//    scripts/, dist/, README.md, STORE_LISTING.md and dot files.
// 2. Writes the store manifest: the localhost / 127.0.0.1 host permissions used
//    for local development are removed. The background's default apiBase
//    (https://learn.algebridge.org) is left as is and checked.
// 3. Zips the build to extension/dist/algebridge-hints-<version>.zip (zip CLI).
// 4. Checks the build and prints a summary. Exits 1 if any check fails. Besides
//    file and syntax checks, it runs the shipped service worker in Node with the
//    store manifest to prove that a localhost API base left in storage still
//    sends problems only to https://learn.algebridge.org, and it checks that
//    STORE_LISTING.md justifies exactly the permissions the manifest asks for.
//    It also proves no shipped script listens to other extensions
//    (onMessageExternal / onConnectExternal), both by reading the code and by
//    running the worker.

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const extDir = resolve(here, "..");
const distDir = join(extDir, "dist");
const buildDir = join(distDir, "build");

const EXCLUDE_TOP = new Set(["test", "scripts", "dist", "README.md", "STORE_LISTING.md", "node_modules"]);
const TEXT_EXT = new Set([".js", ".mjs", ".css", ".html", ".json", ".md", ".txt", ".svg"]);
const LOCAL_HOST = /^(https?|\*):\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//i;
const EXPECTED_API_BASE = "https://learn.algebridge.org";
const EM_DASH = String.fromCharCode(0x2014);
const EMOJI = /\p{Extended_Pictographic}/u;
// What the store build may ask for. Adding a permission means adding it here,
// to STORE_LISTING.md and to the privacy page, on purpose.
const ALLOWED_PERMISSIONS = ["storage", "contextMenus", "activeTab"];
const STORE_HOSTS = [`${EXPECTED_API_BASE}/*`];

const problems = [];
const notes = [];
function check(ok, message) {
  if (!ok) problems.push(message);
  return ok;
}

/* ---------------------------------------------------------------- */
/* Copy                                                             */
/* ---------------------------------------------------------------- */

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    const rel = relative(base, full);
    const top = rel.split(sep)[0];
    if (dir === base && EXCLUDE_TOP.has(top)) continue;
    if (entry.isDirectory()) walk(full, base, out);
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

function copyExtension() {
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  // Keep build output out of git without touching the repo .gitignore.
  writeFileSync(join(distDir, ".gitignore"), "*\n");
  const files = walk(extDir);
  for (const rel of files) {
    const to = join(buildDir, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(extDir, rel), to);
  }
  return files;
}

/* ---------------------------------------------------------------- */
/* Store manifest                                                   */
/* ---------------------------------------------------------------- */

function writeStoreManifest() {
  const raw = readFileSync(join(extDir, "manifest.json"), "utf8");
  const manifest = JSON.parse(raw);
  const before = manifest.host_permissions || [];
  const after = before.filter((p) => !LOCAL_HOST.test(p));
  const removed = before.filter((p) => LOCAL_HOST.test(p));
  if (after.length) manifest.host_permissions = after;
  else delete manifest.host_permissions;
  writeFileSync(join(buildDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { manifest, removed };
}

/* ---------------------------------------------------------------- */
/* Checks                                                           */
/* ---------------------------------------------------------------- */

function pixelSize(file) {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
  return {
    width: Number((out.match(/pixelWidth:\s*(\d+)/) || [])[1]),
    height: Number((out.match(/pixelHeight:\s*(\d+)/) || [])[1]),
  };
}

function manifestReferences(m) {
  const refs = new Set();
  const add = (p) => {
    if (typeof p === "string" && p && !p.includes("*")) refs.add(p.replace(/^\//, ""));
  };
  Object.values(m.icons || {}).forEach(add);
  if (m.action) {
    add(m.action.default_popup);
    const icon = m.action.default_icon;
    if (typeof icon === "string") add(icon);
    else Object.values(icon || {}).forEach(add);
  }
  if (m.background) add(m.background.service_worker);
  for (const cs of m.content_scripts || []) {
    (cs.js || []).forEach(add);
    (cs.css || []).forEach(add);
  }
  for (const war of m.web_accessible_resources || []) (war.resources || []).forEach(add);
  if (m.options_page) add(m.options_page);
  if (m.options_ui) add(m.options_ui.page);
  return [...refs];
}

// Files an HTML page loads by relative path (script src, link href, img src).
function htmlReferences(htmlRel) {
  const html = readFileSync(join(buildDir, htmlRel), "utf8");
  const refs = [];
  const remote = [];
  const re = /<(script|link|img)\b[^>]*?\b(src|href)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, tag, , url] = m;
    if (/^(https?:)?\/\//i.test(url)) {
      if (tag.toLowerCase() !== "link" || /stylesheet/i.test(m[0])) remote.push(url);
      continue;
    }
    if (/^(data|chrome|mailto):/i.test(url) || url.startsWith("#")) continue;
    refs.push(relative(buildDir, resolve(join(buildDir, dirname(htmlRel)), url)));
  }
  return { refs, remote };
}

// Finds innerHTML / outerHTML assignments and insertAdjacentHTML calls whose
// value is anything other than a plain string literal.
export function unsafeHtmlWrites(source) {
  const hits = [];
  const lineOf = (index) => source.slice(0, index).split("\n").length;
  const assign = /\.(innerHTML|outerHTML)\s*(\+?=)(?!=)\s*/g;
  let m;
  while ((m = assign.exec(source))) {
    const start = m.index + m[0].length;
    if (!isPlainLiteralThenEnd(source, start)) hits.push({ line: lineOf(m.index), what: m[1] });
  }
  const adjacent = /\.insertAdjacentHTML\s*\(\s*(["'`])[^"'`]*\1\s*,\s*/g;
  while ((m = adjacent.exec(source))) {
    const start = m.index + m[0].length;
    if (!isPlainLiteralThenEnd(source, start, ")")) hits.push({ line: lineOf(m.index), what: "insertAdjacentHTML" });
  }
  if (/\bdocument\.write(ln)?\s*\(/.test(source)) hits.push({ line: 0, what: "document.write" });
  return hits;
}

// Names of the runtime events that let other extensions in, wherever they are
// used in code (block comments and whole-line // comments are skipped, so the
// notes that explain why there are none do not count).
export function externalListeners(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...new Set([...code.matchAll(/\bon(Message|Connect)External\b/g)].map((m) => m[0]))];
}

function isPlainLiteralThenEnd(src, i, closer) {
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== "`") return false;
  let j = i + 1;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (q === "`" && c === "$" && src[j + 1] === "{") return false;
    if (c === q) break;
    if (q !== "`" && c === "\n") return false;
  }
  if (j >= src.length) return false;
  let k = j + 1;
  while (k < src.length && (src[k] === " " || src[k] === "\t")) k++;
  const next = src[k];
  if (closer) return next === closer;
  return next === undefined || next === ";" || next === "\n" || next === "\r" || next === "}" || next === ")" || next === ",";
}

function runChecks(files, manifest) {
  // Manifest basics
  let parsed = null;
  try {
    parsed = JSON.parse(readFileSync(join(buildDir, "manifest.json"), "utf8"));
  } catch (err) {
    check(false, `store manifest is not valid JSON: ${err.message}`);
  }
  if (!parsed) return;
  check(parsed.manifest_version === 3, "manifest_version must be 3");
  check(/^\d+(\.\d+){0,3}$/.test(parsed.version || ""), `version "${parsed.version}" is not a Chrome version string`);
  check(typeof parsed.name === "string" && parsed.name.length <= 75, "name is missing or longer than 75 characters");
  check(
    typeof parsed.description === "string" && parsed.description.length <= 132,
    `description must be 132 characters or less (has ${String(parsed.description || "").length})`,
  );
  const hp = parsed.host_permissions || [];
  check(!hp.some((p) => LOCAL_HOST.test(p)), "store manifest still lists a localhost host permission");
  check(hp.includes(`${EXPECTED_API_BASE}/*`), `store manifest must keep ${EXPECTED_API_BASE}/* in host_permissions`);
  check(
    JSON.stringify([...hp].sort()) === JSON.stringify([...STORE_HOSTS].sort()),
    `store host_permissions must be exactly ${STORE_HOSTS.join(", ")} (has ${hp.join(", ") || "none"})`,
  );
  for (const perm of parsed.permissions || []) {
    check(ALLOWED_PERMISSIONS.includes(perm), `permission "${perm}" is not on the allowed list in pack.mjs`);
  }
  check(!parsed.optional_host_permissions, "optional_host_permissions is not expected");
  // Without externally_connectable no web page can message the extension.
  // Other extensions could only reach onMessageExternal / onConnectExternal,
  // which nothing registers (checked below). An empty { "ids": [] } adds
  // nothing but a Chrome warning, and any entry would open a door.
  check(
    !("externally_connectable" in parsed),
    "externally_connectable must be left out: no web page can message the extension without it, and the worker has no external listener",
  );
  const csp = (parsed.content_security_policy && parsed.content_security_policy.extension_pages) || "";
  check(/script-src 'self'(;|$)/.test(csp), `extension_pages CSP must be script-src 'self' (has "${csp}")`);
  check(!/unsafe-eval|unsafe-inline|https?:|wasm-unsafe-eval/.test(csp), `extension_pages CSP must not loosen script-src (has "${csp}")`);
  for (const war of parsed.web_accessible_resources || []) {
    for (const res of war.resources || []) {
      check(!/\.(html?|js|mjs|json)$/i.test(res) && !res.includes("*"), `web_accessible_resources exposes ${res}; only styles and images belong there`);
    }
    check(war.use_dynamic_url === true, "web_accessible_resources must set use_dynamic_url so pages cannot detect the extension");
  }

  // Every referenced file exists
  const refs = manifestReferences(parsed);
  for (const ref of refs) check(existsSync(join(buildDir, ref)), `manifest references ${ref}, which is not in the build`);
  const popup = parsed.action && parsed.action.default_popup;
  if (popup && existsSync(join(buildDir, popup))) {
    const { refs: pageRefs, remote } = htmlReferences(popup);
    for (const ref of pageRefs) check(existsSync(join(buildDir, ref)), `${popup} loads ${ref}, which is not in the build`);
    check(remote.length === 0, `${popup} loads remote code or styles: ${remote.join(", ")}`);
  }

  // Icon pixel sizes
  const iconSets = [parsed.icons || {}, (parsed.action && parsed.action.default_icon) || {}];
  for (const set of iconSets) {
    for (const [size, rel] of Object.entries(set)) {
      const file = join(buildDir, rel);
      if (!existsSync(file)) continue;
      const got = pixelSize(file);
      check(
        got.width === Number(size) && got.height === Number(size),
        `${rel} should be ${size}x${size}, is ${got.width}x${got.height}`,
      );
    }
  }

  // Source scans
  const textFiles = files.filter((f) => TEXT_EXT.has(extname(f).toLowerCase()));
  for (const rel of textFiles) {
    const text = readFileSync(join(buildDir, rel), "utf8");
    if (text.includes(EM_DASH)) {
      const lines = text
        .split("\n")
        .map((l, i) => (l.includes(EM_DASH) ? i + 1 : 0))
        .filter(Boolean);
      check(false, `${rel} contains an em dash on line ${lines.slice(0, 5).join(", ")}`);
    }
    const ext = extname(rel).toLowerCase();
    if (ext === ".js") {
      try {
        execFileSync(process.execPath, ["--check", join(buildDir, rel)], { stdio: "pipe" });
      } catch (err) {
        const detail = String(err.stderr || err.message).split("\n").find((l) => /Error/.test(l)) || "syntax error";
        check(false, `${rel} does not parse: ${detail.trim()}`);
      }
    }
    if (ext === ".js" || ext === ".mjs" || ext === ".html") {
      const outside = externalListeners(text);
      if (outside.length) check(false, `${rel} listens to other extensions (${outside.join(", ")}); the extension must answer only its own parts`);
      if (/(?<![\w$])eval\s*\(/.test(text)) check(false, `${rel} calls eval(`);
      if (/\bnew\s+Function\s*\(/.test(text) || /(?<![\w$.])Function\s*\(\s*["'`]/.test(text)) {
        check(false, `${rel} uses new Function`);
      }
      if (/\b(setTimeout|setInterval)\s*\(\s*["'`]/.test(text)) check(false, `${rel} passes a string to setTimeout/setInterval`);
      if (/importScripts\s*\(\s*["'`]https?:/i.test(text)) check(false, `${rel} imports a remote script`);
      for (const hit of unsafeHtmlWrites(text)) {
        check(false, `${rel}${hit.line ? `:${hit.line}` : ""} writes ${hit.what} with a value that is not a plain string literal`);
      }
    }
  }

  // apiBase default in the shipped background
  const swRel = parsed.background && parsed.background.service_worker;
  if (swRel && existsSync(join(buildDir, swRel))) {
    const sw = readFileSync(join(buildDir, swRel), "utf8");
    const m = sw.match(/DEFAULT_API_BASE\s*=\s*["']([^"']+)["']/);
    check(Boolean(m) && m[1] === EXPECTED_API_BASE, `background default apiBase must be ${EXPECTED_API_BASE}`);
  }

  // Content scripts present (written by the other builders)
  for (const cs of parsed.content_scripts || []) {
    for (const js of cs.js || []) {
      const file = join(buildDir, js);
      if (!existsSync(file)) continue;
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .trim();
      check(code.length > 0, `${js} has no code yet (only comments or nothing)`);
    }
  }

  // Nothing private shipped
  for (const rel of files) {
    const top = rel.split(sep)[0];
    check(!EXCLUDE_TOP.has(top), `${rel} should not be in the store build`);
    check(!/\.(map|ts|tsx|log|pem|env)$/i.test(rel), `${rel} should not ship`);
  }
  return parsed;
}

/* ---------------------------------------------------------------- */
/* Store listing matches the manifest                               */
/* ---------------------------------------------------------------- */

// The body of the "## <title>..." section, without its heading line.
function mdSection(md, title) {
  const part = md.split(/^## /m).find((s) => s.startsWith(title));
  return part ? part.slice(part.indexOf("\n") + 1) : "";
}

function checkStoreListing(parsed) {
  const file = join(extDir, "STORE_LISTING.md");
  if (!check(existsSync(file), "STORE_LISTING.md is missing")) return;
  const md = readFileSync(file, "utf8");
  check(!md.includes(EM_DASH), "STORE_LISTING.md contains an em dash");
  check(!EMOJI.test(md), "STORE_LISTING.md contains an emoji");

  const summary = mdSection(md, "Summary").split("\n").map((l) => l.trim()).filter(Boolean)[0] || "";
  check(summary === parsed.description, "STORE_LISTING.md summary must match the manifest description word for word");

  const headings = [...mdSection(md, "Permission justifications").matchAll(/^\*\*(.+?)\*\*\s*$/gm)].map((m) => m[1].trim());
  const perms = parsed.permissions || [];
  for (const p of perms) check(headings.includes(p), `STORE_LISTING.md has no justification for the "${p}" permission`);
  for (const h of headings) {
    if (/^[A-Za-z.]+$/.test(h)) check(perms.includes(h), `STORE_LISTING.md justifies "${h}", which the manifest does not ask for`);
  }
  for (const host of parsed.host_permissions || []) {
    check(headings.some((h) => h.includes(host)), `STORE_LISTING.md has no justification for the host permission ${host}`);
  }
  for (const h of headings.filter((x) => /^Host permission/i.test(x))) {
    const named = (h.match(/\(([^)]+)\)/) || [])[1] || "";
    check((parsed.host_permissions || []).includes(named), `STORE_LISTING.md justifies host ${named || h}, which the store manifest does not ask for`);
  }
  const allSites = (parsed.content_scripts || []).some((cs) => (cs.matches || []).some((m) => m === "<all_urls>" || m.startsWith("*://*/")));
  if (allSites) check(headings.some((h) => /content script/i.test(h)), "STORE_LISTING.md must justify the content script on all sites");
  check(/Single purpose/.test(md) && mdSection(md, "Single purpose").trim().length > 40, "STORE_LISTING.md needs a single purpose statement");
}

/* ---------------------------------------------------------------- */
/* The shipped worker, run with the store manifest                  */
/* ---------------------------------------------------------------- */

// Runs the built service worker in Node with a small chrome.* stand-in and the
// store manifest, and proves four things: a localhost API base planted in
// storage is ignored, setApiBase cannot point it anywhere but the live site,
// a message from another extension is not answered, and the worker registers
// no onMessageExternal / onConnectExternal listener.
async function checkStoreWorker(parsed) {
  const swRel = parsed.background && parsed.background.service_worker;
  if (!swRel || !existsSync(join(buildDir, swRel))) return;
  const source = readFileSync(join(buildDir, swRel), "utf8");
  const stores = { sync: {}, local: {}, session: {} };
  const area = (name) => ({
    get: async (k) => {
      const all = stores[name];
      if (k == null) return structuredClone(all);
      const out = {};
      for (const key of [].concat(k)) if (key in all) out[key] = structuredClone(all[key]);
      return out;
    },
    set: async (o) => Object.assign(stores[name], structuredClone(o)),
    remove: async (k) => [].concat(k).forEach((key) => delete stores[name][key]),
    setAccessLevel: async () => {},
  });
  const listeners = [];
  const external = [];
  const fetched = [];
  const noop = { addListener() {} };
  const chrome = {
    runtime: {
      id: "packcheck",
      getURL: (p) => `chrome-extension://packcheck/${String(p).replace(/^\//, "")}`,
      getManifest: () => structuredClone(parsed),
      onMessage: { addListener: (fn) => listeners.push(fn) },
      onMessageExternal: { addListener: () => external.push("onMessageExternal") },
      onConnectExternal: { addListener: () => external.push("onConnectExternal") },
      onInstalled: noop,
      onStartup: noop,
    },
    storage: { sync: area("sync"), local: area("local"), session: area("session"), onChanged: noop },
    tabs: { query: async () => [], sendMessage: async () => {}, onRemoved: noop },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setBadgeTextColor: async () => {} },
    contextMenus: { removeAll: (cb) => cb && cb(), create: (p, cb) => cb && cb(), onClicked: noop },
    commands: { onCommand: noop },
  };
  const ctx = {
    chrome,
    fetch: async (url) => {
      fetched.push(String(url));
      return new Response(JSON.stringify({ reply: "What could you do first?" }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
    AbortSignal,
    crypto: globalThis.crypto,
    URL,
    console,
    setTimeout,
    clearTimeout,
    structuredClone,
    Response,
  };
  ctx.self = ctx;
  try {
    vm.createContext(ctx);
    vm.runInContext(source, ctx, { filename: swRel });
  } catch (err) {
    check(false, `${swRel} throws on load in the store check: ${err.message}`);
    return;
  }
  const ask = (msg, sender) =>
    new Promise((resolveAsk) => {
      let kept = false;
      for (const fn of listeners) if (fn(msg, sender, resolveAsk) === true) kept = true;
      if (!kept) resolveAsk("not handled");
    });
  const page = { id: "packcheck", tab: { id: 1, url: "https://example.com/hw" }, url: "https://example.com/hw", frameId: 0 };
  const hint = { type: "hint", payload: { problem: "Solve 2x + 3 = 7", action: "first", hints: [] } };

  stores.sync.settings = { enabled: true, mode: "popup", pausedSites: [], apiBase: "http://localhost:3216" };
  const r = await ask(hint, page);
  check(Boolean(r && r.ok), `store worker did not answer a hint request (${JSON.stringify(r)})`);
  check(
    fetched.length === 1 && fetched[0] === `${EXPECTED_API_BASE}/api/extension/hint`,
    `store worker sent the hint to ${fetched.join(", ") || "nowhere"} with a localhost apiBase in storage; it must use ${EXPECTED_API_BASE}`,
  );
  for (const bad of ["http://localhost:3000", "http://127.0.0.1:3216", "https://evil.example", "https://other.algebridge.org"]) {
    const got = typeof ctx.setApiBase === "function" ? await ctx.setApiBase(bad) : EXPECTED_API_BASE;
    check(got === EXPECTED_API_BASE, `store worker accepted setApiBase("${bad}") as ${got}`);
  }
  const foreign = await ask({ type: "settings:get" }, { ...page, id: "someone-else" });
  check(foreign === "not handled", "store worker answered a message from another extension");
  check(external.length === 0, `store worker registered ${external.join(", ")}; other extensions must get no listener`);
  notes.push(`store worker sends hints only to ${EXPECTED_API_BASE} (checked in Node)`);
  notes.push("no onMessageExternal / onConnectExternal listener in the worker or any shipped script");
}

/* ---------------------------------------------------------------- */
/* Zip                                                              */
/* ---------------------------------------------------------------- */

function zipBuild(version) {
  const zipPath = join(distDir, `algebridge-hints-${version}.zip`);
  rmSync(zipPath, { force: true });
  execFileSync("zip", ["-r", "-X", "-q", "-9", zipPath, "."], { cwd: buildDir });
  const listed = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !s.endsWith("/"));
  return { zipPath, listed };
}

/* ---------------------------------------------------------------- */

async function main() {
  if (!existsSync(join(extDir, "manifest.json"))) {
    console.error("pack: extension/manifest.json not found");
    process.exit(1);
  }
  const files = copyExtension();
  const { manifest, removed } = writeStoreManifest();
  const parsed = runChecks(files, manifest);
  if (parsed) {
    checkStoreListing(parsed);
    await checkStoreWorker(parsed);
  }
  const version = (parsed && parsed.version) || manifest.version || "0.0.0";

  let zip = null;
  try {
    zip = zipBuild(version);
    const expected = [...files].sort();
    const got = [...zip.listed].sort();
    const missing = expected.filter((f) => !got.includes(f));
    const extra = got.filter((f) => !expected.includes(f));
    check(missing.length === 0, `zip is missing ${missing.join(", ")}`);
    check(extra.length === 0, `zip has unexpected files ${extra.join(", ")}`);
  } catch (err) {
    check(false, `zip failed: ${err.message}`);
  }

  const totalBytes = files.reduce((n, rel) => n + statSync(join(buildDir, rel)).size, 0);
  console.log("AlgeBridge Hints store build");
  console.log(`  version        ${version}`);
  console.log(`  files          ${files.length} (${(totalBytes / 1024).toFixed(1)} KB unzipped)`);
  for (const rel of [...files].sort()) {
    console.log(`                 ${rel}  ${statSync(join(buildDir, rel)).size} B`);
  }
  console.log(`  removed hosts  ${removed.length ? removed.join(", ") : "(none)"}`);
  console.log(`  host perms     ${((parsed && parsed.host_permissions) || []).join(", ") || "(none)"}`);
  console.log(`  permissions    ${((parsed && parsed.permissions) || []).join(", ")}`);
  if (zip) {
    console.log(`  zip            ${relative(process.cwd(), zip.zipPath)} (${(statSync(zip.zipPath).size / 1024).toFixed(1)} KB)`);
  }
  for (const note of notes) console.log(`  note           ${note}`);

  if (problems.length) {
    console.log(`\nFAILED ${problems.length} check(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
