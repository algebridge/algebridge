"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Archie, the AlgeBridge study buddy: the arch of a bridge with a face.
 *
 * Drawn from the same shapes, colors and outline as the AlgeBridge Hints
 * extension (extension/src/mascot.js), so the site and the extension feel
 * like one product. That file builds him with createElementNS; this one is
 * the same figure as JSX, plus what the site needs on top: blinking, an idle
 * bob, eyes that follow the student's typing, and two more poses (wave and
 * encourage). All motion lives in helper.css and stops under
 * prefers-reduced-motion.
 *
 * Confetti is dots, strips and little squares. The extension's four-point
 * stars are left out on the site, where that shape reads as the "AI" icon.
 */

export type ArchiePose = "idle" | "wave" | "thinking" | "party" | "encourage" | "happy";

/** A small drawn mark that floats up beside him in the happy pose. */
export type ArchieMark = "heart" | "star";

/** Where the eyes look, each axis from -1 to 1. Down and to the right is positive. */
export interface Look {
  x: number;
  y: number;
}

const C = {
  body: "#2563eb",
  shine: "#60a5fa",
  line: "#1e3a8a",
  ink: "#0f172a",
  white: "#ffffff",
  cheek: "#f9a8d4",
  amber: "#f59e0b",
  pink: "#ec4899",
  green: "#10b981",
  thought: "#93c5fd",
};
/** Outline width in viewBox units (about 2 px at 96 px). */
const LW = 2.6;

// The arch: a round-topped body, two short legs, an arch opening between.
const BODY =
  "M22 60 C22 32 39 15 60 15 C81 15 98 32 98 60 L98 97 Q98 104 91 104 L81 104 Q74 104 74 97 " +
  "L74 95 C74 88.5 67.7 84 60 84 C52.3 84 46 88.5 46 95 L46 97 Q46 104 39 104 L29 104 Q22 104 22 97 Z";

export function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * True for a moment every few seconds, at uneven gaps and now and then twice
 * in a row, the way people blink. Off under reduced motion.
 */
export function useBlink(enabled: boolean): boolean {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    setClosed(false);
    if (!enabled || reducedMotion()) return;
    let timer = 0;
    const later = (ms: number, fn: () => void) => {
      timer = window.setTimeout(fn, ms);
    };
    const blink = (then: () => void) => {
      setClosed(true);
      later(120, () => {
        setClosed(false);
        then();
      });
    };
    const schedule = () =>
      later(2400 + Math.random() * 3800, () =>
        blink(() => (Math.random() < 0.2 ? later(150, () => blink(schedule)) : schedule()))
      );
    schedule();
    return () => window.clearTimeout(timer);
  }, [enabled]);
  return closed;
}

/** A limb is a round-capped stroke drawn twice: outline, then fill color. */
function Limb({ d, hand }: { d: string; hand?: [number, number] }) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={d} stroke={C.line} strokeWidth={7.6 + LW * 2} />
      <path d={d} stroke={C.body} strokeWidth={7.6} />
      {hand && <circle cx={hand[0]} cy={hand[1]} r={5.6} fill={C.body} stroke={C.line} strokeWidth={LW} />}
    </g>
  );
}

const bitStyle = (delay: number): CSSProperties => ({ ["--d" as string]: `${delay}ms` });

function Dot({ x, y, r, fill, delay }: { x: number; y: number; r: number; fill: string; delay: number }) {
  return <circle className="archie-bit" cx={x} cy={y} r={r} fill={fill} style={bitStyle(delay)} />;
}

/** The group takes the pop; the shape keeps its own rotation. */
function Bit({ x, y, w, h, angle, fill, delay }: { x: number; y: number; w: number; h: number; angle: number; fill: string; delay: number }) {
  return (
    <g className="archie-bit" style={bitStyle(delay)}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={Math.min(h, w) / 2.4} fill={fill} transform={`rotate(${angle} ${x} ${y})`} />
    </g>
  );
}

