"use client";

import type { ReactNode } from "react";
import type { CourtGameId } from "@/lib/games";

/**
 * The team, drawn the way Veronica is: flat, two tones per surface, no
 * outlines, one SVG with the limbs in groups so moving and each sport's move
 * are CSS turning the groups about their joints. Every drawing is 100 wide and
 * 160 tall with the feet at the bottom, so the games can place any of them
 * the same way.
 *
 *  - Shaurya: short black hair, a thin round silver bangle on his wrist, a
 *    blue wrestling singlet and high-top wrestling shoes.
 *  - Jo: braids pulled back into a long ponytail with a bow, round
 *    tortoiseshell glasses, small gold hoops; a cheer uniform and pom-poms.
 *    The shortest of the four.
 *  - Jordyn: the tallest, with long braids that end in curls down her back; a
 *    purple volleyball jersey, knee pads and court shoes.
 *  - Rayla: long braids in a high ponytail, black rectangular glasses; a green
 *    soccer kit, long socks and cleats.
 */

export type PlayerPose = "idle" | "move" | "action";

interface Props {
  pose?: PlayerPose;
  facing?: 1 | -1;
  className?: string;
}

/** The frame every player shares: the flip, the whole-body move, and the shadow. */
function Frame({ id, name, pose, facing, className, children }: Props & { id: CourtGameId; name: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 100 160"
      className={`player player-${id} player-${pose} ${className ?? ""}`}
      style={{ ["--stride" as string]: "0.5s" }}
      role="img"
      aria-label={name}
    >
      <ellipse cx="50" cy="155" rx="24" ry="4" fill="#0f172a" opacity="0.18" />
      <g className="p-flip" style={{ transformOrigin: "50px 80px", transform: facing === -1 ? "scale(-1, 1)" : undefined }}>
        <g className="p-all" style={{ transformOrigin: "50px 150px" }}>
          {children}
        </g>
      </g>
    </svg>
  );
}

