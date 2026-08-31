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

  if (gemini) {
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(gemini)}`,
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
          const body = await res.text();
          tried.push({ model, ok: false, detail: `HTTP ${res.status}: ${body.slice(0, 160)}` });
          continue;
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          tried.push({ model, ok: false, detail: "200 but no text in the response" });
          continue;
        }
        return NextResponse.json({
          answering: true,
          provider: `gemini:${model}`,
          configured,
          sample: String(text).trim().slice(0, 80),
          tried,
          verdict: `Gemini is answering on ${model}. The helper will use it and the answer filter still applies.`,
        });
      } catch (e) {
        tried.push({ model, ok: false, detail: e instanceof Error ? e.message : String(e) });
      }
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
