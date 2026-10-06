"use client";

import type { ReactNode } from "react";
import { Arm, Braid, ClothGradient, aoFill, Face, GroundShadow, Head, JOINT, Leg, Neck, RIM, SkinDefs, Sneaker, limbFill, mix, n, useArtId, type Look } from "@/components/games/figure";
import type { CourtGameId } from "@/lib/games";

/**
 * The team, drawn from their photos: Shaurya the wrestler, Jo the cheerleader,
 * Jordyn the volleyball player, Rayla the striker. Each is one SVG built from
 * the shared figure (see figure.tsx), with the limbs in groups the court CSS
 * rotates: `.p-arm-*` and `.p-fore-*` (shoulder and elbow), `.p-leg-*`,
 * `.p-shin-*` and `.p-foot-*` (hip, knee and ankle), `.p-body`, `.p-skirt` (cloth that hangs over
 * the front leg and moves with the body) and `.p-all` for the whole person.
 * The near arm sits in a second `.p-body` group (`.p-front`), drawn last so
 * it stays over the cloth. A player facing left is the same drawing mirrored by the `player-left`
 * class, with any lettering mirrored back so it still reads.
 */

export type PlayerPose = "idle" | "move" | "action";

interface Props {
  pose?: PlayerPose;
  facing?: 1 | -1;
  className?: string;
}

/** The frame every player shares: the flip, the whole-body move, and the shadow on the ground. */
function Frame({ game, art, name, pose, facing, className, defs, children }: Props & { game: CourtGameId; art: string; name: string; defs: ReactNode; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 100 160"
      className={`player player-${game} player-${pose} ${facing === -1 ? "player-left" : ""} ${className ?? ""}`}
      style={{ ["--stride" as string]: "0.5s" }}
      role="img"
      aria-label={name}
    >
      {defs}
      <GroundShadow id={art} />
      <g className="p-flip" style={{ transformOrigin: "50px 80px" }}>
        <g className="p-all" style={{ transformOrigin: "50px 154px" }}>
          {children}
        </g>
      </g>
    </svg>
  );
}

const BODY = { transformOrigin: `50px ${JOINT.hipY}px` };

/**
 * A girl's torso from the shoulders to the hips, widened by `k` about the
 * middle; `v` cuts a V neck that deep, otherwise a round neck.
 */
function torso(k: number, v?: number): string {
  const X = (x: number) => n(50.6 + (x - 50.6) * k);
  const neck = v ? `L${X(50.6)} ${v} L${X(56)} 33.2` : `C${X(47.6)} 35.6 ${X(53.6)} 35.6 ${X(56)} 33.2`;
  return `M${X(45.2)} 33.2 ${neck} C${X(59.6)} 34 ${X(63.4)} 35 ${X(65.4)} 36.6 C${X(66.6)} 37.6 ${X(66.6)} 39.6 ${X(66)} 41.6 L${X(63.6)} 47.6 C${X(62.6)} 52 ${X(61.6)} 57 ${X(61.4)} 62 C${X(61.6)} 70 ${X(62.6)} 78 ${X(63)} 86 L${X(37)} 86 C${X(37.4)} 78 ${X(38.4)} 70 ${X(38.6)} 62 C${X(38.4)} 57 ${X(37.4)} 52 ${X(36.4)} 47.6 L${X(34)} 41.6 C${X(33.4)} 39.6 ${X(33.4)} 37.6 ${X(34.6)} 36.6 C${X(36.6)} 35 ${X(40.6)} 34 ${X(45.2)} 33.2Z`;
}

/**
 * The lower part of a top, hanging over the shorts in the `p-skirt` layer: cut
 * to the torso from `from` down, flaring a little to the hem at `to`.
 */
function hem(k: number, from: number, to: number): string {
  const X = (x: number) => n(50.6 + (x - 50.6) * k);
  return `M${X(38.5)} ${from} L${X(61.6)} ${from} C${X(62.1)} ${n(from + 8)} ${X(63)} ${n(to - 6)} ${X(63.4)} ${to} C${X(56)} ${n(to + 1.2)} ${X(45)} ${n(to + 1.2)} ${X(36.6)} ${to} C${X(37)} ${n(to - 6)} ${X(37.9)} ${n(from + 8)} ${X(38.5)} ${from}Z`;
}

/** A short set-in sleeve on the upper arm, to `to`, with an optional band at the hem. */
function capSleeve(x: number, w: number, fill: string, shade: string, to: number, band?: string) {
  const p = (dx: number) => n(x + dx * w);
  return (
    <g>
      {/* The hem's shadow on the arm just under it. */}
      <path d={`M${p(-3.3)} ${n(to + 0.4)} L${p(3.1)} ${n(to + 0.4)} L${p(3)} ${n(to + 3.4)} Q${p(0)} ${n(to + 2.4)} ${p(-3.2)} ${n(to + 3.4)}Z`} fill="#000000" opacity="0.2" />
      <path d={`M${p(-4.6)} 40 C${p(-4.8)} 37 ${p(-2)} 35.2 ${p(0.2)} 35.2 C${p(2.6)} 35.2 ${p(4.9)} 37 ${p(4.6)} 40.2 L${p(4.5)} ${to} Q${p(0)} ${n(to + 1.5)} ${p(-4.5)} ${to}Z`} fill={fill} />
      {/* A fold running down from the armpit, and the seam at the shoulder. */}
      <path d={`M${p(-4.3)} ${n(to - 8)} Q${p(-1.6)} ${n(to - 4.6)} ${p(2.6)} ${n(to - 3.2)} M${p(-2.6)} 36.2 Q${p(0.4)} 37.4 ${p(3.4)} 36.6`} stroke={shade} strokeWidth="0.45" fill="none" opacity="0.6" strokeLinecap="round" />
      {band && <path d={`M${p(-4.45)} ${n(to - 0.9)} Q${p(0)} ${n(to + 0.6)} ${p(4.45)} ${n(to - 0.9)}`} stroke={band} strokeWidth="1.3" fill="none" />}
      <path d={`M${p(4.2)} 40 C${p(4.4)} 44 ${p(4.4)} ${n(to - 4)} ${p(4.3)} ${n(to - 1)}`} stroke={RIM} strokeWidth="0.45" fill="none" opacity="0.2" />
    </g>
  );
}

/** A small gold hoop under an ear, in head space. */
function Hoop({ x, y, r, gold }: { x: number; y: number; r: number; gold: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={mix(gold, "#000000", 0.25)} strokeWidth="0.75" />
      <path d={`M${n(x - r)} ${y} A${r} ${r} 0 0 1 ${x} ${n(y - r)}`} stroke={mix(gold, "#ffffff", 0.45)} strokeWidth="0.45" fill="none" />
    </g>
  );
}

/* ── Shaurya: wrestling ─────────────────────────────────────────── */

const SH: Look = {
  skin: "#a9764f",
  skinShade: "#895b3a",
  skinLight: "#c6906a",
  hair: "#16110e",
  hairLight: "#4a3a30",
  iris: "#2b1a12",
  lip: "#7d4232",
  lipLight: "#9a5745",
};
const SH_KIT = {
  tee: "#f8fafc",
  teeShade: "#d5dde6",
  fold: "#b8c4d0",
  print: "#334155",
  shorts: "#a9dbe8",
  shortsShade: "#76b9cc",
  sock: "#f8fafc",
  sockShade: "#d9e0e8",
  slide: "#111827",
  silver: "#e2e6ea",
  silverShade: "#8b949e",
  frames: "#1f2937",
};
/** He is tall and slim: narrow limbs, broad but bony shoulders. */
const SH_BUILD = 0.86;
const SH_ARMS = { back: 32.7, front: 65.4 };

/** A white crew sock in a black slide, the way he wears them. */
function Slide({ x, back }: { x: number; back: boolean }) {
  const y = JOINT.ankleY;
  const X = (dx: number) => n(x + dx);
  return (
    <g>
      <path d={`M${X(-3.6)} ${y - 1.4} L${X(3.4)} ${y - 1.4} C${X(4.4)} ${y + 1.2} ${X(8.6)} ${y + 2.4} ${X(11.6)} ${y + 3.6} C${X(13.4)} ${y + 4.4} ${X(13.6)} ${y + 5.8} ${X(12.8)} ${y + 6.2} L${X(-5)} ${y + 6.2} C${X(-5.6)} ${y + 3.6} ${X(-4.8)} ${y + 1} ${X(-3.6)} ${y - 1.4}Z`} fill={back ? SH_KIT.sockShade : SH_KIT.sock} />
      <path d={`M${X(2)} ${y + 1.2} C${X(6)} ${y + 2.6} ${X(10)} ${y + 3.6} ${X(12.8)} ${y + 6.2} L${X(1)} ${y + 6.2}Z`} fill={SH_KIT.sockShade} opacity="0.7" />
      <path d={`M${X(-2.2)} ${y + 2.8} C${X(1.6)} ${y + 1.6} ${X(6.8)} ${y + 2.4} ${X(9.6)} ${y + 4} L${X(9.8)} ${y + 6.4} L${X(-2.8)} ${y + 6.4}Z`} fill={back ? "#0b0f18" : SH_KIT.slide} />
      <path d={`M${X(-1.4)} ${y + 3.6} C${X(2.4)} ${y + 2.6} ${X(6.4)} ${y + 3.2} ${X(9)} ${y + 4.6}`} stroke="#6b7280" strokeWidth="0.6" fill="none" opacity={back ? 0.4 : 0.85} strokeLinecap="round" />
      <path d={`M${X(-6.2)} ${y + 6} L${X(13.8)} ${y + 6} C${X(14.4)} ${y + 6.6} ${X(14.2)} ${y + 8.2} ${X(13.4)} ${y + 8.4} L${X(-5.8)} ${y + 8.4} C${X(-6.6)} ${y + 8} ${X(-6.8)} ${y + 6.6} ${X(-6.2)} ${y + 6}Z`} fill="#05070b" />
      <path d={`M${X(-6)} ${y + 6.3} L${X(13.6)} ${y + 6.3}`} stroke="#4b5563" strokeWidth="0.45" opacity="0.9" />
    </g>
  );
}

