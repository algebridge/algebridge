"use client";

import type { ReactNode } from "react";
import { Arm, Braid, Face, Head, JOINT, Leg, Shoe, SkinDefs, TORSO, TORSO_SHADE, TORSO_SLIM, TORSO_SLIM_SHADE, limbFill, useArtId, type Look } from "@/components/games/figure";
import type { CourtGameId } from "@/lib/games";

/**
 * The team, drawn from their photos: Shaurya the wrestler, Jo the cheerleader,
 * Jordyn the volleyball player, Rayla the striker. Each is one SVG built from
 * the shared figure (see figure.tsx), with the limbs in groups the court CSS
 * rotates: `.p-arm-front`, `.p-arm-back`, `.p-leg-front`, `.p-leg-back`,
 * `.p-body` and `.p-all` for the whole person. A player facing left is the
 * same drawing mirrored by the `player-left` class, with any lettering
 * mirrored back so it still reads.
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
      className={`player player-${id} player-${pose} ${facing === -1 ? "player-left" : ""} ${className ?? ""}`}
      style={{ ["--stride" as string]: "0.5s" }}
      role="img"
      aria-label={name}
    >
      <ellipse cx="50" cy="155" rx="24" ry="4" fill="#0f172a" opacity="0.18" />
      <g className="p-flip" style={{ transformOrigin: "50px 80px" }}>
        <g className="p-all" style={{ transformOrigin: "50px 150px" }}>
          {children}
        </g>
      </g>
    </svg>
  );
}

/** A shirt's cloth: the base, its shaded side, and a catch of light on the left. */
function Cloth({ base, shade }: { base: string; shade: string }) {
  return (
    <g>
      <path d={TORSO} fill={base} />
      <path d={TORSO_SHADE} fill={shade} opacity="0.5" />
      <path d="M37.6 54 L39.8 54 L38.6 97 L36.7 97Z" fill="#ffffff" opacity="0.1" />
    </g>
  );
}

/** A small gold hoop under an ear. */
function Hoop({ x, y, gold }: { x: number; y: number; gold: string }) {
  return <circle cx={x} cy={y} r="2.1" fill="none" stroke={gold} strokeWidth="1.1" />;
}

/* ── Shaurya: wrestling ─────────────────────────────────────────── */

const SH: Look = {
  skin: "#a9764f",
  skinShade: "#895b3a",
  skinLight: "#c6906a",
  hair: "#16110e",
  hairLight: "#3a2b24",
  iris: "#2b1a12",
  lip: "#7d4232",
  lipLight: "#9a5745",
};
/** He is tall and slim, so his limbs and torso are cut narrower than the others'. */
const SH_BUILD = 0.86;
const SH_KIT = { singlet: "#1d4ed8", singletShade: "#1e3a8a", trim: "#facc15", shoe: "#1f2937", silver: "#d6dbe1", silverShade: "#9aa3ad" };

