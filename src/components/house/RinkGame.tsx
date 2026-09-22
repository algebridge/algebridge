"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { PromptText } from "@/components/PromptText";
import { Scratchpad } from "@/components/Scratchpad";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { Veronica } from "@/components/house/Veronica";
import { useSound } from "@/hooks/useSound";
import { awardRinkBridgeys, recordRinkRun } from "@/lib/bridgeys";
import { SCENE_H, SCENE_W, pctX, pctY } from "@/lib/dollhouse";
import { answerIsRight } from "@/lib/grading";
import { hueVars, unitHue } from "@/lib/hues";
import { today } from "@/lib/path";
import { stripVariantTag } from "@/lib/personalize";
import { clampToRink, onRink, pickRinkProblem, RINK, RINK_DAILY_CAP, rinkPayFor, rinkRemainingToday, rinkSkillIds, type RinkProblem } from "@/lib/rink";
import type { UserProgress } from "@/types";

/**
 * Skating with Veronica. Arrow keys or WASD skate (drag, on touch); the
 * floor is slippery on purpose. A glowing ring appears somewhere on the
 * rink; skate through it and a problem from one of your finished skills
 * pops up. Right answers pay Bridgeys, up to the day's cap.
 *
 * The loop runs on requestAnimationFrame and writes Veronica's transform
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

interface Ring {
  x: number;
  y: number;
  item: RinkProblem;
}

export function RinkGame({ progress, onExit, onUpdate }: { progress: UserProgress; onExit: () => void; onUpdate: () => void }) {
  const day = useRef(today()).current;
  const { playCorrect, playWrong } = useSound();

  const skater = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: RINK.cx, y: RINK.cy + 40 });
  const vel = useRef({ x: 0, y: 0 });
  const facing = useRef<1 | -1>(1);
  const keys = useRef(new Set<string>());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const seen = useRef(new Set<string>());

  const [ring, setRing] = useState<Ring | null>(null);
  const [open, setOpen] = useState<RinkProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<{ right: boolean; paid: number } | null>(null);
  const [spin, setSpin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [session, setSession] = useState({ solved: 0, earned: 0, run: 0 });
  const [remaining, setRemaining] = useState(() => rinkRemainingToday(progress, day));
  const source = rinkSkillIds(progress);

  const spawnRing = useCallback(() => {
    const item = pickRinkProblem(progress, seen.current);
    if (!item) {
      setRing(null);
      return;
    }
    seen.current.add(item.problem.prompt);
    if (seen.current.size > 40) seen.current = new Set([...seen.current].slice(-20));
    // Somewhere on the rink, a fair skate away from her.
    let x = RINK.cx;
    let y = RINK.cy;
    for (let tries = 0; tries < 20; tries += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.82;
      x = RINK.cx + Math.cos(a) * RINK.rx * r;
      y = RINK.cy + Math.sin(a) * RINK.ry * r;
      if (Math.hypot(x - pos.current.x, (y - pos.current.y) * 2.5) > 260) break;
    }
    setRing({ x, y, item });
  }, [progress]);

  useEffect(() => {
    spawnRing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!e.repeat) {
          setSpin((n) => n + 1);
          setSpinning(true);
          window.setTimeout(() => setSpinning(false), 720);
        }
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
  }, [onExit]);

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

      const p = pos.current;
      const v = vel.current;
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
        if (d > 24) {
          ax = dx / d;
          ay = dy / d;
        }
      }
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
      if (Math.abs(v.x) > 30) facing.current = v.x < 0 ? -1 : 1;

      const el = skater.current;
      if (el) {
        el.style.left = pctX(p.x);
        el.style.top = pctY(p.y);
        el.style.zIndex = String(300 + Math.round((p.y / SCENE_H) * 100));
        const svg = el.firstElementChild as HTMLElement | null;
        if (svg) {
          const s = Math.min(1, speed / MAX_SPEED);
          svg.style.transform = facing.current === -1 ? "scaleX(-1)" : "";
          svg.style.setProperty("--stride", `${Math.max(0.26, 0.9 - s * 0.6)}s`);
          svg.classList.toggle("veronica-moving", s > 0.06);
        }
      }

      // Through the ring?
      if (ring && Math.hypot(p.x - ring.x, (p.y - ring.y) * 1.6) < REACH) {
        paused.current = true;
        vel.current = { x: 0, y: 0 };
        keys.current.clear();
        pointer.current = null;
        setOpen(ring.item);
        setAnswer("");
        setVerdict(null);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ring]);

  // --- Answering -------------------------------------------------------------
  function check(given: string) {
    if (!open || verdict || !given.trim()) return;
    const right = answerIsRight(open.problem, given);
    if (right) {
      playCorrect();
      const { paid, remaining: left } = awardRinkBridgeys(open.skillId, day);
      setRemaining(left);
      setSession((s) => {
        const run = s.run + 1;
        recordRinkRun(run, day);
        return { solved: s.solved + 1, earned: s.earned + paid, run };
      });
      setVerdict({ right: true, paid });
      onUpdate();
    } else {
      playWrong();
      setSession((s) => ({ ...s, run: 0 }));
      setVerdict({ right: false, paid: 0 });
    }
  }

  function skateOn() {
    setOpen(null);
    setVerdict(null);
    paused.current = false;
    setRing(null);
    window.setTimeout(spawnRing, 400);
  }

  const problem = open?.problem;
  const skillHue = open ? unitHue(open.unitId) : null;

  return (
    <>
      {/* The rink's live layer, inside the stage. */}
      <div
        ref={stage}
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          if (paused.current) return;
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
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

        <div
          ref={skater}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
          style={{ left: pctX(pos.current.x), top: pctY(pos.current.y), width: pctX((HEIGHT * 100) / 160), zIndex: 340 }}
        >
          <Veronica key={spin} pose={spinning ? "spin" : "skate"} speed={0} className="w-full" />
        </div>

        {/* HUD: two chips, and the way out. Small, so the rink stays the picture. */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5 sm:left-3 sm:top-3 sm:gap-2">
          <Chip>
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
          </Chip>
          <Chip>
            <span className="tabular-nums">{remaining}</span>
            <span className="text-slate-500">of {RINK_DAILY_CAP} today</span>
          </Chip>
        </div>
        <button type="button" onClick={onExit} className="btn-secondary btn-sm absolute right-2 top-2 sm:right-3 sm:top-3">
          Leave
        </button>
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-md bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur-sm sm:bottom-3 sm:left-3 sm:right-auto">
          <span className="sm:hidden">Drag to skate. Go through the ring.</span>
          <span className="hidden sm:inline">
            {source.borrowed
              ? `Arrows or WASD to skate, drag on a phone. Unit ${source.unitNumber} problems, since your unit has none that work in the head.`
              : `Arrows or WASD to skate, drag on a phone. Space spins. Unit ${source.unitNumber} problems, in your head.`}
          </span>
        </p>
      </div>

      {/* The problem, over everything. Head math: nothing here needs paper. */}
      {open && problem && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Rink problem">
          <div style={skillHue ? hueVars(skillHue) : undefined} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="hue-banner flex items-center justify-between gap-3 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide">
                Unit {open.unitNumber} · {open.skillTitle}
              </p>
              <p className="flex items-center gap-1 text-xs font-semibold">
                <BridgeysLogo size={13} />+{rinkPayFor(open.skillId)}
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-500">In your head, or draw it out. No calculator on the ice.</p>
                <Scratchpad resetKey={`${open.skillId}:${problem.id}:${problem.prompt}`} />
              </div>
              <PromptText text={stripVariantTag(problem.prompt)} />
              {!verdict ? (
                problem.type === "multiple-choice" && problem.choices ? (
                  <div className="mt-4 grid gap-2">
                    {problem.choices.map((choice, i) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => check(choice)}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {choice}
                      </button>
                    ))}
                  </div>
                ) : (
                  <form
                    className="mt-4 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      check(answer);
                    }}
                  >
                    <input
                      autoFocus
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      inputMode="numeric"
                      aria-label="Your answer"
                      placeholder="Your answer"
                      className="field min-w-0 flex-1 text-lg"
                    />
                    <button type="submit" disabled={!answer.trim()} className="hue-solid rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-50">
                      Check
                    </button>
                  </form>
                )
              ) : (
                <div className="mt-4">
                  <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium ${verdict.right ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                    <Icon name={verdict.right ? "check" : "review"} size={18} className="shrink-0" />
                    <p>
                      {verdict.right
                        ? verdict.paid > 0
                          ? `Right. +${verdict.paid} Bridgeys.`
                          : "Right. The rink has paid its cap for today, so this one is for practice."
                        : `The answer was ${String(problem.answer)}.`}
                    </p>
                  </div>
                  {!verdict.right && <p className="mt-2 px-1 text-sm text-slate-600">{problem.explanation}</p>}
                  <button type="button" autoFocus onClick={skateOn} className="btn-primary mt-4 w-full">
                    Skate on
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-slate-800 backdrop-blur-sm sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs">
      {children}
    </span>
  );
}