/** A face turned a little to the right: eyes, brows, a small smile. */
function Face({ brow, lip, skinShade }: { brow: string; lip: string; skinShade: string }) {
  return (
    <g>
      <path d="M42.5 30.5 Q45.5 28.8 48.5 30.2" stroke={brow} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M53.5 30.2 Q56.5 28.8 59.5 30.5" stroke={brow} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="46" cy="35" rx="1.9" ry="2.2" fill="#1c1210" />
      <ellipse cx="56" cy="35" rx="1.9" ry="2.2" fill="#1c1210" />
      <circle cx="46.6" cy="34.3" r="0.6" fill="#ffffff" opacity="0.8" />
      <circle cx="56.6" cy="34.3" r="0.6" fill="#ffffff" opacity="0.8" />
      <path d="M50.5 37.5 Q51.5 39.5 50 40.2" stroke={skinShade} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M46 42.5 Q50.5 45.5 55 42.5" stroke={lip} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** A leg from the hip down: `parts` are bands from top to bottom (shorts, skin, pads, socks), then the shoe. */
function Leg({ x, bands, shoe, cls, origin }: { x: number; bands: { y: number; h: number; fill: string; rx?: number }[]; shoe: ReactNode; cls: string; origin: string }) {
  return (
    <g className={`p-leg ${cls}`} style={{ transformOrigin: origin }}>
      {bands.map((b, i) => (
        <rect key={i} x={x} y={b.y} width="12" height={b.h} rx={b.rx ?? 4} fill={b.fill} />
      ))}
      {shoe}
    </g>
  );
}

/** A shoe with its toe to the right. */
function Shoe({ x, y, fill, shade, sole, detail }: { x: number; y: number; fill: string; shade: string; sole: string; detail?: ReactNode }) {
  return (
    <g>
      <path d={`M${x} ${y} L${x + 13} ${y} L${x + 14} ${y + 5} Q${x + 21} ${y + 6} ${x + 23} ${y + 10} L${x + 23} ${y + 13} L${x - 1} ${y + 13} Q${x - 2} ${y + 6} ${x} ${y}Z`} fill={fill} />
      <path d={`M${x + 14} ${y + 5} Q${x + 21} ${y + 6} ${x + 23} ${y + 10} L${x + 23} ${y + 13} L${x + 12} ${y + 13}Z`} fill={shade} opacity="0.55" />
      <rect x={x - 1} y={y + 12} width="24" height="3" rx="1.2" fill={sole} />
      {detail}
    </g>
  );
}

/** An arm from the shoulder: sleeve (if any), skin to the hand, and what the hand holds. */
function Arm({ side, skin, skinShade, sleeve, sleeveShade, extra, hand }: { side: "front" | "back"; skin: string; skinShade: string; sleeve?: string; sleeveShade?: string; extra?: ReactNode; hand?: ReactNode }) {
  const x = side === "front" ? 64 : 36;
  const tone = side === "front" ? skin : skinShade;
  return (
    <g className={`p-arm p-arm-${side}`} style={{ transformOrigin: `${x}px 62px` }}>
      <circle cx={x} cy="63" r="6" fill={sleeve ? (side === "front" ? sleeve : sleeveShade) : tone} />
      <rect x={x - 5.5} y="64" width="11" height="34" rx="5.5" fill={tone} />
      {sleeve && <rect x={x - 6.5} y="60" width="13" height="13" rx="5" fill={side === "front" ? sleeve : sleeveShade} />}
      {extra}
      <circle cx={x} cy="99" r="5.5" fill={tone} />
      {hand}
    </g>
  );
}

/* ── Shaurya: wrestling ─────────────────────────────────────────── */

const SH = {
  skin: "#b07a55",
  skinShade: "#95613f",
  hair: "#16110e",
  singlet: "#1d4ed8",
  singletShade: "#1e3a8a",
  trim: "#facc15",
  shoe: "#1f2937",
  silver: "#d6dbe1",
  silverShade: "#9aa3ad",
  lip: "#7c3f2c",
};

export function Shaurya({ pose = "idle", facing = 1, className }: Props) {
  const legBands = (skin: string) => [
    { y: 96, h: 16, fill: SH.singletShade },
    { y: 108, h: 22, fill: skin },
  ];
  const shoe = (x: number, shade: boolean) => (
    <g>
      {/* High-top wrestling shoes, laced up the front. */}
      <rect x={x + 0.5} y="122" width="12" height="16" rx="3" fill={shade ? "#111827" : SH.shoe} />
      <Shoe x={x} y={136} fill={shade ? "#111827" : SH.shoe} shade="#000000" sole="#e5e7eb" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x + 3} y={125 + i * 4} width="7" height="1.1" rx="0.5" fill="#e5e7eb" opacity="0.8" />
      ))}
    </g>
  );
  return (
    <Frame id="wrestling" name="Shaurya" pose={pose} facing={facing} className={className}>
      <Leg x={47} bands={legBands(SH.skinShade)} shoe={shoe(45, true)} cls="p-leg-back" origin="53px 100px" />
      <g className="p-body" style={{ transformOrigin: "50px 100px" }}>
        <Arm side="back" skin={SH.skin} skinShade={SH.skinShade} />
        {/* Chest, showing in the singlet's scoop neck. */}
        <rect x="42" y="52" width="16" height="18" rx="4" fill={SH.skin} />
        {/* The singlet: straps over the shoulders, a gold stripe down the side. */}
        <path d="M37 60 L43 57 L46 64 Q50 67 54 64 L57 57 L63 60 L63 104 Q50 108 37 104Z" fill={SH.singlet} />
        <path d="M50 66 Q54 64 57 57 L63 60 L63 104 Q57 106 50 106Z" fill={SH.singletShade} opacity="0.5" />
        <rect x="59" y="62" width="3" height="42" fill={SH.trim} opacity="0.9" />
        <rect x="38" y="62" width="3" height="42" fill={SH.trim} opacity="0.7" />
        {/* A thin, round silver bangle at the wrist. */}
        <Arm
          side="front"
          skin={SH.skin}
          skinShade={SH.skinShade}
          extra={
            <g>
              <ellipse cx="64" cy="93.5" rx="6.6" ry="2" fill="none" stroke={SH.silverShade} strokeWidth="1.6" />
              <path d="M57.8 93 Q64 90.6 70.2 93" stroke={SH.silver} strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </g>
          }
        />
        <rect x="46" y="44" width="8" height="12" fill={SH.skinShade} />
        <circle cx="50" cy="34" r="16" fill={SH.skinShade} />
        <circle cx="48.5" cy="32.8" r="14.6" fill={SH.skin} />
        {/* Short black hair, full on top, cut close at the sides. */}
        <path d="M34.5 33 Q33 16 49 15.5 Q63 15 65.5 29 Q60 22 52 22.5 Q45 21 40 25 Q37 28 37.5 34 Z" fill={SH.hair} />
        <path d="M41 21 Q48 17 56 19 Q50 19.5 45 22Z" fill="#2b221d" />
        <circle cx="36" cy="36" r="2.4" fill={SH.skinShade} />
        <Face brow={SH.hair} lip={SH.lip} skinShade={SH.skinShade} />
      </g>
      <Leg x={41} bands={legBands(SH.skin)} shoe={shoe(39, false)} cls="p-leg-front" origin="47px 100px" />
    </Frame>
  );
}

