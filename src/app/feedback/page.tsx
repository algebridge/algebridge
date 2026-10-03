"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { CrisisCard } from "@/components/helper/CrisisCard";
import { CRISIS_REPLY, detectCrisis } from "@/lib/helper";
import { StarGlyph, StarRating, StarsDisplay, starCountLabel } from "@/components/StarRating";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * A place to say what's working, what's confusing and what's wrong, from
 * anyone, signed in or not. A problem card links here with the problem
 * already filled in.
 *
 * Reviews live here too: "Leave a review" at the top of the list, and an
 * offer to leave one right after any other feedback is sent. A review is 1 to
 * 5 stars plus a few words on why. Only the AlgeBridge team reads them (the
 * admin console); they are never posted anywhere.
 *
 * Whatever a student writes here is also read for signs they are in danger
 * (detectCrisis, the same list Archie uses). Feedback is not read right away,
 * so the crisis card is shown with it: a trusted adult, 988 and the Crisis
 * Text Line. The feedback itself is still sent, as the student asked.
 */

const KINDS: { id: string; label: string; hint: string }[] = [
  { id: "review", label: "Leave a review", hint: "Rate AlgeBridge from 1 to 5 stars and say why." },
  { id: "problem", label: "A problem reads wrong", hint: "Awkward wording, a wrong answer key, a story that makes no sense." },
  { id: "broken", label: "Something is broken", hint: "A button, a page, a save that went missing." },
  { id: "confusing", label: "Something is confusing", hint: "You were unsure what to do next." },
  { id: "idea", label: "An idea", hint: "Something you wish AlgeBridge did." },
  { id: "love", label: "Something you like", hint: "Worth knowing what to keep." },
  { id: "other", label: "Something else", hint: "" },
];

type State = "idle" | "sending" | "sent" | "email";
type Outcome = "ok" | "slow-down" | "email";

const MAX = 2000;
const SLOW_DOWN = "That is a lot of feedback in a short time. Give it a few minutes.";
const CRISIS_NOTE =
  "Feedback is read by the AlgeBridge team, but not right away, so please reach a real person who can help you now.";

/** The crisis card, focused when it appears so a screen reader reads it out. */
function FeedbackCrisis() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="scroll-mt-28 focus-visible:outline-none">
      <CrisisCard reply={CRISIS_REPLY} voice="plain" note={CRISIS_NOTE} />
    </div>
  );
}

// After a review, this device stops offering another one for a while.
const REVIEWED_KEY = "algebridge-reviewed-at";
const REVIEW_QUIET_DAYS = 90;

function rememberReview() {
  try {
    window.localStorage.setItem(REVIEWED_KEY, String(Date.now()));
  } catch {
    /* private mode: the offer just shows again next time */
  }
}

function reviewedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(REVIEWED_KEY));
    return at > 0 && Date.now() - at < REVIEW_QUIET_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

async function sessionToken(): Promise<string> {
  try {
    const { data } = (await createClient()?.auth.getSession()) ?? { data: { session: null } };
    return data.session?.access_token ?? "";
  } catch {
    return ""; // signed out is fine
  }
}

async function postFeedback(payload: {
  kind: string;
  message: string;
  contact: string;
  page: string;
  rating?: number;
}): Promise<Outcome> {
  const token = await sessionToken();
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, token }),
    });
    const data = (await res.json()) as { ok: boolean; reason?: string };
    if (data.ok) return "ok";
    if (data.reason === "slow-down") return "slow-down";
    // The table is missing or the request was refused: email carries it instead.
    return "email";
  } catch {
    return "email";
  }
}

