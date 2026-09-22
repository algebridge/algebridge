/**
 * How every piece of furniture is drawn, flat, in the same hand as the houses
 * (see house-art.ts): no outlines, two tones per surface lit from the upper
 * left, detail from repetition. Each item is a few calls into a small
 * vocabulary of shapes, so a hundred pieces read as one set, and a new piece
 * is a dozen lines here rather than an illustration.
 *
 * The canvas is 100 x 100; a piece sits on the floor at about y = 90. These
 * strings are exported to PNG by scripts/export-furniture-png.ts, which is
 * what the shop and the rooms show.
 */

// --- Colors -----------------------------------------------------------------

function mix(hex: string, to: [number, number, number], t: number): string {
  const v = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  return `#${c.map((x, i) => Math.round(x + (to[i] - x) * t).toString(16).padStart(2, "0")).join("")}`;
}
/** The darker of a surface's two tones: its underside and right edge. */
export const shade = (hex: string, t = 0.24): string => mix(hex, [0, 0, 0], t);
/** The lighter tone, for a highlight strip. */
export const tint = (hex: string, t = 0.3): string => mix(hex, [255, 255, 255], t);

const C = {
  wood: "#c2793a",
  walnut: "#7c4a1e",
  pine: "#e2a15c",
  cream: "#fef3c7",
  paper: "#f8fafc",
  ink: "#1e293b",
  steel: "#64748b",
  chrome: "#a8b4c4",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#facc15",
  lime: "#84cc16",
  green: "#22c55e",
  leaf: "#16a34a",
  teal: "#14b8a6",
  sky: "#38bdf8",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#a855f7",
  pink: "#ec4899",
  rose: "#f43f5e",
  gold: "#eab308",
  brass: "#d4a017",
};

// --- Shapes -----------------------------------------------------------------

const f = (v: number) => Number(v.toFixed(2));

export function rect(x: number, y: number, w: number, h: number, fill: string, rx = 0): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="${fill}"/>`;
}

/** A slab: a face, with a darker band along the bottom and, if asked, the right. */
export function block(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  o: { rx?: number; depth?: number; right?: number } = {}
): string {
  const { rx = 0, depth = 0, right = 0 } = o;
  let s = "";
  if (depth || right) s += rect(x, y, w, h, shade(fill), rx);
  return s + rect(x, y, w - right, h - depth, fill, rx);
}

export function ball(cx: number, cy: number, r: number, fill: string): string {
  return (
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${shade(fill)}"/>` +
    `<circle cx="${f(cx - r * 0.12)}" cy="${f(cy - r * 0.12)}" r="${f(r * 0.88)}" fill="${fill}"/>`
  );
}

export function oval(cx: number, cy: number, rx: number, ry: number, fill: string): string {
  return (
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${shade(fill)}"/>` +
    `<ellipse cx="${f(cx - rx * 0.1)}" cy="${f(cy - ry * 0.14)}" rx="${f(rx * 0.9)}" ry="${f(ry * 0.86)}" fill="${fill}"/>`
  );
}

export function disc(cx: number, cy: number, r: number, fill: string): string {
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"/>`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, fill: string): string {
  return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"/>`;
}

export function poly(points: [number, number][], fill: string): string {
  return `<polygon points="${points.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" fill="${fill}"/>`;
}

export function path(d: string, fill: string): string {
  return `<path d="${d}" fill="${fill}"/>`;
}

/** A cord, a string, a stand: the one place a stroke is allowed. */
export function line(x1: number, y1: number, x2: number, y2: number, color: string, w = 2): string {
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
}

export function stroke(d: string, color: string, w = 2): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function ring(cx: number, cy: number, r: number, w: number, color: string): string {
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
}

/** Two legs under a piece. */
export function legs(x1: number, x2: number, y: number, h: number, fill: string, w = 6): string {
  return block(x1, y, w, h, fill, { depth: 2 }) + block(x2, y, w, h, fill, { depth: 2 });
}

export function repeat(n: number, draw: (i: number) => string): string {
  let s = "";
  for (let i = 0; i < n; i += 1) s += draw(i);
  return s;
}

/** A row of books: spines in a run of colors. */
function books(x: number, y: number, h: number, colors: string[], w = 7, gap = 1.5): string {
  return repeat(colors.length, (i) => block(x + i * (w + gap), y - (i % 3 === 1 ? 3 : 0), w, h + (i % 3 === 1 ? 3 : 0), colors[i], { rx: 1, right: 1.5 }));
}

/** A screen: dark bezel, lit panel, a highlight bar. */
function screen(x: number, y: number, w: number, h: number, glow = C.sky): string {
  return (
    block(x, y, w, h, C.ink, { rx: 3, depth: 2 }) +
    rect(x + 3, y + 3, w - 6, h - 8, glow, 2) +
    rect(x + 5, y + 5, w * 0.35, 2.5, tint(glow, 0.55), 1)
  );
}

const SPINES = [C.red, C.blue, C.green, C.purple, C.orange, C.gold, C.teal, C.pink];

// --- The pieces -------------------------------------------------------------

