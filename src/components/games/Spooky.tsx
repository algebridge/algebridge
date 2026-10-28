/**
 * Halloween dressing for the arenas, drawn only in season (src/lib/season.ts):
 * jack-o'-lanterns along the boards, bats over the stands, cobwebs in the
 * corners of the goals and nets, a harvest moon in the open-air skies, strings
 * of orange and purple lights, a low fog along the floor, and the words the
 * boards switch to. Static SVG apart from the few `sc-*` groups (bats drift,
 * bulbs twinkle), which the scene pauses off screen like everything else.
 *
 * Everything is literal or plain arithmetic, so the server and the browser
 * draw the same picture.
 */

import { r2, hash } from "./Arena";

export const SPOOKY = {
  pumpkin: "#f0781e",
  pumpkinDeep: "#b4500f",
  pumpkinLight: "#ffa052",
  stem: "#4d7c0f",
  glow: "#ffd166",
  plum: "#5b21b6",
  plumDeep: "#2e1065",
  night: "#120a24",
  bone: "#f1e9d2",
  web: "#e2e8f0",
} as const;

/** The crowd in costume colors: orange, black, purple, a little white and green. */
export const SPOOKY_SHIRTS = ["#f0781e", "#f0781e", "#111111", "#5b21b6", "#111111", "#f8fafc", "#7c3aed", "#f0781e", "#16a34a", "#1f2937"];

/**
 * A jack-o'-lantern sitting on the ground at (x, y), `s` units tall. `lit`
 * glows from the inside; `face` picks a grin. The ribs are the pumpkin's
 * own lobes, the near one lit from the upper left.
 */
export function Pumpkin({ x, y, s = 20, lit = true, face = 0 }: { x: number; y: number; s?: number; lit?: boolean; face?: number }) {
  const k = s / 20;
  const X = (v: number) => r2(x + v * k);
  const Y = (v: number) => r2(y - v * k);
  const faceColor = lit ? SPOOKY.glow : SPOOKY.plumDeep;
  const grin =
    face % 3 === 0
      ? `M${X(-7)} ${Y(5.5)} L${X(-4)} ${Y(3)} L${X(-2)} ${Y(5)} L${X(0)} ${Y(2.6)} L${X(2)} ${Y(5)} L${X(4)} ${Y(3)} L${X(7)} ${Y(5.5)} Q${X(0)} ${Y(-1)} ${X(-7)} ${Y(5.5)}Z`
      : face % 3 === 1
        ? `M${X(-6.5)} ${Y(6)} Q${X(0)} ${Y(0)} ${X(6.5)} ${Y(6)} L${X(4.5)} ${Y(5.8)} L${X(3)} ${Y(3.8)} L${X(1)} ${Y(5.4)} L${X(-1.5)} ${Y(3.6)} L${X(-3.5)} ${Y(5.6)} L${X(-5)} ${Y(5.8)}Z`
        : `M${X(-5)} ${Y(5)} Q${X(0)} ${Y(1.2)} ${X(5)} ${Y(5)} Q${X(0)} ${Y(3.4)} ${X(-5)} ${Y(5)}Z`;
  return (
    <g>
      <ellipse cx={X(1)} cy={r2(y + 1.2 * k)} rx={r2(12 * k)} ry={r2(2.6 * k)} fill="#000000" opacity="0.35" />
      {lit && <ellipse cx={x} cy={r2(y - 8 * k)} rx={r2(16 * k)} ry={r2(11 * k)} fill={SPOOKY.glow} opacity="0.12" />}
      {/* The lobes, back to front, the near one lit. */}
      <ellipse cx={X(0)} cy={Y(8)} rx={r2(11 * k)} ry={r2(8.6 * k)} fill={SPOOKY.pumpkinDeep} />
      <ellipse cx={X(-5.5)} cy={Y(8)} rx={r2(5 * k)} ry={r2(8.2 * k)} fill={SPOOKY.pumpkin} />
      <ellipse cx={X(5.5)} cy={Y(8)} rx={r2(5 * k)} ry={r2(8.2 * k)} fill={SPOOKY.pumpkinDeep} />
      <ellipse cx={X(0)} cy={Y(8)} rx={r2(5.2 * k)} ry={r2(8.6 * k)} fill={SPOOKY.pumpkin} />
      <ellipse cx={X(-2.2)} cy={Y(10.5)} rx={r2(2.4 * k)} ry={r2(3.6 * k)} fill={SPOOKY.pumpkinLight} opacity="0.55" />
      {/* The stem, with a curl. */}
      <path d={`M${X(-1.4)} ${Y(16)} C${X(-1.6)} ${Y(18.5)} ${X(0.4)} ${Y(20)} ${X(1.8)} ${Y(19.2)} L${X(2.2)} ${Y(16.2)}Z`} fill={SPOOKY.stem} />
      <path d={`M${X(1.8)} ${Y(19.2)} q${r2(2 * k)} ${r2(-1.5 * k)} ${r2(3 * k)} ${r2(0.6 * k)}`} stroke={SPOOKY.stem} strokeWidth={r2(0.9 * k)} fill="none" strokeLinecap="round" />
      {/* The face: two triangle eyes, a nose, the grin. */}
      <path d={`M${X(-5.4)} ${Y(9)} L${X(-2.2)} ${Y(9)} L${X(-3.8)} ${Y(12.2)}Z M${X(2.2)} ${Y(9)} L${X(5.4)} ${Y(9)} L${X(3.8)} ${Y(12.2)}Z M${X(-1)} ${Y(7.2)} L${X(1)} ${Y(7.2)} L${X(0)} ${Y(8.8)}Z`} fill={faceColor} />
      <path d={grin} fill={faceColor} />
    </g>
  );
}