function mailtoFor(kind: string, message: string, page: string, contact: string, rating: number): string {
  const subject = kind === "review" ? "AlgeBridge review" : `AlgeBridge feedback (${kind})`;
  const stars = kind === "review" && rating ? `Rating: ${rating} of 5 stars\n\n` : "";
  const body = `${stars}${message}\n\n${page ? `Page: ${page}\n` : ""}${contact ? `Contact: ${contact}\n` : ""}`;
  return `mailto:support@algebridge.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function EmailFallback({ href }: { href: string }) {
  return (
    <div className="notice-info">
      <p className="font-medium">Sending straight from here is off right now.</p>
      <p className="mt-1">
        Your message is ready to go by email instead, word for word.{" "}
        <a href={href} className="font-semibold underline">
          Open it in your mail app
        </a>
        .
      </p>
    </div>
  );
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const [kind, setKind] = useState("problem");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [page, setPage] = useState("");
  const [rating, setRating] = useState(0);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ kind: string; rating: number } | null>(null);
  const [offerReview, setOfferReview] = useState(false);
  /** What the student wrote sounded like they are in danger. */
  const [crisis, setCrisis] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const k = q.get("kind");
    if (k && KINDS.some((x) => x.id === k)) setKind(k);
    const about = q.get("about");
    if (about) {
      setPage(about);
      setMessage(`About: ${about}\n\n`);
    } else if (document.referrer) {
      setPage(document.referrer);
    }
  }, []);

  const isReview = kind === "review";
  const ready = message.trim().length >= 3 && (!isReview || rating > 0);
  const replyTo = contact.trim() || (user?.email ?? "");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || state === "sending") return;
    // Read before anything else, so the help shows whatever happens to the send.
    const worried = !!detectCrisis(message);
    setCrisis(worried);
    setState("sending");
    setError(null);
    const outcome = await postFeedback({
      kind,
      message: message.trim(),
      contact: replyTo,
      page,
      ...(isReview ? { rating } : {}),
    });
    if (outcome === "ok") {
      if (isReview) rememberReview();
      setSent({ kind, rating: isReview ? rating : 0 });
      setOfferReview(!isReview && !worried && !reviewedRecently());
      setState("sent");
      return;
    }
    if (outcome === "slow-down") {
      setError(SLOW_DOWN);
      setState("idle");
      return;
    }
    setState("email");
  }

  function startOver(nextKind: string) {
    setMessage("");
    setRating(0);
    setKind(nextKind);
    setSent(null);
    setCrisis(false);
    setState("idle");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="eyebrow">Help</p>
        <h1 className="page-title mt-1">Feedback</h1>
        <p className="page-subtitle">
          What is working, what is confusing, what reads wrong. Everything here goes to the people who build AlgeBridge,
          and a problem that reads badly gets fixed for everyone.
        </p>
      </header>

      {state === "sent" && sent ? (
        <section className="panel">
          {crisis && (
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <FeedbackCrisis />
            </div>
          )}
          {sent.kind === "review" ? (
            <div className="flex items-start gap-3 p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <StarGlyph size={22} fill="#f5b301" stroke="#d99a00" strokeWidth={1.3} />
              </span>
              <div>
                <p className="font-semibold text-slate-900">Thanks for the review.</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <StarsDisplay value={sent.rating} size={18} />
                  <span>
                    You gave AlgeBridge {starCountLabel(sent.rating)}. It goes straight to the people who build it.
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/" className="btn-primary btn-sm">
                    Back to the course
                  </Link>
                  <button type="button" onClick={() => startOver("problem")} className="btn-secondary btn-sm">
                    Send other feedback
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Icon name="check" size={20} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Got it. Thank you.</p>
                  <p className="mt-1 text-sm text-slate-600">It has been passed on. Back to the course whenever you like.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/" className="btn-primary btn-sm">
                      Back to the course
                    </Link>
                    <button type="button" onClick={() => startOver(sent.kind)} className="btn-secondary btn-sm">
                      Send another
                    </button>
                  </div>
                </div>
              </div>
              {offerReview && <ReviewOffer page={page} contact={replyTo} />}
            </>
          )}
        </section>
      ) : (
        <form onSubmit={send} className="panel">
          <div className="space-y-5 p-5 sm:p-6">
            <fieldset>
              <legend className="label">What is it about?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {KINDS.map((k) => (
                  <label
                    key={k.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition ${
                      kind === k.id ? "border-bridge-400 bg-bridge-50" : "border-slate-200 bg-white hover:border-slate-300"
                    } ${k.id === "review" ? "sm:col-span-2 sm:items-center" : ""}`}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={k.id}
                      checked={kind === k.id}
                      onChange={() => setKind(k.id)}
                      className={`accent-bridge-600 ${k.id === "review" ? "mt-1 sm:mt-0" : "mt-1"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{k.label}</span>
                      {k.hint && <span className="block text-xs text-slate-500">{k.hint}</span>}
                    </span>
                    {k.id === "review" && (
                      <span className="hidden shrink-0 sm:block">
                        <StarsDisplay value={5} size={18} label="Five stars" />
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>

            {isReview && (
              <div>
                <p id="review-stars-label" className="label">
                  How many stars would you give AlgeBridge?
                </p>
                <div className="mt-1.5">
                  <StarRating value={rating} onChange={setRating} labelledBy="review-stars-label" />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="feedback-message" className="label">
                {isReview ? "What made you give that rating?" : "Tell us"}
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={isReview ? 4 : 6}
                maxLength={MAX}
                required
                placeholder={
                  isReview
                    ? "What helps you most, and what would make it better?"
                    : "What happened, or what you'd change. The more specific, the faster it gets fixed."
                }
                className="field mt-1.5 resize-y"
              />
              <p className="field-hint">
                {message.length} of {MAX}
              </p>
            </div>

            <div>
              <label htmlFor="feedback-contact" className="label">
                Where to reach you <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="feedback-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={user?.email ?? "Email"}
                className="field mt-1.5"
              />
              <p className="field-hint">Only if you want a reply. A reply comes from a person.</p>
            </div>

            {error && <p className="notice-warn">{error}</p>}

            {crisis && state !== "sending" && <FeedbackCrisis />}

            {state === "email" && <EmailFallback href={mailtoFor(kind, message, page, contact, rating)} />}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                {isReview
                  ? rating === 0
                    ? "Pick your stars, then send."
                    : "Only the AlgeBridge team reads reviews."
                  : page
                    ? `About: ${page.slice(0, 90)}${page.length > 90 ? "..." : ""}`
                    : "No page attached."}
              </p>
              <button type="submit" disabled={state === "sending" || !ready} className="btn-primary disabled:opacity-50">
                {state === "sending" ? "Sending" : isReview ? "Send review" : "Send feedback"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Shown under "Got it. Thank you." after any other feedback: stars first, and
 * the box for why opens once a star is picked, so saying yes is one tap.
 */
function ReviewOffer({ page, contact }: { page: string; contact: string }) {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"ask" | "sending" | "sent" | "email" | "later">("ask");
  const [error, setError] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const ready = rating > 0 && message.trim().length >= 3;

  if (status === "later") return null;

  if (status === "sent") {
    return (
      <div className="border-t border-slate-100 px-6 py-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StarsDisplay value={rating} size={18} />
          <span className="font-semibold text-slate-900">Thanks for the review.</span>
          <span className="text-slate-600">It goes straight to the people who build AlgeBridge.</span>
        </div>
        {crisis && (
          <div className="mt-4">
            <FeedbackCrisis />
          </div>
        )}
      </div>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || status === "sending") return;
    setCrisis(!!detectCrisis(message));
    setStatus("sending");
    setError(null);
    const outcome = await postFeedback({ kind: "review", rating, message: message.trim(), contact, page });
    if (outcome === "ok") {
      rememberReview();
      setStatus("sent");
    } else if (outcome === "slow-down") {
      setError(SLOW_DOWN);
      setStatus("ask");
    } else {
      setStatus("email");
    }
  }

  return (
    <form onSubmit={send} className="border-t border-slate-100 bg-slate-50/70 px-6 py-5" aria-labelledby="review-offer-title">
      <h2 id="review-offer-title" className="text-base font-semibold text-slate-900">
        Want to leave a review of AlgeBridge?
      </h2>
      <p className="mt-0.5 text-sm text-slate-600">Pick 1 to 5 stars and say why. Only the AlgeBridge team reads reviews.</p>

      <div className="mt-3">
        <StarRating value={rating} onChange={setRating} labelledBy="review-offer-title" />
      </div>

      {rating > 0 && (
        <div className="mt-3 motion-safe:animate-[toast-in_0.2s_ease-out]">
          <label htmlFor="review-offer-message" className="label">
            What made you give that rating?
          </label>
          <textarea
            id="review-offer-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={MAX}
            placeholder="What helps you most, and what would make it better?"
            className="field mt-1.5 resize-y"
          />
          <p className="field-hint">
            {message.length} of {MAX}
          </p>
        </div>
      )}

      {error && <p className="notice-warn mt-3">{error}</p>}
      {crisis && status !== "sending" && (
        <div className="mt-3">
          <FeedbackCrisis />
        </div>
      )}
      {status === "email" && (
        <div className="mt-3">
          <EmailFallback href={mailtoFor("review", message, page, contact, rating)} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!ready || status === "sending"} className="btn-primary btn-sm disabled:opacity-50">
          {status === "sending" ? "Sending" : "Send review"}
        </button>
        <button type="button" onClick={() => setStatus("later")} className="btn-ghost btn-sm">
          Maybe later
        </button>
      </div>
    </form>
  );
}
