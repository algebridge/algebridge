"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useScratchpadSurface } from "@/components/Scratchpad";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { GameChip, GameProblemDialog } from "@/components/games/GameProblemDialog";
import { Player } from "@/components/games/Players";
import { CourtScene } from "@/components/games/Scenes";
import { useSound } from "@/hooks/useSound";
import { awardRinkBridgeys, recordGameRun } from "@/lib/bridgeys";
import { pctX, pctY, SCENE_H, SCENE_W } from "@/lib/dollhouse";
import { clampToArea, depthScale, getCourtGame, GOAL, inArea, spotAwayFrom, type CourtGameId } from "@/lib/games";
import { DAILY_GOAL } from "@/lib/gamification";
import { answerIsRight } from "@/lib/grading";
import { fireConfetti, showToast } from "@/lib/notify";
import { today } from "@/lib/path";
import { pickRinkProblem, RINK_DAILY_CAP, rinkRemainingToday, rinkSkillIds, type RinkProblem } from "@/lib/rink";
import type { UserProgress } from "@/types";

/**
 * A team game on its court: the same loop as the rink, with footing instead
 * of ice. Move with the arrows or WASD (drag on a phone) to the target; a
 * head-math problem from the unit you are on comes up; a right answer pays,
 * within the day's cap the games share, and the player does their move:
 * Shaurya's shot, Jo's jump, Jordyn's spike, Rayla's strike.
 *
 * The loop runs on requestAnimationFrame and writes the player's position
 * straight to the DOM; React only hears about what happens once.
 */

const MARGIN = 22;
const REACH = 52;
const ACTION_MS = 950;
/** When, into the move, the ball leaves: the hand at the top of the spike, the foot through the ball. */
const CONTACT_MS: Partial<Record<CourtGameId, number>> = { volleyball: 430, soccer: 400 };
/** Where each target's spot on the floor sits in its picture, from the top. */
const ANCHOR: Record<CourtGameId, number> = { wrestling: 62 / 90, cheer: 62 / 90, volleyball: 120 / 150, soccer: 66 / 90 };

interface Target {
  x: number;
  y: number;
  item: RinkProblem;
}

