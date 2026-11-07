"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { PracticeGate } from "@/components/PracticeGate";
import { ClassGate } from "@/components/SchoolModePanel";
import { PracticePanel } from "@/components/PracticePanel";
import { WorkedSteps } from "@/components/WorkedSteps";
import { MathText } from "@/components/PromptText";
import { Icon } from "@/components/Icon";
import { allUnits } from "@/data/curriculum";
import { createClient } from "@/lib/supabase/client";
import { MAX_IMAGES, misreadLines, type ReviewedQuestion } from "@/lib/test-review";
import type { Skill } from "@/types";

/**
 * Test review: a photo of a graded test in, every lost point explained,
 * then practice on exactly those skills.
 *
 * Nothing here is stored on a server. The photos are shrunk in the browser,
 * read once by /api/test-review/read and dropped; the transcript and the
 * review live in this tab (session storage, so a trip to a skill page and
 * back keeps them) and go when the tab closes.
 */

interface SkillRef {
  id: string;
  unitId: string;
  title: string;
}
interface Review {
  subject: string | null;
  score: string | null;
  summary: string | null;
  strengths: string[];
  questions: ReviewedQuestion[];
  skills: (SkillRef & { why: string })[];
  practice: SkillRef[];
  crisis?: boolean;
  message?: string;
}

const MAX_TEXT = 6000;
const SAVED_KEY = "algebridge:test-review";

export default function TestReviewPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Learn from it</p>
        <h1 className="page-title">Test review</h1>
        <p className="page-subtitle">
          Got a test back? Take a photo of it. AlgeBridge reads it, shows where each point went and why,
          then gives you practice on exactly what you missed, and it counts like any other practice.
        </p>
      </header>
      {/* The same switch as Archie: a teacher who turned off AI help turned this off too. */}
      <ClassGate feature="archie">
        <PracticeGate activity="review a test">
          <TestReview />
        </PracticeGate>
      </ClassGate>
    </div>
  );
}

