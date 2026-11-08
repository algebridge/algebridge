"use client";

import Link from "next/link";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref, type TextareaHTMLAttributes } from "react";
import { PracticeGate } from "@/components/PracticeGate";
import { ClassGate } from "@/components/SchoolModePanel";
import { PracticePanel } from "@/components/PracticePanel";
import { WorkedSteps } from "@/components/WorkedSteps";
import { MathText } from "@/components/PromptText";
import { Icon } from "@/components/Icon";
import { allUnits } from "@/data/curriculum";
import { createClient } from "@/lib/supabase/client";
import { MAX_IMAGES, misreadLines, takeScore, type ReviewedQuestion } from "@/lib/test-review";
import type { Skill } from "@/types";

/**
 * Test review: a photo of a graded test in, every lost point explained,
 * then practice on exactly those skills.
 *
 * One screen at a time (photo, cover your name, reading, check, grading,
 * results, practice), each with one big button, because the student is on a
 * phone with a bad test in hand and should never have to wonder what to do.
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

type Stage = "photo" | "crop" | "reading" | "check" | "grading" | "results" | "practice";
const STEPS = ["Photo", "Check", "Results", "Practice"] as const;
const STEP_OF: Record<Stage, number> = { photo: 0, crop: 0, reading: 1, check: 1, grading: 1, results: 2, practice: 3 };

/** The one big button on each screen. */
const PRIMARY = "btn-primary w-full min-h-[52px] rounded-[0.9rem] text-base";

/** Right answers per skill that fill the practice bar. */
const PRACTICE_GOAL = 5;

