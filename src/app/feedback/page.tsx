"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * A place to say what's working, what's confusing and what's wrong, from
 * anyone, signed in or not. A problem card links here with the problem
 * already filled in.
 */

const KINDS: { id: string; label: string; hint: string }[] = [
  { id: "problem", label: "A problem reads wrong", hint: "Awkward wording, a wrong answer key, a story that makes no sense." },
  { id: "broken", label: "Something is broken", hint: "A button, a page, a save that went missing." },
  { id: "confusing", label: "Something is confusing", hint: "You were unsure what to do next." },
  { id: "idea", label: "An idea", hint: "Something you wish AlgeBridge did." },
  { id: "love", label: "Something you like", hint: "Worth knowing what to keep." },
  { id: "other", label: "Something else", hint: "" },
];

type State = "idle" | "sending" | "sent" | "email";

export default function FeedbackPage() {
  const { user } = useAuth();
  const [kind, setKind] = useState("problem");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [page, setPage] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

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

  const mailto = `mailto:support@algebridge.org?subject=${encodeURIComponent(`AlgeBridge feedback (${kind})`)}&body=${encodeURIComponent(
    `${message}\n\n${page ? `Page: ${page}\n` : ""}${contact ? `Contact: ${contact}\n` : ""}`
  )}`;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3 || state === "sending") return;
    setState("sending");
    setError(null);
    let token = "";
    try {
      const { data } = (await createClient()?.auth.getSession()) ?? { data: { session: null } };
      token = data.session?.access_token ?? "";
    } catch {
      /* signed out is fine */
    }
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message: message.trim(), contact: contact.trim() || (user?.email ?? ""), page, token }),
      });
      const data = (await res.json()) as { ok: boolean; reason?: string };
      if (data.ok) {
        setState("sent");
        return;
      }
      if (data.reason === "slow-down") {
        setError("That is a lot of feedback in a short time. Give it a few minutes.");
        setState("idle");
        return;
      }
      // The table is missing or the request was refused: email carries it instead.
      setState("email");
    } catch {
      setState("email");
    }
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

      {state === "sent" ? (
        <section className="panel">
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
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setState("idle");
                  }}
                  className="btn-secondary btn-sm"
                >
                  Send another
                </button>
              </div>
            </div>
          </div>
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
                    }`}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={k.id}
                      checked={kind === k.id}
                      onChange={() => setKind(k.id)}
                      className="mt-1 accent-bridge-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{k.label}</span>
                      {k.hint && <span className="block text-xs text-slate-500">{k.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="feedback-message" className="label">
                Tell us
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={2000}
                required
                placeholder="What happened, or what you'd change. The more specific, the faster it gets fixed."
                className="field mt-1.5 resize-y"
              />
              <p className="field-hint">{message.length} of 2000</p>
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

            {state === "email" && (
              <div className="notice-info">
                <p className="font-medium">Sending straight from here is off right now.</p>
                <p className="mt-1">
                  Your message is ready to go by email instead, word for word.{" "}
                  <a href={mailto} className="font-semibold underline">
                    Open it in your mail app
                  </a>
                  .
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">{page ? `About: ${page.slice(0, 90)}${page.length > 90 ? "..." : ""}` : "No page attached."}</p>
              <button type="submit" disabled={state === "sending" || message.trim().length < 3} className="btn-primary disabled:opacity-50">
                {state === "sending" ? "Sending" : "Send feedback"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
