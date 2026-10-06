"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useScratchpadSurface } from "@/components/Scratchpad";
import { GameChip, GameHowTo, GameProblemDialog, type GameTurn, type GameVerdict } from "@/components/games/GameProblemDialog";
import { MatchEnd, MatchScore, SideMarks } from "@/components/games/Match";
import { Athlete } from "@/components/games/Players";
import { jointsOf, writePose, type Joints } from "@/components/games/rig";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { Veronica } from "@/components/house/Veronica";
import { useSound } from "@/hooks/useSound";
import { awardRinkBridgeys, recordRinkRun } from "@/lib/bridgeys";
import { SCENE_H, SCENE_W, pctX, pctY } from "@/lib/dollhouse";
import { answerIsRight } from "@/lib/grading";
import { DAILY_GOAL } from "@/lib/gamification";
import { fireConfetti, showToast } from "@/lib/notify";
import { today } from "@/lib/path";
import { clampToRink, onRink, RINK, RINK_DAILY_CAP, rinkRemainingToday, rinkSkillIds, type RinkProblem } from "@/lib/rink";
import { ATHLETE_HEIGHT, DEFAULT_SETUP, matchWinner, pickGameProblem, scoreAfter, SIDE_COLORS, sideName, spotFairFor, topicLabel, type GameSetup } from "@/lib/game-session";
import type { UserProgress } from "@/types";
import { approach, gaitPose, GAITS, skatePose, strideLength, strokePeriod, type SkatePose } from "@/lib/gait";

/** Veronica's joints, found once per drawing, for the loop to pose while she skates. */
interface SkateJoints {
  svg: SVGSVGElement;
  parts: Record<"legF" | "legB" | "shinF" | "shinB" | "footF" | "footB" | "armF" | "armB" | "foreF" | "foreB", SVGElement | null>;
  bodies: SVGElement[];
}

function skateJointsOf(svg: SVGSVGElement): SkateJoints {
  const q = (sel: string) => svg.querySelector<SVGElement>(sel);
  return {
    svg,
    parts: {
      legF: q(".v-leg-front"),
      legB: q(".v-leg-back"),
      shinF: q(".v-shin-front"),
      shinB: q(".v-shin-back"),
      footF: q(".v-foot-front"),
      footB: q(".v-foot-back"),
      armF: q(".v-arm-front"),
      armB: q(".v-arm-back"),
      foreF: q(".v-fore-front"),
      foreB: q(".v-fore-back"),
    },
    bodies: [...svg.querySelectorAll<SVGElement>(".v-body, .v-skirt")],
  };
}

/** Poses her strokes and glides, or hands her back to the CSS (her moves, standing still) when `pose` is null. */
function writeSkate(j: SkateJoints, pose: SkatePose | null): void {
  const all = [...Object.values(j.parts), ...j.bodies];
  if (!pose) {
    if (j.svg.classList.contains("veronica-gait")) {
      j.svg.classList.remove("veronica-gait");
      for (const el of all) if (el) el.style.transform = "";
    }
    return;
  }
  j.svg.classList.add("veronica-gait");
  const angles: Record<keyof SkateJoints["parts"], number> = {
    legF: pose.thighF,
    legB: pose.thighB,
    shinF: pose.shinF,
    shinB: pose.shinB,
    footF: pose.footF,
    footB: pose.footB,
    armF: pose.armF,
    armB: pose.armB,
    foreF: pose.foreF,
    foreB: pose.foreB,
  };
  for (const [k, el] of Object.entries(j.parts)) if (el) el.style.transform = `rotate(${angles[k as keyof SkateJoints["parts"]]}deg)`;
  for (const b of j.bodies) b.style.transform = `rotate(${pose.body}deg)`;
}

/**
 * Skating with Veronica. Arrow keys or WASD skate (drag, on touch); the
 * floor is slippery on purpose. A glowing ring appears somewhere on the
 * rink; skate through it and a problem from the topic picked pops up. Right
 * answers pay Bridgeys, up to the day's cap.
 *
 * With two players, each skates as the boy or girl they picked, in their
 * side's color: Player 1 on WASD (or the left half of a touch screen),
 * Player 2 on the arrows (or the right half). First through the ring
 * answers; a miss can be stolen; first to the agreed score wins.
 *
 * The loop runs on requestAnimationFrame and writes each skater's transform
 * straight to the DOM; React only hears about the things that happen once
 * (a ring reached, an answer checked).
 */