export function Shaurya({ pose = "idle", facing = 1, className }: Props) {
  const id = useArtId();
  const trunks = { base: SH_KIT.singlet, shade: SH_KIT.singletShade, to: 116 };
  const shoe = (x: number, back: boolean) => <Shoe x={x} fill={back ? "#111827" : SH_KIT.shoe} shade="#000000" sole="#e5e7eb" high laces />;
  return (
    <Frame id="wrestling" name="Shaurya" pose={pose} facing={facing} className={className}>
      <SkinDefs id={id} look={SH} />
      <Leg cls="p-leg p-leg-back" side="back" look={SH} id={id} w={SH_BUILD} shorts={trunks} shoe={shoe(JOINT.backLegX, true)} />
      <g className="p-body" style={{ transformOrigin: "50px 100px" }}>
        <Arm cls="p-arm p-arm-back" side="back" look={SH} id={id} w={SH_BUILD} />
        {/* The chest and shoulders, then the singlet over them: straps, a scoop neck, gold down the sides. */}
        <path d={TORSO_SLIM} fill={limbFill(id)} />
        <path d={TORSO_SLIM_SHADE} fill={SH.skinShade} opacity="0.35" />
        <path d="M40.6 51.9 L45.6 51.2 L47.4 63.6 Q50 66.8 52.6 63.6 L54.4 51.2 L59.4 51.9 L63.6 61 C64.2 76 62.9 89 62.5 100 L37.5 100 C37.1 89 35.8 76 36.4 61Z" fill={SH_KIT.singlet} />
        <path d="M51.4 64.4 Q52 65.8 52.6 63.6 L54.4 51.2 L59.4 51.9 L63.6 61 C64.2 76 62.9 89 62.5 100 L51.4 100Z" fill={SH_KIT.singletShade} opacity="0.5" />
        <path d="M60.6 62 L63.2 62 L63.6 100 L61 100Z" fill={SH_KIT.trim} opacity="0.92" />
        <path d="M36.6 62 L39.2 62 L38.8 100 L36.2 100Z" fill={SH_KIT.trim} opacity="0.72" />
        <path d="M47.4 63.6 Q50 66.8 52.6 63.6" stroke={SH_KIT.singletShade} strokeWidth="0.7" fill="none" opacity="0.6" />
        <Arm
          cls="p-arm p-arm-front"
          side="front"
          look={SH}
          id={id}
          w={SH_BUILD}
          extra={
            <g>
              {/* A thin, round silver bangle at the wrist. */}
              <ellipse cx="62.5" cy="96.2" rx="4.7" ry="1.55" fill="none" stroke={SH_KIT.silverShade} strokeWidth="1.4" />
              <path d="M58.2 95.8 Q62.5 93.9 66.8 95.8" stroke={SH_KIT.silver} strokeWidth="1" fill="none" strokeLinecap="round" />
            </g>
          }
        />
        <Head id={id} look={SH} jaw="long">
          {/* Short black hair with some height on top, cut close at the sides. */}
          <path d="M38.2 24.8 C37.2 11.6 43.2 6.4 50 6.4 C57.6 6.4 63 11.4 62 25.2 C61 17.8 56.6 14.2 50.4 14.2 C44.4 14.2 39.6 17.8 38.2 24.8Z" fill={SH.hair} />
          <path d="M38.4 24 L38.6 30 Q40 29.6 40.2 27.2 Q39.6 25.2 40.6 22.4Z" fill={SH.hair} />
          <path d="M61.8 24.4 L61.6 29.8 Q60.4 29.4 60.2 27 Q60.8 25 59.8 22.6Z" fill={SH.hair} />
          {["M41.4 12.4 Q44 8.6 47.4 8.2", "M46 10 Q49 7.2 52.6 7.6", "M51.6 8.6 Q55.4 8.2 58.2 11", "M42.4 16.2 Q40.4 14 41 11.6"].map((d) => (
            <path key={d} d={d} stroke={SH.hairLight} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.55" />
          ))}
          <Face look={SH} smile={0.72} />
        </Head>
      </g>
      <Leg cls="p-leg p-leg-front" side="front" look={SH} id={id} w={SH_BUILD} shorts={trunks} shoe={shoe(JOINT.frontLegX, false)} />
    </Frame>
  );
}

/* ── Jo: cheer ──────────────────────────────────────────────────── */

const JO: Look = {
  skin: "#5c3a26",
  skinShade: "#44281a",
  skinLight: "#76513b",
  hair: "#120b09",
  hairLight: "#2f1d16",
  iris: "#241611",
  lip: "#6a3529",
  lipLight: "#8f4f41",
};
const JO_KIT = {
  shell: "#2563eb",
  shellShade: "#1d4ed8",
  white: "#f8fafc",
  bow: "#facc15",
  pom: "#facc15",
  pomLight: "#fde68a",
  tortoise: "#6b3f1f",
  tortoiseLight: "#b7793f",
  gold: "#d4a017",
};