export function CourtGame({
  gameId,
  progress,
  onExit,
  onUpdate,
}: {
  gameId: CourtGameId;
  progress: UserProgress;
  onExit: () => void;
  onUpdate: () => void;
}) {
  const game = getCourtGame(gameId)!;
  const day = useRef(today()).current;
  const { playCorrect, playWrong } = useSound();

  const stage = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const pos = useRef({ ...game.start });
  const vel = useRef({ x: 0, y: 0 });
  const facing = useRef<1 | -1>(1);
  const keys = useRef(new Set<string>());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const paused = useRef(false);
  const seen = useRef(new Set<string>());

  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState<RinkProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<{ right: boolean; paid: number } | null>(null);
  const [move, setMove] = useState(0);
  const [acting, setActing] = useState(false);
  const [pop, setPop] = useState<{ text: string; key: number; x: number; y: number } | null>(null);
  const [netHit, setNetHit] = useState(false);
  const [session, setSession] = useState({ solved: 0, earned: 0, run: 0 });
  const [remaining, setRemaining] = useState(() => rinkRemainingToday(progress, day));
  const source = rinkSkillIds(progress);
  useScratchpadSurface(open ? `${open.skillId}:${open.problem.id}` : `court-${gameId}`);

  const spawnTarget = useCallback(() => {
    const item = pickRinkProblem(progress, seen.current);
    if (!item) {
      setTarget(null);
      return;
    }
    seen.current.add(item.problem.prompt);
    if (seen.current.size > 40) seen.current = new Set([...seen.current].slice(-20));
    const spot = spotAwayFrom(game.area, pos.current);
    setTarget({ ...spot, item });
  }, [progress, game.area]);

  useEffect(() => {
    spawnTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Their move, for a right answer or just for fun on the space bar. */
  const doMove = useCallback(() => {
    setMove((n) => n + 1);
    setActing(true);
    window.setTimeout(() => setActing(false), ACTION_MS - 60);
  }, []);

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
        if (!e.repeat) doMove();
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

      const p = pos.current;
      const v = vel.current;
      if (!paused.current) {
        let ax = 0;
        let ay = 0;
        const k = keys.current;
        if (k.has("arrowleft") || k.has("a")) ax -= 1;
        if (k.has("arrowright") || k.has("d")) ax += 1;
        if (k.has("arrowup") || k.has("w")) ay -= 1;
        if (k.has("arrowdown") || k.has("s")) ay += 1;
        if (pointer.current) {
          const dx = pointer.current.x - p.x;
          const dy = pointer.current.y - p.y;
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
        if (Math.abs(v.x) > 30) facing.current = v.x < 0 ? -1 : 1;
      } else {
        v.x = 0;
        v.y = 0;
      }

      const el = body.current;
      if (el) {
        const scale = depthScale(game.area, p.y);
        el.style.left = pctX(p.x);
        el.style.top = pctY(p.y);
        el.style.width = pctX(((game.height * 100) / 160) * scale);
        el.style.zIndex = String(300 + Math.round((p.y / SCENE_H) * 100));
        const svg = el.firstElementChild as SVGSVGElement | null;
        if (svg) {
          const s = Math.min(1, Math.hypot(v.x, v.y * 1.6) / game.maxSpeed);
          svg.style.setProperty("--stride", `${Math.max(0.26, 0.62 - s * 0.3)}s`);
          svg.classList.toggle("player-moving", s > 0.08);
          const flip = svg.querySelector<SVGGElement>(".p-flip");
          if (flip) flip.style.transform = facing.current === -1 ? "scale(-1, 1)" : "";
        }
      }

      // At the target?
      if (target && !paused.current && Math.hypot(p.x - target.x, (p.y - target.y) * 1.6) < REACH) {
        paused.current = true;
        keys.current.clear();
        pointer.current = null;
        setOpen(target.item);
        setAnswer("");
        setVerdict(null);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, game]);

  // --- Answering -------------------------------------------------------------
  function check(given: string) {
    if (!open || verdict || !given.trim()) return;
    const right = answerIsRight(open.problem, given);
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
      setVerdict({ right: false, paid: 0 });
    }
  }

  /**
   * Volleyball and soccer: the ball leaves her hand, or her foot, and goes
   * over the net or into the goal. Positions are in her picture's units
   * (100 by 160, feet at the bottom middle), scaled to the court.
   */
  function launch() {
    const el = flyer.current;
    if (!el || (gameId !== "volleyball" && gameId !== "soccer")) return;
    const p = pos.current;
    const unit = (game.height * depthScale(game.area, p.y)) / 160;
    const from =
      gameId === "volleyball"
        ? { x: p.x + 34 * unit * facing.current, y: p.y - 173 * unit }
        : { x: p.x + 24 * unit * facing.current, y: p.y - 14 * unit };
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

  function carryOn() {
    const wasRight = !!verdict?.right;
    setOpen(null);
    setVerdict(null);
    setTarget(null);
    if (!wasRight) {
      paused.current = false;
      window.setTimeout(spawnTarget, 350);
      return;
    }
    // The move, a cheer over their head, then the next target.
    doMove();
    const p = pos.current;
    setPop({ text: game.cheers[Math.floor(Math.random() * game.cheers.length)], key: Date.now(), x: p.x, y: p.y - game.height * depthScale(game.area, p.y) });
    const contact = CONTACT_MS[gameId];
    if (contact) window.setTimeout(launch, contact);
    window.setTimeout(() => {
      paused.current = false;
      spawnTarget();
    }, ACTION_MS);
  }

  const scaleAtTarget = target ? depthScale(game.area, target.y) : 1;

  return (
    <>
      <CourtScene game={gameId} netHit={netHit} />
      <div
        ref={stage}
        className="absolute inset-0 touch-none"
        aria-label={`${game.sport} with ${game.player}. Arrow keys or WASD move ${game.player}.`}
        onPointerDown={(e) => {
          if (paused.current) return;
          try {
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          } catch {
            /* a pointer the browser will not capture still steers */
          }
          pointer.current = scenePoint(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointer.current) pointer.current = scenePoint(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          pointer.current = null;
        }}
        onPointerCancel={() => {
          pointer.current = null;
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

        <div
          ref={body}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
          style={{ left: pctX(pos.current.x), top: pctY(pos.current.y), width: pctX(((game.height * 100) / 160) * depthScale(game.area, pos.current.y)), zIndex: 340 }}
        >
          <Player key={move} game={gameId} pose={acting ? "action" : "idle"} className="w-full" />
        </div>

        {pop && (
          <p
            key={pop.key}
            aria-live="polite"
            className="pointer-events-none absolute -translate-x-1/2"
            style={{ left: pctX(pop.x), top: pctY(pop.y - 40), zIndex: 900 }}
          >
            <span
              className="court-pop block whitespace-nowrap rounded-full px-3 py-1 text-base font-black tracking-tight text-slate-900 shadow-lg ring-2 ring-white sm:px-4 sm:text-2xl"
              style={{ background: game.accent }}
            >
              {pop.text}
            </span>
          </p>
        )}

        {/* HUD: two chips, and the way out. */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5 sm:left-3 sm:top-3 sm:gap-2">
          <GameChip>
            <BridgeysLogo size={13} />
            <span className="tabular-nums">+{session.earned}</span>
            <span aria-hidden className="text-slate-300">·</span>
            <span className="tabular-nums">{session.solved}</span>
            <span className="text-slate-500">solved</span>
            {session.run >= 2 && (
              <>
                <span aria-hidden className="text-slate-300">·</span>
                <Icon name="flame" size={12} className="text-amber-600" />
                <span className="tabular-nums">{session.run}</span>
              </>
            )}
          </GameChip>
          <GameChip>
            <span className="tabular-nums">{remaining}</span>
            <span className="text-slate-500">of {RINK_DAILY_CAP} today</span>
          </GameChip>
        </div>
        <button type="button" onClick={onExit} className="btn-secondary btn-sm absolute right-2 top-2 sm:right-3 sm:top-3">
          Leave
        </button>
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-md bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur-sm sm:bottom-3 sm:left-3 sm:right-auto">
          <span className="sm:hidden">Drag to move. Get to {game.target}.</span>
          <span className="hidden sm:inline">
            Arrows or WASD to move, drag on a phone. Get to {game.target}. Space for a move. Unit {source.unitNumber} problems, in your head.
          </span>
        </p>
      </div>

      {open && (
        <GameProblemDialog
          open={open}
          verdict={verdict}
          answer={answer}
          setAnswer={setAnswer}
          onCheck={check}
          onContinue={carryOn}
          continueLabel={game.continueLabel}
          note={game.note}
          label={`${game.sport} problem`}
        />
      )}
    </>
  );
}

/** What to run to: a ring on the mat, a star, a ball. Each with a question mark over it. */
function TargetMark({ game, accent }: { game: CourtGameId; accent: string }) {
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
function Volleyball({ raw = false }: { raw?: boolean }) {
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
function SoccerBall({ raw = false }: { raw?: boolean }) {
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
