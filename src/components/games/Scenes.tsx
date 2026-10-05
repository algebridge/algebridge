"use client";

import { useEffect, useRef, useState } from "react";
import { GOAL, NET_Y, type CourtGameId } from "@/lib/games";
import { BOARD, RINK } from "@/lib/rink";
import { ArenaDefs, CourtBoards, CrowdTiles, FarStand, FloorShine, Glare, Jumbotron, LightRig, Ribbon, SideStands, Vignette, WoodFloor, toward } from "./Arena";

/**
 * The four courts and the rink, drawn flat on the same 1200 × 800 plane as
 * the House, in its hand: no outlines, two tones per surface, detail from
 * repetition. The play areas in src/lib/games.ts sit on these surfaces, so
 * everything drawn here stays clear of where the players run.
 */

const W = 1200;
const H = 800;
const FONT = "ui-sans-serif, system-ui";

/**
 * The scenes' motion (crowds, twinkles, snow, smoke) costs a style recalc and
 * a layout every frame: 128 layouts per 5 idle seconds on /games, against 2
 * on home. So it runs only while a game is being played and the scene is on
 * screen. The rest of the time the scene is a still picture, paused where it
 * stands. Reduced motion turns it off entirely (globals.css).
 */
const STILL_CSS = "[data-scene-motion='still'] * { animation-play-state: paused !important; }";

function SceneMotion({ live, children }: { live: boolean; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!live || !el) return;
    if (typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [live]);
  return (
    <div ref={box} data-scene-motion={live && onScreen ? "live" : "still"} className="absolute inset-0">
      <style>{STILL_CSS}</style>
      {children}
    </div>
  );
}

function Svg({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <title>{label}</title>
      {children}
    </svg>
  );
}

const SHIRTS = ["#1d4ed8", "#facc15", "#ef4444", "#f8fafc", "#22c55e", "#7c3aed", "#f97316", "#0ea5e9"];
const SKINS = ["#f1c7a5", "#b07a55", "#6f432a", "#8d5a3b", "#e0ac86", "#4b2d1c"];
const HAIRS = ["#1c1210", "#4a2c17", "#c9a24a", "#2b1b12", "#6b4426", "#111111"];

/** Rounds to hundredths, so a computed coordinate prints the same on the server and in the browser. */
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * A crowd in rows: people with sloped shoulders, heads lit from the upper
 * left with the far cheek in shade, hair cut four ways (short, long to the
 * shoulders, a bun, cropped), shirts in team colors, a few arms up. Placed
 * by a fixed pattern so the server and the browser agree.
 */
function Crowd({ x0, x1, y0, rows, gap, size, colors = SHIRTS }: { x0: number; x1: number; y0: number; rows: number; gap: number; size: number; colors?: string[] }) {
  const out: React.ReactNode[] = [];
  const s = size;
  for (let r = 0; r < rows; r += 1) {
    const y = y0 + r * gap;
    const row: React.ReactNode[] = [];
    for (let x = x0 + (r % 2) * (s * 1.1); x < x1; x += s * 2.3) {
      const k = Math.round(x * 7 + r * 13);
      const up = k % 9 === 0;
      const skin = SKINS[(k >> 2) % SKINS.length];
      const hy = y - s * 0.45;
      const X = (v: number) => r2(x + v * s);
      const Y = (v: number) => r2(y + v * s);
      const cut = (k >> 4) % 4;
      const hair =
        cut === 1
          ? `M${X(-0.68)} ${Y(-0.4)} Q${X(-0.72)} ${Y(-1.2)} ${X(0)} ${Y(-1.15)} Q${X(0.72)} ${Y(-1.2)} ${X(0.68)} ${Y(-0.4)} L${X(0.72)} ${Y(0.45)} L${X(0.44)} ${Y(0.4)} Q${X(0.5)} ${Y(-0.78)} ${X(0)} ${Y(-0.84)} Q${X(-0.5)} ${Y(-0.78)} ${X(-0.44)} ${Y(0.4)} L${X(-0.72)} ${Y(0.45)}Z`
          : cut === 2
            ? `M${X(-0.64)} ${Y(-0.45)} Q${X(-0.66)} ${Y(-1.15)} ${X(0)} ${Y(-1.12)} Q${X(0.66)} ${Y(-1.15)} ${X(0.64)} ${Y(-0.45)} Q${X(0.45)} ${Y(-0.86)} ${X(0)} ${Y(-0.88)} Q${X(-0.45)} ${Y(-0.86)} ${X(-0.64)} ${Y(-0.45)}Z M${X(0.02)} ${Y(-1.5)} a${r2(s * 0.3)} ${r2(s * 0.3)} 0 1 0 0.01 0Z`
            : cut === 3
              ? `M${X(-0.6)} ${Y(-0.6)} Q${X(-0.6)} ${Y(-1.1)} ${X(0)} ${Y(-1.08)} Q${X(0.6)} ${Y(-1.1)} ${X(0.6)} ${Y(-0.6)} Q${X(0.3)} ${Y(-0.96)} ${X(0)} ${Y(-0.96)} Q${X(-0.3)} ${Y(-0.96)} ${X(-0.6)} ${Y(-0.6)}Z`
              : `M${X(-0.64)} ${Y(-0.45)} Q${X(-0.66)} ${Y(-1.15)} ${X(0)} ${Y(-1.12)} Q${X(0.66)} ${Y(-1.15)} ${X(0.64)} ${Y(-0.45)} Q${X(0.45)} ${Y(-0.84)} ${X(0)} ${Y(-0.8)} Q${X(-0.45)} ${Y(-0.84)} ${X(-0.64)} ${Y(-0.45)}Z`;
      row.push(
        <g key={`${r}-${x}`}>
          {/* Shoulders, sloping from the neck. */}
          <path d={`M${X(-1)} ${Y(1.6)} C${X(-1)} ${Y(0.6)} ${X(-0.78)} ${Y(0.18)} ${X(-0.3)} ${Y(0.1)} L${X(0.3)} ${Y(0.1)} C${X(0.78)} ${Y(0.18)} ${X(1)} ${Y(0.6)} ${X(1)} ${Y(1.6)}Z`} fill={colors[k % colors.length]} />
          {up && <rect x={X(0.7)} y={Y(-1.5)} width={r2(s * 0.42)} height={r2(s * 1.8)} rx={r2(s * 0.21)} fill={skin} />}
          <circle cx={x} cy={r2(hy)} r={r2(s * 0.62)} fill={skin} />
          {/* The far cheek turned from the light. */}
          <path d={`M${X(0.12)} ${Y(-1.06)} A${r2(s * 0.62)} ${r2(s * 0.62)} 0 0 1 ${X(0.12)} ${Y(0.16)} A${r2(s * 0.44)} ${r2(s * 0.62)} 0 0 0 ${X(0.12)} ${Y(-1.06)}Z`} fill="#000000" opacity="0.16" />
          <path d={hair} fill={HAIRS[(k >> 3) % HAIRS.length]} />
        </g>
      );
    }
    // Each row sways on its own beat, so the stand looks alive without a thousand animations.
    out.push(
      <g key={r} className="sc-bob" style={{ animationDelay: `${(r % 2) * -1.3}s` }}>
        {row}
      </g>
    );
  }
  return <g>{out}</g>;
}

/** Text that always fits the sign it is on. */
function Fit({ x, y, w, size, fill, children, weight = 800, spacing }: { x: number; y: number; w: number; size: number; fill: string; children: string; weight?: number; spacing?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight={weight} fill={fill} fontFamily={FONT} letterSpacing={spacing} textLength={w} lengthAdjust="spacingAndGlyphs">
      {children}
    </text>
  );
}

/**
 * A small person standing or sitting: a coach, an official, a substitute.
 * Drawn to a real person's proportions (the head about a seventh of the
 * height), lit from the upper left with the far side in shade; `stripes`
 * dresses a referee.
 */