// Where the streamers sit around the hand. Written out rather than computed, so the
// server and the browser agree to the last digit (their sines differ).
const POM_OUTER: [number, number][] = [[7.2, 0.0], [6.06, 3.89], [2.99, 6.55], [-1.02, 7.13], [-4.71, 5.44], [-6.91, 2.03], [-6.91, -2.03], [-4.71, -5.44], [-1.02, -7.13], [2.99, -6.55], [6.06, -3.89]];
const POM_INNER: [number, number][] = [[3.68, 1.56], [0.49, 3.97], [-3.19, 2.41], [-3.68, -1.56], [-0.49, -3.97], [3.19, -2.41]];

/** A pom-pom: a burst of streamers around the hand. */
function PomPom({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {POM_OUTER.map(([dx, dy], i) => (
        <circle key={i} cx={x + dx} cy={y + dy} r="4.1" fill={i % 2 ? JO_KIT.pom : JO_KIT.pomLight} />
      ))}
      <circle cx={x} cy={y} r="6.2" fill={JO_KIT.pom} />
      {POM_INNER.map(([dx, dy], i) => (
        <circle key={i} cx={x + dx} cy={y + dy} r="2.3" fill={JO_KIT.white} />
      ))}
    </g>
  );
}

export function Jo({ pose = "idle", facing = 1, className }: Props) {
  const id = useArtId();
  const sock = { base: JO_KIT.white, shade: "#e2e8f0", from: 136 };
  const sneaker = (x: number, back: boolean) => <Shoe x={x} fill={back ? "#e2e8f0" : JO_KIT.white} shade="#94a3b8" sole="#cbd5e1" laces />;
  return (
    <Frame id="cheer" name="Jo" pose={pose} facing={facing} className={className}>
      <SkinDefs id={id} look={JO} />
      <Leg cls="p-leg p-leg-back" side="back" look={JO} id={id} sock={sock} shoe={sneaker(JOINT.backLegX, true)} />
      <g className="p-body" style={{ transformOrigin: "50px 100px" }}>
        {/* Braids gathered into a long ponytail, hanging behind her. */}
        <Braid d="M45 12.4 Q25 27 26.5 53 Q27 75 32.5 95" color={JO.hair} tint={JO.hairLight} width={3.4} />
        <Braid d="M47.5 11.6 Q29.5 24 30.4 50 Q31 74 37 97" color={JO.hair} tint={JO.hairLight} width={4.2} />
        <Braid d="M49.6 11.6 Q34 22 34.4 48 Q35 70 40.5 92" color={JO.hair} tint={JO.hairLight} width={3.4} />
        <Arm cls="p-arm p-arm-back" side="back" look={JO} id={id} hand={<PomPom x={JOINT.backArmX} y={104} />} />
        {/* The shell top: blue with a white V and band. */}
        <Cloth base={JO_KIT.shell} shade={JO_KIT.shellShade} />
        <path d="M42.2 51.4 L50.6 69.6 L59 51.4 L56.4 51.4 L50.6 64.2 L44.8 51.4Z" fill={JO_KIT.white} />
        <rect x="35.6" y="83" width="28.8" height="3.4" fill={JO_KIT.white} opacity="0.92" />
        <Arm cls="p-arm p-arm-front" side="front" look={JO} id={id} hand={<PomPom x={JOINT.frontArmX} y={104} />} />
        <Head id={id} look={JO} jaw="round">
          {/* Hair braided back from the hairline into the tail; a bow where it gathers. */}
          <path d="M36.8 26.4 C36.2 12.6 43.2 8.6 50 8.6 C57.2 8.6 64 13 63.4 27 C61.8 18.8 56.4 15.4 50.2 15.4 C44 15.6 38.8 19.6 36.8 26.4Z" fill={JO.hair} />
          {["M40.6 22 Q42.6 14 46.6 11.2", "M44 17.6 Q45.4 13.2 47.6 10.6", "M50 15.6 Q49 12.4 48.4 10.4", "M56 17.2 Q52.6 12.8 49.4 10.4", "M60.8 22.4 Q56 14.4 50.6 10.6"].map((d) => (
            <path key={d} d={d} stroke={JO.hairLight} strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.8" />
          ))}
          <path d="M44.4 13.2 l-4.6 -5.2 l6.4 1.6Z M44.4 13.2 l-6.6 1.4 l3.6 4Z" fill={JO_KIT.bow} />
          <circle cx="44.6" cy="13.4" r="1.9" fill="#eab308" />
          <Face look={JO} smile={0.85} />
          {/* Round tortoiseshell glasses. */}
          <g>
            <circle cx="45.2" cy="26.8" r="5.3" fill="#ffffff" opacity="0.1" />
            <circle cx="56.5" cy="26.8" r="5.3" fill="#ffffff" opacity="0.1" />
            <circle cx="45.2" cy="26.8" r="5.3" fill="none" stroke={JO_KIT.tortoise} strokeWidth="1.5" />
            <circle cx="56.5" cy="26.8" r="5.3" fill="none" stroke={JO_KIT.tortoise} strokeWidth="1.5" />
            <path d="M41.2 23.4 A5.3 5.3 0 0 1 46.4 21.6" stroke={JO_KIT.tortoiseLight} strokeWidth="1.1" fill="none" />
            <path d="M52.5 23.4 A5.3 5.3 0 0 1 57.7 21.6" stroke={JO_KIT.tortoiseLight} strokeWidth="1.1" fill="none" />
            <path d="M50.5 26.4 L51.2 26.4" stroke={JO_KIT.tortoise} strokeWidth="1.5" />
            <path d="M39.9 26.2 L37.2 25.6" stroke={JO_KIT.tortoise} strokeWidth="1.2" />
            <path d="M61.8 26.2 L63.6 25.8" stroke={JO_KIT.tortoise} strokeWidth="1.2" />
          </g>
          <Hoop x={63} y={32.4} gold={JO_KIT.gold} />
          <Hoop x={37} y={32.4} gold={JO_KIT.gold} />
        </Head>
      </g>
      <Leg cls="p-leg p-leg-front" side="front" look={JO} id={id} sock={sock} shoe={sneaker(JOINT.frontLegX, false)} />
      {/* The pleated skirt, over both legs; it moves with the body. */}
      <g className="p-skirt" style={{ transformOrigin: "50px 100px" }}>
        <path d="M35.6 89 L64.4 89 L72.5 113.5 Q61 117 50 115 Q39 117 27.5 113.5Z" fill={JO_KIT.shell} />
        <path d="M50 89 L64.4 89 L72.5 113.5 Q61 117 50 115Z" fill={JO_KIT.shellShade} opacity="0.45" />
        {[31.5, 40, 50, 59.5, 68].map((x) => (
          <path key={x} d={`M${x + 2.5} 91 L${x + 0.5} 112.6 L${x + 4.6} 112.6Z`} fill={JO_KIT.white} opacity="0.9" />
        ))}
      </g>
    </Frame>
  );
}

