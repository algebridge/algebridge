"use client";

import { useEffect, useRef, useState } from "react";
import { GOAL, NET_Y, type CourtGameId } from "@/lib/games";
import { RINK } from "@/lib/rink";
import { ArenaDefs, CourtBoards, CrowdTiles, FarStand, FloorShine, Glare, Jumbotron, LightRig, Ribbon, SideStands, Vignette, WoodFloor, toward } from "./Arena";
import { GOAL_MOUTH, goalLineX, lineX, persp, PITCH, BOX_DEPTH, KICKOFF, NET, netTop, VCOURT } from "@/lib/match-rules";

/** A match's names and score, for the arena's own boards. `now` is who is on the floor (cheer). */
export interface MatchBoard {
  names: [string, string];
  score: [number, number];
  now?: string;
}

const short = (name: string) => name.toUpperCase().slice(0, 10);

/**
 * The four courts and the rink, as arenas seen from a broadcast camera high
 * in the stands, on the same 1200 × 800 plane as the House. The shared pieces
 * (the bowl, boards, video board, lights, floors) are in ./Arena.tsx. The play
 * areas in src/lib/games.ts and the rink in src/lib/rink.ts sit on these
 * surfaces, so everything drawn here stays clear of where the players run.
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

const SKINS = ["#f1c7a5", "#b07a55", "#6f432a", "#8d5a3b", "#e0ac86", "#4b2d1c"];
const HAIRS = ["#1c1210", "#4a2c17", "#c9a24a", "#2b1b12", "#6b4426", "#111111"];

/** Rounds to hundredths, so a computed coordinate prints the same on the server and in the browser. */
const r2 = (v: number) => Math.round(v * 100) / 100;

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