function Person({ x, y, h, shirt, skin = "#b07a55", hair = "#1c1210", stripes = false }: { x: number; y: number; h: number; shirt: string; skin?: string; hair?: string; stripes?: boolean }) {
  const u = h / 100;
  // Across from the middle, and up from the feet, in hundredths of the height.
  const X = (v: number) => r2(x + v * u);
  const Y = (v: number) => r2(y - v * u);
  const hr = r2(7.4 * u);
  return (
    <g>
      <ellipse cx={X(1)} cy={r2(y + 0.6 * u)} rx={r2(14 * u)} ry={r2(2.4 * u)} fill="#0f172a" opacity="0.16" />
      {/* Trousers, then shoes. */}
      <path d={`M${X(-10)} ${Y(50)} L${X(-0.6)} ${Y(50)} L${X(-1.4)} ${Y(4)} L${X(-8.6)} ${Y(4)}Z M${X(0.6)} ${Y(50)} L${X(10)} ${Y(50)} L${X(8.8)} ${Y(4)} L${X(1.6)} ${Y(4)}Z`} fill="#1f2937" />
      <path d={`M${X(-9.4)} ${Y(5)} L${X(-1)} ${Y(5)} L${X(0.4)} ${Y(0)} L${X(-9.8)} ${Y(0)}Z M${X(1.2)} ${Y(5)} L${X(9.4)} ${Y(5)} L${X(11.4)} ${Y(0)} L${X(1)} ${Y(0)}Z`} fill="#0b0f17" />
      {/* Arms at the sides: the forearms and hands below the sleeves. */}
      <path d={`M${X(-16.6)} ${Y(66)} L${X(-12.4)} ${Y(66)} L${X(-12.6)} ${Y(42)} L${X(-16)} ${Y(42)}Z M${X(12.4)} ${Y(66)} L${X(16.6)} ${Y(66)} L${X(16)} ${Y(42)} L${X(12.6)} ${Y(42)}Z`} fill={skin} />
      {/* The shirt: sloped shoulders, short sleeves, the hem at the hips. */}
      <path
        d={`M${X(-4.6)} ${Y(82)} C${X(-9)} ${Y(81)} ${X(-14)} ${Y(80)} ${X(-15.6)} ${Y(77)} L${X(-17.4)} ${Y(64)} L${X(-12)} ${Y(63)} L${X(-11.2)} ${Y(46)} L${X(11.2)} ${Y(46)} L${X(12)} ${Y(63)} L${X(17.4)} ${Y(64)} L${X(15.6)} ${Y(77)} C${X(14)} ${Y(80)} ${X(9)} ${Y(81)} ${X(4.6)} ${Y(82)}Z`}
        fill={shirt}
      />
      {stripes && <path d={`M${X(-8)} ${Y(80.6)} L${X(-5)} ${Y(81.4)} L${X(-5)} ${Y(46)} L${X(-8)} ${Y(46)}Z M${X(-1.5)} ${Y(82)} L${X(1.5)} ${Y(82)} L${X(1.5)} ${Y(46)} L${X(-1.5)} ${Y(46)}Z M${X(5)} ${Y(81.4)} L${X(8)} ${Y(80.6)} L${X(8)} ${Y(46)} L${X(5)} ${Y(46)}Z`} fill="#111827" />}
      {/* The far side of the body in shade. */}
      <path d={`M${X(4.6)} ${Y(82)} C${X(9)} ${Y(81)} ${X(14)} ${Y(80)} ${X(15.6)} ${Y(77)} L${X(17.4)} ${Y(64)} L${X(12)} ${Y(63)} L${X(11.2)} ${Y(46)} L${X(10)} ${Y(4)} L${X(4)} ${Y(4)} L${X(4)} ${Y(50)} L${X(3)} ${Y(82)}Z`} fill="#000000" opacity="0.16" />
      {/* Neck and head, the far cheek in shade, then the hair. */}
      <path d={`M${X(-3)} ${Y(86)} L${X(3)} ${Y(86)} L${X(3.4)} ${Y(80.6)} L${X(-3.4)} ${Y(80.6)}Z`} fill={skin} />
      <circle cx={x} cy={Y(91)} r={hr} fill={skin} />
      <path d={`M${X(1.4)} ${Y(98.3)} A${hr} ${hr} 0 0 1 ${X(1.4)} ${Y(83.7)} A${r2(5 * u)} ${hr} 0 0 0 ${X(1.4)} ${Y(98.3)}Z`} fill="#000000" opacity="0.18" />
      <path d={`M${X(-7.6)} ${Y(90)} Q${X(-8)} ${Y(99.4)} ${X(0)} ${Y(99.2)} Q${X(8)} ${Y(99.4)} ${X(7.6)} ${Y(90)} Q${X(5.6)} ${Y(95)} ${X(0)} ${Y(95.2)} Q${X(-5.6)} ${Y(95)} ${X(-7.6)} ${Y(90)}Z`} fill={hair} />
    </g>
  );
}

/* ── Shaurya: a school gym and a wrestling mat ───────────────────── */

export function WrestlingScene() {
  const id = "wr";
  // The mat and the platform it sits on, laid toward the vanishing point.
  const matFar = 405;
  const mat = `M130 ${matFar} L1070 ${matFar} L${toward(1070, matFar, H + 60)} ${H + 60} L${toward(130, matFar, H + 60)} ${H + 60}Z`;
  const deck = `M108 390 L1092 390 L${toward(1092, 390, H + 60)} ${H + 60} L${toward(108, 390, H + 60)} ${H + 60}Z`;
  return (
    <Svg label="Wrestling arena">
      <defs>
        <ArenaDefs id={id} glow="#60a5fa" />
        <CrowdTiles id={id} shirts={["#1d4ed8", "#1d4ed8", "#facc15", "#f8fafc", "#b91c1c", "#1f2937", "#1e3a8a", "#f97316"]} seat="#1e2a4a" />
        <radialGradient id="wr-spot" cx="50%" cy="56%" r="58%">
          <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.42" />
          <stop offset="55%" stopColor="#fffbeb" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#fffbeb" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wr-mat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
        <linearGradient id="wr-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff7ed" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#fff7ed" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#05070c" />
      <FarStand id={id} front={58} top={-14} rows={6} s0={0.3} s1={0.24} aisles={[220, 980]} tunnels={[]} />
      <Ribbon
        id={id}
        y={58}
        segments={[
          { text: "ALGEBRIDGE", bg: "#1e3a8a", fg: "#facc15" },
          { text: "WRESTLING", bg: "#111827", fg: "#ffffff" },
          { text: "PIN IT", bg: "#b91c1c", fg: "#ffffff" },
          { text: "ALGEBRA 1", bg: "#111827", fg: "#93c5fd" },
          { text: "TAKEDOWN", bg: "#1d4ed8", fg: "#ffffff" },
          { text: "ALGEBRIDGE", bg: "#1e3a8a", fg: "#facc15" },
        ]}
      />
      <FarStand id={id} front={300} top={76} rows={15} s0={0.6} s1={0.38} />
      <SideStands id={id} front={326} edge={60} colors={["#1d4ed8", "#facc15", "#f8fafc", "#b91c1c"]} />
      <LightRig id={id} y={12} xs={[100, 270, 930, 1100]} />
      <Jumbotron id={id} ring="#1d4ed8">
        <text x="178" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill="#93c5fd" fontFamily={FONT} letterSpacing="2">
          PERIOD 1 · 2:00
        </text>
        <rect x="16" y="24" width="150" height="62" rx="4" fill="#0b1220" />
        <rect x="190" y="24" width="150" height="62" rx="4" fill="#0b1220" />
        <text x="91" y="40" textAnchor="middle" fontSize="10" fontWeight="800" fill="#4ade80" fontFamily={FONT} letterSpacing="2">
          BRIDGES
        </text>
        <text x="265" y="40" textAnchor="middle" fontSize="10" fontWeight="800" fill="#f87171" fontFamily={FONT} letterSpacing="2">
          GUEST
        </text>
        <text x="91" y="80" textAnchor="middle" fontSize="40" fontWeight="800" fill="#4ade80" fontFamily="ui-monospace, monospace">
          0
        </text>
        <text x="265" y="80" textAnchor="middle" fontSize="40" fontWeight="800" fill="#f87171" fontFamily="ui-monospace, monospace">
          0
        </text>
      </Jumbotron>
      {/* The arena floor around the platform, dark, with the boards along the far side. */}
      <rect x="-20" y="300" width={W + 40} height={H - 300 + 20} fill="#0d111c" />
      <CourtBoards
        id={id}
        y={300}
        h={24}
        x0={-20}
        x1={W + 20}
        boards={[
          { text: "ALGEBRIDGE", bg: "#1e3a8a", fg: "#facc15" },
          { text: "FREE ALGEBRA 1", bg: "#0f172a", fg: "#ffffff" },
          { text: "WRESTLE ON", bg: "#b91c1c", fg: "#ffffff" },
          { text: "ALGEBRIDGE", bg: "#facc15", fg: "#1e3a8a" },
          { text: "STAY ON THE MAT", bg: "#1d4ed8", fg: "#ffffff" },
          { text: "UNIT BY UNIT", bg: "#0f172a", fg: "#93c5fd" },
        ]}
      />
      {/* The officials' table at the far side of the platform: a lit front, a clock, two officials. */}
      {/* Seated: drawn first, so the table's front hides their legs. */}
      <Person x={522} y={372} h={52} shirt="#f8fafc" skin="#e0ac86" hair="#6b4426" />
      <Person x={678} y={372} h={52} shirt="#1f2937" skin="#6f432a" />
      <rect x="478" y="346" width="244" height="38" rx="3" fill="#0b0f19" />
      <rect x="478" y="346" width="244" height="4" rx="2" fill="#374151" />
      <rect x="482" y="356" width="236" height="24" fill="#1e3a8a" />
      <rect x="482" y="356" width="236" height="8" fill="#ffffff" opacity="0.07" />
      <Fit x={600} y={373} w={150} size={13} fill="#facc15">
        ALGEBRIDGE
      </Fit>
      <rect x="586" y="330" width="28" height="16" rx="2" fill="#111827" />
      <text x="600" y="342" textAnchor="middle" fontSize="10" fontWeight="800" fill="#f87171" fontFamily="ui-monospace, monospace">
        2:00
      </text>
      {/* Team corners at the far ends of the platform: chairs, headgear, water, a towel. */}
      {[0, 1].map((side) => {
        const x = side ? 1100 : 10;
        const team = side ? "#b91c1c" : "#1d4ed8";
        return (
          <g key={side}>
            <ellipse cx={x + 46} cy="430" rx="54" ry="8" fill="#000000" opacity="0.4" />
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x={x + i * 30} y="396" width="24" height="16" rx="3" fill={team} />
                <rect x={x + i * 30} y="412" width="24" height="6" rx="2" fill="#111827" />
                <rect x={x + i * 30 + 2} y="418" width="3" height="10" fill="#374151" />
                <rect x={x + i * 30 + 19} y="418" width="3" height="10" fill="#374151" />
              </g>
            ))}
            <ellipse cx={x + 76} cy="392" rx="9" ry="6" fill={team} />
            <rect x={x + 10} y="384" width="7" height="12" rx="3" fill="#f8fafc" />
            <rect x={x + 40} y="384" width="7" height="12" rx="3" fill="#f8fafc" />
          </g>
        );
      })}
      {/* The platform, the mat on it, and the light falling on the mat. */}
      <path d={deck} fill="#1f2937" />
      <path d={`M108 390 L1092 390 L1088 394 L112 394Z`} fill="#4b5563" />
      <path d={mat} fill="url(#wr-mat)" />
      <path
        d={Array.from({ length: 5 }, (_, i) => {
          const x = 130 + (i + 1) * 157;
          return `M${x} ${matFar} L${toward(x, matFar, H + 60)} ${H + 60}`;
        }).join(" ")}
        stroke="#0f1d4a"
        strokeWidth="2"
        opacity="0.6"
      />
      <ellipse cx="600" cy="592" rx="480" ry="188" fill="#c81e1e" />
      <ellipse cx="600" cy="592" rx="462" ry="178" fill="#2348c8" />
      <ellipse cx="600" cy="600" rx="420" ry="150" fill="#1b3aa8" opacity="0.45" />
      <ellipse cx="600" cy="592" rx="78" ry="28" fill="none" stroke="#ffffff" strokeWidth="5" opacity="0.92" />
      <rect x="570" y="588" width="24" height="6" rx="2" fill="#22c55e" />
      <rect x="606" y="588" width="24" height="6" rx="2" fill="#ef4444" />
      <g opacity="0.2">
        <Fit x={600} y={770} w={260} size={30} fill="#ffffff">
          ALGEBRIDGE
        </Fit>
      </g>
      {/* The spotlights from above: soft cones and a bright pool on the mat. */}
      <path d="M380 -10 L460 -10 L760 420 L220 420Z" fill="url(#wr-beam)" />
      <path d="M740 -10 L820 -10 L980 420 L440 420Z" fill="url(#wr-beam)" />
      <rect x="-20" y="380" width={W + 40} height={H - 380 + 20} fill="url(#wr-spot)" />
      {/* The referee, at the edge of the circle. */}
      <Person x={1010} y={486} h={64} shirt="#f8fafc" skin="#f1c7a5" hair="#4a2c17" stripes />
      <Vignette id={id} />
    </Svg>
  );
}