/* ── Jordyn: volleyball ─────────────────────────────────────────── */

const JD: Look = {
  skin: "#6b4229",
  skinShade: "#52301c",
  skinLight: "#86593c",
  hair: "#120c0a",
  hairLight: "#30201a",
  iris: "#241611",
  lip: "#6b3a2e",
  lipLight: "#8f5142",
};
const JD_KIT = { jersey: "#7c3aed", jerseyShade: "#5b21b6", white: "#f8fafc", shorts: "#111827", shortsShade: "#000000" };

/** A braid's end, in loose curls. */
function CurlyEnd({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x - 1.6} cy={y} r="2.1" fill={JD.hair} />
      <circle cx={x + 1.8} cy={y + 1.6} r="2" fill={JD.hairLight} />
      <circle cx={x + 0.2} cy={y + 3.8} r="1.9" fill={JD.hair} />
    </g>
  );
}

/**
 * One of Jordyn's braids: plaited from the scalp to the shoulder, then loose
 * waves the rest of the way down, the way hers fall.
 */
function BraidToCurls({ ax, ay, ex, ey, curl }: { ax: number; ay: number; ex: number; ey: number; curl: boolean }) {
  const mx = ax + (ax - 50) * 0.42;
  const my = 54;
  const h = ey - my;
  const sway = ex > 50 ? 4.2 : -4.2;
  return (
    <g>
      <Braid d={`M${ax} ${ay} Q${ax + (ax - 50) * 0.16} ${(ay + my) / 2} ${mx} ${my}`} color={JD.hair} tint={JD.hairLight} width={2.7} />
      <path
        d={`M${mx} ${my} C${mx + sway} ${my + h * 0.2} ${ex - sway} ${my + h * 0.42} ${(mx + ex) / 2} ${my + h * 0.6} C${ex + sway} ${my + h * 0.78} ${ex - sway * 0.5} ${my + h * 0.9} ${ex} ${ey}`}
        stroke={JD.hair}
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M${mx + 0.6} ${my + 2} C${mx + sway + 0.6} ${my + h * 0.2} ${ex - sway + 0.6} ${my + h * 0.42} ${(mx + ex) / 2 + 0.6} ${my + h * 0.6}`}
        stroke={JD.hairLight}
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      {curl && <CurlyEnd x={ex} y={ey} />}
    </g>
  );
}

// Braids down her back, to the waist: anchored along the back of the head, fanning a little as they fall.
const JD_BACK_BRAIDS = Array.from({ length: 11 }, (_, i) => {
  const ax = 39.5 + i * 2.1;
  const ay = 15 + Math.abs(i - 5) * 1.1;
  const ex = ax + (ax - 50) * 0.85;
  const ey = 100 + (i % 3) * 3;
  return { ax, ay, ex, ey, curl: i % 2 === 0 };
});
const JD_FRONT_BRAIDS = [
  { ax: 39.8, ay: 20.6, ex: 32.5, ey: 100, curl: true },
  { ax: 40.6, ay: 16.4, ex: 36.4, ey: 104, curl: false },
  { ax: 42.8, ay: 13.8, ex: 40.2, ey: 102, curl: true },
  { ax: 60.4, ay: 16, ex: 66.8, ey: 99, curl: true },
  { ax: 62.2, ay: 20.2, ex: 70.4, ey: 94, curl: false },
  { ax: 58, ay: 13.4, ex: 63.4, ey: 102, curl: true },
];

export function Jordyn({ pose = "idle", facing = 1, className }: Props) {
  const id = useArtId();
  const shorts = { base: JD_KIT.shorts, shade: JD_KIT.shortsShade, to: 118 };
  const sock = { base: JD_KIT.white, shade: "#e2e8f0", from: 137 };
  const pad = { base: JD_KIT.white, shade: "#cbd5e1" };
  const shoe = (x: number, back: boolean) => <Shoe x={x} fill={back ? "#e2e8f0" : JD_KIT.white} shade="#94a3b8" sole="#7c3aed" laces />;
  return (
    <Frame id="volleyball" name="Jordyn" pose={pose} facing={facing} className={className}>
      <SkinDefs id={id} look={JD} />
      <Leg cls="p-leg p-leg-back" side="back" look={JD} id={id} shorts={shorts} kneePad={pad} sock={sock} shoe={shoe(JOINT.backLegX, true)} />
      <g className="p-body" style={{ transformOrigin: "50px 100px" }}>
        {JD_BACK_BRAIDS.map((b) => (
          <BraidToCurls key={b.ax} {...b} />
        ))}
        <Arm cls="p-arm p-arm-back" side="back" look={JD} id={id} sleeve={{ base: JD_KIT.jersey, shade: JD_KIT.jerseyShade }} />
        {/* Jersey: purple, a white V at the neck, a white band, her number. */}
        <Cloth base={JD_KIT.jersey} shade={JD_KIT.jerseyShade} />
        <path d="M43 51.4 L50.6 64.8 L58.2 51.4 L55.6 51.4 L50.6 60.2 L45.6 51.4Z" fill={JD_KIT.white} />
        <rect x="35.4" y="80" width="29.2" height="4" fill={JD_KIT.white} opacity="0.88" />
        <text
          x="50"
          y="94.6"
          textAnchor="middle"
          fontSize="8"
          fontWeight="800"
          fill={JD_KIT.white}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          opacity="0.92"
          className="p-text"
          style={{ transformOrigin: "50px 91px" }}
        >
          7
        </text>
        <Arm cls="p-arm p-arm-front" side="front" look={JD} id={id} sleeve={{ base: JD_KIT.jersey, shade: JD_KIT.jerseyShade }} />
        <Head id={id} look={JD} jaw="oval">
          {/* A middle part, the braids framing her face. */}
          <path d="M36.8 26 C36 12 43 8.4 50 8.4 C57 8.4 64 12 63.2 26 C62 17.4 57.2 14.2 50.6 14.2 L49.4 14.2 C43 14.2 38 17.6 36.8 26Z" fill={JD.hair} />
          <path d="M50 8.8 L50 14.4" stroke={JD.skinShade} strokeWidth="1" strokeLinecap="round" />
          {JD_FRONT_BRAIDS.map((b) => (
            <BraidToCurls key={b.ax} {...b} />
          ))}
          <Face look={JD} smile={0.6} />
        </Head>
      </g>
      <Leg cls="p-leg p-leg-front" side="front" look={JD} id={id} shorts={shorts} kneePad={pad} sock={sock} shoe={shoe(JOINT.frontLegX, false)} />
    </Frame>
  );
}

/* ── Rayla: soccer ──────────────────────────────────────────────── */

const RY: Look = {
  skin: "#5e3b2a",
  skinShade: "#45291c",
  skinLight: "#7b5440",
  hair: "#1a100c",
  hairLight: "#3d2820",
  iris: "#241611",
  lip: "#6b3a2e",
  lipLight: "#8f5548",
};
const RY_KIT = {
  kit: "#dc2626",
  kitShade: "#991b1b",
  white: "#f8fafc",
  shorts: "#111827",
  shortsShade: "#000000",
  frames: "#0f0f12",
  cleat: "#111827",
  gold: "#d4a017",
  /** Some of her braids carry a warm red-brown. */
  tint: "#4a2320",
  tintLight: "#7a3b31",
};

// Box braids worn down: most fall behind her shoulders, a few in front on each side.
const RY_BACK_BRAIDS = Array.from({ length: 9 }, (_, i) => {
  const ax = 40 + i * 2.5;
  const ay = 15.5 + Math.abs(i - 4) * 1.2;
  const ex = ax + (ax - 50) * 0.7;
  const ey = 90 + (i % 3) * 3.5;
  return { d: `M${ax} ${ay} Q${ax + (ax - 50) * 0.28} ${(ay + ey) / 2} ${ex} ${ey}`, red: i % 4 === 1 };
});
const RY_FRONT_BRAIDS = [
  { d: "M39.6 21 Q34.6 52 34 91", red: false },
  { d: "M40.5 16.6 Q37.4 54 37.6 95", red: true },
  { d: "M42.8 14 Q40.6 52 41.4 97", red: false },
  { d: "M60.6 16 Q64.6 52 65.6 90", red: false },
  { d: "M62.3 20.4 Q67 50 69 86", red: true },
  { d: "M58.4 13.6 Q62.4 52 63 95", red: false },
];

export function Rayla({ pose = "idle", facing = 1, className }: Props) {
  const id = useArtId();
  const shorts = { base: RY_KIT.shorts, shade: RY_KIT.shortsShade, to: 118 };
  const sock = { base: RY_KIT.kit, shade: RY_KIT.kitShade, from: 124, stripe: RY_KIT.white };
  const cleat = (x: number, back: boolean) => (
    <Shoe
      x={x}
      fill={back ? "#0b1220" : RY_KIT.cleat}
      shade="#000000"
      sole="#9ca3af"
      detail={<path d={`M${x + 3} ${JOINT.ankleY + 7.6} l9 -3.2`} stroke={RY_KIT.white} strokeWidth="1.5" strokeLinecap="round" />}
    />
  );
  return (
    <Frame id="soccer" name="Rayla" pose={pose} facing={facing} className={className}>
      <SkinDefs id={id} look={RY} />
      <Leg cls="p-leg p-leg-back" side="back" look={RY} id={id} shorts={shorts} sock={sock} shoe={cleat(JOINT.backLegX, true)} />
      <g className="p-body" style={{ transformOrigin: "50px 100px" }}>
        {RY_BACK_BRAIDS.map((b) => (
          <Braid key={b.d} d={b.d} color={b.red ? RY_KIT.tint : RY.hair} tint={b.red ? RY_KIT.tintLight : RY.hairLight} width={3} />
        ))}
        <Arm cls="p-arm p-arm-back" side="back" look={RY} id={id} sleeve={{ base: RY_KIT.kit, shade: RY_KIT.kitShade }} />
        {/* Red kit with a white collar and white block letters across the chest. */}
        <Cloth base={RY_KIT.kit} shade={RY_KIT.kitShade} />
        <path d="M43.4 51.7 Q50 49.2 56.6 51.7 L56 53.6 Q50 51.6 44 53.6Z" fill={RY_KIT.white} />
        <text
          x="50"
          y="76.5"
          textAnchor="middle"
          fontSize="6.6"
          fontWeight="800"
          fill={RY_KIT.white}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          letterSpacing="1.1"
          className="p-text"
          style={{ transformOrigin: "50px 74px" }}
        >
          CITY
        </text>
        {/* A thin gold chain. */}
        <path d="M45.4 51.6 Q50 59.4 54.6 51.6" stroke={RY_KIT.gold} strokeWidth="0.9" fill="none" />
        <circle cx="50" cy="58.6" r="1" fill={RY_KIT.gold} />
        <Arm cls="p-arm p-arm-front" side="front" look={RY} id={id} sleeve={{ base: RY_KIT.kit, shade: RY_KIT.kitShade }} />
        <Head id={id} look={RY} jaw="round">
          {/* Braids from a part just left of centre. */}
          <path d="M36.6 25.4 C36.4 12 43 8.6 50 8.6 C57.4 8.6 63.6 12.8 63.4 25.8 C62.4 17.8 56.8 14.6 50 14.8 C43.2 15 38 18.6 36.6 25.4Z" fill={RY.hair} />
          <path d="M47.2 9.2 L46.6 15" stroke={RY.skinShade} strokeWidth="0.9" strokeLinecap="round" />
          {RY_FRONT_BRAIDS.map((b) => (
            <Braid key={b.d} d={b.d} color={b.red ? RY_KIT.tint : RY.hair} tint={b.red ? RY_KIT.tintLight : RY.hairLight} width={3} />
          ))}
          <Face look={RY} smile={0.4} />
          {/* Thick black rectangular glasses. */}
          <g>
            <rect x="39.3" y="22.5" width="9.9" height="7.7" rx="2.2" fill="#ffffff" opacity="0.08" />
            <rect x="51.6" y="22.5" width="9.9" height="7.7" rx="2.2" fill="#ffffff" opacity="0.08" />
            <rect x="39.3" y="22.5" width="9.9" height="7.7" rx="2.2" fill="none" stroke={RY_KIT.frames} strokeWidth="1.9" />
            <rect x="51.6" y="22.5" width="9.9" height="7.7" rx="2.2" fill="none" stroke={RY_KIT.frames} strokeWidth="1.9" />
            <path d="M49.2 25.4 L51.6 25.4" stroke={RY_KIT.frames} strokeWidth="1.8" />
            <path d="M39.3 24.6 L37.2 25.2" stroke={RY_KIT.frames} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M61.5 24.6 L63.4 25.2" stroke={RY_KIT.frames} strokeWidth="1.6" strokeLinecap="round" />
          </g>
          <Hoop x={63} y={32.4} gold={RY_KIT.gold} />
          <Hoop x={37} y={32.4} gold={RY_KIT.gold} />
        </Head>
      </g>
      <Leg cls="p-leg p-leg-front" side="front" look={RY} id={id} shorts={shorts} sock={sock} shoe={cleat(JOINT.frontLegX, false)} />
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
  return <Drawn {...props} />;
}
