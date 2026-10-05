/**
 * The pieces every arena shares, drawn to look like the real thing from a
 * broadcast camera high in the stands: a seating bowl full of people that
 * rises away from the floor, a hardwood floor in perspective with a gloss,
 * glowing LED ribbon and courtside boards, a video board hung over the floor,
 * light glare from the rigs, and a vignette.
 *
 * The camera is the one the games already use: the vanishing point sits just
 * above the frame (VP), which is where the court lines and the players' depth
 * scaling in src/lib/games.ts both put it. Everything here is static SVG with
 * gradients and patterns: no filters, no blurs, nothing that repaints per
 * frame (see the performance rules in the project notes).
 *
 * The crowd is drawn with tiles: a strip of twelve people per tile, three
 * tiles with different people, repeated along each row at the row's size and
 * an offset of its own. Thousands of fans cost a few hundred nodes.
 */

import type React from "react";

export const AW = 1200;
export const AH = 800;
/** The vanishing point of the floor, just above the frame. */
export const VP = { x: 600, y: -110 } as const;

const FONT = "ui-sans-serif, system-ui";

/** Rounds to hundredths, so computed coordinates print the same on the server and in the browser. */
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A small integer hash, so "random" choices are the same on the server and in the browser. */
function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** Where a line through the vanishing point crosses height y, starting from (x0, y0). */
export function toward(x0: number, y0: number, y: number): number {
  return r2(VP.x + ((x0 - VP.x) * (y - VP.y)) / (y0 - VP.y));
}

const SKINS = ["#f1c7a5", "#e0ac86", "#c98d63", "#b07a55", "#8d5a3b", "#6f432a", "#4b2d1c"];
const HAIRS = ["#1c1210", "#2b1b12", "#4a2c17", "#6b4426", "#c9a24a", "#111111", "#7a5230"];

/* ── The crowd tiles ─────────────────────────────────────────────────── */

const TILE_W = 240;
const TILE_H = 34;
const SEATS = 12;

/**
 * Three tiles of twelve fans each, for one arena: `shirts` are the colors the
 * crowd wears (repeat a color to make it more common), `seat` the seat backs.
 * Patterns use user space, so a row scales and shifts them by its transform.
 */