/* ── Jo: a cheer competition ────────────────────────────────────── */

/**
 * A cheer competition: a blue spring floor under arena lights, the judges'
 * table at the back with a video board over it, stands either side, an
 * announcer and the trophies, and a banner over the lot. Jo throws her
 * passes for the judges, not a crowd on a sideline.
 */
export function CheerScene() {
  const id = "ch";
  // The spring floor: its far edge where the old mat began, its sides toward the vanishing point.
  const far = 478;
  const floor = `M130 ${far} L1070 ${far} L${toward(1070, far, H + 60)} ${H + 60} L${toward(130, far, H + 60)} ${H + 60}Z`;
  const tape = `M118 ${far - 8} L1082 ${far - 8} L${toward(1082, far - 8, H + 60)} ${H + 60} L${toward(118, far - 8, H + 60)} ${H + 60}Z`;
  // Panel seams across, closer together far away.
  const across = [520, 572, 634, 708, 796].map((y) => `M${toward(130, far, y)} ${y} L${toward(1070, far, y)} ${y}`);
  const along = Array.from({ length: 8 }, (_, i) => {
    const x = 130 + ((i + 1) * 940) / 9;
    return `M${x} ${far} L${toward(x, far, H + 60)} ${H + 60}`;
  });
  return (
    <Svg label="Cheer competition arena">
      <defs>
        <ArenaDefs id={id} glow="#f472b6" />
        <CrowdTiles id={id} shirts={["#1d4ed8", "#facc15", "#f8fafc", "#dc2626", "#7c3aed", "#f97316", "#ec4899", "#0ea5e9"]} seat="#1f2547" />
        <linearGradient id="ch-carpet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <radialGradient id="ch-pool" cx="50%" cy="62%" r="55%">
          <stop offset="0%" stopColor="#eff6ff" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#eff6ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ch-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdf4ff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#fdf4ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#06060f" />
      <FarStand id={id} front={58} top={-14} rows={6} s0={0.3} s1={0.24} aisles={[220, 980]} tunnels={[]} />
      <Ribbon
        id={id}
        y={58}
        segments={[
          { text: "CHEER CHAMPIONSHIP", bg: "#1d4ed8", fg: "#ffffff" },
          { text: "ALGEBRIDGE", bg: "#111827", fg: "#facc15" },
          { text: "GO ALLSTARS", bg: "#db2777", fg: "#ffffff" },
          { text: "CHEER CHAMPIONSHIP", bg: "#1d4ed8", fg: "#ffffff" },
          { text: "ALGEBRA 1", bg: "#111827", fg: "#f9a8d4" },
        ]}
      />
      <FarStand id={id} front={300} top={76} rows={15} s0={0.6} s1={0.38} />
      <SideStands id={id} front={326} edge={60} colors={["#1d4ed8", "#facc15", "#ec4899", "#f8fafc"]} />
      <LightRig id={id} y={12} xs={[100, 270, 930, 1100]} />
      <Jumbotron id={id} ring="#db2777">
        <text x="178" y="30" textAnchor="middle" fontSize="13" fontWeight="800" fill="#f9a8d4" fontFamily={FONT} letterSpacing="3">
          NOW ON THE FLOOR
        </text>
        <Fit x={178} y={70} w={290} size={34} fill="#ffffff">
          ALGEBRIDGE ALLSTARS
        </Fit>
        <rect x="128" y="80" width="100" height="3" rx="1.5" fill="#facc15" />
      </Jumbotron>
      {/* The competition floor, dark, with the boards along the far side. */}
      <rect x="-20" y="300" width={W + 40} height={H - 300 + 20} fill="#0b0d18" />
      <CourtBoards
        id={id}
        y={300}
        h={24}
        x0={-20}
        x1={W + 20}
        boards={[
          { text: "ALGEBRIDGE", bg: "#1d4ed8", fg: "#facc15" },
          { text: "CHEER CHAMPIONSHIP", bg: "#0f172a", fg: "#ffffff" },
          { text: "STICK IT", bg: "#db2777", fg: "#ffffff" },
          { text: "ALGEBRIDGE", bg: "#facc15", fg: "#1d4ed8" },
          { text: "GO ALLSTARS", bg: "#7c3aed", fg: "#ffffff" },
          { text: "FREE ALGEBRA 1", bg: "#0f172a", fg: "#f9a8d4" },
        ]}
      />
      {/* The announcer's table with speakers, the judges, the trophies. */}
      {[200, 400].map((x) => (
        <g key={x}>
          <rect x={x - 16} y="380" width="32" height="68" rx="3" fill="#05070c" />
          <circle cx={x} cy="402" r="9" fill="#1f2937" />
          <circle cx={x} cy="402" r="4" fill="#111827" />
          <circle cx={x} cy="430" r="7" fill="#1f2937" />
        </g>
      ))}
      <rect x="230" y="392" width="150" height="56" rx="5" fill="#0b0f19" />
      <rect x="230" y="392" width="150" height="5" fill="#374151" />
      <rect x="254" y="372" width="40" height="24" rx="3" fill="#374151" />
      <rect x="258" y="376" width="32" height="16" fill="#93c5fd" />
      <Person x={330} y={392} h={46} shirt="#0f766e" skin="#e0ac86" hair="#111111" />
      {[500, 600, 700].map((x, i) => (
        <g key={x}>
          <Person x={x} y={382} h={54} shirt={["#7c3aed", "#0f766e", "#b91c1c"][i]} skin={["#f1c7a5", "#6f432a", "#e0ac86"][i]} hair={["#4a2c17", "#111111", "#c9a24a"][i]} />
          <rect x={x - 14} y="368" width="28" height="14" rx="2" fill="#f8fafc" />
          <rect x={x - 12} y="370" width="24" height="10" fill="#bfdbfe" opacity="0.6" />
        </g>
      ))}
      <rect x="440" y="378" width="320" height="70" rx="6" fill="#0b0f19" />
      <rect x="446" y="392" width="308" height="50" rx="4" fill="#1e40af" />
      <rect x="446" y="392" width="308" height="14" rx="4" fill="#ffffff" opacity="0.07" />
      <Fit x={600} y={426} w={110} size={20} fill="#ffffff">
        JUDGES
      </Fit>
      <rect x="820" y="400" width="160" height="48" rx="5" fill="#f8fafc" />
      <rect x="820" y="400" width="160" height="6" fill="#cbd5e1" />
      <rect x="820" y="430" width="160" height="18" rx="3" fill="#e2e8f0" />
      {[850, 900, 950].map((x, i) => (
        <g key={x}>
          <rect x={x - 10} y={392 - i * 4} width="20" height="8" fill="#a16207" />
          <path d={`M${x - 8} ${392 - i * 4} L${x + 8} ${392 - i * 4} L${x + 10} ${368 - i * 8} Q${x} ${358 - i * 8} ${x - 10} ${368 - i * 8}Z`} fill="#facc15" />
          <path d={`M${x - 2} ${392 - i * 4} L${x + 2} ${392 - i * 4} L${x + 5} ${370 - i * 8} Q${x + 2} ${364 - i * 8} ${x - 1} ${366 - i * 8}Z`} fill="#fef9c3" opacity="0.7" />
          <path d={`M${x - 12} ${376 - i * 8} q-8 -4 -2 -10 M${x + 12} ${376 - i * 8} q8 -4 2 -10`} stroke="#facc15" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* Gym bags and water along the front of the floor. */}
      {[60, 110, 1090, 1140].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy="486" rx="26" ry="5" fill="#000000" opacity="0.4" />
          <rect x={x - 22} y="462" width="44" height="22" rx="7" fill={i % 2 ? "#1d4ed8" : "#dc2626"} />
          <rect x={x - 10} y="456" width="20" height="8" rx="4" fill="#0f172a" />
        </g>
      ))}
      {/* The spring floor: white tape around blue carpet panels, the light pooled on it. */}
      <path d={tape} fill="#f8fafc" />
      <path d={floor} fill="url(#ch-carpet)" />
      <path d={[...across, ...along].join(" ")} stroke="#1e3a8a" strokeWidth="2.4" opacity="0.7" />
      <path d={[...across, ...along].join(" ")} stroke="#60a5fa" strokeWidth="0.8" opacity="0.5" transform="translate(0 -1.2)" />
      <path d={floor} fill="url(#ch-pool)" />
      <ellipse cx="600" cy="624" rx="80" ry="30" fill="none" stroke="#facc15" strokeWidth="5" opacity="0.9" />
      <text x="600" y="636" textAnchor="middle" fontSize="34" fontWeight="800" fill="#facc15" fontFamily={FONT} opacity="0.9">
        A
      </text>
      <g opacity="0.28">
        <Fit x={600} y={760} w={460} size={24} fill="#ffffff">
          ALGEBRIDGE ALLSTARS
        </Fit>
      </g>
      {/* Spotlights from the rigs, sweeping slowly across the floor. */}
      {[180, 420, 780, 1020].map((x, i) => (
        <g key={x} className="sc-sweep" style={{ transformOrigin: `${x}px 10px`, animationDelay: `${i * -2.3}s` }}>
          <path d={`M${x - 10} 10 L${x + 10} 10 L${x + 200} 560 L${x - 120} 560Z`} fill="url(#ch-beam)" />
        </g>
      ))}
      <Vignette id={id} />
    </Svg>
  );
}