const ACCEL = 1150;
const MAX_SPEED = 560;
const DRAG = 1.4;
const MARGIN = 26;
const REACH = 54;
/** Her drawing's height on the rink, in scene units. */
const HEIGHT = 168;
/** A match athlete on the ice moves on the cheer rig: a light step, and a jump for a point. */
const ATHLETE_GAME = "cheer" as const;
const ACTION_MS = 950;

/** Which keys move which side. Alone, a player has both sets. */
const KEYS = {
  solo: { left: ["arrowleft", "a"], right: ["arrowright", "d"], up: ["arrowup", "w"], down: ["arrowdown", "s"] },
  0: { left: ["a"], right: ["d"], up: ["w"], down: ["s"] },
  1: { left: ["arrowleft"], right: ["arrowright"], up: ["arrowup"], down: ["arrowdown"] },
} as const;

interface Ring {
  x: number;
  y: number;
  item: RinkProblem;
}

/** One skater on the ice, as the loop sees them. */
interface Skater {
  side: 0 | 1;
  pos: { x: number; y: number };
  vel: { x: number; y: number };
  facing: 1 | -1;
  /** Veronica's strokes: where she is in a pair (0..1), how much she is pushing rather than gliding, and the turn. */
  skate: { phase: number; push: number; fx: number };
  /** A match athlete's stride, posed on the court rig. */
  gait: { phase: number; side: number; push: number; fx: number; speed: number; last: { x: number; y: number } };
  joints: Joints | null;
}

function makeSkater(side: 0 | 1, at: { x: number; y: number }, facing: 1 | -1): Skater {
  return {
    side,
    pos: { ...at },
    vel: { x: 0, y: 0 },
    facing,
    skate: { phase: 0, push: 0, fx: facing },
    gait: { phase: 0, side: 1, push: 0, fx: facing, speed: 0, last: { ...at } },
    joints: null,
  };
}

