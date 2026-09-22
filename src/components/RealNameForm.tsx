"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { checkNameParts, formatName, isRealName, splitName } from "@/lib/name";

/**
 * Asks an existing account for the student's actual name, as "First Last".
 * Shown to accounts created before real names were required (their name was
 * auto-filled from the email address), to accounts that gave a last initial,
 * and anywhere a real name is a prerequisite. Whatever is already on the
 * account is filled in, so the fix is usually one box.
 */
export function RealNameForm({ onSaved }: { onSaved?: () => void }) {
  const { profile, saveRealName } = useAuth();
  const current = profile?.displayName ?? "";
  const start = isRealName(current) || /\d|@/.test(current) ? { first: "", last: "" } : splitName(current);
  const [first, setFirst] = useState(start.first);
  const [last, setLast] = useState(start.last);
  const [error, setError] = useState<{ text: string; field?: "first" | "last" }>({ text: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = checkNameParts(first, last);
    if (!check.ok) {
      setError({ text: check.error, field: check.field });
      return;
    }
    setSaving(true);
    setError({ text: "" });
    const err = await saveRealName(check.formatted);
    setSaving(false);
    if (err) {
      setError({ text: err });
      return;
    }
    onSaved?.();
  }

  const lastLooksShort = !!current && !!start.first && !start.last;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="real-first" className="label">
            First name
          </label>
          <input
            id="real-first"
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              if (error.text) setError({ text: "" });
            }}
            onBlur={() => setFirst((v) => formatName(v))}
            autoComplete="given-name"
            placeholder="Maria"
            className="field mt-1"
            aria-invalid={error.field === "first" || undefined}
          />
          {error.field === "first" && <p className="field-error">{error.text}</p>}
        </div>
        <div>
          <label htmlFor="real-last" className="label">
            Last name
          </label>
          <input
            id="real-last"
            value={last}
            onChange={(e) => {
              setLast(e.target.value);
              if (error.text) setError({ text: "" });
            }}
            onBlur={() => setLast((v) => formatName(v))}
            autoComplete="family-name"
            placeholder="Alvarez"
            className="field mt-1"
            aria-invalid={error.field === "last" || undefined}
          />
          {error.field === "last" && <p className="field-error">{error.text}</p>}
        </div>
      </div>
      {error.text && !error.field ? (
        <p className="field-error">{error.text}</p>
      ) : (
        <p className="field-hint">
          {lastLooksShort
            ? `Your account shows "${current}". Please enter your full last name.`
            : current && !isRealName(current)
              ? `Your account shows "${current}". Use the name your teacher would recognize on a roster.`
              : "Use the name your teacher would recognize on a roster."}
        </p>
      )}
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save my name"}
      </button>
    </form>
  );
}