/**
 * The tee's sleeve: dropped off the shoulder, wide and loose, to just above
 * the elbow. `out` is the side away from the neck; `w` is the arm's build,
 * for the shadow the hem throws on it.
 */
function TeeSleeve({ x, id, back, out, w }: { x: number; id: string; back: boolean; out: 1 | -1; w: number }) {
  const X = (dx: number) => n(x + dx * out);
  return (
    <g>
      {/* The hem's shadow on the arm just under it. */}
      <path d={`M${n(x - 3.1 * w)} 56.6 L${n(x + 2.9 * w)} 56.6 L${n(x + 2.8 * w)} 61.2 Q${x} 59.8 ${n(x - 3 * w)} 61.2Z`} fill="#000000" opacity={back ? 0.18 : 0.24} />
      <path
        d={`M${X(-4.4)} 37.6 C${X(-1.6)} 34.8 ${X(2.8)} 35 ${X(5)} 38.8 C${X(5.8)} 44 ${X(6.5)} 50.6 ${X(6.9)} 57 C${X(3.6)} 59.2 ${X(-1.6)} 59.4 ${X(-5)} 57.6 C${X(-4.9)} 51.6 ${X(-4.6)} 44 ${X(-4.4)} 37.6Z`}
        fill={back ? `url(#${id}-teeBack)` : `url(#${id}-tee)`}
      />
      {/* Folds from the armpit, the hem's stitching, a crease at the dropped seam. */}
      <path d={`M${X(-4.4)} 46.6 C${X(-1.4)} 49.6 ${X(2.6)} 51 ${X(6.2)} 50.6 M${X(-4.6)} 52.4 C${X(-1)} 54.2 ${X(2.8)} 54.6 ${X(6.6)} 54.2`} stroke={SH_KIT.fold} strokeWidth="0.5" fill="none" opacity={back ? 0.5 : 0.75} strokeLinecap="round" />
      <path d={`M${X(-4.8)} 56.2 C${X(-1.4)} 57.8 ${X(3.4)} 57.8 ${X(6.8)} 55.8`} stroke={SH_KIT.fold} strokeWidth="0.35" fill="none" strokeDasharray="0.7 0.5" />
      <path d={`M${X(1.2)} 36.2 C${X(3)} 37.6 ${X(4)} 39.6 ${X(4.4)} 41.6`} stroke={SH_KIT.fold} strokeWidth="0.4" fill="none" opacity="0.6" strokeLinecap="round" />
      {!back && <path d={`M${X(5.2)} 41 C${X(5.9)} 46 ${X(6.4)} 51 ${X(6.7)} 56`} stroke={RIM} strokeWidth="0.5" fill="none" opacity="0.2" strokeLinecap="round" />}
    </g>
  );
}

/**
 * Shaurya, from his photo: tall and slim, short dark hair brushed forward,
 * thin dark glasses, an oversized white tee with a small print on the chest,
 * light blue shorts, white crew socks and black slides, a thin silver bangle.
 */