export default function TestReviewPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Learn from it</p>
        <h1 className="page-title">Test review</h1>
        <p className="page-subtitle">Photo in, every lost point explained, practice on what you missed.</p>
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
  const [stage, setStage] = useState<Stage>("photo");
  /** Every photo URL made this visit, so they can be freed when the page goes. */
  const [pages, setPages] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [score, setScore] = useState("");
  const [reader, setReader] = useState<"claude" | "openai" | "groq" | "local" | null | "unknown">("unknown");
  /** Photos waiting for the student to cover their name and the header (legal review M8). */
  const [pending, setPending] = useState<Pending[]>([]);
  /** How many pages of this batch are already cropped, for "Page 2 of 3". */
  const [croppedCount, setCroppedCount] = useState(0);
  const [opening, setOpening] = useState(false);
  /** The pages being read right now, shown under the scan line. */
  const [readingPages, setReadingPages] = useState<Pending[]>([]);
  /** Which page of this batch is being read, for "Page 2 of 3". */
  const [progress, setProgress] = useState<{ page: number; of: number } | null>(null);
  /** Pages read by the backup reader on this computer, which misreads more: the check step says so. */
  const [backupPages, setBackupPages] = useState(0);
  /** This page has taken over 20 seconds: say it keeps going by itself. */
  const [slow, setSlow] = useState(false);
  /** The free reader said "wait": seconds left of how many. */
  const [wait, setWait] = useState<{ left: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A plain note for the Check step (not an error): how far a stopped read got. */
  const [note, setNote] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [restored, setRestored] = useState(false);
  const [practiceSkill, setPracticeSkill] = useState<string | null>(null);
  const [rightBySkill, setRightBySkill] = useState<Record<string, number>>({});
  const croppedRef = useRef<Pending[]>([]);
  const stopWaitingRef = useRef(false);
  const runRef = useRef(0);
  /** The page read in flight, so Stop can cancel it. */
  const abortRef = useRef<AbortController | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const moveFocusRef = useRef(false);

  // What this tab had before a trip to a skill page, and which reader the server has.
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setText(saved.text ?? "");
      setScore(saved.score ?? "");
      setReview(saved.review ?? null);
      setRestored(Boolean(saved.review));
      if (saved.review) setStage("results");
      else if (saved.text?.trim()) setStage("check");
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
  urlsRef.current = [...pages, ...pending.map((p) => p.url)];
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // A new screen: its title gets focus (screen readers hear where they are) and the top comes into view.
  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;
    if ((topRef.current?.getBoundingClientRect().top ?? 0) < 0) topRef.current?.scrollIntoView({ block: "start" });
    titleRef.current?.focus({ preventScroll: true });
  }, [stage]);

  function go(next: Stage) {
    moveFocusRef.current = true;
    setStage(next);
  }

  /** New photos wait for a crop first: nothing is read until the student has covered the header. */
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setNote(null);
    const room = MAX_IMAGES - croppedRef.current.length - pending.length;
    if (room <= 0) {
      setError(`Up to ${MAX_IMAGES} pages per review. Review a longer test in two parts.`);
      return;
    }
    const list = Array.from(files).slice(0, room);
    setOpening(true);
    const ready: File[] = [];
    for (const f of list) {
      try {
        ready.push(await asBrowserImage(f));
      } catch {
        setError("That photo could not be opened here. Save it as a JPEG or PNG, or take a screenshot of it, and try again.");
      }
    }
    setOpening(false);
    if (!ready.length) return;
    setPending((prev) => [...prev, ...ready.map((file) => ({ file, url: URL.createObjectURL(file), top: DEFAULT_TOP, bottom: 0 }))]);
    go("crop");
  }

  function cropDone(keep: boolean) {
    const [first, ...rest] = pending;
    if (!first) return;
    setPending(rest);
    const done = keep ? [...croppedRef.current, first] : croppedRef.current;
    if (!keep) URL.revokeObjectURL(first.url);
    if (rest.length) {
      croppedRef.current = done;
      setCroppedCount(done.length);
      return;
    }
    croppedRef.current = [];
    setCroppedCount(0);
    if (done.length) void readPages(done);
    else go(text.trim() ? "check" : "photo");
  }

  async function readPages(list: Pending[]) {
    const run = ++runRef.current;
    const stopped = () => stopWaitingRef.current || runRef.current !== run;
    const fallback: Stage = text.trim() ? "check" : "photo";
    setError(null);
    setReadingPages(list);
    setPages((prev) => [...prev, ...list.map((p) => p.url)]);
    go("reading");
    try {
      const encoded: string[] = [];
      for (const p of list) {
        try {
          encoded.push(await shrink(p.file, p));
        } catch {
          setError("That photo format could not be opened here. Save it as a JPEG or PNG, or take a screenshot of it, and try again.");
          go("photo");
          return;
        }
      }
      // One page per request: each page shows its own progress, a page that
      // fails does not lose the others, and a long batch never sits in one
      // request. The free cloud reader allows a few pages a minute for all of
      // AlgeBridge; when it says "wait", the page waits where the student can
      // see it and tries again by itself, however long that is. Typing is
      // always one tap away.
      stopWaitingRef.current = false;
      const texts: string[] = [];
      let backupRead = 0;
      const failed: { page: number; error: string }[] = [];
      /** Puts what was read into the check screen: the score line into the score box, nothing past the limit unsaid. */
      const keep = () => {
        const { text: read, score: found } = takeScore(texts.join("\n"));
        const joined = [text, read].join("\n").split("\n").filter((l) => l.trim()).join("\n");
        setText(joined.slice(0, MAX_TEXT));
        if (found && !score.trim()) setScore(found);
        setBackupPages((n) => n + backupRead);
        setReview(null);
        return joined.length > MAX_TEXT;
      };
      for (let i = 0; i < encoded.length; i++) {
        setProgress({ page: i + 1, of: encoded.length });
        const got = await readOnePage(encoded[i], stopped);
        if (got === "stopped") {
          // "Stop and type it instead" keeps every page already read; a newer read replaces this one entirely.
          if (runRef.current === run && texts.length) {
            keep();
            setNote(`Stopped after ${texts.length} of ${encoded.length} pages. Type the rest from your paper, or add those pages again.`);
          }
          return;
        }
        if ("text" in got) {
          texts.push(got.text);
          if (got.backup) backupRead++;
        } else failed.push({ page: i + 1, error: got.error });
      }
      if (stopped()) return;
      if (!texts.length) {
        setError(failed[0]?.error ?? "That photo could not be read. Type the questions in instead.");
        go(fallback);
        return;
      }
      const cut = keep();
      if (failed.length) {
        const which = failed.map((f) => f.page).join(" and ");
        setError(`Page ${which} of ${encoded.length} could not be read: ${failed[0].error} The other pages are below. Add ${failed.length === 1 ? "that page" : "those pages"} again, or type ${failed.length === 1 ? "it" : "them"} in.`);
      } else if (cut) {
        setError("That is more than one review can take, so the last part was left off. Grade this part, then start a new review for the rest.");
      }
      go("check");
    } catch {
      if (stopped()) return;
      setError("Could not reach AlgeBridge. Check your connection and try again.");
      go(fallback);
    } finally {
      if (runRef.current === run) {
        setWait(null);
        setProgress(null);
        setSlow(false);
      }
    }
  }

  /**
   * Reads one page, waiting out the reader's "not yet" by itself. A 429 waits
   * as long as the server says, with no cap on tries; a server or network
   * failure is retried a few times with longer gaps; "not a test" and
   * "too blurry" are answers, not failures, so they come back at once.
   */
  async function readOnePage(image: string, stopped: () => boolean): Promise<{ text: string; holes: number; backup: boolean } | { error: string } | "stopped"> {
    let failures = 0;
    for (;;) {
      let res: Response | null = null;
      let data: { error?: string; text?: string; unreadableParts?: number; retryAfter?: number; provider?: string } = {};
      setSlow(false);
      const slowTimer = setTimeout(() => setSlow(true), 20000);
      // "Stop" cancels the page being read, so the pages before it come back at once.
      const abort = new AbortController();
      abortRef.current = abort;
      try {
        res = await fetch("/api/test-review/read", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({ images: [image] }),
          signal: abort.signal,
        });
        data = await res.json().catch(() => ({}));
      } catch {
        res = null;
      } finally {
        clearTimeout(slowTimer);
        setSlow(false);
        if (abortRef.current === abort) abortRef.current = null;
      }
      if (stopped()) return "stopped";
      if (res?.ok) return { text: data.text ?? "", holes: Number(data.unreadableParts) || 0, backup: data.provider === "local" };
      let wait = 0;
      if (res?.status === 429) wait = Math.max(5, Number(data.retryAfter) || 60);
      else if (!res || res.status >= 500) {
        if (res?.status === 503 && /key/i.test(data.error ?? "")) return { error: data.error ?? "Photo reading is not set up here." };
        if (failures >= 3) {
          return { error: res ? data.error ?? "That photo could not be read." : "Could not reach AlgeBridge. Check your connection and try again." };
        }
        wait = [10, 30, 60][failures++];
      } else return { error: data.error ?? "That photo could not be read. Type the questions in instead." };
      if (!(await waitOut(wait, stopped, setWait))) return "stopped";
    }
  }

  /** "Stop and type it instead": the wait ends here and the student types, keeping any page already read. */
  function stopWaiting() {
    stopWaitingRef.current = true;
    abortRef.current?.abort();
    setWait(null);
    setError(null);
    go("check");
  }

  function typeInstead() {
    setError(null);
    go("check");
  }

  /**
   * Grades the checked text. When the grader is busy (the free models are out
   * of their minute) the page waits where the student can see it and grades
   * again by itself; a dropped connection is retried a few times too.
   */
  async function analyze() {
    const run = ++runRef.current;
    const stopped = () => stopWaitingRef.current || runRef.current !== run;
    stopWaitingRef.current = false;
    const sendText = text.split("\n").filter((l) => l.trim()).join("\n");
    setError(null);
    setNote(null);
    setReview(null);
    setRestored(false);
    go("grading");
    let failures = 0;
    try {
      for (;;) {
        let res: Response | null = null;
        let data: { error?: string; retryAfter?: number } & Partial<Review> = {};
        try {
          res = await fetch("/api/test-review", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await authHeader()) },
            body: JSON.stringify({ text: sendText, score }),
          });
          data = await res.json().catch(() => ({}));
        } catch {
          res = null;
        }
        if (stopped()) return;
        if (res?.ok) {
          setReview(data as Review);
          setPracticeSkill(null);
          go("results");
          return;
        }
        let wait = 0;
        if (res?.status === 429 && Number(data.retryAfter) > 0) wait = Math.max(5, Number(data.retryAfter));
        else if (!res && failures < 3) wait = [5, 15, 30][failures++];
        else {
          setError(res ? data.error ?? "Something went wrong. Try again in a minute." : "Could not reach AlgeBridge. Check your connection and try again.");
          go("check");
          return;
        }
        if (!(await waitOut(wait, stopped, setWait))) return;
      }
    } finally {
      if (runRef.current === run) setWait(null);
    }
  }

  /** "Stop" while the grader is busy: back to the text, nothing lost. */
  function stopGrading() {
    stopWaitingRef.current = true;
    setWait(null);
    go("check");
  }

  /** Back to the Check step to add a page that failed, or more of the test. */
  function addPage() {
    setError(null);
    setNote(null);
    filesRef.current?.click();
  }

  function startOver() {
    stopWaitingRef.current = true;
    abortRef.current?.abort();
    setNote(null);
    pages.forEach((u) => URL.revokeObjectURL(u));
    pending.forEach((p) => URL.revokeObjectURL(p.url));
    croppedRef.current = [];
    setCroppedCount(0);
    setPages([]);
    setPending([]);
    setReadingPages([]);
    setText("");
    setScore("");
    setBackupPages(0);
    setReview(null);
    setError(null);
    setRestored(false);
    setRightBySkill({});
    setPracticeSkill(null);
    try {
      sessionStorage.removeItem(SAVED_KEY);
    } catch {
      /* nothing saved */
    }
    go("photo");
  }

  function practice(skillId: string | null) {
    setPracticeSkill(skillId);
    go("practice");
  }

  const canRead = reader !== null;
  const roomLeft = MAX_IMAGES - croppedCount - pending.length;
  // Practice: the review's skills, plus the one a "Practice this" asked for if it was not among them.
  const practiceIds = review ? review.practice.map((s) => s.id) : [];
  if (practiceSkill && !practiceIds.includes(practiceSkill)) practiceIds.push(practiceSkill);

  return (
    <div ref={topRef} className="max-w-2xl scroll-mt-20">
      <Stepper stage={stage} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a photo of your test"
        onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <input ref={filesRef} type="file" accept="image/*" multiple className="hidden" aria-label="Choose photos of your test"
        onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />

      {stage === "results" && review ? (
        <Results
          review={review}
          restored={restored}
          titleRef={titleRef}
          onPractice={practice}
          onFix={() => go("check")}
          onStartOver={startOver}
        />
      ) : stage === "practice" && review ? (
        <PracticeRun
          key={practiceSkill ?? "all"}
          ids={practiceIds}
          initial={practiceSkill}
          right={rightBySkill}
          onRight={(id) => setRightBySkill((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))}
          onBack={() => go("results")}
          titleRef={titleRef}
        />
      ) : (
        <section className="panel">
          <div className="p-5" aria-busy={stage === "grading" || stage === "reading" ? true : undefined}>
            {stage === "photo" && (
              <>
                <ScreenHead
                  titleRef={titleRef}
                  title="Snap your graded test"
                  sub="We find every lost point, show you why, and give you practice on just those skills."
                />
                {error && <p className="notice-error mt-3.5" role="alert">{error}</p>}
                <div className="mt-[18px] grid gap-2.5">
                  {canRead ? (
                    <>
                      <button type="button" className={PRIMARY} onClick={() => cameraRef.current?.click()} disabled={opening}>
                        <Icon name="camera" size={20} />
                        Take a photo
                      </button>
                      <button type="button" className="btn-secondary w-full" onClick={() => filesRef.current?.click()} disabled={opening}>
                        Choose from photos
                      </button>
                    </>
                  ) : (
                    <button type="button" className={PRIMARY} onClick={typeInstead}>
                      <Icon name="keyboard" size={20} />
                      Type my answers
                    </button>
                  )}
                </div>
                {opening && (
                  <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bridge-600 border-t-transparent" aria-hidden />
                    Opening your photo
                  </p>
                )}
                {canRead ? (
                  <p className="mt-3.5 flex gap-2.5 text-[13px] text-slate-600">
                    <Icon name="info" size={16} className="mt-px shrink-0 text-bridge-600" />
                    <span>Lay it flat in good light. Next you will hide your name, so it never leaves your phone.</span>
                  </p>
                ) : (
                  <p className="notice-info mt-3.5 text-sm">Photo reading is not set up here, so you type your answers in.</p>
                )}
              </>
            )}

            {stage === "crop" && pending[0] && (
              <CropStep
                key={pending[0].url}
                item={pending[0]}
                page={croppedCount + 1}
                of={croppedCount + pending.length}
                canAdd={roomLeft > 0}
                titleRef={titleRef}
                error={error}
                onChange={(top, bottom) => setPending((prev) => prev.map((p, i) => (i === 0 ? { ...p, top, bottom } : p)))}
                onDone={cropDone}
                onAdd={() => filesRef.current?.click()}
              />
            )}

            {stage === "reading" && (
              <ReadingScreen pages={readingPages} progress={progress} slow={slow} wait={wait} titleRef={titleRef} onStop={stopWaiting} />
            )}

            {stage === "check" && (
              <CheckScreen
                text={text}
                score={score}
                backupPages={backupPages}
                error={error}
                note={note}
                canAdd={canRead}
                onAddPage={addPage}
                titleRef={titleRef}
                hasPhotos={pages.length > 0}
                hasReview={Boolean(review)}
                onText={(t) => { setText(t); setRestored(false); }}
                onScore={setScore}
                onGrade={analyze}
                onRetake={startOver}
                onBack={() => go("results")}
              />
            )}

            {stage === "grading" && (
              <GradingScreen count={text.split("\n").filter((l) => l.trim()).length} wait={wait} titleRef={titleRef} onStop={stopGrading} />
            )}
          </div>
        </section>
      )}

      {(stage === "photo" || stage === "check") && (
        <p className="mt-3 px-1 text-xs text-slate-500">
          Photos are read once and not kept anywhere. The text and this review stay in this tab until you close it.
        </p>
      )}
      {stage === "photo" && canRead && (
        <p className="mt-2 px-1 text-[13px] text-slate-600">
          No photo?{" "}
          <button type="button" className="font-semibold text-bridge-700 hover:underline" onClick={typeInstead}>
            Type your answers instead
          </button>
        </p>
      )}
    </div>
  );
}

