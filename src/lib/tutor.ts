interface TutorContext {
  skillTitle: string;
  keyIdea: string;
  learningGoal: string;
  problemPrompt: string;
  hint: string;
  explanation: string;
  userAttempt?: string;
  wrongAttempts?: number;
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

/**
 * Builds a Socratic, graduated hint that helps the student find the answer
 * themselves. It intentionally never includes `ctx.explanation` (which
 * usually contains the final answer) — only the key idea and the hint,
 * revealed in increasing detail the more times the student has struggled.
 * Emphasis is conveyed through plain wording (short labels, emoji) instead
 * of markdown, since this text is displayed as-is, not rendered as markdown.
 */
export function buildLocalTutorResponse(ctx: TutorContext): string {
  const attempts = ctx.wrongAttempts ?? 0;
  const parts: string[] = [];

  parts.push(
    `Let's work through ${ctx.skillTitle} together — I won't just hand you the answer, I'll help you find it. 💪`
  );

  if (attempts === 0) {
    parts.push(`Think about this first: ${ctx.keyIdea}`);
    parts.push(
      `Look at your problem again — "${ctx.problemPrompt}". Based on that idea, what's the very first move you'd make? Try it and see what you get.`
    );
    if (ctx.userAttempt) {
      parts.push(
        `You tried "${ctx.userAttempt}" — before changing anything, check: did your first step match that idea?`
      );
    }
  } else if (attempts === 1) {
    parts.push(
      `You've given it a shot already — that's how learning works! Here's a more specific nudge:`
    );
    parts.push(`Hint: ${ctx.hint}`);
    parts.push(
      `Apply that directly to your problem, one small step at a time. What do you get right after that step?`
    );
  } else {
    parts.push(
      `Let's slow all the way down and break it into two small pieces — no need to solve the whole thing at once:`
    );
    parts.push(`1️⃣ ${ctx.keyIdea}`);
    parts.push(`2️⃣ ${ctx.hint}`);
    parts.push(
      `Redo the problem using only those two ideas, writing down what changes after each step. You're closer than you think — walk through it slowly and you'll get there.`
    );
  }

  parts.push(
    `Tip from real classrooms: say each step out loud as you do it ("think-aloud"). It's one of the fastest ways to catch your own mistakes.`
  );

  return parts.join("\n\n");
}

export async function fetchAiTutorHint(
  ctx: TutorContext
): Promise<{ message: string; source: "ai" | "local" }> {
  try {
    const res = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
    });

    if (!res.ok) throw new Error("Tutor API failed");
    const data = (await res.json()) as { message: string; source: "ai" | "local" };
    return { ...data, message: stripMarkdownEmphasis(data.message) };
  } catch {
    return {
      message: buildLocalTutorResponse(ctx),
      source: "local",
    };
  }
}