export function Shaurya({ pose = "idle", facing = 1, className }: Props) {
  const id = useArtId();
  const shorts = { fill: `url(#${id}-shorts)`, shade: SH_KIT.shortsShade, to: 105 };
  const sock = { fill: SH_KIT.sock, shade: SH_KIT.sockShade, from: 128 };
  const under = mix(SH.hair, "#000000", 0.4);
  const defs = (
    <>
      <SkinDefs id={id} look={SH} />
      <defs>
        <ClothGradient id={`${id}-tee`} base={SH_KIT.tee} light="#ffffff" shade={SH_KIT.teeShade} />
        <ClothGradient id={`${id}-teeBody`} base={SH_KIT.tee} light="#ffffff" shade={SH_KIT.teeShade} from={31} to={70} />
        <ClothGradient id={`${id}-teeBack`} base={SH_KIT.teeShade} light="#e8edf2" shade="#b9c4cf" />
        <ClothGradient id={`${id}-shorts`} base={SH_KIT.shorts} shade={SH_KIT.shortsShade} />
      </defs>
    </>
  );
  // Locks of the fringe, brushed forward off the crown and a little to his right.
  const strands = [
    "M57.4 8.2 C55.4 10.6 55.4 14.6 56 20",
    "M55 7.6 C52.4 10 51.6 14.4 51.4 20.2",
    "M53.2 7.2 C50.2 9.4 48.4 14 46.8 19.4",
    "M50.4 7.4 C47 8.8 45 13 42.2 19",
    "M59.8 9.4 C58.6 12.4 59 15.6 59.2 18.6",
    "M47.4 8.2 C44 9.6 41.8 13.6 40.4 20",
  ];
  return (
    <Frame game="wrestling" art={id} name="Shaurya" pose={pose} facing={facing} className={className} defs={defs}>
      <Leg cls="p-leg p-leg-back" side="back" look={SH} id={id} w={0.9} shorts={shorts} sock={sock} shoe={<Slide x={JOINT.backLegX} back />} thigh={<HemShadow id={id} x={JOINT.backLegX} y={88} />} />
      <g className="p-body" style={BODY}>
        <Arm cls="p-arm p-arm-back" side="back" look={SH} id={id} x={SH_ARMS.back} w={SH_BUILD} upper={<TeeSleeve x={SH_ARMS.back} id={id} back out={-1} w={SH_BUILD} />} />
        {/* The inside of the collar at the back of the neck, then the neck. */}
        <path d="M45 32.6 C47.4 31.2 53.8 31.2 56.2 32.6 C53.8 33.8 47.4 33.8 45 32.6Z" fill="#cbd5df" />
        <Neck id={id} look={SH} w={1.28} />
        {/* An oversized white tee, loose on him, the shoulder seam dropped off the shoulder and the sides draping in a little. */}
        <path d="M45 33.2 C47.4 35.8 53.8 35.8 56.2 33.2 C60.6 33.8 65.2 35 67.4 36.8 C68.6 37.8 69 39.4 68.8 41.4 L68.2 52 C67.8 58 67.6 61.6 67.6 64 L67.6 76 L33.6 76 L33.6 64 C33.6 61.6 33.4 58 33 52 L32.4 41.4 C32.2 39.4 32.6 37.8 33.8 36.8 C36 35 40.6 33.8 45 33.2Z" fill={`url(#${id}-teeBody)`} />
        {/* The ribbed crew neck, and its shadow on the chest. */}
        <path d="M45.6 35.4 C48 37.4 53.4 37.4 55.6 35.4" stroke={SH_KIT.fold} strokeWidth="0.9" fill="none" opacity="0.35" />
        <path d="M45 33.2 C47.4 35.8 53.8 35.8 56.2 33.2" stroke={SH_KIT.teeShade} strokeWidth="1.5" fill="none" />
        <path d="M45.5 34.2 C47.8 36.4 53.4 36.4 55.7 34.2" stroke={SH_KIT.fold} strokeWidth="0.3" fill="none" />
        {/* The drape: folds falling from under the arms, the shade down his far side. */}
        <path d="M65.6 44 C64.6 52 64.2 62 64.6 76 L67.6 76 L67.6 64 C67.6 61.6 67.8 58 68.2 52Z" fill={SH_KIT.fold} opacity="0.28" />
        <path d="M34.6 46 C37.6 52 38.8 58 38.7 64 M65.2 47 C62.8 53 62 59 62.2 64 M41.4 40.4 C44.4 42.4 47.6 43 50.6 42.6" stroke={SH_KIT.fold} strokeWidth="0.55" fill="none" opacity="0.65" strokeLinecap="round" />
        <path d="M34.2 43 C34.1 52 34.4 60 34.5 64" stroke="#ffffff" strokeWidth="1.3" opacity="0.6" strokeLinecap="round" />
        {/* The small dark print on the chest. */}
        <rect x="54.2" y="44.8" width="5.4" height="4.4" rx="0.9" fill={SH_KIT.print} />
        <path d="M55.2 47.6 l1.1 -1.2 l1 1 l1.2 -1.4" stroke="#f8fafc" strokeWidth="0.55" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Head
          id={id}
          look={SH}
          jaw="long"
          back={<path d="M38.6 25 C37.4 14 42.6 7.2 50.6 7.2 C58.6 7.2 63.6 13 62.6 24.6 L61 20 L40 20Z" fill={under} />}
          shade={<path d="M39 22.4 C40.8 19.6 42.6 19 44.4 19.6 C46.6 19.8 48.8 20.2 51 19.8 C53.4 19.6 55.8 20 58 19.2 C59.8 19.4 61 20.6 61.8 22.4 L62 14 L38.6 14Z" fill={SH.skinShade} opacity="0.6" />}
        >
          <Face id={id} look={SH} spec={{ eye: "narrow", eyeSize: 0.95, brow: "straight-thick", nose: "narrow", lips: "thin", mouth: "closed-smile" }} />
          {/* Close at the sides: short hair over the temple, fading toward the ear. */}
          <path d="M39.2 17.6 C38.8 20.6 39 23.6 39.6 26.6 C40.2 26.4 40.6 25.6 40.6 24.4 C40.6 22.4 40.8 20.6 41.6 18.8Z" fill={SH.hair} opacity="0.92" />
          <path d="M61.8 17.6 C62.2 20.6 62 23.4 61.4 26.2 C60.8 26 60.4 25.2 60.4 24 C60.4 22.2 60.2 20.4 59.4 18.8Z" fill={SH.hair} opacity="0.92" />
          {/* Longer on top, brushed forward into a fringe that breaks into pointed locks over the forehead. */}
          <path d="M39.6 22.8 C38.8 18 39.4 12.6 43.2 9.4 C46.6 6.6 52.4 5.4 57.2 7 C61.6 8.6 63 13 62.2 19.6 L61.6 22.4 C61 20.6 60.2 19.4 59.2 18.8 C58.6 19.8 57.4 20.6 56 20.6 C56.6 19.6 56.4 18.8 55.8 18.2 C54.8 19.4 53.2 20.4 51.4 20.6 C52 19.4 51.8 18.6 51.2 17.8 C50 19 48.4 19.8 46.6 19.8 C47.2 18.8 47 18 46.4 17.4 C45.2 18.4 43.6 19.2 42 19.4 C42.6 18.4 42.4 17.8 42 17.4 C41.2 18.4 40.4 19.8 39.6 22.8Z" fill={SH.hair} />
          {strands.map((d, i) => (
            <path key={d} d={d} stroke={i % 2 ? under : SH.hairLight} strokeWidth={i % 2 ? 0.5 : 0.38} fill="none" opacity={i % 2 ? 0.9 : 0.75} strokeLinecap="round" />
          ))}
          {/* The shine across the crown, broken by the strands. */}
          <path d="M44.4 10.6 C47.6 8.2 52.2 7.2 56.8 8.2" stroke="#b3a397" strokeWidth="1.1" fill="none" opacity="0.26" strokeLinecap="round" strokeDasharray="3.2 0.9 2.4 1.1 4" />
          {/* Thin dark frames. */}
          <g fill="none" stroke={SH_KIT.frames} strokeWidth="0.7">
            <rect x="42.3" y="23" width="7.9" height="5.4" rx="1.5" fill="#ffffff" fillOpacity="0.06" />
            <rect x="52.5" y="23" width="7.3" height="5.2" rx="1.5" fill="#ffffff" fillOpacity="0.06" />
            <path d="M50.2 24.8 Q51.35 24 52.5 24.8" />
            <path d="M42.3 24.4 L39.4 25 M59.8 24.4 L61.6 24.8" />
          </g>
          <path d="M43.4 25 l1.8 -1.4 M53.6 25 l1.6 -1.3" stroke="#ffffff" strokeWidth="0.45" opacity="0.5" strokeLinecap="round" />
        </Head>
      </g>
      <Leg cls="p-leg p-leg-front" side="front" look={SH} id={id} w={0.9} shorts={shorts} sock={sock} shoe={<Slide x={JOINT.frontLegX} back={false} />} thigh={<HemShadow id={id} x={JOINT.frontLegX} y={88} />} />
      {/* The tee hangs over the shorts, in front of both legs: its lower half is cloth that moves with the body. */}
      <g className="p-skirt" style={BODY}>
        <path d="M33.6 64 L67.6 64 C67.8 71 68.2 78 68.4 86.4 Q68.5 87.9 67 88.1 C58 89.5 43 89.5 34.2 88.1 Q32.7 87.9 32.8 86.4 C33 78 33.4 71 33.6 64Z" fill={`url(#${id}-teeBody)`} />
        <path d="M64.6 64 C64.4 72 64.8 80 65.4 88.6 L67 88.1 Q68.5 87.9 68.4 86.4 C68.2 78 67.8 71 67.6 64Z" fill={SH_KIT.fold} opacity="0.28" />
        <path d="M34 86.7 C43 88 58 88 67 86.7" stroke={SH_KIT.fold} strokeWidth="0.35" fill="none" strokeDasharray="0.7 0.5" />
        <path d="M38.7 64 C38.8 72 39.8 80 41.4 85 M62.2 64 C62.1 72 61.8 80 60.8 84.6 M44 82.6 C47.6 84 53.6 84.2 57.6 82.6" stroke={SH_KIT.fold} strokeWidth="0.55" fill="none" opacity="0.6" strokeLinecap="round" />
        <path d="M34.5 64 C34.4 72 34.3 80 34.4 85.8" stroke="#ffffff" strokeWidth="1.3" opacity="0.6" strokeLinecap="round" />
      </g>
      <g className="p-body p-front" style={BODY}>
        <Arm
          cls="p-arm p-arm-front"
          side="front"
          look={SH}
          id={id}
          x={SH_ARMS.front}
          w={SH_BUILD}
          upper={<TeeSleeve x={SH_ARMS.front} id={id} back={false} out={1} w={SH_BUILD} />}
          fore={
            <g>
              {/* A thin, round silver bangle at the wrist. */}
              <ellipse cx={n(SH_ARMS.front)} cy="80.6" rx="2.6" ry="0.95" fill="none" stroke={SH_KIT.silverShade} strokeWidth="0.8" />
              <path d={`M${n(SH_ARMS.front - 2.5)} 80.3 Q${n(SH_ARMS.front)} 79.1 ${n(SH_ARMS.front + 2.5)} 80.3`} stroke={SH_KIT.silver} strokeWidth="0.55" fill="none" strokeLinecap="round" />
            </g>
          }
        />
      </g>
    </Frame>
  );
}

/* ── Jo: cheer ──────────────────────────────────────────────────── */

const JO: Look = {
  skin: "#503021",
  skinShade: "#3a2215",
  skinLight: "#74503b",
  hair: "#120b09",
  hairLight: "#3b2a22",
  iris: "#241611",
  lip: "#5e2f25",
  lipLight: "#8f5244",
};
const JO_KIT = {
  shell: "#2563eb",
  shellShade: "#1840b0",
  white: "#f8fafc",
  whiteShade: "#cbd5e1",
  bow: "#facc15",
  bowShade: "#ca8a04",
  pom: "#facc15",
  pomLight: "#fde68a",
  pomDeep: "#d4a10c",
  tortoise: "#5a3417",
  tortoiseLight: "#c08442",
  gold: "#d4a017",
};

// The streamers, from the hand outward: [dx, dy, width, tone], the tone 0 for the
// yellow, 1 the lit yellow, 2 the shade (the lower right, away from the light) and
// 3 white. Ordered shade first so the lit ones lie on top. Written out rather than
// computed, so the server and the browser agree to the last digit (their sines differ).
const POM: [number, number, number, number][] = [[6.43, 2.21, 1.3, 2], [7.13, 3.63, 1.1, 2], [4.77, 5.12, 1.4, 2], [4.14, 6.13, 1.2, 2], [1.37, 6.46, 1.3, 2], [0.27, 7.8, 1.1, 2], [7.6, 0, 1.2, 0], [-2.43, 6.67, 1.2, 0], [-3.35, 6.03, 1.4, 0], [-5.72, 5.15, 1.1, 0], [1.84, -7.37, 1.3, 0], [5.22, -5.8, 1.2, 0], [6.21, -3.44, 1.3, 0], [6.31, -1.93, 1.4, 0], [-7.11, 1.64, 1.2, 1], [-8, -0.14, 1.1, 1], [-6.22, -4.19, 1.2, 1], [-5.12, -4.77, 1.3, 1], [-2.18, -6.33, 1.2, 1], [0.25, -7.2, 1.4, 1], [-5.32, 3.73, 1.3, 3], [-6.65, -1.41, 1.4, 3], [-3.59, -7.04, 1.1, 3], [3.86, -5.72, 1.1, 3]];

/**
 * A pom-pom: a small core and a burst of streamers from it, lit from the
 * upper left, drawn a third larger than the table so it is as big as a real
 * one next to her (about her head's width).
 */
function PomPom({ x, y, back }: { x: number; y: number; back: boolean }) {
  const tones = [JO_KIT.pom, JO_KIT.pomLight, JO_KIT.pomDeep, JO_KIT.white];
  return (
    <g opacity={back ? 0.92 : 1} transform={`translate(${n(x)} ${n(y)}) scale(1.3)`}>
      <circle r="4.5" fill={JO_KIT.pom} />
      {POM.map(([dx, dy, w, tone], i) => (
        <path key={i} d={`M${n(dx * 0.25)} ${n(dy * 0.25)} L${dx} ${dy}`} stroke={tones[tone]} strokeWidth={w} strokeLinecap="round" />
      ))}
    </g>
  );
}