/* ── Jo: cheer ──────────────────────────────────────────────────── */

const JO = {
  skin: "#5a3622",
  skinShade: "#452819",
  hair: "#110b09",
  shell: "#2563eb",
  shellShade: "#1d4ed8",
  white: "#f8fafc",
  bow: "#facc15",
  pom: "#facc15",
  pomLight: "#fde68a",
  tortoise: "#7a4a24",
  tortoiseLight: "#b7793f",
  gold: "#eab308",
  lip: "#5e2a1c",
};

/** A pom-pom: a burst of streamers around the hand. */
function PomPom({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <circle key={i} cx={x + Math.cos(a) * 7} cy={y + Math.sin(a) * 7} r="4.2" fill={i % 2 ? JO.pom : JO.pomLight} />;
      })}
      <circle cx={x} cy={y} r="6" fill={JO.pom} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        return <circle key={i} cx={x + Math.cos(a) * 4} cy={y + Math.sin(a) * 4} r="2.4" fill={JO.white} />;
      })}
    </g>
  );
}

export function Jo({ pose = "idle", facing = 1, className }: Props) {
  const legBands = (skin: string) => [
    { y: 100, h: 28, fill: skin },
    { y: 124, h: 14, fill: JO.white, rx: 3 },
  ];
  return (
    <Frame id="cheer" name="Jo" pose={pose} facing={facing} className={className}>
      <Leg x={47} bands={legBands(JO.skinShade)} shoe={<Shoe x={45} y={136} fill="#e2e8f0" shade="#94a3b8" sole="#cbd5e1" />} cls="p-leg-back" origin="53px 100px" />
      <g className="p-body" style={{ transformOrigin: "50px 100px" }}>
        {/* Braids pulled back into a long ponytail, tied with a bow. */}
        <path d="M34 26 Q20 34 22 60 Q23 80 30 92 Q33 84 32 72 Q31 52 40 38Z" fill={JO.hair} />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${33 - i} ${34 + i * 12} q-3 5 0 10`} stroke="#2a1a14" strokeWidth="1" fill="none" />
        ))}
        <Arm side="back" skin={JO.skin} skinShade={JO.skinShade} hand={<PomPom x={36} y={100} />} />
        {/* Pleated skirt: blue with white pleats showing. */}
        <path d="M36 90 L64 90 L72 112 Q61 115 50 113 Q39 115 28 112Z" fill={JO.shell} />
        {[33, 42, 51, 60].map((x) => (
          <path key={x} d={`M${x + 3} 92 L${x + 1} 112 L${x + 5} 112Z`} fill={JO.white} opacity="0.9" />
        ))}
        {/* The shell top, with a white V down the front. */}
        <path d="M36 58 Q50 54 64 58 L64 92 L36 92Z" fill={JO.shell} />
        <path d="M50 58 Q58 56 64 58 L64 92 L50 92Z" fill={JO.shellShade} opacity="0.5" />
        <path d="M41 58 L50 74 L59 58 L56 58 L50 69 L44 58Z" fill={JO.white} />
        <rect x="36" y="84" width="28" height="3" fill={JO.white} opacity="0.9" />
        <Arm side="front" skin={JO.skin} skinShade={JO.skinShade} hand={<PomPom x={64} y={100} />} />
        <rect x="46" y="44" width="8" height="12" fill={JO.skinShade} />
        <circle cx="50" cy="34" r="16" fill={JO.skinShade} />
        <circle cx="48.5" cy="32.8" r="14.6" fill={JO.skin} />
        {/* Hair: sleek braids back from the hairline. */}
        <path d="M34 32 Q35 15 51 15 Q65 15.5 66 28 Q59 22 50 23 Q41 24 36 34Z" fill={JO.hair} />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${40 + i * 6} ${23 - (i === 1 || i === 2 ? 1 : 0)} Q${37 + i * 5} ${19} ${35 + i * 3} ${21 + i}`} stroke="#2a1a14" strokeWidth="0.9" fill="none" />
        ))}
        <path d="M35 24 l-4 -6 l6 1Z M35 24 l-6 2 l3 4Z" fill={JO.bow} />
        <circle cx="35" cy="24" r="2" fill="#eab308" />
        <circle cx="36" cy="37" r="2.4" fill={JO.skinShade} />
        {/* Small gold hoops. */}
        <circle cx="36" cy="42" r="2.4" fill="none" stroke={JO.gold} strokeWidth="1.1" />
        <Face brow={JO.hair} lip={JO.lip} skinShade={JO.skinShade} />
        {/* Round tortoiseshell glasses. */}
        <g>
          <circle cx="46" cy="35" r="5" fill="#ffffff" opacity="0.12" />
          <circle cx="56.2" cy="35" r="5" fill="#ffffff" opacity="0.12" />
          <circle cx="46" cy="35" r="5" fill="none" stroke={JO.tortoise} strokeWidth="1.5" />
          <circle cx="56.2" cy="35" r="5" fill="none" stroke={JO.tortoise} strokeWidth="1.5" />
          <path d="M42.2 31.6 A5 5 0 0 1 47 30.1" stroke={JO.tortoiseLight} strokeWidth="1.2" fill="none" />
          <path d="M52.4 31.6 A5 5 0 0 1 57.2 30.1" stroke={JO.tortoiseLight} strokeWidth="1.2" fill="none" />
          <path d="M51 35 L51.2 35" stroke={JO.tortoise} strokeWidth="1.4" />
          <path d="M41 34.4 L36.6 33.6" stroke={JO.tortoise} strokeWidth="1.2" />
        </g>
      </g>
      <Leg x={41} bands={legBands(JO.skin)} shoe={<Shoe x={39} y={136} fill={JO.white} shade="#cbd5e1" sole="#cbd5e1" />} cls="p-leg-front" origin="47px 100px" />
    </Frame>
  );
}

