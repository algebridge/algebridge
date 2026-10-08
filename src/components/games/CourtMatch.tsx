"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useScratchpadSurface } from "@/components/Scratchpad";
import { SoccerBall, TargetMark, Volleyball } from "@/components/games/CourtGame";
import { GameHowTo, GameProblemDialog, type GameTurn, type GameVerdict } from "@/components/games/GameProblemDialog";
import { MatchEnd, MatchScore, SideMarks } from "@/components/games/Match";
import { Athlete } from "@/components/games/Players";
import { jointsOf, writePose, type Joints } from "@/components/games/rig";
import { CourtScene } from "@/components/games/Scenes";
import { useSound } from "@/hooks/useSound";
import { pctX, pctY, SCENE_H, SCENE_W } from "@/lib/dollhouse";
import { clampToArea, getCourtGame, inArea, spotAwayFrom, type CourtGameId } from "@/lib/games";
import { approach, gaitPose, GAITS, strideLength } from "@/lib/gait";
import { ATHLETE_HEIGHT, matchWinner, pickGameProblem, SIDE_COLORS, sideName, topicLabel, type GameSetup } from "@/lib/game-session";
import { answerIsRight } from "@/lib/grading";
import { fireConfetti } from "@/lib/notify";
import {
  attacking,
  cardsTotal,
  clampToTrap,
  HALF,
  goalLineX,
  inBox,
  inShotZone,
  inTrap,
  judgeCards,
  KICKOFF,
  netTop,
  persp,
  PITCH,
  roundWinner,
  shooter,
  shotTarget,
  SOCCER_HALF,
  spotInTrap,
  type Trap,
} from "@/lib/match-rules";
import type { RinkProblem } from "@/lib/rink";
import type { UserProgress } from "@/types";

/**
 * Two players, one court, the sport itself (rules in lib/match-rules.ts):
 * soccer with a goal at each end and a half each, dribbling, steals at the
 * halfway line and saves in goal; volleyball across the net, a side each;
 * wrestling face to face; cheer in front of the judges. A right answer is
 * still what wins every play.
 *
 * Player 1 (blue) is on the left and moves with W A S D or the left half of
 * a touch screen; Player 2 (orange) is on the right, with the arrows or the
 * right half. The loop writes positions straight to the
 * DOM, as the single-player courts do; React hears only about plays.
 */

const MARGIN = 20;
const KEYS = {
  0: { left: ["a"], right: ["d"], up: ["w"], down: ["s"] },
  1: { left: ["arrowleft"], right: ["arrowright"], up: ["arrowup"], down: ["arrowdown"] },
} as const;

/** Where each side waits while the other performs for the judges, just off the floor. */
const BENCH: Record<0 | 1, { x: number; y: number }> = { 0: { x: 120, y: 700 }, 1: { x: 1080, y: 700 } };

interface Mover {
  side: 0 | 1;
  height: number;
  pos: { x: number; y: number };
  vel: { x: number; y: number };
  facing: 1 | -1;
  gait: { phase: number; side: number; push: number; fx: number; speed: number; last: { x: number; y: number } };
  joints: Joints | null;
  /** Steering is off (waiting to perform, knocked down, the play stopped). */
  still: boolean;
}

function makeMover(side: 0 | 1, height: number, at: { x: number; y: number }, facing: 1 | -1): Mover {
  return { side, height, pos: { ...at }, vel: { x: 0, y: 0 }, facing, gait: { phase: 0, side: 1, push: 0, fx: facing, speed: 0, last: { ...at } }, joints: null, still: false };
}

/** The soccer ball: on the grass, at a player's feet or rolling free. */
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 0 | 1 | null;
  /** How long the owner has had it: a fresh touch cannot be stolen at once. */
  held: number;
  /** A beat after losing it, a side cannot win it straight back. */
  wait: [number, number];
  spin: number;
}

/** What the question on screen is for. */
type Play =
  | { kind: "shot"; side: 0 | 1 }
  | { kind: "save"; side: 0 | 1; shooter: 0 | 1 }
  | { kind: "dig"; side: 0 | 1 }
  | { kind: "shoot-in"; side: 0 | 1 }
  | { kind: "routine"; side: 0 | 1; started: number };

/** A cheer round: who has performed and how the judges scored them. */
interface Round {
  order: [0 | 1, 0 | 1];
  done: { side: 0 | 1; cards: [number, number, number]; total: number; seconds: number; right: boolean }[];
}

