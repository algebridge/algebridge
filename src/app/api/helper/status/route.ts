import { NextResponse } from "next/server";

/**
 * Is a model actually answering?
 *
 * A missing key, a wrong key, and a retired model name all produce the same
 * visible symptom: canned local replies. This makes the difference legible by
 * doing a real round trip and reporting exactly where it stopped.
 *
 * Deliberately returns no key material, only whether one is present and what
 * happened when it was used. Safe to hit from a browser.
 */

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
  "gemma2-9b-it",
];

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

export async function GET() {
  const gemini = process.env.GEMINI_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  const openai = process.env.OPENAI_API_KEY;

  const configured = { gemini: !!gemini, groq: !!groq, openai: !!openai };

  if (!gemini && !groq && !openai) {
    return NextResponse.json({
      answering: false,
      configured,
      verdict:
        "No key set. The helper is running on the deterministic engine, so replies are canned and no student message leaves this server.",
    });
  }

  const tried: { model: string; ok: boolean; detail: string }[] = [];

  async function probeGemini(key: string) {
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "Reply with the single word: ready" }] }],
              generationConfig: { maxOutputTokens: 200 },
            }),
          }
        );
        if (!res.ok) {
          tried.push({ model: `gemini:${model}`, ok: false, detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 140)}` });
          continue;
        }
        const text = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          tried.push({ model: `gemini:${model}`, ok: false, detail: "200 but no text" });
          continue;
        }
        return { provider: `gemini:${model}`, sample: String(text).trim().slice(0, 80) };
      } catch (e) {
        tried.push({ model: `gemini:${model}`, ok: false, detail: e instanceof Error ? e.message : String(e) });
      }
    }
    return null;
  }

  async function probeGroq(key: string) {
    for (const model of GROQ_MODELS) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Reply with the single word: ready" }],
            max_tokens: 200,
          }),
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
        return { provider: `groq:${model}`, sample: String(text).trim().slice(0, 80) };
      } catch (e) {
        tried.push({ model: `groq:${model}`, ok: false, detail: e instanceof Error ? e.message : String(e) });
      }
    }
    return null;
  }

  // Probe in the same order the helper itself resolves a provider.
  const pick = (process.env.HELPER_PROVIDER ?? "").toLowerCase();
  const order: (() => Promise<{ provider: string; sample: string } | null>)[] = [];
  if (groq && (pick === "groq" || !gemini)) order.push(() => probeGroq(groq));
  if (gemini) order.push(() => probeGemini(gemini));
  if (groq && !order.length) order.push(() => probeGroq(groq));

  for (const probe of order) {
    const hit = await probe();
    if (hit) {
      return NextResponse.json({
        answering: true,
        provider: hit.provider,
        configured,
        sample: hit.sample,
        tried,
        verdict: `${hit.provider} is answering. The helper will use it and the answer filter still applies.`,
      });
    }
  }

  return NextResponse.json({
    answering: false,
    configured,
    tried,
    verdict:
      "A key is set but no model answered. The reasons are in `tried`: a 400 usually means the key is wrong, a 404 means the model name is retired, and a 429 means the free quota is spent.",
  });
}
