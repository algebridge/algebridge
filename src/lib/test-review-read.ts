/**
 * The photo reader's instructions, and the default reader: Groq's Qwen 3.8
 * 27B, a model that takes images, on the GROQ_API_KEY the app already has.
 * Server only (it reads the key). Used by src/app/api/test-review/read/route.ts
 * and measured by scripts against real and generated test photos.
 */
import type { TestImage as Img } from "@/lib/test-review";

export const READ_INSTRUCTIONS = `These are photos of a student's graded math test. Transcribe them into plain text so a teacher can review the work.

First decide what you are looking at:
- If the photos show no math work at all (not a test, quiz, worksheet or homework), reply with exactly: NOT_A_TEST
- If they show math but are too blurry, dark or cut off to read even one complete question, reply with exactly: UNREADABLE
Otherwise transcribe, following these rules:
- One question per line, numbered as on the page: "1) <problem>   student wrote: <answer>".
- Copy the student's answer exactly, even when it is wrong. Never correct it.
- Keep the teacher's marks: write "[marked wrong]", "[marked right]", "[-2 points]" where you see them. If a score is written anywhere (like 14/20 or 70%), put "Score: ..." on the first line.
- Math in plain text: x^2, sqrt(), fractions as a/b, use - for minus. Keep every sign.
- Include the student's work lines when there are any, indented under the question.
- Replace any person's name with [name]. Skip class, date and teacher lines.
- If a part is unreadable, write [unreadable] there instead of guessing.
Return only the transcript.`;

const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";
/**
 * When Groq last said "not until": until then every page goes straight to the
 * backup reader instead of spending a request (and the student's time) on a
 * refusal. Per server process, which is all a dev server or one instance needs.
 */
let groqRestUntil = 0;
/** Seconds until Groq takes a page again (0 when it is ready). */
export function groqRestSeconds(now = Date.now()): number {
  return Math.max(0, Math.ceil((groqRestUntil - now) / 1000));
}
function restGroq(seconds: number) {
  groqRestUntil = Math.max(groqRestUntil, Date.now() + seconds * 1000);
}
/** Under the free tier's 1,000-output-tokens-a-minute cap, which refuses any call that could pass it. */
const GROQ_MAX_TOKENS = 900;
/** Reasoning models sometimes wrap their thinking in <think> tags: never show it. */
function withoutThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "").trim();
}

/**
 * One page per call, so each answer stays under Groq's per-minute output cap.
 * A 429 that says when to retry is waited out, up to `budgetMs` in all.
 */
export async function readWithGroq(images: Img[], budgetMs = 15000): Promise<string | null> {
  const started = Date.now();
  let busyTries = 0;
  const pages: string[] = [];
  for (const img of images) {
    for (;;) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_VISION_MODEL,
          max_tokens: GROQ_MAX_TOKENS,
          temperature: 0,
          reasoning_effort: "none",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: READ_INSTRUCTIONS },
                { type: "image_url", image_url: { url: `data:${img.media};base64,${img.data}` } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (res.status === 429) {
        const wait = Math.ceil(Number(res.headers.get("retry-after")) || 0) * 1000;
        if (wait > 0 && Date.now() - started + wait < budgetMs) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        // A wait of minutes means the free daily allowance is spent, not a busy minute.
        const retryAfter = Math.ceil(wait / 1000) || 30;
        restGroq(retryAfter);
        throw Object.assign(new Error(wait > 120000 ? "rate-day" : "rate"), { retryAfter });
      }
      if (res.status === 401) throw new Error("auth");
      // 503 "over capacity" is Groq being busy, not a bad photo: back off and try again.
      if (res.status === 503 || res.status === 502) {
        const wait = Math.min(8000, 1000 * 2 ** busyTries++);
        if (Date.now() - started + wait < budgetMs) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        restGroq(20);
        throw Object.assign(new Error("rate"), { retryAfter: 20 });
      }
      if (!res.ok) return null;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = withoutThinking(data.choices?.[0]?.message?.content ?? "");
      if (text) pages.push(text);
      break;
    }
  }
  if (!pages.length) return null;
  // A page that says NOT_A_TEST or UNREADABLE alone decides only when every page does.
  const real = pages.filter((p) => !/^(NOT_A_TEST|UNREADABLE)$/.test(p.trim()));
  return real.length ? real.join("\n\n") : pages[0];
}


const OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:3b";

/** When Ollama last said the model is installed: busy loading, it can be slow to answer, which is not "gone". */
let ollamaSeenAt = 0;
/** Is the local vision model there? (Ollama runs as a login service on the dev Mac.) */
export async function ollamaUp(): Promise<boolean> {
  if (Date.now() - ollamaSeenAt < 2 * 60 * 1000) return true;
  try {
    const res = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { models?: { name: string }[] };
    const up = (data.models ?? []).some((m) => m.name === OLLAMA_MODEL || m.name.startsWith(`${OLLAMA_MODEL}:`));
    if (up) ollamaSeenAt = Date.now();
    return up;
  } catch {
    return false;
  }
}

/** One page at a time through the local model, across every request: two at once on an 8 GB Mac only swap. */
let ollamaQueue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const next = ollamaQueue.then(job, job);
  ollamaQueue = next.catch(() => undefined);
  return next;
}

/**
 * The backup reader: a vision model on this computer. No key, no account, no
 * daily cap; it is slower (about 20 s to a minute a page once loaded, a few
 * minutes for the first page while the model loads) and reads messy writing a
 * little worse, which the student's check step catches. The model is let go 5
 * minutes after the last page so it does not hold memory.
 */
export async function readWithOllama(images: Img[]): Promise<string | null> {
  const pages: string[] = [];
  // One page per call: the small model loses track with several pictures.
  for (const img of images) {
    const text = await oneAtATime(async () => {
      // A timeout here is also "busy": the model did not load in time.
      const res = await fetch(`${OLLAMA}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          keep_alive: "5m",
          options: { temperature: 0, num_predict: 1500 },
          messages: [{ role: "user", content: READ_INSTRUCTIONS, images: [img.data] }],
        }),
        // A cold load on a busy 8 GB Mac took 2 to 3 minutes: wait for it rather than fail.
        signal: AbortSignal.timeout(10 * 60 * 1000),
      });
      // Ollama could not load the model (the Mac is short of memory) or errored: busy, not a bad photo.
      if (!res.ok) throw Object.assign(new Error("local-busy"), { retryAfter: 120 });
      const data = (await res.json()) as { message?: { content?: string } };
      return withoutThinking(data.message?.content ?? "") || null;
    });
    if (text) pages.push(text);
  }
  if (!pages.length) return null;
  const real = pages.filter((p) => !/^(NOT_A_TEST|UNREADABLE)$/.test(p.trim()));
  return real.length ? real.join("\n\n") : pages[0];
}