/** A bat in flight, wings out, `s` across. */
export function Bat({ x, y, s = 26, color = "#0b0612" }: { x: number; y: number; s?: number; color?: string }) {
  const k = s / 26;
  const X = (v: number) => r2(x + v * k);
  const Y = (v: number) => r2(y + v * k);
  return (
    <path
      d={`M${X(0)} ${Y(2)} C${X(-2)} ${Y(-1)} ${X(-4)} ${Y(-2)} ${X(-5)} ${Y(-1)} C${X(-7)} ${Y(-4)} ${X(-10)} ${Y(-5)} ${X(-13)} ${Y(-3.5)} C${X(-11)} ${Y(-1)} ${X(-10.5)} ${Y(1)} ${X(-11)} ${Y(3)} C${X(-8.5)} ${Y(1.5)} ${X(-6.5)} ${Y(2)} ${X(-5)} ${Y(3.6)} C${X(-3.5)} ${Y(2.2)} ${X(-2)} ${Y(2.4)} ${X(-1)} ${Y(3.6)} L${X(0)} ${Y(5)} L${X(1)} ${Y(3.6)} C${X(2)} ${Y(2.4)} ${X(3.5)} ${Y(2.2)} ${X(5)} ${Y(3.6)} C${X(6.5)} ${Y(2)} ${X(8.5)} ${Y(1.5)} ${X(11)} ${Y(3)} C${X(10.5)} ${Y(1)} ${X(11)} ${Y(-1)} ${X(13)} ${Y(-3.5)} C${X(10)} ${Y(-5)} ${X(7)} ${Y(-4)} ${X(5)} ${Y(-1)} C${X(4)} ${Y(-2)} ${X(2)} ${Y(-1)} ${X(0)} ${Y(2)}Z`}
      fill={color}
    />
  );
}

/** A loose flock drifting over the top of the picture, where the stands are dark. */
export function Bats({ seed = 1, color = "#0b0612", band = [40, 150] as [number, number] }: { seed?: number; color?: string; band?: [number, number] }) {
  return (
    <g className="sc-drift">
      {Array.from({ length: 9 }, (_, i) => {
        const h = hash(seed * 977 + i * 31);
        const x = 60 + ((h % 1000) / 1000) * 1080;
        const y = band[0] + (((h >> 10) % 1000) / 1000) * (band[1] - band[0]);
        const s = 14 + ((h >> 20) % 5) * 4;
        return <Bat key={i} x={r2(x)} y={r2(y)} s={s} color={color} />;
      })}
    </g>
  );
}

/**
 * A cobweb strung into a corner at (x, y): `flip` for a right-hand corner,
 * `down` for one hanging from an upper corner. `r` is its reach.
 */
export function Cobweb({ x, y, r = 40, flip = false, down = true }: { x: number; y: number; r?: number; flip?: boolean; down?: boolean }) {
  const sx = flip ? -1 : 1;
  const sy = down ? 1 : -1;
  const spokes = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
    // From straight out to straight down, in the quarter the corner opens into.
    const ax = r2(x + sx * r * (1 - t * t * 0.9) * (t < 1 ? 1 : 0.2));
    const ay = r2(y + sy * r * (t === 0 ? 0.1 : t * 0.95));
    return `M${x} ${y} L${ax} ${ay}`;
  });
  const rings = [0.3, 0.55, 0.8].map((k) =>
    [0, 0.2, 0.4, 0.6, 0.8, 1]
      .map((t, i) => {
        const ax = x + sx * r * k * (1 - t * t * 0.9) * (t < 1 ? 1 : 0.2);
        const ay = y + sy * r * k * (t === 0 ? 0.1 : t * 0.95);
        const sagx = x + sx * r * k * 0.92 * (1 - t * t * 0.9) * (t < 1 ? 1 : 0.2);
        const sagy = y + sy * r * k * 0.92 * (t === 0 ? 0.1 : t * 0.95);
        return i ? `Q${r2(sagx)} ${r2(sagy)} ${r2(ax)} ${r2(ay)}` : `M${r2(ax)} ${r2(ay)}`;
      })
      .join(" "),
  );
  return (
    <g stroke={SPOOKY.web} strokeWidth="0.9" fill="none" opacity="0.55" strokeLinecap="round">
      <path d={spokes.join(" ")} />
      <path d={rings.join(" ")} />
    </g>
  );
}