function Stepper({ stage }: { stage: Stage }) {
  const now = STEP_OF[stage];
  return (
    <ol className="mb-3.5 grid grid-cols-4 gap-1.5" aria-label={`Step ${now + 1} of 4: ${STEPS[now]}`}>
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i === now ? "step" : undefined}
          className={`flex flex-col gap-1.5 text-[11.5px] font-semibold ${i < now ? "text-bridge-700" : i === now ? "text-slate-900" : "text-slate-500"}`}
        >
          <span
            aria-hidden
            className={`h-1.5 rounded-full ${i < now ? "bg-bridge-600" : i === now ? "bg-bridge-600 ring-[3px] ring-bridge-100" : "bg-slate-200"}`}
          />
          {s}
        </li>
      ))}
    </ol>
  );
}

function ScreenHead({ title, sub, eyebrow, titleRef }: { title: string; sub?: string; eyebrow?: string; titleRef: Ref<HTMLHeadingElement> }) {
  return (
    <div>
      {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
      <h2 ref={titleRef} tabIndex={-1} className="text-[22px] font-bold leading-tight tracking-tight text-slate-900 focus:!outline-none">
        {title}
      </h2>
      {sub && <p className="mt-1.5 text-[14.5px] text-slate-600">{sub}</p>}
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
  // Only the part the student kept is drawn, so the covered name and header never leave the device.
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

/**
 * Counts a wait down on screen against the clock, not by counting ticks: a
 * hidden tab or a phone that slept fires timers late, and the next try should
 * still come when the wait is over. false when the student stopped it.
 */
async function waitOut(
  seconds: number,
  stopped: () => boolean,
  show: (w: { left: number; total: number } | null) => void
): Promise<boolean> {
  const end = Date.now() + seconds * 1000;
  for (;;) {
    if (stopped()) return false;
    const ms = end - Date.now();
    if (ms <= 0) break;
    show({ left: Math.ceil(ms / 1000), total: seconds });
    await new Promise((r) => setTimeout(r, Math.min(1000, ms)));
  }
  show(null);
  return !stopped();
}

/**
 * Chrome and Firefox cannot open an iPhone's HEIC photo. It is turned into a
 * JPEG here, in the browser (heic2any, loaded only when needed), before the
 * crop step, so the preview and the reader both get a normal image. The
 * photo's own rotation is kept.
 */
async function asBrowserImage(file: File): Promise<File> {
  const heic = /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!heic) return file;
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
}

interface Pending {
  file: File;
  url: string;
  /** Percent of the photo covered at the top and at the bottom. */
  top: number;
  bottom: number;
}

/** Names usually sit in the top strip of a test, so the first guess covers it. */
const DEFAULT_TOP = 10;
const MAX_TOP = 70;
const MAX_BOTTOM = 50;
/** The two covers never meet: at least a tenth of the page stays clear. */
const MAX_COVERED = 90;

/**
 * Before a photo is read, the student covers their name and the test's
 * header (legal review M8) by dragging two bars. The striped parts stay on
 * the device; only the clear strip is shrunk and sent.
 */
function CropStep({
  item, page, of, canAdd, error, titleRef, onChange, onDone, onAdd,
}: {
  item: Pending;
  page: number;
  of: number;
  canAdd: boolean;
  error: string | null;
  titleRef: Ref<HTMLHeadingElement>;
  onChange: (top: number, bottom: number) => void;
  onDone: (keep: boolean) => void;
  onAdd: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const tooMuch = item.top + item.bottom > 85;
  const last = page >= of;

  function set(edge: "top" | "bottom", value: number) {
    const max = edge === "top" ? MAX_TOP : MAX_BOTTOM;
    const other = edge === "top" ? item.bottom : item.top;
    const v = Math.round(Math.max(0, Math.min(max, MAX_COVERED - other, value)));
    if (edge === "top") onChange(v, item.bottom);
    else onChange(item.top, v);
  }

  function handle(edge: "top" | "bottom") {
    const value = item[edge];
    return {
      role: "slider",
      tabIndex: 0,
      "aria-label": edge === "top" ? "Top cover" : "Bottom cover",
      "aria-orientation": "vertical" as const,
      "aria-valuemin": 0,
      "aria-valuemax": edge === "top" ? MAX_TOP : MAX_BOTTOM,
      "aria-valuenow": value,
      "aria-valuetext": `${value} percent covered`,
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus({ preventScroll: true });
        e.preventDefault();
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const r = boxRef.current?.getBoundingClientRect();
        if (!r?.height) return;
        const p = ((e.clientY - r.top) / r.height) * 100;
        set(edge, edge === "top" ? p : 100 - p);
      },
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        const d = e.key === "ArrowDown" ? 2 : e.key === "ArrowUp" ? -2 : 0;
        if (!d) return;
        e.preventDefault();
        set(edge, value + (edge === "top" ? d : -d));
      },
    };
  }

  const pill = (
    <span className="relative inline-flex items-center gap-1.5 rounded-full bg-bridge-600 px-3 py-2 text-xs font-semibold text-white shadow-raised ring-bridge-300 group-focus-visible:ring-[3px]">
      <Icon name="chevrons-up-down" size={12} />
      Drag
    </span>
  );

  return (
    <>
      <ScreenHead
        titleRef={titleRef}
        eyebrow={of > 1 ? `Page ${page} of ${of}` : undefined}
        title="Cover your name"
        sub="Drag the top bar down past your name. Only the clear part is sent."
      />
      <div ref={boxRef} className="relative mx-auto mb-7 mt-6 w-full max-w-sm select-none">
        <div className="relative overflow-hidden rounded-lg border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt="Your test photo" draggable={false} className="block h-auto w-full" />
          <div className="tr-shade pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center text-xs font-semibold text-ink-200" style={{ height: `${item.top}%` }} aria-hidden>
            {item.top >= 6 && "Hidden, not sent"}
          </div>
          <div className="tr-shade pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center text-xs font-semibold text-ink-200" style={{ height: `${item.bottom}%` }} aria-hidden>
            {item.bottom >= 6 && "Hidden, not sent"}
          </div>
        </div>
        <div {...handle("top")} className="group absolute inset-x-0 flex h-11 -translate-y-1/2 cursor-ns-resize touch-none items-center justify-center focus:!outline-none" style={{ top: `${item.top}%` }}>
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-bridge-500" aria-hidden />
          {pill}
        </div>
        <div {...handle("bottom")} className="group absolute inset-x-0 flex h-11 translate-y-1/2 cursor-ns-resize touch-none items-center justify-center focus:!outline-none" style={{ bottom: `${item.bottom}%` }}>
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-bridge-500" aria-hidden />
          {pill}
        </div>
      </div>
      {tooMuch && <p className="notice-warn text-sm">That covers almost everything. Leave the questions and your answers in the clear part.</p>}
      {error && <p className="notice-error mt-3" role="alert">{error}</p>}
      <div className="mt-[18px] grid gap-2.5">
        <button type="button" className={PRIMARY} disabled={tooMuch} onClick={() => onDone(true)}>
          {last ? "Name is covered, read it" : "Name is covered, next page"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost w-full" onClick={onAdd} disabled={!canAdd}>
            Add another page
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => onDone(false)}>
            Skip this photo
          </button>
        </div>
      </div>
    </>
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

/** The photo being read, its covered parts striped, under a moving scan line. */
function ReadingScreen({
  pages,
  progress,
  slow,
  wait,
  titleRef,
  onStop,
}: {
  pages: Pending[];
  progress: { page: number; of: number } | null;
  slow: boolean;
  wait: { left: number; total: number } | null;
  titleRef: Ref<HTMLHeadingElement>;
  onStop: () => void;
}) {
  const first = pages[Math.max(0, (progress?.page ?? 1) - 1)] ?? pages[0];
  const many = pages.length > 1 && progress;
  return (
    <>
      <ScreenHead
        titleRef={titleRef}
        title="Reading your test"
        sub={many ? `Page ${progress.page} of ${progress.of}. It keeps going by itself.` : "It keeps going by itself. You can wait here."}
      />
      {first && (
        <div className={`relative mt-3.5 max-h-56 overflow-hidden rounded-lg border border-slate-200 ${wait ? "" : "tr-scan"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first.url} alt="" className="block h-auto w-full" />
          <div className="tr-shade absolute inset-x-0 top-0" style={{ height: `${first.top}%` }} aria-hidden />
          <div className="tr-shade absolute inset-x-0 bottom-0" style={{ height: `${first.bottom}%` }} aria-hidden />
        </div>
      )}
      {wait ? (
        <>
          <WaitNotice left={wait.left} total={wait.total} />
          <button type="button" className="btn-secondary mt-3 w-full" onClick={onStop}>
            Stop and type it instead
          </button>
        </>
      ) : (
        <ul role="status" aria-live="polite" className="mt-4 grid gap-2.5 text-sm">
          <li className="flex items-center gap-2.5 text-slate-900">
            <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-bridge-600 text-white" aria-hidden>
              <Icon name="check" size={13} />
            </span>
            Name covered
          </li>
          <li className="flex items-center gap-2.5 font-semibold text-slate-900">
            <span className="h-[22px] w-[22px] flex-none animate-spin rounded-full border-2 border-bridge-600 border-t-transparent" aria-hidden />
            {many ? `Reading page ${progress.page} of ${progress.of}` : "Reading the handwriting"}
          </li>
          {slow && <li className="text-slate-600">Still reading. At busy times a page can take a minute or two. It keeps going without you.</li>}
          <li className="flex items-center gap-2.5 text-slate-500">
            <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-slate-300" aria-hidden />
            You check what we read
          </li>
        </ul>
      )}
      {slow && !wait && (
        <button type="button" className="btn-secondary mt-3 w-full" onClick={onStop}>
          Stop and type it instead
        </button>
      )}
    </>
  );
}

/** "The free reader is busy": a countdown ring until the next try. */
function WaitNotice({ left, total, who = "reader" }: { left: number; total: number; who?: "reader" | "grader" }) {
  const safe = who === "reader" ? "Your photo is safe." : "Your text is safe.";
  const c = 2 * Math.PI * 22;
  return (
    <div className="notice-warn mt-3.5 flex items-center gap-3.5" role="status">
      <span className="sr-only">The free {who} is busy. Trying again soon. {safe}</span>
      <div className="relative h-[52px] w-[52px] flex-none" aria-hidden>
        <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
          <circle cx="26" cy="26" r="22" fill="none" strokeWidth="5" className="stroke-amber-500/30" />
          <circle
            cx="26" cy="26" r="22" fill="none" strokeWidth="5" strokeLinecap="round"
            className="stroke-amber-600 transition-[stroke-dashoffset] duration-1000 ease-linear"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - left / Math.max(1, total))}
          />
        </svg>
        <b className="absolute inset-0 grid place-items-center text-[15px] font-bold tabular-nums">{left > 99 ? `${Math.ceil(left / 60)}m` : left}</b>
      </div>
      <div aria-hidden>
        <b className="block">The free {who} is busy</b>
        {left > 120
          ? `It tries again by itself at ${new Date(Date.now() + left * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Keep this tab open. ${safe}`
          : `Trying again in ${left} s. ${safe}`}
      </div>
    </div>
  );
}

/**
 * One line of the transcript: wraps instead of cutting off on a phone and
 * grows with its text. Enter is handled by the screen (a new line below);
 * pasted lines split into lines of their own.
 */
function LineField({
  value, onChange, ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)} {...rest} className={`resize-none overflow-hidden ${rest.className ?? ""}`} />;
}

/** One plain question about a line the reader probably got wrong. */
function lineHint(line: string, n: number): string {
  if (/\[unreadable\]/i.test(line)) return `We could not read part of line ${n}. Type what your paper says.`;
  if (line.includes("==")) return `Line ${n} has "==". Is it one equals sign?`;
  if (line.includes("|")) return `Line ${n} has a "|". Is it a 1 or a slash?`;
  if (line.includes("#")) return `Line ${n} has a "#". What is it on your paper?`;
  return `Line ${n} was hard to read. Does it match your paper?`;
}

/** What was read, one question per line, each its own box: easier to fix on a phone than one big text box. */
function CheckScreen({
  text, score, backupPages, error, note, canAdd, hasPhotos, hasReview, titleRef, onText, onScore, onGrade, onRetake, onBack, onAddPage,
}: {
  text: string;
  score: string;
  backupPages: number;
  error: string | null;
  note: string | null;
  canAdd: boolean;
  onAddPage: () => void;
  hasPhotos: boolean;
  hasReview: boolean;
  titleRef: Ref<HTMLHeadingElement>;
  onText: (t: string) => void;
  onScore: (s: string) => void;
  onGrade: () => void;
  onRetake: () => void;
  onBack: () => void;
}) {
  const lines = text.split("\n");
  const flagged = new Set([...misreadLines(text), ...lines.flatMap((l, i) => (/\[unreadable\]/i.test(l) ? [i + 1] : []))]);
  const filled = lines.filter((l) => l.trim()).join("\n");
  // Counted from the text, so the notice goes as the student fills the holes in.
  const holes = (text.match(/\[unreadable\]/gi) ?? []).length;

  function setLines(next: string[]) {
    onText(next.join("\n").slice(0, MAX_TEXT));
  }
  // A new or removed line moves the caret right after React commits, before the next key lands.
  const focusNextRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (focusNextRef.current === null) return;
    document.getElementById(`tr-line-${focusNextRef.current}`)?.focus();
    focusNextRef.current = null;
  });
  function focusLine(i: number) {
    focusNextRef.current = i;
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      // A new line under a work line is a work line too.
      setLines([...lines.slice(0, i + 1), lines[i].match(/^\s*/)?.[0] ?? "", ...lines.slice(i + 1)]);
      focusLine(i + 1);
    } else if (e.key === "Backspace" && !lines[i].trim() && lines.length > 1) {
      e.preventDefault();
      setLines(lines.filter((_, k) => k !== i));
      focusLine(Math.max(0, i - 1));
    }
  }

  return (
    <>
      <ScreenHead titleRef={titleRef} title="Does this match your paper?" sub="Fix anything we got wrong. Tap a line to edit." />
      {note && <p className="notice-info mt-3.5 text-sm" role="status">{note}</p>}
      {holes > 0 && (
        <p className="notice-warn mt-3.5 text-sm">
          {holes} {holes === 1 ? "part is" : "parts are"} marked [unreadable]: too hard to read in the photo.
          Fill {holes === 1 ? "it" : "them"} in from your paper before you grade.
        </p>
      )}
      {backupPages > 0 && (
        <p className="notice-warn mt-3.5 text-sm" role="status">
          The online reader was busy, so {backupPages === 1 ? "a page was" : `${backupPages} pages were`} read by the backup reader, which makes more mistakes.
          Check every line against your paper, especially the steps you wrote under each question.
        </p>
      )}
      <div className="mt-3.5 grid gap-2">
        {lines.map((line, i) => {
          const flag = flagged.has(i + 1);
          // The reader indents the work under a question. On a phone those spaces
          // would eat the field, so they become a visual indent; the text keeps them.
          const lead = line.match(/^\s*/)?.[0] ?? "";
          const work = lead.length > 0;
          return (
            <Fragment key={i}>
              <div className="grid grid-cols-[28px_1fr] items-start gap-2">
                <label htmlFor={`tr-line-${i}`} className="pt-3 text-right text-xs font-semibold text-slate-500">
                  <span className="sr-only">Line </span>
                  {i + 1}
                </label>
                <LineField
                  id={`tr-line-${i}`}
                  className={`field font-mono text-[15px] leading-snug ${work ? "ml-4 w-[calc(100%-1rem)]" : ""} ${flag ? "border-amber-200 bg-amber-50" : ""}`}
                  value={line.slice(lead.length)}
                  onChange={(v) => setLines([...lines.slice(0, i), ...v.split("\n").map((part, k) => (k === 0 ? lead + part : part)), ...lines.slice(i + 1)])}
                  onKeyDown={(e) => onKey(e, i)}
                  placeholder={i === 0 && lines.length === 1 ? "1) 2x + 5 = 17   I wrote x = 11" : undefined}
                  aria-describedby={flag ? `tr-line-${i}-hint` : undefined}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="next"
                />
              </div>
              {flag && (
                <p id={`tr-line-${i}-hint`} className="notice-warn ml-9 px-2.5 py-2 text-[12.5px]">
                  {lineHint(line, i + 1)}
                </p>
              )}
            </Fragment>
          );
        })}
        <div className="flex flex-wrap gap-x-5">
          <button
            type="button"
            className="py-2 text-[13px] font-semibold text-bridge-700 hover:underline"
            onClick={() => { setLines([...lines, ""]); focusLine(lines.length); }}
          >
            + Add a question
          </button>
          {canAdd && (
            <button type="button" className="py-2 text-[13px] font-semibold text-bridge-700 hover:underline" onClick={onAddPage}>
              + Add a page
            </button>
          )}
        </div>
      </div>
      {text.length > 5000 && (
        <p className="text-right text-xs text-slate-500">{text.length} / {MAX_TEXT} characters. Review a long test in two parts.</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
        <label htmlFor="tr-score" className="text-[13px] font-semibold leading-tight text-slate-900">
          Score on the paper
          <span className="block font-normal text-slate-500">optional</span>
        </label>
        <input id="tr-score" className="field w-24" value={score} onChange={(e) => onScore(e.target.value)} placeholder="14/20" maxLength={40} inputMode="text" />
      </div>
      {error && <p className="notice-error mt-3.5" role="alert">{error}</p>}
      <div className="mt-[18px] grid gap-2.5">
        <button type="button" className={PRIMARY} onClick={onGrade} disabled={filled.trim().length < 10}>
          Grade my test
        </button>
        {hasReview && (
          <button type="button" className="btn-ghost w-full" onClick={onBack}>
            Back to my results
          </button>
        )}
        <button type="button" className="btn-ghost w-full" onClick={onRetake}>
          {hasPhotos ? "Retake photo" : "Start over"}
        </button>
      </div>
    </>
  );
}

function GradingScreen({
  count, wait, titleRef, onStop,
}: {
  count: number;
  wait: { left: number; total: number } | null;
  titleRef: Ref<HTMLHeadingElement>;
  onStop: () => void;
}) {
  if (wait) {
    return (
      <>
        <ScreenHead titleRef={titleRef} title={`Grading ${count} ${count === 1 ? "question" : "questions"}`} sub="It keeps going by itself. You can wait here." />
        <WaitNotice left={wait.left} total={wait.total} who="grader" />
        <button type="button" className="btn-secondary mt-3 w-full" onClick={onStop}>
          Stop and go back to my text
        </button>
      </>
    );
  }
  return (
    <div role="status">
      <h2 ref={titleRef} tabIndex={-1} className="flex items-center gap-2 font-semibold text-slate-900 focus:!outline-none">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bridge-600 border-t-transparent" aria-hidden />
        Grading {count} {count === 1 ? "question" : "questions"}
      </h2>
      <div className="mt-3 grid gap-2.5" aria-hidden>
        <div className="h-3 w-[70%] animate-pulse rounded-md bg-slate-100" />
        <div className="h-3 w-full animate-pulse rounded-md bg-slate-100" />
        <div className="h-3 w-[85%] animate-pulse rounded-md bg-slate-100" />
      </div>
      <p className="mt-3.5 text-[13px] text-slate-600">
        Usually a few seconds. The notes come from an AI reading your text, so if one looks off, your teacher&apos;s version wins.
      </p>
    </div>
  );
}

const STATUS_STYLE: Record<ReviewedQuestion["status"], { label: string; cls: string; dot: string }> = {
  correct: { label: "Correct", cls: "badge-success", dot: "bg-emerald-400" },
  wrong: { label: "Missed", cls: "badge-warn", dot: "bg-red-400" },
  partial: { label: "Partial", cls: "badge-warn", dot: "bg-amber-400" },
  unclear: { label: "Hard to read", cls: "badge-neutral", dot: "bg-slate-300" },
};

const isMissed = (q: ReviewedQuestion) => q.status === "wrong" || q.status === "partial";

function Results({
  review, restored, titleRef, onPractice, onFix, onStartOver,
}: {
  review: Review;
  restored: boolean;
  titleRef: Ref<HTMLHeadingElement>;
  onPractice: (skillId: string | null) => void;
  onFix: () => void;
  onStartOver: () => void;
}) {
  if (review.crisis) {
    return (
      <div className="space-y-3">
        <h2 ref={titleRef} tabIndex={-1} className="sr-only">Your review</h2>
        <section className="notice-error p-4">{review.message}</section>
        <button type="button" className="btn-ghost" onClick={onStartOver}>Start over</button>
      </div>
    );
  }
  const qs = review.questions;
  const missed = qs.filter(isMissed);
  const unclear = qs.filter((q) => q.status === "unclear");
  const right = qs.filter((q) => q.status === "correct");
  const clean = missed.length === 0 && unclear.length === 0;
  const skills = review.practice;
  const firstMissed = qs.findIndex(isMissed);
  const total = qs.length;
  const nQ = `${total} ${total === 1 ? "question" : "questions"}`;
  const headline =
    missed.length > 0 ? `${nQ}, ${missed.length} to fix`
    : unclear.length > 0 ? `${nQ}, ${unclear.length} hard to read`
    : `${nQ}, all correct`;
  const grade = review.score?.trim() || `${right.length}/${total}`;
  const share = total ? missed.length / total : 0;
  const tone =
    share > 0.5 ? "border-red-200 bg-red-50 text-red-700"
    : share === 0 || right.length / Math.max(1, total) >= 0.8 ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-800";
  const gradeSize = grade.length <= 2 ? "text-[38px]" : grade.length <= 4 ? "text-[26px]" : "text-lg";
  const ctaLabel = missed.length > 0 ? "Practice what I missed" : "Practice the same skills";
  const cta = (
    <button type="button" className={PRIMARY} onClick={() => onPractice(null)}>
      {ctaLabel}
      <Icon name="arrow-right" size={18} />
    </button>
  );

  return (
    <div>
      <section className="panel" aria-labelledby="tr-results-title">
        <div className="p-5">
          {restored && <p className="notice-info mb-4 text-sm">Your last review, from earlier in this tab.</p>}
          <div className="grid grid-cols-[auto_1fr] items-center gap-4">
            <div
              role="img"
              aria-label={review.score ? `Score ${grade}` : `${right.length} of ${total} right`}
              className={`grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-[20px] border px-1 text-center font-display leading-none ${gradeSize} ${tone}`}
            >
              {grade}
            </div>
            <div className="min-w-0">
              {review.subject && <p className="eyebrow mb-1 truncate">{review.subject}</p>}
              <h2 id="tr-results-title" ref={titleRef} tabIndex={-1} className="text-[19px] font-bold leading-tight tracking-tight text-slate-900 focus:!outline-none">
                {headline}
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5" aria-hidden>
                {qs.map((q, i) => (
                  <span key={i} className={`h-2 w-[22px] rounded-full ${STATUS_STYLE[q.status].dot}`} />
                ))}
              </div>
            </div>
          </div>
          {clean && (
            <p className="notice-success mt-4 text-sm">
              Nothing missed in what was read. Nice work. A quick round on the same skills keeps it that way.
            </p>
          )}
          {review.summary && (
            <div className="notice-info mt-4">
              <b className="mb-0.5 block">{missed.length > 0 ? "What cost you points" : "How it went"}</b>
              {review.summary}
            </div>
          )}
          {review.strengths.length > 0 && (
            <div className="notice-success mt-3">
              <b className="mb-0.5 block">What you did well</b>
              <ul className="list-disc pl-5">{review.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          {skills.length === 0 && (
            <p className="mt-4 text-sm text-slate-600">
              These questions did not match a skill in the course, so there is no practice set for them. The notes below still show what went wrong.
            </p>
          )}
          {skills.length > 0 && <div className="mt-[18px] hidden sm:block">{cta}</div>}
        </div>
      </section>

      <ol className="mt-3.5 grid gap-3" aria-label="Question by question">
        {qs.map((q, i) => (
          <QuestionCard key={i} q={q} n={i + 1} startOpen={i === firstMissed} onPractice={onPractice} onFix={onFix} />
        ))}
      </ol>
      <p className="mt-3 px-1 text-xs text-slate-500">
        The notes come from an AI reading your text and can be wrong. When a note and your teacher disagree, ask your teacher.
      </p>

      {skills.length > 0 && <div className="mt-4 hidden sm:block">{cta}</div>}
      {skills.length > 0 && (
        // On a phone, Archie's and the calculator's round buttons sit at the bottom right: the bar stops short of them.
        <div className="sticky bottom-0 z-10 -mx-4 mt-3.5 bg-gradient-to-b from-transparent to-slate-50 to-30% pb-4 pl-4 pr-[76px] pt-3 sm:hidden">
          {cta}
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-x-2">
        {/* A line the photo reader got wrong is fixed on the Check step, then graded again. */}
        <button type="button" className="btn-ghost" onClick={onFix}>Fix the text and grade again</button>
        <button type="button" className="btn-ghost" onClick={onStartOver}>Start over</button>
      </div>
    </div>
  );
}

/** Big mono for a short answer, normal text for a long one so it never spills out of its tile. */
const answerSize = (s: string) => (s.length <= 8 ? "font-mono text-2xl" : s.length <= 20 ? "font-mono text-lg" : "text-[15px]");

/**
 * One question, taught: what the problem was, what you wrote next to the
 * right answer, what you did, why it does not work, the right way with a
 * reason for each move, and a way to check. Empty parts are skipped.
 */
function QuestionCard({
  q, n, startOpen, onPractice, onFix,
}: {
  q: ReviewedQuestion;
  n: number;
  startOpen: boolean;
  onPractice: (skillId: string | null) => void;
  onFix: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const style = STATUS_STYLE[q.status];
  const missed = isMissed(q);
  const hit = q.skill ? SKILLS.get(q.skill) : undefined;
  const label = `Question ${q.number || n}`;
  const bodyId = `tr-q-${n}-more`;
  const shortProblem = q.problem.length <= 28;
  const hasSteps = Boolean(q.steps && q.steps.length > 0);

  return (
    <li>
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-surface" aria-label={label}>
        <header className="flex items-center justify-between gap-2.5 px-4 pt-3.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
          <span className={style.cls}>{style.label}</span>
        </header>
        <p className={`break-words px-4 pt-2 text-slate-900 ${shortProblem ? "font-mono text-[22px] font-semibold leading-snug" : "text-base font-medium leading-snug"}`}>
          <MathText text={q.problem} />
        </p>

        {q.status === "correct" && (
          <p className="mx-4 mb-4 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[15px] text-emerald-800">
            {q.studentAnswer ? (
              <>You wrote <strong className="font-mono"><MathText text={q.studentAnswer} /></strong>. Correct.</>
            ) : (
              "Correct."
            )}
          </p>
        )}

        {q.status === "unclear" && (
          <div className="notice-info mx-4 mb-4 mt-3 flex flex-wrap items-center justify-between gap-2">
            <p>{q.mistake ? `${q.mistake} ` : ""}We could not read this one. Fix it on the Check step and grade again.</p>
            <button type="button" className="btn-secondary btn-sm" onClick={onFix}>Fix it</button>
          </div>
        )}

        {missed && (
          <>
            {(q.studentAnswer || q.correctAnswer) && (
              <div className={`grid gap-2 px-4 pt-3 ${q.studentAnswer && q.correctAnswer ? "grid-cols-2" : "grid-cols-1"}`}>
                {q.studentAnswer && (
                  <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${q.status === "partial" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
                    <small className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider">You wrote</small>
                    <strong className={`block break-words leading-tight ${answerSize(q.studentAnswer)}`}><MathText text={q.studentAnswer} /></strong>
                  </div>
                )}
                {q.correctAnswer && (
                  <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-800">
                    <small className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider">Right answer</small>
                    <strong className={`block break-words leading-tight ${answerSize(q.correctAnswer)}`}><MathText text={q.correctAnswer} /></strong>
                  </div>
                )}
              </div>
            )}

            {!open && q.mistake && (
              <p className="line-clamp-2 px-4 pt-3 text-[15px] leading-relaxed text-slate-700"><MathText text={q.mistake} /></p>
            )}

            {open && (
              <div id={bodyId}>
                {q.mistake && (
                  <section className="px-4 pt-3.5">
                    <h3 className="mb-1 text-[13px] font-bold text-slate-900">What you did</h3>
                    <p className="text-[15px] leading-relaxed text-slate-700"><MathText text={q.mistake} /></p>
                  </section>
                )}
                {q.why && (
                  <section className="mx-4 mt-3.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-900">
                    <h3 className="mb-1 text-[13px] font-bold">Why that does not work</h3>
                    <p className="text-[15px] leading-relaxed"><MathText text={q.why} /></p>
                  </section>
                )}
                {hasSteps ? (
                  <section className="px-4 pt-3.5">
                    <h3 className="text-[13px] font-bold text-slate-900">The right way</h3>
                    <ol className="mt-2 grid gap-2.5">
                      {q.steps!.map((st, k) => (
                        <li key={k} className="grid grid-cols-[26px_1fr] gap-2.5">
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-bridge-50 text-xs font-bold text-bridge-700 ring-1 ring-inset ring-bridge-100" aria-hidden>
                            {k + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="block break-words font-mono text-base font-semibold text-slate-900"><MathText text={st.math} /></span>
                            {st.why && <span className="mt-0.5 block text-[13.5px] text-slate-600"><MathText text={st.why} /></span>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : (
                  q.fix && (
                    <section className="px-4 pt-3.5">
                      <h3 className="text-[13px] font-bold text-slate-900">The right way</h3>
                      <WorkedSteps text={q.fix} className="mt-2" />
                    </section>
                  )
                )}
                {q.check && (
                  <section className="mx-4 mt-3.5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-emerald-800">
                    <Icon name="check" size={18} className="mt-px shrink-0" />
                    <div>
                      <h3 className="text-[13px] font-bold">Check it</h3>
                      <p className="text-[14.5px] leading-relaxed"><MathText text={q.check} /></p>
                    </div>
                  </section>
                )}
                {hit && (
                  <footer className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
                    <Link href={`/learn/${hit.unitId}/${hit.skill.id}`} className="text-[13px] font-semibold text-bridge-700 hover:underline">
                      Lesson: {hit.skill.title}
                    </Link>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => onPractice(hit.skill.id)}>
                      Practice this
                    </button>
                  </footer>
                )}
                {!hit && <div className="h-4" />}
              </div>
            )}

            {!startOpen && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? bodyId : undefined}
                onClick={() => setOpen(!open)}
                className="mt-3.5 flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-[13px] font-semibold text-bridge-700 hover:bg-slate-50"
              >
                {open ? "Hide how to fix it" : "Show how to fix it"}
                <Icon name={open ? "chevron-up" : "plus"} size={16} />
              </button>
            )}
          </>
        )}
      </article>
    </li>
  );
}

const SKILLS = new Map<string, { skill: Skill; unitId: string }>(
  allUnits().flatMap((u) => u.skills.map((s) => [s.id, { skill: s, unitId: u.id }] as const))
);

/**
 * Practice on the review's skills, one skill at a time, with the course's
 * own practice panel: the same problems, grading, Bridgeys and streak as a
 * skill page, so this work counts everywhere practice counts.
 */
function PracticeRun({
  ids, initial, right, onRight, onBack, titleRef,
}: {
  ids: string[];
  initial: string | null;
  right: Record<string, number>;
  onRight: (skillId: string) => void;
  onBack: () => void;
  titleRef: Ref<HTMLHeadingElement>;
}) {
  const refs = ids.map((id) => SKILLS.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const [idx, setIdx] = useState(() => Math.max(0, refs.findIndex((r) => r.skill.id === initial)));
  if (refs.length === 0) {
    return (
      <section className="panel">
        <div className="p-5">
          <ScreenHead titleRef={titleRef} title="Nothing to practice" sub="These questions did not match a skill in the course." />
          <div className="mt-[18px] grid">
            <button type="button" className="btn-ghost w-full" onClick={onBack}>Back to my results</button>
          </div>
        </div>
      </section>
    );
  }
  const current = refs[Math.min(idx, refs.length - 1)];
  const nextRef = refs[idx + 1];
  const done = Math.min(PRACTICE_GOAL, right[current.skill.id] ?? 0);
  return (
    <section className="panel" aria-labelledby="tr-practice-title">
      <div className="p-5">
        <p className="eyebrow">From your test</p>
        <h2 id="tr-practice-title" ref={titleRef} tabIndex={-1} className="mt-1.5 text-[22px] font-bold leading-tight tracking-tight text-slate-900 focus:!outline-none">
          Practice: {current.skill.title}
        </h2>
        {refs.length > 1 && (
          <div className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-0.5" role="tablist" aria-label="Skills to practice">
            {refs.map((r, i) => (
              <button
                key={r.skill.id}
                type="button"
                role="tab"
                aria-selected={i === idx}
                onClick={() => setIdx(i)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${i === idx ? "border-bridge-600 bg-bridge-600 text-white" : "border-slate-200 bg-surface text-slate-700 hover:bg-slate-50"}`}
              >
                {r.skill.title}
              </button>
            ))}
          </div>
        )}
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Right answers on this skill"
          aria-valuemin={0}
          aria-valuemax={PRACTICE_GOAL}
          aria-valuenow={done}
        >
          <div className="h-full rounded-full bg-bridge-600 transition-[width] duration-300" style={{ width: `${(done / PRACTICE_GOAL) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[12.5px] text-slate-600">
          {done} of {PRACTICE_GOAL} done. Counts like any other practice.{" "}
          <Link href={`/learn/${current.unitId}/${current.skill.id}`} className="font-semibold text-bridge-700 hover:underline">
            Open the lesson
          </Link>
        </p>
        <div className="mt-3.5">
          <PracticePanel key={current.skill.id} skill={current.skill} onMasteryChange={() => onRight(current.skill.id)} />
        </div>
        {nextRef && (
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-secondary" onClick={() => setIdx(idx + 1)}>
              Next skill: {nextRef.skill.title}
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        )}
        <div className="mt-[18px] grid">
          <button type="button" className="btn-ghost w-full" onClick={onBack}>
            Back to my results
          </button>
        </div>
      </div>
    </section>
  );
}