/* ── Jordyn: an indoor volleyball court ──────────────────────────── */

/** The near and far edges of the court, for the lines. */
const COURT = { farY: 350, nearY: 792, farL: 330, farR: 870, nearL: 80, nearR: 1120 };
function courtX(y: number, side: "l" | "r") {
  const t = (y - COURT.farY) / (COURT.nearY - COURT.farY);
  return side === "l" ? COURT.farL + (COURT.nearL - COURT.farL) * t : COURT.farR + (COURT.nearR - COURT.farR) * t;
}

export function VolleyballScene() {
  const id = "vb";
  const line = (y: number) => <rect key={y} x={courtX(y, "l")} y={y - 2} width={courtX(y, "r") - courtX(y, "l")} height="4" fill="#ffffff" />;
  const courtPath = `M${COURT.farL} ${COURT.farY} L${COURT.farR} ${COURT.farY} L${COURT.nearR} ${COURT.nearY} L${COURT.nearL} ${COURT.nearY}Z`;
  // The painted free zone: the court's lines pushed out, the way an arena floor is laid.
  const zone = { farY: 318, farL: toward(COURT.farL - 150, COURT.farY, 318), farR: toward(COURT.farR + 150, COURT.farY, 318) };
  return (
    <Svg label="Volleyball arena">
      <defs>
        <ArenaDefs id={id} glow="#a78bfa" />
        <CrowdTiles id={id} shirts={["#7c3aed", "#7c3aed", "#7c3aed", "#facc15", "#f8fafc", "#5b21b6", "#0d9488", "#1f2937", "#ef4444"]} seat="#3b1f6e" />
        <linearGradient id="vb-paint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id="vb-zone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b5bdb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#070a14" />
      {/* The upper bowl in the dark, the ribbon board, then the lower bowl down to the floor. */}
      <FarStand id={id} front={52} top={-14} rows={6} s0={0.3} s1={0.24} aisles={[220, 980]} tunnels={[]} />
      <Ribbon
        id={id}
        y={52}
        segments={[
          { text: "ALGEBRIDGE", bg: "#4c1d95", fg: "#facc15" },
          { text: "SET 3", bg: "#111827", fg: "#ffffff" },
          { text: "GO BRIDGES", bg: "#7c3aed", fg: "#ffffff" },
          { text: "ALGEBRA 1", bg: "#111827", fg: "#a78bfa" },
          { text: "ALGEBRIDGE", bg: "#4c1d95", fg: "#facc15" },
          { text: "DIG DEEP", bg: "#7c3aed", fg: "#ffffff" },
        ]}
      />
      <FarStand id={id} front={288} top={70} rows={15} s0={0.62} s1={0.4} />
      <SideStands id={id} front={318} edge={150} colors={["#7c3aed", "#facc15", "#f8fafc", "#5b21b6"]} />
      <LightRig id={id} y={12} xs={[90, 260, 940, 1110]} />
      <Jumbotron id={id} ring="#7c3aed">
        <text x="178" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill="#c4b5fd" fontFamily={FONT} letterSpacing="2">
          SET 3 · MATCH POINT
        </text>
        <rect x="16" y="24" width="150" height="62" rx="4" fill="#0b1220" />
        <rect x="190" y="24" width="150" height="62" rx="4" fill="#0b1220" />
        <text x="91" y="40" textAnchor="middle" fontSize="10" fontWeight="800" fill="#a78bfa" fontFamily={FONT} letterSpacing="2">
          BRIDGES
        </text>
        <text x="265" y="40" textAnchor="middle" fontSize="10" fontWeight="800" fill="#5eead4" fontFamily={FONT} letterSpacing="2">
          GUEST
        </text>
        <text x="91" y="80" textAnchor="middle" fontSize="40" fontWeight="800" fill="#f97316" fontFamily="ui-monospace, monospace">
          24
        </text>
        <text x="265" y="80" textAnchor="middle" fontSize="40" fontWeight="800" fill="#22c55e" fontFamily="ui-monospace, monospace">
          23
        </text>
      </Jumbotron>
      {/* The floor: maple, the painted free zone, the court. */}
      <WoodFloor id={id} top={314} />
      <path d={`M${zone.farL} ${zone.farY} L${zone.farR} ${zone.farY} L${toward(zone.farR, zone.farY, H + 40)} ${H + 40} L${toward(zone.farL, zone.farY, H + 40)} ${H + 40}Z`} fill="url(#vb-zone)" opacity="0.93" />
      <path d={courtPath} fill="url(#vb-paint)" />
      {/* The grain still shows through the paint. */}
      <path
        d={Array.from({ length: 46 }, (_, i) => {
          const x = 80 + i * 23;
          return `M${x} ${COURT.nearY} L${toward(x, COURT.nearY, COURT.farY)} ${COURT.farY}`;
        }).join(" ")}
        stroke="#7c2d12"
        strokeWidth="0.8"
        opacity="0.16"
      />
      <path d={courtPath} fill="none" stroke="#ffffff" strokeWidth="5" />
      {line(NET_Y)}
      {line(470)}
      {line(640)}
      {/* The center logo, painted on the near court. */}
      <g opacity="0.16">
        <Fit x={600} y={760} w={200} size={30} fill="#ffffff">
          ALGEBRIDGE
        </Fit>
      </g>
      {/* The courtside boards along the far end, lit, and their shine in the floor. */}
      <CourtBoards
        id={id}
        y={288}
        h={26}
        x0={-20}
        x1={W + 20}
        boards={[
          { text: "ALGEBRIDGE", bg: "#4c1d95", fg: "#facc15" },
          { text: "FREE ALGEBRA 1", bg: "#0f172a", fg: "#ffffff" },
          { text: "SPIKE IT", bg: "#7c3aed", fg: "#ffffff" },
          { text: "ALGEBRIDGE", bg: "#facc15", fg: "#4c1d95" },
          { text: "GO BRIDGES", bg: "#7c3aed", fg: "#ffffff" },
          { text: "UNIT BY UNIT", bg: "#0f172a", fg: "#a78bfa" },
        ]}
      />
      {/* Light from the rigs, caught in the gloss. */}
      {[260, 600, 940].map((x) => (
        <FloorShine key={x} x={x} y={392} w={230} h={34} opacity={0.12} />
      ))}
      {/* Team benches in the free zone: padded seats, the subs, water bottles. */}
      {[0, 1].map((side) => {
        const x = side ? 1062 : 16;
        const shirt = side ? "#0d9488" : "#7c3aed";
        return (
          <g key={side}>
            <ellipse cx={x + 62} cy="642" rx="72" ry="10" fill="#020617" opacity="0.35" />
            <rect x={x} y="612" width="124" height="12" rx="4" fill="#1f2937" />
            <rect x={x} y="612" width="124" height="4" rx="2" fill="#4b5563" />
            <rect x={x + 6} y="624" width="5" height="16" fill="#111827" />
            <rect x={x + 113} y="624" width="5" height="16" fill="#111827" />
            {[0, 1, 2].map((i) => (
              <Person key={i} x={x + 24 + i * 38} y={612} h={52} shirt={shirt} skin={SKINS[(i + side * 2) % SKINS.length]} hair={HAIRS[(i + side) % HAIRS.length]} />
            ))}
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x={x + 14 + i * 34} y="640" width="7" height="15" rx="3" fill="#f8fafc" />
                <rect x={x + 14 + i * 34} y="640" width="7" height="4" rx="2" fill={shirt} />
              </g>
            ))}
          </g>
        );
      })}
      {/* The ball cart. */}
      <ellipse cx="1118" cy="578" rx="54" ry="9" fill="#020617" opacity="0.35" />
      <rect x="1070" y="520" width="96" height="46" rx="4" fill="#374151" />
      <rect x="1074" y="512" width="88" height="12" rx="3" fill="#4b5563" />
      {[1086, 1108, 1130, 1152].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={i % 2 ? 522 : 524} r="9" fill={i % 2 ? "#f8fafc" : "#facc15"} />
          <path d={`M${x - 8} ${i % 2 ? 520 : 522} Q${x} ${i % 2 ? 526 : 528} ${x + 8} ${i % 2 ? 520 : 522}`} stroke="#1d4ed8" strokeWidth="1.6" fill="none" />
        </g>
      ))}
      <rect x="1078" y="566" width="6" height="10" fill="#111827" />
      <rect x="1152" y="566" width="6" height="10" fill="#111827" />
      {/* The net: posts with their pads, antennae, mesh, tapes, and the referee on the stand. */}
      {[196, 1004].map((x) => (
        <g key={x}>
          <ellipse cx={x + 2} cy={NET_Y + 6} rx="22" ry="5" fill="#020617" opacity="0.35" />
          <rect x={x - 6} y="392" width="12" height={NET_Y - 392 + 6} fill="#e5e7eb" />
          <rect x={x + 2} y="392" width="4" height={NET_Y - 392 + 6} fill="#9ca3af" />
          <rect x={x - 9} y="470" width="18" height={NET_Y - 470} rx="3" fill="#7c3aed" />
          <rect x={x - 9} y="470" width="5" height={NET_Y - 470} rx="2" fill="#a78bfa" opacity="0.6" />
        </g>
      ))}
      <rect x="1018" y="360" width="36" height="8" rx="2" fill="#9ca3af" />
      <rect x="1022" y="368" width="4" height="180" fill="#4b5563" />
      <rect x="1046" y="368" width="4" height="180" fill="#4b5563" />
      {[400, 440, 480, 520].map((y) => (
        <rect key={y} x="1022" y={y} width="28" height="3" fill="#9ca3af" />
      ))}
      <Person x={1036} y={362} h={70} shirt="#f8fafc" skin="#b07a55" hair="#1c1210" stripes />
      <rect x="202" y="404" width="796" height="66" fill="#0f172a" opacity="0.5" />
      {Array.from({ length: 57 }, (_, i) => (
        <rect key={i} x={204 + i * 14} y="404" width="1.2" height="66" fill="#ffffff" opacity="0.3" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x="202" y={410 + i * 11} width="796" height="1.2" fill="#ffffff" opacity="0.3" />
      ))}
      <rect x="202" y="398" width="796" height="9" fill="#ffffff" />
      <rect x="202" y="468" width="796" height="4" fill="#ffffff" opacity="0.85" />
      {[214, 986].map((x) => (
        <g key={x}>
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={x - 2} y={350 + i * 10} width="4" height="10" fill={i % 2 ? "#ffffff" : "#ef4444"} />
          ))}
        </g>
      ))}
      {/* The net's shadow on the court. */}
      <path d={`M${courtX(NET_Y + 4, "l")} ${NET_Y + 4} L${courtX(NET_Y + 4, "r")} ${NET_Y + 4} L${courtX(NET_Y + 22, "r")} ${NET_Y + 22} L${courtX(NET_Y + 22, "l")} ${NET_Y + 22}Z`} fill="#000000" opacity="0.08" />
      <Vignette id={id} />
    </Svg>
  );
}

