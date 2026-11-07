import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { clientKey, makeRateLimiter } from "@/lib/ai-provider";
import { callerOf } from "@/lib/server-auth";
import { parseImages, readerVerdict, type TestImage as Img } from "@/lib/test-review";
import { READ_INSTRUCTIONS as INSTRUCTIONS, readWithGroq } from "@/lib/test-review-read";

/**
 * Turns photos of a graded test into text the student can check.
 *
 * Plain OCR (tesseract) cannot read math: "1 + 1 = 11" came out as "+111".
 * A model that looks at the picture is the only thing that works. Readers, in
 * order:
 *   1. Claude, when ANTHROPIC_API_KEY is set (an optional upgrade).
 *   2. OpenAI, when OPENAI_API_KEY is set (an optional upgrade).
 *   3. Groq's Qwen 3.8 27B, which takes images, on the GROQ_API_KEY Archie
 *      already uses. This is the default: no new key, no new account. Its free
 *      tier caps output at about 1,000 tokens a minute and 200,000 tokens a day
 *      for the whole organization (shared with the story pipeline), so pages
 *      are read one call each, with a short wait when Groq says to retry.
 *   4. A vision model on a local Ollama (qwen2.5vl), dev only.
 * No name is ever put in a prompt; the student crops the name and header off
 * in the browser before anything is sent (src/app/test-review/page.tsx).
 *
 * What is kept, and where: nothing. The photos arrive as data URLs in the
 * request body, go to the reader in that same request, and are gone when the
 * response is sent. Nothing is written to disk, a bucket or a table; only the
 * transcript goes back to the browser, which holds it in memory and session
 * storage until the tab closes. The browser shrinks each photo to 1600 px
 * before sending (src/app/test-review/page.tsx, `shrink`).
 */

export const maxDuration = 90;

// Per account first (one student cannot spend a class's budget), per
// address as the backstop (a school shares one address, so it is generous).
const byAccount = makeRateLimiter(12, 10 * 60 * 1000);
const byAccountDay = makeRateLimiter(40, 24 * 60 * 60 * 1000);
const byAddress = makeRateLimiter(120, 10 * 60 * 1000);
const OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:3b";



async function readWithClaude(images: Img[]): Promise<string | null> {
  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.media, data: img.data } })),
          { type: "text", text: INSTRUCTIONS },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") return null;
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return text || null;
}

async function readWithOpenAI(images: Img[]): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1",
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.media};base64,${img.data}`, detail: "high" } })),
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(80000),
  });
  if (res.status === 429) throw new Error("rate");
  if (res.status === 401) throw new Error("auth");
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function ollamaUp(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).some((m) => m.name === OLLAMA_MODEL || m.name.startsWith(`${OLLAMA_MODEL}:`));
  } catch {
    return false;
  }
}

async function readWithOllama(images: Img[]): Promise<string | null> {
  const pages: string[] = [];
  // One page per call: the small model loses track with several pictures.
  for (const img of images) {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0, num_predict: 1500 },
        messages: [{ role: "user", content: INSTRUCTIONS, images: [img.data] }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const text = data.message?.content?.trim();
    if (text) pages.push(text);
  }
  return pages.length ? pages.join("\n\n") : null;
}

/** Which reader this server has, so the page can say so before a photo is taken. */
export async function GET() {
  const reader = process.env.ANTHROPIC_API_KEY
    ? "claude"
    : process.env.OPENAI_API_KEY
      ? "openai"
      : process.env.GROQ_API_KEY
        ? "groq"
        : (await ollamaUp())
          ? "local"
          : null;
  return NextResponse.json({ reader });
}

export async function POST(request: Request) {
  const caller = await callerOf(request);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });

  let body: { images?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const images = parseImages(body.images);
  if (!images) return NextResponse.json({ error: "Send 1 to 6 photos (JPEG, PNG or WebP, under 4 MB each)." }, { status: 400 });

  const who = caller.id ?? clientKey(request);
  if (!byAddress(clientKey(request)) || !byAccount(who) || !byAccountDay(who)) {
    return NextResponse.json({ error: "That is a lot of photos in a row. Try again in a few minutes." }, { status: 429 });
  }

  let raw: string | null = null;
  let provider: "claude" | "openai" | "groq" | "local" | null = null;
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      provider = "claude";
      raw = await readWithClaude(images);
    } else if (process.env.OPENAI_API_KEY) {
      provider = "openai";
      raw = await readWithOpenAI(images);
    } else if (process.env.GROQ_API_KEY) {
      provider = "groq";
      raw = await readWithGroq(images);
    } else if (await ollamaUp()) {
      provider = "local";
      raw = await readWithOllama(images);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // How long until the reader takes a photo again: the page waits it out on screen, or says when.
    const retryAfter = Number((e as { retryAfter?: number }).retryAfter) || undefined;
    if (msg === "rate-day") return NextResponse.json({ error: "The photo reader has read all it can for now. Type the questions and your answers in, or try the photo again in an hour or two.", retryAfter }, { status: 429 });
    if (msg === "rate") return NextResponse.json({ error: "The photo reader is busy. Try again in a minute.", retryAfter: retryAfter ?? 30 }, { status: 429 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The photo reader is busy. Try again in a minute." }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError || msg === "auth") return NextResponse.json({ error: "The photo reader's key is not valid." }, { status: 503 });
    return NextResponse.json({ error: "The photo could not be read right now. Type the questions in instead." }, { status: 502 });
  }

  if (!provider) return NextResponse.json({ error: "Photo reading is not set up on this server. Type the questions and your answers in." }, { status: 503 });
  if (!raw) return NextResponse.json({ error: "The photo could not be read. Try a brighter, straight-on picture, or type the questions in." }, { status: 502 });

  const verdict = readerVerdict(raw);
  if (verdict.kind === "not-a-test") {
    return NextResponse.json({ error: "That does not look like a math test. Take a photo of the graded pages, with the questions and your answers in the frame." }, { status: 422 });
  }
  if (verdict.kind === "unreadable") {
    return NextResponse.json({ error: "The writing is too blurry or dark to read. Try again in better light, flat on a table, with the whole page in the frame." }, { status: 422 });
  }
  return NextResponse.json({ text: verdict.text, unreadableParts: verdict.unreadableParts, provider });
}
