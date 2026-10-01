#!/usr/bin/env node
// Builds the extension icons (16, 32, 48, 128 px) from Archie's face, the same
// drawing the page UI uses for its round button: AlgeBridgeMascot.face() in
// src/mascot.js. His blue dome with white eyes reads on both Chrome's light and
// dark toolbars (the old black-disc logo turned into a dark blob on the dark one).
//
//   npm run extension:icons
//   node extension/scripts/build-icons.mjs --svg   also prints each SVG
//
// How it works:
//   1. Runs src/mascot.js in Node with a tiny stand-in for document, calls
//      face(size) for each size and turns the element tree it builds into an
//      SVG string. face() already leaves the cheeks out below 26 px.
//   2. 32, 48 and 128 px are drawn exactly as mascot.js draws them.
//   3. At 16 px one pixel is 3 of the face's 48 units, so round eyes, a catch
//      light and a thin smile blur into one grey smudge. That size gets the
//      same face fitted to whole pixels: each eye white and pupil becomes a
//      block snapped from its own position and size, the catch lights go, and
//      the smile becomes a three-row pixel curve between its own end points.
//      If face() changes shape so the fit no longer applies, the script says
//      so and draws 16 px straight from face(16) instead.
//   4. Every size is drawn from the vector with @resvg/resvg-js (a dev
//      dependency of the repo), so nothing is scaled down from a bigger PNG.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const extDir = resolve(here, "..");
const repoDir = resolve(extDir, "..");
const mascotFile = join(extDir, "src", "mascot.js");
const outDir = join(extDir, "icons");
export const SIZES = [16, 32, 48, 128];
const VIEW = 48; // face() draws in a 48 x 48 viewBox