const ART: Record<string, () => string> = {
  // ---- Common -------------------------------------------------------------
  rug: () =>
    oval(50, 74, 44, 16, C.wood) +
    ellipse(48, 72, 30, 9, C.pine) +
    ellipse(47, 71, 14, 4, C.wood),
  plant: () =>
    block(36, 66, 28, 22, C.orange, { rx: 3, depth: 4, right: 3 }) +
    rect(34, 62, 32, 6, shade(C.orange, 0.1), 2) +
    ball(50, 44, 20, C.green) +
    ball(34, 40, 11, C.leaf) +
    ball(66, 38, 12, C.lime) +
    ball(50, 26, 9, tint(C.green)),
  lamp: () =>
    block(45, 58, 10, 30, C.steel, { depth: 2, right: 2 }) +
    ellipse(50, 88, 16, 4, shade(C.steel)) +
    poly([[24, 58], [76, 58], [64, 22], [36, 22]], C.gold) +
    poly([[64, 58], [76, 58], [64, 22], [58, 22]], shade(C.gold)) +
    ellipse(50, 66, 22, 5, tint(C.yellow, 0.5)),
  poster: () =>
    block(20, 14, 60, 72, C.cream, { rx: 2, depth: 3, right: 2 }) +
    rect(26, 20, 46, 54, C.paper, 1) +
    rect(32, 30, 34, 3, C.blue, 1) +
    rect(32, 38, 22, 3, C.blue, 1) +
    stroke("M34 66 L46 52 L54 58 L66 44", C.rose, 3),
  chair: () =>
    block(24, 26, 52, 26, C.gold, { rx: 8, depth: 4, right: 3 }) +
    block(26, 50, 48, 10, C.wood, { rx: 3, depth: 3, right: 2 }) +
    legs(30, 61, 60, 26, C.walnut, 8),
  bookshelf: () =>
    block(18, 12, 64, 76, C.walnut, { rx: 3, depth: 4, right: 3 }) +
    rect(23, 17, 54, 20, shade(C.walnut, 0.3)) +
    rect(23, 41, 54, 20, shade(C.walnut, 0.3)) +
    rect(23, 65, 54, 18, shade(C.walnut, 0.3)) +
    books(26, 23, 14, SPINES.slice(0, 6)) +
    books(26, 47, 14, [C.teal, C.pink, C.gold, C.blue, C.red]) +
    books(26, 70, 13, [C.green, C.purple, C.orange, C.sky]),
  beanbag: () =>
    oval(50, 62, 40, 28, C.purple) +
    ellipse(46, 52, 26, 14, tint(C.purple, 0.2)) +
    ellipse(42, 48, 10, 5, tint(C.purple, 0.5)),
  clock: () =>
    ball(50, 50, 36, C.cream) +
    disc(50, 50, 30, C.paper) +
    repeat(12, (i) => {
      const a = (i * Math.PI) / 6;
      return rect(49 + 26 * Math.sin(a) - 1, 50 - 26 * Math.cos(a) - 1, 2.5, 2.5, C.steel, 1);
    }) +
    line(50, 50, 50, 26, C.ink, 3.5) +
    line(50, 50, 68, 50, C.ink, 3) +
    disc(50, 50, 3.5, C.rose),
  "yoga-mat": () =>
    block(18, 40, 64, 30, C.teal, { rx: 10, depth: 5, right: 3 }) +
    rect(28, 45, 38, 2.5, tint(C.teal, 0.4), 1) +
    rect(28, 52, 38, 2.5, tint(C.teal, 0.4), 1) +
    rect(28, 59, 38, 2.5, tint(C.teal, 0.4), 1),
  "calculator-bot": () =>
    block(24, 22, 52, 60, C.steel, { rx: 8, depth: 4, right: 3 }) +
    rect(30, 28, 40, 16, C.green, 2) +
    rect(34, 32, 14, 2.5, tint(C.green, 0.5), 1) +
    repeat(9, (i) => rect(31 + (i % 3) * 13.5, 49 + Math.floor(i / 3) * 10.5, 10, 7.5, i === 8 ? C.orange : C.chrome, 2)) +
    ball(50, 14, 5, C.sky) +
    rect(48.5, 18, 3, 6, C.chrome),
  "lava-lamp": () =>
    block(38, 70, 24, 14, C.steel, { rx: 3, depth: 3, right: 2 }) +
    poly([[40, 70], [60, 70], [57, 20], [43, 20]], C.indigo) +
    poly([[54, 70], [60, 70], [57, 20], [52, 20]], shade(C.indigo)) +
    oval(50, 56, 7, 10, C.rose) +
    oval(49, 36, 5, 8, C.pink) +
    block(43, 14, 14, 7, C.steel, { rx: 2, depth: 2 }),
  "homework-station": () =>
    block(14, 50, 72, 8, C.wood, { rx: 2, depth: 3, right: 2 }) +
    legs(20, 74, 58, 24, C.walnut) +
    block(24, 26, 52, 24, C.cream, { rx: 2, depth: 2, right: 2 }) +
    rect(30, 34, 36, 2.5, C.chrome, 1) +
    rect(30, 40, 26, 2.5, C.chrome, 1) +
    block(58, 20, 16, 12, C.red, { rx: 2, depth: 2 }),
  // ---- Rare ---------------------------------------------------------------
  desk: () =>
    block(12, 48, 76, 10, C.wood, { rx: 3, depth: 3, right: 3 }) +
    legs(18, 74, 58, 24, C.walnut, 8) +
    screen(30, 24, 40, 24) +
    block(44, 44, 12, 5, C.steel, { depth: 1 }) +
    ball(66, 20, 7, C.gold) +
    rect(65, 27, 2, 21, C.steel),
  bed: () =>
    block(14, 56, 72, 24, C.blue, { rx: 6, depth: 5, right: 3 }) +
    block(14, 42, 72, 16, C.sky, { rx: 6, depth: 3 }) +
    oval(28, 50, 11, 7, C.paper) +
    oval(70, 50, 11, 7, C.paper) +
    legs(16, 78, 78, 10, C.walnut),
  tv: () =>
    screen(14, 18, 72, 50) +
    block(40, 70, 20, 8, C.steel, { depth: 2 }) +
    block(28, 78, 44, 6, C.steel, { rx: 2, depth: 2, right: 2 }),
  whiteboard: () =>
    block(12, 14, 76, 60, C.paper, { rx: 3, depth: 3, right: 2 }) +
    rect(12, 14, 76, 4, C.chrome) +
    stroke("M22 34 L44 34", C.blue, 3) +
    stroke("M52 34 L76 34", C.rose, 3) +
    stroke("M22 48 L40 48", C.green, 3) +
    block(38, 76, 24, 10, C.chrome, { rx: 2, depth: 2, right: 2 }),
  globe: () =>
    ball(50, 40, 32, C.sky) +
    path("M26 34c8-6 16 2 24-2s10-10 22-6c-2 10-10 18-22 18s-18-4-24-10Z", C.green) +
    path("M40 56c6 4 14 4 22 0c-2 6-8 10-12 10s-8-4-10-10Z", C.leaf) +
    block(40, 72, 20, 14, C.steel, { rx: 3, depth: 3, right: 2 }) +
    ring(50, 40, 34, 3, C.brass),
  "snack-bar": () =>
    block(18, 32, 64, 50, C.orange, { rx: 6, depth: 4, right: 3 }) +
    rect(26, 40, 48, 22, C.paper, 2) +
    repeat(4, (i) => block(29 + i * 11.5, 44, 9, 14, [C.red, C.gold, C.green, C.purple][i], { rx: 2, depth: 2 })) +
    ball(36, 74, 6, C.red) +
    ball(64, 74, 6, C.gold),
  "candy-machine": () =>
    block(28, 20, 44, 64, C.red, { rx: 22, depth: 4, right: 3 }) +
    rect(34, 28, 32, 24, tint(C.sky, 0.3), 6) +
    repeat(7, (i) => disc(40 + (i % 4) * 7, 36 + Math.floor(i / 4) * 8, 3, [C.gold, C.green, C.pink, C.blue, C.orange, C.purple, C.teal][i])) +
    block(42, 70, 16, 8, C.steel, { rx: 2, depth: 2 }),
  hammock: () =>
    block(10, 16, 6, 70, C.walnut, { depth: 2, right: 2 }) +
    block(84, 16, 6, 70, C.walnut, { depth: 2, right: 2 }) +
    path("M16 26 Q50 78 84 26 L84 32 Q50 84 16 32Z", C.pink) +
    path("M22 30 Q50 74 78 30", tint(C.pink, 0.35)) +
    ellipse(50, 52, 22, 8, tint(C.pink, 0.55)),
  robot: () =>
    block(28, 28, 44, 38, C.chrome, { rx: 8, depth: 4, right: 3 }) +
    ball(40, 44, 6, C.sky) +
    ball(60, 44, 6, C.sky) +
    rect(36, 56, 28, 4, C.ink, 2) +
    block(36, 66, 12, 22, C.steel, { depth: 3, right: 2 }) +
    block(52, 66, 12, 22, C.steel, { depth: 3, right: 2 }) +
    block(38, 16, 24, 12, C.steel, { rx: 4, depth: 2 }) +
    ball(50, 12, 3, C.rose),
  telescope: () =>
    block(42, 62, 16, 26, C.steel, { depth: 3, right: 2 }) +
    ellipse(50, 88, 18, 4, shade(C.steel)) +
    `<g transform="rotate(-24 50 44)">${block(14, 36, 62, 16, C.indigo, { rx: 8, depth: 4, right: 3 })}${block(66, 32, 18, 24, C.steel, { rx: 5, depth: 3 })}</g>` +
    ball(80, 26, 8, C.sky),
  "cloud-couch": () =>
    oval(50, 62, 42, 20, C.sky) +
    oval(28, 52, 18, 14, tint(C.sky, 0.25)) +
    oval(72, 52, 18, 14, tint(C.sky, 0.25)) +
    oval(50, 48, 22, 12, tint(C.sky, 0.45)),
  arcade: () =>
    block(20, 16, 60, 70, C.purple, { rx: 8, depth: 4, right: 3 }) +
    screen(28, 24, 44, 30, C.ink) +
    rect(34, 30, 8, 8, C.green, 2) +
    rect(46, 36, 6, 6, C.gold, 1) +
    rect(56, 30, 8, 8, C.rose, 2) +
    ball(38, 70, 6, C.red) +
    ball(62, 70, 6, C.green) +
    rect(48, 62, 4, 10, C.steel, 2) +
    ball(50, 60, 4, C.gold),
  "disco-ball": () =>
    line(50, 6, 50, 20, C.steel, 2.5) +
    ball(50, 48, 30, C.chrome) +
    repeat(5, (i) => rect(22 + i * 12, 30, 8, 8, tint(C.chrome, 0.5), 1)) +
    repeat(6, (i) => rect(20 + i * 11, 44, 8, 8, i % 2 ? tint(C.chrome, 0.5) : shade(C.chrome, 0.1), 1)) +
    repeat(4, (i) => rect(30 + i * 11, 58, 8, 8, tint(C.chrome, 0.5), 1)),
  "neon-sign": () =>
    block(10, 30, 80, 36, C.ink, { rx: 6, depth: 4, right: 3 }) +
    stroke("M18 54 L18 40 L24 50 L30 40 L30 54", C.pink, 3) +
    stroke("M36 54 L42 40 L48 54 M38.5 48 L45.5 48", C.pink, 3) +
    stroke("M54 40 L64 40 M59 40 L59 54", C.sky, 3) +
    stroke("M70 40 L70 54 M82 40 L82 54 M70 47 L82 47", C.sky, 3),
  // ---- Legendary ----------------------------------------------------------
  "trophy-case": () =>
    block(18, 14, 64, 74, C.walnut, { rx: 3, depth: 4, right: 3 }) +
    rect(23, 19, 54, 62, tint(C.sky, 0.6), 2) +
    rect(23, 48, 54, 3, C.walnut) +
    ball(38, 34, 8, C.gold) +
    block(34, 42, 8, 5, C.brass, { depth: 1 }) +
    ball(60, 32, 9, C.gold) +
    block(55, 41, 10, 6, C.brass, { depth: 1 }) +
    ball(50, 64, 8, C.chrome) +
    block(46, 72, 8, 5, C.steel, { depth: 1 }),
  piano: () =>
    block(12, 32, 76, 52, C.ink, { rx: 5, depth: 4, right: 3 }) +
    rect(18, 40, 64, 22, C.paper, 1) +
    repeat(9, (i) => rect(22 + i * 7.3, 40, 3.5, 13, C.ink)) +
    block(12, 78, 76, 10, C.walnut, { depth: 3, right: 2 }) +
    rect(36, 22, 28, 12, shade(C.ink, 0.2), 2),
  chandelier: () =>
    line(50, 6, 50, 24, C.brass, 3) +
    oval(50, 30, 28, 10, C.gold) +
    repeat(3, (i) => {
      const x = 32 + i * 18;
      return line(x, 32, x, 44, C.brass, 2) + ball(x, 50, 7, C.yellow) + ellipse(x, 60, 6, 2.5, tint(C.yellow, 0.6));
    }),
  "science-lab": () =>
    block(16, 50, 68, 10, C.steel, { rx: 2, depth: 3, right: 2 }) +
    legs(22, 72, 60, 20, shade(C.steel, 0.2)) +
    repeat(3, (i) => {
      const x = 28 + i * 16;
      const c = [C.green, C.sky, C.pink][i];
      return block(x, 24, 12, 28, c, { rx: 4, depth: 3, right: 2 }) + rect(x + 2, 26, 8, 8, tint(c, 0.5), 2) + ball(x + 6, 18, 4, tint(c, 0.4));
    }),
  aquarium: () =>
    block(16, 22, 68, 54, C.sky, { rx: 5, depth: 4, right: 3 }) +
    rect(20, 26, 60, 44, tint(C.sky, 0.25), 3) +
    oval(36, 46, 10, 6, C.orange) +
    poly([[26, 46], [30, 41], [30, 51]], C.orange) +
    oval(60, 40, 8, 5, C.purple) +
    poly([[68, 40], [72, 36], [72, 44]], C.purple) +
    ball(48, 56, 5, C.gold) +
    repeat(3, (i) => rect(26 + i * 20, 60, 4, 10, C.green, 2)) +
    block(16, 76, 68, 8, C.steel, { rx: 2, depth: 2, right: 2 }),
  "dragon-statue": () =>
    oval(46, 62, 32, 24, C.green) +
    ball(64, 36, 18, C.lime) +
    poly([[74, 34], [92, 26], [84, 44]], C.green) +
    ball(70, 32, 4, C.rose) +
    path("M30 50 Q18 30 28 18 Q30 32 36 44Z", C.leaf) +
    repeat(4, (i) => poly([[28 + i * 10, 44 - i * 2], [34 + i * 10, 34 - i * 2], [38 + i * 10, 44 - i * 2]], C.leaf)),
  portal: () =>
    ball(50, 50, 40, C.indigo) +
    ball(50, 50, 30, C.purple) +
    ball(50, 50, 20, C.pink) +
    ball(50, 50, 10, tint(C.pink, 0.6)) +
    disc(50, 50, 4, C.paper),
  "golden-calculator": () =>
    block(26, 16, 48, 68, C.gold, { rx: 8, depth: 4, right: 3 }) +
    rect(32, 22, 36, 18, tint(C.yellow, 0.55), 3) +
    rect(36, 27, 12, 2.5, C.brass, 1) +
    repeat(12, (i) => block(32 + (i % 3) * 12.5, 45 + Math.floor(i / 3) * 9.5, 10, 7, i === 11 ? C.orange : C.brass, { rx: 2, depth: 1.5 })),
  throne: () =>
    block(22, 26, 56, 30, C.rose, { rx: 8, depth: 3, right: 3 }) +
    block(30, 52, 40, 26, C.gold, { rx: 4, depth: 4, right: 3 }) +
    block(16, 36, 10, 26, C.brass, { rx: 2, depth: 3 }) +
    block(74, 36, 10, 26, C.brass, { rx: 2, depth: 3 }) +
    poly([[36, 26], [42, 12], [50, 22], [58, 12], [64, 26]], C.gold) +
    ball(50, 18, 4, C.sky) +
    legs(32, 62, 78, 10, C.walnut),
  "unicorn-statue": () =>
    oval(48, 64, 28, 22, C.pink) +
    ball(58, 42, 17, tint(C.pink, 0.35)) +
    poly([[60, 26], [74, 8], [68, 30]], C.gold) +
    disc(64, 40, 3, C.ink) +
    path("M42 50 Q30 30 36 16 Q40 32 46 44Z", C.purple) +
    path("M40 52 Q28 36 32 24 Q38 36 44 48Z", C.sky) +
    legs(34, 60, 78, 10, tint(C.pink, 0.2)),
  rocket: () =>
    poly([[50, 6], [68, 60], [50, 52], [32, 60]], C.red) +
    poly([[50, 6], [68, 60], [58, 56]], shade(C.red)) +
    ball(50, 34, 11, C.sky) +
    poly([[32, 60], [20, 84], [38, 70]], C.orange) +
    poly([[68, 60], [80, 84], [62, 70]], C.orange) +
    poly([[44, 62], [56, 62], [50, 90]], C.gold) +
    poly([[47, 62], [53, 62], [50, 78]], C.yellow),
  "dragon-egg": () =>
    oval(50, 54, 26, 34, C.indigo) +
    repeat(6, (i) => oval(38 + (i % 3) * 12, 36 + Math.floor(i / 3) * 18, 6, 8, i % 2 ? C.purple : tint(C.indigo, 0.2))) +
    ball(50, 26, 5, C.gold) +
    oval(50, 88, 30, 5, C.walnut),
  "infinity-pool": () =>
    block(8, 40, 84, 44, C.chrome, { rx: 10, depth: 5, right: 3 }) +
    rect(14, 46, 72, 30, C.sky, 6) +
    rect(14, 46, 72, 6, tint(C.sky, 0.4), 6) +
    stroke("M20 60 Q30 54 40 60 T60 60 T80 60", tint(C.sky, 0.7), 3) +
    ball(66, 66, 6, C.orange),
  "time-machine": () =>
    oval(50, 54, 36, 28, C.steel) +
    oval(50, 54, 24, 18, C.chrome) +
    ball(50, 54, 10, C.sky) +
    ring(50, 54, 15, 2, tint(C.sky, 0.5)) +
    block(46, 16, 8, 16, C.steel, { depth: 2, right: 2 }) +
    ball(50, 12, 6, C.gold) +
    repeat(3, (i) => ball(24 + i * 26, 82, 4, C.chrome)),

  // ---- New pieces, common -------------------------------------------------
  cactus: () =>
    block(36, 66, 28, 20, C.rose, { rx: 3, depth: 4, right: 3 }) +
    rect(33, 62, 34, 6, shade(C.rose, 0.1), 2) +
    block(43, 22, 14, 42, C.green, { rx: 7, depth: 2, right: 3 }) +
    block(30, 36, 9, 18, C.green, { rx: 4.5, right: 2 }) +
    rect(30, 50, 15, 6, C.green, 3) +
    block(61, 30, 9, 18, C.green, { rx: 4.5, right: 2 }) +
    rect(55, 44, 15, 6, C.green, 3) +
    ball(50, 20, 4, C.pink),
  "wall-shelf": () =>
    block(14, 44, 72, 8, C.wood, { rx: 2, depth: 3, right: 3 }) +
    block(22, 26, 12, 18, C.teal, { rx: 2, depth: 2, right: 2 }) +
    ball(44, 36, 8, C.gold) +
    books(54, 28, 16, [C.red, C.blue, C.green], 7),
  "floor-cushion": () =>
    block(18, 52, 64, 26, C.teal, { rx: 12, depth: 6, right: 3 }) +
    ellipse(48, 58, 24, 8, tint(C.teal, 0.3)) +
    ball(50, 64, 3, tint(C.teal, 0.6)),
  "string-lights": () =>
    stroke("M8 30 Q30 60 50 30 T92 30", C.steel, 2) +
    repeat(6, (i) => {
      const x = 14 + i * 14;
      const y = [36, 50, 42, 36, 50, 42][i] + 2;
      return rect(x - 2, y - 4, 4, 4, C.steel, 1) + ball(x, y + 4, 5, [C.gold, C.rose, C.sky, C.green, C.purple, C.orange][i]);
    }),
  "coat-rack": () =>
    block(46, 12, 8, 74, C.walnut, { rx: 2, depth: 2, right: 2 }) +
    ellipse(50, 88, 18, 4, shade(C.walnut)) +
    stroke("M50 22 L34 30 M50 22 L66 30 M50 40 L36 48", C.wood, 4) +
    block(22, 30, 16, 26, C.rose, { rx: 4, depth: 3, right: 2 }) +
    block(62, 30, 12, 8, C.blue, { rx: 3, depth: 2 }),
  "side-table": () =>
    oval(50, 40, 30, 9, C.wood) +
    block(46, 44, 8, 34, C.walnut, { depth: 2, right: 2 }) +
    oval(50, 82, 20, 6, C.walnut) +
    ball(50, 30, 7, C.sky) +
    rect(47, 20, 6, 6, C.green, 2),
  "mini-fridge": () =>
    block(28, 18, 44, 68, C.sky, { rx: 6, depth: 4, right: 3 }) +
    rect(30, 42, 40, 2, shade(C.sky)) +
    rect(62, 24, 4, 12, C.chrome, 2) +
    rect(62, 48, 4, 12, C.chrome, 2) +
    ball(36, 30, 3, C.green),
  skateboard: () =>
    `<g transform="rotate(-20 50 56)">${block(12, 48, 76, 12, C.gold, { rx: 6, depth: 3, right: 3 })}${rect(18, 50, 64, 3, tint(C.gold, 0.4), 1)}${ball(28, 66, 6, C.ink)}${ball(72, 66, 6, C.ink)}${disc(28, 66, 2, C.chrome)}${disc(72, 66, 2, C.chrome)}</g>`,
  hoop: () =>
    block(30, 12, 40, 30, C.paper, { rx: 2, depth: 3, right: 2 }) +
    rect(40, 20, 20, 14, C.rose, 1) +
    rect(43, 23, 14, 8, C.paper, 1) +
    ring(50, 44, 12, 4, C.orange) +
    stroke("M40 46 L44 66 M60 46 L56 66 M40 46 Q50 50 60 46 M42 54 Q50 58 58 54 M44 62 Q50 65 56 62", C.chrome, 1.5),
  "record-player": () =>
    block(14, 46, 72, 26, C.walnut, { rx: 4, depth: 4, right: 3 }) +
    ball(42, 50, 20, C.ink) +
    ring(42, 50, 12, 1, C.steel) +
    disc(42, 50, 6, C.rose) +
    disc(42, 50, 1.5, C.ink) +
    line(74, 40, 60, 54, C.chrome, 3) +
    ball(74, 40, 4, C.chrome) +
    ball(72, 62, 3, C.gold),
  headphones: () =>
    block(44, 62, 12, 24, C.steel, { depth: 2, right: 2 }) +
    ellipse(50, 88, 16, 4, shade(C.steel)) +
    stroke("M28 44 Q50 6 72 44", C.ink, 6) +
    block(22, 40, 14, 22, C.rose, { rx: 6, depth: 3, right: 2 }) +
    block(64, 40, 14, 22, C.rose, { rx: 6, depth: 3, right: 2 }),
  "floor-lamp": () =>
    oval(50, 86, 16, 4, C.steel) +
    block(48, 40, 4, 46, C.steel, { right: 1 }) +
    stroke("M50 40 Q50 18 72 18", C.steel, 4) +
    block(60, 18, 24, 14, C.gold, { rx: 7, depth: 3, right: 2 }) +
    ellipse(72, 40, 14, 5, tint(C.yellow, 0.55)),
  dumbbells: () =>
    block(18, 70, 64, 16, C.steel, { rx: 3, depth: 3, right: 3 }) +
    repeat(2, (i) => {
      const y = 44 + i * 16;
      return rect(30, y + 2, 40, 4, C.chrome, 2) + block(24, y - 3, 10, 14, C.ink, { rx: 2, depth: 2 }) + block(66, y - 3, 10, 14, C.ink, { rx: 2, depth: 2 });
    }) +
    ball(50, 28, 8, C.rose),
  easel: () =>
    block(30, 12, 6, 74, C.wood, { depth: 2, right: 2 }) +
    block(64, 12, 6, 74, C.wood, { depth: 2, right: 2 }) +
    line(50, 14, 50, 86, C.wood, 6) +
    block(24, 24, 52, 40, C.paper, { rx: 2, depth: 3, right: 2 }) +
    ball(42, 42, 8, C.sky) +
    poly([[48, 56], [58, 36], [68, 56]], C.green) +
    disc(64, 32, 4, C.gold),
  "window-plant": () =>
    line(50, 4, 50, 24, C.steel, 2) +
    stroke("M32 40 L50 22 L68 40", C.steel, 2) +
    block(30, 38, 40, 16, C.orange, { rx: 5, depth: 4, right: 3 }) +
    ball(50, 34, 13, C.green) +
    ball(38, 36, 8, C.leaf) +
    ball(62, 36, 8, C.lime) +
    stroke("M36 54 Q30 66 36 78 M50 54 Q52 68 46 82 M64 54 Q70 66 66 76", C.green, 3) +
    repeat(6, (i) => ball([33, 38, 49, 46, 67, 68][i], [62, 76, 64, 80, 62, 74][i], 4, i % 2 ? C.leaf : C.lime)),
  pinboard: () =>
    block(16, 18, 68, 56, C.wood, { rx: 3, depth: 3, right: 3 }) +
    rect(21, 23, 58, 46, C.pine) +
    rect(26, 28, 18, 18, C.paper, 1) +
    rect(50, 30, 22, 14, C.gold, 1) +
    rect(30, 50, 22, 14, C.sky, 1) +
    repeat(3, (i) => disc([35, 61, 41][i], [28, 30, 50][i], 2.5, [C.red, C.blue, C.green][i])),
  fan: () =>
    block(40, 74, 20, 10, C.steel, { rx: 3, depth: 3, right: 2 }) +
    rect(48, 58, 4, 18, C.steel) +
    ball(50, 44, 24, C.chrome) +
    disc(50, 44, 18, tint(C.sky, 0.55)) +
    repeat(3, (i) => `<g transform="rotate(${i * 120} 50 44)">${oval(50, 32, 5, 11, C.sky)}</g>`) +
    ball(50, 44, 4, C.ink),
  keyboard: () =>
    block(10, 40, 80, 24, C.ink, { rx: 4, depth: 4, right: 3 }) +
    rect(14, 44, 72, 14, C.paper, 1) +
    repeat(11, (i) => rect(17 + i * 6.5, 44, 3.5, 8, C.ink)) +
    rect(70, 34, 14, 4, C.chrome, 2) +
    ball(20, 36, 3, C.rose) +
    legs(16, 78, 64, 20, C.steel, 5),

  // ---- New pieces, rare ---------------------------------------------------
  "gaming-chair": () =>
    block(30, 14, 40, 44, C.ink, { rx: 12, depth: 3, right: 3 }) +
    rect(36, 20, 28, 30, C.rose, 8) +
    rect(40, 22, 20, 6, C.ink, 3) +
    block(26, 54, 48, 16, C.ink, { rx: 6, depth: 3, right: 3 }) +
    rect(48, 70, 4, 10, C.steel) +
    stroke("M30 84 L50 78 L70 84 M38 87 L50 78 L62 87", C.steel, 4),
  "bunk-bed": () =>
    block(18, 12, 6, 76, C.walnut, { depth: 2, right: 2 }) +
    block(76, 12, 6, 76, C.walnut, { depth: 2, right: 2 }) +
    block(22, 30, 56, 12, C.rose, { rx: 4, depth: 3 }) +
    block(22, 64, 56, 12, C.sky, { rx: 4, depth: 3 }) +
    oval(32, 30, 8, 4, C.paper) +
    oval(32, 64, 8, 4, C.paper) +
    repeat(3, (i) => rect(60, 46 + i * 8, 14, 3, C.wood, 1)),
  "drum-kit": () =>
    oval(50, 62, 22, 20, C.rose) +
    disc(50, 60, 14, C.paper) +
    oval(22, 44, 12, 9, C.chrome) +
    oval(78, 40, 12, 9, C.chrome) +
    line(22, 50, 22, 84, C.steel, 2.5) +
    line(78, 46, 78, 84, C.steel, 2.5) +
    oval(30, 30, 10, 7, C.rose) +
    oval(64, 26, 10, 7, C.rose),
  "pc-setup": () =>
    block(6, 58, 88, 8, C.ink, { rx: 2, depth: 3, right: 3 }) +
    legs(12, 82, 66, 20, C.steel) +
    screen(16, 22, 50, 34, C.purple) +
    block(70, 30, 20, 28, C.ink, { rx: 3, depth: 3, right: 2 }) +
    rect(73, 34, 14, 2, C.rose, 1) +
    rect(73, 40, 14, 2, C.sky, 1) +
    block(26, 50, 30, 5, C.steel, { rx: 2, depth: 1 }),
  vending: () =>
    block(24, 12, 52, 76, C.blue, { rx: 5, depth: 4, right: 3 }) +
    rect(30, 18, 30, 50, tint(C.sky, 0.5), 2) +
    repeat(9, (i) => block(33 + (i % 3) * 9, 22 + Math.floor(i / 3) * 14, 6, 10, [C.red, C.gold, C.green, C.orange, C.purple, C.sky, C.rose, C.teal, C.pink][i], { rx: 1.5, depth: 2 })) +
    block(64, 22, 8, 20, C.ink, { rx: 2, depth: 2 }) +
    rect(30, 72, 30, 8, C.ink, 2),
  bike: () =>
    ring(28, 64, 16, 4, C.ink) +
    ring(72, 64, 16, 4, C.ink) +
    stroke("M28 64 L44 38 L64 38 L72 64 M44 38 L52 64 L28 64 M52 64 L64 38", C.rose, 4) +
    rect(38, 34, 12, 4, C.ink, 2) +
    stroke("M60 34 L70 30", C.ink, 4),
  guitar: () =>
    `<g transform="rotate(-30 50 50)">${oval(50, 64, 20, 22, C.rose)}${oval(50, 40, 15, 14, C.rose)}${block(47, 6, 6, 44, C.walnut, { right: 2 })}${rect(44, 4, 12, 8, C.ink, 2)}${disc(52, 58, 6, C.ink)}${repeat(4, (i) => line(49 + i * 0.7, 10, 49 + i * 0.7, 70, C.chrome, 0.6))}</g>`,
  "skate-ramp": () =>
    path("M10 86 L10 30 Q12 70 46 78 L90 78 L90 86Z", C.chrome) +
    path("M14 84 L14 42 Q16 70 48 80 L86 80 L86 84Z", C.sky) +
    rect(10, 86, 80, 4, C.steel, 1) +
    block(70, 60, 16, 4, C.gold, { rx: 2, depth: 1.5 }) +
    ball(72, 66, 3, C.ink) +
    ball(84, 66, 3, C.ink),
  "coffee-machine": () =>
    block(22, 20, 56, 66, C.steel, { rx: 6, depth: 4, right: 3 }) +
    rect(28, 26, 44, 14, C.ink, 3) +
    ball(40, 33, 3, C.green) +
    ball(58, 33, 3, C.rose) +
    rect(46, 44, 8, 10, C.chrome, 2) +
    block(38, 60, 24, 16, C.paper, { rx: 4, depth: 3, right: 2 }) +
    stroke("M62 66 Q70 68 62 72", C.paper, 3) +
    stroke("M46 56 Q50 60 48 60", tint(C.walnut, 0.2), 2),
  terrarium: () =>
    block(22, 26, 56, 52, tint(C.sky, 0.6), { rx: 6, depth: 4, right: 3 }) +
    rect(26, 66, 48, 8, C.wood, 2) +
    ball(40, 54, 10, C.green) +
    ball(58, 50, 12, C.leaf) +
    block(48, 40, 6, 24, C.green, { rx: 3, right: 1.5 }) +
    ball(34, 62, 4, C.chrome) +
    poly([[50, 10], [68, 26], [32, 26]], C.wood),
  "vinyl-wall": () =>
    repeat(6, (i) => {
      const x = 22 + (i % 3) * 28;
      const y = 26 + Math.floor(i / 3) * 34;
      return block(x - 12, y - 12, 24, 24, [C.rose, C.sky, C.gold, C.purple, C.green, C.orange][i], { rx: 2, depth: 2, right: 2 }) + ball(x, y, 8, C.ink) + disc(x, y, 3, [C.gold, C.rose, C.sky, C.green, C.orange, C.purple][i]);
    }),
  fireplace: () =>
    block(12, 20, 76, 66, C.chrome, { rx: 3, depth: 4, right: 3 }) +
    rect(12, 20, 76, 8, C.wood, 2) +
    rect(24, 34, 52, 44, C.ink, 3) +
    path("M38 78 Q34 60 46 54 Q42 66 50 62 Q56 52 62 60 Q66 70 60 78Z", C.orange) +
    path("M44 78 Q42 66 50 60 Q50 68 56 66 Q58 74 54 78Z", C.gold) +
    repeat(3, (i) => rect(30 + i * 14, 74, 12, 6, C.walnut, 3)),
  "swing-chair": () =>
    line(50, 4, 50, 22, C.steel, 3) +
    path("M22 46 Q50 8 78 46 Q76 84 50 86 Q24 84 22 46Z", C.pine) +
    path("M28 50 Q50 20 72 50 Q70 80 50 80 Q30 80 28 50Z", C.cream) +
    oval(50, 70, 18, 10, C.rose) +
    repeat(5, (i) => stroke(`M${30 + i * 10} 26 L${30 + i * 10} 50`, C.wood, 1.5)),
  pinball: () =>
    block(22, 34, 56, 52, C.rose, { rx: 4, depth: 4, right: 3 }) +
    rect(28, 40, 44, 34, C.ink, 2) +
    repeat(5, (i) => ball(36 + (i % 3) * 14, 48 + Math.floor(i / 3) * 12, 4, [C.gold, C.sky, C.green, C.purple, C.orange][i])) +
    ball(50, 70, 3, C.chrome) +
    block(28, 10, 44, 24, C.ink, { rx: 3, depth: 3, right: 2 }) +
    stroke("M34 22 L66 22", C.pink, 3) +
    legs(26, 68, 86, 6, C.steel, 6),
  foosball: () =>
    block(12, 40, 76, 28, C.green, { rx: 3, depth: 4, right: 3 }) +
    rect(16, 44, 68, 20, C.leaf, 2) +
    rect(49, 44, 2, 20, C.paper) +
    repeat(4, (i) => line(24 + i * 17, 36, 24 + i * 17, 72, C.chrome, 2)) +
    repeat(8, (i) => rect(22 + Math.floor(i / 2) * 17, 48 + (i % 2) * 8, 4, 6, i < 4 ? C.red : C.blue, 1)) +
    legs(18, 76, 68, 18, C.walnut),
  projector: () =>
    block(14, 12, 72, 6, C.steel, { rx: 2, depth: 2, right: 2 }) +
    block(18, 18, 64, 44, C.paper, { rx: 2, depth: 3, right: 2 }) +
    rect(24, 24, 52, 32, tint(C.sky, 0.3), 1) +
    poly([[36, 52], [50, 30], [64, 52]], C.green) +
    disc(64, 32, 5, C.gold) +
    block(38, 74, 24, 12, C.ink, { rx: 3, depth: 3, right: 2 }) +
    ball(46, 80, 3, C.sky),
  "ring-light": () =>
    block(44, 66, 12, 20, C.steel, { depth: 2, right: 2 }) +
    ellipse(50, 88, 18, 4, shade(C.steel)) +
    ring(50, 40, 28, 8, C.cream) +
    ring(50, 40, 28, 3, tint(C.yellow, 0.4)) +
    block(42, 30, 16, 20, C.ink, { rx: 3, depth: 2, right: 2 }) +
    rect(45, 33, 10, 12, C.sky, 1),
  drone: () =>
    block(20, 74, 60, 12, C.steel, { rx: 3, depth: 3, right: 3 }) +
    block(38, 44, 24, 16, C.ink, { rx: 5, depth: 3, right: 2 }) +
    stroke("M42 48 L20 36 M58 48 L80 36", C.steel, 4) +
    ellipse(20, 34, 12, 3, C.chrome) +
    ellipse(80, 34, 12, 3, C.chrome) +
    ball(50, 52, 4, C.rose) +
    legs(40, 56, 60, 12, C.steel, 4),

  // ---- New pieces, legendary ----------------------------------------------
  jukebox: () =>
    path("M22 86 L22 40 Q22 12 50 12 Q78 12 78 40 L78 86Z", C.rose) +
    path("M28 86 L28 42 Q28 20 50 20 Q72 20 72 42 L72 86Z", C.orange) +
    path("M34 40 Q34 26 50 26 Q66 26 66 40Z", tint(C.sky, 0.4)) +
    rect(34, 48, 32, 18, C.ink, 3) +
    repeat(4, (i) => rect(38 + i * 7, 52, 4, 10, [C.gold, C.green, C.sky, C.pink][i], 1)) +
    rect(34, 72, 32, 8, C.gold, 2) +
    rect(22, 86, 56, 4, C.walnut, 1),
  "claw-machine": () =>
    block(22, 10, 56, 78, C.pink, { rx: 5, depth: 4, right: 3 }) +
    rect(28, 20, 44, 44, tint(C.sky, 0.55), 2) +
    line(50, 20, 50, 34, C.steel, 2) +
    stroke("M42 40 L50 34 L58 40 M46 44 L50 34 L54 44", C.steel, 3) +
    repeat(6, (i) => ball(36 + (i % 3) * 14, 52 + Math.floor(i / 3) * 8, 5, [C.gold, C.green, C.purple, C.orange, C.sky, C.rose][i])) +
    rect(34, 70, 32, 12, C.ink, 2) +
    ball(58, 76, 3, C.gold) +
    rect(28, 12, 44, 6, C.gold, 2),
  "sim-rig": () =>
    block(10, 72, 80, 8, C.ink, { rx: 3, depth: 3, right: 3 }) +
    block(26, 30, 30, 40, C.rose, { rx: 10, depth: 3, right: 3 }) +
    block(24, 62, 36, 12, C.ink, { rx: 4, depth: 3 }) +
    screen(58, 22, 34, 26, C.sky) +
    ring(66, 58, 8, 4, C.ink) +
    line(66, 58, 60, 66, C.steel, 3) +
    rect(70, 70, 10, 4, C.chrome, 1),
  "dj-booth": () =>
    block(8, 44, 84, 34, C.ink, { rx: 4, depth: 4, right: 3 }) +
    ball(30, 60, 12, C.chrome) +
    disc(30, 60, 8, C.ink) +
    disc(30, 60, 2.5, C.rose) +
    ball(70, 60, 12, C.chrome) +
    disc(70, 60, 8, C.ink) +
    disc(70, 60, 2.5, C.sky) +
    repeat(3, (i) => rect(46, 50 + i * 8, 8, 3, [C.green, C.gold, C.rose][i], 1)) +
    stroke("M14 34 L20 26 L26 34 L32 22 L38 34 M62 34 L68 26 L74 34 L80 22 L86 34", C.purple, 3) +
    legs(14, 80, 78, 10, C.steel),
  "ball-pit": () =>
    block(10, 44, 80, 40, C.blue, { rx: 8, depth: 5, right: 3 }) +
    rect(16, 50, 68, 28, tint(C.blue, 0.2), 4) +
    repeat(12, (i) => ball(24 + (i % 6) * 10.5, 56 + Math.floor(i / 6) * 12, 5, [C.red, C.gold, C.green, C.sky, C.pink, C.orange, C.purple, C.gold, C.red, C.green, C.sky, C.rose][i])) +
    rect(10, 40, 80, 6, tint(C.blue, 0.3), 3),
  "hot-tub": () =>
    block(12, 46, 76, 36, C.walnut, { rx: 10, depth: 5, right: 3 }) +
    rect(18, 50, 64, 26, C.sky, 6) +
    repeat(5, (i) => ring(28 + i * 11, 62, 3, 1.5, tint(C.sky, 0.7))) +
    stroke("M30 40 Q34 34 30 28 M50 40 Q54 34 50 28 M70 40 Q74 34 70 28", tint(C.sky, 0.5), 2) +
    ball(72, 56, 5, C.gold),
  planetarium: () =>
    path("M12 80 Q12 30 50 30 Q88 30 88 80Z", C.indigo) +
    path("M20 80 Q20 38 50 38 Q80 38 80 80Z", shade(C.indigo, 0.35)) +
    repeat(10, (i) => disc(26 + (i * 37) % 48, 46 + (i * 19) % 28, i % 3 ? 1.2 : 2, C.paper)) +
    ball(60, 52, 6, C.gold) +
    ring(60, 52, 9, 1.5, tint(C.gold, 0.4)) +
    block(10, 80, 80, 8, C.steel, { rx: 3, depth: 3, right: 3 }),
  "dino-skeleton": () =>
    block(10, 82, 80, 6, C.walnut, { rx: 2, depth: 2, right: 2 }) +
    stroke("M14 60 Q30 40 50 44 Q68 46 74 32", C.cream, 6) +
    repeat(6, (i) => line(24 + i * 8, 48 - Math.abs(i - 2.5) * 2, 24 + i * 8, 66 - Math.abs(i - 2.5) * 3, C.cream, 3)) +
    ball(78, 26, 10, C.cream) +
    rect(80, 28, 12, 6, C.cream, 2) +
    disc(80, 24, 2, C.ink) +
    legs(30, 58, 60, 24, C.cream, 5),
  "robot-dog": () =>
    block(24, 42, 44, 24, C.chrome, { rx: 8, depth: 4, right: 3 }) +
    block(62, 30, 22, 18, C.chrome, { rx: 6, depth: 3, right: 2 }) +
    rect(66, 36, 12, 4, C.sky, 2) +
    rect(76, 24, 4, 8, C.steel, 2) +
    stroke("M26 46 Q14 40 12 30", C.steel, 4) +
    ball(12, 28, 3, C.rose) +
    legs(28, 40, 66, 20, C.steel, 6) +
    legs(52, 62, 66, 20, C.steel, 6),
  "holo-table": () =>
    block(14, 68, 72, 12, C.ink, { rx: 4, depth: 4, right: 3 }) +
    rect(20, 66, 60, 4, C.sky, 2) +
    poly([[24, 66], [76, 66], [64, 20], [36, 20]], "rgba(56,189,248,0.28)") +
    stroke("M36 52 L46 40 L54 46 L64 30", tint(C.sky, 0.5), 3) +
    ring(50, 40, 10, 2, tint(C.sky, 0.5)) +
    ball(50, 40, 4, C.paper) +
    legs(22, 72, 80, 8, C.steel),
  slide: () =>
    block(16, 20, 8, 66, C.steel, { depth: 2, right: 2 }) +
    block(22, 14, 22, 8, C.rose, { rx: 3, depth: 2 }) +
    path("M24 22 Q26 60 84 80 L84 88 Q20 70 16 22Z", C.gold) +
    path("M28 24 Q30 56 82 78", tint(C.gold, 0.35)) +
    repeat(5, (i) => rect(12, 30 + i * 11, 12, 3, C.chrome, 1)),
  "ice-cream-cart": () =>
    block(18, 40, 64, 36, C.pink, { rx: 5, depth: 4, right: 3 }) +
    rect(18, 40, 64, 8, C.paper, 2) +
    repeat(4, (i) => rect(22 + i * 16, 40, 8, 8, C.rose, 1)) +
    block(14, 24, 72, 12, C.rose, { rx: 4, depth: 3, right: 2 }) +
    poly([[44, 76], [56, 76], [50, 92]], C.pine) +
    ball(50, 72, 8, C.pink) +
    ball(48, 64, 7, C.cream) +
    ball(30, 82, 7, C.ink) +
    ball(70, 82, 7, C.ink),
  greenhouse: () =>
    poly([[12, 44], [50, 14], [88, 44]], C.chrome) +
    block(14, 44, 72, 42, tint(C.sky, 0.6), { rx: 2, depth: 4, right: 3 }) +
    poly([[18, 42], [50, 20], [82, 42]], tint(C.sky, 0.65)) +
    line(50, 14, 50, 86, C.chrome, 2) +
    line(14, 62, 86, 62, C.chrome, 2) +
    ball(32, 72, 8, C.green) +
    ball(68, 70, 9, C.leaf) +
    block(24, 78, 52, 6, C.wood, { rx: 2, depth: 2 }),
  "block-castle": () =>
    block(10, 84, 80, 6, C.walnut, { rx: 2, depth: 2, right: 2 }) +
    block(16, 40, 22, 44, C.red, { rx: 2, depth: 3, right: 3 }) +
    block(62, 40, 22, 44, C.blue, { rx: 2, depth: 3, right: 3 }) +
    block(38, 54, 24, 30, C.gold, { rx: 2, depth: 3, right: 3 }) +
    repeat(3, (i) => rect(16 + i * 8, 34, 6, 8, C.red, 1)) +
    repeat(3, (i) => rect(62 + i * 8, 34, 6, 8, C.blue, 1)) +
    poly([[24, 34], [24, 20], [34, 26]], C.green) +
    rect(46, 68, 8, 16, C.ink, 4),

  // ---- Unit prizes: earned by finishing a unit, never sold ----------------
  "prize-ruler": () =>
    block(40, 78, 20, 8, C.walnut, { rx: 2, depth: 3, right: 2 }) +
    `<g transform="rotate(-30 50 50)">${block(10, 44, 80, 16, C.gold, { rx: 2, depth: 3, right: 3 })}${repeat(9, (i) => rect(16 + i * 8, 44, 2, i % 2 ? 5 : 8, shade(C.gold, 0.45)))}</g>`,
  "prize-scale": () =>
    block(46, 24, 8, 58, C.brass, { rx: 2, depth: 2, right: 2 }) +
    oval(50, 86, 22, 5, C.brass) +
    block(20, 24, 60, 5, C.brass, { rx: 2, depth: 1.5 }) +
    line(28, 28, 28, 50, C.brass, 2) +
    line(72, 28, 72, 56, C.brass, 2) +
    path("M14 50 Q28 66 42 50Z", C.gold) +
    path("M58 56 Q72 72 86 56Z", C.gold) +
    ball(28, 46, 4, C.sky) +
    ball(70, 52, 5, C.rose) +
    ball(76, 52, 4, C.rose),
  "prize-graph": () =>
    block(14, 14, 72, 64, C.walnut, { rx: 3, depth: 4, right: 3 }) +
    rect(20, 20, 60, 52, C.paper, 1) +
    stroke("M26 66 L26 26 M26 66 L74 66", C.chrome, 2) +
    stroke("M30 60 L70 30", C.green, 4) +
    ball(40, 52.5, 3.5, C.green) +
    ball(60, 37.5, 3.5, C.green),
  "prize-neon-line": () =>
    block(10, 30, 80, 40, C.ink, { rx: 6, depth: 4, right: 3 }) +
    stroke("M18 62 L18 38 M18 62 L82 62", tint(C.sky, 0.2), 2.5) +
    stroke("M18 54 L78 36", C.gold, 4) +
    ball(18, 54, 4, C.gold) +
    ring(18, 54, 7, 1.5, tint(C.gold, 0.4)),
  "prize-lasers": () =>
    block(12, 76, 22, 12, C.ink, { rx: 3, depth: 3, right: 2 }) +
    block(66, 76, 22, 12, C.ink, { rx: 3, depth: 3, right: 2 }) +
    stroke("M22 76 L74 26", C.rose, 4) +
    stroke("M78 76 L26 20", C.sky, 4) +
    ball(50, 49, 6, C.paper) +
    ring(50, 49, 10, 2, tint(C.purple, 0.4)),
  "prize-half-rug": () =>
    oval(50, 74, 44, 16, C.teal) +
    path("M50 58 Q94 58 94 74 Q94 90 50 90Z", shade(C.teal, 0.35)) +
    repeat(5, (i) => stroke(`M${54 + i * 8} 60 L${58 + i * 8} 88`, tint(C.teal, 0.5), 1.5)) +
    rect(49, 58, 2, 32, C.paper),
  "prize-machine": () =>
    block(26, 30, 48, 40, C.indigo, { rx: 8, depth: 4, right: 3 }) +
    rect(4, 46, 24, 8, C.steel, 2) +
    rect(72, 46, 24, 8, C.steel, 2) +
    ball(16, 42, 5, C.gold) +
    ball(84, 42, 5, C.green) +
    rect(34, 38, 32, 22, tint(C.indigo, 0.25), 4) +
    stroke("M52 42c-4-1-6 1-7 5l-1 6c-1 3-2 5-5 5M42 50h8", C.paper, 2.5) +
    legs(32, 62, 70, 16, C.steel),
  "prize-stairs": () =>
    repeat(4, (i) => block(14 + i * 18, 70 - i * 16, 18, 18 + i * 16, C.orange, { rx: 2, depth: 3, right: 3 })) +
    repeat(4, (i) => ball(23 + i * 18, 62 - i * 16, 4, C.paper)),
  "prize-bonsai": () =>
    block(30, 70, 40, 14, C.teal, { rx: 3, depth: 4, right: 3 }) +
    stroke("M50 70 Q48 56 42 48 M50 70 Q54 54 62 44", C.walnut, 5) +
    ball(38, 42, 12, C.green) +
    ball(62, 38, 13, C.leaf) +
    ball(50, 28, 9, C.lime) +
    stroke("M26 36 L34 50 L42 22", tint(C.paper, 0.2), 2.5),
  "prize-vine": () =>
    block(16, 10, 68, 76, C.cream, { rx: 3, depth: 3, right: 2 }) +
    stroke("M24 80 Q40 78 50 66 Q60 54 62 38 Q64 24 76 18", C.leaf, 4) +
    repeat(6, (i) => ball([30, 44, 52, 58, 64, 72][i], [76, 70, 58, 44, 30, 22][i], 4 + (i > 3 ? 1 : 0), i % 2 ? C.green : C.lime)) +
    ball(78, 16, 4, C.gold),
  "prize-area-table": () =>
    block(12, 40, 76, 12, C.walnut, { rx: 3, depth: 3, right: 3 }) +
    rect(16, 42, 32, 6, C.pink, 1) +
    rect(50, 42, 34, 6, C.rose, 1) +
    rect(16, 44, 68, 1.5, shade(C.walnut, 0.3)) +
    legs(18, 74, 52, 26, C.walnut, 8) +
    ball(38, 34, 5, C.gold),
  "prize-arch": () =>
    block(12, 84, 76, 6, C.steel, { rx: 2, depth: 2, right: 2 }) +
    stroke("M18 84 Q22 22 50 22 Q78 22 82 84", C.blue, 8) +
    stroke("M18 84 Q22 22 50 22 Q78 22 82 84", tint(C.blue, 0.4), 3) +
    repeat(5, (i) => ball([26, 36, 50, 64, 74][i], [58, 36, 30, 36, 58][i], 3.5, C.gold)),
  "prize-zigzag": () =>
    block(10, 30, 80, 40, C.ink, { rx: 6, depth: 4, right: 3 }) +
    stroke("M18 40 L34 60 L50 40 L66 60 L82 40", C.pink, 4) +
    stroke("M18 40 L34 60 L50 40 L66 60 L82 40", tint(C.pink, 0.5), 1.5),
};

