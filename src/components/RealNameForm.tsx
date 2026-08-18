"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { checkFullName } from "@/lib/name";

/**
 * Asks an existing account for the student's actual name. Shown to accounts
 * created before real names were required (their name was auto-filled from the
 * email address), and anywhere a real name is a prerequisite.
 */
export function RealNameForm({ onSaved }: { onSaved?: () => void }) {
  const { profile, saveRealName } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = checkFullName(name);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSaving(true);
    setError("");
    const err = await saveRealName(check.formatted);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="real-name" className="label">
          Your full name
        </label>
        <input
          id="real-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError("");
          }}
          autoComplete="name"
          placeholder="First and last name"
          className="field mt-1"
        />
        {error ? (
          <p className="field-error">{error}</p>
        ) : (
          <p className="field-hint">
            {profile?.displayName
              ? `Your account currently shows "${profile.displayName}", which isn't a real name.`
              : "Use the name your teacher would recognize on a roster."}
          </p>
        )}
      </div>
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save my name"}
      </button>
    </form>
  );
}
