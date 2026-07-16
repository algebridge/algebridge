export interface TutorContext {
  skillTitle: string;
  keyIdea: string;
  learningGoal: string;
  problemPrompt: string;
  hint: string;
  explanation: string;
  userAttempt?: string;
  wrongAttempts?: number;
}

export interface TutorChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Strips markdown emphasis syntax (**bold**, __bold__, *italic*, _italic_) so
 * hint text never shows literal asterisks/underscores — the tutor UI renders
 * plain text, not markdown. Keeps the wrapped words, just drops the markers.
 */
export function stripMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "$1")
    .replace(/(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1");
}

// ---------------------------------------------------------------------------
// Problem analysis — lets the built-in tutor give guidance specific to THIS
// problem (which operation to undo first, whether to flip an inequality, …)
// rather than only restating the generic hint. Never reveals the final answer.
// ---------------------------------------------------------------------------
function firstStepFor(prompt: string): string | null {
  const p = prompt.replace(/\s+/g, " ").trim();

  // ax + b = c  or  ax - b = c   (two-step linear)
  let m = p.match(/(-?\d+)\s*x\s*([+\-−])\s*(\d+)\s*=/);
  if (m) {
    const sign = m[2] === "+" ? "add" : "subtract";
    const undo = sign === "add" ? "subtract" : "add";
    const b = m[3];
    return `This is a two-step equation. Undo the "${sign === "add" ? "+" : "−"} ${b}" first by ${undo}ing ${b} from BOTH sides, then divide both sides by the number in front of x.`;
  }

  // x + b = c  or  x - b = c   (one-step add/subtract)
  m = p.match(/(?:^|[^0-9])x\s*([+\-−])\s*(\d+)\s*=/);
  if (m) {
    const undo = m[1] === "+" ? "subtract" : "add";
    return `x is by itself except for a "${m[1] === "+" ? "+" : "−"} ${m[2]}". Do the opposite to BOTH sides: ${undo} ${m[2]}.`;
  }

  // ax = c   (one-step multiply/divide)
  m = p.match(/(-?\d+)\s*x\s*=/);
  if (m && m[1] !== "1" && m[1] !== "-1") {
    return `x is being multiplied by ${m[1]}. Undo that by dividing BOTH sides by ${m[1]}.`;
  }

  // inequality
  if (/[<>]=?|≤|≥/.test(p) && /x/.test(p)) {
    return `Solve it just like an equation to get x by itself — but remember: if you multiply or divide both sides by a NEGATIVE number, flip the inequality sign.`;
  }

  // quadrant / coordinate
  m = p.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
  if (m && /quadrant/i.test(p)) {
    const xs = m[1].startsWith("-") ? "negative" : "positive";
    const ys = m[2].startsWith("-") ? "negative" : "positive";
    return `Look at the SIGNS: the x-coordinate is ${xs} and the y-coordinate is ${ys}. Quadrants go counter-clockwise starting from the top-right (+, +).`;
  }

  // slope between two points
  if (/slope/i.test(p) && /\(.*\).*\(.*\)/.test(p)) {
    return `Slope = rise over run = (change in y) ÷ (change in x). Subtract the y-values on top, the x-values on the bottom — keep the points in the same order.`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Conversational fallback for the chat tutor (used when no AI key is set).
// Classifies the student's latest message and responds Socratically without
// ever revealing the final answer.
// ---------------------------------------------------------------------------
export function buildLocalChatReply(ctx: TutorContext, messages: TutorChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const text = last.toLowerCase().trim();
  const priorTutorTurns = messages.filter((m) => m.role === "assistant").length;
  const firstStep = firstStepFor(ctx.problemPrompt);

  const isGreeting = /^(hi|hey|hello|yo|sup|hiya)\b/.test(text) || text.length === 0;
  const wantsHint = /\b(hint|help|stuck|lost|confus|don'?t (get|understand|know)|no idea|how do i|where do i start|start)\b/.test(text);
  const claimsAnswer = /\b(is it|answer is|i got|equals?|=)\b/.test(text) && /-?\d/.test(text);
  const wantsWhy = /\b(why|how come|what does|what is|explain)\b/.test(text);
  const wantsNext = /\b(next|then what|after that|now what|what now)\b/.test(text);

  if (isGreeting) {
    return `Hey! I'm your Bridge Tutor for ${ctx.skillTitle}. 👋 Tell me where you're stuck on "${ctx.problemPrompt}" — or just say "give me a hint" and we'll take it one step at a time. I won't hand you the answer, but I'll get you there.`;
  }

  if (claimsAnswer) {
    return `Nice — instead of me telling you if that's right, let's PROVE it: take your value and substitute it back into "${ctx.problemPrompt}". If both sides come out equal, you nailed it. Does it check out? Show me what you get when you plug it in.`;
  }

  if (wantsWhy) {
    return `Good question — that's the important part. The key idea here: ${ctx.keyIdea}\n\nDoes that help it click? If not, tell me which part feels fuzzy and I'll zoom in.`;
  }

  if (wantsNext) {
    return `${firstStep ? firstStep + "\n\n" : ""}Do that step, then tell me the new version of the problem. What does it look like now?`;
  }

  if (wantsHint || priorTutorTurns === 0) {
    if (priorTutorTurns <= 1) {
      return `Let's start here: ${ctx.keyIdea}\n\n${firstStep ? firstStep : `Look at "${ctx.problemPrompt}" — what's the first operation you'd undo?`}\n\nTry just that first step and tell me what you get.`;
    }
    return `More specific nudge: ${ctx.hint}\n\nApply that one small step and show me the result — we'll take the next one together.`;
  }

  // Default: treat their message as a work-in-progress and keep them moving.
  return `Okay, walk me through your thinking on that. ${firstStep ? "Remember: " + firstStep : "Remember the key idea: " + ctx.keyIdea}\n\nWhat do you get after your next step?`;
}

export async function fetchTutorChat(
  ctx: TutorContext,
  messages: TutorChatMessage[]
): Promise<{ message: string; source: "ai" | "local" }> {
  try {
    const res = await fetch("/api/tutor/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: ctx, messages }),
    });
    if (!res.ok) throw new Error("Tutor chat API failed");
    const data = (await res.json()) as { message: string; source: "ai" | "local" };
    return { ...data, message: stripMarkdownEmphasis(data.message) };
  } catch {
    return { message: buildLocalChatReply(ctx, messages), source: "local" };
  }
}
