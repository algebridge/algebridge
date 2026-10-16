"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  createStudentAccounts,
  parseStudentLines,
  USERNAME_DOMAIN,
  type MadeAccount,
} from "@/lib/student-accounts";
import type { ClassInfo } from "@/types";

/**
 * Accounts made this visit, by class, so the passwords survive a look at
 * another class and come back when the teacher returns. They live in memory
 * only: a reload clears them, and nothing is ever stored.
 */
const madeThisVisit = new Map<string, MadeAccount[]>();

/**
 * Roster: make accounts for students who don't have one yet. The passwords
 * are shown once, here, on cards the teacher prints or a list they copy.
 */
export function MakeAccounts({ classInfo, onMade }: { classInfo: ClassInfo; onMade: () => void }) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [made, setMade] = useState<MadeAccount[]>(() => madeThisVisit.get(classInfo.id) ?? []);
  const [kept, setKept] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    madeThisVisit.set(classInfo.id, made);
  }, [made, classInfo.id]);

  const okCount = made.filter((m) => m.password).length;

  // Passwords on screen that were neither printed nor copied: a closing tab
  // asks first, since they cannot be shown again.
  useEffect(() => {
    if (okCount === 0 || kept) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [okCount, kept]);

  function handlePrint() {
    setNote(null);
    if (printCards(classInfo, made.filter((m) => m.password))) {
      setKept(true);
      return;
    }
    setNote({
      ok: false,
      text: "Your browser blocked the print window. Allow pop-ups for this site and try again, or use Copy list.",
    });
  }

  async function handleCopy() {
    setNote(null);
    const rows = made.filter((m) => m.password).map((m) => `${m.name}\t${m.signIn}\t${m.password}`);
    try {
      await navigator.clipboard.writeText(`Student\tSigns in with\tPassword\n${rows.join("\n")}`);
      setKept(true);
      setNote({ ok: true, text: "Copied. Paste the list into a document or a spreadsheet." });
    } catch {
      setNote({ ok: false, text: "Copying was blocked here. Select the table and copy it by hand." });
    }
  }

  const lines = parseStudentLines(text);
  const bad = lines.filter((l) => l.error);

  async function handleMake(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0 || bad.length > 0) return;
    setRunning(true);
    setMade([]);
    setKept(false);
    setNote(null);
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
        <h3 className="panel-title">Make accounts for your students</h3>
      </div>
      <form onSubmit={handleMake} className="space-y-2 p-5">
        <p className="text-sm text-slate-600">
          The simplest start when students have no accounts yet: you make them here, print the login cards, and
          every student is in {classInfo.name} already.
        </p>
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
          {classInfo.name} straight away. The passwords show once, on this visit only: print the cards or copy the
          list before you close or reload the page.
        </p>
        {bad.length > 0 && (
          <ul role="alert" className="space-y-0.5 text-sm text-red-600">
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
        {running && progress && (
          <p role="status" className="sr-only">
            Making account {progress.done + 1} of {progress.total}
          </p>
        )}
      </form>

      {made.length > 0 && (
        <div className="border-t border-slate-200 p-5">
          {failed.length > 0 && (
            <ul role="alert" className="mb-3 space-y-0.5 text-sm text-red-600">
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
                <p role="status" className="text-sm font-medium text-slate-800">
                  {ok.length} account{ok.length === 1 ? "" : "s"} made and in the class. Print or copy the passwords
                  now: they show once.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleCopy} className="btn-secondary btn-sm">
                    <Icon name="copy" size={15} />
                    Copy list
                  </button>
                  <button type="button" onClick={handlePrint} className="btn-primary btn-sm">
                    <Icon name="printer" size={15} />
                    Print login cards
                  </button>
                </div>
              </div>
              {note && (
                <p role={note.ok ? "status" : "alert"} className={`mb-3 text-sm ${note.ok ? "text-emerald-700" : "text-red-600"}`}>
                  {note.text}
                </p>
              )}
              <div className="overflow-x-auto">
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
              </div>
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

/** A page of cut-out cards, one a student, printed from a new window. False when the window was blocked. */
function printCards(classInfo: ClassInfo, accounts: MadeAccount[]): boolean {
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
  if (!w) return false;
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
  return true;
}
