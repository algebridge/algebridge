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
export async function readWithGroq(images: Img[], budgetMs = 55000): Promise<string | null> {
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
        throw new Error(wait > 120000 ? "rate-day" : "rate");
      }
      if (res.status === 401) throw new Error("auth");
      // 503 "over capacity" is Groq being busy, not a bad photo: back off and try again.
      if (res.status === 503 || res.status === 502) {
        const wait = Math.min(8000, 1000 * 2 ** busyTries++);
        if (Date.now() - started + wait < budgetMs) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error("rate");
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