export function CourtMatch({ gameId, progress, onExit, setup, demo = false }: { gameId: CourtGameId; progress: UserProgress; onExit: () => void; setup: GameSetup; demo?: boolean }) {
  const game = getCourtGame(gameId)!;
  const names: [string, string] = [sideName(setup, 0), sideName(setup, 1)];
  const { playCorrect, playWrong } = useSound({ muted: demo });
  const topic = topicLabel(progress, setup.topic);
  const soccer = gameId === "soccer";
  const volley = gameId === "volleyball";
  const wrestle = gameId === "wrestling";
  const cheer = gameId === "cheer";

  const stage = useRef<HTMLDivElement>(null);
  const bodies = useRef<(HTMLDivElement | null)[]>([]);
  const ballEl = useRef<HTMLDivElement>(null);
  const shadowEl = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const pointers = useRef(new Map<number, { side: 0 | 1; x: number; y: number }>());
  const paused = useRef(true);
  const seen = useRef(new Set<string>());

  const startAt = useCallback((side: 0 | 1): { x: number; y: number } => {
    if (soccer) return { x: 600 + (side === 0 ? -1 : 1) * KICKOFF.gap * persp(KICKOFF.y), y: KICKOFF.y };
    if (volley) return { x: side === 0 ? 380 : 820, y: 640 };
    if (wrestle) return { x: side === 0 ? 450 : 750, y: 600 };
    return BENCH[side];
  }, [soccer, volley, wrestle]);

  const movers = useRef<Mover[]>([makeMover(0, ATHLETE_HEIGHT[setup.kinds[0]], startAt(0), 1), makeMover(1, ATHLETE_HEIGHT[setup.kinds[1]], startAt(1), -1)]);
  const ball = useRef<Ball>({ ...KICKOFF.ball, vx: 0, vy: 0, owner: null, held: 0, wait: [0, 0], spin: 0 });
  /** Volleyball: which side the ball is coming to, and where it will land. */
  const rally = useRef<{ to: 0 | 1; spot: { x: number; y: number } } | null>(null);
  const play = useRef<Play | null>(null);

  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [open, setOpen] = useState<RinkProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<GameVerdict | null>(null);
  const [turn, setTurn] = useState<{ side: 0 | 1; steal: boolean; missedChoice?: string; label?: string } | null>(null);
  const [acting, setActing] = useState<[number, number]>([0, 0]);
  const [down, setDown] = useState<[boolean, boolean]>([false, false]);
  const [goalHit, setGoalHit] = useState<"left" | "right" | null>(null);
  const [pop, setPop] = useState<{ text: string; key: number; x: number; y: number; color: string } | null>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [performer, setPerformer] = useState<0 | 1 | null>(null);
  const [cards, setCards] = useState<{ side: 0 | 1; cards: [number, number, number]; key: number } | null>(null);
  const [intro, setIntro] = useState(true);
  useScratchpadSurface(open ? `${open.skillId}:${open.problem.id}` : `match-${gameId}`);

  const problem = useCallback(() => {
    const item = pickGameProblem(progress, setup.topic, seen.current);
    if (item) {
      seen.current.add(item.problem.prompt);
      if (seen.current.size > 40) seen.current = new Set([...seen.current].slice(-20));
    }
    return item;
  }, [progress, setup.topic]);

  function say(text: string, side: 0 | 1 | null, at?: { x: number; y: number }) {
    const m = side === null ? null : movers.current[side];
    const p = at ?? m?.pos ?? { x: 600, y: 600 };
    const h = m ? m.height * persp(p.y) : 120;
    setPop({ text, key: Date.now(), x: p.x, y: p.y - h, color: side === null ? "#0f172a" : SIDE_COLORS[side] });
  }

  function act(side: 0 | 1) {
    setActing((a) => (side === 0 ? [a[0] + 1, a[1]] : [a[0], a[1] + 1]));
  }

  // ── Starting plays ───────────────────────────────────────────────────────

  /** Soccer: both back to their halves, the ball on the spot; `to` gets it (the side that conceded), or a race. */
  const kickoff = useCallback((to: 0 | 1 | null) => {
    const [a, b] = movers.current;
    a.pos = { ...startAt(0) };
    b.pos = { ...startAt(1) };
    a.vel = { x: 0, y: 0 };
    b.vel = { x: 0, y: 0 };
    a.facing = 1;
    b.facing = -1;
    const bl = ball.current;
    bl.x = KICKOFF.ball.x;
    bl.y = KICKOFF.ball.y;
    bl.vx = bl.vy = 0;
    bl.owner = null;
    bl.held = 0;
    bl.wait = [0, 0];
    if (to !== null) {
      // A restart: the ball at their feet in their own half, the other back in theirs.
      bl.x = movers.current[to].pos.x + (to === 0 ? 30 : -30) * persp(KICKOFF.y);
      bl.owner = to;
    }
    setDown([false, false]);
    paused.current = false;
  }, [startAt]);

  /** Volleyball: the ball comes over to `to`, landing somewhere on their side. */
  const serveTo = useCallback((to: 0 | 1) => {
    const m = movers.current[to];
    const s = spotInTrap(HALF[to], m.pos);
    rally.current = { to, spot: s };
    setSpot(s);
    paused.current = false;
  }, []);

  /** Wrestling: back to the two sides of the circle. */
  const faceOff = useCallback(() => {
    const [a, b] = movers.current;
    a.pos = { ...startAt(0) };
    b.pos = { ...startAt(1) };
    a.vel = { x: 0, y: 0 };
    b.vel = { x: 0, y: 0 };
    a.facing = 1;
    b.facing = -1;
    setDown([false, false]);
    paused.current = false;
  }, [startAt]);

  /** Cheer: the next performer takes the floor, the other waits at the side. */
  const nextRoutine = useCallback((r: Round) => {
    const side = r.order[r.done.length];
    const [a, b] = movers.current;
    for (const m of [a, b]) {
      m.vel = { x: 0, y: 0 };
      m.still = m.side !== side;
      m.pos = m.side === side ? { x: 600, y: 716 } : { ...BENCH[m.side] };
      m.facing = m.side === 0 ? 1 : -1;
    }
    setPerformer(side);
    const s = spotAwayFrom(game.area, movers.current[side].pos);
    setSpot(s);
    play.current = { kind: "routine", side, started: performance.now() };
    paused.current = false;
  }, [game.area]);

  const begin = useCallback(() => {
    setIntro(false);
    if (soccer) kickoff(null);
    else if (volley) serveTo(1);
    else if (wrestle) faceOff();
    else {
      const r: Round = { order: [0, 1], done: [] };
      setRound(r);
      nextRoutine(r);
    }
  }, [soccer, volley, wrestle, kickoff, serveTo, faceOff, nextRoutine]);

  // The kickoff / serve / face-off, once the names are on screen a moment.
  useEffect(() => {
    const t = window.setTimeout(begin, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Stops play and asks `side` a question for this play. */
  const ask = useCallback(
    (p: Play) => {
      const item = problem();
      paused.current = true;
      keys.current.clear();
      pointers.current.clear();
      for (const m of movers.current) m.vel = { x: 0, y: 0 };
      if (!item) return;
      play.current = p;
      setOpen(item);
      setAnswer("");
      setVerdict(null);
      setTurn({ side: p.side, steal: false });
    },
    [problem]
  );

  // ── Input ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const isGameKey = (k: string) => ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(k);
    function downKey(e: KeyboardEvent) {
      const field = e.target as HTMLElement | null;
      if (field?.isContentEditable || field?.closest?.("input, textarea, select")) return;
      if (e.key === "Escape" && !open) {
        onExit();
        return;
      }
      if (!isGameKey(e.key)) return;
      e.preventDefault();
      keys.current.add(e.key.toLowerCase());
    }
    function upKey(e: KeyboardEvent) {
      keys.current.delete(e.key.toLowerCase());
    }
    window.addEventListener("keydown", downKey);
    window.addEventListener("keyup", upKey);
    return () => {
      window.removeEventListener("keydown", downKey);
      window.removeEventListener("keyup", upKey);
    };
  }, [onExit, open]);

  function scenePoint(clientX: number, clientY: number) {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: ((clientX - box.left) / box.width) * SCENE_W, y: ((clientY - box.top) / box.height) * SCENE_H };
  }

  /** Which side a finger steers: the half of the screen it went down on. */
  function sideOf(at: { x: number; y: number }): 0 | 1 {
    return at.x < SCENE_W / 2 ? 0 : 1;
  }

  /** Where a side may stand. */
  function bound(m: Mover, x: number, y: number): { x: number; y: number } {
    const trap: Trap | null = soccer ? SOCCER_HALF[m.side] : volley ? HALF[m.side] : null;
    if (trap) return inTrap(trap, x, y, MARGIN) ? { x, y } : clampToTrap(trap, x, y, MARGIN);
    return inArea(game.area, x, y, MARGIN) ? { x, y } : clampToArea(game.area, x, y, MARGIN);
  }

  // ── The loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ms = movers.current;

      for (const m of ms) {
        const p = m.pos;
        const v = m.vel;
        const k = persp(p.y);
        if (!paused.current && !m.still) {
          let ax = 0;
          let ay = 0;
          const set = KEYS[m.side];
          if (set.left.some((x) => keys.current.has(x))) ax -= 1;
          if (set.right.some((x) => keys.current.has(x))) ax += 1;
          if (set.up.some((x) => keys.current.has(x))) ay -= 1;
          if (set.down.some((x) => keys.current.has(x))) ay += 1;
          for (const ptr of pointers.current.values()) {
            if (ptr.side !== m.side) continue;
            const dx = ptr.x - p.x;
            const dy = ptr.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d > 18 * k) {
              ax = dx / d;
              ay = dy / d;
            }
          }
          const len = Math.hypot(ax, ay) || 1;
          v.x += (ax / len) * game.accel * dt;
          v.y += (ay / len) * game.accel * 0.62 * dt;
          const drag = Math.exp(-game.drag * dt);
          v.x *= drag;
          v.y *= drag;
          const speed = Math.hypot(v.x, v.y * 1.6);
          if (speed > game.maxSpeed) {
            v.x *= game.maxSpeed / speed;
            v.y *= game.maxSpeed / speed;
          }
          // Farther away, the same run covers less of the picture.
          const to = bound(m, p.x + v.x * dt * k, p.y + v.y * dt * k);
          if (Math.abs(to.x - (p.x + v.x * dt * k)) > 0.01) v.x = 0;
          if (Math.abs(to.y - (p.y + v.y * dt * k)) > 0.01) v.y = 0;
          p.x = to.x;
          p.y = to.y;
          if (Math.abs(v.x) > 30) m.facing = v.x < 0 ? -1 : 1;
        } else if (paused.current || m.still) {
          v.x = 0;
          v.y = 0;
        }

        const el = bodies.current[m.side];
        if (el) {
          el.style.left = pctX(p.x);
          el.style.top = pctY(p.y);
          el.style.width = pctX(((m.height * 100) / 160) * k);
          el.style.zIndex = String(300 + Math.round((p.y / SCENE_H) * 100));
          const svg = el.querySelector("svg.player-svg, svg") as SVGSVGElement | null;
          if (svg) {
            const speed = Math.hypot(v.x, v.y * 1.6);
            const s = Math.min(1, speed / game.maxSpeed);
            const g = m.gait;
            const covered = Math.hypot(p.x - g.last.x, (p.y - g.last.y) * 1.6) / k;
            g.last = { x: p.x, y: p.y };
            const G = GAITS[gameId];
            g.phase = (g.phase + covered / strideLength(G, s, m.height, k)) % 1;
            if (speed > 1) g.side = approach(g.side, Math.abs(v.x) / (Math.abs(v.x) + Math.abs(v.y * 1.6)), 10, dt);
            const drive = Math.max(-1, Math.min(1, (speed - g.speed) / Math.max(dt, 1e-3) / game.accel));
            g.push = approach(g.push, drive, 8, dt);
            g.speed = speed;
            g.fx = approach(g.fx, m.facing, 16, dt);
            svg.classList.toggle("player-moving", s > 0.08);
            svg.classList.toggle("player-left", m.facing === -1);
            if (m.joints?.svg !== svg) m.joints = jointsOf(svg);
            writePose(m.joints, s > 0.05 && !paused.current ? gaitPose(G, g.phase, s, g.side, g.push) : null, g.fx);
          }
        }
      }

      if (soccer) stepBall(dt);
      if (paused.current) return;

      // What each sport stops for.
      if (volley && rally.current) {
        const r = rally.current;
        const m = ms[r.to];
        if (Math.hypot(m.pos.x - r.spot.x, (m.pos.y - r.spot.y) * 1.6) < 48 * persp(r.spot.y)) ask({ kind: "dig", side: r.to });
      } else if (wrestle) {
        const [a, b] = ms;
        if (Math.hypot(a.pos.x - b.pos.x, (a.pos.y - b.pos.y) * 1.6) < 74 * persp((a.pos.y + b.pos.y) / 2)) {
          const s = shooter(a, b);
          if (s === null) {
            // A bump standing still: step apart.
            a.pos.x -= 10;
            b.pos.x += 10;
          } else {
            // Locked up: the shooter in on the other's hips.
            const def = ms[s === 0 ? 1 : 0];
            const att = ms[s];
            att.facing = def.pos.x > att.pos.x ? 1 : -1;
            def.facing = att.facing === 1 ? -1 : 1;
            ask({ kind: "shoot-in", side: s });
          }
        }
      } else if (cheer && play.current?.kind === "routine" && spotRef.current) {
        const m = ms[play.current.side];
        const t = spotRef.current;
        if (Math.hypot(m.pos.x - t.x, (m.pos.y - t.y) * 1.6) < 52 * persp(t.y)) {
          const routine = play.current;
          const item = problem();
          paused.current = true;
          keys.current.clear();
          pointers.current.clear();
          if (item) {
            setOpen(item);
            setAnswer("");
            setVerdict(null);
            setTurn({ side: routine.side, steal: false });
          }
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // The cheer mark, read inside the loop.
  const spotRef = useRef<{ x: number; y: number } | null>(null);
  spotRef.current = spot;

  /** Soccer: the ball at a dribbler's feet or rolling; steals; carrying it into the box is the shot. */
  function stepBall(dt: number) {
    const bl = ball.current;
    const ms = movers.current;
    bl.wait = [Math.max(0, bl.wait[0] - dt), Math.max(0, bl.wait[1] - dt)];
    if (!paused.current) {
      if (bl.owner !== null) {
        const m = ms[bl.owner];
        bl.held += dt;
        const speed = Math.hypot(m.vel.x, m.vel.y * 1.6);
        // Out in front of the dribbler, the way they are running.
        const dx = speed > 20 ? m.vel.x / speed : m.facing;
        const dy = speed > 20 ? (m.vel.y * 1.6) / speed / 1.6 : 0;
        const reach = (24 + Math.min(18, speed * 0.05)) * persp(m.pos.y);
        const tx = m.pos.x + dx * reach;
        const ty = m.pos.y + dy * reach * 0.62 + 2;
        bl.x += (tx - bl.x) * Math.min(1, dt * 14);
        bl.y += (ty - bl.y) * Math.min(1, dt * 14);
        bl.spin += speed * dt * 0.04 * (dx >= 0 ? 1 : -1);
        // A tackle: the other runs into the ball.
        const other = ms[bl.owner === 0 ? 1 : 0];
        if (bl.held > 0.6 && bl.wait[other.side] <= 0 && Math.hypot(other.pos.x - bl.x, (other.pos.y - bl.y) * 1.6) < 30 * persp(bl.y)) {
          bl.wait[bl.owner] = 0.8;
          bl.owner = other.side;
          bl.held = 0;
          say("Stolen!", other.side);
        }
        // Up at the halfway line with room to strike (the other not on top of the ball): the shot.
        if (bl.owner !== null && bl.held > 0.5) {
          const side = bl.owner;
          const m2 = ms[side];
          const rival = ms[side === 0 ? 1 : 0];
          const free = Math.hypot(rival.pos.x - bl.x, (rival.pos.y - bl.y) * 1.6) > 70 * persp(bl.y);
          if (free && inShotZone(side, m2.pos.x, m2.pos.y)) {
            ask({ kind: "shot", side });
            m2.facing = attacking(side) === "right" ? 1 : -1;
          }
        }
      } else {
        bl.x += bl.vx * dt;
        bl.y += bl.vy * dt;
        const f = Math.exp(-2.2 * dt);
        bl.vx *= f;
        bl.vy *= f;
        bl.spin += Math.hypot(bl.vx, bl.vy) * dt * 0.04;
        const inside = clampToTrap(PITCH, bl.x, bl.y, 6);
        if (inside.x !== bl.x) bl.vx = -bl.vx * 0.5;
        if (inside.y !== bl.y) bl.vy = -bl.vy * 0.5;
        bl.x = inside.x;
        bl.y = inside.y;
        const near = ms
          .filter((m) => bl.wait[m.side] <= 0)
          .map((m) => ({ m, d: Math.hypot(m.pos.x - bl.x, (m.pos.y - bl.y) * 1.6) }))
          .sort((p, q) => p.d - q.d)[0];
        if (near && near.d < 30 * persp(bl.y)) {
          bl.owner = near.m.side;
          bl.held = 0;
        }
      }
    }
    const el = ballEl.current;
    const sh = shadowEl.current;
    if (el && sh) {
      const k = persp(bl.y);
      const hop = bl.owner !== null && !paused.current ? Math.abs(Math.sin(ms[bl.owner].gait.phase * Math.PI * 2)) * 5 * k : 0;
      el.style.left = pctX(bl.x);
      el.style.top = pctY(bl.y - 9 * k - hop);
      el.style.width = pctX(19 * k);
      el.style.transform = `translate(-50%, -50%) rotate(${Math.round(bl.spin * 57)}deg)`;
      el.style.zIndex = String(300 + Math.round((bl.y / SCENE_H) * 100) + 1);
      sh.style.left = pctX(bl.x);
      sh.style.top = pctY(bl.y);
      sh.style.width = pctX(20 * k);
      sh.style.zIndex = String(299 + Math.round((bl.y / SCENE_H) * 100));
    }
  }

  // ── Answers ─────────────────────────────────────────────────────────────
  function check(given: string) {
    const p = play.current;
    if (!open || verdict || !given.trim() || !p || !turn) return;
    const right = answerIsRight(open.problem, given);
    if (right) playCorrect();
    else playWrong();

    if (p.kind === "routine") {
      const seconds = (performance.now() - p.started) / 1000;
      const c = judgeCards({ right, seconds });
      const entry = { side: p.side, cards: c, total: cardsTotal(c), seconds, right };
      setRound((r) => (r ? { ...r, done: [...r.done, entry] } : r));
      setVerdict({ right, paid: 0, given: right ? undefined : given, note: right ? `Stuck it! The judges: ${c.join(", ")}.` : undefined });
      return;
    }
    if (p.kind === "shot") {
      const keeper = p.side === 0 ? 1 : 0;
      if (!right) {
        setVerdict({ right: false, paid: 0, given, note: `Wide of the post. Goal kick to ${names[keeper]}.` });
        return;
      }
      // In goal? The keeper gets a go at saving it.
      const k = movers.current[keeper];
      if (inBox(attacking(p.side), k.pos.x, k.pos.y)) {
        const item = problem();
        if (item) {
          play.current = { kind: "save", side: keeper, shooter: p.side };
          setOpen(item);
          setAnswer("");
          setTurn({ side: keeper, steal: false, label: `${names[p.side]} shoots! ${names[keeper]}, save it!` });
          return;
        }
      }
      const next: [number, number] = p.side === 0 ? [score[0] + 1, score[1]] : [score[0], score[1] + 1];
      setScore(next);
      setVerdict({ right: true, paid: 0, note: `Goal! Point to ${names[p.side]}. ${next[0]} to ${next[1]}.` });
      return;
    }
    if (p.kind === "save") {
      if (right) {
        setVerdict({ right: true, paid: 0, note: `Saved! ${names[p.side]} has it.` });
        return;
      }
      const next: [number, number] = p.shooter === 0 ? [score[0] + 1, score[1]] : [score[0], score[1] + 1];
      setScore(next);
      setVerdict({ right: false, paid: 0, given, note: `It's in. Point to ${names[p.shooter]}. ${next[0]} to ${next[1]}.` });
      return;
    }
    if (right) {
      // The side whose turn it is wins the play.
      const winnerSide = turn.side;
      if (p.kind === "dig") {
        setVerdict({ right: true, paid: 0, note: "Over the net it goes. The rally's on." });
      } else {
        const next: [number, number] = winnerSide === 0 ? [score[0] + 1, score[1]] : [score[0], score[1] + 1];
        setScore(next);
        const what = turn.steal ? "Reversal" : "Takedown";
        setVerdict({ right: true, paid: 0, note: `${what}! Point to ${names[winnerSide]}. ${next[0]} to ${next[1]}.` });
      }
      return;
    }
    // Wrong.
    if (p.kind === "dig") {
      const other = p.side === 0 ? 1 : 0;
      const next: [number, number] = other === 0 ? [score[0] + 1, score[1]] : [score[0], score[1] + 1];
      setScore(next);
      setVerdict({ right: false, paid: 0, given, note: `It drops. Point to ${names[other]}. ${next[0]} to ${next[1]}.` });
      return;
    }
    if (!turn.steal) {
      // The other side gets a go: the defender's counter or reversal.
      setTurn({ side: turn.side === 0 ? 1 : 0, steal: true, missedChoice: open.problem.type === "multiple-choice" ? given : undefined });
      setAnswer("");
      return;
    }
    setVerdict({ right: false, paid: 0, given });
  }

  /** After an answer: the play happens, the score is checked, the next play starts. */
  function carryOn() {
    const p = play.current;
    const wasRight = !!verdict?.right;
    const side = turn?.side ?? 0;
    const steal = !!turn?.steal;
    setOpen(null);
    setVerdict(null);
    setTurn(null);
    play.current = null;
    if (!p) return;

    const won = matchWinner(score, setup.toWin);
    const after = (ms: number, next: () => void) =>
      window.setTimeout(() => {
        if (won !== null) {
          setWinner(won);
          fireConfetti("big");
          return;
        }
        next();
      }, ms);

    if (p.kind === "shot" || p.kind === "save") {
      const shooter = p.kind === "save" ? p.shooter : p.side;
      const keeper = shooter === 0 ? 1 : 0;
      const scored = p.kind === "shot" ? wasRight : !wasRight;
      act(shooter);
      if (scored) {
        window.setTimeout(() => shoot(attacking(shooter), shooter), 380);
        after(1700, () => kickoff(keeper));
      } else {
        if (p.kind === "save") {
          act(keeper);
          say("Saved!", keeper);
        } else say("Wide!", null, { x: goalLineX(attacking(shooter), 560), y: 520 });
        after(1100, () => kickoff(keeper));
      }
      return;
    }
    if (p.kind === "dig") {
      const r = rally.current!;
      if (wasRight) {
        act(side);
        const other = side === 0 ? 1 : 0;
        const next = spotInTrap(HALF[other], movers.current[other].pos);
        setSpot(null);
        window.setTimeout(() => spike(movers.current[side], next), 420);
        window.setTimeout(() => {
          rally.current = { to: other, spot: next };
          setSpot(next);
          paused.current = false;
        }, 1150);
      } else {
        drop(r.spot);
        setSpot(null);
        // The point winner serves, to the side that let it drop.
        after(1300, () => serveTo(side));
      }
      return;
    }
    if (p.kind === "shoot-in") {
      if (wasRight) {
        act(side);
        const loser = side === 0 ? 1 : 0;
        window.setTimeout(() => setDown(loser === 0 ? [true, false] : [false, true]), 300);
        say(steal ? "Reversal!" : "Takedown!", side);
        after(1600, faceOff);
      } else {
        say("Back to neutral", null, { x: 600, y: 560 });
        after(700, faceOff);
      }
      return;
    }
    if (p.kind === "routine") {
      const r = round;
      if (wasRight) act(side);
      setSpot(null);
      const last = r?.done[r.done.length - 1];
      if (last) setCards({ side: last.side, cards: last.cards, key: Date.now() });
      if (!r) return;
      if (r.done.length < 2) {
        window.setTimeout(() => nextRoutine(r), 2200);
        return;
      }
      // Both have performed: the higher total takes the round.
      const [a, b] = [r.done.find((d) => d.side === 0)!, r.done.find((d) => d.side === 1)!];
      const w = roundWinner(a, b);
      window.setTimeout(() => {
        if (w !== null) {
          const next: [number, number] = w === 0 ? [score[0] + 1, score[1]] : [score[0], score[1] + 1];
          setScore(next);
          say(`${names[w]} takes the round, ${(w === 0 ? a : b).total.toFixed(1)} to ${(w === 0 ? b : a).total.toFixed(1)}`, null, { x: 600, y: 520 });
          const finished = matchWinner(next, setup.toWin);
          if (finished !== null) {
            window.setTimeout(() => {
              setWinner(finished);
              fireConfetti("big");
            }, 1600);
            return;
          }
        } else say("A tie! Again.", null, { x: 600, y: 520 });
        const order: [0 | 1, 0 | 1] = r.order[0] === 0 ? [1, 0] : [0, 1];
        const fresh: Round = { order, done: [] };
        window.setTimeout(() => {
          setRound(fresh);
          setCards(null);
          nextRoutine(fresh);
        }, 1800);
      }, 2400);
    }
  }

  // ── Ball flights ────────────────────────────────────────────────────────
  const still = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /** Soccer: a shot into a goal; the net ripples. */
  function shoot(end: "left" | "right", side: 0 | 1) {
    const bl = ball.current;
    const target = shotTarget(end);
    const el = ballEl.current;
    bl.owner = null;
    paused.current = true;
    const finish = () => {
      setGoalHit(end);
      window.setTimeout(() => setGoalHit(null), 700);
      say("GOAL!", side, { x: target.x, y: target.y - 140 * persp(target.y) });
    };
    if (!el || still()) {
      finish();
      return;
    }
    const k0 = persp(bl.y);
    const k1 = persp(target.y);
    const from = { x: bl.x, y: bl.y - 9 * k0 };
    const to = { x: target.x, y: target.y - target.lift };
    const apex = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 };
    const at = (q: { x: number; y: number }, w: number, offset?: number) => ({ left: pctX(q.x), top: pctY(q.y), width: pctX(w), ...(offset === undefined ? {} : { offset }) });
    const run = el.animate([at(from, 19 * k0), at(apex, 19 * (k0 + k1) / 2, 0.5), at(to, 19 * k1)], { duration: 520, easing: "cubic-bezier(0.25, 0.6, 0.4, 1)", fill: "forwards" });
    run.onfinish = () => {
      run.cancel();
      bl.x = target.x;
      bl.y = target.y;
      finish();
    };
  }

  /** Volleyball: a spike from the hitter's hand over the net to where it will land. */
  function spike(m: Mover, to: { x: number; y: number }) {
    const el = flyer.current;
    if (!el || still()) return;
    const k = persp(m.pos.y);
    const from = { x: m.pos.x + 30 * k * m.facing, y: m.pos.y - (m.height + 6) * k };
    const land = { x: to.x, y: to.y - 70 * persp(to.y) };
    // Over the net with room to spare.
    const apex = { x: (from.x + land.x) / 2, y: Math.min(from.y, land.y, netTop((m.pos.y + to.y) / 2)) - 90 };
    const at = (q: { x: number; y: number }, w: number, opacity: number, offset?: number) => ({ left: pctX(q.x), top: pctY(q.y), width: pctX(w), opacity, ...(offset === undefined ? {} : { offset }) });
    el.animate([at(from, 30 * k, 1), at(apex, 26, 1, 0.5), at(land, 30 * persp(to.y), 1, 0.96), at(land, 30 * persp(to.y), 0)], { duration: 700, easing: "cubic-bezier(0.3, 0.55, 0.45, 1)", fill: "forwards" });
  }

  /** Volleyball: the ball drops to the floor and bounces where nobody got to it. */
  function drop(at: { x: number; y: number }) {
    const el = flyer.current;
    if (!el || still()) return;
    const k = persp(at.y);
    const top = { x: at.x, y: at.y - 120 * k };
    const floor = { x: at.x, y: at.y - 12 * k };
    const bounce = { x: at.x + 30 * k, y: at.y - 46 * k };
    const away = { x: at.x + 60 * k, y: at.y - 10 * k };
    const f = (q: { x: number; y: number }, opacity: number, offset?: number) => ({ left: pctX(q.x), top: pctY(q.y), width: pctX(30 * k), opacity, ...(offset === undefined ? {} : { offset }) });
    el.animate([f(top, 1), f(floor, 1, 0.35), f(bounce, 1, 0.6), f(away, 1, 0.85), f(away, 0)], { duration: 900, easing: "ease-in", fill: "forwards" });
    say("Drop!", null, { x: at.x, y: at.y - 100 * k });
  }

  function rematch() {
    setScore([0, 0]);
    setWinner(null);
    setCards(null);
    setRound(null);
    setSpot(null);
    rally.current = null;
    for (const m of movers.current) m.still = false;
    begin();
  }

  // ── Drawing ─────────────────────────────────────────────────────────────
  const dialogTurn: GameTurn | undefined = turn ? { name: names[turn.side], color: SIDE_COLORS[turn.side], steal: turn.steal, missedBy: names[turn.side === 0 ? 1 : 0], missedChoice: turn.missedChoice, label: turn.label } : undefined;
  const howTo = soccer
    ? `A half each: ${names[0]} left, ${names[1]} right. Dribble up to the halfway line to shoot at the far goal. Defend at the line to steal, or stay in goal to save.`
    : volley
      ? `${names[0]} left of the net, ${names[1]} right. Get under the ball where it lands, answer, and spike it back over.`
      : wrestle
        ? `Shoot in on your opponent: the one who comes in answers. Right is a takedown; a miss gives the other a reversal.`
        : `Take turns on the floor: hit the star and answer. Three judges score each routine; quick and right scores high.`;
  const marker = spot && (cheer ? (
    <div aria-hidden className="pointer-events-none absolute" style={{ left: pctX(spot.x), top: pctY(spot.y), width: pctX(150 * persp(spot.y)), transform: "translate(-50%, -69%)", zIndex: 250 + Math.round((spot.y / SCENE_H) * 100) }}>
      <TargetMark game="cheer" accent={performer === null ? game.accent : SIDE_COLORS[performer]} />
    </div>
  ) : volley ? (
    <div aria-hidden className="pointer-events-none absolute" style={{ left: pctX(spot.x), top: pctY(spot.y), width: pctX(150 * persp(spot.y)), transform: "translate(-50%, -80%)", zIndex: 300 + Math.round((spot.y / SCENE_H) * 100) }}>
      <TargetMark game="volleyball" accent={rally.current ? SIDE_COLORS[rally.current.to] : game.accent} />
    </div>
  ) : null);

  return (
    <>
      <CourtScene game={gameId} board={{ names, score, now: cheer && performer !== null ? names[performer] : undefined }} goalHit={goalHit} />
      <div
        ref={stage}
        className="absolute inset-0 touch-none"
        role="group"
        aria-label={`${game.sport}, ${names[0]} against ${names[1]}. ${names[0]} moves with W A S D, ${names[1]} with the arrow keys. ${howTo}`}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("button, a, input")) return;
          try {
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          } catch {
            /* still steers */
          }
          const at = scenePoint(e.clientX, e.clientY);
          if (at) pointers.current.set(e.pointerId, { side: sideOf(at), ...at });
        }}
        onPointerMove={(e) => {
          const ptr = pointers.current.get(e.pointerId);
          const at = ptr && scenePoint(e.clientX, e.clientY);
          if (ptr && at) pointers.current.set(e.pointerId, { side: ptr.side, ...at });
        }}
        onPointerUp={(e) => pointers.current.delete(e.pointerId)}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
      >
        {marker}

        {soccer && (
          <>
            <div ref={shadowEl} aria-hidden className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pctX(KICKOFF.ball.x), top: pctY(KICKOFF.ball.y), width: pctX(20) }}>
              <svg viewBox="0 0 40 14" className="w-full">
                <ellipse cx="20" cy="7" rx="18" ry="5" fill="#000000" opacity="0.38" />
              </svg>
            </div>
            <div ref={ballEl} aria-hidden className="pointer-events-none absolute" style={{ left: pctX(KICKOFF.ball.x), top: pctY(KICKOFF.ball.y), width: pctX(19), transform: "translate(-50%, -50%)" }}>
              <SoccerBall />
            </div>
          </>
        )}
        <div ref={flyer} aria-hidden className="pointer-events-none absolute" style={{ width: pctX(30), opacity: 0, left: "-10%", top: "-10%", transform: "translate(-50%, -50%)", zIndex: 460 }}>
          {volley ? <Volleyball /> : null}
        </div>

        {movers.current.map((m) => (
          <div
            key={m.side}
            ref={(el) => {
              bodies.current[m.side] = el;
            }}
            className={`pointer-events-none absolute -translate-x-1/2 -translate-y-full ${down[m.side] ? "match-down" : ""}`}
            style={{ left: pctX(m.pos.x), top: pctY(m.pos.y), width: pctX(((m.height * 100) / 160) * persp(m.pos.y)), zIndex: 340, ["--fall" as string]: m.facing === 1 ? "-82deg" : "82deg" }}
          >
            <Athlete key={acting[m.side]} kind={setup.kinds[m.side]} side={m.side} game={gameId} name={names[m.side]} pose={acting[m.side] ? "action" : "idle"} facing={m.facing} className="w-full" />
            <SideMarks side={m.side} name={names[m.side]} />
          </div>
        ))}

        {/* The judges' cards, held up over their table. */}
        {cheer && cards && (
          <div key={cards.key} className="pointer-events-none absolute flex gap-[1.2%]" style={{ left: pctX(486), top: pctY(286), width: pctX(228), zIndex: 260 }} aria-live="polite">
            {cards.cards.map((c, i) => (
              <div key={i} className="judge-card flex-1 rounded-md border-2 bg-white py-[3%] text-center font-black tabular-nums shadow-lg" style={{ borderColor: SIDE_COLORS[cards.side], color: "#0f172a", animationDelay: `${i * 140}ms`, fontSize: "clamp(11px, 2.1vw, 26px)" }}>
                {c.toFixed(1)}
              </div>
            ))}
          </div>
        )}

        {pop && (
          <p key={pop.key} aria-live="polite" className="pointer-events-none absolute -translate-x-1/2" style={{ left: pctX(pop.x), top: pctY(pop.y - 40), zIndex: 900 }}>
            <span className="court-pop block whitespace-nowrap rounded-full px-3 py-1 text-base font-black tracking-tight text-white shadow-lg ring-2 ring-white sm:px-4 sm:text-2xl" style={{ background: pop.color }}>
              {pop.text}
            </span>
          </p>
        )}

        {intro && (
          <div className="pointer-events-none absolute inset-x-0 top-[38%] text-center" style={{ zIndex: 880 }}>
            <span className="court-pop inline-block rounded-full bg-slate-900/85 px-4 py-1.5 text-lg font-black text-white sm:text-2xl">
              {soccer ? "Kick off!" : volley ? `${names[0]} serves` : wrestle ? "Wrestle!" : "Judges ready"}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5 sm:left-3 sm:top-3 sm:gap-2">
          <MatchScore names={names} score={score} toWin={setup.toWin} />
        </div>
        <button type="button" onClick={onExit} className="btn-secondary btn-sm absolute right-2 top-2 sm:right-3 sm:top-3">
          Leave
        </button>
        <GameHowTo id={`court-duel-${gameId}`} demo={demo}>
          <span className="sm:hidden">Each player drags on their own half. {howTo}</span>
          <span className="hidden sm:inline">
            {names[0]}: W A S D. {names[1]}: arrow keys. {howTo} {topic}.
          </span>
        </GameHowTo>
        {winner !== null && <MatchEnd winner={winner} names={names} score={score} onRematch={rematch} onLeave={onExit} />}
      </div>

      {open && (
        <GameProblemDialog
          open={open}
          verdict={verdict}
          answer={answer}
          setAnswer={setAnswer}
          onCheck={check}
          onContinue={carryOn}
          continueLabel={cheer ? "See the judges" : "Play on"}
          note={game.note}
          label={`${game.sport} problem`}
          turn={dialogTurn}
        />
      )}
    </>
  );
}