/* ── Jordyn: volleyball ─────────────────────────────────────────── */

const JD = {
  skin: "#6f432a",
  skinShade: "#573220",
  hair: "#120c0a",
  hairLight: "#2d1d16",
  jersey: "#7c3aed",
  jerseyShade: "#5b21b6",
  white: "#f8fafc",
  shorts: "#111827",
  lip: "#5e2a1c",
};

/** Long braids that end in loose curls. */
function CurlyEnds({ x, y, n, dir }: { x: number; y: number; n: number; dir: 1 | -1 }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={x + dir * i * 4.2} cy={y + (i % 2) * 3} r="3.6" fill={i % 3 === 1 ? JD.hairLight : JD.hair} />
      ))}
    </g>
  );
}

export function Jordyn({ pose = "idle", facing = 1, className }: Props) {
  const legBands = (skin: string) => [
    { y: 97, h: 13, fill: JD.shorts },
    { y: 108, h: 22, fill: skin },
    { y: 114, h: 9, fill: JD.white, rx: 3.5 },
    { y: 128, h: 10, fill: JD.white, rx: 3 },
  ];
  return (
    <Frame id="volleyball" name="Jordyn" pose={pose} facing={facing} className={className}>
      <Leg x={47} bands={legBands(JD.skinShade)} shoe={<Shoe x={45} y={136} fill="#e2e8f0" shade="#94a3b8" sole="#7c3aed" />} cls="p-leg-back" origin="53px 100px" />
      <g className="p-body" style={{ transformOrigin: "50px 100px" }}>
        {/* Long braids down her back, to the waist, ending in curls. */}
        <path d="M33 24 Q24 40 25 70 Q25 88 29 100 L45 100 Q40 80 41 60 Q42 40 44 30Z" fill={JD.hair} />
        <path d="M66 24 Q74 42 73 68 Q73 86 70 98 L58 98 Q62 80 61 60 Q60 42 58 30Z" fill={JD.hair} />
        {[29, 33, 37].map((x, i) => (
          <path key={x} d={`M${x} ${40 + i * 6} Q${x - 2} 70 ${x + 1} 96`} stroke={JD.hairLight} strokeWidth="1" fill="none" />
        ))}
        <CurlyEnds x={28} y={98} n={5} dir={1} />
        <CurlyEnds x={71} y={96} n={4} dir={-1} />
        <Arm side="back" skin={JD.skin} skinShade={JD.skinShade} sleeve={JD.jersey} sleeveShade={JD.jerseyShade} />
        {/* Jersey: purple, white V at the neck, a white band. */}
        <path d="M36 58 Q50 54 64 58 L64 100 L36 100Z" fill={JD.jersey} />
        <path d="M50 58 Q58 56 64 58 L64 100 L50 100Z" fill={JD.jerseyShade} opacity="0.5" />
        <path d="M43 57 L50 67 L57 57 L54.5 57 L50 63 L45.5 57Z" fill={JD.white} />
        <rect x="36" y="80" width="28" height="4" fill={JD.white} opacity="0.85" />
        <Arm side="front" skin={JD.skin} skinShade={JD.skinShade} sleeve={JD.jersey} sleeveShade={JD.jerseyShade} />
        <rect x="46" y="44" width="8" height="12" fill={JD.skinShade} />
        <circle cx="50" cy="34" r="16" fill={JD.skinShade} />
        <circle cx="48.5" cy="32.8" r="14.6" fill={JD.skin} />
        {/* A middle part, braids framing her face. */}
        <path d="M34 34 Q33 15 50 15 Q66 15 66 34 Q63 22 55 19.5 L50 17.5 L45 19.5 Q37 22 34 34Z" fill={JD.hair} />
        <path d="M50 16 L50 22" stroke={JD.skinShade} strokeWidth="1" />
        <path d="M35 30 Q31 44 33 56" stroke={JD.hair} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <path d="M65 30 Q69 44 67 56" stroke={JD.hair} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <Face brow={JD.hair} lip={JD.lip} skinShade={JD.skinShade} />
      </g>
      <Leg x={41} bands={legBands(JD.skin)} shoe={<Shoe x={39} y={136} fill={JD.white} shade="#cbd5e1" sole="#7c3aed" />} cls="p-leg-front" origin="47px 100px" />
    </Frame>
  );
}

