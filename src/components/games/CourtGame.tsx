"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useScratchpadSurface } from "@/components/Scratchpad";
import { CourtMatch } from "@/components/games/CourtMatch";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { GameChip, GameHowTo, GameProblemDialog, type GameTurn, type GameVerdict } from "@/components/games/GameProblemDialog";
import { MatchEnd, MatchScore, SideMarks } from "@/components/games/Match";
import { Athlete, Player } from "@/components/games/Players";
import { jointsOf, writePose, type Joints } from "@/components/games/rig";
import { CourtScene } from "@/components/games/Scenes";
import { useSound } from "@/hooks/useSound";
import { awardRinkBridgeys, recordGameRun } from "@/lib/bridgeys";
import { pctX, pctY, SCENE_H, SCENE_W } from "@/lib/dollhouse";
import { clampToArea, depthScale, getCourtGame, GOAL, inArea, spotAwayFrom, type CourtGameId } from "@/lib/games";
import { approach, gaitPose, GAITS, strideLength } from "@/lib/gait";
import { DAILY_GOAL } from "@/lib/gamification";
import { ATHLETE_HEIGHT, DEFAULT_SETUP, matchWinner, pickGameProblem, scoreAfter, SIDE_COLORS, sideName, spotFairFor, topicLabel, type GameSetup } from "@/lib/game-session";
import { answerIsRight } from "@/lib/grading";
import { fireConfetti, showToast } from "@/lib/notify";
import { today } from "@/lib/path";
import { RINK_DAILY_CAP, rinkRemainingToday, type RinkProblem } from "@/lib/rink";
import type { UserProgress } from "@/types";

/**
 * A team game on its court: the same loop as the rink, with footing instead
 * of ice. Move with the arrows or WASD (drag on a phone) to the target; a
 * head-math problem from the topic picked comes up; a right answer pays,
 * within the day's cap the games share, and the player does their move:
 * Shaurya's shot, Jo's jump, Jordyn's spike, Rayla's strike.
 *
 * With two players, each plays as the boy or girl they picked, in their
 * side's color: Player 1 on WASD (or the left half of a touch screen),
 * Player 2 on the arrows (or the right half). Both run for the same target;
 * the first there answers, a miss can be stolen, and the first to the agreed
 * score wins.
 *
 * The loop runs on requestAnimationFrame and writes each player's position
 * straight to the DOM; React only hears about what happens once.
 */

const MARGIN = 22;
const REACH = 52;
const ACTION_MS = 950;
/** When, into the move, the ball leaves: the hand at the top of the spike, the foot through the ball. */
const CONTACT_MS: Partial<Record<CourtGameId, number>> = { volleyball: 430, soccer: 400 };
/** Where each target's spot on the floor sits in its picture, from the top. */
const ANCHOR: Record<CourtGameId, number> = { wrestling: 62 / 90, cheer: 62 / 90, volleyball: 120 / 150, soccer: 66 / 90 };

/** Which keys move which side. Alone, a player has both sets. */
const KEYS = {
  solo: { left: ["arrowleft", "a"], right: ["arrowright", "d"], up: ["arrowup", "w"], down: ["arrowdown", "s"] },
  0: { left: ["a"], right: ["d"], up: ["w"], down: ["s"] },
  1: { left: ["arrowleft"], right: ["arrowright"], up: ["arrowup"], down: ["arrowdown"] },
} as const;

interface Target {
  x: number;
  y: number;
  item: RinkProblem;
}

/** One player on the court, as the loop sees them. */
interface Mover {
  side: 0 | 1;
  figure: CourtGameId;
  height: number;
  pos: { x: number; y: number };
  vel: { x: number; y: number };
  facing: 1 | -1;
  /** The stride: where it is (0..1), how much of the motion is across the court, the drive, the turn. */
  gait: { phase: number; side: number; push: number; fx: number; speed: number; last: { x: number; y: number } };
  joints: Joints | null;
}

