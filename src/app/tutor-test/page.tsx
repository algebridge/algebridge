"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import {
  QUESTIONS,
  SECTIONS,
  SECTION_REVIEW_SHARE,
  isRight,
  passMark,
  scoreTest,
  type Answers,
  type TestResult,
  type TutorQuestion,
} from "@/lib/tutor-test";
import { listResults, saveResult, type SavedResult } from "@/lib/tutor-test-store";

const DRAFT_KEY = "algebridge:tutor-test-draft";
type Stage = "intro" | "taking" | "done";

function readDraft(): Answers {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}
function writeDraft(a: Answers | null) {
  try {
    if (a) localStorage.setItem(DRAFT_KEY, JSON.stringify(a));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private window: the draft just is not kept */
  }
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function TutorTestPage() {
  const { user, profile, loading } = useAuth();
  const isAdmin = profile?.isAdmin ?? false;
  const isTutor = profile?.role === "tutor" || isAdmin;

  const [stage, setStage] = useState<Stage>("intro");
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [history, setHistory] = useState<SavedResult[]>([]);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    setHasDraft(Object.keys(readDraft()).length > 0);
  }, []);

  useEffect(() => {
    if (!isTutor) return;
    listResults().then(setHistory);
  }, [isTutor, saved]);

  const answered = useMemo(() => QUESTIONS.filter((q) => (answers[q.id] ?? "").trim() !== "").length, [answers]);

  function set(id: string, value: string) {
    setAnswers((a) => {
      const next = { ...a, [id]: value };
      writeDraft(next);
      return next;
    });
  }

  function start(resume: boolean) {
    setAnswers(resume ? readDraft() : {});
    if (!resume) writeDraft(null);
    setResult(null);
    setSaved(null);
    setStage("taking");
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    const left = QUESTIONS.length - answered;
    if (left > 0 && !window.confirm(`${left} question${left === 1 ? " is" : "s are"} blank and will count as wrong. Hand it in?`)) return;
    const r = scoreTest(answers);
    setResult(r);
    setStage("done");
    writeDraft(null);
    setHasDraft(false);
    window.scrollTo({ top: 0 });
    setSaved(await saveResult(r, answers));
  }

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user || !isTutor) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="page-title">Tutor check</h1>
        <p className="text-slate-600">This is the Algebra 1 check for AlgeBridge tutors. Sign in with a tutor account to take it.</p>
        <Link href={user ? "/tutor-hub" : "/login"} className="btn-primary inline-block">
          {user ? "Back to Tutor Hub" : "Sign in"}
        </Link>
      </div>
    );
  }

  if (stage === "intro") {
    const mine = history.filter((h) => h.userId === user.id);
    const best = mine.reduce<SavedResult | null>((b, h) => (!b || h.score > b.score ? h : b), null);
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <div>
          <Link href="/tutor-hub" className="text-sm font-semibold text-bridge-700 hover:underline">← Tutor Hub</Link>
          <h1 className="page-title mt-2">Algebra 1 tutor check</h1>
          <p className="mt-1 text-slate-600">
            Every AlgeBridge tutor takes this before helping students. It covers the whole Algebra 1 course, plus the part that
            makes tutoring different from knowing the math: spotting where a student went wrong.
          </p>
        </div>

        <div className="card space-y-3">
          <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <li><span className="font-semibold text-slate-900">{QUESTIONS.length} questions</span> in {SECTIONS.length} sections</li>
            <li><span className="font-semibold text-slate-900">Pass at {passMark()}</span> right ({Math.round((passMark() / QUESTIONS.length) * 100)}%)</li>
            <li>About 30 minutes, no time limit</li>
            <li>Pencil and paper, no calculator needed</li>
          </ul>
          <p className="text-sm text-slate-500">Your answers save on this device as you go. Your score goes to the AlgeBridge admins when you hand it in.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {hasDraft && (
              <button type="button" className="btn-primary" onClick={() => start(true)}>Pick up where you left off</button>
            )}
            <button type="button" className={hasDraft ? "btn-secondary" : "btn-primary"} onClick={() => start(false)}>
              {hasDraft ? "Start over" : mine.length ? "Take it again" : "Start the check"}
            </button>
          </div>
        </div>

        {best && (
          <div className="card text-sm text-slate-700">
            Your best so far: <span className="font-semibold text-slate-900">{best.score}/{best.total}</span>
            {best.passed ? " (passed)" : " (not passed yet)"}, {mine.length} attempt{mine.length === 1 ? "" : "s"}.
          </div>
        )}

        {isAdmin && <AdminResults rows={history} />}
      </div>
    );
  }

  if (stage === "done" && result) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <div className={`card text-center ${result.passed ? "ring-2 ring-emerald-300" : "ring-2 ring-amber-300"}`}>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{result.passed ? "Passed" : "Not passed yet"}</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{result.score}/{result.total}</p>
          <p className="mt-2 text-sm text-slate-600">
            {result.passed ? "You are cleared to tutor Algebra 1." : `You need ${passMark()} to pass. Look over the sections below and try again.`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {saved === null ? "Saving…" : saved ? "Saved. The admins can see this result." : "This result could not be saved. Tell Ivan your score."}
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900">By section</h2>
          <ul className="mt-3 space-y-2">
            {result.sections.map((s) => {
              const weak = s.right / s.total < SECTION_REVIEW_SHARE;
              return (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 text-slate-700">{s.title}</span>
                  {weak && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Review</span>}
                  <span className="w-12 text-right font-semibold text-slate-900">{s.right}/{s.total}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-4">
          {QUESTIONS.map((q, i) => (
            <QuestionCard key={q.id} q={q} n={i + 1} value={answers[q.id] ?? ""} graded />
          ))}
        </div>

        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => setStage("intro")}>Done</button>
          <Link href="/tutor-hub" className="btn-ghost">Back to Tutor Hub</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-28">
      <div>
        <h1 className="page-title">Algebra 1 tutor check</h1>
        <p className="mt-1 text-sm text-slate-500">Type numbers like −4, 2/3 or 64. Fractions are fine.</p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.id} className="space-y-4" aria-labelledby={`sec-${s.id}`}>
          <h2 id={`sec-${s.id}`} className="text-lg font-semibold text-slate-900">{s.title}</h2>
          {QUESTIONS.filter((q) => q.section === s.id).map((q) => (
            <QuestionCard key={q.id} q={q} n={QUESTIONS.indexOf(q) + 1} value={answers[q.id] ?? ""} onChange={(v) => set(q.id, v)} />
          ))}
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <div className="flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-slate-200 bg-surface p-3 shadow-2xl">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">{answered} of {QUESTIONS.length} answered</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-bridge-500 transition-all" style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} />
            </div>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={submit}>
            <Icon name="check" size={15} />
            Hand it in
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({ q, n, value, onChange, graded = false }: { q: TutorQuestion; n: number; value: string; onChange?: (v: string) => void; graded?: boolean }) {
  const right = graded && isRight(q, value);
  const blank = value.trim() === "";
  return (
    <div className={`card space-y-3 ${graded ? (right ? "ring-1 ring-emerald-300" : "ring-1 ring-rose-300") : ""}`}>
      <p className="text-slate-900">
        <span className="mr-2 font-semibold text-slate-500">{n}.</span>
        {q.prompt}
      </p>
      {q.work && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
          {q.work.map((line) => <p key={line}>{line}</p>)}
        </div>
      )}

      {q.kind === "choice" ? (
        <div className="grid gap-2" role="radiogroup" aria-label={`Question ${n}`}>
          {q.choices.map((c, i) => {
            const picked = value === String(i);
            const isKey = i === q.answer;
            const tone = graded
              ? isKey
                ? "border-emerald-400 bg-emerald-50"
                : picked
                  ? "border-rose-400 bg-rose-50"
                  : "border-slate-200"
              : picked
                ? "border-bridge-500 bg-bridge-50"
                : "border-slate-200 hover:border-slate-300";
            return (
              <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm text-slate-800 ${tone} ${graded ? "cursor-default" : ""}`}>
                <input
                  type="radio"
                  name={q.id}
                  className="mt-0.5 accent-bridge-600"
                  checked={picked}
                  disabled={graded}
                  onChange={() => onChange?.(String(i))}
                />
                <span>{c}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={graded}
            inputMode="text"
            autoComplete="off"
            aria-label={`Answer to question ${n}`}
            placeholder="Your answer"
            className="w-40 rounded-xl border border-slate-300 px-3 py-2 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
          />
          {graded && !right && <span className="text-sm text-slate-600">Answer: <span className="font-semibold text-slate-900">{q.answer}</span></span>}
        </div>
      )}

      {graded && (
        <p className={`text-sm ${right ? "text-emerald-800" : "text-rose-800"}`}>
          <span className="font-semibold">{right ? "Right." : blank ? "Left blank." : "Not quite."}</span> {q.why}
        </p>
      )}
    </div>
  );
}

function AdminResults({ rows }: { rows: SavedResult[] }) {
  // Latest attempt per person, with their best score beside it.
  const people = useMemo(() => {
    const by = new Map<string, { latest: SavedResult; best: number; attempts: number; passed: boolean }>();
    for (const r of rows) {
      const p = by.get(r.userId);
      if (!p) by.set(r.userId, { latest: r, best: r.score, attempts: 1, passed: r.passed });
      else {
        p.best = Math.max(p.best, r.score);
        p.attempts++;
        p.passed ||= r.passed;
      }
    }
    return [...by.values()];
  }, [rows]);

  return (
    <div className="card">
      <h2 className="font-semibold text-slate-900">Everyone&apos;s results</h2>
      <p className="mt-1 text-sm text-slate-500">Only admins see this.</p>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No one has handed it in yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {people.map((p) => {
            const weak = p.latest.sections.filter((s) => s.total && s.right / s.total < SECTION_REVIEW_SHARE).map((s) => s.title);
            return (
              <li key={p.latest.userId} className="py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-semibold text-slate-900">{p.latest.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {p.passed ? "Passed" : "Not yet"}
                  </span>
                  <span className="w-28 text-right text-slate-700">best {p.best}/{p.latest.total}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Last {p.latest.score}/{p.latest.total} on {when(p.latest.createdAt)}, {p.attempts} attempt{p.attempts === 1 ? "" : "s"}
                  {weak.length > 0 && `. Weak: ${weak.join(", ")}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