/** A harvest moon, big and low, with its soft halo and the shadows of its seas. */
export function Moon({ id, x, y, r = 60 }: { id: string; x: number; y: number; r?: number }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-moonhalo`}>
          <stop offset="0%" stopColor="#ffb347" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#ffb347" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-moon`} cx="0.4" cy="0.38" r="0.7">
          <stop offset="0%" stopColor="#fff6d6" />
          <stop offset="70%" stopColor="#f7c65e" />
          <stop offset="100%" stopColor="#d9902e" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r * 2.6} fill={`url(#${id}-moonhalo)`} />
      <circle cx={x} cy={y} r={r} fill={`url(#${id}-moon)`} />
      <g fill="#c9822a" opacity="0.28">
        <ellipse cx={r2(x - r * 0.28)} cy={r2(y - r * 0.2)} rx={r2(r * 0.2)} ry={r2(r * 0.14)} />
        <ellipse cx={r2(x + r * 0.22)} cy={r2(y + 0.1 * r)} rx={r2(r * 0.26)} ry={r2(r * 0.2)} />
        <ellipse cx={r2(x - r * 0.1)} cy={r2(y + r * 0.42)} rx={r2(r * 0.14)} ry={r2(r * 0.09)} />
        <circle cx={r2(x + r * 0.46)} cy={r2(y - r * 0.4)} r={r2(r * 0.07)} />
      </g>
    </g>
  );
}

/**
 * A string of party bulbs from (x0, y) to (x1, y), sagging `sag` in the
 * middle: orange and purple, twinkling in two groups out of phase.
 */
export function StringLights({ x0, x1, y, sag = 14, count = 16 }: { x0: number; x1: number; y: number; sag?: number; count?: number }) {
  const cx = (x0 + x1) / 2;
  const pts = Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const px = x0 + (x1 - x0) * t;
    // The wire is a parabola: the sag at the middle, none at the ends.
    const py = y + sag * (1 - ((px - cx) * (px - cx)) / (((x1 - x0) / 2) * ((x1 - x0) / 2)));
    return { x: r2(px), y: r2(py), i };
  });
  return (
    <g>
      <path d={`M${x0} ${y} Q${r2(cx)} ${r2(y + sag * 2)} ${x1} ${y}`} stroke="#1f2937" strokeWidth="1.2" fill="none" />
      {[0, 1].map((phase) => (
        <g key={phase} className="sc-twinkle" style={{ animationDelay: `${phase * -0.95}s` }}>
          {pts
            .filter((p) => p.i % 2 === phase)
            .map((p) => {
              const orange = p.i % 4 < 2;
              const c = orange ? SPOOKY.pumpkin : "#a855f7";
              return (
                <g key={p.i}>
                  <circle cx={p.x} cy={p.y + 6} r="7" fill={c} opacity="0.22" />
                  <rect x={p.x - 1.4} y={p.y} width="2.8" height="3" fill="#1f2937" />
                  <circle cx={p.x} cy={p.y + 6} r="3.2" fill={c} />
                  <circle cx={p.x - 0.9} cy={p.y + 5} r="1" fill="#ffffff" opacity="0.7" />
                </g>
              );
            })}
        </g>
      ))}
    </g>
  );
}