/** Jo's scalp, in head space: the crown down to her hairline. */
const JO_SCALP = "M39.4 21.8 C38.6 14 43.4 8.6 50.6 8.6 C57.8 8.6 62.6 13.8 61.8 22 C60.8 18.2 58.6 16 56 15.2 C54 14.6 52.2 14.4 50.4 14.4 C48.4 14.4 46.4 14.6 44.6 15.2 C42 16 40.2 18.2 39.4 21.8Z";

export function Jo({ pose = "idle", facing = 1, className }: Props) {
  const id = useArtId();
  const sock = { fill: JO_KIT.white, shade: "#dbe2ea", from: 138 };
  const sneaker = (x: number, back: boolean) => <Sneaker x={x} upper={JO_KIT.white} shade="#c8d1dc" outsole="#94a3b8" accent={JO_KIT.shell} lace="#e2e8f0" back={back} />;
  const defs = (
    <>
      <SkinDefs id={id} look={JO} />
      <defs>
        <ClothGradient id={`${id}-shell`} base={JO_KIT.shell} shade={JO_KIT.shellShade} />
      </defs>
    </>
  );
  // Cornrows, from just inside the hairline back over the crown to where they gather.
  const rows = ["M40.6 19.4 C40.8 15.6 42.4 12.2 45 10.2", "M43.1 16.2 C43.6 13.8 45 11.2 46.8 9.6", "M46 14.4 C46.4 12.6 47.4 10.6 48.6 9.2", "M49.3 13.8 C49.4 12.4 50 10.4 50.6 9", "M52.5 13.8 C52.4 12.6 52.2 10.6 52.4 9.2", "M55.7 14.6 C55.4 13 54.8 11 54.4 9.6", "M58.8 16.9 C58.2 14.8 57.2 12.4 56.2 10.4"];
  return (
    <Frame game="cheer" art={id} name="Jo" pose={pose} facing={facing} className={className} defs={defs}>
      <Leg cls="p-leg p-leg-back" side="back" look={JO} id={id} sock={sock} shoe={sneaker(JOINT.backLegX, true)} thigh={<HemShadow id={id} x={JOINT.backLegX} y={96} />} />
      <g className="p-body" style={BODY}>
        {/* Braids gathered into a long ponytail, hanging behind her. */}
        <Braid d="M42.2 10.4 Q31.6 17 32.2 36 Q32.8 54 36 72" color={JO.hair} tint={JO.hairLight} width={2.3} />
        <Braid d="M43.6 9.8 Q34.4 17.4 35.4 36.4 Q36.2 55 39.6 74" color={JO.hair} tint={JO.hairLight} width={2.8} />
        <Braid d="M45 9.6 Q37.4 17.6 38.4 35.6 Q39.2 52 42.6 69" color={JO.hair} tint={JO.hairLight} width={2.3} />
        <Arm cls="p-arm p-arm-back" side="back" look={JO} id={id} hand={<PomPom x={JOINT.backArmX} y={91} back />} hideHand />
        <Neck id={id} look={JO} chest />
        {/* The shell top: blue, sleeveless, a white V and a white band. */}
        <path d="M44.6 33.6 L50.6 46 L56.6 33.6 L60.8 33.8 C61.6 37.2 62.8 40.2 64.2 42 C63.2 46.6 62 52 61.6 58 C61.4 62 61.6 66 62 70.4 L39.2 70.4 C39.6 66 39.8 62 39.6 58 C39.2 52 38 46.6 37 42 C38.4 40.2 39.6 37.2 40.4 33.8Z" fill={`url(#${id}-shell)`} />
        <path d="M44.4 33.6 L50.6 46.4 L56.8 33.6" stroke={JO_KIT.white} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
        <path d="M40.4 33.8 C39.6 37.2 38.4 40.2 37 42 M60.8 33.8 C61.6 37.2 62.8 40.2 64.2 42" stroke={JO_KIT.white} strokeWidth="0.9" fill="none" />
        <path d="M39.6 61 L61.6 61 L61.8 64.4 L39.5 64.4Z" fill={JO_KIT.white} />
        <path d="M39.5 63.6 L61.8 63.6" stroke={JO_KIT.whiteShade} strokeWidth="0.6" />
        {/* The shape of her under the cloth: the chest, a crease at the waist. */}
        <path d="M40.6 50 C43 51.8 46.4 52 49 51 M52.6 51 C55.2 52 58.2 51.6 60.4 49.8" stroke={JO_KIT.shellShade} strokeWidth="0.5" fill="none" opacity="0.5" strokeLinecap="round" />
        <path d="M38.6 44 C39.6 50 40.2 56 40.2 62" stroke="#ffffff" strokeWidth="0.9" opacity="0.25" strokeLinecap="round" />
        <path d="M63.4 43.6 C62.4 49 61.8 56 61.8 66" stroke={RIM} strokeWidth="0.5" opacity="0.2" />
        {/* Soft shade where the near arm meets the body. */}
        <ellipse cx={n(JOINT.frontArmX - 3.4)} cy="46" rx="2.4" ry="6.5" fill={aoFill(id)} />
        <Head
          id={id}
          look={JO}
          jaw="round"
          shade={<path d="M39 21 C40.6 17.6 43.4 16 46.6 15.8 C49 15.6 52.4 15.6 55 16 C58 16.6 60.4 18.6 61.8 21.4 L62 12 L38.6 12Z" fill={JO.skinShade} opacity="0.5" />}
        >
          <Face id={id} look={JO} spec={{ eye: "round", eyeSize: 1, brow: "thin-arched", nose: "wide", lips: "full", mouth: "closed-smile", lashes: true }} />
          {/* The scalp shows in the partings between the rows; the rows lie flat on it, trimmed to its outline. */}
          <clipPath id={`${id}-scalp`}>
            <path d={JO_SCALP} />
          </clipPath>
          <path d={JO_SCALP} fill={mix(JO.skinShade, "#000000", 0.2)} />
          <g clipPath={`url(#${id}-scalp)`}>
            {rows.map((d) => (
              <Braid key={d} d={d} color={JO.hair} tint={JO.hairLight} width={1.45} cap="butt" />
            ))}
          </g>
          {/* Edges laid at the temples. */}
          <path d="M39.6 20.4 q1.4 0.4 0.8 1.6 q-0.6 0.9 0.6 1.3 M61.4 20.6 q-1.2 0.4 -0.7 1.5 q0.5 0.9 -0.5 1.3" stroke={JO.hair} strokeWidth="0.45" fill="none" strokeLinecap="round" />
          {/* The bow where the braids gather. */}
          <path d="M42.6 10.4 C40 7 37 7.4 37.4 9.8 C37.8 11.6 40.6 11.6 42.6 10.4Z M42.6 10.4 C41.8 13.8 39.4 15.4 38.2 14 C37.2 12.8 39.6 11 42.6 10.4Z" fill={JO_KIT.bow} />
          <path d="M42.4 10.6 C40.4 9 38.6 8.8 38.2 9.6 M42.4 10.6 C41 12.4 39.6 13.4 38.8 13.2" stroke={JO_KIT.bowShade} strokeWidth="0.45" fill="none" />
          <circle cx="42.7" cy="10.5" r="1.2" fill={JO_KIT.bowShade} />
          {/* Big round tortoiseshell glasses. */}
          <g fill="none">
            <circle cx="46.2" cy="25.5" r="4.4" fill="#ffffff" fillOpacity="0.07" stroke={JO_KIT.tortoise} strokeWidth="1.05" />
            <circle cx="55.9" cy="25.5" r="4.1" fill="#ffffff" fillOpacity="0.07" stroke={JO_KIT.tortoise} strokeWidth="1.05" />
            <circle cx="46.2" cy="25.5" r="4.4" stroke={JO_KIT.tortoiseLight} strokeWidth="0.5" strokeDasharray="2.6 1.1 0.8 1.6 3.2 0.9 1.4 2.2" opacity="0.6" />
            <circle cx="55.9" cy="25.5" r="4.1" stroke={JO_KIT.tortoiseLight} strokeWidth="0.5" strokeDasharray="1.8 2.4 3 0.9 0.7 1.5 2.2 1.2" opacity="0.6" />
            <path d="M50.6 24.6 Q51.2 24 51.8 24.6" stroke={JO_KIT.tortoise} strokeWidth="1" />
            <path d="M41.8 25 L39.4 24.6 M60 25 L61.6 24.6" stroke={JO_KIT.tortoise} strokeWidth="0.9" />
            <path d="M43.2 23.4 A3.4 3.4 0 0 1 45.6 22" stroke="#ffffff" strokeWidth="0.5" opacity="0.6" strokeLinecap="round" />
            <path d="M53.2 23.4 A3.2 3.2 0 0 1 55.4 22.1" stroke="#ffffff" strokeWidth="0.45" opacity="0.45" strokeLinecap="round" />
          </g>
          <Hoop x={38.8} y={32.6} r={1.9} gold={JO_KIT.gold} />
          <Hoop x={61.8} y={32.2} r={1.6} gold={JO_KIT.gold} />
        </Head>
      </g>
      <Leg cls="p-leg p-leg-front" side="front" look={JO} id={id} sock={sock} shoe={sneaker(JOINT.frontLegX, false)} thigh={<HemShadow id={id} x={JOINT.frontLegX} y={96} />} />
      {/* The pleated skirt, over both legs; it moves with the body. */}
      <g className="p-skirt" style={BODY}>
        <path d="M38.8 67.4 L62.4 67.4 L71.6 96.4 Q61 99.4 50.6 97.8 Q40 99.4 29.6 96.4Z" fill={`url(#${id}-shell)`} />
        {[33.4, 41.8, 50.6, 59.4, 67.6].map((x) => (
          <g key={x}>
            <path d={`M${n(50.6 + (x - 50.6) * 0.6)} 73 L${n(x - 2.1)} 97.6 Q${x} 98.4 ${n(x + 2.1)} 97.6Z`} fill={JO_KIT.white} opacity={x > 55 ? 0.82 : 0.95} />
            <path d={`M${n(50.6 + (x - 50.6) * 0.6 + 0.4)} 73 L${n(x + 2.4)} 97.4`} stroke={JO_KIT.shellShade} strokeWidth="0.55" opacity="0.8" />
          </g>
        ))}
        <path d="M38.8 67.4 L62.4 67.4 L62.8 70.6 L38.4 70.6Z" fill={JO_KIT.shellShade} />
        <path d="M38.6 68.2 L62.6 68.2" stroke={JO_KIT.white} strokeWidth="0.7" />
        <path d="M70 92 L71.4 96" stroke={RIM} strokeWidth="0.5" opacity="0.2" />
      </g>
      <g className="p-body p-front" style={BODY}>
        <Arm cls="p-arm p-arm-front" side="front" look={JO} id={id} hand={<PomPom x={JOINT.frontArmX} y={91} back={false} />} hideHand />
      </g>
    </Frame>
  );
}