function makeMover(side: 0 | 1, figure: CourtGameId, height: number, at: { x: number; y: number }, facing: 1 | -1): Mover {
  return { side, figure, height, pos: { ...at }, vel: { x: 0, y: 0 }, facing, gait: { phase: 0, side: 1, push: 0, fx: facing, speed: 0, last: { ...at } }, joints: null };
}

/** One player runs the court's loop; two play the sport itself (CourtMatch). */
export function CourtGame(props: Parameters<typeof CourtSolo>[0]) {
  const setup = props.setup ?? DEFAULT_SETUP;
  if (setup.players === 2) return <CourtMatch gameId={props.gameId} progress={props.progress} onExit={props.onExit} setup={setup} demo={props.demo} />;
  return <CourtSolo {...props} />;
}

function CourtSolo({
  gameId,
  progress,
  onExit,
  onUpdate,
  demo = false,
  setup = DEFAULT_SETUP,
}: {
  gameId: CourtGameId;
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
  const game = getCourtGame(gameId)!;
  const two = setup.players === 2;
  const names: [string, string] = [sideName(setup, 0), sideName(setup, 1)];
  const day = useRef(today()).current;
  const { playCorrect, playWrong } = useSound({ muted: demo });

  const stage = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const bodies = useRef<(HTMLDivElement | null)[]>([]);
  const movers = useRef<Mover[]>(
    two
      ? (() => {
          const left = clampToArea(game.area, game.start.x - 150, game.start.y, MARGIN);
          const right = clampToArea(game.area, game.start.x + 150, game.start.y, MARGIN);
          return [makeMover(0, gameId, ATHLETE_HEIGHT[setup.kinds[0]], left, 1), makeMover(1, gameId, ATHLETE_HEIGHT[setup.kinds[1]], right, -1)];
        })()
      : [makeMover(0, gameId, game.height, game.start, 1)]
  );
  const keys = useRef(new Set<string>());
  /** Fingers or the mouse, each steering one side: in a match, the half of the court it went down on. */
  const pointers = useRef(new Map<number, { side: 0 | 1; x: number; y: number }>());
  const paused = useRef(false);
  const seen = useRef(new Set<string>());
  /** Who scored the last point in a match, for their move; null after a miss nobody stole. */
  const scorer = useRef<0 | 1 | null>(null);

  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState<RinkProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<GameVerdict | null>(null);
  const [turn, setTurn] = useState<{ side: 0 | 1; steal: boolean; missedChoice?: string } | null>(null);
  const [moves, setMoves] = useState<[number, number]>([0, 0]);
  const [acting, setActing] = useState<[boolean, boolean]>([false, false]);
  const [pop, setPop] = useState<{ text: string; key: number; x: number; y: number; color: string } | null>(null);
  const [netHit, setNetHit] = useState(false);
  const [session, setSession] = useState({ solved: 0, earned: 0, run: 0 });
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [remaining, setRemaining] = useState(() => rinkRemainingToday(progress, day));
  const topic = topicLabel(progress, setup.topic);
  useScratchpadSurface(open ? `${open.skillId}:${open.problem.id}` : `court-${gameId}`);

  const spawnTarget = useCallback(() => {
    const item = pickGameProblem(progress, setup.topic, seen.current);
    if (!item) {
      setTarget(null);
      return;
    }
    seen.current.add(item.problem.prompt);
    if (seen.current.size > 40) seen.current = new Set([...seen.current].slice(-20));
    const [a, b] = movers.current;
    const spot = b ? spotFairFor(game.area, a.pos, b.pos) : spotAwayFrom(game.area, a.pos);
    setTarget({ ...spot, item });
  }, [progress, game.area, setup.topic]);

  useEffect(() => {
    spawnTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A side's move, for a right answer or just for fun on the space bar. */
  const doMove = useCallback((side: 0 | 1) => {
    setMoves((m) => (side === 0 ? [m[0] + 1, m[1]] : [m[0], m[1] + 1]));
    setActing((a) => (side === 0 ? [true, a[1]] : [a[0], true]));
    window.setTimeout(() => setActing((a) => (side === 0 ? [false, a[1]] : [a[0], false])), ACTION_MS - 60);
  }, []);

  // --- Input -----------------------------------------------------------------
  useEffect(() => {
    const isGameKey = (k: string) => ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", " "].includes(k);
    function down(e: KeyboardEvent) {
      if (paused.current) return;
      // Keys typed into a text box (Archie, while the game runs) are words,
      // not moves: "what is a slope" came out "htilope", and Esc there quit.
      const field = e.target as HTMLElement | null;
      if (field?.isContentEditable || field?.closest?.("input, textarea, select")) return;
      if (e.key === "Escape") {
        onExit();
        return;
      }
      if (!isGameKey(e.key)) return;
      e.preventDefault();
      if (e.key === " ") {
        if (!e.repeat) movers.current.forEach((m) => doMove(m.side));
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

      for (const m of movers.current) {
        const p = m.pos;
        const v = m.vel;
        if (!paused.current) {
          let ax = 0;
          let ay = 0;
          const k = keys.current;
          const set = two ? KEYS[m.side] : KEYS.solo;
          if (set.left.some((x) => k.has(x))) ax -= 1;
          if (set.right.some((x) => k.has(x))) ax += 1;
          if (set.up.some((x) => k.has(x))) ay -= 1;
          if (set.down.some((x) => k.has(x))) ay += 1;
          for (const ptr of pointers.current.values()) {
            if (ptr.side !== m.side) continue;
            const dx = ptr.x - p.x;
            const dy = ptr.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d > 20) {
              ax = dx / d;
              ay = dy / d;
            }
          }
          const len = Math.hypot(ax, ay) || 1;
          // The floor is seen at an angle, so up and down are foreshortened.
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
          p.x += v.x * dt;
          p.y += v.y * dt;
          if (!inArea(game.area, p.x, p.y, MARGIN)) {
            const back = clampToArea(game.area, p.x, p.y, MARGIN);
            if (Math.abs(back.x - p.x) > 0.01) v.x = 0;
            if (Math.abs(back.y - p.y) > 0.01) v.y = 0;
            p.x = back.x;
            p.y = back.y;
          }
          if (Math.abs(v.x) > 30) m.facing = v.x < 0 ? -1 : 1;
        } else {
          v.x = 0;
          v.y = 0;
        }

        const el = bodies.current[m.side];
        if (el) {
          const scale = depthScale(game.area, p.y);
          el.style.left = pctX(p.x);
          el.style.top = pctY(p.y);
          el.style.width = pctX(((m.height * 100) / 160) * scale);
          el.style.zIndex = String(300 + Math.round((p.y / SCENE_H) * 100));
          const svg = el.firstElementChild as SVGSVGElement | null;
          if (svg) {
            const speed = Math.hypot(v.x, v.y * 1.6);
            const s = Math.min(1, speed / game.maxSpeed);
            const g = m.gait;
            // The ground covered this frame is what turns the stride, so a planted foot stays planted.
            const covered = Math.hypot(p.x - g.last.x, (p.y - g.last.y) * 1.6);
            g.last = { x: p.x, y: p.y };
            const G = GAITS[m.figure];
            g.phase = (g.phase + covered / strideLength(G, s, m.height, scale)) % 1;
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

      // At the target? The first one there takes the question.
      if (target && !paused.current) {
        const there = movers.current.find((m) => Math.hypot(m.pos.x - target.x, (m.pos.y - target.y) * 1.6) < REACH);
        if (there) {
          paused.current = true;
          keys.current.clear();
          pointers.current.clear();
          setOpen(target.item);
          setAnswer("");
          setVerdict(null);
          setTurn(two ? { side: there.side, steal: false } : null);
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, game, two]);

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
          description: `${DAILY_GOAL} right today, the games included.`,
        });
      }
      // Saved here, outside the state update: saving tells the rest of the app, and that is a side effect.
      recordGameRun(gameId, session.run + 1);
      setSession((s) => ({ solved: s.solved + 1, earned: s.earned + paid, run: s.run + 1 }));
      setVerdict({ right: true, paid });
      onUpdate();
    } else {
      playWrong();
      setSession((s) => ({ ...s, run: 0 }));
      setVerdict({ right: false, paid: 0, given });
    }
  }

  /**
   * Volleyball and soccer: the ball leaves the scorer's hand, or foot, and
   * goes over the net or into the goal. Positions are in their picture's
   * units (100 by 160, feet at the bottom middle), scaled to the court.
   */
  function launch(m: Mover) {
    const el = flyer.current;
    if (!el || (gameId !== "volleyball" && gameId !== "soccer")) return;
    const p = m.pos;
    const unit = (m.height * depthScale(game.area, p.y)) / 160;
    const from =
      gameId === "volleyball"
        ? { x: p.x + 34 * unit * m.facing, y: p.y - 173 * unit }
        : { x: p.x + 24 * unit * m.facing, y: p.y - 14 * unit };
    const to =
      gameId === "volleyball"
        ? { x: 380 + Math.random() * 440, y: 432 }
        : { x: 600 + (Math.random() - 0.5) * 170, y: GOAL.top + 44 + Math.random() * 30 };
    const scored = () => {
      if (gameId !== "soccer") return;
      setNetHit(true);
      window.setTimeout(() => setNetHit(false), 600);
    };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      scored();
      return;
    }
    const apex = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - (gameId === "volleyball" ? 60 : 90) };
    const at = (q: { x: number; y: number }, scale: number, opacity: number, offset?: number) => ({
      left: pctX(q.x),
      top: pctY(q.y),
      transform: `translate(-50%, -50%) scale(${scale})`,
      opacity,
      ...(offset === undefined ? {} : { offset }),
    });
    const run = el.animate([at(from, 1, 1), at(apex, 0.85, 1, 0.45), at(to, 0.62, 1, 0.92), at(to, 0.6, 0)], {
      duration: gameId === "volleyball" ? 680 : 760,
      easing: "cubic-bezier(0.3, 0.6, 0.5, 1)",
      fill: "forwards",
    });
    run.onfinish = scored;
  }

  /** A right answer: the scorer's move, a cheer over their head, then the next target. */
  function celebrate(side: 0 | 1) {
    const m = movers.current.find((x) => x.side === side) ?? movers.current[0];
    doMove(side);
    const p = m.pos;
    setPop({
      text: game.cheers[Math.floor(Math.random() * game.cheers.length)],
      key: Date.now(),
      x: p.x,
      y: p.y - m.height * depthScale(game.area, p.y),
      color: two ? SIDE_COLORS[side] : game.accent,
    });
    const contact = CONTACT_MS[gameId];
    if (contact) window.setTimeout(() => launch(m), contact);
  }

  function carryOn() {
    const wasRight = !!verdict?.right;
    setOpen(null);
    setVerdict(null);
    setTurn(null);
    setTarget(null);
    if (two) {
      const won = matchWinner(score, setup.toWin);
      if (wasRight && scorer.current !== null) celebrate(scorer.current);
      if (won !== null) {
        window.setTimeout(() => {
          setWinner(won);
          fireConfetti("big");
        }, wasRight ? ACTION_MS : 200);
        return;
      }
      window.setTimeout(() => {
        paused.current = false;
        spawnTarget();
      }, wasRight ? ACTION_MS : 350);
      return;
    }
    if (!wasRight) {
      paused.current = false;
      window.setTimeout(spawnTarget, 350);
      return;
    }
    celebrate(0);
    window.setTimeout(() => {
      paused.current = false;
      spawnTarget();
    }, ACTION_MS);
  }

  function rematch() {
    setScore([0, 0]);
    setWinner(null);
    scorer.current = null;
    paused.current = false;
    spawnTarget();
  }

  const scaleAtTarget = target ? depthScale(game.area, target.y) : 1;
  const dialogTurn: GameTurn | undefined =
    two && turn ? { name: names[turn.side], color: SIDE_COLORS[turn.side], steal: turn.steal, missedBy: names[turn.side === 0 ? 1 : 0], missedChoice: turn.missedChoice } : undefined;

  return (
    <>
      <CourtScene game={gameId} netHit={netHit} />
      <div
        ref={stage}
        className="absolute inset-0 touch-none"
        // A named group, so its name (the game and its keys) is read; a plain div's aria-label is not.
        role="group"
        aria-label={
          two
            ? `${game.sport}, ${names[0]} against ${names[1]}. ${names[0]} moves with W A S D, ${names[1]} with the arrow keys.`
            : `${game.sport} with ${game.player}. Arrow keys or WASD move ${game.player}.`
        }
        onPointerDown={(e) => {
          // A press on a button (Leave, the score) is for the button: captured
          // by the stage, its click went to the stage instead, so Leave did
          // nothing for a mouse or a Chromebook trackpad.
          if (paused.current || (e.target as Element).closest("button, a, input")) return;
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
        {target && (
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: pctX(target.x),
              top: pctY(target.y),
              width: pctX(150 * scaleAtTarget),
              transform: `translate(-50%, -${Math.round(ANCHOR[gameId] * 100)}%)`,
              zIndex: 250 + Math.round((target.y / SCENE_H) * 100),
            }}
          >
            <TargetMark game={gameId} accent={game.accent} />
          </div>
        )}

        {/* The ball in the air, after a right answer. */}
        <div
          ref={flyer}
          aria-hidden
          className="pointer-events-none absolute"
          style={{ width: pctX(gameId === "volleyball" ? 46 : 36), zIndex: 450, opacity: 0, left: "-10%", top: "-10%" }}
        >
          {gameId === "volleyball" ? <Volleyball /> : <SoccerBall />}
        </div>

        {movers.current.map((m) => (
          <div
            key={m.side}
            ref={(el) => {
              bodies.current[m.side] = el;
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
            style={{ left: pctX(m.pos.x), top: pctY(m.pos.y), width: pctX(((m.height * 100) / 160) * depthScale(game.area, m.pos.y)), zIndex: 340 }}
          >
            {two ? (
              <Athlete key={moves[m.side]} kind={setup.kinds[m.side]} side={m.side} game={gameId} name={names[m.side]} pose={acting[m.side] ? "action" : "idle"} facing={m.facing} className="w-full" />
            ) : (
              <Player key={moves[m.side]} game={m.figure} pose={acting[m.side] ? "action" : "idle"} facing={m.facing} className="w-full" />
            )}
            {two && <SideMarks side={m.side} name={names[m.side]} />}
          </div>
        ))}

        {pop && (
          <p
            key={pop.key}
            aria-live="polite"
            className="pointer-events-none absolute -translate-x-1/2"
            style={{ left: pctX(pop.x), top: pctY(pop.y - 40), zIndex: 900 }}
          >
            <span
              className={`court-pop block whitespace-nowrap rounded-full px-3 py-1 text-base font-black tracking-tight shadow-lg ring-2 ring-white sm:px-4 sm:text-2xl ${two ? "text-white" : "text-slate-900"}`}
              style={{ background: pop.color }}
            >
              {pop.text}
            </span>
          </p>
        )}

        {/* HUD: the score or the take, and the way out. */}
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
        <GameHowTo id={two ? `court-match-${gameId}` : `court-${gameId}`} demo={demo}>
          {two ? (
            <>
              <span className="sm:hidden">Each player drags on their own half. First to {game.target} answers.</span>
              <span className="hidden sm:inline">
                {names[0]}: W A S D. {names[1]}: arrow keys. First to {game.target} answers. {topic}.
              </span>
            </>
          ) : (
            <>
              <span className="sm:hidden">Drag to move. Get to {game.target}.</span>
              <span className="hidden sm:inline">
                Arrows or WASD to move, drag on a phone. Get to {game.target}. Space for a move. {topic}, in your head.
              </span>
            </>
          )}
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
          continueLabel={two ? "Play on" : game.continueLabel}
          note={game.note}
          label={`${game.sport} problem`}
          turn={dialogTurn}
        />
      )}
    </>
  );
}

/** What to run to: a ring on the mat, a star, a ball. Each with a question mark over it. */
export function TargetMark({ game, accent }: { game: CourtGameId; accent: string }) {
  const badge = (
    <g className="rink-ring-mark">
      <rect x="55" y="0" width="40" height="28" rx="9" fill="#ffffff" />
      <text x="75" y="21" textAnchor="middle" fontSize="19" fontWeight="800" fill={accent === "#facc15" ? "#a16207" : accent} fontFamily="ui-sans-serif, system-ui">
        ?
      </text>
    </g>
  );
  if (game === "wrestling") {
    return (
      <svg viewBox="0 0 150 90" className="court-target w-full">
        <ellipse cx="75" cy="62" rx="60" ry="22" fill="none" stroke={accent} strokeWidth="7" />
        <ellipse cx="75" cy="62" rx="44" ry="15" fill={accent} opacity="0.2" />
        {badge}
      </svg>
    );
  }
  if (game === "cheer") {
    const star = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 16 : 40;
      return `${75 + Math.cos(a) * r},${62 + Math.sin(a) * r * 0.38}`;
    }).join(" ");
    return (
      <svg viewBox="0 0 150 90" className="court-target w-full">
        <ellipse cx="75" cy="62" rx="58" ry="21" fill={accent} opacity="0.22" />
        <polygon points={star} fill={accent} />
        {badge}
      </svg>
    );
  }
  if (game === "volleyball") {
    return (
      <svg viewBox="0 0 150 150" className="w-full" style={{ overflow: "visible" }}>
        <ellipse cx="75" cy="120" rx="34" ry="10" fill="#0f172a" opacity="0.28" className="court-target" />
        <g className="court-ball-float">
          <g transform="translate(51 40) scale(1.05)">
            <Volleyball raw />
          </g>
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 150 90" className="w-full">
      <ellipse cx="75" cy="66" rx="50" ry="17" fill={accent} opacity="0.25" className="court-target" />
      <g transform="translate(57 38)">
        <SoccerBall raw />
      </g>
      <g transform="translate(0 -4)">{badge}</g>
    </svg>
  );
}

/** A volleyball: white, with blue and yellow panels. `raw` draws it into an existing SVG. */
export function Volleyball({ raw = false }: { raw?: boolean }) {
  const g = (
    <g>
      <circle cx="22" cy="22" r="21" fill="#f8fafc" />
      <path d="M22 1 Q30 18 22 43 Q14 20 22 1Z" fill="#2563eb" opacity="0.9" />
      <path d="M2 16 Q22 26 42 16 Q40 28 22 30 Q6 28 2 16Z" fill="#facc15" opacity="0.9" />
      <circle cx="22" cy="22" r="21" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
    </g>
  );
  return raw ? g : <svg viewBox="0 0 44 44" className="w-full">{g}</svg>;
}

/** A soccer ball: white with black patches. */
export function SoccerBall({ raw = false }: { raw?: boolean }) {
  const g = (
    <g>
      <circle cx="18" cy="18" r="17" fill="#f8fafc" />
      <polygon points="18,11 24,15 22,22 14,22 12,15" fill="#111827" />
      <path d="M3 14 L8 13 L10 20 L5 24Z M33 14 L28 13 L26 20 L31 24Z M13 32 L15 27 L21 27 L23 32 Q18 35 13 32Z" fill="#111827" />
      <circle cx="18" cy="18" r="17" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
    </g>
  );
  return raw ? g : <svg viewBox="0 0 36 36" className="w-full">{g}</svg>;
}