/** The session's access token, so the server can count reviews per account. Empty without accounts. */
async function authHeader(): Promise<Record<string, string>> {
  const { data } = (await createClient()?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface Saved {
  text: string;
  score: string;
  review: Review | null;
}

function loadSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function TestReview() {
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [text, setText] = useState("");
  const [score, setScore] = useState("");
  const [reader, setReader] = useState<"claude" | "openai" | "groq" | "local" | null | "unknown">("unknown");
  /** Photos waiting for the student to cut off their name and the header (legal review M8). */
  const [pending, setPending] = useState<Pending[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [restored, setRestored] = useState(false);
  const croppedRef = useRef<Pending[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const textId = useId();
  const scoreId = useId();
  const misread = misreadLines(text);

  // What this tab had before a trip to a skill page, and which reader the server has.
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setText(saved.text ?? "");
      setScore(saved.score ?? "");
      setReview(saved.review ?? null);
      setRestored(Boolean(saved.review));
    }
    fetch("/api/test-review/read")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReader(d?.reader ?? null))
      .catch(() => setReader(null));
  }, []);

  useEffect(() => {
    try {
      if (text || review) sessionStorage.setItem(SAVED_KEY, JSON.stringify({ text, score, review } satisfies Saved));
    } catch {
      /* private mode or full: the page still works, it just forgets on navigation */
    }
  }, [text, score, review]);

  // Photo previews are freed when the page goes, not each time the list changes (a kept page would go blank).
  const urlsRef = useRef<string[]>([]);
  urlsRef.current = [...previews.map((p) => p.url), ...pending.map((p) => p.url)];
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  /** New photos wait for a crop first: nothing is read until the student has cut off the header. */
  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setReadNote(null);
    const room = MAX_IMAGES - previews.length - pending.length;
    if (room <= 0) {
      setError(`Up to ${MAX_IMAGES} pages per review. Review a longer test in two parts.`);
      return;
    }
    const list = Array.from(files).slice(0, room);
    setPending((prev) => [...prev, ...list.map((file) => ({ file, url: URL.createObjectURL(file), top: DEFAULT_TOP, bottom: 0 }))]);
  }

  function cropDone(keep: boolean) {
    const [first, ...rest] = pending;
    if (!first) return;
    setPending(rest);
    const done = keep ? [...croppedRef.current, first] : croppedRef.current;
    if (!keep) URL.revokeObjectURL(first.url);
    if (rest.length) {
      croppedRef.current = done;
      return;
    }
    croppedRef.current = [];
    if (done.length) void readPages(done);
  }

  async function readPages(list: Pending[]) {
    setReading(list.length > 1 ? `Reading ${list.length} pages. ` : "Reading your test. ");
    try {
      const encoded: string[] = [];
      for (const p of list) {
        try {
          encoded.push(await shrink(p.file, p));
        } catch {
          setError("That photo format could not be opened here. Save it as a JPEG or PNG, or take a screenshot of it, and try again.");
          return;
        }
      }
      setPreviews((prev) => [...prev, ...list.map((p) => ({ url: p.url, name: p.file.name }))].slice(0, MAX_IMAGES));
      const res = await fetch("/api/test-review/read", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ images: encoded }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That photo could not be read. Type the questions in instead.");
        return;
      }
      setText((prev) => [prev.trim(), data.text].filter(Boolean).join("\n\n").slice(0, MAX_TEXT));
      const holes = Number(data.unreadableParts) || 0;
      setReadNote(
        holes > 0
          ? `${holes} ${holes === 1 ? "part was" : "parts were"} too hard to read and ${holes === 1 ? "is" : "are"} marked [unreadable]. Fill those in from your paper before you review.`
          : "Read. Check it against your paper, handwriting is easy to misread, then review."
      );
      setReview(null);
    } catch {
      setError("Could not reach AlgeBridge. Check your connection and try again.");
    } finally {
      setReading(null);
    }
  }

  function removePreview(url: string) {
    setPreviews((prev) => prev.filter((p) => p.url !== url));
    URL.revokeObjectURL(url);
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    setReview(null);
    setRestored(false);
    try {
      const res = await fetch("/api/test-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ text, score }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Something went wrong. Try again in a minute.");
      else {
        setReview(data);
        requestAnimationFrame(() => resultsRef.current?.focus());
      }
    } catch {
      setError("Could not reach AlgeBridge. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setText("");
    setScore("");
    setReview(null);
    setError(null);
    setReadNote(null);
    setRestored(false);
    try {
      sessionStorage.removeItem(SAVED_KEY);
    } catch {
      /* nothing saved */
    }
  }

  const canRead = reader !== null;
  const working = busy || !!reading || pending.length > 0;

  return (
    <div className="space-y-6">
      <section className="panel space-y-4 p-5" aria-labelledby="tr-step-1">
        <div>
          <h2 id="tr-step-1" className="text-base font-semibold">1. Add your test</h2>
          <p className="text-sm text-slate-600">
            {canRead
              ? "A photo of each graded page, flat and in good light. Phone photos are fine, they are shrunk before they are sent."
              : "Type each question and the answer you wrote, one per line."}
          </p>
        </div>
        {reader === null && (
          <p className="notice-info text-sm">Photo reading is not set up on this server, so this page works from typed text here.</p>
        )}
        {canRead && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" onClick={() => cameraRef.current?.click()} disabled={working}>
              <Icon name="pen" size={16} />
              {previews.length ? "Add a page" : "Take a photo"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => filesRef.current?.click()} disabled={working}>
              Choose from photos
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a photo of your test"
              onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            <input ref={filesRef} type="file" accept="image/*" multiple className="hidden" aria-label="Choose photos of your test"
              onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          </div>
        )}
        {pending[0] && (
          <CropStep
            key={pending[0].url}
            item={pending[0]}
            left={pending.length}
            onChange={(top, bottom) => setPending((prev) => prev.map((p, i) => (i === 0 ? { ...p, top, bottom } : p)))}
            onDone={cropDone}
          />
        )}
        {previews.length > 0 && (
          <ul className="flex gap-2 overflow-x-auto py-1" aria-label="Pages added">
            {previews.map((p, i) => (
              <li key={p.url} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Test page ${i + 1}`} className="h-28 w-20 rounded-lg border border-slate-200 object-cover" />
                <button type="button" onClick={() => removePreview(p.url)} aria-label={`Remove page ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-slate-600 shadow ring-1 ring-slate-200 hover:text-slate-900">
                  <Icon name="close" size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div role="status" aria-live="polite" className="min-h-[1.25rem] text-sm text-slate-600">
          {reading && (
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-bridge-600" aria-hidden />
              {reading}This takes a few seconds. The reader can misread handwriting, so you get to check the text before anything is graded.
            </span>
          )}
          {!reading && readNote}
        </div>

        <div className="space-y-1">
          <label htmlFor={textId} className="block text-sm font-semibold">
            {canRead ? "2. What we read from your test" : "Your test, typed in"}
          </label>
          <p className="text-xs text-slate-500">
            {canRead ? "Fix anything that looks off, or type questions in yourself. " : ""}
            Leave your name out. Only this text is sent for review.
          </p>
          <textarea
            id={textId}
            className="field min-h-[180px] w-full font-mono text-sm"
            value={text}
            onChange={(e) => { setText(e.target.value.slice(0, MAX_TEXT)); setRestored(false); }}
            maxLength={MAX_TEXT}
            disabled={!!reading}
            placeholder={"1) Solve 2x + 5 = 17   student wrote: x = 11   [marked wrong]\n2) ..."}
          />
          {text.length > 5000 && <p className="text-right text-xs text-slate-500">{text.length} / {MAX_TEXT} characters. Review a long test in two parts.</p>}
        </div>
        {misread.length > 0 && !reading && (
          <p className="notice-warn text-sm">
            {misread.length === 1 ? "Line" : "Lines"} {misread.join(", ")} may be misread (stray symbols like ==, # or |).
            Fix {misread.length === 1 ? "it" : "them"} first so the review judges what you really wrote.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor={scoreId} className="block text-sm font-semibold">Your score (optional)</label>
            <input id={scoreId} className="field w-32" value={score} onChange={(e) => setScore(e.target.value)} placeholder="14/20" maxLength={40} inputMode="text" />
          </div>
          <button type="button" className="btn-primary" onClick={analyze} disabled={working || text.trim().length < 10}>
            {busy ? "Looking it over..." : "Review my test"}
          </button>
          {(text || previews.length > 0 || review) && !working && (
            <button type="button" className="btn-ghost" onClick={startOver}>Start over</button>
          )}
        </div>
        {busy && (
          <p role="status" className="text-sm text-slate-600">
            Working every question through. About half a minute. The explanations come from an AI reading your text, so if one looks off, your teacher&apos;s version wins.
          </p>
        )}
        <p className="text-xs text-slate-500">
          Photos are read once and not kept anywhere. The text and this review stay in this tab until you close it.
        </p>
        {error && <p className="notice-error" role="alert">{error}</p>}
      </section>

      {review && (
        <div ref={resultsRef} tabIndex={-1} className="outline-none">
          {restored && <p className="notice-info mb-3 text-sm">Your last review, from earlier in this tab.</p>}
          <Results review={review} />
        </div>
      )}
    </div>
  );
}

/**
 * A phone photo is 3 to 12 MB; the reader needs about 1600 px. JPEG at 0.85
 * keeps pencil legible. The bitmap honours the photo's orientation tag, so a
 * portrait shot stays upright. HEIC is decoded where the browser can (Safari);
 * elsewhere the <img> fallback throws and the page says what to do.
 */
async function shrink(file: File, crop: { top: number; bottom: number } = { top: 0, bottom: 0 }): Promise<string> {
  const source = await decode(file);
  // Only the part the student kept is drawn, so the cut-off name and header never leave the device.
  const sy = Math.round((source.height * crop.top) / 100);
  const sh = Math.max(1, Math.round((source.height * (100 - crop.top - crop.bottom)) / 100));
  const scale = Math.min(1, 1600 / Math.max(source.width, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(source, 0, sy, source.width, sh, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

interface Pending {
  file: File;
  url: string;
  /** Percent of the photo cut off at the top and at the bottom. */
  top: number;
  bottom: number;
}

/** Names usually sit in the top strip of a test, so the first guess cuts some of it. */
const DEFAULT_TOP = 15;

/**
 * Before a photo is read, the student cuts their name and the test's header
 * off (legal review M8). The dark parts stay on the device; only the light
 * part is shrunk and sent.
 */
function CropStep({ item, left, onChange, onDone }: { item: Pending; left: number; onChange: (top: number, bottom: number) => void; onDone: (keep: boolean) => void }) {
  const topId = useId();
  const bottomId = useId();
  const tooMuch = item.top + item.bottom > 85;
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3" role="group" aria-labelledby={`${topId}-title`}>
      <div>
        <h3 id={`${topId}-title`} className="text-sm font-semibold">
          Cut off your name{left > 1 ? ` (${left} photos to go)` : ""}
        </h3>
        <p className="text-xs text-slate-600">
          Slide until your name, your teacher&apos;s name, the class and the school are in the dark part. Only the light part is sent, and it is not kept.
        </p>
      </div>
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt="Your test photo" className="block h-auto w-full" />
        <div className="absolute inset-x-0 top-0 bg-black/70" style={{ height: `${item.top}%` }} aria-hidden />
        <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: `${item.bottom}%` }} aria-hidden />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label htmlFor={topId} className="text-xs font-medium">
          Cut from the top: {item.top}%
          <input id={topId} type="range" min={0} max={70} step={1} value={item.top} className="mt-1 block w-full"
            onChange={(e) => onChange(Number(e.target.value), item.bottom)} />
        </label>
        <label htmlFor={bottomId} className="text-xs font-medium">
          Cut from the bottom: {item.bottom}%
          <input id={bottomId} type="range" min={0} max={50} step={1} value={item.bottom} className="mt-1 block w-full"
            onChange={(e) => onChange(item.top, Number(e.target.value))} />
        </label>
      </div>
      {tooMuch && <p className="notice-warn text-xs">That cuts off almost everything. Leave the questions and your answers in the light part.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm" disabled={tooMuch} onClick={() => onDone(true)}>
          {left > 1 ? "Use this part, next photo" : "Use this part and read it"}
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => onDone(false)}>
          Skip this photo
        </button>
      </div>
    </div>
  );
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const STATUS_STYLE: Record<ReviewedQuestion["status"], { label: string; cls: string }> = {
  correct: { label: "Correct", cls: "badge-success" },
  wrong: { label: "Missed", cls: "badge-warn" },
  partial: { label: "Partial", cls: "badge-warn" },
  unclear: { label: "Hard to read", cls: "badge-neutral" },
};

function Results({ review }: { review: Review }) {
  const [practicing, setPracticing] = useState(false);
  if (review.crisis) return <section className="notice-error p-4">{review.message}</section>;
  const missed = review.questions.filter((q) => q.status === "wrong" || q.status === "partial");
  const unclear = review.questions.filter((q) => q.status === "unclear");
  const clean = missed.length === 0 && unclear.length === 0;
  const skills = review.practice;

  return (
    <div className="space-y-6">
      <section className="panel space-y-3 p-5" aria-labelledby="tr-summary">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tr-summary" className="text-xl font-bold">{review.subject ?? "Your test"}</h2>
          {review.score && <span className="text-lg font-semibold">{review.score}</span>}
        </div>
        <p className="text-sm text-slate-600">
          {review.questions.length} {review.questions.length === 1 ? "question" : "questions"} read,{" "}
          {missed.length === 0 ? "no lost points found" : `${missed.length} with lost points`}
          {unclear.length > 0 ? `, ${unclear.length} hard to read` : ""}.
        </p>
        {clean && (
          <p className="notice-success text-sm">
            Nothing missed in what was read. Nice work. A quick round on the same skills keeps it that way.
          </p>
        )}
        {review.summary && (
          <div>
            <h3 className="font-semibold">Why you got this score</h3>
            <p className="leading-relaxed">{review.summary}</p>
          </div>
        )}
        {review.strengths.length > 0 && (
          <div>
            <h3 className="font-semibold">What you did well</h3>
            <ul className="list-disc pl-5">{review.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        )}
        {skills.length > 0 && !practicing && (
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <button type="button" className="btn-primary" onClick={() => { setPracticing(true); requestAnimationFrame(() => document.getElementById("tr-practice")?.scrollIntoView({ block: "start" })); }}>
              {missed.length > 0 ? "Practice these" : "Practice the same skills"}
              <Icon name="arrow-right" size={16} />
            </button>
            <p className="text-sm text-slate-600">
              {skills.length === 1 ? "1 skill" : `${skills.length} skills`}: {skills.map((s) => s.title).join(", ")}
            </p>
          </div>
        )}
        {skills.length === 0 && (
          <p className="text-sm text-slate-600">
            These questions did not match a skill in the course, so there is no practice set for them. The question notes below still show what went wrong.
          </p>
        )}
      </section>

      {practicing && skills.length > 0 && <PracticeRun skills={skills} />}

      <section className="panel p-5" aria-labelledby="tr-questions">
        <h2 id="tr-questions" className="mb-3 text-lg font-bold">Question by question</h2>
        <ol className="space-y-3">
          {review.questions.map((q, i) => (
            <li key={i} className="card space-y-1.5 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{q.number && `${q.number}. `}<MathText text={q.problem} /></p>
                <span className={`${STATUS_STYLE[q.status].cls} shrink-0`}>{STATUS_STYLE[q.status].label}</span>
              </div>
              {q.studentAnswer && <p className="text-sm">Your answer: <span className="font-mono">{q.studentAnswer}</span></p>}
              {q.status !== "correct" && q.correctAnswer && <p className="text-sm">Right answer: <span className="font-mono">{q.correctAnswer}</span></p>}
              {q.mistake && q.status !== "unclear" && <p className="text-sm"><span className="font-semibold">Where it slipped:</span> {q.mistake}</p>}
              {q.status === "unclear" && (
                <p className="text-sm text-slate-600">
                  {q.mistake ? `${q.mistake} ` : ""}This one may have been misread. Fix it in the text box above and review again.
                </p>
              )}
              {q.fix && q.status !== "correct" && q.status !== "unclear" && (
                <div className="text-sm">
                  <p className="font-semibold">The right way through it:</p>
                  <WorkedSteps text={q.fix} className="mt-1" />
                </div>
              )}
              {q.skill && (
                <SkillLink id={q.skill} />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          The notes come from an AI reading the text above and can be wrong. When a note and your teacher disagree, ask your teacher.
        </p>
      </section>
    </div>
  );
}

const SKILLS = new Map<string, { skill: Skill; unitId: string }>(
  allUnits().flatMap((u) => u.skills.map((s) => [s.id, { skill: s, unitId: u.id }] as const))
);

function SkillLink({ id }: { id: string }) {
  const hit = SKILLS.get(id);
  if (!hit) return null;
  return (
    <p className="text-xs">
      <Link href={`/learn/${hit.unitId}/${id}`} className="font-semibold text-bridge-700 hover:underline">
        Lesson: {hit.skill.title}
      </Link>
    </p>
  );
}

/**
 * Practice on the review's skills, one skill at a time, with the course's
 * own practice panel: the same problems, grading, Bridgeys and streak as a
 * skill page, so this work counts everywhere practice counts.
 */
function PracticeRun({ skills }: { skills: SkillRef[] }) {
  const [idx, setIdx] = useState(0);
  const refs = skills.map((s) => SKILLS.get(s.id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (refs.length === 0) return null;
  const current = refs[Math.min(idx, refs.length - 1)];
  const nextRef = refs[idx + 1];
  return (
    <section id="tr-practice" className="panel p-5 scroll-mt-20" aria-labelledby="tr-practice-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="tr-practice-title" className="text-lg font-bold">Practice: {current.skill.title}</h2>
        <Link href={`/learn/${current.unitId}/${current.skill.id}`} className="text-sm font-semibold text-bridge-700 hover:underline">
          Open the lesson
        </Link>
      </div>
      {refs.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Skills to practice">
          {refs.map((r, i) => (
            <button
              key={r.skill.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${i === idx ? "bg-bridge-600 text-white ring-bridge-600" : "bg-surface text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
            >
              {i + 1}. {r.skill.title}
            </button>
          ))}
        </div>
      )}
      <PracticePanel key={current.skill.id} skill={current.skill} />
      {nextRef && (
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-secondary" onClick={() => setIdx(idx + 1)}>
            Next skill: {nextRef.skill.title}
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
