/*
 * Archie, the AlgeBridge Hints mascot: the arch of a bridge with a face.
 *
 * Classic script, loaded by the manifest between src/detect.js and
 * src/content.js. It only defines drawing functions; nothing runs on load.
 *
 *   AlgeBridgeMascot.create(pose, size, opts?)  -> <svg>
 *     pose: "idle" (waving), "thinking" (hand on chin, looking up),
 *           "party" (both arms up, happy eyes)
 *     opts.confetti: dots and sparkles around him (default: true for party)
 *     opts.shadow: a soft ground shadow (default true)
 *   AlgeBridgeMascot.face(size)  -> <svg>   Archie's face up close on his
 *     blue dome, for the round button, chat avatars and the markers.
 *
 * Everything is built with createElementNS and flat fills, with no ids, so
 * any number of copies can live in one shadow root.
 */
(function () {
  "use strict";

  if (globalThis.AlgeBridgeMascot) return;

  const NS = "http://www.w3.org/2000/svg";
  const C = {
    body: "#2563eb",
    shine: "#60a5fa",
    line: "#1e3a8a",
    ink: "#0f172a",
    white: "#ffffff",
    cheek: "#f9a8d4",
    blue: "#2563eb",
    amber: "#f59e0b",
    pink: "#ec4899",
    green: "#10b981",
  };
  const LW = 2.6; // outline width in viewBox units (about 2 px at 96 px)

  function el(tag, attrs, kids) {
    const node = document.createElementNS(NS, tag);
    if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, String(attrs[k]));
    if (kids) for (const kid of kids) if (kid) node.appendChild(kid);
    return node;
  }

  // The arch: a round-topped body, two short legs, an arch opening between.
  const BODY =
    "M22 60 C22 32 39 15 60 15 C81 15 98 32 98 60 L98 97 Q98 104 91 104 L81 104 Q74 104 74 97 " +
    "L74 95 C74 88.5 67.7 84 60 84 C52.3 84 46 88.5 46 95 L46 97 Q46 104 39 104 L29 104 Q22 104 22 97 Z";

  // A limb is a round-capped stroke drawn twice: outline, then fill color.
  function limb(d, hand) {
    const g = el("g", { "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" });
    g.appendChild(el("path", { d, stroke: C.line, "stroke-width": 7.6 + LW * 2 }));
    g.appendChild(el("path", { d, stroke: C.body, "stroke-width": 7.6 }));
    if (hand) g.appendChild(el("circle", { cx: hand[0], cy: hand[1], r: 5.6, fill: C.body, stroke: C.line, "stroke-width": LW }));
    return g;
  }

  function sparkle(x, y, r, fill, cls, delay) {
    const k = r * 0.22;
    const d =
      `M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} ` +
      `Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r} Z`;
    return el("path", { d, fill, class: cls, style: `--ab-d:${delay}ms` });
  }

  function dot(x, y, r, fill, cls, delay) {
    return el("circle", { cx: x, cy: y, r, fill, class: cls, style: `--ab-d:${delay}ms` });
  }

  // The group takes the pop animation; the rect keeps its own rotation (a CSS
  // transform on the rect itself would replace it).
  function strip(x, y, w, h, angle, fill, cls, delay) {
    return el("g", { class: cls, style: `--ab-d:${delay}ms` }, [
      el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: h / 2, fill, transform: `rotate(${angle} ${x} ${y})` }),
    ]);
  }

  function confetti(pose) {
    const g = el("g", { class: "ab-m-confetti" });
    const b = "ab-m-bit";
    if (pose === "party") {
      g.append(
        sparkle(13, 22, 5.5, C.amber, b, 0),
        dot(30, 7, 2.6, C.pink, b, 80),
        strip(91, 8, 8, 3.2, -30, C.green, b, 140),
        sparkle(108, 22, 5, C.blue, b, 60),
        dot(5, 46, 2.4, C.green, b, 200),
        strip(115, 52, 7, 3, 40, C.pink, b, 120),
        dot(9, 80, 2.2, C.blue, b, 260),
        sparkle(111, 84, 4.2, C.amber, b, 180),
        dot(60, 5, 2, C.amber, b, 220),
      );
    } else {
      g.append(
        sparkle(12, 26, 5, C.amber, b, 0),
        dot(29, 9, 2.4, C.pink, b, 90),
        dot(93, 9, 2.2, C.green, b, 150),
        sparkle(112, 18, 4.2, C.pink, b, 60),
        dot(6, 56, 2.2, C.blue, b, 210),
        strip(9, 88, 7, 3, 35, C.green, b, 120),
        sparkle(112, 80, 4, C.blue, b, 240),
        dot(104, 98, 2.2, C.amber, b, 180),
      );
    }
    return g;
  }

  function eyes(pose) {
    const g = el("g", { class: "ab-m-eyes" });
    if (pose === "party") {
      // Happy, squeezed shut.
      for (const x of [47, 73]) {
        g.appendChild(
          el("path", {
            d: `M${x - 6} ${50} Q${x} ${42.5} ${x + 6} ${50}`,
            fill: "none",
            stroke: C.ink,
            "stroke-width": 3.4,
            "stroke-linecap": "round",
          }),
        );
      }
      return g;
    }
    const look = pose === "thinking" ? [1.6, -2.2] : [0.6, 0.8];
    for (const x of [47, 73]) {
      g.appendChild(el("ellipse", { cx: x, cy: 48, rx: 6.4, ry: 7.2, fill: C.white }));
      g.appendChild(el("circle", { cx: x + look[0], cy: 48 + look[1], r: 4.3, fill: C.ink }));
      g.appendChild(el("circle", { cx: x + look[0] + 1.5, cy: 48 + look[1] - 1.6, r: 1.35, fill: C.white }));
    }
    return g;
  }

  function mouth(pose) {
    if (pose === "party") {
      const g = el("g");
      g.appendChild(el("path", { d: "M51 59.5 Q60 61.5 69 59.5 Q68 71 60 71 Q52 71 51 59.5 Z", fill: C.ink, "stroke-linejoin": "round" }));
      g.appendChild(el("path", { d: "M55 67.6 Q60 64.6 65 67.6 Q63 70.6 60 70.6 Q57 70.6 55 67.6 Z", fill: "#fb7185" }));
      return g;
    }
    if (pose === "thinking") {
      return el("path", { d: "M52.5 62 Q57 64.8 61.5 61.8", fill: "none", stroke: C.ink, "stroke-width": 3, "stroke-linecap": "round" });
    }
    return el("path", { d: "M53.5 60.5 Q60 66.5 66.5 60.5", fill: "none", stroke: C.ink, "stroke-width": 3.2, "stroke-linecap": "round" });
  }

  function create(pose, size, opts) {
    const p = pose === "thinking" || pose === "party" ? pose : "idle";
    const o = opts || {};
    const withConfetti = o.confetti == null ? p === "party" : !!o.confetti;
    const svg = el("svg", {
      viewBox: "0 0 120 120",
      width: size || 96,
      height: size || 96,
      class: `ab-mascot ab-pose-${p}`,
      "aria-hidden": "true",
      focusable: "false",
    });
    if (o.shadow !== false) svg.appendChild(el("ellipse", { cx: 60, cy: 110, rx: 31, ry: 4.2, fill: C.ink, opacity: 0.08 }));
    if (withConfetti) svg.appendChild(confetti(p));

    const fig = el("g", { class: "ab-m-fig" });
    // Arms that sit behind the body.
    if (p === "idle") {
      fig.appendChild(limb("M25 70 Q17 76 15 85", [15, 86]));
      const wave = el("g", { class: "ab-m-wave" });
      wave.appendChild(limb("M95 66 Q105 60 109 48", [109.5, 46.5]));
      fig.appendChild(wave);
    } else if (p === "party") {
      fig.appendChild(limb("M26 64 Q15 56 12 41", [11.5, 39.5]));
      fig.appendChild(limb("M94 64 Q105 56 108 41", [108.5, 39.5]));
    } else {
      fig.appendChild(limb("M25 70 Q17 76 15 85", [15, 86]));
    }

    fig.appendChild(el("path", { d: BODY, fill: C.body, stroke: C.line, "stroke-width": LW, "stroke-linejoin": "round" }));
    // Shine along the top left of the dome.
    fig.appendChild(
      el("path", { d: "M31.5 47 C33 35 40.5 26 50 23", fill: "none", stroke: C.shine, "stroke-width": 4.2, "stroke-linecap": "round" }),
    );
    fig.appendChild(el("ellipse", { cx: 36, cy: 59.5, rx: 4.6, ry: 2.9, fill: C.cheek }));
    fig.appendChild(el("ellipse", { cx: 84, cy: 59.5, rx: 4.6, ry: 2.9, fill: C.cheek }));
    fig.appendChild(eyes(p));
    fig.appendChild(mouth(p));

    if (p === "thinking") {
      // Hand on chin, in front of the body.
      fig.appendChild(limb("M96 78 Q96 90 82 84 Q77 82 76 79", [73, 73]));
      const dots = el("g", { class: "ab-m-think" });
      dots.append(
        el("circle", { cx: 99, cy: 24, r: 2.6, fill: "#93c5fd", class: "ab-m-tdot", style: "--ab-d:0ms" }),
        el("circle", { cx: 106, cy: 15, r: 3.4, fill: "#93c5fd", class: "ab-m-tdot", style: "--ab-d:180ms" }),
        el("circle", { cx: 114.5, cy: 6.5, r: 4.2, fill: "#93c5fd", class: "ab-m-tdot", style: "--ab-d:360ms" }),
      );
      svg.appendChild(dots);
    }
    svg.appendChild(fig);
    return svg;
  }

  // Archie up close, for the round button (56 px), chat avatars (26 px) and
  // the markers beside problems (22 px). The disc is his blue dome, with the
  // same eyes as the full figure: white, dark pupils, a catch light, plus his
  // smile, the light blue shine and (where they can show) pink cheeks.
  // An earlier version drew his whole white arch on the disc; at 22 px that
  // read as a little ghost. A face close-up keeps reading as Archie.
  function face(size) {
    const s = size || 56;
    const svg = el("svg", {
      viewBox: "0 0 48 48",
      width: s,
      height: s,
      class: "ab-face",
      "aria-hidden": "true",
      focusable: "false",
    });
    svg.appendChild(el("circle", { cx: 24, cy: 24, r: 24, fill: C.body }));
    svg.appendChild(el("path", { d: "M8.5 19 C9.6 13.5 13 9.4 17.6 7.6", fill: "none", stroke: C.shine, "stroke-width": 3, "stroke-linecap": "round" }));
    if (s >= 26) {
      for (const x of [9.5, 38.5]) svg.appendChild(el("ellipse", { cx: x, cy: 29, rx: 3, ry: 1.9, fill: C.cheek }));
    }
    for (const x of [17, 31]) {
      svg.appendChild(el("ellipse", { cx: x, cy: 20.5, rx: 5.4, ry: 6.2, fill: C.white }));
      svg.appendChild(el("circle", { cx: x + 0.6, cy: 21.4, r: 3.5, fill: C.ink }));
      svg.appendChild(el("circle", { cx: x + 1.8, cy: 19.9, r: 1.1, fill: C.white }));
    }
    svg.appendChild(el("path", { d: "M18.5 30 Q24 35.5 29.5 30", fill: "none", stroke: C.ink, "stroke-width": 2.4, "stroke-linecap": "round" }));
    return svg;
  }

  const api = Object.freeze({ create, face });
  try {
    Object.defineProperty(globalThis, "AlgeBridgeMascot", { value: api, configurable: false, writable: false });
  } catch {
    globalThis.AlgeBridgeMascot = api;
  }
})();
