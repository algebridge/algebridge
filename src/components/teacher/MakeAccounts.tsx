"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import {
  createStudentAccounts,
  parseStudentLines,
  USERNAME_DOMAIN,
  type MadeAccount,
} from "@/lib/student-accounts";
import type { ClassInfo } from "@/types";

/**
 * Roster: make accounts for students who don't have one yet. The passwords
 * are shown once, here, on cards the teacher prints.
 */
export function MakeAccounts({ classInfo, onMade }: { classInfo: ClassInfo; onMade: () => void }) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [made, setMade] = useState<MadeAccount[]>([]);

  const lines = parseStudentLines(text);
  const bad = lines.filter((l) => l.error);

  async function handleMake(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0 || bad.length > 0) return;
    setRunning(true);
    setMade([]);
    setProgress({ done: 0, total: lines.length });
    const results = await createStudentAccounts(classInfo.joinCode, lines, (one, done) => {
      setMade((list) => [...list, one]);
      setProgress({ done, total: lines.length });
    });
    setRunning(false);
    if (results.some((r) => r.password)) {
      setText(
        results
          .filter((r) => !r.password)
          .map((r) => r.name)
          .join("\n")
      );
      onMade();
    }
  }

  const ok = made.filter((m) => m.password);
  const failed = made.filter((m) => !m.password || m.error);

  return (
    <div className="panel">
      <div className="panel-head">
        <p className="panel-title">Make accounts for your students</p>
      </div>
      <form onSubmit={handleMake} className="space-y-2 p-5">
        <label htmlFor="make-accounts" className="label">
          One student a line: first and last name, and a school email if they have one
        </label>
        <textarea
          id="make-accounts"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          disabled={running}
          placeholder={"Maria Lopez\nJordan Smith, jsmith@school.edu\nSam Patel"}
          className="field font-mono text-xs"
        />
        <p className="field-hint">
          Students without an email get a username, like maria.lopez4821. Each account gets a password and joins{" "}
          {classInfo.name} straight away. You see the passwords once, so print the cards before you leave this page.
        </p>
        {bad.length > 0 && (
          <ul className="space-y-0.5 text-sm text-red-600">
            {bad.map((l) => (
              <li key={l.line}>
                Line {l.line} ({l.name || "blank"}): {l.error}
              </li>
            ))}
          </ul>
        )}
        <button type="submit" disabled={running || lines.length === 0 || bad.length > 0} className="btn-primary">
          {running && progress
            ? `Making ${progress.done + 1} of ${progress.total}…`
            : lines.length > 0
              ? `Make ${lines.length} account${lines.length === 1 ? "" : "s"}`
              : "Make accounts"}
        </button>
      </form>

      {made.length > 0 && (
        <div className="border-t border-slate-200 p-5">
          {failed.length > 0 && (
            <ul className="mb-3 space-y-0.5 text-sm text-red-600">
              {failed.map((m) => (
                <li key={m.name + m.signIn}>
                  {m.name}: {m.error}
                </li>
              ))}
            </ul>
          )}
          {ok.length > 0 && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">
                  {ok.length} account{ok.length === 1 ? "" : "s"} made and in the class
                </p>
                <button type="button" onClick={() => printCards(classInfo, ok)} className="btn-secondary btn-sm">
                  <Icon name="printer" size={15} />
                  Print login cards
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Signs in with</th>
                    <th>Password</th>
                  </tr>
                </thead>
                <tbody>
                  {ok.map((m) => (
                    <tr key={m.signIn}>
                      <td>{m.name}</td>
                      <td className="font-mono text-xs">{m.signIn}</td>
                      <td className="font-mono text-xs">{m.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A page of cut-out cards, one a student, printed from a new window. */
function printCards(classInfo: ClassInfo, accounts: MadeAccount[]) {
  const site = typeof window !== "undefined" ? window.location.host : "learn.algebridge.org";
  const cards = accounts
    .map(
      (a) => `<div class="card">
  <p class="cls">${escape(classInfo.name)}</p>
  <p class="name">${escape(a.name)}</p>
  <p><span>Go to</span> ${escape(site)}/login</p>
  <p><span>Username</span> <b>${escape(a.signIn)}</b></p>
  <p><span>Password</span> <b>${escape(a.password ?? "")}</b></p>
</div>`
    )
    .join("");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(classInfo.name)} login cards</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 16px; color: #0f172a; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { border: 1px dashed #94a3b8; border-radius: 8px; padding: 12px 14px; break-inside: avoid; }
  .card p { margin: 3px 0; }
  .cls { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
  .name { font-size: 16px; font-weight: 600; }
  span { display: inline-block; width: 74px; color: #64748b; }
  b { font-family: ui-monospace, Menlo, monospace; }
  .note { color: #64748b; font-size: 12px; margin-bottom: 12px; }
</style></head><body>
<p class="note">Cut along the dashed lines. A username signs in as itself; it is short for username@${USERNAME_DOMAIN}.</p>
<div class="grid">${cards}</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
  w.document.close();
}
