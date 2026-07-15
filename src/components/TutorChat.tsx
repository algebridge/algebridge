"use client";

import { useEffect, useRef, useState } from "react";
import type { Skill } from "@/types";
import { fetchTutorChat, type TutorChatMessage, type TutorContext } from "@/lib/tutor";

const GREETING =
  "Hey! I'm Bridge Tutor. 👋 Ask me anything about this skill — say \"give me a hint\", show me your work, or tell me where you're stuck. I won't hand you the answer, but I'll help you get there.";

const SUGGESTIONS = ["Give me a hint", "I'm stuck — where do I start?", "Why does this work?"];

export function TutorChat({ skill }: { skill: Skill }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TutorChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const anchor = skill.problems[0];
  const ctx: TutorContext = {
    skillTitle: skill.title,
    keyIdea: skill.keyIdea,
    learningGoal: skill.learningGoal,
    problemPrompt: anchor?.prompt ?? "the practice problems for this skill",
    hint: anchor?.hint ?? "",
    explanation: anchor?.explanation ?? "",
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const { message } = await fetchTutorChat(ctx, next);
    setMessages((m) => [...m, { role: "assistant", content: message }]);
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <span className="font-bold text-slate-900">Chat with a Tutor</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            Beta
          </span>
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <div
            ref={scrollRef}
            className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3"
            aria-live="polite"
          >
            <Bubble role="assistant" text={GREETING} />
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.content} />
            ))}
            {loading && <Bubble role="assistant" text="…" typing />}
          </div>

          {messages.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-bridge-400 hover:bg-slate-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mt-3 flex gap-2"
          >
            <label htmlFor="tutor-chat-input" className="sr-only">
              Message the tutor
            </label>
            <input
              id="tutor-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the tutor… (it won't give the answer away)"
              disabled={loading}
              autoComplete="off"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200 disabled:bg-slate-100"
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn-primary shrink-0 text-sm disabled:opacity-50">
              Send
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Beta feature · The tutor guides you to the answer — it never just gives it away.
          </p>
        </div>
      )}
    </div>
  );
}

function Bubble({ role, text, typing }: { role: "user" | "assistant"; text: string; typing?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-bridge-600 text-white"
            : "border border-slate-200 bg-white text-slate-700"
        } ${typing ? "animate-pulse text-slate-400" : ""}`}
      >
        {text}
      </div>
    </div>
  );
}
