import { NextResponse } from "next/server";
import { buildLocalChatReply, stripMarkdownEmphasis } from "@/lib/tutor";
import type { TutorContext, TutorChatMessage } from "@/lib/tutor";

interface ChatRequest {
  context: TutorContext;
  messages: TutorChatMessage[];
}

function systemPrompt(ctx: TutorContext): string {
  return `You are Bridge Tutor, a warm, encouraging Socratic Algebra 1 tutor for grades 7-10 on AlgeBridge, having a back-and-forth chat with a student.
The student is working on this skill: ${ctx.skillTitle}.
Learning goal: ${ctx.learningGoal}
Key idea: ${ctx.keyIdea}
Current problem: ${ctx.problemPrompt}
Built-in hint: ${ctx.hint}
Full solution (context ONLY — never reveal the final answer to the student): ${ctx.explanation}

Rules:
- NEVER give the final answer. Guide the student to it with questions and one small next step at a time.
- If the student proposes an answer, don't confirm or deny it directly — have them check it by substituting back / re-reading the problem.
- Be brief and friendly (usually 2-4 sentences). End with a question or a clear next step.
- This is shown as plain text: never use markdown (**bold**, *italics*, backticks, headers, or bullet markup).
- If the student is off-topic, gently steer back to the math.`;
}

async function callAnthropic(apiKey: string, req: ChatRequest): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 500,
      system: systemPrompt(req.context),
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error("Anthropic request failed");
  const data = await res.json();
  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text;
  if (!text) throw new Error("Empty Anthropic response");
  return text;
}

async function callOpenAI(apiKey: string, req: ChatRequest): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(req.context) },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 350,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error("OpenAI request failed");
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty OpenAI response");
  return text;
}

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body?.context || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // Cap history so a runaway client can't send an unbounded prompt.
  body.messages = body.messages.slice(-20);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    let raw: string | null = null;
    if (anthropicKey) raw = await callAnthropic(anthropicKey, body);
    else if (openaiKey) raw = await callOpenAI(openaiKey, body);
    if (raw) {
      return NextResponse.json({ message: stripMarkdownEmphasis(raw), source: "ai" as const });
    }
  } catch {
    // fall through to the local conversational tutor
  }

  return NextResponse.json({
    message: buildLocalChatReply(body.context, body.messages),
    source: "local" as const,
  });
}
