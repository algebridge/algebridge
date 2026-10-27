"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { MathText } from "@/components/PromptText";
import { units } from "@/data/curriculum";
import {
  cleanCode,
  cleanName,
  DEFAULT_SETTINGS,
  isCode,
  LOCAL_KEY_LABELS,
  LOCAL_KEYS,
  LOCAL_MAX_PLAYERS,
  makeCode,
  MAX_PLAYERS,
  pickQuestions,
  podiumMessage,
  QUESTION_COUNTS,
  resultMessage,
  scoreQuestion,
  SECONDS_PER_QUESTION,
  uniqueName,
  type ArenaPlayer,
  type ArenaQuestion,
  type ArenaSettings,
  type HostMessage,
  type PlayerMessage,
} from "@/lib/arena-live";
import { localTransport, realtimeTransport, type ArenaTransport } from "@/lib/arena-transport";
import { useAuth } from "@/lib/auth";
import { splitName } from "@/lib/name";
import { fireConfetti } from "@/lib/notify";
import { useSeason } from "@/lib/use-season";
import { useSound } from "@/hooks/useSound";

/**
 * The Live Arena page (lib/arena-live.ts for the rules, lib/arena-transport.ts
 * for the wire): host a room, join one from a phone, or play on this computer.
 */

type Mode = "menu" | "host" | "join" | "local";

/** The four answer colors and shapes, the same on every screen so "the blue one" means something. */
const CHOICE_STYLE = [
  { bg: "bg-rose-600", ring: "ring-rose-300", shape: "M12 3 L21 19 H3 Z" },
  { bg: "bg-sky-600", ring: "ring-sky-300", shape: "M12 2.5 L21.5 12 L12 21.5 L2.5 12 Z" },
  { bg: "bg-amber-500", ring: "ring-amber-200", shape: "M12 12 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0" },
  { bg: "bg-emerald-600", ring: "ring-emerald-300", shape: "M4 4 H20 V20 H4 Z" },
];

function Shape({ i, size = 18 }: { i: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d={CHOICE_STYLE[i].shape} fill="currentColor" />
    </svg>
  );
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  }
}