/** The shadow a hem throws across the thigh just under it. */
function HemShadow({ id, x, y }: { id: string; x: number; y: number }) {
  return <ellipse cx={x} cy={n(y + 0.8)} rx="7.8" ry="3.4" fill={aoFill(id)} />;
}

/* ── Jordyn: volleyball ─────────────────────────────────────────── */

const JD: Look = {
  skin: "#6b4229",
  skinShade: "#52301c",
  skinLight: "#8c6045",
  hair: "#120c0a",
  hairLight: "#3a2a22",
  iris: "#241611",
  lip: "#64362a",
  lipLight: "#94594a",
};
const JD_KIT = { jersey: "#7c3aed", jerseyShade: "#5420b8", white: "#f8fafc", whiteShade: "#cbd5e1", shorts: "#1f2937", shortsShade: "#05070b" };
const JD_W = 0.94;

/**
 * A loose wave of hair from (x0, y0) to (x1, y1): `count` bends of `amp`
 * either side, smooth all the way down. Plain arithmetic, so it prints the
 * same on the server and in the browser.
 */
function wave(x0: number, y0: number, x1: number, y1: number, amp: number, count: number): string {
  const dx = (x1 - x0) / count;
  const dy = (y1 - y0) / count;
  let d = `M${n(x0)} ${n(y0)} Q${n(x0 + dx / 2 + amp)} ${n(y0 + dy / 2)} ${n(x0 + dx)} ${n(y0 + dy)}`;
  for (let i = 2; i <= count; i += 1) d += ` T${n(x0 + dx * i)} ${n(y0 + dy * i)}`;
  return d;
}

// Braids that fall down her back to the waist: plaited to the shoulder (`b`), then
// loose waves from `s` to `e`. Written out so both sides render the same.
const JD_BACK = [
  { b: "M41 14 C35.6 22 34.4 34 34 46", s: [34, 46], e: [32.4, 68] },
  { b: "M43 12 C38 22 37 34 36.6 46", s: [36.6, 46], e: [35.6, 72] },
  { b: "M45.6 10.6 C41.4 22 40.4 36 40 48", s: [40, 48], e: [39.4, 74] },
  { b: "M56.4 10.8 C61 22 61.4 36 61.4 48", s: [61.4, 48], e: [61.8, 73] },
  { b: "M58.8 12.4 C63.6 22 64.4 34 64.6 46", s: [64.6, 46], e: [65.8, 70] },
  { b: "M60.4 14.4 C65.6 22 66.8 34 67.4 44", s: [67.4, 44], e: [68.8, 65] },
];
// The ones that fall in front of her shoulders, framing her face.
const JD_FRONT = [
  { b: "M41.4 16.6 C39 22 38.6 30 39.6 37", s: [39.6, 37], e: [39.4, 58] },
  { b: "M43.2 14.4 C41.6 22 41.4 30 42.4 38", s: [42.4, 38], e: [42.6, 61] },
  { b: "M58.2 14.4 C60.2 22 60.6 30 59.8 38", s: [59.8, 38], e: [60, 60] },
  { b: "M60.4 17 C62.6 24 63 32 62.2 39", s: [62.2, 39], e: [62.4, 57] },
];

// How each braid's loose end falls: per strand, how far it bends (its sign sets the
// phase), how many bends, and how wide. Written out so neighbors never move together.
const JD_LOOSE: { amp: number; count: number; w: number }[][] = [
  [{ amp: 0.9, count: 4, w: 0.8 }, { amp: -1.2, count: 3, w: 0.7 }, { amp: 0.6, count: 4, w: 0.65 }],
  [{ amp: -1.1, count: 3, w: 0.75 }, { amp: 0.7, count: 4, w: 0.8 }, { amp: -1.3, count: 3, w: 0.6 }],
  [{ amp: 1.3, count: 3, w: 0.7 }, { amp: -0.8, count: 4, w: 0.75 }, { amp: 1.0, count: 4, w: 0.65 }],
  [{ amp: -0.7, count: 4, w: 0.8 }, { amp: 1.1, count: 3, w: 0.7 }, { amp: -0.9, count: 4, w: 0.6 }],
  [{ amp: 1.0, count: 4, w: 0.75 }, { amp: -1.3, count: 3, w: 0.8 }, { amp: 0.6, count: 3, w: 0.65 }],
  [{ amp: -1.2, count: 3, w: 0.7 }, { amp: 0.8, count: 4, w: 0.75 }, { amp: -0.6, count: 4, w: 0.6 }],
  [{ amp: 0.8, count: 3, w: 0.75 }, { amp: -1.0, count: 4, w: 0.7 }, { amp: 1.2, count: 3, w: 0.6 }],
  [{ amp: -1.3, count: 4, w: 0.8 }, { amp: 0.6, count: 3, w: 0.7 }, { amp: -0.9, count: 3, w: 0.65 }],
  [{ amp: 0.7, count: 4, w: 0.7 }, { amp: -1.1, count: 3, w: 0.8 }, { amp: 1.3, count: 4, w: 0.6 }],
  [{ amp: -0.9, count: 3, w: 0.75 }, { amp: 1.2, count: 4, w: 0.7 }, { amp: -0.7, count: 3, w: 0.65 }],
];

/**
 * One of Jordyn's braids: plaited from the scalp to the shoulder, then the
 * loose end parts into a few thin wavy strands that fan a little, each
 * bending its own way.
 */
function JordynBraid({ b, s, e, front, i }: { b: string; s: number[]; e: number[]; front: boolean; i: number }) {
  const w = front ? 1.9 : 2.2;
  const lit = mix(JD.hair, JD.hairLight, 0.45);
  return (
    <g>
      {JD_LOOSE[i].map((st, j) => (
        <path
          key={j}
          d={wave(s[0] + (j - 1) * 0.5, s[1], e[0] + (j - 1) * 1.3, e[1] - j * 1.4, st.amp, st.count)}
          stroke={j === 1 ? lit : JD.hair}
          strokeWidth={st.w}
          fill="none"
          strokeLinecap="round"
        />
      ))}
      <Braid d={b} color={JD.hair} tint={JD.hairLight} width={w} />
    </g>
  );
}