/**
 * What stands around the rink. Drawn on the same canvas; a piece keeps its
 * feet near y = 90 so it sits on the lawn.
 */
const RINK_ART: Record<string, () => string> = {
  "rink-cones": () =>
    repeat(3, (i) => {
      const x = 22 + i * 28;
      return poly([[x - 9, 86], [x + 9, 86], [x + 4, 56], [x - 4, 56]], C.orange) + rect(x - 6, 70, 12, 4, C.paper, 1) + block(x - 12, 84, 24, 5, C.orange, { rx: 2, depth: 2 });
    }),
  "rink-bench": () =>
    block(10, 52, 80, 10, C.wood, { rx: 3, depth: 3, right: 3 }) +
    block(10, 38, 80, 8, C.wood, { rx: 3, depth: 3, right: 3 }) +
    legs(16, 78, 62, 26, C.steel, 6) +
    block(14, 46, 6, 8, C.steel, { depth: 1 }) +
    block(80, 46, 6, 8, C.steel, { depth: 1 }),
  "rink-planter": () =>
    block(34, 64, 32, 22, C.teal, { rx: 3, depth: 4, right: 3 }) +
    rect(50, 34, 4, 30, C.walnut) +
    repeat(5, (i) => `<g transform="rotate(${-70 + i * 35} 52 34)">${path("M52 34 Q66 20 82 30 Q68 30 52 34Z", i % 2 ? C.green : C.leaf)}</g>`) +
    ball(52, 32, 4, C.walnut),
  "rink-lamp": () =>
    oval(50, 88, 14, 4, C.steel) +
    block(47, 22, 6, 66, C.ink, { right: 2 }) +
    block(34, 10, 32, 16, C.ink, { rx: 3, depth: 3, right: 2 }) +
    rect(38, 14, 24, 9, tint(C.yellow, 0.5), 2) +
    ellipse(50, 40, 22, 6, tint(C.yellow, 0.7)),
  "rink-banner": () =>
    block(14, 14, 6, 74, C.steel, { right: 1.5 }) +
    block(80, 14, 6, 74, C.steel, { right: 1.5 }) +
    block(20, 20, 60, 30, C.rose, { rx: 3, depth: 3, right: 2 }) +
    // R I N K
    stroke("M27 41 L27 29 L33 29 Q36 29 36 32.5 Q36 36 33 36 L27 36 M32 36 L36 41", C.paper, 2.5) +
    stroke("M43 29 L43 41", C.paper, 2.5) +
    stroke("M50 41 L50 29 L58 41 L58 29", C.paper, 2.5) +
    stroke("M65 29 L65 41 M73 29 L65 35 L73 41", C.paper, 2.5),
  "rink-arch": () =>
    stroke("M14 88 Q14 20 50 20 Q86 20 86 88", C.ink, 6) +
    repeat(7, (i) => {
      const a = Math.PI * (0.12 + (i * 0.76) / 6);
      const x = 50 - 36 * Math.cos(a);
      const y = 88 - 68 * Math.sin(a) * 1.0;
      return ball(x, y, 4.5, [C.gold, C.rose, C.sky, C.green, C.purple, C.orange, C.gold][i]);
    }) +
    block(8, 84, 14, 6, C.steel, { rx: 2, depth: 2 }) +
    block(78, 84, 14, 6, C.steel, { rx: 2, depth: 2 }),
  "rink-snacks": () =>
    block(16, 44, 68, 42, C.gold, { rx: 4, depth: 4, right: 3 }) +
    block(12, 28, 76, 12, C.rose, { rx: 3, depth: 3, right: 2 }) +
    repeat(6, (i) => rect(14 + i * 12.5, 34, 6, 8, i % 2 ? C.paper : C.rose, 1)) +
    rect(22, 52, 56, 6, C.paper, 2) +
    ball(34, 68, 6, C.sky) +
    ball(50, 66, 6, C.pink) +
    ball(66, 68, 6, C.orange),
  "rink-scoreboard": () =>
    block(44, 56, 12, 32, C.steel, { depth: 2, right: 2 }) +
    block(12, 10, 76, 48, C.ink, { rx: 5, depth: 4, right: 3 }) +
    rect(18, 16, 30, 16, C.green, 2) +
    rect(52, 16, 30, 16, C.rose, 2) +
    repeat(2, (i) => rect(22 + i * 34, 20, 10, 8, C.ink, 1) + rect(35 + i * 34, 20, 10, 8, C.ink, 1)) +
    rect(18, 38, 64, 14, tint(C.sky, 0.2), 2) +
    repeat(4, (i) => rect(22 + i * 15, 42, 10, 6, C.sky, 1)),
  "rink-speakers": () =>
    block(30, 10, 40, 78, C.ink, { rx: 5, depth: 4, right: 3 }) +
    ball(50, 30, 12, C.steel) +
    disc(50, 30, 6, C.ink) +
    ball(50, 62, 15, C.steel) +
    disc(50, 62, 8, C.ink) +
    ball(50, 62, 3, C.rose) +
    rect(36, 44, 28, 4, C.chrome, 2),
  "rink-ramp": () =>
    path("M10 88 L10 46 Q14 78 50 84 L90 84 L90 88Z", C.chrome) +
    path("M14 86 L14 56 Q18 78 52 82 L86 82 L86 86Z", C.sky) +
    rect(8, 42, 8, 6, C.gold, 2) +
    repeat(3, (i) => rect(60 + i * 10, 84, 6, 4, C.steel, 1)),
  "rink-booth": () =>
    block(20, 10, 60, 78, C.pink, { rx: 5, depth: 4, right: 3 }) +
    rect(26, 16, 48, 10, C.paper, 2) +
    rect(30, 32, 40, 40, C.ink, 3) +
    ball(50, 46, 9, tint(C.pink, 0.4)) +
    rect(40, 56, 20, 12, tint(C.pink, 0.2), 2) +
    ball(50, 20, 3.5, C.rose) +
    rect(26, 76, 48, 6, C.rose, 2),
  "rink-dj": () =>
    block(8, 46, 84, 30, C.ink, { rx: 4, depth: 4, right: 3 }) +
    ball(30, 60, 12, C.chrome) +
    disc(30, 60, 5, C.rose) +
    ball(70, 60, 12, C.chrome) +
    disc(70, 60, 5, C.sky) +
    repeat(3, (i) => rect(46, 52 + i * 7, 8, 3, [C.green, C.gold, C.rose][i], 1)) +
    stroke("M18 36 L24 28 L30 36 L36 22 L42 36 M58 36 L64 28 L70 36 L76 22 L82 36", C.purple, 3) +
    legs(14, 80, 76, 12, C.steel),
  "rink-disco": () =>
    block(46, 4, 8, 22, C.steel, { right: 2 }) +
    stroke("M20 26 L80 26", C.steel, 4) +
    ball(50, 52, 26, C.chrome) +
    repeat(4, (i) => rect(28 + i * 12, 40, 8, 8, tint(C.chrome, 0.5), 1)) +
    repeat(5, (i) => rect(22 + i * 12, 52, 8, 8, i % 2 ? tint(C.chrome, 0.5) : shade(C.chrome, 0.1), 1)) +
    repeat(4, (i) => rect(28 + i * 12, 64, 8, 8, tint(C.chrome, 0.5), 1)) +
    repeat(4, (i) => ball([10, 90, 16, 84][i], [70, 66, 40, 44][i], 3, [C.rose, C.sky, C.gold, C.green][i])),
  "rink-neon": () =>
    block(10, 12, 80, 76, C.ink, { rx: 6, depth: 4, right: 3 }) +
    stroke("M40 30 Q52 22 56 32 Q50 40 44 36 M46 36 Q36 46 48 58 L56 60 M48 58 L38 74 M56 60 L62 74 M34 76 L44 76 M58 76 L68 76", C.pink, 3.5) +
    ball(52, 30, 6, C.pink) +
    stroke("M40 30 Q52 22 56 32 Q50 40 44 36 M46 36 Q36 46 48 58 L56 60 M48 58 L38 74 M56 60 L62 74", tint(C.pink, 0.6), 1.2),
};

for (const [id, draw] of Object.entries(RINK_ART)) ART[id] = draw;

/** The rink pieces, for the export. */
export const RINK_ART_IDS: string[] = Object.keys(RINK_ART);

/** Every id that has art, so the catalog and the export can be checked against it. */
export const ART_IDS: string[] = Object.keys(ART);

/** The SVG for a piece, or null when it has no art. */
export function furnitureSvg(id: string): string | null {
  const draw = ART[id];
  if (!draw) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${draw()}</svg>`;
}