export function CrowdTiles({ id, shirts, seat }: { id: string; shirts: string[]; seat: string }) {
  return (
    <>
      {[0, 1, 2].map((t) => (
        <pattern key={t} id={`${id}-crowd-${t}`} patternUnits="userSpaceOnUse" x="0" y="0" width={TILE_W} height={TILE_H}>
          {Array.from({ length: SEATS }, (_, k) => {
            const h = hash(t * 131 + k * 17 + id.length * 7);
            const cx = 10 + k * 20 + ((h >> 3) % 3) - 1;
            const shirt = shirts[h % shirts.length];
            const skin = SKINS[(h >> 5) % SKINS.length];
            const hair = HAIRS[(h >> 9) % HAIRS.length];
            const up = (h >> 12) % 11 === 0;
            const lean = ((h >> 15) % 3) - 1;
            const hx = cx + lean * 0.8;
            const longHair = (h >> 18) % 4 === 0;
            const cap = (h >> 20) % 9 === 0;
            return (
              <g key={k}>
                {/* The seat back behind them. */}
                <rect x={cx - 9} y="19" width="18" height="15" rx="2.5" fill={seat} />
                <rect x={cx - 9} y="19" width="18" height="2.5" rx="1.2" fill="#ffffff" opacity="0.12" />
                {/* Shoulders and chest, then a fold of shade on the far side. */}
                <path d={`M${cx - 8.6} 34 C${cx - 8.6} 24.5 ${cx - 6.2} 20.6 ${cx - 2.6} 20.2 L${cx + 2.6} 20.2 C${cx + 6.2} 20.6 ${cx + 8.6} 24.5 ${cx + 8.6} 34Z`} fill={shirt} />
                <path d={`M${cx + 2.6} 20.2 C${cx + 6.2} 20.6 ${cx + 8.6} 24.5 ${cx + 8.6} 34 L${cx + 3.4} 34 C${cx + 4.4} 27 ${cx + 4} 22.6 ${cx + 2.6} 20.2Z`} fill="#000000" opacity="0.22" />
                {up && <rect x={cx + 5.6} y="2.2" width="2.8" height="19" rx="1.4" fill={skin} />}
                {up && (h >> 22) % 2 === 0 && <rect x={cx + 4.6} y="-0.6" width="4.8" height="6.4" rx="1.6" fill="#facc15" />}
                {/* Neck, head lit from the upper left, hair. */}
                <rect x={hx - 1.6} y="15.4" width="3.2" height="5.4" fill={skin} />
                <circle cx={hx} cy="12.6" r="4.7" fill={skin} />
                <path d={`M${hx + 0.9} 7.95 A4.7 4.7 0 0 1 ${hx + 0.9} 17.25 A3.3 4.7 0 0 0 ${hx + 0.9} 7.95Z`} fill="#000000" opacity="0.2" />
                {cap ? (
                  <path d={`M${hx - 5} 11 Q${hx - 4.8} 6.2 ${hx} 6.4 Q${hx + 4.8} 6.2 ${hx + 5} 11 L${hx + 7.4} 11.4 L${hx + 7.2} 12.4 L${hx - 5} 12Z`} fill={shirts[(h >> 7) % shirts.length]} />
                ) : longHair ? (
                  <path d={`M${hx - 5} 12.6 Q${hx - 5.4} 6.8 ${hx} 7 Q${hx + 5.4} 6.8 ${hx + 5} 12.6 L${hx + 5.4} 18.6 L${hx + 3.6} 18.2 Q${hx + 3.8} 9.6 ${hx} 9.6 Q${hx - 3.8} 9.6 ${hx - 3.6} 18.2 L${hx - 5.4} 18.6Z`} fill={hair} />
                ) : (
                  <path d={`M${hx - 4.9} 12 Q${hx - 5.1} 6.9 ${hx} 7 Q${hx + 5.1} 6.9 ${hx + 4.9} 12 Q${hx + 3.4} 9.2 ${hx} 9.3 Q${hx - 3.4} 9.2 ${hx - 4.9} 12Z`} fill={hair} />
                )}
              </g>
            );
          })}
        </pattern>
      ))}
    </>
  );
}

/**
 * One row of fans across [x0, x1], feet of the row at `y`, people scaled by
 * `s` (1 = a tile 34 units tall), using tile `tile` shifted by `shift` seats.
 */
function CrowdRow({ id, x0, x1, y, s, tile, shift }: { id: string; x0: number; x1: number; y: number; s: number; tile: number; shift: number }) {
  const phase = r2((shift * 20) % TILE_W);
  const tx = x0 - phase * s;
  const width = (x1 - tx) / s;
  return (
    <g transform={`translate(${r2(tx)} ${r2(y - TILE_H * s)}) scale(${r2(s * 1000) / 1000})`}>
      <rect x={phase} y="0" width={r2(width - phase)} height={TILE_H} fill={`url(#${id}-crowd-${tile})`} />
    </g>
  );
}

/* ── The bowl ────────────────────────────────────────────────────────── */

/**
 * The stand across the far end, full: rows of fans from `front` (the front
 * row's feet) up to `top`, people getting smaller with distance, aisles that
 * run up toward the vanishing point, tunnel mouths, the glass rail along the
 * front, and the light falling off toward the back.
 */