export function WrestlingScene({ board }: { board?: MatchBoard } = {}) {
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
        <text x="91" y="40" textAnchor="middle" fontSize="10" fontWeight="800" fill={board ? "#93c5fd" : "#4ade80"} fontFamily={FONT} letterSpacing="2">
          {board ? short(board.names[0]) : "BRIDGES"}
        </text>
        <text x="265" y="40" textAnchor="middle" fontSize="10" fontWeight="800" fill={board ? "#fdba74" : "#f87171"} fontFamily={FONT} letterSpacing="2">
          {board ? short(board.names[1]) : "GUEST"}
        </text>
        <text x="91" y="80" textAnchor="middle" fontSize="40" fontWeight="800" fill={board ? "#60a5fa" : "#4ade80"} fontFamily="ui-monospace, monospace">
          {board ? board.score[0] : 0}
        </text>
        <text x="265" y="80" textAnchor="middle" fontSize="40" fontWeight="800" fill={board ? "#fb923c" : "#f87171"} fontFamily="ui-monospace, monospace">
          {board ? board.score[1] : 0}
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
export function CheerScene({ board }: { board?: MatchBoard }) {
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
        <Fit x={178} y={70} w={board?.now ? Math.min(290, 40 + board.now.length * 22) : 290} size={34} fill="#ffffff">
          {board?.now ? short(board.now) : "ALGEBRIDGE ALLSTARS"}
        </Fit>
        {board && (
          <text x="178" y="94" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fbcfe8" fontFamily={FONT} letterSpacing="2">
            {`${short(board.names[0])} ${board.score[0]} · ${board.score[1]} ${short(board.names[1])}`}
          </text>
        )}
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

export function VolleyballScene({ board }: { board?: MatchBoard }) {
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
          {board ? "RALLY POINT · LIVE" : "SET 3 · MATCH POINT"}
        </text>
        <rect x="16" y="24" width="150" height="62" rx="4" fill="#0b1220" />
        <rect x="190" y="24" width="150" height="62" rx="4" fill="#0b1220" />
        <text x="91" y="40" textAnchor="middle" fontSize="10" fontWeight="800" fill={board ? "#93c5fd" : "#a78bfa"} fontFamily={FONT} letterSpacing="2">
          {board ? short(board.names[0]) : "BRIDGES"}
        </text>
        <text x="265" y="40" textAnchor="middle" fontSize="10" fontWeight="800" fill={board ? "#fdba74" : "#5eead4"} fontFamily={FONT} letterSpacing="2">
          {board ? short(board.names[1]) : "GUEST"}
        </text>
        <text x="91" y="80" textAnchor="middle" fontSize="40" fontWeight="800" fill={board ? "#60a5fa" : "#f97316"} fontFamily="ui-monospace, monospace">
          {board ? board.score[0] : 24}
        </text>
        <text x="265" y="80" textAnchor="middle" fontSize="40" fontWeight="800" fill={board ? "#fb923c" : "#22c55e"} fontFamily="ui-monospace, monospace">
          {board ? board.score[1] : 23}
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
      {/* The net: posts with their pads, antennae, mesh, tapes, and the referee on the stand. In a match it is drawn on its own layer over the far player (VolleyNet). */}
      {!board && <VolleyNetParts />}
      {/* The net's shadow on the court. */}
      <path d={`M${courtX(NET_Y + 4, "l")} ${NET_Y + 4} L${courtX(NET_Y + 4, "r")} ${NET_Y + 4} L${courtX(NET_Y + 22, "r")} ${NET_Y + 22} L${courtX(NET_Y + 22, "l")} ${NET_Y + 22}Z`} fill="#000000" opacity="0.08" />
      <Vignette id={id} />
    </Svg>
  );
}

/** The volleyball net and its posts, the referee's stand: in a match, a layer of its own between the far player and the near one. */
function VolleyNetParts() {
  return (
    <>
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
    </>
  );
}

/** The net on its own, over the far side of the court, for a match across it. */
export function VolleyNet({ zIndex }: { zIndex: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <VolleyNetParts />
      </svg>
    </div>
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
/**
 * A court. With `board`, it is a two-player match: the boards show the two
 * names and the score, and soccer is seen from the touchline with a goal at
 * each end (`goalHit` shakes the net a shot went into).
 */
export function CourtScene({ game, netHit, live = true, board, goalHit = null }: { game: CourtGameId; netHit?: boolean; live?: boolean; board?: MatchBoard; goalHit?: "left" | "right" | null }) {
  return (
    <SceneMotion live={live}>
      {game === "wrestling" ? (
        <WrestlingScene board={board} />
      ) : game === "cheer" ? (
        <CheerScene board={board} />
      ) : game === "volleyball" ? (
        board ? <VolleyMatchScene board={board} /> : <VolleyballScene board={board} />
      ) : board ? (
        <SoccerMatchScene board={board} goalHit={goalHit} />
      ) : (
        <SoccerScene netHit={netHit} />
      )}
    </SceneMotion>
  );
}

/**
 * Soccer for two, from the touchline, as a match is shown on television: the
 * far stand across the pitch, a goal at each end on goal lines that run into
 * the picture, the halfway line and the centre circle, the boxes. The
 * geometry is lib/match-rules.ts (PITCH, GOAL_MOUTH, BOX_DEPTH), the same the
 * players and the ball move on.
 */
function SoccerMatchScene({ board, goalHit }: { board: MatchBoard; goalHit: "left" | "right" | null }) {
  const id = "scm";
  const P = PITCH;
  const pitchTop = 196;
  const bands: { y: number; h: number }[] = [];
  let y = pitchTop;
  for (let i = 0; y < H; i += 1) {
    const h = 26 + i * 8;
    bands.push({ y, h });
    y += h;
  }
  // Stripes mown across the pitch, along the lines that run into the picture.
  const lanes = Array.from({ length: 16 }, (_, i) => -1000 + i * 200);
  const L = (xFront: number, yy: number) => r2(lineX(xFront, yy));
  const line = (pts: [number, number][]) => pts.map(([px, py], i) => `${i ? "L" : "M"}${r2(px)} ${r2(py)}`).join(" ");
  const box = (end: "left" | "right", y0: number, y1: number, depth: number) => {
    const dir = end === "left" ? 1 : -1;
    return line([
      [goalLineX(end, y0), y0],
      [goalLineX(end, y0) + dir * depth * persp(y0), y0],
      [goalLineX(end, y1) + dir * depth * persp(y1), y1],
      [goalLineX(end, y1), y1],
    ]);
  };
  /** A goal on a goal line: the net behind it, then the frame, posts lit from the left. */
  const goal = (end: "left" | "right") => {
    const out = end === "left" ? -1 : 1;
    const g0 = { x: goalLineX(end, GOAL_MOUTH.y0), y: GOAL_MOUTH.y0 };
    const g1 = { x: goalLineX(end, GOAL_MOUTH.y1), y: GOAL_MOUTH.y1 };
    const h0 = 236 * persp(g0.y);
    const h1 = 236 * persp(g1.y);
    const d0 = 70 * persp(g0.y);
    const d1 = 70 * persp(g1.y);
    const b0 = { x: g0.x + out * d0, y: g0.y - 6 };
    const b1 = { x: g1.x + out * d1, y: g1.y - 6 };
    const mesh: string[] = [];
    for (let i = 1; i < 9; i += 1) {
      const t = i / 9;
      // Down the back of the net, and across it.
      mesh.push(line([[b0.x + (b1.x - b0.x) * t, b0.y + (b1.y - b0.y) * t - (h0 + (h1 - h0) * t) * 0.78], [b0.x + (b1.x - b0.x) * t, b0.y + (b1.y - b0.y) * t]]));
    }
    for (let i = 1; i < 6; i += 1) {
      const t = i / 6;
      mesh.push(line([[b0.x, b0.y - h0 * 0.78 * t], [b1.x, b1.y - h1 * 0.78 * t]]));
    }
    const top0 = { x: g0.x, y: g0.y - h0 };
    const top1 = { x: g1.x, y: g1.y - h1 };
    const backTop0 = { x: b0.x, y: b0.y - h0 * 0.78 };
    const backTop1 = { x: b1.x, y: b1.y - h1 * 0.78 };
    return (
      <g key={end}>
        <ellipse cx={(g0.x + g1.x) / 2 + out * 20} cy={(g0.y + g1.y) / 2 + 4} rx={56} ry={58} fill="#000000" opacity="0.22" />
        <g className={goalHit === end ? "net-hit" : ""} style={{ transformOrigin: `${r2((g0.x + g1.x) / 2)}px ${r2((g0.y + g1.y) / 2)}px`, transformBox: "view-box" }}>
          {/* The net: its back and its roof, white mesh. */}
          <path d={line([[top0.x, top0.y], [top1.x, top1.y], [backTop1.x, backTop1.y], [backTop0.x, backTop0.y]]) + "Z"} fill="#e2e8f0" opacity="0.16" />
          <path d={line([[backTop0.x, backTop0.y], [backTop1.x, backTop1.y], [b1.x, b1.y], [b0.x, b0.y]]) + "Z"} fill="#e2e8f0" opacity="0.2" />
          <path d={mesh.join(" ")} stroke="#f8fafc" strokeWidth="1.1" opacity="0.55" fill="none" />
          <path d={line([[top0.x, top0.y], [backTop0.x, backTop0.y], [b0.x, b0.y]]) + " " + line([[top1.x, top1.y], [backTop1.x, backTop1.y], [b1.x, b1.y]])} stroke="#e5e7eb" strokeWidth="2" fill="none" opacity="0.8" />
        </g>
        {/* The frame. */}
        <path d={line([[g0.x, g0.y], [top0.x, top0.y], [top1.x, top1.y], [g1.x, g1.y]])} stroke="#ffffff" strokeWidth="8" fill="none" strokeLinejoin="round" />
        <path d={line([[g0.x + 2, g0.y], [top0.x + 2, top0.y + 3]])} stroke="#cbd5e1" strokeWidth="2.5" fill="none" />
      </g>
    );
  };
  const corners: [number, number][] = [
    [L(P.l, P.y0), P.y0],
    [L(P.r, P.y0), P.y0],
  ];
  return (
    <Svg label="Soccer stadium at night, seen from the touchline">
      <defs>
        <ArenaDefs id={id} glow="#4ade80" />
        <CrowdTiles id={id} shirts={["#2563eb", "#2563eb", "#f8fafc", "#ea580c", "#ea580c", "#1f2937", "#f8fafc", "#facc15"]} seat="#14301f" />
        <linearGradient id="scm-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#020617" />
          <stop offset="100%" stopColor="#0b1635" />
        </linearGradient>
        <radialGradient id="scm-pool" cx="50%" cy="62%" r="62%">
          <stop offset="0%" stopColor="#f7fee7" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f7fee7" stopOpacity="0" />
        </radialGradient>
        <pattern id="scm-grass" patternUnits="userSpaceOnUse" width="18" height="12">
          <path d="M2 10 L3 6 M7 11 L7.6 7 M12 10 L11.2 6.4 M15.5 11 L16.4 7.2 M4.6 4 L5 1 M10 5 L10.8 1.6 M14 4.4 L13.6 1" stroke="#14532d" strokeWidth="0.9" opacity="0.35" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#scm-night)" />
      <rect x="-20" y="16" width={W + 40} height="22" fill="#0a0d16" />
      <rect x="-20" y="36" width={W + 40} height="3" fill="#374151" />
      {Array.from({ length: 11 }, (_, i) => (
        <Glare key={i} id={id} x={60 + i * 108} y={30} r={52} core={3.8} />
      ))}
      {/* The main stand across the pitch, two tiers. */}
      <FarStand id={id} front={94} top={40} rows={6} s0={0.34} s1={0.27} aisles={[300, 900]} tunnels={[]} wall="#0d1424" />
      <Ribbon
        id={id}
        y={94}
        h={14}
        segments={[
          { text: "ALGEBRIDGE", bg: "#111827", fg: "#facc15" },
          { text: short(board.names[0]), bg: "#1d4ed8", fg: "#ffffff" },
          { text: "VS", bg: "#111827", fg: "#ffffff" },
          { text: short(board.names[1]), bg: "#c2410c", fg: "#ffffff" },
          { text: "ALGEBRA 1", bg: "#111827", fg: "#86efac" },
          { text: "MATCH DAY", bg: "#f8fafc", fg: "#15803d" },
        ]}
      />
      <FarStand id={id} front={170} top={108} rows={8} s0={0.48} s1={0.38} aisles={[200, 500, 700, 1000]} tunnels={[360, 840]} wall="#0d1424" />
      {/* The score on the big screen. */}
      <rect x="482" y="44" width="236" height="62" rx="4" fill="#05070c" />
      <rect x="488" y="50" width="224" height="50" fill={`url(#${id}-screen)`} />
      <rect x="496" y="58" width="8" height="8" rx="2" fill="#3b82f6" />
      <Fit x={556} y={66} w={Math.min(96, 16 + board.names[0].length * 9)} size={11} fill="#bfdbfe">
        {short(board.names[0])}
      </Fit>
      <rect x="696" y="58" width="8" height="8" rx="2" fill="#f97316" />
      <Fit x={644} y={66} w={Math.min(96, 16 + board.names[1].length * 9)} size={11} fill="#fed7aa">
        {short(board.names[1])}
      </Fit>
      <text x="600" y="95" textAnchor="middle" fontSize="24" fontWeight="800" fill="#ffffff" fontFamily="ui-monospace, monospace">
        {`${board.score[0]} – ${board.score[1]}`}
      </text>
      <CourtBoards
        id={id}
        y={174}
        h={22}
        x0={-20}
        x1={W + 20}
        reflect={false}
        boards={[
          { text: "ALGEBRIDGE", bg: "#15803d", fg: "#ffffff" },
          { text: "FREE ALGEBRA 1", bg: "#facc15", fg: "#14532d" },
          { text: "MATCH DAY", bg: "#0f172a", fg: "#86efac" },
          { text: "ALGEBRIDGE", bg: "#15803d", fg: "#ffffff" },
          { text: "TOP CORNER", bg: "#0f172a", fg: "#ffffff" },
          { text: "GO BRIDGES", bg: "#f8fafc", fg: "#15803d" },
        ]}
      />
      {/* The pitch. */}
      {bands.map((b, i) => (
        <rect key={i} x="-20" y={b.y} width={W + 40} height={b.h} fill={i % 2 ? "#2f8f3c" : "#287f34"} />
      ))}
      {lanes.map((x, i) =>
        i % 2 ? null : <path key={x} d={`M${r2(toward(x, H, pitchTop))} ${pitchTop} L${r2(toward(x + 200, H, pitchTop))} ${pitchTop} L${x + 200} ${H} L${x} ${H}Z`} fill="#ffffff" opacity="0.045" />
      )}
      <rect x="-20" y={pitchTop} width={W + 40} height={H - pitchTop + 20} fill="url(#scm-grass)" />
      <rect x="-20" y={pitchTop} width={W + 40} height={H - pitchTop + 20} fill="url(#scm-pool)" />
      {/* Benches on the far side, either side of the halfway line. */}
      {[300, 900].map((bx, side) => (
        <g key={bx}>
          <ellipse cx={bx} cy="404" rx="96" ry="8" fill="#000000" opacity="0.3" />
          <path d={`M${bx - 90} 352 Q${bx} 334 ${bx + 90} 352 L${bx + 90} 358 L${bx - 90} 358Z`} fill="#111827" />
          <rect x={bx - 86} y="356" width="172" height="42" fill="#bae6fd" opacity="0.2" />
          <rect x={bx - 80} y="390" width="160" height="10" rx="3" fill={side ? "#9a3412" : "#1e3a8a"} />
          {[0, 1, 2].map((i) => (
            <Person key={i} x={bx - 50 + i * 50} y={396} h={46} shirt={side ? "#ea580c" : "#2563eb"} skin={SKINS[(i + side * 3) % SKINS.length]} hair={HAIRS[(i + 1 + side) % HAIRS.length]} />
          ))}
        </g>
      ))}
      {/* The lines: touchlines, goal lines, halfway line, centre circle and spot, the boxes. */}
      <g stroke="#f8fafc" strokeWidth="4" fill="none" strokeLinejoin="round">
        <path d={line([[L(P.l, P.y0), P.y0], [L(P.r, P.y0), P.y0], [L(P.r, P.y1), P.y1], [L(P.l, P.y1), P.y1]]) + "Z"} />
        <path d={line([[600, P.y0], [600, P.y1]])} />
        <ellipse cx="600" cy={KICKOFF.ball.y} rx={r2(122 * persp(KICKOFF.ball.y))} ry="46" />
        <path d={box("left", 500, 728, BOX_DEPTH)} />
        <path d={box("right", 500, 728, BOX_DEPTH)} />
        <path d={box("left", 576, 646, 74)} />
        <path d={box("right", 576, 646, 74)} />
      </g>
      <ellipse cx="600" cy={KICKOFF.ball.y} rx="6" ry="3" fill="#f8fafc" />
      {(["left", "right"] as const).map((end) => {
        const yy = 612;
        const x = goalLineX(end, yy) + (end === "left" ? 1 : -1) * 130 * persp(yy);
        return <ellipse key={end} cx={r2(x)} cy={yy} rx="5" ry="2.5" fill="#f8fafc" />;
      })}
      {/* Corner flags. */}
      {corners.map(([cx, cy], i) => (
        <g key={i}>
          <rect x={cx - 1.5} y={cy - 38} width="3" height="38" fill="#e5e7eb" />
          <g className="sc-sway" style={{ transformOrigin: `${cx + 1.5}px ${cy - 38}px`, animationDelay: `${i * -1.6}s` }}>
            <path d={`M${cx + 1.5} ${cy - 38} l15 6 l-15 6Z`} fill="#facc15" />
          </g>
        </g>
      ))}
      {goal("left")}
      {goal("right")}
      <Vignette id={id} />
    </Svg>
  );
}

/**
 * Volleyball for two, from the sideline: the net across the middle, one
 * player each side of it, the end lines running into the picture. The camera
 * sits a step off the net, so the net shows as a panel. Geometry from
 * lib/match-rules.ts (VCOURT, NET, HALF), the same the players move on.
 */
function VolleyMatchScene({ board }: { board: MatchBoard }) {
  const id = "vbm";
  const C = VCOURT;
  const L = (xFront: number, yy: number) => r2(lineX(xFront, yy));
  const line = (pts: [number, number][]) => pts.map(([px, py], i) => `${i ? "L" : "M"}${r2(px)} ${r2(py)}`).join(" ");
  const court = line([[L(C.l, C.y0), C.y0], [L(C.r, C.y0), C.y0], [L(C.r, C.y1), C.y1], [L(C.l, C.y1), C.y1]]) + "Z";
  const zone = line([[L(C.l - 150, 404), 404], [L(C.r + 150, 404), 404], [L(C.r + 150, H + 40), H + 40], [L(C.l - 150, H + 40), H + 40]]) + "Z";
  // The net: a post on each sideline, the mesh hung from the top tape.
  const far = { x: NET.far, y: C.y0 - 12 };
  const near = { x: NET.near, y: C.y1 + 14 };
  const farTop = { x: far.x, y: netTop(far.y) };
  const nearTop = { x: near.x, y: netTop(near.y) };
  const drop = (t: { x: number; y: number }, base: { y: number }) => ({ x: t.x, y: t.y + (base.y - t.y) * 0.42 });
  const farLow = drop(farTop, far);
  const nearLow = drop(nearTop, near);
  const mesh: string[] = [];
  for (let i = 1; i < 34; i += 1) {
    const t = i / 34;
    const a = { x: farTop.x + (nearTop.x - farTop.x) * t, y: farTop.y + (nearTop.y - farTop.y) * t };
    const b = { x: farLow.x + (nearLow.x - farLow.x) * t, y: farLow.y + (nearLow.y - farLow.y) * t };
    mesh.push(line([[a.x, a.y], [b.x, b.y]]));
  }
  for (let i = 1; i < 8; i += 1) {
    const t = i / 8;
    mesh.push(line([[farTop.x, farTop.y + (farLow.y - farTop.y) * t], [nearTop.x, nearTop.y + (nearLow.y - nearTop.y) * t]]));
  }
  const attack = (xFront: number) => line([[L(xFront, C.y0), C.y0], [L(xFront, C.y1), C.y1]]);
  return (
    <Svg label="Volleyball arena, seen from the sideline">
      <defs>
        <ArenaDefs id={id} glow="#a78bfa" />
        <CrowdTiles id={id} shirts={["#2563eb", "#2563eb", "#f8fafc", "#ea580c", "#ea580c", "#7c3aed", "#facc15", "#1f2937"]} seat="#3b1f6e" />
        <linearGradient id="vbm-paint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id="vbm-zone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b5bdb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#070a14" />
      <FarStand id={id} front={94} top={-10} rows={6} s0={0.34} s1={0.27} aisles={[300, 900]} tunnels={[]} />
      <Ribbon
        id={id}
        y={94}
        h={14}
        segments={[
          { text: "ALGEBRIDGE", bg: "#4c1d95", fg: "#facc15" },
          { text: short(board.names[0]), bg: "#1d4ed8", fg: "#ffffff" },
          { text: "VS", bg: "#111827", fg: "#ffffff" },
          { text: short(board.names[1]), bg: "#c2410c", fg: "#ffffff" },
          { text: "ALGEBRA 1", bg: "#111827", fg: "#a78bfa" },
          { text: "DIG DEEP", bg: "#7c3aed", fg: "#ffffff" },
        ]}
      />
      <FarStand id={id} front={300} top={108} rows={11} s0={0.5} s1={0.38} aisles={[200, 500, 700, 1000]} tunnels={[360, 840]} />
      <LightRig id={id} y={12} xs={[90, 300, 900, 1110]} />
      {/* The score on the big screen. */}
      <rect x="482" y="30" width="236" height="62" rx="4" fill="#05070c" />
      <rect x="488" y="36" width="224" height="50" fill={`url(#${id}-screen)`} />
      <rect x="496" y="44" width="8" height="8" rx="2" fill="#3b82f6" />
      <Fit x={556} y={52} w={Math.min(96, 16 + board.names[0].length * 9)} size={11} fill="#bfdbfe">
        {short(board.names[0])}
      </Fit>
      <rect x="696" y="44" width="8" height="8" rx="2" fill="#f97316" />
      <Fit x={644} y={52} w={Math.min(96, 16 + board.names[1].length * 9)} size={11} fill="#fed7aa">
        {short(board.names[1])}
      </Fit>
      <text x="600" y="81" textAnchor="middle" fontSize="24" fontWeight="800" fill="#ffffff" fontFamily="ui-monospace, monospace">
        {`${board.score[0]} – ${board.score[1]}`}
      </text>
      <CourtBoards
        id={id}
        y={300}
        h={24}
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
      <WoodFloor id={id} top={324} />
      <path d={zone} fill="url(#vbm-zone)" opacity="0.93" />
      {[300, 900].map((x) => (
        <FloorShine key={x} x={x} y={420} w={300} h={30} opacity={0.12} />
      ))}
      {/* Each player's bench on the far side of their own half. */}
      {[0, 1].map((side) => {
        const bx = side ? 900 : 300;
        const shirt = side ? "#ea580c" : "#2563eb";
        return (
          <g key={side}>
            <ellipse cx={bx} cy="440" rx="80" ry="7" fill="#020617" opacity="0.35" />
            <rect x={bx - 70} y="418" width="140" height="10" rx="4" fill="#1f2937" />
            <rect x={bx - 70} y="418" width="140" height="3" rx="1.5" fill="#4b5563" />
            {[0, 1, 2].map((i) => (
              <Person key={i} x={bx - 44 + i * 44} y={418} h={44} shirt={shirt} skin={SKINS[(i + side * 2) % SKINS.length]} hair={HAIRS[(i + side) % HAIRS.length]} />
            ))}
          </g>
        );
      })}
      {/* The court: paint, grain through it, lines, the attack lines either side of the net. */}
      <path d={court} fill="url(#vbm-paint)" />
      <path d={court} fill="none" stroke="#ffffff" strokeWidth="5" strokeLinejoin="round" />
      <g stroke="#ffffff" strokeWidth="4" fill="none">
        <path d={attack(460)} />
        <path d={attack(740)} />
        <path d={line([[far.x, C.y0], [near.x, C.y1]])} />
      </g>
      <g opacity="0.16">
        <Fit x={360} y={724} w={170} size={26} fill="#ffffff">
          ALGEBRIDGE
        </Fit>
        <Fit x={840} y={724} w={170} size={26} fill="#ffffff">
          ALGEBRIDGE
        </Fit>
      </g>
      {/* The referee's stand at the far post. */}
      <g>
        <rect x={far.x + 26} y={far.y - 96} width="5" height="96" fill="#94a3b8" />
        <rect x={far.x + 50} y={far.y - 96} width="5" height="96" fill="#94a3b8" />
        <rect x={far.x + 22} y={far.y - 100} width="38" height="6" rx="2" fill="#cbd5e1" />
        <Person x={far.x + 42} y={far.y - 100} h={42} shirt="#111827" stripes skin={SKINS[2]} hair={HAIRS[0]} />
      </g>
      {/* The net. */}
      <ellipse cx={near.x} cy={near.y + 2} rx="22" ry="5" fill="#000000" opacity="0.35" />
      <path d={line([[farTop.x, farTop.y], [nearTop.x, nearTop.y], [nearLow.x, nearLow.y], [farLow.x, farLow.y]]) + "Z"} fill="#0f172a" opacity="0.5" />
      <path d={mesh.join(" ")} stroke="#e2e8f0" strokeWidth="1.2" opacity="0.7" fill="none" />
      <path d={line([[farTop.x, farTop.y], [nearTop.x, nearTop.y]])} stroke="#ffffff" strokeWidth="5" fill="none" />
      <path d={line([[farLow.x, farLow.y], [nearLow.x, nearLow.y]])} stroke="#ffffff" strokeWidth="2.5" fill="none" opacity="0.85" />
      {/* Antennas over each sideline, red and white. */}
      {[farTop, nearTop].map((t, i) => (
        <g key={i}>
          <rect x={t.x - 1.5} y={t.y - 44 * (i ? 1 : 0.66)} width="3" height={44 * (i ? 1 : 0.66)} fill="#ffffff" />
          {[0, 1, 2].map((j) => (
            <rect key={j} x={t.x - 1.5} y={t.y - 44 * (i ? 1 : 0.66) + j * 14 * (i ? 1 : 0.66)} width="3" height={7 * (i ? 1 : 0.66)} fill="#dc2626" />
          ))}
        </g>
      ))}
      {[far, near].map((pt, i) => {
        const top = i ? nearTop : farTop;
        const w = i ? 12 : 8;
        return (
          <g key={i}>
            <rect x={pt.x - w / 2} y={top.y - 6} width={w} height={pt.y - top.y + 6} rx={w / 2} fill="#e5e7eb" />
            <rect x={pt.x - w / 2} y={top.y - 6} width={w * 0.35} height={pt.y - top.y + 6} fill="#94a3b8" opacity="0.6" />
            <rect x={pt.x - w} y={pt.y - (i ? 70 : 46)} width={w * 2} height={i ? 70 : 46} rx="3" fill="#4c1d95" />
          </g>
        );
      })}
      <Vignette id={id} />
    </Svg>
  );
}

/* ── Veronica: an outdoor rink in winter ─────────────────────────── */

/**
 * The rink she skates on, now an ice arena like the courts: a packed bowl,
 * the video board with her name, white boards with their ad panels and a
 * yellow kick plate, glass over the far side, a bright sheet of ice that
 * catches the lights, and a kiss and cry off to the side. The ice is the
 * same ellipse the game has always used (`RINK` in lib/rink.ts), so her
 * skating and the seven decoration spots around the boards are unchanged:
 * decorations stand on the arena floor around the rink.
 */
/** `skating` is who the video board names: Veronica, or the two players of a match. */
export function RinkScene({ live = true, skating = "VERONICA", judges = false }: { live?: boolean; skating?: string; judges?: boolean }) {
  return (
    <SceneMotion live={live}>
      <RinkPicture skating={skating} judges={judges} />
    </SceneMotion>
  );
}

function RinkPicture({ skating, judges }: { skating: string; judges: boolean }) {
  const id = "rk";
  const R = RINK;
  // The ice and the boards around it: the far boards' inner face shows above the ice,
  // the near boards' outer face below it, the glass over the far side.
  const boardTop = { cy: R.cy - 26, rx: R.rx + 6, ry: R.ry + 8 };
  const nearFace = { cy: R.cy + 24, rx: R.rx + 12, ry: R.ry + 12 };
  const glass = { cy: R.cy - 70, rx: R.rx + 10, ry: R.ry + 14 };
  // Ad panels around the near boards, left to right.
  const panels = [
    { x0: 150, x1: 330, bg: "#db2777", fg: "#ffffff", text: "ALGEBRIDGE" },
    { x0: 330, x1: 500, bg: "#f8fafc", fg: "#0f172a", text: "FREE ALGEBRA 1" },
    { x0: 500, x1: 700, bg: "#1d4ed8", fg: "#ffffff", text: "ALGEBRIDGE" },
    { x0: 700, x1: 870, bg: "#f8fafc", fg: "#db2777", text: "SKATE ON" },
    { x0: 870, x1: 1050, bg: "#db2777", fg: "#ffffff", text: "UNIT BY UNIT" },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <title>Ice arena</title>
      <defs>
        <ArenaDefs id={id} glow="#f472b6" />
        <CrowdTiles id={id} shirts={["#db2777", "#db2777", "#f8fafc", "#1d4ed8", "#7c3aed", "#facc15", "#0ea5e9", "#1f2937"]} seat="#2a1f3d" />
        <radialGradient id="rk-ice" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#eef6ff" />
          <stop offset="100%" stopColor="#cfe2f5" />
        </radialGradient>
        <linearGradient id="rk-streak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="rk-ice-clip">
          <ellipse cx={R.cx} cy={R.cy} rx={R.rx} ry={R.ry} />
        </clipPath>
        <clipPath id="rk-near-clip">
          <path d={`M${R.cx - nearFace.rx} ${nearFace.cy} A${nearFace.rx} ${nearFace.ry} 0 0 0 ${R.cx + nearFace.rx} ${nearFace.cy} L${R.cx + R.rx} ${R.cy} A${R.rx} ${R.ry} 0 0 1 ${R.cx - R.rx} ${R.cy}Z`} />
        </clipPath>
        <clipPath id="rk-glass-clip">
          <path d={`M${R.cx - glass.rx} ${glass.cy} A${glass.rx} ${glass.ry} 0 0 1 ${R.cx + glass.rx} ${glass.cy} L${R.cx + boardTop.rx} ${boardTop.cy} A${boardTop.rx} ${boardTop.ry} 0 0 0 ${R.cx - boardTop.rx} ${boardTop.cy}Z`} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#070910" />
      {/* The bowl: the upper deck, the ribbon, the lower stand, the corners. */}
      <FarStand id={id} front={56} top={-14} rows={6} s0={0.3} s1={0.24} aisles={[220, 980]} tunnels={[]} />
      <Ribbon
        id={id}
        y={56}
        segments={[
          { text: "FREE SKATE", bg: "#db2777", fg: "#ffffff" },
          { text: "ALGEBRIDGE", bg: "#111827", fg: "#f9a8d4" },
          { text: "ON THE ICE", bg: "#1d4ed8", fg: "#ffffff" },
          { text: "FREE SKATE", bg: "#db2777", fg: "#ffffff" },
          { text: "ALGEBRA 1", bg: "#111827", fg: "#93c5fd" },
          { text: "ALGEBRIDGE", bg: "#1d4ed8", fg: "#ffffff" },
        ]}
      />
      <FarStand id={id} front={350} top={74} rows={17} s0={0.62} s1={0.38} />
      <SideStands id={id} front={372} edge={40} colors={["#db2777", "#f8fafc", "#1d4ed8", "#facc15"]} />
      <LightRig id={id} y={12} xs={[100, 270, 930, 1100]} />
      <Jumbotron id={id} ring="#db2777">
        <text x="178" y="30" textAnchor="middle" fontSize="13" fontWeight="800" fill="#f9a8d4" fontFamily={FONT} letterSpacing="3">
          NOW SKATING
        </text>
        {/* Two names are longer than one: a smaller size keeps the letters readable once fitted. */}
        <Fit x={178} y={70} w={170} size={skating.length > 10 ? Math.max(18, Math.round(360 / skating.length)) : 36} fill="#ffffff">
          {skating}
        </Fit>
        <rect x="128" y="80" width="100" height="3" rx="1.5" fill="#f9a8d4" />
      </Jumbotron>
      {/* The boards along the front of the stand, and the arena floor around the rink. */}
      <CourtBoards
        id={id}
        y={350}
        h={22}
        x0={-20}
        x1={W + 20}
        reflect={false}
        boards={[
          { text: "ALGEBRIDGE", bg: "#db2777", fg: "#ffffff" },
          { text: "FREE SKATE", bg: "#0f172a", fg: "#f9a8d4" },
          { text: "ALGEBRA 1", bg: "#1d4ed8", fg: "#ffffff" },
          { text: "ALGEBRIDGE", bg: "#f8fafc", fg: "#db2777" },
          { text: "SKATE ON", bg: "#7c3aed", fg: "#ffffff" },
          { text: "UNIT BY UNIT", bg: "#0f172a", fg: "#93c5fd" },
        ]}
      />
      <rect x="-20" y="372" width={W + 40} height={H - 372 + 20} fill="#11151f" />
      <rect x="-20" y="372" width={W + 40} height="14" fill="#000000" opacity="0.35" />
      {/* Kiss and cry: where a skater waits for the marks, off to the side. */}
      <rect x="1010" y="392" width="150" height="44" rx="4" fill="#3b1d4a" />
      <Fit x={1085} y={410} w={110} size={12} fill="#f9a8d4">
        KISS &amp; CRY
      </Fit>
      <rect x="1018" y="418" width="134" height="12" rx="3" fill="#7c2d6f" />
      <rect x="1030" y="436" width="110" height="10" rx="3" fill="#db2777" />
      {[1040, 1130].map((x) => (
        <g key={x}>
          <circle cx={x} cy="430" r="7" fill="#f472b6" />
          <circle cx={x + 6} cy="426" r="5" fill="#fbcfe8" />
          <rect x={x - 1} y="436" width="2" height="8" fill="#15803d" />
        </g>
      ))}
      {/* A match is judged: three judges at a table across from the kiss and cry (RINK_JUDGES). */}
      {judges && (
        <g>
          {[70, 115, 160].map((x, i) => (
            <Person key={x} x={x} y={398} h={46} shirt={["#7c3aed", "#0f766e", "#b91c1c"][i]} skin={["#f1c7a5", "#6f432a", "#e0ac86"][i]} hair={["#4a2c17", "#111111", "#c9a24a"][i]} />
          ))}
          <rect x="40" y="394" width="150" height="50" rx="4" fill="#0b0f19" />
          <rect x="46" y="404" width="138" height="34" rx="3" fill="#1e40af" />
          <Fit x={115} y={426} w={100} size={14} fill="#ffffff">
            JUDGES
          </Fit>
        </g>
      )}
      {/* The glass over the far boards: panes, their posts, light caught on them. */}
      <g clipPath="url(#rk-glass-clip)">
        <rect x={R.cx - glass.rx} y={glass.cy - glass.ry} width={glass.rx * 2} height={glass.ry + 80} fill="#dbeafe" opacity="0.1" />
        {Array.from({ length: 17 }, (_, i) => {
          const x = R.cx - glass.rx + 12 + i * 50;
          return <rect key={i} x={x} y={glass.cy - glass.ry} width="2.2" height={glass.ry + 80} fill="#cbd5e1" opacity="0.35" />;
        })}
        {[260, 640, 940].map((x) => (
          <path key={x} d={`M${x} ${glass.cy - glass.ry} L${x + 26} ${glass.cy - glass.ry} L${x - 14} ${R.cy} L${x - 40} ${R.cy}Z`} fill="#ffffff" opacity="0.08" />
        ))}
      </g>
      {/* The boards: the near face first (the ice covers its top), then the far face, then the ice. */}
      <ellipse cx={R.cx} cy={nearFace.cy} rx={nearFace.rx} ry={nearFace.ry} fill="#f8fafc" />
      <g clipPath="url(#rk-near-clip)">
        {panels.map((pn) => (
          <g key={pn.x0}>
            <rect x={pn.x0 + 2} y={R.cy} width={pn.x1 - pn.x0 - 4} height={nearFace.ry + 40} fill={pn.bg} />
            <Fit x={(pn.x0 + pn.x1) / 2} y={R.cy + R.ry + 22} w={Math.min(130, pn.x1 - pn.x0 - 40)} size={12} fill={pn.fg}>
              {pn.text}
            </Fit>
          </g>
        ))}
        <ellipse cx={R.cx} cy={nearFace.cy + 2} rx={nearFace.rx} ry={nearFace.ry} fill="none" stroke="#facc15" strokeWidth="7" />
      </g>
      <ellipse cx={R.cx} cy={boardTop.cy} rx={boardTop.rx} ry={boardTop.ry} fill="#f1f5f9" />
      <ellipse cx={R.cx} cy={boardTop.cy} rx={boardTop.rx} ry={boardTop.ry} fill="none" stroke="#94a3b8" strokeWidth="2.4" />
      <ellipse cx={R.cx} cy={boardTop.cy + 6} rx={boardTop.rx - 2} ry={boardTop.ry - 2} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      {/* The ice: bright, the lights caught in it, the marks of earlier skating. */}
      <ellipse cx={R.cx} cy={R.cy} rx={R.rx} ry={R.ry} fill="url(#rk-ice)" />
      <g clipPath="url(#rk-ice-clip)">
        <rect x={R.cx - R.rx} y={R.cy - R.ry} width={R.rx * 2} height="22" fill="#94a3b8" opacity="0.18" />
        {[290, 600, 910].map((x) => (
          <path key={x} d={`M${x - 40} ${R.cy - R.ry} L${x + 40} ${R.cy - R.ry} L${x + 26} ${R.cy + R.ry} L${x - 26} ${R.cy + R.ry}Z`} fill="url(#rk-streak)" opacity="0.5" />
        ))}
        <path
          d="M300 560 Q420 520 560 548 M640 640 Q760 690 900 646 M380 680 Q520 712 620 690 M700 540 Q820 512 930 560 M450 610 Q560 580 700 600 M260 640 Q330 690 420 700"
          fill="none"
          stroke="#9fb6cd"
          strokeWidth="1.6"
          opacity="0.35"
        />
        <ellipse cx={R.cx} cy={R.cy} rx="74" ry="24" fill="none" stroke="#db2777" strokeWidth="3" opacity="0.28" />
        <g opacity="0.16">
          <Fit x={R.cx} y={R.cy + 9} w={110} size={22} fill="#db2777">
            ALGEBRIDGE
          </Fit>
        </g>
      </g>
      <ellipse cx={R.cx} cy={R.cy} rx={R.rx} ry={R.ry} fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <Vignette id={id} />
    </svg>
  );
}
