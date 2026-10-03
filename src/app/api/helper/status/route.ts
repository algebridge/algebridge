import { NextResponse } from "next/server";
import { helperGroqModels } from "@/lib/ai-provider";

/**
 * Is a model actually answering?
 *
 * A missing key, a wrong key, and a retired model name all produce the same
 * visible symptom: canned local replies. This makes the difference legible by
 * doing a real round trip and reporting exactly where it stopped.
 *
 * The round trip is made at most once every ten minutes. Every GET used to
 * call the model, which let anyone with the URL spend the quota. The result is
 * kept in memory and the response may be cached at the edge for as long, so a
 * fresh check after changing a key means a redeploy, which clears both.
 *
 * Deliberately returns no key material, only whether one is present and what
 * happened when it was used. Safe to hit from a browser.
 */

const CACHE_MS = 10 * 60 * 1000;

type Status = Record<string, unknown>;

let cached: { at: number; status: Status } | null = null;
let inflight: Promise<Status> | null = null;

async function probe(): Promise<Status> {
  const groq = process.env.GROQ_API_KEY;
  const openai = process.env.OPENAI_API_KEY;

  // Gemini is intentionally excluded from the helper (its terms bar services
  // likely used by under-18s), so it is not probed here either.
  const configured = { groq: !!groq, openai: !!openai };

  if (!groq && !openai) {
    return {
      answering: false,
      configured,
      verdict:
        "No key set. The helper is running on the deterministic engine, so replies are canned and no student message leaves this server.",
    };
  }

  const tried: { model: string; ok: boolean; detail: string }[] = [];

  // Probe in the same order the helper itself resolves a provider.
  if (groq) {
    for (const model of helperGroqModels()) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groq}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Reply with the single word: ready" }],
            max_tokens: 200,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          tried.push({ model: `groq:${model}`, ok: false, detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 140)}` });
          continue;
        }
        const text = (await res.json())?.choices?.[0]?.message?.content;
        if (!text) {
          tried.push({ model: `groq:${model}`, ok: false, detail: "200 but no text" });
          continue;
        }
        const provider = `groq:${model}`;
        return {
          answering: true,
          provider,
          configured,
          sample: String(text).trim().slice(0, 80),
          tried,
          verdict: `${provider} is answering. The helper will use it and the answer filter still applies.`,
        };
      } catch (e) {
        tried.push({ model: `groq:${model}`, ok: false, detail: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return {
    answering: false,
    configured,
    tried,
    verdict: groq
      ? "A key is set but no model answered. The reasons are in `tried`: a 400 usually means the key is wrong, a 404 means the model name is retired, and a 429 means the free quota is spent."
      : "Only an OpenAI key is set. It is not probed here; the helper will try it on each request.",
  };
}

export async function GET() {
  if (!cached || Date.now() - cached.at >= CACHE_MS) {
    // Requests that arrive while a probe is running share it.
    inflight ??= probe().finally(() => {
      inflight = null;
    });
    cached = { at: Date.now(), status: await inflight };
  }
  return NextResponse.json(
    { ...cached.status, checkedAt: new Date(cached.at).toISOString() },
    { headers: { "Cache-Control": `public, max-age=60, s-maxage=${CACHE_MS / 1000}` } }
  );
}