export function FarStand({
  id,
  front,
  top,
  x0 = -20,
  x1 = AW + 20,
  rows = 16,
  s0 = 0.62,
  s1 = 0.36,
  aisles = [160, 400, 800, 1040],
  tunnels = [280, 920],
  wall = "#141a2b",
}: {
  id: string;
  front: number;
  top: number;
  x0?: number;
  x1?: number;
  rows?: number;
  s0?: number;
  s1?: number;
  aisles?: number[];
  tunnels?: number[];
  wall?: string;
}) {
  const span = front - top;
  const ys: number[] = [];
  const ss: number[] = [];
  // Rows get closer together as they go back, like steps seen from above.
  const weights = Array.from({ length: rows }, (_, i) => 1 - (0.42 * i) / Math.max(1, rows - 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let y = front;
  for (let i = 0; i < rows; i += 1) {
    ys.push(r2(y));
    ss.push(s0 + ((s1 - s0) * i) / Math.max(1, rows - 1));
    y -= (span * weights[i]) / total;
  }
  return (
    <g>
      <rect x={x0} y={top - 6} width={x1 - x0} height={front - top + 12} fill={wall} />
      {/* Back to front, so each row's heads cover the shoulders behind them. */}
      {ys
        .map((ry, i) => ({ ry, i }))
        .reverse()
        .map(({ ry, i }) => (
          // Still: a bobbing row repaints a whole strip of crowd every frame, under a running game.
          <g key={i}>
            <rect x={x0} y={r2(ry - 2)} width={x1 - x0} height="2.4" fill="#0b0f19" opacity="0.55" />
            <CrowdRow id={id} x0={x0} x1={x1} y={ry} s={ss[i]} tile={(i * 2) % 3} shift={((i * 7.37 + 3.4) % SEATS)} />
          </g>
        ))}
      {/* Aisles: concrete steps running up the stand toward the vanishing point. */}
      {aisles.map((ax) => {
        const w = 13;
        const xt = toward(ax, front, top);
        const wt = (w * (top - VP.y)) / (front - VP.y);
        return (
          <g key={ax}>
            <path d={`M${ax - w / 2} ${front} L${ax + w / 2} ${front} L${r2(xt + wt / 2)} ${top} L${r2(xt - wt / 2)} ${top}Z`} fill="#3a4152" />
            <path
              d={ys.map((ry) => `M${r2(toward(ax - w / 2, front, ry))} ${ry} L${r2(toward(ax + w / 2, front, ry))} ${ry}`).join(" ")}
              stroke="#6b7385"
              strokeWidth="1.2"
            />
          </g>
        );
      })}
      {/* Tunnel mouths into the concourse, with their rails. */}
      {tunnels.map((tx) => (
        <g key={tx}>
          <path d={`M${tx - 34} ${front} L${tx + 34} ${front} L${tx + 30} ${front - 26} L${tx - 30} ${front - 26}Z`} fill="#05070c" />
          <rect x={tx - 34} y={front - 28} width="68" height="3" fill="#4b5563" />
          <rect x={tx - 36} y={front - 30} width="3" height="30" fill="#4b5563" />
          <rect x={tx + 33} y={front - 30} width="3" height="30" fill="#4b5563" />
        </g>
      ))}
      {/* Light falls off toward the back; the far rows sit in the dark. */}
      <rect x={x0} y={top - 6} width={x1 - x0} height={front - top + 12} fill={`url(#${id}-standfade)`} />
      {/* The glass rail along the front, catching the light. */}
      <rect x={x0} y={front - 9} width={x1 - x0} height="9" fill="#cbd5e1" opacity="0.14" />
      <rect x={x0} y={front - 10} width={x1 - x0} height="1.6" fill="#e2e8f0" opacity="0.7" />
    </g>
  );
}

/**
 * The side stands in the upper corners: tiers that run along the sides of the
 * floor toward the vanishing point, packed with people seen as rows of heads,
 * mostly in shadow at the edge of the picture.
 */
export function SideStands({ id, front, edge = 70, rows = 9, colors }: { id: string; front: number; edge?: number; rows?: number; colors: string[] }) {
  // Each side: the front of the stand is the line from (edge, front) toward the vanishing point;
  // rows step outward from it.
  return (
    <g>
      {[0, 1].map((side) => {
        const sign = side ? 1 : -1;
        const fx = side ? AW - edge : edge;
        const bottom = AH;
        const lines = Array.from({ length: rows }, (_, i) => fx + sign * (16 + i * 22));
        // Below the far stand only: the corner where the side stand meets the floor's edge.
        const poly = `M${fx} ${front} L${toward(fx, front, bottom)} ${bottom} L${side ? AW + 40 : -40} ${bottom} L${side ? AW + 40 : -40} ${front}Z`;
        return (
          <g key={side} clipPath={`url(#${id}-side-${side})`}>
            <defs>
              <clipPath id={`${id}-side-${side}`}>
                <path d={poly} />
              </clipPath>
            </defs>
            <path d={poly} fill="#121726" />
            {lines.map((lx, i) => {
              const d = `M${lx} ${front} L${toward(lx, front, bottom)} ${bottom}`;
              const w = 9 + i * 0.6;
              return (
                <g key={i}>
                  <path d={d} stroke="#1f2638" strokeWidth={w + 6} />
                  {colors.map((c, j) => (
                    <path
                      key={c + j}
                      d={d}
                      stroke={c}
                      strokeWidth={w}
                      strokeLinecap="round"
                      strokeDasharray={`0.1 ${r2(w * (colors.length + 0.4))}`}
                      strokeDashoffset={r2(-(j * w * 1.05) - i * 7)}
                    />
                  ))}
                  <path d={d} stroke="#e0ac86" strokeWidth={w * 0.62} strokeLinecap="round" strokeDasharray={`0.1 ${r2(w * 1.05)}`} strokeDashoffset={r2(-i * 7 - w * 0.5)} opacity="0.85" transform={`translate(${sign * -2} -${r2(w * 0.55)})`} />
                </g>
              );
            })}
            <path d={poly} fill={`url(#${id}-sidefade-${side})`} />
          </g>
        );
      })}
    </g>
  );
}

/* ── Light and boards ────────────────────────────────────────────────── */

/** The gradients the arena pieces share: stand fade, side fades, glare, vignette, board glow. */
export function ArenaDefs({ id, glow = "#60a5fa" }: { id: string; glow?: string }) {
  return (
    <>
      <linearGradient id={`${id}-standfade`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#000000" stopOpacity="0" />
        <stop offset="45%" stopColor="#030712" stopOpacity="0.28" />
        <stop offset="100%" stopColor="#030712" stopOpacity="0.72" />
      </linearGradient>
      <linearGradient id={`${id}-sidefade-0`} x1="1" y1="0" x2="0" y2="0">
        <stop offset="0%" stopColor="#030712" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#030712" stopOpacity="0.8" />
      </linearGradient>
      <linearGradient id={`${id}-sidefade-1`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#030712" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#030712" stopOpacity="0.8" />
      </linearGradient>
      <radialGradient id={`${id}-glare`}>
        <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="12%" stopColor="#fff7e0" stopOpacity="0.85" />
        <stop offset="40%" stopColor="#fde68a" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-vignette`} cx="50%" cy="58%" r="75%">
        <stop offset="55%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
      </radialGradient>
      <linearGradient id={`${id}-boardglow`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={glow} stopOpacity="0" />
        <stop offset="50%" stopColor={glow} stopOpacity="0.35" />
        <stop offset="100%" stopColor={glow} stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-reflect`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-screen`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1e3a8a" />
        <stop offset="100%" stopColor="#0b1638" />
      </linearGradient>
    </>
  );
}

/** A point of light with its glare, for the rigs under the roof. */
export function Glare({ id, x, y, r = 46, core = 3.4 }: { id: string; x: number; y: number; r?: number; core?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={`url(#${id}-glare)`} opacity="0.75" />
      <circle cx={x} cy={y} r={core} fill="#ffffff" />
    </g>
  );
}

/** A row of light rigs along the top of the picture, hung from a truss. */
export function LightRig({ id, y = 14, xs }: { id: string; y?: number; xs: number[] }) {
  return (
    <g>
      <rect x="-10" y={y - 6} width={AW + 20} height="5" fill="#0b0f19" />
      <path d={xs.map((x, i) => (i ? `L${x} ${y - 1} L${x + 30} ${y - 6}` : `M${x - 30} ${y - 6} L${x} ${y - 1} L${x + 30} ${y - 6}`)).join(" ")} stroke="#1f2937" strokeWidth="2" fill="none" />
      {xs.map((x) => (
        <Glare key={x} id={id} x={x} y={y + 2} r={58} />
      ))}
    </g>
  );
}

/**
 * An LED ribbon board running the width of the bowl: a black band with lit
 * segments of color and words, a soft glow around it.
 */
export function Ribbon({ id, y, h = 16, segments }: { id: string; y: number; h?: number; segments: { text: string; bg: string; fg: string }[] }) {
  const n = segments.length;
  const seg = (AW + 40) / n;
  return (
    <g>
      <rect x="-20" y={y - h} width={AW + 40} height={h * 3} fill={`url(#${id}-boardglow)`} opacity="0.7" />
      <rect x="-20" y={y} width={AW + 40} height={h} fill="#05070c" />
      {segments.map((s, i) => (
        <g key={i}>
          <rect x={r2(-20 + i * seg + 2)} y={y + 2} width={r2(seg - 4)} height={h - 4} fill={s.bg} />
          <text x={r2(-20 + i * seg + seg / 2)} y={r2(y + h * 0.74)} textAnchor="middle" fontSize={r2(h * 0.62)} fontWeight="800" fill={s.fg} fontFamily={FONT} letterSpacing="1" textLength={r2(Math.min(seg - 24, s.text.length * h * 0.48))} lengthAdjust="spacingAndGlyphs">
            {s.text}
          </text>
        </g>
      ))}
      <rect x="-20" y={y} width={AW + 40} height="1.4" fill="#ffffff" opacity="0.25" />
    </g>
  );
}

/**
 * Advertising boards along the far side of the floor: lit panels on a black
 * frame, their glow on the floor in front, and a soft reflection in the gloss.
 */
export function CourtBoards({
  id,
  y,
  h = 26,
  x0,
  x1,
  boards,
  reflect = true,
}: {
  id: string;
  y: number;
  h?: number;
  x0: number;
  x1: number;
  boards: { text: string; bg: string; fg: string }[];
  reflect?: boolean;
}) {
  const n = boards.length;
  const w = (x1 - x0) / n;
  return (
    <g>
      <rect x={x0} y={y} width={x1 - x0} height={h} fill="#05070c" />
      {boards.map((b, i) => (
        <g key={i}>
          <rect x={r2(x0 + i * w + 1.5)} y={y + 2} width={r2(w - 3)} height={h - 4} fill={b.bg} />
          <rect x={r2(x0 + i * w + 1.5)} y={y + 2} width={r2(w - 3)} height={r2((h - 4) * 0.45)} fill="#ffffff" opacity="0.08" />
          <text x={r2(x0 + i * w + w / 2)} y={r2(y + h * 0.7)} textAnchor="middle" fontSize={r2(h * 0.5)} fontWeight="800" fill={b.fg} fontFamily={FONT} letterSpacing="1" textLength={r2(Math.min(w - 20, b.text.length * h * 0.4))} lengthAdjust="spacingAndGlyphs">
            {b.text}
          </text>
          {reflect && <rect x={r2(x0 + i * w + 1.5)} y={y + h + 1} width={r2(w - 3)} height={r2(h * 1.5)} fill={b.bg} opacity="0.13" />}
        </g>
      ))}
      {reflect && <rect x={x0} y={y + h + 1} width={x1 - x0} height={r2(h * 1.5)} fill={`url(#${id}-reflect)`} opacity="0.3" />}
    </g>
  );
}

/**
 * The video board hung over the middle of the floor: a dark box with a
 * screen on its front, the angled side screens, an LED ring along its bottom,
 * and the cables up into the dark. `children` draw on the front screen, in
 * its own coordinates (0..356 wide, 0..96 tall).
 */
export function Jumbotron({ id, x = 600, y = 6, children, ring }: { id: string; x?: number; y?: number; children: React.ReactNode; ring: string }) {
  const W2 = 190;
  return (
    <g>
      <circle cx={x} cy={y + 60} r="240" fill={`url(#${id}-glare)`} opacity="0.14" />
      {[-150, -60, 60, 150].map((dx) => (
        <rect key={dx} x={x + dx - 1} y="-20" width="2" height={y + 20} fill="#374151" />
      ))}
      {/* Side screens, turned away. */}
      <path d={`M${x - W2} ${y} L${x - W2 - 34} ${y + 10} L${x - W2 - 34} ${y + 104} L${x - W2} ${y + 118}Z`} fill="#0b1220" />
      <path d={`M${x - W2 - 4} ${y + 8} L${x - W2 - 30} ${y + 16} L${x - W2 - 30} ${y + 98} L${x - W2 - 4} ${y + 108}Z`} fill="#1d3a8a" opacity="0.75" />
      <path d={`M${x + W2} ${y} L${x + W2 + 34} ${y + 10} L${x + W2 + 34} ${y + 104} L${x + W2} ${y + 118}Z`} fill="#0b1220" />
      <path d={`M${x + W2 + 4} ${y + 8} L${x + W2 + 30} ${y + 16} L${x + W2 + 30} ${y + 98} L${x + W2 + 4} ${y + 108}Z`} fill="#1d3a8a" opacity="0.75" />
      {/* The body and the front screen. */}
      <rect x={x - W2} y={y} width={W2 * 2} height="120" rx="4" fill="#0b0f19" />
      <g transform={`translate(${x - 178} ${y + 8})`}>
        <rect x="0" y="0" width="356" height="96" fill={`url(#${id}-screen)`} />
        {children}
        <rect x="0" y="0" width="356" height="34" fill="#ffffff" opacity="0.05" />
      </g>
      {/* The LED ring under the screens. */}
      <rect x={x - W2 - 34} y={y + 118} width={W2 * 2 + 68} height="16" rx="3" fill="#05070c" />
      <rect x={x - W2 - 30} y={y + 121} width={W2 * 2 + 60} height="10" fill={ring} />
      <text x={x} y={y + 129.5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#ffffff" fontFamily={FONT} letterSpacing="2" textLength="300" lengthAdjust="spacingAndGlyphs">
        ALGEBRIDGE · ALGEBRA 1 · ALL GAME LONG
      </text>
      <rect x={x - W2 - 30} y={y + 136} width={W2 * 2 + 60} height="22" fill={ring} opacity="0.12" />
    </g>
  );
}

/* ── Floors ──────────────────────────────────────────────────────────── */

/**
 * A hardwood floor from `top` to the bottom of the picture: maple boards that
 * run toward the vanishing point, the butt joints between them, a gloss that
 * brightens toward the far end, and a pool of light over the middle.
 */
export function WoodFloor({ id, top, base = "#d4a26a", dark = "#b9854f", light = "#e8bf86" }: { id: string; top: number; base?: string; dark?: string; light?: string }) {
  // Board seams: lines from the near edge (every 26 units) toward the vanishing point.
  const seams: string[] = [];
  for (let x = -1400; x <= AW + 1400; x += 26) {
    seams.push(`M${x} ${AH} L${toward(x, AH, top)} ${top}`);
  }
  // Butt joints: short cuts across a board here and there, closer together far away.
  const joints: string[] = [];
  for (let i = 0; i < 260; i += 1) {
    const h = hash(i * 7 + 3);
    const t = (h % 1000) / 1000;
    const y = top + (AH - top) * t * t;
    const lane = (h >> 10) % 100;
    const x = -1400 + lane * 26 + 13;
    const xa = toward(x - 13, AH, y);
    const xb = toward(x + 13, AH, y);
    if (xb < -20 || xa > AW + 20) continue;
    joints.push(`M${xa} ${r2(y)} L${xb} ${r2(y)}`);
  }
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="35%" stopColor={base} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`${id}-pool`} cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#fff7ed" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#fff7ed" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-20" y={top} width={AW + 40} height={AH - top + 20} fill={`url(#${id}-wood)`} />
      <path d={seams.join(" ")} stroke="#7c4a24" strokeWidth="0.9" opacity="0.32" />
      <path d={joints.join(" ")} stroke="#6b3d1c" strokeWidth="0.9" opacity="0.38" />
      {/* Alternate boards a shade lighter, so the floor reads as many boards, not one sheet. */}
      <path d={seams.filter((_, i) => i % 3 === 0).join(" ")} stroke="#f5d6a8" strokeWidth="7" opacity="0.07" />
      <rect x="-20" y={top} width={AW + 40} height={AH - top + 20} fill={`url(#${id}-pool)`} />
    </g>
  );
}

/** A darkened edge around the whole picture, the way a camera sees a lit floor in a dark arena. */
export function Vignette({ id }: { id: string }) {
  return <rect x="-20" y="-20" width={AW + 40} height={AH + 40} fill={`url(#${id}-vignette)`} pointerEvents="none" />;
}

/** A soft, wide reflection of something bright in the floor's gloss. */
export function FloorShine({ x, y, w, h, color = "#ffffff", opacity = 0.18 }: { x: number; y: number; w: number; h: number; color?: string; opacity?: number }) {
  return <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill={color} opacity={opacity} />;
}
