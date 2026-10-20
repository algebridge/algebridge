"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Unit } from "@/types";
import { ARENA_MODES, BOSS_PAY, buildRound, finishRound, LIVES, recordArenaRight, SPEED_SECONDS, bestScore, type ArenaMode, type ArenaProblem } from "@/lib/arena";
import { answerIsRight, gradeAnswer } from "@/lib/grading";
import { skillOffersCalculator } from "@/data/problem-banks";
import { displayAnswer } from "@/lib/problem-utils";
import { getProgress, getSimpleStatus, getSkillProgress } from "@/lib/progress";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { useSound } from "@/hooks/useSound";
import { fireConfetti, showToast } from "@/lib/notify";
import { AnswerField, type AnswerFieldHandle } from "@/components/AnswerField";
import { PromptText, MathText } from "@/components/PromptText";
import { RunHud } from "@/components/RunHud";
import { Icon } from "@/components/Icon";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { DAILY_GOAL } from "@/lib/gamification";

type Phase = "ready" | "playing" | "over";

/**
 * One arena round on a unit: boss, speed or spot-the-mistake. Lives or a
 * clock, a combo that pays, and a score to beat.
 */
export function ArenaPlay({ unit, mode }: { unit: Unit; mode: ArenaMode }) {
  const access = useCourseAccess();
  const { playCombo, playBreak, playWrong, playLevelUp } = useSound();
  const [phase, setPhase] = useState<Phase>("ready");
  const [round, setRound] = useState<ArenaProblem[]>([]);
  const [i, setI] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [pay, setPay] = useState<{ amount: number; key: number } | null>(null);
  const [broke, setBroke] = useState<{ run: number; key: number } | null>(null);
  const [answer, setAnswer] = useState("");
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);
  const [left, setLeft] = useState(SPEED_SECONDS);
  const [result, setResult] = useState<{ best: boolean; bossPay: number; won: boolean } | null>(null);
  const [prevBest, setPrevBest] = useState(0);
  const field = useRef<AnswerFieldHandle>(null);
  const meta = ARENA_MODES[mode];

  const unitDone = access.ready && unit.skills.length > 0 && unit.skills.every((s) => getSimpleStatus(getSkillProgress(s.id).level) === "complete");
  const openCount = access.ready ? unit.skills.filter((s) => access.skill(s.id).open).length : 0;
  const locked = access.ready && (mode === "boss" ? !unitDone : openCount === 0);

  const start = useCallback(() => {
    const r = buildRound(unit, mode, (id) => access.skill(id).open);
    setRound(r);
    setI(0);
    setLives(LIVES);
    setScore(0);
    setCombo(0);
    setPay(null);
    setBroke(null);
    setAnswer("");
    setFlash(null);
    setReveal(null);
    setLeft(SPEED_SECONDS);
    setResult(null);
    setPrevBest(bestScore(getProgress(), unit.id, mode));
    setPhase(r.length ? "playing" : "over");
  }, [unit, mode, access]);

  const end = useCallback(
    (finalScore: number, won: boolean) => {
      const r = finishRound(unit.id, mode, finalScore, won);
      setResult({ ...r, won });
      setPhase("over");
      if (won || r.best) {
        fireConfetti(won && mode === "boss" ? "big" : "small");
        playLevelUp();
      }
    },
    [unit.id, mode, playLevelUp]
  );

  // The speed round's clock.
  useEffect(() => {
    if (mode !== "speed" || phase !== "playing") return;
    if (left <= 0) {
      end(score, true);
      return;
    }
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [mode, phase, left, score, end]);

  const problem = round[i];
  const calc = useMemo(() => {
    if (!problem) return false;
    const s = unit.skills.find((x) => x.id === problem.skillId);
    return s ? skillOffersCalculator(s.id, s.problems) : false;
  }, [problem, unit]);

  function advance(nextScore: number, nextLives: number) {
    window.setTimeout(() => {
      setFlash(null);
      setReveal(null);
      setAnswer("");
      if (nextLives <= 0) return end(nextScore, false);
      if (i + 1 >= round.length) return end(nextScore, true);
      setI((n) => n + 1);
      window.setTimeout(() => field.current?.focus(), 30);
    }, mode === "speed" ? 350 : reveal || problem?.check ? 1800 : 900);
  }

  function submit(given: string | number) {
    if (!problem || flash || phase !== "playing") return;
    let right: boolean;
    if (problem.check) right = (given === "right") === problem.check.right;
    else if (problem.type === "error-analysis") right = given === problem.wrongStepIndex;
    else if (problem.type === "multiple-choice") right = answerIsRight(problem, String(given));
    else {
      const v = gradeAnswer(problem, String(given), { expressions: calc });
      if (v === "simplify" || v === "unreadable") {
        showToast({ icon: "hint", tone: "info", title: "Type one number", description: "Like 12, -3, 2/3 or 0.75." });
        return;
      }
      right = v === "right";
    }
    if (right) {
      const run = combo + 1;
      setCombo(run);
      playCombo(run);
      const r = recordArenaRight(run);
      setPay({ amount: r.paid, key: Date.now() });
      if (r.dailyBonus > 0) showToast({ icon: "coin", tone: "reward", title: `Daily goal · +${r.dailyBonus} Bridgeys`, description: `${DAILY_GOAL} right today.` });
      setFlash("right");
      // Caught a mistake: say what it was, the way a teacher would.
      if (problem.check && !problem.check.right && problem.check.why) setReveal(problem.check.why);
      setScore(score + 1);
      advance(score + 1, lives);
    } else {
      if (combo >= 2) {
        setBroke({ run: combo, key: Date.now() });
        playBreak();
      } else playWrong();
      setCombo(0);
      setPay(null);
      setFlash("wrong");
      setReveal(problem.check ? (problem.check.right ? "That one was right." : problem.check.why ?? "That answer was a mistake.") : problem.type === "error-analysis" ? `Step ${(problem.wrongStepIndex ?? 0) + 1} was the wrong one.` : `It was ${displayAnswer(problem)}.`);
      // The speed round costs time, not lives.
      const nextLives = mode === "speed" ? lives : lives - 1;
      setLives(nextLives);
      advance(score, nextLives);
    }
  }

  if (!access.ready) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200/60" />;

  if (locked) {
    return (
      <div className="panel mx-auto max-w-lg px-6 py-10 text-center">
        <span className="hue-wash mx-auto flex h-12 w-12 items-center justify-center rounded-full">
          <Icon name="lock" size={22} />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">{mode === "boss" ? "The boss waits at the end" : "Open a skill first"}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {mode === "boss" ? `Finish every skill in Unit ${unit.number} to face it. Beating it pays ${BOSS_PAY} Bridgeys.` : `Start Unit ${unit.number} and this round opens.`}
        </p>
        <Link href={`/unit/${unit.id}`} className="btn-primary mt-6 inline-flex">Back to the unit</Link>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="arena-card mx-auto max-w-xl text-center">
        <p className="hue-ink text-xs font-semibold uppercase tracking-[0.08em]">Unit {unit.number} arena</p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{meta.title}</h1>
        <p className="mt-2 text-slate-600">{meta.line}</p>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "boss" && (getProgress().arena?.beaten.includes(unit.id) ? "Beaten. Play again for a perfect run." : `First win pays ${BOSS_PAY} Bridgeys.`)}
          {mode !== "boss" && `Best: ${bestScore(getProgress(), unit.id, mode)}`}
        </p>
        <button type="button" onClick={start} className="hue-solid mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-lg font-bold shadow-raised transition hover:brightness-110">
          <Icon name="play" size={18} />
          Start
        </button>
      </div>
    );
  }

  if (phase === "over") {
    const won = result?.won ?? false;
    const headline =
      mode === "boss" ? (won ? "Boss beaten" : "The boss won this time") : mode === "speed" ? `${score} in ${SPEED_SECONDS} seconds` : `${score} found`;
    return (
      <div className="arena-card mx-auto max-w-xl text-center">
        <p className="hue-ink text-xs font-semibold uppercase tracking-[0.08em]">{meta.title}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{round.length ? headline : "Nothing to play here yet"}</h1>
        {round.length > 0 && (
          <p className="mt-2 text-slate-600">
            {mode === "boss" ? `${score} of ${round.length} right.` : ""} {result?.best ? `New best, up from ${prevBest}.` : `Best: ${Math.max(prevBest, score)}.`}
          </p>
        )}
        {result && result.bossPay > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
            <BridgeysLogo size={15} />+{result.bossPay} Bridgeys
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={start} className="hue-solid inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold shadow-sm hover:brightness-110">
            Play again
          </button>
          <Link href={`/unit/${unit.id}`} className="btn-secondary">Back to the unit</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-panel">
        <span className="font-semibold text-slate-900">{meta.title}</span>
        {mode === "speed" ? (
          <span className={`arena-clock ${left <= 10 ? "arena-clock-low" : ""}`} aria-label={`${left} seconds left`}>
            <Icon name="clock" size={14} /> {left}s
          </span>
        ) : (
          <span className="inline-flex items-center gap-1" aria-label={`${lives} lives left`}>
            {Array.from({ length: LIVES }, (_, n) => (
              <span key={n} className={`arena-life ${n < lives ? "" : "arena-life-lost"}`} aria-hidden>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.2 1.7-2 3.2-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>
              </span>
            ))}
          </span>
        )}
        <span className="text-sm text-slate-500">
          {mode === "speed" ? `${score} right` : `${i + 1} of ${round.length}`}
        </span>
        <div className="ml-auto">
          <RunHud combo={combo} pay={pay} broke={broke} />
        </div>
      </div>

      {mode === "boss" && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-red-800">Unit {unit.number} boss</span>
          <div className="arena-boss-bar flex-1" role="meter" aria-label="Boss health" aria-valuemin={0} aria-valuemax={round.length} aria-valuenow={round.length - score}>
            <span style={{ width: `${Math.round((1 - score / Math.max(1, round.length)) * 100)}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-slate-500">{round.length - score} left</span>
        </div>
      )}

      <div key={i} className={`arena-card ${flash === "right" ? "arena-right" : flash === "wrong" ? "arena-wrong" : ""}`}>
        <PromptText text={problem.prompt} className="text-lg leading-relaxed text-slate-800" />
        {problem.check && (
          <>
            <ol className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-4 font-mono text-sm text-slate-800 ring-1 ring-slate-100">
              {problem.check.steps.map((step, n) => (
                <li key={n} className="flex gap-2">
                  <span className="text-slate-400">{n + 1}.</span>
                  <MathText text={step} />
                </li>
              ))}
            </ol>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={!!flash} onClick={() => submit("right")} className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 font-bold text-emerald-800 transition hover:border-emerald-400">
                Right
              </button>
              <button type="button" disabled={!!flash} onClick={() => submit("mistake")} className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 font-bold text-red-800 transition hover:border-red-400">
                Mistake
              </button>
            </div>
          </>
        )}
        {!problem.check && problem.type === "error-analysis" && problem.steps && (
          <div className="mt-4 space-y-2">
            {problem.steps.map((step, n) => (
              <button
                key={n}
                type="button"
                disabled={!!flash}
                onClick={() => submit(n)}
                className={`block w-full rounded-xl border px-4 py-3 text-left font-mono text-sm transition ${
                  flash && n === problem.wrongStepIndex ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-red-300 hover:bg-red-50"
                }`}
              >
                Step {n + 1}: <MathText text={step} />
              </button>
            ))}
          </div>
        )}
        {!problem.check && problem.type === "multiple-choice" && problem.choices && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {problem.choices.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!!flash}
                onClick={() => submit(c)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-left font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <MathText text={c} />
              </button>
            ))}
          </div>
        )}
        {!problem.check && problem.type === "numeric" && (
          <div className="mt-4 flex flex-wrap items-start gap-2">
            <AnswerField
              value={answer}
              onChange={setAnswer}
              onEnter={() => answer.trim() && submit(answer)}
              tone={flash === "right" ? "right" : flash === "wrong" ? "wrong" : "idle"}
              locked={!!flash}
              autoFocus
              handle={field}
              className="min-w-0 flex-1"
            />
            <button type="button" disabled={!answer.trim() || !!flash} onClick={() => submit(answer)} className="hue-solid rounded-xl px-5 py-3 font-bold disabled:opacity-50">
              Go
            </button>
          </div>
        )}
        {reveal && <p className={`mt-3 text-sm font-medium ${flash === "right" ? "text-emerald-700" : "text-red-700"}`}>{reveal}</p>}
      </div>
    </div>
  );
}