export function Jordyn({ pose = "idle", facing = 1, className }: Props) {
  const id = useArtId();
  const shorts = { fill: `url(#${id}-shorts)`, shade: "#000000", to: 97, hem: "#374151" };
  const sock = { fill: JD_KIT.white, shade: "#dbe2ea", from: 137 };
  const pad = { fill: JD_KIT.white, shade: JD_KIT.whiteShade };
  const shoe = (x: number, back: boolean) => <Sneaker x={x} upper={JD_KIT.white} shade="#c8d1dc" midsole={JD_KIT.jersey} outsole="#3b0764" accent={JD_KIT.jersey} lace="#e2e8f0" back={back} />;
  const sleeve = (x: number, back: boolean) => capSleeve(x, JD_W, back ? JD_KIT.jerseyShade : `url(#${id}-jersey)`, mix(JD_KIT.jerseyShade, "#000000", 0.2), 51, JD_KIT.white);
  const defs = (
    <>
      <SkinDefs id={id} look={JD} />
      <defs>
        <ClothGradient id={`${id}-jersey`} base={JD_KIT.jersey} shade={JD_KIT.jerseyShade} />
        <ClothGradient id={`${id}-jerseyBody`} base={JD_KIT.jersey} shade={JD_KIT.jerseyShade} from={31} to={70} />
        <ClothGradient id={`${id}-shorts`} base={JD_KIT.shorts} light="#334155" shade={JD_KIT.shortsShade} />
      </defs>
    </>
  );
  return (
    <Frame game="volleyball" art={id} name="Jordyn" pose={pose} facing={facing} className={className} defs={defs}>
      <Leg cls="p-leg p-leg-back" side="back" look={JD} id={id} w={JD_W} shorts={shorts} kneePad={pad} sock={sock} shoe={shoe(JOINT.backLegX, true)} thigh={<HemShadow id={id} x={JOINT.backLegX} y={86.6} />} />
      <g className="p-body" style={BODY}>
        {/* The mass of her hair down her back, tapering where the braids work loose, then the braids over it. */}
        <path d="M40.6 13 C34.4 22 33 36 32.6 50 C32.4 57 32.2 62 33.4 66.6 C35 67.4 37 65.2 38.6 62 L62.6 62 C64 64.6 66 66 67.8 64.6 C69 59 68 52 67.8 44 C67.4 32 65 20 60.6 13Z" fill={mix(JD.hair, "#000000", 0.3)} />
        {JD_BACK.map((b, i) => (
          <JordynBraid key={b.b} {...b} front={false} i={i} />
        ))}
        <Arm cls="p-arm p-arm-back" side="back" look={JD} id={id} w={JD_W} upper={sleeve(JOINT.backArmX, true)} />
        <Neck id={id} look={JD} />
        {/* The skin in the V of the neckline; the jersey covers the rest. */}
        <path d="M45.4 33.4 L50.6 43 L55.8 33.4Z" fill={limbFill(id)} />
        {/* Jersey: purple, a white V at the neck, a white band, her number. */}
        <path d={torso(0.97, 42.4)} fill={`url(#${id}-jerseyBody)`} />
        <path d="M45.4 33.4 L50.6 42.8 L55.8 33.4" stroke={JD_KIT.white} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        <path d="M38.8 62.6 L62.4 62.6 L62.5 65.6 L38.7 65.6Z" fill={JD_KIT.white} />
        <path d="M38.7 64.9 L62.5 64.9" stroke={JD_KIT.whiteShade} strokeWidth="0.55" />
        <path d="M40.6 50.6 C43 52.4 46.4 52.6 49 51.6 M52.4 51.6 C55 52.6 58.2 52.4 60.6 50.4" stroke={JD_KIT.jerseyShade} strokeWidth="0.5" fill="none" opacity="0.55" strokeLinecap="round" />
        <path d="M37.4 44 C38.4 50 39 56 39.2 62" stroke="#ffffff" strokeWidth="0.9" opacity="0.2" strokeLinecap="round" />
        <path d="M63 45 C62.2 52 61.6 60 61.8 64.6" stroke={RIM} strokeWidth="0.5" opacity="0.2" />
        {/* Soft shade where the near arm meets the body. */}
        <ellipse cx={n(JOINT.frontArmX - 3.4)} cy="46" rx="2.4" ry="6.5" fill={aoFill(id)} />
        <Head
          id={id}
          look={JD}
          jaw="long"
          back={<path d="M38.2 24 C36.8 13 42.6 7.6 50.6 7.6 C58.6 7.6 64.2 13 63 24 L60.6 19 L40.4 19Z" fill={mix(JD.hair, "#000000", 0.3)} />}
          shade={<path d="M39 21.6 C41 17.6 45 15.4 50.4 15.6 C55.8 15.4 59.8 17.6 61.6 21.8 L62 12 L38.6 12Z" fill={JD.skinShade} opacity="0.55" />}
        >
          <Face id={id} look={JD} spec={{ eye: "almond", eyeSize: 1.1, brow: "thin-arched", nose: "medium", lips: "full", mouth: "soft", lashes: true }} />
          {/* A middle part, the braids swept from it to frame her face. */}
          <path d="M39.4 22.6 C38.4 14 43.4 8.4 50.6 8.4 C57.8 8.4 62.8 14 61.8 22.6 C60.8 18.4 58.2 15.4 54.4 14.6 C52.8 14.2 51.4 13.4 50.8 12 C50.2 13.4 48.8 14.2 47 14.6 C43 15.4 40.4 18.4 39.4 22.6Z" fill={JD.hair} />
          <path d="M50.8 8.6 L50.8 12.2" stroke={mix(JD.skinShade, "#000000", 0.1)} strokeWidth="0.7" strokeLinecap="round" />
          {["M50 9 C46 9.8 42.4 12.6 40.6 17.6", "M49.4 11.2 C46.2 12 43.6 14 42 17", "M51.6 9 C55.6 9.8 59.2 12.6 61 17.6", "M52.2 11.2 C55.4 12 58 14 59.6 17"].map((d) => (
            <path key={d} d={d} stroke={JD.hairLight} strokeWidth="0.55" fill="none" opacity="0.8" strokeLinecap="round" />
          ))}
          <path d="M42.6 13.4 C45 10.8 47.6 9.8 49.6 9.6" stroke="#7a6a60" strokeWidth="1.1" fill="none" opacity="0.4" strokeLinecap="round" />
        </Head>
        {/* In figure space again: the braids in front of her near shoulder. */}
        {JD_FRONT.slice(0, 2).map((b, i) => (
          <JordynBraid key={b.b} {...b} front i={JD_BACK.length + i} />
        ))}
      </g>
      <Leg cls="p-leg p-leg-front" side="front" look={JD} id={id} w={JD_W} shorts={shorts} kneePad={pad} sock={sock} shoe={shoe(JOINT.frontLegX, false)} thigh={<HemShadow id={id} x={JOINT.frontLegX} y={86.6} />} />
      <g className="p-skirt" style={BODY}>
        <path d={hem(0.97, 65.2, 86.6)} fill={`url(#${id}-jerseyBody)`} />
        <path d="M37.6 85.2 C45 86.4 56 86.4 63.4 85.2" stroke={JD_KIT.jerseyShade} strokeWidth="0.45" fill="none" />
        <text x="50.6" y="76.4" textAnchor="middle" fontSize="9.4" fontWeight="800" fill={JD_KIT.white} fontFamily="ui-sans-serif, system-ui, sans-serif" className="p-text" style={{ transformOrigin: "50.6px 73px" }}>
          7
        </text>
        <path d="M62.2 67 L62.9 86" stroke={RIM} strokeWidth="0.5" opacity="0.2" />
      </g>
      <g className="p-body p-front" style={BODY}>
        <Arm cls="p-arm p-arm-front" side="front" look={JD} id={id} w={JD_W} upper={sleeve(JOINT.frontArmX, false)} />
        {JD_FRONT.slice(2).map((b, i) => (
          <JordynBraid key={b.b} {...b} front i={JD_BACK.length + 2 + i} />
        ))}
      </g>
    </Frame>
  );
}

/* ── Rayla: soccer ──────────────────────────────────────────────── */

const RY: Look = {
  skin: "#5e3b2a",
  skinShade: "#45291c",
  skinLight: "#80583f",
  hair: "#1a100c",
  hairLight: "#43302a",
  iris: "#241611",
  lip: "#5f3328",
  lipLight: "#8f5548",
};
const RY_KIT = {
  kit: "#dc2626",
  kitShade: "#9b1717",
  white: "#f8fafc",
  shorts: "#1f2937",
  shortsShade: "#05070b",
  frames: "#0f0f12",
  cleat: "#111827",
  gold: "#d4a017",
  /** Some of her braids carry a warm red-brown. */
  tint: "#3a1d19",
  tintLight: "#6a3a30",
};
const RY_W = 1.06;

// Box braids worn down: most fall behind her shoulders, a few in front on each side.
const RY_BACK = [
  { d: "M41.4 14.6 C36.4 24 35.4 40 34.8 62", red: false },
  { d: "M42.8 12.8 C38.6 24 37.6 42 37.2 66", red: true },
  { d: "M44.6 11.4 C41.4 24 40.6 44 40.4 68", red: false },
  { d: "M56.6 11.4 C60.2 24 61 44 61.2 68", red: false },
  { d: "M58.4 12.6 C62.6 24 63.4 42 63.6 66", red: true },
  { d: "M60 14.4 C64.6 24 65.6 40 66.2 62", red: false },
  { d: "M61.2 16.6 C66 26 67.4 40 68 58", red: false },
];
const RY_FRONT = [
  { d: "M40.6 17.2 C38 26 37.4 40 37.6 56", red: false },
  { d: "M42.2 15 C39.8 26 39.4 42 39.6 59", red: true },
  { d: "M58.8 15 C61.4 26 62 42 62 58", red: false },
  { d: "M60.6 17.6 C63.4 26 64 40 64 54", red: true },
];