/* ── Rayla: a soccer pitch and a goal ────────────────────────────── */

export function SoccerScene({ netHit = false }: { netHit?: boolean }) {
  const id = "sc";
  const pitchTop = 190;
  // Mowing stripes across the pitch, wider toward the viewer.
  const bands: { y: number; h: number }[] = [];
  let y = pitchTop;
  for (let i = 0; y < H; i += 1) {
    const h = 30 + i * 9;
    bands.push({ y, h });
    y += h;
  }
  // And stripes along it, toward the vanishing point: together, the checker a groundskeeper cuts.
  const lanes = Array.from({ length: 14 }, (_, i) => -900 + i * 220);
  return (
    <Svg label="Soccer stadium at night">
      <defs>
        <ArenaDefs id={id} glow="#4ade80" />
        <CrowdTiles id={id} shirts={["#16a34a", "#16a34a", "#f8fafc", "#facc15", "#15803d", "#1f2937", "#f8fafc", "#dc2626"]} seat="#14301f" />
        <linearGradient id="sc-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#020617" />
          <stop offset="100%" stopColor="#0b1635" />
        </linearGradient>
        <radialGradient id="sc-pool" cx="50%" cy="55%" r="65%">
          <stop offset="0%" stopColor="#f7fee7" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f7fee7" stopOpacity="0" />
        </radialGradient>
        <pattern id="sc-grass" patternUnits="userSpaceOnUse" width="18" height="12">
          <path d="M2 10 L3 6 M7 11 L7.6 7 M12 10 L11.2 6.4 M15.5 11 L16.4 7.2 M4.6 4 L5 1 M10 5 L10.8 1.6 M14 4.4 L13.6 1" stroke="#14532d" strokeWidth="0.9" opacity="0.35" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#sc-night)" />
      {/* The roof's edge and the floodlights along it. */}
      <rect x="-20" y="16" width={W + 40} height="22" fill="#0a0d16" />
      <rect x="-20" y="36" width={W + 40} height="3" fill="#374151" />
      {Array.from({ length: 11 }, (_, i) => (
        <Glare key={i} id={id} x={60 + i * 108} y={30} r={52} core={3.8} />
      ))}
      {/* Two tiers behind the goal, the ribbon between them. */}
      <FarStand id={id} front={94} top={40} rows={6} s0={0.34} s1={0.27} aisles={[300, 900]} tunnels={[]} wall="#0d1424" />
      <Ribbon
        id={id}
        y={94}
        h={14}
        segments={[
          { text: "CITY UNITED", bg: "#15803d", fg: "#ffffff" },
          { text: "ALGEBRIDGE", bg: "#111827", fg: "#facc15" },
          { text: "GO CITY", bg: "#f8fafc", fg: "#15803d" },
          { text: "CITY UNITED", bg: "#15803d", fg: "#ffffff" },
          { text: "ALGEBRA 1", bg: "#111827", fg: "#86efac" },
          { text: "GO CITY", bg: "#f8fafc", fg: "#15803d" },
        ]}
      />
      <FarStand id={id} front={168} top={108} rows={8} s0={0.48} s1={0.38} aisles={[200, 500, 700, 1000]} tunnels={[360, 840]} wall="#0d1424" />
      {/* The big screen in the corner of the stand. */}
      <rect x="44" y="44" width="236" height="74" rx="4" fill="#05070c" />
      <rect x="50" y="50" width="224" height="62" fill={`url(#${id}-screen)`} />
      <Fit x={162} y={66} w={150} size={11} fill="#86efac">
        CITY UNITED · GUEST
      </Fit>
      <text x="162" y="100" textAnchor="middle" fontSize="28" fontWeight="800" fill="#ffffff" fontFamily="ui-monospace, monospace">
        0 – 0
      </text>
      <text x="250" y="104" textAnchor="middle" fontSize="9" fontWeight="800" fill="#facc15" fontFamily="ui-monospace, monospace">
        45:00
      </text>
      {/* The LED boards at the end of the pitch. */}
      <CourtBoards
        id={id}
        y={168}
        h={22}
        x0={-20}
        x1={W + 20}
        reflect={false}
        boards={[
          { text: "ALGEBRIDGE", bg: "#15803d", fg: "#ffffff" },
          { text: "GO CITY", bg: "#0f172a", fg: "#86efac" },
          { text: "FREE ALGEBRA 1", bg: "#facc15", fg: "#14532d" },
          { text: "ALGEBRIDGE", bg: "#15803d", fg: "#ffffff" },
          { text: "TOP CORNER", bg: "#0f172a", fg: "#ffffff" },
          { text: "CITY UNITED", bg: "#f8fafc", fg: "#15803d" },
        ]}
      />
      <rect x="-20" y="190" width={W + 40} height="10" fill={`url(#${id}-boardglow)`} opacity="0.5" />
      {/* The pitch: stripes across and along, the grass itself, the floodlit pool. */}
      {bands.map((b, i) => (
        <rect key={i} x="-20" y={b.y} width={W + 40} height={b.h} fill={i % 2 ? "#2f8f3c" : "#287f34"} />
      ))}
      {lanes.map((x, i) =>
        i % 2 ? null : (
          <path key={x} d={`M${toward(x, H, pitchTop)} ${pitchTop} L${toward(x + 220, H, pitchTop)} ${pitchTop} L${x + 220} ${H} L${x} ${H}Z`} fill="#ffffff" opacity="0.045" />
        )
      )}
      <rect x="-20" y={pitchTop} width={W + 40} height={H - pitchTop + 20} fill="url(#sc-grass)" />
      <rect x="-20" y={pitchTop} width={W + 40} height={H - pitchTop + 20} fill="url(#sc-pool)" />
      {/* Lines: the end line, the penalty box, the goal box, the spot, the arc. */}
      <rect x="40" y={GOAL.line - 2} width="1120" height="4" fill="#f8fafc" />
      <path d={`M320 ${GOAL.line} L880 ${GOAL.line} L935 410 L265 410Z`} fill="none" stroke="#f8fafc" strokeWidth="4" />
      <path d={`M430 ${GOAL.line} L770 ${GOAL.line} L786 332 L414 332Z`} fill="none" stroke="#f8fafc" strokeWidth="4" />
      <ellipse cx="600" cy="372" rx="6" ry="3" fill="#f8fafc" />
      <path d="M520 410 Q600 452 680 410" fill="none" stroke="#f8fafc" strokeWidth="4" />
      <ellipse cx="600" cy="870" rx="240" ry="80" fill="none" stroke="#f8fafc" strokeWidth="5" />
      {[40, 1160].map((x, i) => (
        <g key={x}>
          <rect x={x - 2} y={GOAL.line - 46} width="4" height="46" fill="#e5e7eb" />
          <g className="sc-sway" style={{ transformOrigin: `${x + 2}px ${GOAL.line - 46}px`, animationDelay: `${i * -1.6}s` }}>
            <path d={`M${x + 2} ${GOAL.line - 46} l18 7 l-18 7Z`} fill="#facc15" />
          </g>
        </g>
      ))}
      {/* Photographers behind the end line, either side of the goal. */}
      {[300, 380, 820, 900].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy="284" rx="18" ry="4" fill="#000000" opacity="0.35" />
          <Person x={x} y={282} h={40} shirt={i % 2 ? "#1f2937" : "#f97316"} skin={SKINS[(i * 2 + 1) % SKINS.length]} hair={HAIRS[i % HAIRS.length]} />
          <rect x={x - 3} y="250" width="16" height="7" rx="1.5" fill="#111827" />
          <rect x={x + 11} y="251.5" width="10" height="4" rx="1" fill="#374151" />
        </g>
      ))}
      {/* Dugouts on both sides: glass shelters, padded seats, the substitutes, a ball bag and cones. */}
      {[0, 1].map((side) => {
        const x = side ? 1010 : 30;
        const shirt = side ? "#facc15" : "#22c55e";
        return (
          <g key={side}>
            <ellipse cx={x + 80} cy="388" rx="92" ry="9" fill="#000000" opacity="0.35" />
            <path d={`M${x - 4} 318 Q${x + 80} 296 ${x + 164} 318 L${x + 164} 324 L${x - 4} 324Z`} fill="#111827" />
            <rect x={x + 2} y="322" width="156" height="48" fill="#bae6fd" opacity="0.22" />
            <rect x={x + 2} y="322" width="156" height="12" fill="#ffffff" opacity="0.12" />
            <rect x={x} y="322" width="5" height="62" fill="#1f2937" />
            <rect x={x + 155} y="322" width="5" height="62" fill="#1f2937" />
            <rect x={x + 8} y="360" width="144" height="12" rx="4" fill={side ? "#a16207" : "#166534"} />
            {[0, 1, 2].map((i) => (
              <Person key={i} x={x + 36 + i * 44} y={366} h={50} shirt={shirt} skin={SKINS[(i + side * 3) % SKINS.length]} hair={HAIRS[(i + 2 + side) % HAIRS.length]} />
            ))}
            {[0, 1, 2].map((i) => (
              <rect key={i} x={x + 20 + i * 44} y="376" width="6" height="12" rx="2" fill="#f8fafc" />
            ))}
          </g>
        );
      })}
      <ellipse cx="220" cy="392" rx="26" ry="12" fill="#111827" />
      {[204, 220, 236].map((x, i) => (
        <circle key={x} cx={x} cy={386 - (i % 2) * 4} r="7" fill="#f8fafc" />
      ))}
      {[960, 980, 1000].map((x) => (
        <path key={x} d={`M${x} 396 l6 -18 l6 18Z`} fill="#f97316" />
      ))}
      {/* The goal: the net behind, then the frame, posts lit from the left. */}
      <g className={netHit ? "net-hit" : ""} style={{ transformOrigin: `600px ${GOAL.line}px`, transformBox: "view-box" }}>
        <rect x={GOAL.x0 + 6} y={GOAL.top + 8} width={GOAL.x1 - GOAL.x0 - 12} height={GOAL.line - GOAL.top - 8} fill="#e2e8f0" opacity="0.2" />
        {Array.from({ length: 19 }, (_, i) => (
          <rect key={i} x={GOAL.x0 + 8 + i * 13.5} y={GOAL.top + 8} width="1.2" height={GOAL.line - GOAL.top - 8} fill="#f8fafc" opacity="0.6" />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={GOAL.x0 + 6} y={GOAL.top + 18 + i * 13} width={GOAL.x1 - GOAL.x0 - 12} height="1.2" fill="#f8fafc" opacity="0.6" />
        ))}
      </g>
      <ellipse cx="600" cy={GOAL.line + 6} rx="150" ry="8" fill="#000000" opacity="0.25" />
      <rect x={GOAL.x0} y={GOAL.top} width="9" height={GOAL.line - GOAL.top + 2} fill="#ffffff" />
      <rect x={GOAL.x0 + 6} y={GOAL.top} width="3" height={GOAL.line - GOAL.top + 2} fill="#cbd5e1" />
      <rect x={GOAL.x1 - 9} y={GOAL.top} width="9" height={GOAL.line - GOAL.top + 2} fill="#ffffff" />
      <rect x={GOAL.x1 - 3} y={GOAL.top} width="3" height={GOAL.line - GOAL.top + 2} fill="#cbd5e1" />
      <rect x={GOAL.x0} y={GOAL.top} width={GOAL.x1 - GOAL.x0} height="9" fill="#ffffff" />
      <rect x={GOAL.x0} y={GOAL.top + 6} width={GOAL.x1 - GOAL.x0} height="3" fill="#cbd5e1" />
      <Vignette id={id} />
    </Svg>
  );
}

