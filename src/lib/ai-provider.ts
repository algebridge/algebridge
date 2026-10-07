/**
 * One JSON-returning model call, for the server routes that need structured
 * output (interests, personalized problems). Server only: it reads API keys.
 *
 * Same provider policy as the study helper: Groq first, OpenAI as the backup,
 * and never Gemini, whose terms forbid services likely to be used by under-18s.
 * Raw fetch rather than an SDK, so a failure is visible and nothing retries
 * behind our back against a free-tier quota.
 */

export interface JsonCallOptions {
  system: string;
  user: string;
  /** Groq model ids to try in order. */
  groqModels: string[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  /** For reasoning models. Checking arithmetic deserves more than writing prose. */
  reasoningEffort?: "low" | "medium" | "high";
  /**
   * How long, in total, to wait out 429s that say when to retry. 0 fails
   * fast, which is right when a student is already waiting on the answer.
   */
  retryWithinMs?: number;
  /**
   * A smaller output ceiling for some models. The free tier caps some models'
   * output per minute (qwen: 1,000 tokens) and refuses outright any request
   * whose ceiling could pass it, so a call sized for a reasoning model never
   * reaches them.
   */
  modelMaxTokens?: Record<string, number>;
  /** Told why each model was skipped, for diagnostics. */
  onSkip?: (model: string, why: string) => void;
}

export interface JsonCallResult {
  text: string;
  provider: string;
}

/**
 * The Groq models the study helper tries, in order, shared with its status
 * probe so the probe checks what the helper will really call.
 *
 * Model ids here are retired often, and fast. Every Llama id this list
 * originally held was already gone by the time a key was issued, which made a
 * perfectly valid key look rejected, and groq/compound-mini was retired by
 * Oct 2026 (a 404 on every fallback). These three were verified against the
 * live model list; the order is largest first for answer quality.
 *
 * qwen3.6-27b is deliberately absent: it emits its chain of thought inside
 * <think> tags, which is not something to show a student.
 */
export const HELPER_GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
];

/** HELPER_GROQ_MODELS with GROQ_MODEL, when it is set, tried first. */
export function helperGroqModels(): string[] {
  const preferred = process.env.GROQ_MODEL;
  return preferred ? [preferred, ...HELPER_GROQ_MODELS.filter((m) => m !== preferred)] : HELPER_GROQ_MODELS;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
}

async function post(url: string, key: string, body: Record<string, unknown>, timeoutMs: number) {
  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function contentOf(data: unknown): string | null {
  const text = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  return typeof text === "string" && text.trim() ? text : null;
}

export async function callJson(opts: JsonCallOptions): Promise<JsonCallResult | null> {
  const messages = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  const groq = process.env.GROQ_API_KEY;
  if (groq) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    // Each model has its own free quota, so a 429 moves straight on to the
    // next model instead of waiting. Only when every model is out does the
    // call wait for the soonest one, and only if the caller has time.
    const waits: number[] = [];
    let waited = 0;
    for (let pass = 0; pass < 4; pass += 1) {
      for (const model of opts.groqModels) {
        const base = { model, messages, max_tokens: opts.modelMaxTokens?.[model] ?? opts.maxTokens, temperature: opts.temperature };
        // JSON mode and a reasoning budget where the model takes them. A 400
        // means this model does not, so the same call goes again without them.
        const tuned: Record<string, unknown> = { ...base, response_format: { type: "json_object" } };
        if (model.startsWith("openai/gpt-oss")) tuned.reasoning_effort = opts.reasoningEffort ?? "low";
        try {
          let res = await post(url, groq, tuned, opts.timeoutMs);
          if (res.status === 400) res = await post(url, groq, base, opts.timeoutMs);
          if (res.status === 429) {
            const wait = Number(res.headers.get("retry-after")) * 1000;
            if (wait > 0) waits.push(wait);
            // The body names the organization, so only its gist is passed on.
            const body = wait > 0 ? "" : await res.text().catch(() => "");
            opts.onSkip?.(model, wait > 0 ? `429, retry in ${wait} ms` : /too large/i.test(body) ? "429, request over the per-minute output cap" : "429");
            continue;
          }
          if (!res.ok) {
            opts.onSkip?.(model, `${res.status}`);
            continue;
          }
          const text = contentOf(await res.json());
          if (text) return { text, provider: `groq:${model}` };
          opts.onSkip?.(model, "empty reply");
        } catch (e) {
          // Timeout or network: try the next model.
          opts.onSkip?.(model, e instanceof Error ? e.name : "error");
        }
      }
      const soonest = waits.length ? Math.min(...waits) : 0;
      if (!opts.retryWithinMs || !soonest || waited + soonest > opts.retryWithinMs) break;
      await new Promise((r) => setTimeout(r, soonest));
      waited += soonest;
      waits.length = 0;
    }
  }

  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    try {
      const res = await post(
        "https://api.openai.com/v1/chat/completions",
        openai,
        {
          model: "gpt-4o-mini",
          messages,
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
          response_format: { type: "json_object" },
        },
        opts.timeoutMs
      );
      if (res.ok) {
        const text = contentOf(await res.json());
        if (text) return { text, provider: "openai:gpt-4o-mini" };
      }
    } catch {
      /* fall through */
    }
  }

  return null;
}

/**
 * A per-instance request budget, keyed by IP. On serverless it only holds
 * within one warm instance, which is fine for its job: stopping a runaway
 * script. Set limits for a whole school behind one IP, never for one
 * student; the spending cap itself belongs in Groq's Spend Limits.
 */
export function makeRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function allow(key: string): boolean {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

/**
 * A per-tab key a client may send so one student cannot spend a whole
 * classroom's budget. Client-chosen, so it only ever tightens: the per-IP
 * limit is the real backstop.
 */
export function sessionKey(request: Request, fromBody?: unknown): string | null {
  const v = typeof fromBody === "string" ? fromBody : request.headers.get("x-helper-session");
  return v && /^[\w-]{8,64}$/.test(v) ? v : null;
}

export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim();
}