export function Rayla({ pose = "idle", facing = 1, className }: Props) {
  const id = useArtId();
  const shorts = { fill: `url(#${id}-shorts)`, shade: "#000000", to: 99, hem: "#374151" };
  const sock = { fill: `url(#${id}-sock)`, shade: RY_KIT.kitShade, from: 116, stripe: RY_KIT.white };
  const cleat = (x: number, back: boolean) => (
    <g>
      <Sneaker x={x} upper={RY_KIT.cleat} shade="#000000" midsole="#1f2937" outsole="#9ca3af" accent={RY_KIT.white} lace="#e5e7eb" back={back} />
      <path d={`M${n(x - 4)} 154.4 l0 1 M${n(x + 1.6)} 154.4 l0 1 M${n(x + 7.4)} 154.4 l0 1 M${n(x + 11.6)} 154.4 l0 1`} stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
  const sleeve = (x: number, back: boolean) => capSleeve(x, RY_W, back ? RY_KIT.kitShade : `url(#${id}-kit)`, mix(RY_KIT.kitShade, "#000000", 0.25), 52, RY_KIT.white);
  const braid = (b: { d: string; red: boolean }) => <Braid key={b.d} d={b.d} color={b.red ? RY_KIT.tint : RY.hair} tint={b.red ? RY_KIT.tintLight : RY.hairLight} width={1.8} />;
  const defs = (
    <>
      <SkinDefs id={id} look={RY} />
      <defs>
        <ClothGradient id={`${id}-kit`} base={RY_KIT.kit} shade={RY_KIT.kitShade} />
        <ClothGradient id={`${id}-kitBody`} base={RY_KIT.kit} shade={RY_KIT.kitShade} from={31} to={70} />
        <ClothGradient id={`${id}-sock`} base={RY_KIT.kit} shade={RY_KIT.kitShade} />
        <ClothGradient id={`${id}-shorts`} base={RY_KIT.shorts} light="#334155" shade={RY_KIT.shortsShade} />
      </defs>
    </>
  );
  return (
    <Frame game="soccer" art={id} name="Rayla" pose={pose} facing={facing} className={className} defs={defs}>
      <Leg cls="p-leg p-leg-back" side="back" look={RY} id={id} w={RY_W} shorts={shorts} sock={sock} shoe={cleat(JOINT.backLegX, true)} thigh={<HemShadow id={id} x={JOINT.backLegX} y={87} />} />
      <g className="p-body" style={BODY}>
        <path d="M40.8 14 C35.6 24 34.4 40 34 62 L67.6 62 C67 40 65.6 24 60.6 14Z" fill={mix(RY.hair, "#000000", 0.25)} />
        {RY_BACK.map(braid)}
        <Arm cls="p-arm p-arm-back" side="back" look={RY} id={id} w={RY_W} upper={sleeve(JOINT.backArmX, true)} />
        <path d="M45 32.6 C47.4 31.2 53.8 31.2 56.2 32.6 C53.8 33.8 47.4 33.8 45 32.6Z" fill={mix(RY_KIT.kitShade, "#000000", 0.3)} />
        <Neck id={id} look={RY} />
        {/* Red kit, a white collar, white block letters across the chest. */}
        <path d={torso(1.04)} fill={`url(#${id}-kitBody)`} />
        <path d="M44.8 33.2 C47.2 36 54 36 56.4 33.2" stroke={RY_KIT.white} strokeWidth="1.4" fill="none" />
        <path d="M40.4 50 C43 51.8 46.4 52 49 51.2 M52.4 51.2 C55 52 58.4 51.8 60.8 49.8" stroke={RY_KIT.kitShade} strokeWidth="0.5" fill="none" opacity="0.55" strokeLinecap="round" />
        <path d="M37 44 C38 50 38.6 56 38.8 62" stroke="#ffffff" strokeWidth="0.9" opacity="0.22" strokeLinecap="round" />
        <path d="M63.6 45 C62.8 52 62.2 60 62.4 64" stroke={RIM} strokeWidth="0.5" opacity="0.2" />
        <text x="50.6" y="57.6" textAnchor="middle" fontSize="6" fontWeight="800" fill={RY_KIT.white} fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.8" className="p-text" style={{ transformOrigin: "50.6px 55.5px" }}>
          CITY
        </text>
        {/* A thin gold chain over the collar. */}
        <path d="M47.2 31.2 Q50.6 41.2 54.2 31.2" stroke={RY_KIT.gold} strokeWidth="0.45" fill="none" />
        <circle cx="50.7" cy="36.2" r="0.65" fill={RY_KIT.gold} />
        {/* Soft shade where the near arm meets the body. */}
        <ellipse cx={n(JOINT.frontArmX - 3.4)} cy="46" rx="2.4" ry="6.5" fill={aoFill(id)} />
        <Head
          id={id}
          look={RY}
          jaw="round"
          back={<path d="M38 24 C36.6 13 42.4 7.8 50.6 7.8 C58.8 7.8 64.4 13 63.2 24 L60.6 19 L40.4 19Z" fill={mix(RY.hair, "#000000", 0.25)} />}
          shade={<path d="M39 21.6 C41 17.6 44.6 15.6 48.6 15.4 C52.4 15.4 57.6 16 61.6 21.8 L62 12 L38.6 12Z" fill={RY.skinShade} opacity="0.55" />}
        >
          <Face id={id} look={RY} spec={{ eye: "almond", eyeSize: 0.92, brow: "soft", nose: "wide", lips: "full", mouth: "closed-smile", lashes: true }} />
          {/* Braids from a part just left of center, her edges laid at the temples. */}
          <path d="M39.2 22.6 C38.4 14 43.4 8.6 50.4 8.6 C57.8 8.6 62.8 14 61.8 22.6 C60.8 18.4 57.6 15.6 53.4 14.8 C51.6 14.4 49.8 13.6 48.8 12.2 C48 13.6 46.4 14.4 45 14.8 C42 15.8 40.2 18.6 39.2 22.6Z" fill={RY.hair} />
          <path d="M48.8 8.8 L48.8 12.4" stroke={mix(RY.skinShade, "#000000", 0.1)} strokeWidth="0.7" strokeLinecap="round" />
          {["M48 9.4 C44.6 10.4 41.8 13.2 40.4 17.6", "M47.4 11.4 C44.6 12.4 42.6 14.4 41.6 17", "M49.6 9.2 C54.6 9.8 59 12.6 61 17.6", "M50.4 11.2 C54.2 12 57.4 14 59.4 17", "M50.6 13 C53.6 13.6 56 15 57.4 16.6"].map((d) => (
            <path key={d} d={d} stroke={RY.hairLight} strokeWidth="0.5" fill="none" opacity="0.85" strokeLinecap="round" />
          ))}
          <path d="M42.6 13.2 C45 10.8 47.6 9.8 49.8 9.6" stroke="#7a6a60" strokeWidth="1.1" fill="none" opacity="0.4" strokeLinecap="round" />
          <path d="M39.8 20.2 q1.3 0.5 0.7 1.6 q-0.5 0.9 0.6 1.3 M61.4 20.4 q-1.2 0.5 -0.6 1.5 q0.4 0.9 -0.5 1.3" stroke={RY.hair} strokeWidth="0.45" fill="none" strokeLinecap="round" />
          {/* Chunky black rectangular glasses, big on her face. */}
          <g fill="none" stroke={RY_KIT.frames}>
            <rect x="41.6" y="22.1" width="8.6" height="6.6" rx="1.7" fill="#ffffff" fillOpacity="0.07" strokeWidth="1.3" />
            <rect x="52.1" y="22.1" width="7.9" height="6.4" rx="1.7" fill="#ffffff" fillOpacity="0.07" strokeWidth="1.3" />
            <path d="M50.2 24.2 L52.1 24.2" strokeWidth="1.2" />
            <path d="M41.6 23.6 L39.2 24.2 M60 23.6 L61.6 24" strokeWidth="1.1" strokeLinecap="round" />
          </g>
          <path d="M42.8 24.6 l2 -1.6 M53.2 24.4 l1.8 -1.4" stroke="#ffffff" strokeWidth="0.5" opacity="0.55" strokeLinecap="round" />
          <Hoop x={38.8} y={32.4} r={1.4} gold={RY_KIT.gold} />
          <Hoop x={61.7} y={32} r={1.2} gold={RY_KIT.gold} />
        </Head>
        {RY_FRONT.slice(0, 2).map(braid)}
      </g>
      <Leg cls="p-leg p-leg-front" side="front" look={RY} id={id} w={RY_W} shorts={shorts} sock={sock} shoe={cleat(JOINT.frontLegX, false)} thigh={<HemShadow id={id} x={JOINT.frontLegX} y={87} />} />
      <g className="p-skirt" style={BODY}>
        <path d={hem(1.04, 64, 87)} fill={`url(#${id}-kitBody)`} />
        <path d="M37.4 85.6 C45 86.8 56 86.8 63.8 85.6" stroke={RY_KIT.kitShade} strokeWidth="0.45" fill="none" />
        <path d="M62.6 66 L63.6 86" stroke={RIM} strokeWidth="0.5" opacity="0.2" />
      </g>
      <g className="p-body p-front" style={BODY}>
        <Arm cls="p-arm p-arm-front" side="front" look={RY} id={id} w={RY_W} upper={sleeve(JOINT.frontArmX, false)} />
        {RY_FRONT.slice(2).map(braid)}
      </g>
    </Frame>
  );
}

/* ── Match athletes: a boy or a girl, in a side's color ─────────── */

/**
 * In a two-player match each player picks a boy or a girl to play as, drawn
 * in their side's color with their player number. They are no one in
 * particular (the team are real people, and a match is the players' own),
 * on the same rig as the team, so they run, stride and do the court's move
 * the way the teammate who lives there does.
 */
export type AthleteKind = "boy" | "girl";

const ATHLETE: Look = {
  skin: "#b07a52",
  skinShade: "#8e5d3c",
  skinLight: "#c8946c",
  hair: "#2a1b14",
  hairLight: "#5a4032",
  iris: "#2b1a12",
  lip: "#87503d",
  lipLight: "#a46752",
};

export function Athlete({
  kind,
  side,
  game,
  name,
  pose = "idle",
  facing = 1,
  className,
}: Props & { kind: AthleteKind; side: 0 | 1; game: CourtGameId; name: string }) {
  const id = useArtId();
  const kit = side === 0 ? "#2563eb" : "#ea580c";
  const kitShade = side === 0 ? "#1e40af" : "#9a3412";
  const white = "#f8fafc";
  const girl = kind === "girl";
  const w = girl ? 0.98 : 1.04;
  const shorts = { fill: `url(#${id}-shorts)`, shade: "#000000", to: girl ? 97 : 101, hem: "#374151" };
  const sock = { fill: `url(#${id}-sock)`, shade: kitShade, from: 118, stripe: white };
  const shoe = (x: number, back: boolean) => <Sneaker x={x} upper="#111827" shade="#000000" midsole={white} outsole="#9ca3af" accent={kit} lace="#e5e7eb" back={back} />;
  const sleeve = (x: number, back: boolean) => capSleeve(x, w, back ? kitShade : `url(#${id}-kit)`, mix(kitShade, "#000000", 0.25), 52, white);
  const hairBack = mix(ATHLETE.hair, "#000000", 0.25);
  const defs = (
    <>
      <SkinDefs id={id} look={ATHLETE} />
      <defs>
        <ClothGradient id={`${id}-kit`} base={kit} shade={kitShade} />
        <ClothGradient id={`${id}-kitBody`} base={kit} shade={kitShade} from={31} to={70} />
        <ClothGradient id={`${id}-sock`} base={kit} shade={kitShade} />
        <ClothGradient id={`${id}-shorts`} base="#1f2937" light="#334155" shade="#05070b" />
      </defs>
    </>
  );
  return (
    <Frame game={game} art={id} name={name} pose={pose} facing={facing} className={className} defs={defs}>
      <Leg cls="p-leg p-leg-back" side="back" look={ATHLETE} id={id} w={w} shorts={shorts} sock={sock} shoe={shoe(JOINT.backLegX, true)} thigh={<HemShadow id={id} x={JOINT.backLegX} y={87} />} />
      <g className="p-body" style={BODY}>
        {girl && (
          <>
            {/* A high ponytail, falling behind the far shoulder, with a band in the side's color. */}
            <path d="M44.6 9.6 C38.4 10.4 35.2 16.6 35.4 25 C35.6 33 37 40.2 38.8 45.4 C39.6 38.4 40.6 30.6 42.2 23.8 C43.2 19 44.2 13.8 44.6 9.6Z" fill={ATHLETE.hair} />
            <path d="M42.6 13 C39.6 18.6 38.6 27 38.8 36 M41 15.6 C38.6 22 38 30 38.4 39" stroke={ATHLETE.hairLight} strokeWidth="0.45" fill="none" opacity="0.8" strokeLinecap="round" />
          </>
        )}
        <Arm cls="p-arm p-arm-back" side="back" look={ATHLETE} id={id} w={w} upper={sleeve(JOINT.backArmX, true)} />
        <path d="M45 32.6 C47.4 31.2 53.8 31.2 56.2 32.6 C53.8 33.8 47.4 33.8 45 32.6Z" fill={mix(kitShade, "#000000", 0.3)} />
        <Neck id={id} look={ATHLETE} w={girl ? 1 : 1.12} />
        {/* The jersey: the side's color, a white collar and the player's number. */}
        <path d={torso(girl ? 0.98 : 1.06)} fill={`url(#${id}-kitBody)`} />
        <path d="M44.8 33.2 C47.2 36 54 36 56.4 33.2" stroke={white} strokeWidth="1.4" fill="none" />
        <path d="M37 44 C38 50 38.6 56 38.8 62" stroke="#ffffff" strokeWidth="0.9" opacity="0.22" strokeLinecap="round" />
        <path d="M63.6 45 C62.8 52 62.2 60 62.4 64" stroke={RIM} strokeWidth="0.5" opacity="0.2" />
        <text x="50.6" y="56.4" textAnchor="middle" fontSize="10" fontWeight="800" fill={white} fontFamily="ui-sans-serif, system-ui, sans-serif" className="p-text" style={{ transformOrigin: "50.6px 53px" }}>
          {side + 1}
        </text>
        <ellipse cx={n(JOINT.frontArmX - 3.4)} cy="46" rx="2.4" ry="6.5" fill={aoFill(id)} />
        <Head
          id={id}
          look={ATHLETE}
          jaw={girl ? "round" : "long"}
          back={<path d="M38.6 24 C37.4 14 42.6 7.6 50.6 7.6 C58.6 7.6 63.6 13.2 62.6 24 L61 20 L40 20Z" fill={hairBack} />}
          shade={<path d="M39 21.6 C41 17.6 44.6 15.6 48.6 15.4 C52.4 15.4 57.6 16 61.6 21.8 L62 12 L38.6 12Z" fill={ATHLETE.skinShade} opacity="0.5" />}
        >
          <Face id={id} look={ATHLETE} spec={girl ? { eye: "almond", eyeSize: 1, brow: "soft", nose: "medium", lips: "medium", mouth: "smile", lashes: true } : { eye: "almond", eyeSize: 0.96, brow: "straight-thick", nose: "medium", lips: "medium", mouth: "smile" }} />
          {girl ? (
            <>
              {/* Pulled back from a side part, smooth over the crown to the band. */}
              <path d="M39.2 22.6 C38.4 14 43.4 8.6 50.4 8.6 C57.8 8.6 62.8 14 61.8 22.6 C60.4 18 57.4 15.2 53.2 14.6 C50.6 14.2 48 13.2 46.6 11.6 C45.6 13.4 44 14.6 42.4 15.6 C40.8 17.2 39.8 19.6 39.2 22.6Z" fill={ATHLETE.hair} />
              <path d="M46.6 11.6 C49.6 11.4 54.6 12 58.4 14.6 M45.8 12.6 C43.4 14 41.6 16 40.6 18.8" stroke={ATHLETE.hairLight} strokeWidth="0.5" fill="none" opacity="0.8" strokeLinecap="round" />
              <path d="M42.4 11.2 C44.6 9.6 47.4 8.8 50.2 8.8" stroke="#8a7064" strokeWidth="1.1" fill="none" opacity="0.4" strokeLinecap="round" />
              <ellipse cx="44.4" cy="10.4" rx="1.6" ry="1.1" fill={kit} />
            </>
          ) : (
            <>
              {/* A short crop, a little longer on top. */}
              <path d="M39.4 22.4 C38.6 14.4 43.6 8.4 50.6 8.4 C57.8 8.4 62.8 14 61.8 22.2 C61.2 19.6 60.4 18 59 17.2 C55.4 16.2 46.6 16.2 42.2 17.2 C40.8 18 40 19.8 39.4 22.4Z" fill={ATHLETE.hair} />
              <path d="M43 15.4 C46 14 50.4 13.6 54.6 14 M42.4 12.6 C45.6 10.6 50.2 9.8 54.8 10.6 M57.6 12.4 C59.2 13.8 60.2 15.4 60.6 17" stroke={ATHLETE.hairLight} strokeWidth="0.45" fill="none" opacity="0.8" strokeLinecap="round" />
              <path d="M39.6 18 C39.2 20.6 39.4 23 39.8 25.6 C40.4 25.2 40.6 24.2 40.6 23 C40.6 21.2 40.8 19.8 41.4 18.6Z M61.6 18 C62 20.6 61.8 23 61.4 25.4 C60.8 25 60.6 24.2 60.6 23 C60.6 21.2 60.4 19.8 59.8 18.6Z" fill={ATHLETE.hair} opacity="0.92" />
            </>
          )}
        </Head>
      </g>
      <Leg cls="p-leg p-leg-front" side="front" look={ATHLETE} id={id} w={w} shorts={shorts} sock={sock} shoe={shoe(JOINT.frontLegX, false)} thigh={<HemShadow id={id} x={JOINT.frontLegX} y={87} />} />
      <g className="p-skirt" style={BODY}>
        <path d={hem(girl ? 0.98 : 1.06, 64, 86)} fill={`url(#${id}-kitBody)`} />
        <path d="M37.4 84.6 C45 85.8 56 85.8 63.8 84.6" stroke={kitShade} strokeWidth="0.45" fill="none" />
      </g>
      <g className="p-body p-front" style={BODY}>
        <Arm cls="p-arm p-arm-front" side="front" look={ATHLETE} id={id} w={w} upper={sleeve(JOINT.frontArmX, false)} />
      </g>
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