/** A low fog lying along the floor, from `y` down `h`, thicker at the sides. */
export function Fog({ id, y, h = 90, opacity = 0.35 }: { id: string; y: number; h?: number; opacity?: number }) {
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={`${id}-fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0" />
          <stop offset="55%" stopColor="#ddd6fe" stopOpacity={opacity} />
          <stop offset="100%" stopColor="#e9e5ff" stopOpacity={opacity * 0.6} />
        </linearGradient>
      </defs>
      <rect x="-20" y={y} width="1240" height={h} fill={`url(#${id}-fog)`} />
      <path d={`M-20 ${y + h * 0.5} C120 ${y + h * 0.2} 260 ${y + h * 0.7} 420 ${y + h * 0.4} S720 ${y + h * 0.75} 900 ${y + h * 0.35} S1120 ${y + h * 0.6} 1220 ${y + h * 0.3} L1220 ${y + h} L-20 ${y + h}Z`} fill="#ede9fe" opacity={opacity * 0.5} />
    </g>
  );
}

/** A small ghost peeking out, `s` tall, the sheet lit from the upper left. */
export function Ghost({ x, y, s = 30, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  const k = s / 30;
  const X = (v: number) => r2(x + (flip ? -v : v) * k);
  const Y = (v: number) => r2(y - v * k);
  return (
    <g className="sc-bob">
      <path d={`M${X(-9)} ${Y(0)} L${X(-9)} ${Y(18)} C${X(-9)} ${Y(26)} ${X(-4)} ${Y(30)} ${X(0)} ${Y(30)} C${X(4)} ${Y(30)} ${X(9)} ${Y(26)} ${X(9)} ${Y(18)} L${X(9)} ${Y(0)} L${X(6)} ${Y(3)} L${X(3)} ${Y(0)} L${X(0)} ${Y(3)} L${X(-3)} ${Y(0)} L${X(-6)} ${Y(3)}Z`} fill={SPOOKY.bone} />
      <path d={`M${X(2)} ${Y(29)} C${X(6)} ${Y(28)} ${X(9)} ${Y(24)} ${X(9)} ${Y(18)} L${X(9)} ${Y(0)} L${X(6)} ${Y(3)} L${X(5)} ${Y(4)} L${X(5)} ${Y(18)} C${X(5)} ${Y(23)} ${X(4)} ${Y(27)} ${X(2)} ${Y(29)}Z`} fill="#000000" opacity="0.12" />
      <ellipse cx={X(-3.2)} cy={Y(20)} rx={r2(1.6 * k)} ry={r2(2.4 * k)} fill="#1e1b4b" />
      <ellipse cx={X(3.2)} cy={Y(20)} rx={r2(1.6 * k)} ry={r2(2.4 * k)} fill="#1e1b4b" />
      <ellipse cx={X(0)} cy={Y(14)} rx={r2(1.8 * k)} ry={r2(2.6 * k)} fill="#1e1b4b" />
    </g>
  );
}

/** A black cat sitting, tail curled, eyes catching the light. */
export function Cat({ x, y, s = 22, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  const k = s / 22;
  const X = (v: number) => r2(x + (flip ? -v : v) * k);
  const Y = (v: number) => r2(y - v * k);
  return (
    <g>
      <ellipse cx={X(0)} cy={r2(y + 1 * k)} rx={r2(8 * k)} ry={r2(2 * k)} fill="#000000" opacity="0.3" />
      <path d={`M${X(-6)} ${Y(0)} C${X(-7)} ${Y(8)} ${X(-4)} ${Y(13)} ${X(0)} ${Y(13)} C${X(4)} ${Y(13)} ${X(7)} ${Y(8)} ${X(6)} ${Y(0)}Z`} fill="#0b0612" />
      <path d={`M${X(6)} ${Y(1)} C${X(12)} ${Y(1)} ${X(13)} ${Y(7)} ${X(9)} ${Y(9)}`} stroke="#0b0612" strokeWidth={r2(2 * k)} fill="none" strokeLinecap="round" />
      <circle cx={X(0)} cy={Y(16)} r={r2(5 * k)} fill="#0b0612" />
      <path d={`M${X(-4.5)} ${Y(18)} L${X(-4.5)} ${Y(23)} L${X(-1)} ${Y(20.5)}Z M${X(4.5)} ${Y(18)} L${X(4.5)} ${Y(23)} L${X(1)} ${Y(20.5)}Z`} fill="#0b0612" />
      <ellipse cx={X(-2)} cy={Y(16.5)} rx={r2(1.1 * k)} ry={r2(1.4 * k)} fill="#facc15" />
      <ellipse cx={X(2)} cy={Y(16.5)} rx={r2(1.1 * k)} ry={r2(1.4 * k)} fill="#facc15" />
    </g>
  );
}

/** The words the boards switch to in season, cycling through the list. */
export const SPOOKY_WORDS = ["HAPPY HALLOWEEN", "TRICK OR TREAT", "BOO!", "SPOOKY SEASON", "NO TRICKS, JUST MATH", "FANG-TASTIC"];

/** Boards dressed for the season: every other board keeps its own words, the rest turn orange, purple and black with a seasonal line. */
export function spookyBoards(boards: { text: string; bg: string; fg: string }[]): { text: string; bg: string; fg: string }[] {
  const looks = [
    { bg: SPOOKY.pumpkin, fg: "#1a0b00" },
    { bg: SPOOKY.plumDeep, fg: SPOOKY.pumpkinLight },
    { bg: "#0b0612", fg: SPOOKY.pumpkin },
  ];
  return boards.map((b, i) =>
    i % 2 === 0 ? b : { text: SPOOKY_WORDS[(i >> 1) % SPOOKY_WORDS.length], ...looks[(i >> 1) % looks.length] },
  );
}