/** A court. `live` says a game is being played on it; motion also waits until it is on screen. */
export function CourtScene({ game, netHit, live = true }: { game: CourtGameId; netHit?: boolean; live?: boolean }) {
  return (
    <SceneMotion live={live}>
      {game === "wrestling" ? (
        <WrestlingScene />
      ) : game === "cheer" ? (
        <CheerScene />
      ) : game === "volleyball" ? (
        <VolleyballScene />
      ) : (
        <SoccerScene netHit={netHit} />
      )}
    </SceneMotion>
  );
}

/* ── Veronica: an outdoor rink in winter ─────────────────────────── */

/** The bulbs strung over the rink: where each hangs, from the sag of the line. */
const BULBS = [50, 130, 210, 290, 370, 450, 530, 610, 690, 770, 850, 930, 1010, 1090, 1170].map((x, i) => {
  const t = x / 1200;
  const y = 140 + 90 * Math.sin(Math.PI * (t < 0.5 ? t * 2 : (t - 0.5) * 2)) * (t < 0.5 ? 1 : 0.55) + 20;
  return { x, y: Math.round(y * 10) / 10, color: ["#fbbf24", "#fb7185", "#38bdf8", "#4ade80", "#c084fc", "#fb923c"][i % 6] };
});

/** Snow, in three sheets that fall at their own speeds; each is drawn twice so the loop is seamless. */
function Snow({ seed, fall, r }: { seed: number; fall: string; r: number }) {
  const flakes = Array.from({ length: 24 }, (_, i) => ({ x: (i * 173 + seed * 61) % 1200, y: (i * 97 + seed * 37) % 440 }));
  return (
    <g className="sc-snow" style={{ ["--fall" as string]: fall }}>
      {[0, -440].map((dy) =>
        flakes.map((f, i) => <circle key={`${dy}-${i}`} cx={f.x} cy={f.y + dy} r={r} fill="#ffffff" opacity="0.85" />)
      )}
    </g>
  );
}

