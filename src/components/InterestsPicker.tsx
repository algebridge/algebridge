"use client";

import { useState } from "react";
import {
  INTEREST_OPTIONS,
  NOTE_MAX,
  sanitizeTopics,
  topicsFromPicks,
  type InterestProfile,
  type InterestTopic,
} from "@/lib/interests";
import { saveInterests } from "@/lib/progress";

/** Enough to rotate through, few enough that each one comes up. */
const MAX_PICKS = 4;

interface InterestsPickerProps {
  initial?: InterestProfile | null;
  /** Shown after saving, to close whatever holds the picker. */
  onDone?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  /** The heading is the modal's title; the profile page has its own. */
  showHeading?: boolean;
}

/**
 * "What are you into?" Tap a few, and optionally say it in your own words.
 * The words go to a model that turns them into topics (see /api/interests);
 * the taps alone never leave the page as anything but a list of ids.
 */
export function InterestsPicker({
  initial,
  onDone,
  onSkip,
  skipLabel = "Skip for now",
  showHeading = true,
}: InterestsPickerProps) {
  const [picks, setPicks] = useState<string[]>(initial?.skipped ? [] : initial?.picks ?? []);
  const [note, setNote] = useState(initial?.skipped ? "" : initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<InterestTopic[] | null>(null);

  function toggle(id: string) {
    // Functional update: two quick taps in one frame each see the latest
    // picks. Reading `picks` directly let the second tap overwrite the first.
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, id];
    });
    setError(
      !picks.includes(id) && picks.length >= MAX_PICKS ? `Up to ${MAX_PICKS}. Tap one you picked to swap it out.` : ""
    );
  }

  async function save() {
    const trimmed = note.trim();
    if (!picks.length && !trimmed) {
      setError("Tap at least one, or write a few words.");
      return;
    }
    setSaving(true);
    setError("");

    let topics = topicsFromPicks(picks);
    let source: InterestProfile["source"] = "picks";
    try {
      const res = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks, note: trimmed }),
      });
      const data = (await res.json()) as { topics?: unknown; source?: unknown };
      const read = sanitizeTopics(data.topics);
      if (read.length) {
        topics = read;
        source = data.source === "ai" ? "ai" : "picks";
      }
    } catch {
      /* the taps still work without the server */
    }

    setSaving(false);
    if (!topics.length) {
      setError("Tap one or two of the options too, so there is something to set problems in.");
      return;
    }
    saveInterests({ picks, note: trimmed, topics, source, updatedAt: new Date().toISOString() });
    setSaved(topics);
  }

  if (saved) {
    return (
      <div className="space-y-4">
        {showHeading && (
          <h2 id="interests-title" className="text-xl font-bold tracking-tight text-slate-900">
            You&apos;re set.
          </h2>
        )}
        <div>
          <p className="text-sm text-slate-600">Your practice problems will be set in:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {saved.map((t) => (
              <span key={t.label} className="badge-brand">
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">Change these any time from your profile.</p>
        <div className="flex flex-wrap gap-2">
          {onDone ? (
            <button type="button" onClick={onDone} className="btn-primary flex-1">
              Start practicing
            </button>
          ) : (
            <button type="button" onClick={() => setSaved(null)} className="btn-secondary">
              Edit
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showHeading && (
        <div>
          <h2 id="interests-title" className="text-xl font-bold tracking-tight text-slate-900">
            What are you into?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Tap up to {MAX_PICKS}. Your practice problems get set in them.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Interests">
        {INTEREST_OPTIONS.map((o) => {
          const on = picks.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                on
                  ? "border-bridge-600 bg-bridge-600 text-white shadow-sm"
                  : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor="interest-note" className="label">
          Anything else? Say it your way.
        </label>
        <textarea
          id="interest-note"
          value={note}
          onChange={(e) => {
            setError("");
            setNote(e.target.value.slice(0, NOTE_MAX));
          }}
          rows={2}
          maxLength={NOTE_MAX}
          placeholder="e.g. I play volleyball, bake on weekends, and watch F1"
          className="field mt-1.5 resize-none"
        />
        <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-slate-500">
          <span>An AI reads this to pick your topics. Stick to hobbies and interests.</span>
          <span className="shrink-0 tabular-nums">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary flex-1">
          {saving ? (note.trim() ? "Reading your answer..." : "Saving...") : "Save"}
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} disabled={saving} className="btn-ghost">
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
