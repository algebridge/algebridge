"use client";

import { useEffect, useState } from "react";
import { units } from "@/data/curriculum";
import { Icon } from "@/components/Icon";
import {
  CLASS_FEATURES,
  emptyControls,
  getClassControls,
  saveClassControls,
  type ClassControls,
} from "@/lib/class-controls";
import { SCHOOL_MODE_OFF, type ClassFeature } from "@/lib/school-mode";

/**
 * What school mode already turns off. Joining a class sets profiles.managed,
 * which turns school mode on for that student, so these are off for every
 * class member whatever the teacher sets.
 */
const ALWAYS_OFF: ReadonlySet<ClassFeature> = new Set(SCHOOL_MODE_OFF.map((f) => f.feature));
import type { ClassInfo } from "@/types";

/**
 * Controls: what this class can see. Units and skills to close, parts of the
 * app to turn off, assignments-only mode, and whether students may leave.
 * Saved as a whole with one button, so a half-made change never reaches
 * students.
 */
export function ClassControlsTab({ classInfo }: { classInfo: ClassInfo }) {
  const [saved, setSaved] = useState<ClassControls>(() => emptyControls(classInfo.id));
  const [draft, setDraft] = useState<ClassControls>(() => emptyControls(classInfo.id));
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [openUnit, setOpenUnit] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void getClassControls(classInfo.id).then(({ controls, unavailable }) => {
      if (!live) return;
      setSaved(controls);
      setDraft(controls);
      setUnavailable(unavailable);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [classInfo.id]);

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  function toggle<K extends "blockedUnits" | "blockedSkills" | "blockedFeatures">(key: K, value: string) {
    setStatus(null);
    setDraft((d) => {
      const list = d[key] as string[];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...d, [key]: next };
    });
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    const err = await saveClassControls(draft);
    setSaving(false);
    if (err) {
      setStatus({ ok: false, text: err });
      return;
    }
    setSaved(draft);
    setStatus({ ok: true, text: "Saved. Students see it the next time a page loads." });
  }

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;

  if (unavailable) {
    return (
      <div className="notice-warning">
        Class controls need a database update first: run <code>supabase/schema-2026-10-15-class-controls.sql</code>.
      </div>
    );
  }

  const blockedSkillCount = draft.blockedSkills.length;

  return (
    <div className="space-y-4 pb-20">
      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">What the class works on</p>
        </div>
        <div className="space-y-3 p-5">
          <Switch
            checked={draft.assignedOnly}
            onChange={(v) => setDraft((d) => ({ ...d, assignedOnly: v }))}
            label="Only what I assign"
            detail="Students open only the skills on the Assignments tab, plus any they already finished. Everything else stays locked until you assign it."
          />
          <Switch
            checked={!draft.allowLeave}
            onChange={(v) => setDraft((d) => ({ ...d, allowLeave: !v }))}
            label="Students can't leave this class"
            detail="Only you can take a student off the roster, so these controls stay on them."
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Turn off parts of AlgeBridge</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {CLASS_FEATURES.filter((f) => !ALWAYS_OFF.has(f.feature)).map((f) => (
            <li key={f.feature} className="px-5 py-3">
              <Switch
                checked={draft.blockedFeatures.includes(f.feature)}
                onChange={() => toggle("blockedFeatures", f.feature as ClassFeature)}
                label={f.name}
                detail={f.detail}
                offWords
              />
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-200 px-5 py-4">
          <p className="text-sm font-medium text-slate-900">Already off for everyone in a class</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Joining a class makes a student a school account, which keeps these off for safety. Nothing to set here.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {CLASS_FEATURES.filter((f) => ALWAYS_OFF.has(f.feature)).map((f) => (
              <li key={f.feature} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                <Icon name="lock" size={12} />
                {f.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Close units and skills</p>
          <span className="text-xs text-slate-500">
            {draft.blockedUnits.length} unit{draft.blockedUnits.length === 1 ? "" : "s"}, {blockedSkillCount} skill
            {blockedSkillCount === 1 ? "" : "s"} closed
          </span>
        </div>
        <ul className="divide-y divide-slate-100">
          {units.map((u) => {
            const unitClosed = draft.blockedUnits.includes(u.id);
            const skillsClosed = u.skills.filter((s) => draft.blockedSkills.includes(s.id)).length;
            const expanded = openUnit === u.id;
            return (
              <li key={u.id} className="px-5 py-2.5">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`unit-${u.id}`}
                    checked={unitClosed}
                    onChange={() => toggle("blockedUnits", u.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor={`unit-${u.id}`} className="min-w-0 flex-1 text-sm text-slate-800">
                    <span className="font-medium">Unit {u.number}:</span> {u.title}
                    {unitClosed && <span className="badge-neutral ml-2">Closed</span>}
                    {!unitClosed && skillsClosed > 0 && (
                      <span className="ml-2 text-xs text-slate-500">{skillsClosed} closed</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenUnit(expanded ? null : u.id)}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Hide" : "Show"} skills in Unit ${u.number}`}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} />
                  </button>
                </div>
                {expanded && (
                  <ul className="mt-2 space-y-1.5 pl-7">
                    {u.skills.map((s) => (
                      <li key={s.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`skill-${s.id}`}
                          checked={unitClosed || draft.blockedSkills.includes(s.id)}
                          disabled={unitClosed}
                          onChange={() => toggle("blockedSkills", s.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <label htmlFor={`skill-${s.id}`} className="text-sm text-slate-700">
                          {s.title}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-panel">
        {status && <p className={`text-sm ${status.ok ? "text-emerald-700" : "text-red-600"}`}>{status.text}</p>}
        {dirty && !status && <p className="text-sm text-slate-500">Unsaved changes</p>}
        <button type="button" disabled={!dirty} onClick={() => setDraft(saved)} className="btn-secondary">
          Undo
        </button>
        <button type="button" disabled={!dirty || saving} onClick={handleSave} className="btn-primary">
          {saving ? "Saving…" : "Save controls"}
        </button>
      </div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  detail,
  offWords = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  detail: string;
  /** For a feature: "Off" when checked, since checking turns it off. */
  offWords?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block text-xs leading-relaxed text-slate-500">{detail}</span>
      </span>
      {offWords && (
        <span className={`mt-0.5 text-xs font-medium ${checked ? "text-red-600" : "text-slate-400"}`}>
          {checked ? "Off" : "On"}
        </span>
      )}
      <input
        type="checkbox"
        role="switch"
        checked={offWords ? !checked : checked}
        onChange={(e) => onChange(offWords ? !e.target.checked : e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-bridge-600 peer-focus-visible:ring-2 peer-focus-visible:ring-bridge-400 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4"
      />
    </label>
  );
}