/* ── Rayla: soccer ──────────────────────────────────────────────── */

const RY = {
  skin: "#7d4e32",
  skinShade: "#633b25",
  hair: "#140d0b",
  hairLight: "#2e1e17",
  kit: "#16a34a",
  kitShade: "#15803d",
  white: "#f8fafc",
  shorts: "#1f2937",
  frames: "#111827",
  cleat: "#111827",
  lip: "#5e2a1c",
};

export function Rayla({ pose = "idle", facing = 1, className }: Props) {
  const legBands = (skin: string, sock: string) => [
    { y: 96, h: 16, fill: RY.shorts },
    { y: 110, h: 8, fill: skin },
    { y: 116, h: 22, fill: sock, rx: 3.5 },
    { y: 117, h: 3, fill: RY.white, rx: 1 },
  ];
  const cleat = (x: number, shade: boolean) => (
    <Shoe
      x={x}
      y={136}
      fill={shade ? "#0b1220" : RY.cleat}
      shade="#000000"
      sole="#9ca3af"
      detail={<path d={`M${x + 4} ${136 + 9} l12 -5`} stroke={RY.white} strokeWidth="1.6" strokeLinecap="round" />}
    />
  );
  return (
    <Frame id="soccer" name="Rayla" pose={pose} facing={facing} className={className}>
      <Leg x={47} bands={legBands(RY.skinShade, RY.kitShade)} shoe={cleat(45, true)} cls="p-leg-back" origin="53px 100px" />
      <g className="p-body" style={{ transformOrigin: "50px 100px" }}>
        {/* Long braids gathered in a high ponytail, falling to mid-back. */}
        <path d="M40 16 Q26 20 24 44 Q23 66 30 84 Q34 74 33 60 Q33 40 42 26Z" fill={RY.hair} />
        {[27, 31].map((x, i) => (
          <path key={x} d={`M${x} ${36 + i * 6} Q${x - 1} 60 ${x + 3} 80`} stroke={RY.hairLight} strokeWidth="1" fill="none" />
        ))}
        <Arm side="back" skin={RY.skin} skinShade={RY.skinShade} sleeve={RY.kit} sleeveShade={RY.kitShade} />
        {/* Green kit with a white collar and stripes on the side. */}
        <path d="M36 58 Q50 54 64 58 L64 100 L36 100Z" fill={RY.kit} />
        <path d="M50 58 Q58 56 64 58 L64 100 L50 100Z" fill={RY.kitShade} opacity="0.5" />
        <path d="M43 57 Q50 63 57 57 L56 56 Q50 60.5 44 56Z" fill={RY.white} />
        <rect x="37" y="66" width="2.5" height="32" fill={RY.white} opacity="0.85" />
        <rect x="60.5" y="66" width="2.5" height="32" fill={RY.white} opacity="0.85" />
        <Arm side="front" skin={RY.skin} skinShade={RY.skinShade} sleeve={RY.kit} sleeveShade={RY.kitShade} />
        <rect x="46" y="44" width="8" height="12" fill={RY.skinShade} />
        <circle cx="50" cy="34" r="16" fill={RY.skinShade} />
        <circle cx="48.5" cy="32.8" r="14.6" fill={RY.skin} />
        <path d="M34 33 Q35 15 51 15 Q65 15 66 30 Q59 22 50 23 Q41 24 35 35Z" fill={RY.hair} />
        <circle cx="41" cy="16.5" r="3.4" fill={RY.hair} />
        <circle cx="36" cy="36" r="2.4" fill={RY.skinShade} />
        <Face brow={RY.hair} lip={RY.lip} skinShade={RY.skinShade} />
        {/* Black rectangular glasses. */}
        <g fill="none" stroke={RY.frames} strokeWidth="1.6">
          <rect x="41.6" y="31.4" width="9" height="7" rx="1.6" />
          <rect x="52" y="31.4" width="9" height="7" rx="1.6" />
          <path d="M50.6 34 L52 34" />
          <path d="M41.6 33.4 L36.5 33" />
        </g>
      </g>
      <Leg x={41} bands={legBands(RY.skin, RY.kit)} shoe={cleat(39, false)} cls="p-leg-front" origin="47px 100px" />
    </Frame>
  );
}

export const PLAYER_BY_GAME: Record<CourtGameId, (p: Props) => ReactNode> = {
  wrestling: Shaurya,
  cheer: Jo,
  volleyball: Jordyn,
  soccer: Rayla,
};

export function Player({ game, ...props }: Props & { game: CourtGameId }) {
  const Drawn = PLAYER_BY_GAME[game];
  return <>{Drawn(props)}</>;
}
