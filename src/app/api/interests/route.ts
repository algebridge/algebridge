import { NextResponse } from "next/server";
import { aiConfigured, callJson, clientKey, makeRateLimiter } from "@/lib/ai-provider";
import { cleanText, mergeTopics, NOTE_MAX, sanitizeTopics, topicsFromPicks, validPicks, validSpecifics } from "@/lib/interests";
import { parseModelJson } from "@/lib/personalize";
import { detectCrisis } from "@/lib/helper";

/**
 * Reads what a student said they are into and turns it into topics that
 * practice problems can be set in.
 *
 * The chips need no model: each one maps to a topic in code. A model is only
 * consulted when the student wrote something in their own words, and only
 * that text and the chip labels are sent, never a name, email or id. Whatever
 * comes back goes through sanitizeTopics, which is what keeps an unsafe or
 * personal "interest" out of every problem written later.
 *
 * Words that sound like the student is in danger (detectCrisis, the list
 * Archie uses) are never sent to a model: the reply carries crisis: true and
 * the topics from the taps alone, and the picker shows the crisis card. The
 * picker makes the same check first, so this is for any other client.
 */

export const maxDuration = 30;

// Per IP, and a class signing up together shares one. At 12 per 10 minutes
// most of a class got chips-only topics. This only stops a runaway script.
const allow = makeRateLimiter(600, 10 * 60 * 1000);

const SYSTEM = `A student aged 12 to 16 told us what they are into. Turn it into topics for setting math word problems.

Rules:
- Turn what they WROTE into topics: include every separate interest they mention, up to 4 ("I bake cookies and post on TikTok" is two: Baking and TikTok). The options they tapped are already kept separately, so only add a tapped one if their writing adds detail to it.
- label: 1 to 3 words, Title Case, like "Basketball", "Formula 1", "Baking".
- details: 3 to 5 concrete things from that world that problems can count or measure, comma separated, like "lap times, pit stops, grid positions".
- specifics: the named things they follow in that world, exactly as they wrote them, comma separated: teams and players, shows and characters, games, artists, creators, brands ("Arsenal, Messi"; "One Piece, Luffy"). Empty string when they named none. Never a person they know personally.
- For a tapped option, you may return it with only specifics filled, when their writing names teams, players, characters or the like for it.
- Leave out anything that is not an interest, anything unkind or not school-appropriate, and anything personal such as names of people they know, their school, or where they live.
- If nothing usable is left, return an empty list.

Reply with JSON only: {"topics":[{"label":"...","details":"...","specifics":"..."}]}`;

export async function POST(request: Request) {
  let body: { picks?: unknown; note?: unknown; specifics?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const picks = validPicks(body.picks);
  const note = cleanText(body.note, NOTE_MAX);
  const specifics = validSpecifics(body.specifics, picks);
  const fromPicks = topicsFromPicks(picks, specifics);

  if (!note) return NextResponse.json({ topics: fromPicks, source: "picks" });
  if (detectCrisis(note)) return NextResponse.json({ topics: fromPicks, source: "picks", crisis: true });
  if (!aiConfigured() || !allow(clientKey(request))) {
    return NextResponse.json({ topics: fromPicks, source: "picks" });
  }

  const tapped = fromPicks.map((t) => (t.specifics ? { interest: t.label, their_specifics: t.specifics } : { interest: t.label }));
  const result = await callJson({
    system: SYSTEM,
    user: JSON.stringify({ tapped, wrote: note }),
    groqModels: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    maxTokens: 700,
    // Reading a sentence into a list should not vary from one save to the next.
    temperature: 0,
    timeoutMs: 12_000,
  });

  const parsed = result ? parseModelJson(result.text) : null;
  const fromNote = sanitizeTopics(parsed?.topics);
  if (!fromNote.length) return NextResponse.json({ topics: fromPicks, source: "picks" });
  return NextResponse.json({ topics: mergeTopics(fromPicks, fromNote), source: "ai" });
}