function Confetti() {
  return (
    <g className="archie-confetti">
      <Bit x={13} y={22} w={7} h={7} angle={20} fill={C.amber} delay={0} />
      <Dot x={30} y={7} r={2.6} fill={C.pink} delay={80} />
      <Bit x={91} y={8} w={8} h={3.2} angle={-30} fill={C.green} delay={140} />
      <Bit x={108} y={22} w={6} h={6} angle={-15} fill={C.body} delay={60} />
      <Dot x={5} y={46} r={2.4} fill={C.green} delay={200} />
      <Bit x={115} y={52} w={7} h={3} angle={40} fill={C.pink} delay={120} />
      <Dot x={9} y={80} r={2.2} fill={C.body} delay={260} />
      <Bit x={111} y={84} w={5.5} h={5.5} angle={30} fill={C.amber} delay={180} />
      <Dot x={60} y={5} r={2} fill={C.amber} delay={220} />
    </g>
  );
}

/** A heart or a star that pops up beside him and floats away (helper.css). */
function Mark({ mark }: { mark: ArchieMark }) {
  return (
    <g className="archie-mark">
      {mark === "heart" ? (
        <path
          d="M104 25.5 C97 20.5 94.5 16.6 94.5 13.4 C94.5 10.6 96.6 8.6 99.1 8.6 C101.3 8.6 102.9 9.9 104 11.6 C105.1 9.9 106.7 8.6 108.9 8.6 C111.4 8.6 113.5 10.6 113.5 13.4 C113.5 16.6 111 20.5 104 25.5 Z"
          fill={C.pink}
          stroke={C.line}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M104 6.5 L106.6 12.2 L112.8 12.9 L108.2 17.1 L109.5 23.2 L104 20.1 L98.5 23.2 L99.8 17.1 L95.2 12.9 L101.4 12.2 Z"
          fill={C.amber}
          stroke={C.line}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

function Eyes({ pose, look, closed }: { pose: ArchiePose; look?: Look | null; closed: boolean }) {
  if (pose === "party" || pose === "happy") {
    // Happy, squeezed shut.
    return (
      <g>
        {[47, 73].map((x) => (
          <path key={x} d={`M${x - 6} 50 Q${x} 42.5 ${x + 6} 50`} fill="none" stroke={C.ink} strokeWidth={3.4} strokeLinecap="round" />
        ))}
      </g>
    );
  }
  if (closed) {
    return (
      <g>
        {[47, 73].map((x) => (
          <path key={x} d={`M${x - 6} 48.5 Q${x} 52.5 ${x + 6} 48.5`} fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
        ))}
      </g>
    );
  }
  const rest = pose === "thinking" ? { x: 1.6, y: -2.2 } : pose === "encourage" ? { x: 0, y: 0.6 } : { x: 0.6, y: 0.8 };
  const at = look ? { x: Math.max(-1, Math.min(1, look.x)) * 2, y: Math.max(-1, Math.min(1, look.y)) * 2.5 } : rest;
  return (
    <g>
      {[47, 73].map((x) => (
        <ellipse key={x} cx={x} cy={48} rx={6.4} ry={7.2} fill={C.white} />
      ))}
      <g className="archie-pupils" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
        {[47, 73].map((x) => (
          <g key={x}>
            <circle cx={x} cy={48} r={4.3} fill={C.ink} />
            <circle cx={x + 1.5} cy={46.4} r={1.35} fill={C.white} />
          </g>
        ))}
      </g>
    </g>
  );
}

function Mouth({ pose }: { pose: ArchiePose }) {
  if (pose === "party") {
    return (
      <g>
        <path d="M51 59.5 Q60 61.5 69 59.5 Q68 71 60 71 Q52 71 51 59.5 Z" fill={C.ink} strokeLinejoin="round" />
        <path d="M55 67.6 Q60 64.6 65 67.6 Q63 70.6 60 70.6 Q57 70.6 55 67.6 Z" fill="#fb7185" />
      </g>
    );
  }
  if (pose === "thinking") {
    return <path d="M52.5 62 Q57 64.8 61.5 61.8" fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round" />;
  }
  if (pose === "encourage") {
    return <path d="M52.5 60 Q60 67.5 67.5 60" fill="none" stroke={C.ink} strokeWidth={3.2} strokeLinecap="round" />;
  }
  if (pose === "happy") {
    return <path d="M51 59.5 Q60 70 69 59.5" fill="none" stroke={C.ink} strokeWidth={3.4} strokeLinecap="round" />;
  }
  return <path d="M53.5 60.5 Q60 66.5 66.5 60.5" fill="none" stroke={C.ink} strokeWidth={3.2} strokeLinecap="round" />;
}

/** The arms that sit behind the body, by pose. */
function BackArms({ pose }: { pose: ArchiePose }): ReactNode {
  const leftDown = <Limb d="M25 70 Q17 76 15 85" hand={[15, 86]} />;
  switch (pose) {
    case "party":
      return (
        <>
          <Limb d="M26 64 Q15 56 12 41" hand={[11.5, 39.5]} />
          <Limb d="M94 64 Q105 56 108 41" hand={[108.5, 39.5]} />
        </>
      );
    case "wave":
      return (
        <>
          {leftDown}
          <g className="archie-wave-arm">
            <Limb d="M95 66 Q105 60 109 48" hand={[109.5, 46.5]} />
          </g>
        </>
      );
    case "encourage":
      // A small fist pump: "you've got this".
      return (
        <>
          {leftDown}
          <g className="archie-pump-arm">
            <Limb d="M95 70 Q107 70 107.5 57" hand={[107.5, 54.5]} />
          </g>
        </>
      );
    case "thinking":
      return leftDown;
    case "happy":
      // Both hands up a little: "aw, thanks".
      return (
        <>
          <Limb d="M26 67 Q16 67 13 58" hand={[12.5, 56]} />
          <Limb d="M94 67 Q104 67 107 58" hand={[107.5, 56]} />
        </>
      );
    default:
      return (
        <>
          {leftDown}
          <Limb d="M95 70 Q103 76 105 85" hand={[105, 86]} />
        </>
      );
  }
}

/**
 * The full figure. `blink` and `bob` turn on the life; leave them off for a
 * still picture. Change `burst` to replay a pose's one-off motion (a second
 * correct answer in a row gets a second hop and fresh confetti).
 */
export function Archie({
  pose = "idle",
  size = 96,
  look = null,
  blink = false,
  bob = false,
  shadow = true,
  burst = 0,
  mark = null,
  className = "",
}: {
  pose?: ArchiePose;
  size?: number;
  look?: Look | null;
  blink?: boolean;
  bob?: boolean;
  shadow?: boolean;
  burst?: number;
  /** In the happy pose, a heart or a star floats up beside him. */
  mark?: ArchieMark | null;
  className?: string;
}) {
  const closed = useBlink(blink && pose !== "party" && pose !== "happy");
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`archie archie-pose-${pose} ${bob ? "archie-bob" : ""} ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {shadow && <ellipse className="archie-shadow" cx={60} cy={110} rx={31} ry={4.2} fill={C.ink} opacity={0.08} />}
      {pose === "party" && <Confetti key={`c${burst}`} />}
      {pose === "happy" && mark && <Mark key={`m${burst}`} mark={mark} />}
      {pose === "thinking" && (
        <g className="archie-think">
          <circle className="archie-tdot" cx={99} cy={24} r={2.6} fill={C.thought} style={bitStyle(0)} />
          <circle className="archie-tdot" cx={106} cy={15} r={3.4} fill={C.thought} style={bitStyle(180)} />
          <circle className="archie-tdot" cx={114.5} cy={6.5} r={4.2} fill={C.thought} style={bitStyle(360)} />
        </g>
      )}
      <g className="archie-fig">
        <g className="archie-body" key={`b${pose}${burst}`}>
          <BackArms pose={pose} />
          <path d={BODY} fill={C.body} stroke={C.line} strokeWidth={LW} strokeLinejoin="round" />
          {/* Shine along the top left of the dome. */}
          <path d="M31.5 47 C33 35 40.5 26 50 23" fill="none" stroke={C.shine} strokeWidth={4.2} strokeLinecap="round" />
          <ellipse cx={36} cy={59.5} rx={4.6} ry={2.9} fill={C.cheek} />
          <ellipse cx={84} cy={59.5} rx={4.6} ry={2.9} fill={C.cheek} />
          {pose === "encourage" && (
            // Brows lifted in the middle: warm, on your side.
            <g fill="none" stroke={C.ink} strokeWidth={2.6} strokeLinecap="round">
              <path d="M41 37.5 Q46 34.6 51.5 35.6" />
              <path d="M68.5 35.6 Q74 34.6 79 37.5" />
            </g>
          )}
          <Eyes pose={pose} look={look} closed={closed} />
          <Mouth pose={pose} />
          {pose === "thinking" && <Limb d="M96 78 Q96 90 82 84 Q77 82 76 79" hand={[73, 73]} />}
        </g>
      </g>
    </svg>
  );
}

export type FaceMood = "idle" | "thinking" | "happy";

/**
 * Archie up close on his blue dome: the round button, chat avatars and small
 * marks. Same eyes as the full figure; cheeks only where they can show.
 */
export function ArchieFace({
  size = 26,
  mood = "idle",
  look = null,
  blink = false,
  className = "",
}: {
  size?: number;
  mood?: FaceMood;
  look?: Look | null;
  blink?: boolean;
  className?: string;
}) {
  const closed = useBlink(blink && mood !== "happy");
  const rest = mood === "thinking" ? { x: 1.2, y: -1.8 } : { x: 0.6, y: 0.9 };
  const at = look ? { x: Math.max(-1, Math.min(1, look.x)) * 1.6, y: Math.max(-1, Math.min(1, look.y)) * 2 } : rest;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`archie-face ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={24} cy={24} r={24} fill={C.body} />
      <path d="M8.5 19 C9.6 13.5 13 9.4 17.6 7.6" fill="none" stroke={C.shine} strokeWidth={3} strokeLinecap="round" />
      {size >= 26 &&
        [9.5, 38.5].map((x) => <ellipse key={x} cx={x} cy={29} rx={3} ry={1.9} fill={C.cheek} />)}
      {mood === "happy" ? (
        [17, 31].map((x) => (
          <path key={x} d={`M${x - 5} 22 Q${x} 15.5 ${x + 5} 22`} fill="none" stroke={C.ink} strokeWidth={2.8} strokeLinecap="round" />
        ))
      ) : closed ? (
        [17, 31].map((x) => (
          <path key={x} d={`M${x - 5} 20.5 Q${x} 24 ${x + 5} 20.5`} fill="none" stroke={C.ink} strokeWidth={2.6} strokeLinecap="round" />
        ))
      ) : (
        <>
          {[17, 31].map((x) => (
            <ellipse key={x} cx={x} cy={20.5} rx={5.4} ry={6.2} fill={C.white} />
          ))}
          <g className="archie-pupils" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
            {[17, 31].map((x) => (
              <g key={x}>
                <circle cx={x} cy={20.5} r={3.5} fill={C.ink} />
                <circle cx={x + 1.2} cy={19} r={1.1} fill={C.white} />
              </g>
            ))}
          </g>
        </>
      )}
      {mood === "happy" ? (
        <path d="M17.5 29 Q24 37 30.5 29 Z" fill={C.ink} stroke={C.ink} strokeWidth={1.6} strokeLinejoin="round" />
      ) : (
        <path d="M18.5 30 Q24 35.5 29.5 30" fill="none" stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />
      )}
    </svg>
  );
}