function die(message) {
  console.error(`build-icons: ${message}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Run mascot.js with a stand-in document                              */
/* ------------------------------------------------------------------ */

function makeNode(tag) {
  const node = {
    tag,
    attrs: new Map(),
    kids: [],
    setAttribute(name, value) {
      node.attrs.set(name, String(value));
    },
    getAttribute(name) {
      return node.attrs.has(name) ? node.attrs.get(name) : null;
    },
    removeAttribute(name) {
      node.attrs.delete(name);
    },
    appendChild(kid) {
      node.kids.push(kid);
      return kid;
    },
    append(...kids) {
      node.kids.push(...kids);
    },
  };
  return node;
}

export function loadMascot(source = readFileSync(mascotFile, "utf8")) {
  const ctx = { document: { createElementNS: (_ns, tag) => makeNode(tag) } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: "src/mascot.js" });
  const api = ctx.AlgeBridgeMascot;
  if (!api || typeof api.face !== "function") throw new Error("src/mascot.js did not define AlgeBridgeMascot.face");
  return api;
}

const escapeAttr = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function serialize(node) {
  const attrs = [...node.attrs].map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join("");
  const xmlns = node.tag === "svg" ? ' xmlns="http://www.w3.org/2000/svg"' : "";
  return `<${node.tag}${xmlns}${attrs}>${node.kids.map(serialize).join("")}</${node.tag}>`;
}

/* ------------------------------------------------------------------ */
/* 16 px: the same face fitted to whole pixels                         */
/* ------------------------------------------------------------------ */

const num = (node, name) => Number(node.getAttribute(name));
const isWhite = (node) => /^#fff(fff)?$/i.test(node.getAttribute("fill") || "");

// Returns the 16 px drawing as a list of nodes, or a reason it does not apply.
function pixelFit(svg, size) {
  const unit = VIEW / size; // face units per pixel
  const [disc, ...rest] = svg.kids;
  if (!disc || disc.tag !== "circle" || num(disc, "r") !== VIEW / 2) return { why: "the first shape is not the full disc" };
  const whites = rest.filter((n) => n.tag === "ellipse" && isWhite(n));
  const dots = rest.filter((n) => n.tag === "circle");
  const pupils = dots.filter((n) => !isWhite(n));
  const lights = dots.filter((n) => isWhite(n));
  const smiles = rest.filter((n) => n.tag === "path" && n.getAttribute("fill") === "none" && n.getAttribute("stroke") === (pupils[0] && pupils[0].getAttribute("fill")));
  if (whites.length !== 2 || pupils.length !== 2) return { why: `expected 2 eye whites and 2 pupils, found ${whites.length} and ${pupils.length}` };
  if (smiles.length !== 1) return { why: `expected one smile stroke in the pupils' ink, found ${smiles.length}` };
  const known = new Set([disc, ...whites, ...pupils, ...lights, ...smiles]);
  const others = rest.filter((n) => !known.has(n));

  const block = (x, y, w, h, fill) => {
    const r = makeNode("rect");
    for (const [k, v] of Object.entries({ x: x * unit, y: y * unit, width: w * unit, height: h * unit, fill })) r.setAttribute(k, v);
    return r;
  };
  const out = [disc, ...others]; // the disc and anything else (the shine) stay as drawn
  for (const eye of whites.sort((a, b) => num(a, "cx") - num(b, "cx"))) {
    const cx = num(eye, "cx") / unit;
    const cy = num(eye, "cy") / unit;
    const w = Math.max(2, Math.floor((2 * num(eye, "rx")) / unit));
    const h = Math.max(2, Math.round((2 * num(eye, "ry")) / unit));
    const x0 = Math.round(cx - w / 2);
    const y0 = Math.round(cy - h / 2);
    out.push(block(x0, y0, w, h, eye.getAttribute("fill")));
    const pupil = pupils.find((p) => Math.abs(num(p, "cx") - num(eye, "cx")) < num(eye, "rx"));
    if (!pupil) return { why: "a pupil does not sit inside its eye" };
    const d = Math.max(1, Math.min(w - 1, h - 1, Math.round((2 * num(pupil, "r")) / unit)));
    // Centered in the eye; when it cannot be exactly centered, it leans the way
    // the drawn pupil leans (right and down in face()).
    const lean = (offset, room) => (room % 2 === 0 ? room / 2 : offset > 0 ? Math.ceil(room / 2) : Math.floor(room / 2));
    const px = x0 + lean(num(pupil, "cx") / unit - cx, w - d);
    const py = y0 + lean(num(pupil, "cy") / unit - cy, h - d);
    out.push(block(px, py, d, d, pupil.getAttribute("fill")));
  }
  // The smile: corners at its two end points, a two-pixel bottom row under them.
  const m = /^M\s*([\d.]+)[\s,]+([\d.]+)\s*Q\s*([\d.]+)[\s,]+([\d.]+)\s+([\d.]+)[\s,]+([\d.]+)\s*$/.exec(smiles[0].getAttribute("d") || "");
  if (!m) return { why: "the smile is not one curve (M x y Q cx cy x y)" };
  const [x1, y1, , , x2] = m.slice(1).map((v) => Number(v) / unit);
  const ink = smiles[0].getAttribute("stroke");
  const left = Math.floor(x1);
  const right = Math.ceil(x2) - 1;
  const row = Math.round(y1);
  if (right - left < 3) return { why: "the smile is too narrow to draw at 16 px" };
  out.push(block(left, row, 1, 1, ink), block(right, row, 1, 1, ink), block(left + 1, row + 1, right - left - 1, 1, ink));
  return { nodes: out };
}

/* ------------------------------------------------------------------ */
/* The icon drawing                                                    */
/* ------------------------------------------------------------------ */

export function iconSvg(mascot, size) {
  const svg = mascot.face(size);
  if (svg.tag !== "svg" || svg.getAttribute("viewBox") !== `0 0 ${VIEW} ${VIEW}`) {
    throw new Error(`AlgeBridgeMascot.face() no longer draws in a 0 0 ${VIEW} ${VIEW} viewBox; update build-icons.mjs`);
  }
  for (const name of ["class", "aria-hidden", "focusable"]) svg.removeAttribute(name);
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  let note = "as drawn";
  if (size <= 16) {
    const fit = pixelFit(svg, size);
    if (fit.nodes) {
      svg.kids = fit.nodes;
      note = "fitted to whole pixels";
    } else {
      note = `as drawn (pixel fit skipped: ${fit.why}; check the 16 px icon by eye)`;
    }
  }
  return { svg: serialize(svg), note };
}

export function renderPng(svgText, size) {
  const img = new Resvg(svgText, { fitTo: { mode: "width", value: size }, background: "rgba(0,0,0,0)" }).render();
  return { png: img.asPng(), width: img.width, height: img.height };
}

/* ------------------------------------------------------------------ */

function main() {
  let mascot;
  try {
    mascot = loadMascot();
  } catch (err) {
    die(err.message);
  }
  mkdirSync(outDir, { recursive: true });
  let failed = 0;
  for (const size of SIZES) {
    let icon;
    try {
      icon = iconSvg(mascot, size);
    } catch (err) {
      die(err.message);
    }
    const { png, width, height } = renderPng(icon.svg, size);
    const out = join(outDir, `${size}.png`);
    writeFileSync(out, png);
    const ok = width === size && height === size;
    if (!ok) failed += 1;
    console.log(`${ok ? "ok  " : "FAIL"} ${relative(repoDir, out)}  ${width}x${height}  ${png.length} bytes  ${icon.note}`);
    if (process.argv.includes("--svg")) console.log(icon.svg);
  }
  if (failed) die(`${failed} icon(s) came out the wrong size`);
  console.log(`build-icons: ${SIZES.length} icons drawn from AlgeBridgeMascot.face() in ${relative(repoDir, mascotFile)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