export function LiveArena() {
  const [mode, setMode] = useState<Mode>("menu");
  const season = useSeason();
  const spooky = season === "halloween";
  const { profile } = useAuth();
  const myName = splitName(profile?.displayName).first || "";

  // /arena?code=ABCDEF (the QR or link a host shares) opens the join form with the code in.
  const [startCode, setStartCode] = useState("");
  useEffect(() => {
    const c = cleanCode(new URLSearchParams(window.location.search).get("code") ?? "");
    if (isCode(c)) {
      setStartCode(c);
      setMode("join");
    }
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            {spooky ? "Spooky Showdown" : "Live Arena"}
            {spooky && <span className="season-chip">Halloween</span>}
          </h1>
          <p className="page-subtitle">
            A quiz show over the course. One screen hosts, everyone else joins from a phone with a code, and the fastest right answers win. Or share one keyboard
            with a friend next to you.
          </p>
        </div>
        {mode !== "menu" && (
          <button type="button" onClick={() => setMode("menu")} className="btn-secondary btn-sm">
            <Icon name="arrow-left" size={14} />
            Back
          </button>
        )}
      </header>

      {mode === "menu" && (
        <div className="grid gap-4 md:grid-cols-3">
          <MenuCard
            icon="leaderboard"
            title="Host a game"
            blurb="This screen shows the questions and the standings. Friends join from their phones with a six-letter code."
            action="Host"
            onPick={() => setMode("host")}
          />
          <MenuCard icon="phone" title="Join with a code" blurb="Someone else is hosting. Type the code from their screen and you are in." action="Join" onPick={() => setMode("join")} />
          <MenuCard
            icon="students"
            title="Play on this computer"
            blurb={`Two to ${LOCAL_MAX_PLAYERS} players, one keyboard. Each of you gets four keys and the same twenty seconds.`}
            action="Play here"
            onPick={() => setMode("local")}
          />
        </div>
      )}
      {mode === "host" && <HostSetup spooky={spooky} />}
      {mode === "join" && <JoinScreen defaultName={myName} startCode={startCode} />}
      {mode === "local" && <LocalSetup defaultName={myName} spooky={spooky} />}
    </div>
  );
}

function MenuCard({ icon, title, blurb, action, onPick }: { icon: "leaderboard" | "phone" | "students"; title: string; blurb: string; action: string; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="card-link flex flex-col items-start text-left">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bridge-50 text-bridge-700 ring-1 ring-inset ring-bridge-100">
        <Icon name={icon} size={22} />
      </span>
      <span className="mt-3 text-base font-semibold text-slate-900">{title}</span>
      <span className="mt-1 text-sm leading-relaxed text-slate-600">{blurb}</span>
      <span className="btn-primary btn-sm mt-4">{action}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Settings shared by hosting and playing here
// ---------------------------------------------------------------------------

function SettingsForm({ value, onChange }: { value: ArenaSettings; onChange: (v: ArenaSettings) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="label">Questions up to</span>
        <select className="field mt-1.5" value={value.unitCap} onChange={(e) => onChange({ ...value, unitCap: Number(e.target.value) })}>
          {units.map((u) => (
            <option key={u.id} value={u.number}>
              Unit {u.number}: {u.title}
            </option>
          ))}
        </select>
        <span className="field-hint">Head math from units 1 to this one. Higher units come up more often.</span>
      </label>
      <div>
        <span className="label">How many</span>
        <div className="mt-1.5 flex gap-2">
          {QUESTION_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ ...value, count: n })}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${value.count === n ? "border-bridge-600 bg-bridge-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}
              aria-pressed={value.count === n}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="field-hint">{SECONDS_PER_QUESTION} seconds each. Faster right answers score more.</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hosting over the network
// ---------------------------------------------------------------------------

function HostSetup({ spooky }: { spooky: boolean }) {
  const [settings, setSettings] = useState<ArenaSettings>(DEFAULT_SETTINGS);
  const [room, setRoom] = useState<{ code: string; transport: ArenaTransport } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    const code = makeCode();
    const transport = realtimeTransport(code);
    if (!transport) {
      setError("Hosting over the network needs the live service, which this copy of AlgeBridge does not have. Play on this computer instead.");
      return;
    }
    try {
      await transport.ready;
      setRoom({ code, transport });
    } catch {
      transport.close();
      setError("Could not open a room right now. Check the connection and try again.");
    }
  }

  if (room) return <HostGame code={room.code} transport={room.transport} settings={settings} spooky={spooky} />;
  return (
    <div className="card space-y-5">
      <SettingsForm value={settings} onChange={setSettings} />
      {error && <p className="notice-error">{error}</p>}
      <button type="button" onClick={() => void open()} className="btn-primary">
        Open the room
      </button>
    </div>
  );
}

/** A seat at one keyboard: who, and which keys. */
interface Seat {
  id: string;
  name: string;
  keys: readonly string[];
  label: string;
}

/**
 * The host: owns the players and the questions, scores every answer, and
 * tells the room what to show. With `seats` it also draws the answer pads
 * for people sharing this keyboard.
 */
function HostGame({ code, transport, settings, spooky, seats }: { code: string | null; transport: ArenaTransport; settings: ArenaSettings; spooky: boolean; seats?: Seat[] }) {
  const [phase, setPhase] = useState<"lobby" | "question" | "result" | "podium">("lobby");
  const [players, setPlayersState] = useState<ArenaPlayer[]>([]);
  // The ref is the truth between renders: two joins or two answers can land
  // in the same tick, and each must see the other.
  const playersRef = useRef(players);
  const setPlayers = useCallback((next: ArenaPlayer[] | ((cur: ArenaPlayer[]) => ArenaPlayer[])) => {
    const value = typeof next === "function" ? next(playersRef.current) : next;
    playersRef.current = value;
    setPlayersState(value);
  }, []);
  const [questions, setQuestionsState] = useState<ArenaQuestion[]>([]);
  const questionsRef = useRef(questions);
  const setQuestions = useCallback((qs: ArenaQuestion[]) => {
    questionsRef.current = qs;
    setQuestionsState(qs);
  }, []);
  const [qi, setQi] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [result, setResult] = useState<Extract<HostMessage, { type: "result" }> | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const qiRef = useRef(qi);
  qiRef.current = qi;
  const closeTimer = useRef(0);
  const { playCorrect, playLevelUp } = useSound();

  const sendLobby = useCallback(
    (ps: ArenaPlayer[]) => transport.sendHost({ type: "lobby", players: ps.map((p) => ({ id: p.id, name: p.name })), settings }),
    [transport, settings]
  );

  const close = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    const q = questionsRef.current[qiRef.current];
    if (!q || phaseRef.current !== "question") return;
    phaseRef.current = "result";
    const picked = playersRef.current;
    const scored = scoreQuestion(picked, q);
    setPlayers(scored);
    const msg = resultMessage(picked, scored, q, questionsRef.current.length) as Extract<HostMessage, { type: "result" }>;
    setResult(msg);
    setPhase("result");
    transport.sendHost(msg);
    if (scored.some((p) => p.last?.correct)) playCorrect();
  }, [transport, playCorrect, setPlayers]);

  // What players send: joining, answering, leaving.
  useEffect(() => {
    const off = transport.onPlayer((m: PlayerMessage) => {
      if (m.type === "join") {
        const cur = playersRef.current;
        if (cur.some((p) => p.id === m.id)) {
          sendLobby(cur);
          return;
        }
        if (phaseRef.current !== "lobby" || cur.length >= MAX_PLAYERS) return;
        const name = uniqueName(cleanName(m.name), cur.map((p) => p.name));
        const next = [...cur, { id: m.id, name, score: 0, streak: 0 }];
        setPlayers(next);
        sendLobby(next);
      } else if (m.type === "answer") {
        if (phaseRef.current !== "question" || m.i !== qiRef.current) return;
        const cur = playersRef.current;
        const me = cur.find((p) => p.id === m.id);
        if (!me || me.pick !== undefined) return;
        const next = cur.map((p) => (p.id === m.id ? { ...p, pick: m.pick, ms: Math.max(0, m.ms) } : p));
        setPlayers(next);
        // Everyone is in: no need to wait out the clock.
        if (next.every((p) => p.pick !== undefined)) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = window.setTimeout(close, 700);
        }
      } else if (m.type === "leave") {
        const next = playersRef.current.filter((p) => p.id !== m.id);
        setPlayers(next);
        if (phaseRef.current === "lobby") sendLobby(next);
      }
    });
    return off;
  }, [transport, sendLobby, close]);

  // The seats at this keyboard join on their own.
  useEffect(() => {
    if (!seats) return;
    for (const s of seats) transport.sendPlayer({ type: "join", id: s.id, name: s.name });
  }, [seats, transport]);

  // Leaving the page closes the room. Checked a tick later, so React's
  // development double-mount (cleanup, then the effect again at once) does
  // not close a room that is still on screen.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(closeTimer.current);
      window.setTimeout(() => {
        if (mounted.current) return;
        transport.sendHost({ type: "closed" });
        transport.close();
      }, 0);
    };
  }, [transport]);

  function ask(i: number, qs: ArenaQuestion[]) {
    const q = qs[i];
    const ends = Date.now() + SECONDS_PER_QUESTION * 1000;
    setQi(i);
    setEndsAt(ends);
    setResult(null);
    setPlayers((cur) => cur.map((p) => ({ ...p, pick: undefined, ms: undefined })));
    phaseRef.current = "question";
    qiRef.current = i;
    setPhase("question");
    const { answer: _hidden, ...open } = q;
    transport.sendHost({ type: "question", q: open, total: qs.length, endsAt: ends, answered: 0 });
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(close, SECONDS_PER_QUESTION * 1000 + 300);
  }

  // `close` reads the questions through state; the timer set in ask() must call the latest one.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (phase !== "question") return;
    const left = Math.max(0, endsAt + 300 - Date.now());
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => closeRef.current(), left);
    return () => window.clearTimeout(closeTimer.current);
  }, [phase, endsAt, qi]);

  function start() {
    const qs = pickQuestions(settings);
    if (!qs.length) return;
    setQuestions(qs);
    ask(0, qs);
  }

  function next() {
    if (qi + 1 < questions.length) ask(qi + 1, questions);
    else {
      setPhase("podium");
      transport.sendHost(podiumMessage(players));
      fireConfetti("big");
      playLevelUp();
    }
  }

  function again() {
    setPlayers((cur) => cur.map((p) => ({ ...p, score: 0, streak: 0, last: undefined, pick: undefined, ms: undefined })));
    setPhase("lobby");
    setResult(null);
    sendLobby(players.map((p) => ({ ...p, score: 0 })));
  }

  const q = questions[qi];
  const answered = players.filter((p) => p.pick !== undefined).length;
  const joinUrl = typeof window !== "undefined" && code ? `${window.location.origin}/arena?code=${code}` : "";

  return (
    <div className={`arena-stage ${spooky ? "arena-spooky" : ""}`}>
      {/* Top bar: the code, or the question number. */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
        {code ? (
          <p className="flex items-center gap-2">
            <span className="opacity-75">Join at</span>
            <span className="font-semibold">{typeof window !== "undefined" ? window.location.host : "AlgeBridge"}/arena</span>
            <span className="opacity-75">with code</span>
            <span className="rounded-md bg-white/15 px-2 py-0.5 font-display text-lg tracking-[0.2em]">{code}</span>
          </p>
        ) : (
          <p className="font-semibold">One keyboard, {players.length} players</p>
        )}
        <p className="tabular-nums opacity-80">
          {phase === "lobby" ? `${players.length} in` : q ? `Question ${qi + 1} of ${questions.length}` : ""}
        </p>
      </div>

      {phase === "lobby" && (
        <div className="px-5 pb-6">
          {code && (
            <div className="mb-5 rounded-2xl bg-white/10 p-5 text-center">
              <p className="text-sm uppercase tracking-[0.12em] opacity-75">Game code</p>
              <p className="mt-1 font-display text-6xl tracking-[0.25em] sm:text-7xl">{code}</p>
              <p className="mt-2 text-sm opacity-80">
                Phones go to <span className="font-semibold">{joinUrl.replace(/^https?:\/\//, "")}</span>
              </p>
            </div>
          )}
          <p className="text-sm font-semibold uppercase tracking-[0.1em] opacity-75">Players</p>
          {players.length === 0 ? (
            <p className="mt-2 text-sm opacity-80">{code ? "Waiting for the first player." : "No seats yet."}</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {players.map((p) => (
                <li key={p.id} className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold">
                  {p.name}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={start} disabled={players.length === 0} className="btn-primary mt-5">
            Start
          </button>
        </div>
      )}

      {phase === "question" && q && (
        <div className="px-5 pb-5">
          <Timer endsAt={endsAt} key={qi} />
          <p className="mt-3 text-xs uppercase tracking-[0.1em] opacity-70">
            Unit {q.unitNumber} · {q.skillTitle}
          </p>
          <p className="mt-1 text-2xl font-semibold leading-snug sm:text-3xl">
            <MathText text={q.prompt} />
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {q.choices.map((c, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-4 text-lg font-semibold text-white ${CHOICE_STYLE[i].bg}`}>
                <Shape i={i} size={20} />
                <MathText text={c} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm tabular-nums opacity-80">
            {answered} of {players.length} answered
          </p>
          {seats && <SeatPads seats={seats} players={players} qi={qi} startedAt={endsAt - SECONDS_PER_QUESTION * 1000} transport={transport} />}
        </div>
      )}

      {phase === "result" && result && (
        <div className="px-5 pb-5">
          <p className="text-sm uppercase tracking-[0.1em] opacity-70">The answer</p>
          <p className="mt-1 text-xl font-semibold">
            <MathText text={result.q.prompt} />
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {result.q.choices.map((c, i) => {
              const right = i === result.q.answer;
              const n = result.counts[i];
              return (
                <div key={i} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold text-white ${CHOICE_STYLE[i].bg} ${right ? "ring-4 ring-white" : "opacity-55"}`}>
                  <span className="flex items-center gap-2">
                    <Shape i={i} />
                    <MathText text={c} />
                  </span>
                  <span className="tabular-nums">
                    {n} {right && <Icon name="check" size={14} className="ml-1 inline" />}
                  </span>
                </div>
              );
            })}
          </div>
          <Standings rows={result.standings.slice(0, 8)} />
          <button type="button" onClick={next} className="btn-primary mt-5">
            {qi + 1 < questions.length ? "Next question" : "See the podium"}
          </button>
        </div>
      )}

      {phase === "podium" && (
        <div className="px-5 pb-6">
          <Podium rows={players} spooky={spooky} />
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={again} className="btn-primary">
              Play again
            </button>
            <Link href="/games" className="btn-secondary">
              Back to games
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Timer({ endsAt }: { endsAt: number }) {
  const [left, setLeft] = useState(SECONDS_PER_QUESTION);
  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);
  const total = SECONDS_PER_QUESTION * 1000;
  const pct = Math.max(0, Math.min(100, ((endsAt - Date.now()) / total) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
        <div className="arena-timer h-full rounded-full bg-amber-400" style={{ width: `${pct}%`, transitionDuration: `${Math.max(0, endsAt - Date.now())}ms` }} />
      </div>
      <span className="w-8 text-right font-display text-xl tabular-nums" aria-live="off">
        {left}
      </span>
    </div>
  );
}

function Standings({ rows }: { rows: { rank: number; id: string; name: string; score: number; streak: number; last?: { correct: boolean; points: number } }[] }) {
  return (
    <ol className="mt-5 space-y-1.5">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2 text-sm">
          <span className="w-6 text-center font-display text-lg tabular-nums">{r.rank}</span>
          <span className="flex-1 truncate font-semibold">
            {r.name}
            {r.streak >= 3 && <span className="ml-2 rounded-full bg-amber-400/30 px-2 py-0.5 text-[11px] font-bold text-amber-100">{r.streak} in a row</span>}
          </span>
          {r.last && <span className={`tabular-nums ${r.last.correct ? "text-emerald-200" : "opacity-60"}`}>{r.last.correct ? `+${r.last.points}` : "0"}</span>}
          <span className="w-16 text-right font-semibold tabular-nums">{r.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

function Podium({ rows, spooky }: { rows: ArenaPlayer[]; spooky: boolean }) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 3);
  const heights = ["h-32", "h-24", "h-16"];
  const order = [1, 0, 2].filter((i) => top[i]);
  return (
    <div>
      <p className="text-center text-sm uppercase tracking-[0.12em] opacity-75">{spooky ? "Winner of the showdown" : "Final standings"}</p>
      {top[0] && <p className="mt-1 text-center font-display text-4xl sm:text-5xl">{top[0].name}</p>}
      <div className="mt-6 flex items-end justify-center gap-3">
        {order.map((i) => (
          <div key={top[i].id} className="flex w-28 flex-col items-center">
            <span className="mb-2 truncate text-sm font-semibold">{top[i].name}</span>
            <div className={`flex w-full flex-col items-center justify-start rounded-t-xl bg-white/15 pt-2 ${heights[i]}`}>
              <span className="font-display text-3xl">{i + 1}</span>
              <span className="text-xs tabular-nums opacity-80">{top[i].score.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
      {sorted.length > 3 && (
        <ol className="mt-5 space-y-1 text-sm">
          {sorted.slice(3).map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-1.5">
              <span className="w-6 text-center tabular-nums">{i + 4}</span>
              <span className="flex-1 truncate">{p.name}</span>
              <span className="tabular-nums">{p.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seats at one keyboard
// ---------------------------------------------------------------------------

function SeatPads({ seats, players, qi, startedAt, transport }: { seats: Seat[]; players: ArenaPlayer[]; qi: number; startedAt: number; transport: ArenaTransport }) {
  const answer = useCallback(
    (seat: Seat, pick: number) => {
      transport.sendPlayer({ type: "answer", id: seat.id, i: qi, pick, ms: Date.now() - startedAt });
    },
    [transport, qi, startedAt]
  );
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      for (const seat of seats) {
        const pick = seat.keys.indexOf(key);
        if (pick >= 0) {
          e.preventDefault();
          answer(seat, pick);
          return;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seats, answer]);
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {seats.map((seat) => {
        const me = players.find((p) => p.id === seat.id);
        const done = me?.pick !== undefined;
        return (
          <div key={seat.id} className={`rounded-xl bg-white/10 p-3 ${done ? "opacity-70" : ""}`}>
            <p className="flex items-center justify-between text-sm">
              <span className="font-semibold">{seat.name}</span>
              <span className="text-xs opacity-75">{done ? "Answer in" : `Keys ${seat.label}`}</span>
            </p>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {CHOICE_STYLE.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={done}
                  onClick={() => answer(seat, i)}
                  aria-label={`${seat.name}: answer ${i + 1}`}
                  className={`flex h-11 items-center justify-center rounded-lg text-white ${c.bg} ${done && me?.pick === i ? "ring-4 ring-white" : ""} disabled:cursor-default`}
                >
                  <Shape i={i} size={16} />
                  <span className="ml-1 text-xs font-bold opacity-80">{seat.keys[i].toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LocalSetup({ defaultName, spooky }: { defaultName: string; spooky: boolean }) {
  const [settings, setSettings] = useState<ArenaSettings>(DEFAULT_SETTINGS);
  const [names, setNames] = useState<string[]>([defaultName || "Player 1", "Player 2"]);
  const [game, setGame] = useState<{ transport: ArenaTransport; seats: Seat[] } | null>(null);

  function begin() {
    const used: string[] = [];
    const seats: Seat[] = names.map((n, i) => {
      const name = uniqueName(cleanName(n) || `Player ${i + 1}`, used);
      used.push(name);
      return { id: newId(), name, keys: LOCAL_KEYS[i], label: LOCAL_KEY_LABELS[i] };
    });
    setGame({ transport: localTransport(), seats });
  }

  if (game) return <HostGame code={null} transport={game.transport} settings={settings} spooky={spooky} seats={game.seats} />;
  return (
    <div className="card space-y-5">
      <div>
        <span className="label">Who is playing</span>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {names.map((n, i) => (
            <label key={i} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">{LOCAL_KEY_LABELS[i]}</span>
              <input className="field" value={n} maxLength={16} onChange={(e) => setNames((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Player ${i + 1} name`} />
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {names.length < LOCAL_MAX_PLAYERS && (
            <button type="button" onClick={() => setNames((cur) => [...cur, `Player ${cur.length + 1}`])} className="btn-secondary btn-sm">
              <Icon name="plus" size={14} />
              Add a player
            </button>
          )}
          {names.length > 2 && (
            <button type="button" onClick={() => setNames((cur) => cur.slice(0, -1))} className="btn-ghost btn-sm">
              Remove one
            </button>
          )}
        </div>
        <p className="field-hint">Each player answers with their own four keys, left to right for the four colors, or by tapping their pad.</p>
      </div>
      <SettingsForm value={settings} onChange={setSettings} />
      <button type="button" onClick={begin} className="btn-primary">
        Start
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Joining from a phone
// ---------------------------------------------------------------------------

function JoinScreen({ defaultName, startCode }: { defaultName: string; startCode: string }) {
  const [code, setCode] = useState(startCode);
  const [name, setName] = useState(defaultName);
  const [joined, setJoined] = useState<{ code: string; name: string } | null>(null);
  useEffect(() => {
    if (startCode) setCode(startCode);
  }, [startCode]);
  if (joined) return <PlayerGame code={joined.code} name={joined.name} />;
  const ok = isCode(code) && cleanName(name).length > 0;
  return (
    <form
      className="card max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) setJoined({ code, name: cleanName(name) });
      }}
    >
      <label className="block">
        <span className="label">Game code</span>
        <input
          className="field mt-1.5 font-display text-2xl uppercase tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          placeholder="ABCDEF"
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
        />
      </label>
      <label className="block">
        <span className="label">Your name</span>
        <input className="field mt-1.5" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="First name" autoComplete="given-name" />
        <span className="field-hint">Shown to the room. A first name is plenty.</span>
      </label>
      <button type="submit" disabled={!ok} className="btn-primary w-full">
        Join
      </button>
    </form>
  );
}

function PlayerGame({ code, name }: { code: string; name: string }) {
  const id = useMemo(newId, []);
  const [msg, setMsg] = useState<HostMessage | null>(null);
  const [state, setState] = useState<"connecting" | "waiting" | "in" | "error">("connecting");
  const [pick, setPick] = useState<number | null>(null);
  const receivedAt = useRef(0);
  const transportRef = useRef<ArenaTransport | null>(null);
  const { playCorrect, playWrong } = useSound();

  useEffect(() => {
    const t = realtimeTransport(code);
    if (!t) {
      setState("error");
      return;
    }
    transportRef.current = t;
    let joinTimer = 0;
    let cancelled = false;
    const off = t.onHost((m) => {
      if (cancelled) return;
      if (m.type === "lobby") {
        if (m.players.some((p) => p.id === id)) {
          setState("in");
          window.clearInterval(joinTimer);
        }
      }
      if (m.type === "question") {
        receivedAt.current = Date.now();
        setPick(null);
      }
      setMsg(m);
    });
    t.ready
      .then(() => {
        if (cancelled) return;
        setState("waiting");
        const join = () => t.sendPlayer({ type: "join", id, name });
        join();
        // Until the host lists us, say hello again every couple of seconds.
        joinTimer = window.setInterval(join, 2000);
      })
      .catch(() => setState("error"));
    return () => {
      cancelled = true;
      window.clearInterval(joinTimer);
      off();
      t.sendPlayer({ type: "leave", id });
      t.close();
    };
  }, [code, id, name]);

  // A sound for your own result.
  useEffect(() => {
    if (msg?.type !== "result") return;
    const me = msg.standings.find((s) => s.id === id);
    if (me?.last?.correct) playCorrect();
    else if (me?.last) playWrong();
  }, [msg, id, playCorrect, playWrong]);

  function answer(i: number) {
    if (!msg || msg.type !== "question" || pick !== null) return;
    setPick(i);
    transportRef.current?.sendPlayer({ type: "answer", id, i: msg.q.i, pick: i, ms: Date.now() - receivedAt.current });
  }

  if (state === "error") return <p className="notice-error">Could not reach the room. Check the code and the connection, then try again.</p>;
  if (state === "connecting") return <p className="notice-info">Connecting to room {code}...</p>;
  if (!msg || msg.type === "lobby") {
    return (
      <div className="arena-stage px-5 py-8 text-center">
        <p className="text-sm uppercase tracking-[0.12em] opacity-75">Room {code}</p>
        <p className="mt-2 font-display text-3xl">{state === "in" ? `You're in, ${name}.` : `Joining as ${name}...`}</p>
        <p className="mt-2 text-sm opacity-80">{state === "in" ? "Watch the host's screen. The game starts from there." : "Looking for the host. Make sure the code matches their screen."}</p>
        {msg?.type === "lobby" && <p className="mt-4 text-sm opacity-80">{msg.players.length} in the room</p>}
      </div>
    );
  }
  if (msg.type === "question") {
    return (
      <div className="arena-stage px-4 py-4">
        <Timer endsAt={msg.endsAt} key={msg.q.i} />
        <p className="mt-3 text-xs uppercase tracking-[0.1em] opacity-70">
          Question {msg.q.i + 1} of {msg.total}
        </p>
        <p className="mt-1 text-lg font-semibold leading-snug">
          <MathText text={msg.q.prompt} />
        </p>
        {pick === null ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {msg.q.choices.map((c, i) => (
              <button key={i} type="button" onClick={() => answer(i)} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl text-xl font-semibold text-white ${CHOICE_STYLE[i].bg} active:scale-[0.97]`}>
                <Shape i={i} size={22} />
                <MathText text={c} />
              </button>
            ))}
          </div>
        ) : (
          <div className={`mt-4 flex items-center justify-center gap-3 rounded-xl py-10 text-xl font-semibold text-white ${CHOICE_STYLE[pick].bg}`}>
            <Shape i={pick} size={22} />
            Answer in. Hold tight.
          </div>
        )}
      </div>
    );
  }
  if (msg.type === "result") {
    const me = msg.standings.find((s) => s.id === id);
    const right = me?.last?.correct ?? false;
    return (
      <div className={`arena-stage px-5 py-8 text-center ${right ? "arena-right" : "arena-wrong"}`}>
        <p className="font-display text-4xl">{me?.last ? (right ? "Correct!" : "Not this one") : "No answer in time"}</p>
        {me?.last && right && <p className="mt-1 text-lg">+{me.last.points.toLocaleString()} points</p>}
        <p className="mt-4 text-sm opacity-80">The answer was</p>
        <p className="mt-1 inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 font-semibold">
          <Shape i={msg.q.answer} />
          <MathText text={msg.q.choices[msg.q.answer]} />
        </p>
        {me && (
          <p className="mt-5 text-sm">
            You are <span className="font-display text-2xl">{me.rank}</span>
            {me.rank === 1 ? "st" : me.rank === 2 ? "nd" : me.rank === 3 ? "rd" : "th"} with {me.score.toLocaleString()} points
          </p>
        )}
      </div>
    );
  }
  if (msg.type === "podium") {
    const me = msg.standings.find((s) => s.id === id);
    return (
      <div className="arena-stage px-5 py-8 text-center">
        <p className="text-sm uppercase tracking-[0.12em] opacity-75">Final</p>
        <p className="mt-2 font-display text-5xl">{me ? `${me.rank}${me.rank === 1 ? "st" : me.rank === 2 ? "nd" : me.rank === 3 ? "rd" : "th"}` : "Done"}</p>
        {me && <p className="mt-1 text-lg">{me.score.toLocaleString()} points</p>}
        <p className="mt-4 text-sm opacity-80">{msg.standings[0] ? `${msg.standings[0].name} won.` : ""} Thanks for playing.</p>
      </div>
    );
  }
  return <p className="notice-info">The host closed the room.</p>;
}