export function RinkGame({
  progress,
  onExit,
  onUpdate,
  demo = false,
  setup = DEFAULT_SETUP,
}: {
  progress: UserProgress;
  onExit: () => void;
  onUpdate: () => void;
  /**
   * The demo on algebridge.org: no sound setting is read and the how-to is
   * remembered in memory, so the game touches no storage. What an answer
   * pays already goes through the progress store (lib/progress-sandbox.ts).
   */
  demo?: boolean;
  /** The topic, and one player or two. */
  setup?: GameSetup;
}) {
  const two = setup.players === 2;
  const names: [string, string] = [sideName(setup, 0), sideName(setup, 1)];
  const day = useRef(today()).current;
  const { playCorrect, playWrong } = useSound({ muted: demo });

  const bodies = useRef<(HTMLDivElement | null)[]>([]);
  const skaters = useRef<Skater[]>(
    two
      ? [makeSkater(0, { x: RINK.cx - 160, y: RINK.cy + 40 }, 1), makeSkater(1, { x: RINK.cx + 160, y: RINK.cy + 40 }, -1)]
      : [makeSkater(0, { x: RINK.cx, y: RINK.cy + 40 }, 1)]
  );
  const skateJoints = useRef<SkateJoints | null>(null);
  const keys = useRef(new Set<string>());
  /** Fingers or the mouse, each steering one side: in a match, the half of the rink it went down on. */
  const pointers = useRef(new Map<number, { side: 0 | 1; x: number; y: number }>());
  const stage = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  /**
   * Her routine, from a video of the real one: a spiral once she is flying,
   * a shoot-the-duck crouch on a long glide, and a kneeling lunge to finish
   * when she stops. `move` is what she is doing and `until` when it ends.
   */
  const routine = useRef<{ glide: number; move: "" | "spiral" | "duck" | "kneel"; until: number; wasMoving: boolean }>({ glide: 0, move: "", until: 0, wasMoving: false });
  const seen = useRef(new Set<string>());
  const scorer = useRef<0 | 1 | null>(null);

  const [ring, setRing] = useState<Ring | null>(null);
  const [open, setOpen] = useState<RinkProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<GameVerdict | null>(null);
  const [turn, setTurn] = useState<{ side: 0 | 1; steal: boolean; missedChoice?: string } | null>(null);
  const [spin, setSpin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  /** A match athlete's move (their jump), per side. */
  const [moves, setMoves] = useState<[number, number]>([0, 0]);
  const [acting, setActing] = useState<[boolean, boolean]>([false, false]);
  const [session, setSession] = useState({ solved: 0, earned: 0, run: 0 });
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [remaining, setRemaining] = useState(() => rinkRemainingToday(progress, day));
  const source = rinkSkillIds(progress);
  const topic = topicLabel(progress, setup.topic);
  useScratchpadSurface(open ? `${open.skillId}:${open.problem.id}` : "rink");

  const spawnRing = useCallback(() => {
    const item = pickGameProblem(progress, setup.topic, seen.current);
    if (!item) {
      setRing(null);
      return;
    }
    seen.current.add(item.problem.prompt);
    if (seen.current.size > 40) seen.current = new Set([...seen.current].slice(-20));
    const [a, b] = skaters.current;
    const area = { kind: "ellipse" as const, cx: RINK.cx, cy: RINK.cy, rx: RINK.rx, ry: RINK.ry };
    if (b) {
      setRing({ ...spotFairFor(area, a.pos, b.pos), item });
      return;
    }
    // Somewhere on the rink, a fair skate away from her.
    let x = RINK.cx;
    let y = RINK.cy;
    for (let tries = 0; tries < 20; tries += 1) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.82;
      x = RINK.cx + Math.cos(ang) * RINK.rx * r;
      y = RINK.cy + Math.sin(ang) * RINK.ry * r;
      if (Math.hypot(x - a.pos.x, (y - a.pos.y) * 2.5) > 260) break;
    }
    setRing({ x, y, item });
  }, [progress, setup.topic]);

  useEffect(() => {
    spawnRing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Veronica's spin alone, or a match athlete's jump: a side's move. */
  const doMove = useCallback(
    (side: 0 | 1) => {
      if (!two) {
        setSpin((n) => n + 1);
        setSpinning(true);
        window.setTimeout(() => setSpinning(false), 720);
        return;
      }
      setMoves((m) => (side === 0 ? [m[0] + 1, m[1]] : [m[0], m[1] + 1]));
      setActing((a) => (side === 0 ? [true, a[1]] : [a[0], true]));
      window.setTimeout(() => setActing((a) => (side === 0 ? [false, a[1]] : [a[0], false])), ACTION_MS - 60);
    },
    [two]
  );

  // --- Input -----------------------------------------------------------------
  useEffect(() => {
    const isGameKey = (k: string) => ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", " "].includes(k);
    function down(e: KeyboardEvent) {
      if (paused.current) return;
      if (e.key === "Escape") {
        onExit();
        return;
      }
      if (!isGameKey(e.key)) return;
      e.preventDefault();
      if (e.key === " ") {
        if (!e.repeat) skaters.current.forEach((sk) => doMove(sk.side));
        return;
      }
      keys.current.add(e.key.toLowerCase());
    }
    function up(e: KeyboardEvent) {
      keys.current.delete(e.key.toLowerCase());
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onExit, doMove]);

  function scenePoint(clientX: number, clientY: number) {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: ((clientX - box.left) / box.width) * SCENE_W, y: ((clientY - box.top) / box.height) * SCENE_H };
  }

  // --- The loop --------------------------------------------------------------
  useEffect(() => {
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (paused.current) return;

      for (const sk of skaters.current) {
        const p = sk.pos;
        const v = sk.vel;
        let ax = 0;
        let ay = 0;
        const k = keys.current;
        const set = two ? KEYS[sk.side] : KEYS.solo;
        if (set.left.some((x) => k.has(x))) ax -= 1;
        if (set.right.some((x) => k.has(x))) ax += 1;
        if (set.up.some((x) => k.has(x))) ay -= 1;
        if (set.down.some((x) => k.has(x))) ay += 1;
        for (const ptr of pointers.current.values()) {
          if (ptr.side !== sk.side) continue;
          const dx = ptr.x - p.x;
          const dy = ptr.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d > 24) {
            ax = dx / d;
            ay = dy / d;
          }
        }
        // An arrow held (or a finger down) is a push; nothing held is a glide.
        const pushing = ax !== 0 || ay !== 0;
        const len = Math.hypot(ax, ay) || 1;
        // The floor is flat, so up and down are foreshortened.
        v.x += (ax / len) * ACCEL * dt;
        v.y += (ay / len) * ACCEL * 0.55 * dt;
        const drag = Math.exp(-DRAG * dt);
        v.x *= drag;
        v.y *= drag;
        const speed = Math.hypot(v.x, v.y * 1.8);
        if (speed > MAX_SPEED) {
          v.x *= MAX_SPEED / speed;
          v.y *= MAX_SPEED / speed;
        }
        p.x += v.x * dt;
        p.y += v.y * dt;
        if (!onRink(p.x, p.y, MARGIN)) {
          // Off the boards: back inside, and the push bounces off the rail.
          const back = clampToRink(p.x, p.y, MARGIN);
          const nx = (back.x - RINK.cx) / ((RINK.rx - MARGIN) * (RINK.rx - MARGIN));
          const ny = (back.y - RINK.cy) / ((RINK.ry - MARGIN) * (RINK.ry - MARGIN));
          const nl = Math.hypot(nx, ny) || 1;
          const dot = (v.x * nx + v.y * ny) / nl;
          if (dot > 0) {
            v.x -= (2 * dot * nx) / nl;
            v.y -= (2 * dot * ny) / nl;
            v.x *= 0.45;
            v.y *= 0.45;
          }
          p.x = back.x;
          p.y = back.y;
        }
        if (Math.abs(v.x) > 30) sk.facing = v.x < 0 ? -1 : 1;

        const el = bodies.current[sk.side];
        if (!el) continue;
        el.style.left = pctX(p.x);
        el.style.top = pctY(p.y);
        el.style.zIndex = String(300 + Math.round((p.y / SCENE_H) * 100));
        const s = Math.min(1, speed / MAX_SPEED);
        if (two) {
          // A match athlete, on the court rig: a light step, on ice.
          const svg = el.firstElementChild as SVGSVGElement | null;
          if (!svg) continue;
          const g = sk.gait;
          const covered = Math.hypot(p.x - g.last.x, (p.y - g.last.y) * 1.6);
          g.last = { x: p.x, y: p.y };
          const G = GAITS[ATHLETE_GAME];
          g.phase = (g.phase + covered / strideLength(G, s, ATHLETE_HEIGHT[setup.kinds[sk.side]], 1)) % 1;
          if (speed > 1) g.side = approach(g.side, Math.abs(v.x) / (Math.abs(v.x) + Math.abs(v.y * 1.6)), 10, dt);
          const driveNow = Math.max(-1, Math.min(1, (speed - g.speed) / Math.max(dt, 1e-3) / ACCEL));
          g.push = approach(g.push, driveNow, 8, dt);
          g.speed = speed;
          g.fx = approach(g.fx, sk.facing, 16, dt);
          svg.classList.toggle("player-moving", s > 0.08);
          svg.classList.toggle("player-left", sk.facing === -1);
          if (sk.joints?.svg !== svg) sk.joints = jointsOf(svg);
          writePose(sk.joints, s > 0.05 ? gaitPose(G, g.phase, s, g.side, g.push) : null, g.fx);
          continue;
        }
        const svg = el.firstElementChild as HTMLElement | null;
        if (svg) {
          // She turns through a turn rather than flipping in one frame.
          const sv = sk.skate;
          sv.fx = approach(sv.fx, sk.facing, 14, dt);
          svg.style.transform = Math.abs(sv.fx) > 0.995 ? (sv.fx < 0 ? "scaleX(-1)" : "") : `scaleX(${sv.fx.toFixed(3)})`;
          svg.style.setProperty("--stride", `${Math.max(0.26, 0.9 - s * 0.6)}s`);
          const moving = s > 0.06;
          svg.classList.toggle("veronica-moving", moving);
          const r = routine.current;
          // The finish reads how long she had been gliding before this frame:
          // stopping resets the glide below, so reading it after would never kneel.
          const glidedFor = r.glide;
          r.glide = s > 0.5 ? r.glide + dt : moving ? r.glide : 0;
          if (r.move && now >= r.until) r.move = "";
          if (!r.move) {
            if (!moving && r.wasMoving && glidedFor > 1.2) {
              r.move = "kneel";
              r.until = now + 1700;
              r.glide = 0;
            } else if (moving && r.glide > 2.6) {
              r.move = "duck";
              r.until = now + 1000;
              r.glide = 0.4;
            } else if (moving && s > 0.85 && r.glide > 1.1) {
              r.move = "spiral";
              r.until = now + 1300;
            }
          }
          if (r.move === "spiral" && !(moving && s > 0.5)) r.move = "";
          if (r.move === "duck" && !moving) r.move = "";
          r.wasMoving = moving;
          svg.classList.toggle("veronica-spiral", r.move === "spiral");
          svg.classList.toggle("veronica-duck", r.move === "duck");
          svg.classList.toggle("veronica-kneel", r.move === "kneel");
          // Strokes while she pushes, a glide when she lets go; her moves keep their own poses.
          if (pushing && moving) sv.phase = (sv.phase + dt / strokePeriod(s)) % 1;
          sv.push = approach(sv.push, pushing && moving ? 1 : 0, 7, dt);
          const vsvg = svg as unknown as SVGSVGElement;
          if (skateJoints.current?.svg !== vsvg) skateJoints.current = skateJointsOf(vsvg);
          writeSkate(skateJoints.current, moving && !r.move ? skatePose(sv.phase, s, sv.push) : null);
        }
      }

      // Through the ring? The first one through takes the question.
      if (ring) {
        const there = skaters.current.find((sk) => Math.hypot(sk.pos.x - ring.x, (sk.pos.y - ring.y) * 1.6) < REACH);
        if (there) {
          paused.current = true;
          skaters.current.forEach((sk) => (sk.vel = { x: 0, y: 0 }));
          keys.current.clear();
          pointers.current.clear();
          setOpen(ring.item);
          setAnswer("");
          setVerdict(null);
          setTurn(two ? { side: there.side, steal: false } : null);
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ring, two]);

  // --- Answering -------------------------------------------------------------
  function check(given: string) {
    if (!open || verdict || !given.trim()) return;
    const right = answerIsRight(open.problem, given);
    if (two && turn) {
      // A match: a point for a right answer, a steal for the other side after a miss.
      if (right) {
        playCorrect();
        const next = scoreAfter(score, turn.side, true);
        setScore(next);
        scorer.current = turn.side;
        setVerdict({ right: true, paid: 0, note: `${turn.steal ? "Stolen! " : ""}Point to ${names[turn.side]}. ${next[0]} to ${next[1]}.` });
      } else if (!turn.steal) {
        playWrong();
        setTurn({ side: turn.side === 0 ? 1 : 0, steal: true, missedChoice: open.problem.type === "multiple-choice" ? given : undefined });
        setAnswer("");
      } else {
        playWrong();
        scorer.current = null;
        setVerdict({ right: false, paid: 0, given });
      }
      return;
    }
    if (right) {
      playCorrect();
      const { paid, remaining: left, dailyBonus } = awardRinkBridgeys(open.skillId, day);
      setRemaining(left);
      if (dailyBonus > 0) {
        fireConfetti("small");
        showToast({
          icon: "coin",
          tone: "reward",
          title: `Daily goal · +${dailyBonus} Bridgeys`,
          description: `${DAILY_GOAL} right today, the rink included.`,
        });
      }
      // Saved here, outside the state update: saving tells the rest of the app, and that is a side effect.
      recordRinkRun(session.run + 1, day);
      setSession((s) => ({ solved: s.solved + 1, earned: s.earned + paid, run: s.run + 1 }));
      setVerdict({ right: true, paid });
      onUpdate();
    } else {
      playWrong();
      setSession((s) => ({ ...s, run: 0 }));
      setVerdict({ right: false, paid: 0, given });
    }
  }

  function skateOn() {
    const wasRight = !!verdict?.right;
    setOpen(null);
    setVerdict(null);
    setTurn(null);
    setRing(null);
    if (two) {
      if (wasRight && scorer.current !== null) doMove(scorer.current);
      const won = matchWinner(score, setup.toWin);
      if (won !== null) {
        window.setTimeout(() => {
          setWinner(won);
          fireConfetti("big");
        }, wasRight ? 700 : 200);
        return;
      }
    }
    paused.current = false;
    window.setTimeout(spawnRing, 400);
  }

  function rematch() {
    setScore([0, 0]);
    setWinner(null);
    scorer.current = null;
    paused.current = false;
    spawnRing();
  }

  const dialogTurn: GameTurn | undefined =
    two && turn ? { name: names[turn.side], color: SIDE_COLORS[turn.side], steal: turn.steal, missedBy: names[turn.side === 0 ? 1 : 0], missedChoice: turn.missedChoice } : undefined;

  return (
    <>
      {/* The rink's live layer, inside the stage. */}
      <div
        ref={stage}
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          if (paused.current) return;
          try {
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          } catch {
            /* a pointer the browser will not capture still steers */
          }
          const at = scenePoint(e.clientX, e.clientY);
          if (!at) return;
          // In a match, each player steers on their own half.
          pointers.current.set(e.pointerId, { side: two && at.x > SCENE_W / 2 ? 1 : 0, ...at });
        }}
        onPointerMove={(e) => {
          const ptr = pointers.current.get(e.pointerId);
          const at = ptr && scenePoint(e.clientX, e.clientY);
          if (ptr && at) pointers.current.set(e.pointerId, { side: ptr.side, ...at });
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
        }}
      >
        {ring && (
          <div
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pctX(ring.x), top: pctY(ring.y), width: pctX(150), zIndex: 250 }}
          >
            <svg viewBox="0 0 150 80" className="rink-ring w-full">
              <ellipse cx="75" cy="52" rx="60" ry="22" fill="none" stroke="#f43f5e" strokeWidth="6" opacity="0.9" />
              <ellipse cx="75" cy="52" rx="44" ry="15" fill="#f43f5e" opacity="0.18" />
              <g className="rink-ring-mark">
                <rect x="55" y="6" width="40" height="30" rx="9" fill="#ffffff" />
                <text x="75" y="28" textAnchor="middle" fontSize="20" fontWeight="700" fill="#e11d48" fontFamily="ui-sans-serif, system-ui">?</text>
              </g>
            </svg>
          </div>
        )}

        {skaters.current.map((sk) => (
          <div
            key={sk.side}
            ref={(el) => {
              bodies.current[sk.side] = el;
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: pctX(sk.pos.x),
              top: pctY(sk.pos.y),
              width: pctX(((two ? ATHLETE_HEIGHT[setup.kinds[sk.side]] : HEIGHT) * 100) / 160),
              zIndex: 340,
            }}
          >
            {two ? (
              <Athlete
                key={moves[sk.side]}
                kind={setup.kinds[sk.side]}
                side={sk.side}
                game={ATHLETE_GAME}
                name={names[sk.side]}
                pose={acting[sk.side] ? "action" : "idle"}
                facing={sk.facing}
                className="w-full"
              />
            ) : (
              <Veronica key={spin} pose={spinning ? "spin" : "skate"} speed={0} className="w-full" />
            )}
            {two && <SideMarks side={sk.side} name={names[sk.side]} />}
          </div>
        ))}

        {/* HUD: the score or the take, and the way out. Small, so the rink stays the picture. */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5 sm:left-3 sm:top-3 sm:gap-2">
          {two ? (
            <MatchScore names={names} score={score} toWin={setup.toWin} />
          ) : (
            <>
              <GameChip>
                <BridgeysLogo size={13} />
                <span className="tabular-nums">+{session.earned}</span>
                <span aria-hidden className="text-slate-300">
                  ·
                </span>
                <span className="tabular-nums">{session.solved}</span>
                <span className="text-slate-500">solved</span>
                {session.run >= 2 && (
                  <>
                    <span aria-hidden className="text-slate-300">
                      ·
                    </span>
                    <Icon name="flame" size={12} className="text-amber-600" />
                    <span className="tabular-nums">{session.run}</span>
                  </>
                )}
              </GameChip>
              <GameChip>
                <span className="tabular-nums">{remaining}</span>
                <span className="text-slate-500">of {RINK_DAILY_CAP} today</span>
              </GameChip>
            </>
          )}
        </div>
        <button type="button" onClick={onExit} className="btn-secondary btn-sm absolute right-2 top-2 sm:right-3 sm:top-3">
          Leave
        </button>
        <GameHowTo id={two ? "rink-match" : "rink"} demo={demo}>
          {two ? (
            <>
              <span className="sm:hidden">Each player drags on their own half. First through the ring answers.</span>
              <span className="hidden sm:inline">
                {names[0]}: W A S D. {names[1]}: arrow keys. First through the ring answers. {topic}.
              </span>
            </>
          ) : (
            <>
              <span className="sm:hidden">Drag to skate. Go through the ring.</span>
              <span className="hidden sm:inline">
                {setup.topic.kind === "unit" && source.borrowed
                  ? `Arrows or WASD to skate, drag on a phone. Unit ${source.unitNumber} problems, since your unit has none that work in the head.`
                  : `Arrows or WASD to skate, drag on a phone. Space spins. ${topic}, in your head.`}
              </span>
            </>
          )}
        </GameHowTo>
        {winner !== null && <MatchEnd winner={winner} names={names} score={score} onRematch={rematch} onLeave={onExit} />}
      </div>

      {/* The problem, over everything. Head math: nothing here needs paper. */}
      {open && (
        <GameProblemDialog
          open={open}
          verdict={verdict}
          answer={answer}
          setAnswer={setAnswer}
          onCheck={check}
          onContinue={skateOn}
          continueLabel="Skate on"
          note="In your head, or draw it out. The calculator stays off the ice."
          label="Rink problem"
          turn={dialogTurn}
        />
      )}
    </>
  );
}