/**
 * The rink she skates on, out on its own in the snow: boards with a red
 * rail, mountains and evergreens behind (the end trees strung with lights),
 * stands either side, a skate booth, a warming hut with smoke from its
 * chimney, a Zamboni, lamp posts, a cocoa stand and a fire to warm up at,
 * a snowman, bulbs twinkling over it all and snow coming down. The ice is
 * the same ellipse the game has always used (`RINK` in lib/rink.ts), so her
 * skating and the seven decoration spots around the boards are unchanged.
 */
export function RinkScene({ live = true }: { live?: boolean }) {
  return (
    <SceneMotion live={live}>
      <RinkPicture />
    </SceneMotion>
  );
}

function RinkPicture() {
  const R = RINK;
  const trees = [40, 130, 215, 300, 380, 470, 560, 650, 740, 830, 920, 1010, 1100, 1180];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="rink-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#eff6ff" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height="440" fill="url(#rink-sky)" />
      {/* The sun, upper left, where the figures are lit from. */}
      <circle cx="250" cy="120" r="120" fill="#ffffff" opacity="0.4" />
      <circle cx="250" cy="120" r="52" fill="#fff7e0" />
      {/* Mountains, then snowy hills. */}
      <path d="M0 300 L120 180 L220 250 L340 150 L460 260 L560 200 L660 290 L780 170 L900 260 L1010 190 L1120 280 L1200 230 L1200 340 L0 340Z" fill="#cbd5e1" />
      <path d="M340 150 L380 190 L300 200Z M780 170 L820 208 L740 214Z M1010 190 L1040 222 L980 226Z M120 180 L150 214 L96 218Z" fill="#f8fafc" />
      <path d="M0 330 Q200 250 420 300 Q600 340 800 280 Q1000 230 1200 300 L1200 460 L0 460Z" fill="#e2e8f0" />
      <path d="M0 360 Q260 300 520 340 Q760 370 1000 320 Q1120 300 1200 330 L1200 460 L0 460Z" fill="#f1f5f9" />
      {/* Birds, far off. */}
      {[[860, 120], [900, 108], [940, 124]].map(([x, y]) => (
        <path key={x} d={`M${x - 8} ${y} q8 -6 16 0`} fill="none" stroke="#64748b" strokeWidth="1.5" />
      ))}
      {/* Evergreens in a row, snow on their tips, lights on the two at the ends. */}
      {trees.map((x, i) => {
        const h = 120 + ((i * 37) % 60);
        const base = 430;
        const lit = i === 0 || i === trees.length - 1;
        return (
          <g key={x}>
            <rect x={x - 6} y={base - 18} width="12" height="22" fill="#5b3a21" />
            <path d={`M${x} ${base - h} L${x + 42} ${base - 10} L${x - 42} ${base - 10}Z`} fill="#1f5a3a" />
            <path d={`M${x} ${base - h + 26} L${x + 32} ${base - 42} L${x - 32} ${base - 42}Z`} fill="#2f7a4d" />
            <path d={`M${x} ${base - h} L${x + 10} ${base - h + 22} L${x - 10} ${base - h + 22}Z`} fill="#f8fafc" opacity="0.9" />
            <path d={`M${x - 14} ${base - h + 46} q14 -6 28 0 l-4 6 q-10 -4 -20 0Z`} fill="#f8fafc" opacity="0.8" />
            {lit &&
              [[-6, 40], [8, 54], [-16, 70], [14, 84], [-24, 98], [4, 108], [22, 116], [-10, 122]].map(([dx, dy], j) => (
                <circle key={j} cx={x + dx} cy={base - h + dy} r="4" fill={["#fbbf24", "#fb7185", "#38bdf8", "#4ade80"][j % 4]} className="sc-twinkle" style={{ animationDelay: `${(j % 2) * -0.95}s` }} />
              ))}
          </g>
        );
      })}
      {/* Snow on the ground. */}
      <rect x="0" y="420" width={W} height={H - 420} fill="#f1f5f9" />
      <rect x="0" y="420" width={W} height="60" fill="#dbe7f3" opacity="0.6" />
      {/* Stands either side, with a crowd in coats and a rail. */}
      {[
        [60, 380],
        [820, 1140],
      ].map(([x0, x1]) => (
        <g key={x0}>
          <rect x={x0} y="352" width={x1 - x0} height="96" fill="#8b5a2b" />
          <rect x={x0} y="352" width={x1 - x0} height="10" fill="#a9703a" />
          <rect x={x0} y="392" width={x1 - x0} height="10" fill="#a9703a" />
          <rect x={x0 - 4} y="346" width={x1 - x0 + 8} height="4" fill="#64748b" />
          <rect x={x0 - 6} y="440" width={x1 - x0 + 12} height="12" fill="#f8fafc" />
          <Crowd x0={x0 + 14} x1={x1 - 8} y0={360} rows={2} gap={40} size={12} colors={["#1d4ed8", "#dc2626", "#0f766e", "#f8fafc", "#7c3aed", "#f97316"]} />
        </g>
      ))}
      {/* The skate booth, the warming hut with its chimney going, the Zamboni: one tidy row. */}
      <rect x="404" y="368" width="104" height="80" fill="#1e40af" />
      <rect x="404" y="368" width="52" height="80" fill="#2563eb" />
      <path d="M396 370 L456 340 L516 370Z" fill="#f8fafc" />
      <rect x="418" y="392" width="76" height="30" fill="#0b1220" />
      <rect x="418" y="392" width="76" height="4" fill="#facc15" />
      <Fit x={456} y={414} w={56} size={13} fill="#facc15">
        SKATES
      </Fit>
      {[428, 448, 468, 488].map((x, i) => (
        <g key={x}>
          <rect x={x - 6} y="430" width="12" height="9" rx="2" fill={i % 2 ? "#f8fafc" : "#1f2937"} />
          <rect x={x - 7} y="438" width="14" height="2" fill="#94a3b8" />
        </g>
      ))}
      <rect x="520" y="322" width="160" height="112" fill="#7c4a2a" />
      <rect x="520" y="322" width="80" height="112" fill="#8f5a35" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="520" y={330 + i * 20} width="160" height="2" fill="#5b3a21" opacity="0.6" />
      ))}
      <path d="M506 326 L600 268 L694 326Z" fill="#334155" />
      <path d="M512 320 L600 266 L688 320 L680 320 L600 276 L520 320Z" fill="#f8fafc" />
      <rect x="640" y="272" width="14" height="30" fill="#475569" />
      <rect x="638" y="268" width="18" height="6" fill="#64748b" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx="647" cy="262" r={5 + i} fill="#e2e8f0" className="sc-smoke" style={{ animationDelay: `${i * -1.3}s` }} />
      ))}
      <rect x="546" y="356" width="40" height="34" rx="2" fill="#fde68a" />
      <rect x="564" y="356" width="4" height="34" fill="#5b3a21" />
      <rect x="546" y="371" width="40" height="4" fill="#5b3a21" />
      <rect x="614" y="366" width="42" height="68" fill="#3f2a1a" />
      <circle cx="648" cy="402" r="3" fill="#facc15" />
      <rect x="536" y="292" width="128" height="26" rx="4" fill="#1e3a8a" />
      <Fit x={600} y={311} w={112} size={15} fill="#facc15">
        ALGEBRIDGE RINK
      </Fit>
      <rect x="700" y="392" width="100" height="44" rx="6" fill="#1d4ed8" />
      <rect x="700" y="380" width="44" height="20" rx="4" fill="#1e40af" />
      <rect x="708" y="384" width="28" height="12" fill="#bae6fd" />
      <rect x="760" y="400" width="34" height="22" rx="3" fill="#facc15" />
      <circle cx="722" cy="378" r="4" fill="#f97316" className="sc-blink" />
      {[716, 782].map((x) => (
        <circle key={x} cx={x} cy="438" r="9" fill="#1f2937" />
      ))}
      <rect x="700" y="428" width="100" height="6" fill="#0f172a" opacity="0.3" />
      {/* Lamp posts either side, lit. */}
      {[36, 1164].map((x) => (
        <g key={x}>
          <rect x={x - 3} y="500" width="6" height="200" fill="#334155" />
          <rect x={x - 14} y="488" width="28" height="18" rx="4" fill="#475569" />
          <rect x={x - 10} y="504" width="20" height="5" rx="2" fill="#fef3c7" />
          <circle cx={x} cy="512" r="30" fill="#fde68a" opacity="0.16" />
        </g>
      ))}
      {/* A cocoa stand at the front left, a cup steaming on the counter. */}
      <rect x="70" y="704" width="120" height="66" fill="#9a3412" />
      <rect x="70" y="704" width="60" height="66" fill="#b45309" />
      <rect x="66" y="698" width="128" height="10" rx="3" fill="#f8fafc" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${64 + i * 22} 684 L${86 + i * 22} 684 L${86 + i * 22} 698 L${64 + i * 22} 698Z`} fill={i % 2 ? "#f8fafc" : "#dc2626"} />
      ))}
      <rect x="82" y="716" width="96" height="22" rx="3" fill="#1f2937" />
      <Fit x={130} y={732} w={76} size={12} fill="#fde68a">
        HOT COCOA
      </Fit>
      <rect x="108" y="746" width="14" height="14" rx="2" fill="#f8fafc" />
      <rect x="140" y="746" width="14" height="14" rx="2" fill="#f8fafc" />
      {[0, 1].map((i) => (
        <circle key={i} cx={115 + i * 32} cy="742" r="3" fill="#e2e8f0" className="sc-smoke" style={{ animationDelay: `${i * -1.7}s` }} />
      ))}
      {/* A fire to warm up at, at the front right, two people with their hands out. */}
      <ellipse cx="1080" cy="764" rx="34" ry="12" fill="#94a3b8" />
      <ellipse cx="1080" cy="760" rx="26" ry="8" fill="#475569" />
      <rect x="1064" y="750" width="32" height="6" rx="2" fill="#5b3a21" transform="rotate(-18 1080 753)" />
      <rect x="1064" y="750" width="32" height="6" rx="2" fill="#7c4a2a" transform="rotate(20 1080 753)" />
      <g className="sc-flame">
        <path d="M1066 754 Q1070 728 1080 722 Q1090 728 1094 754Z" fill="#f97316" />
        <path d="M1072 754 Q1076 736 1080 732 Q1084 736 1088 754Z" fill="#fde047" />
      </g>
      <circle cx="1080" cy="746" r="34" fill="#fb923c" opacity="0.14" />
      <Person x={1032} y={768} h={56} shirt="#1d4ed8" skin="#e0ac86" hair="#6b4426" />
      <Person x={1128} y={768} h={56} shirt="#dc2626" skin="#6f432a" hair="#111111" />
      {/* A snowman by the boards, footprints to the hut. */}
      <circle cx="52" cy="640" r="20" fill="#ffffff" />
      <circle cx="52" cy="608" r="15" fill="#ffffff" />
      <circle cx="52" cy="582" r="11" fill="#ffffff" />
      <rect x="44" y="565" width="16" height="10" fill="#1f2937" />
      <rect x="40" y="573" width="24" height="3" fill="#1f2937" />
      <path d="M52 582 l10 2 l-10 2Z" fill="#f97316" />
      {[[49, 579], [56, 579], [52, 603], [52, 612]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#1f2937" />
      ))}
      <path d="M40 594 q-14 -8 -22 -18 M64 594 q14 -8 22 -18" stroke="#5b3a21" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="38" y="596" width="28" height="5" rx="2" fill="#dc2626" />
      {[[590, 468], [604, 480], [592, 492], [606, 504]].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4" ry="2.4" fill="#cbd5e1" />
      ))}
      {/* A string of bulbs over everything, each twinkling on its own. */}
      <path d="M0 140 Q300 250 600 190 T1200 140" fill="none" stroke="#475569" strokeWidth="3" />
      {BULBS.map((b, i) => (
        <g key={b.x}>
          <rect x={b.x - 2} y={b.y - 14} width="4" height="8" fill="#475569" />
          <g className="sc-twinkle" style={{ animationDelay: `${(i % 2) * -0.95}s` }}>
            <circle cx={b.x} cy={b.y} r="7" fill={b.color} />
            <circle cx={b.x} cy={b.y} r="12" fill={b.color} opacity="0.25" />
          </g>
        </g>
      ))}
      {/* Snowbanks pushed up against the boards. */}
      <ellipse cx={R.cx} cy={R.cy + 8} rx={R.rx + 62} ry={R.ry + 52} fill="#ffffff" />
      <ellipse cx={R.cx} cy={R.cy + 16} rx={R.rx + 62} ry={R.ry + 48} fill="#e2e8f0" opacity="0.7" />
      <ellipse cx={R.cx} cy={R.cy + 8} rx={R.rx + 62} ry={R.ry + 52} fill="#ffffff" opacity="0.6" />
      {/* The rink: boards with a red rail, then the ice, then its lines. */}
      <ellipse cx={R.cx} cy={R.cy + 10} rx={R.rx + BOARD} ry={R.ry + BOARD} fill="#1f2937" opacity="0.14" />
      <ellipse cx={R.cx} cy={R.cy + 4} rx={R.rx + BOARD} ry={R.ry + BOARD} fill="#cbd5e1" />
      <ellipse cx={R.cx} cy={R.cy} rx={R.rx + BOARD} ry={R.ry + BOARD} fill="#f1f5f9" />
      <ellipse cx={R.cx} cy={R.cy - 3} rx={R.rx + BOARD} ry={R.ry + BOARD} fill="#dc2626" />
      <ellipse cx={R.cx} cy={R.cy - 3} rx={R.rx + 4} ry={R.ry + 4} fill="#f1f5f9" />
      <ellipse cx={R.cx} cy={R.cy} rx={R.rx} ry={R.ry} fill="#dbe7f3" />
      <ellipse cx={R.cx} cy={R.cy - 2} rx={R.rx - 4} ry={R.ry - 4} fill="#f4f8fc" />
      {/* The bulbs' colours, caught in the ice. */}
      {BULBS.filter((b) => b.x > 260 && b.x < 940).map((b, i) => (
        <ellipse key={b.x} cx={b.x} cy={R.cy - R.ry + 34} rx="40" ry="9" fill={b.color} opacity="0.09" className="sc-twinkle" style={{ animationDelay: `${((i + 1) % 2) * -0.95}s` }} />
      ))}
      <ellipse cx={R.cx} cy={R.cy} rx={R.rx * 0.36} ry={R.ry * 0.36} fill="none" stroke="#3b82f6" strokeWidth="4" opacity="0.8" />
      <circle cx={R.cx} cy={R.cy} r="5" fill="#3b82f6" opacity="0.8" />
      <rect x={R.cx - 2} y={R.cy - R.ry + 8} width="4" height={R.ry * 2 - 16} fill="#dc2626" opacity="0.55" />
      <rect x={R.cx - R.rx * 0.55 - 2} y={R.cy - R.ry * 0.83} width="4" height={R.ry * 1.66} fill="#3b82f6" opacity="0.5" />
      <rect x={R.cx + R.rx * 0.55 - 2} y={R.cy - R.ry * 0.83} width="4" height={R.ry * 1.66} fill="#3b82f6" opacity="0.5" />
      <path
        d={`M${R.cx - R.rx * 0.9} ${R.cy - 10} Q${R.cx} ${R.cy - R.ry * 0.9} ${R.cx + R.rx * 0.9} ${R.cy - 10} Q${R.cx} ${R.cy - R.ry * 0.55} ${R.cx - R.rx * 0.9} ${R.cy - 10}Z`}
        fill="#ffffff"
        opacity="0.55"
      />
      <path d={`M${R.cx - 260} ${R.cy + 40} q60 -30 130 -6`} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d={`M${R.cx + 40} ${R.cy + 70} q80 -40 170 -20`} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      {/* Snow coming down. */}
      <Snow seed={1} fall="18s" r={2.2} />
      <Snow seed={2} fall="26s" r={1.6} />
      <Snow seed={3} fall="36s" r={1.2} />
    </svg>
  );
}
