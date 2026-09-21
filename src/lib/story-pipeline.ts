/**
 * Turns a student's practice problems into stories about their interests,
 * using the template library first and the AI only for shapes it has never
 * seen. Server only.
 *
 * For each problem:
 *   1. Its shape ("Solve for x: {1}x + {2} = {3}") and the student's
 *      interests are looked up in the library. A stored template is filled
 *      with the problem's numbers and re-checked like any story. No AI call.
 *   2. Problems the library cannot cover without repeating a story the
 *      student already saw get a new template from the AI, filled with the
 *      numbers of two different problems of that shape and both versions
 *      checked in code and by the judge. A template is kept only if every
 *      filled version passes, because it will be reused with numbers nobody
 *      has seen yet. One that failed goes back to the writer once, with
 *      exactly why (skipped on a visit's first request, where a student is
 *      waiting).
 *
 * A student never sees the same story twice in a session: a repeat with new
 * numbers reads as a template, which is worse than the plain problem.
 *
 * Writing and judging use different models where quota allows, each with its
 * own free allowance.
 */

import { units } from "@/data/curriculum";
import { generateProblemBank } from "@/data/skill-problem-generators";
import { callJson } from "@/lib/ai-provider";
import type { InterestTopic } from "@/lib/interests";
import {
  BATCH_SIZE,
  canPersonalize,
  checkRewrite,
  isStepProblem,
  judgeVerdict,
  mathSpans,
  parseModelJson,
  SOLVER_SYSTEM,
  solverUserMessage,
  stripVariantTag,
  whyRejected,
  type PersonalizableProblem,
} from "@/lib/personalize";
import {
  checkTemplate,
  fillTemplate,
  readsWrongAtOne,
  signatureOf,
  templateId,
  templateKey,
  TEMPLATE_WRITER_SYSTEM,
  templateWriterMessage,
} from "@/lib/story-templates";
import { getTemplates, saveTemplate, type StoredTemplate } from "@/lib/story-store";

/**
 * The biggest model writes best, and qwen takes over when it is out of quota.
 * gpt-oss-20b is left out: its templates were muddled ("your latest vlog is 3
 * miles long") and would only spend the judge's quota being rejected.
 */
const WRITER_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"];
/**
 * The judge. On stories from real runs, qwen caught 7 of 7 (a basketball
 * score of "-3x + 20 points", a step problem asking the wrong question, a
 * flat unit conversion) while gpt-oss-20b passed 3 of those 4 bad ones, so
 * 20b never approves a template: when neither judge is free, nothing new is
 * kept. Every student who likes that interest would see a bad template.
 */
const JUDGE_MODELS = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"];
const QWEN = "qwen/qwen3.8-27b";
/** qwen's free output cap is 1,000 tokens a minute, and it refuses any request that could pass it. */
const QWEN_MAX_TOKENS = 950;

/** A second round only starts while there is clearly time left for it. */
const REPAIR_DEADLINE_MS = 30_000;

export interface Written {
  id: string;
  prompt: string;
  topic: string;
  /** The template it came from, so a session can avoid showing it twice. */
  templateId: string;
}

export interface PipelineStats {
  asked: number;
  /** Served straight from the template library, no AI call. */
  fromLibrary: number;
  /** New templates written and approved on this request. */
  newTemplates: number;
  kept: number;
  rejected: Record<string, number>;
  writer?: string;
  judge?: string;
  /** Development only: every draft and what happened to it. */
  drafts?: { round: number; signature: string; text: unknown; outcome: string }[];
  /** Development only: why a model was passed over. */
  skipped?: string[];
}

const skills = new Map(units.flatMap((u) => u.skills).map((s) => [s.id, s]));

export interface Shape {
  id: string;
  signature: string;
  /** The requested problems this template is for. */
  problems: PersonalizableProblem[];
  /** Problems the template is proven on: the requested ones plus one more. */
  samples: PersonalizableProblem[];
  useOneOf?: string[];
  alreadyUsed?: string[];
  /** Equations and points that must appear word for word. */
  spans: string[];
  previous?: string;
  rejectedBecause?: string;
}

export function shapeOf(p: PersonalizableProblem) {
  return signatureOf(stripVariantTag(p.prompt));
}

/**
 * The equations and points of a shape, placeholders included: "{1}x − {2} =
 * {3}". Found by putting stand-in numbers where the placeholders are, since
 * the shape has no other digits, and reading the math the usual way.
 */
export function shapeSpans(signature: string): string[] {
  const stand = (k: number) => String(90000 + k);
  const filled = signature.replace(/\{(\d+)\}/g, (_, k) => stand(Number(k)));
  const math = mathSpans(filled).map((span) => span.replace(/9\d{4}/g, (n) => `{${Number(n) - 90000}}`));
  // A conversion chain ("{1} km → {2} m → {3} cm") is what an error-analysis
  // problem is about, and the writer kept leaving it out of the story.
  const chains = [...signature.matchAll(/\{\d+\}\s*[A-Za-z]+(?:\s*→\s*\{\d+\}\s*[A-Za-z]+)+/g)].map((m) => m[0]);
  return [...math, ...chains.filter((c) => !math.some((s) => s.includes(c)))];
}

/** A template filled with a problem's numbers, or null if any check fails. */
function fill(p: PersonalizableProblem, template: string): { text: string } | { reason: string; detail?: string } {
  const text = fillTemplate(template, shapeOf(p).values);
  const atOne = readsWrongAtOne(text, stripVariantTag(p.prompt));
  if (atOne) {
    return { reason: "template", detail: `it reads "${atOne}" when a number is 1; write it so it works for any number, like "a {2}-hour drive"` };
  }
  const checked = checkRewrite(p, text);
  return checked.ok ? { text: checked.text } : { reason: checked.reason, detail: checked.detail };
}

/**
 * Another problem of the same shape with different numbers, from other banks
 * of the same skill, so a template is proven on more than one set of numbers
 * before it is reused on any.
 */
export function extraSample(skillId: string, signature: string, seed: number, seen: Set<string>): PersonalizableProblem | null {
  const skill = skills.get(skillId);
  if (!skill) return null;
  for (let k = 1; k <= 8; k += 1) {
    for (const raw of generateProblemBank(skillId, skill.problems, (seed + k * 7919) >>> 0)) {
      const p = raw as PersonalizableProblem;
      if (!canPersonalize(p)) continue;
      const s = shapeOf(p);
      if (s.signature === signature && !seen.has(s.values.join("|"))) return p;
    }
  }
  return null;
}

function shuffled<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Writes templates for some shapes and keeps the ones every sample passes with. */
export async function writeTemplates(
  shapes: Shape[],
  topics: InterestTopic[],
  retryWithinMs: number,
  round: number,
  stats: PipelineStats
): Promise<{
  accepted: Map<string, { template: string; topic: InterestTopic }>;
  failed: Map<string, { draft: string; reason: string; detail?: string }>;
}> {
  const accepted = new Map<string, { template: string; topic: InterestTopic }>();
  const failed = new Map<string, { draft: string; reason: string; detail?: string }>();
  const fail = (shape: Shape, draft: unknown, reason: string, detail?: string) => {
    stats.rejected[reason] = (stats.rejected[reason] ?? 0) + 1;
    failed.set(shape.id, { draft: typeof draft === "string" ? draft : "", reason, detail });
    stats.drafts?.push({ round, signature: shape.signature, text: draft, outcome: detail ? `${reason}: ${detail}` : reason });
  };
  const onSkip = stats.skipped ? (model: string, why: string) => stats.skipped!.push(`r${round} ${model}: ${why}`) : undefined;

  const written = await callJson({
    system: TEMPLATE_WRITER_SYSTEM,
    user: templateWriterMessage(
      shapes.map((s) => {
        const rep = s.problems[0];
        return {
          id: s.id,
          signature: s.signature,
          type: rep.type,
          choices: rep.type === "multiple-choice" ? rep.choices : undefined,
          steps: isStepProblem(rep) ? rep.steps : undefined,
          useOneOf: s.useOneOf,
          alreadyUsed: s.alreadyUsed,
          mustInclude: s.spans,
          previous: s.previous,
          rejectedBecause: s.rejectedBecause,
        };
      }),
      topics
    ),
    groqModels: WRITER_MODELS,
    // The free tier counts the ceiling against its per-minute budget up front,
    // so it grows with the batch instead of reserving the minute. gpt-oss
    // spends much of it reasoning; qwen writes straight out.
    maxTokens: 700 + 450 * shapes.length,
    modelMaxTokens: { [QWEN]: Math.min(QWEN_MAX_TOKENS, 200 + 130 * shapes.length) },
    temperature: 0.8,
    timeoutMs: 20_000,
    // Low effort wrote flat, generic scenes; medium is what produced stakes.
    reasoningEffort: "medium",
    retryWithinMs,
    onSkip,
  });
  if (!written) {
    shapes.forEach((s) => fail(s, "", "no-writer"));
    return { accepted, failed };
  }
  stats.writer = written.provider;

  const byLabel = new Map(topics.map((t) => [t.label.toLowerCase(), t]));
  const drafts = new Map<string, { template: unknown; topic?: InterestTopic }>();
  const list = parseModelJson(written.text)?.items;
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const { id, template, text, topic } = entry as { id?: unknown; template?: unknown; text?: unknown; topic?: unknown };
      if (typeof id !== "string") continue;
      drafts.set(id, {
        template: template ?? text,
        topic: typeof topic === "string" ? byLabel.get(topic.trim().toLowerCase()) : undefined,
      });
    }
  }

  if (!drafts.size) stats.skipped?.push(`r${round} writer reply unreadable (${written.provider}): ${written.text.slice(0, 400)}`);

  // Code checks, on the template and then on every filled-in version.
  type Candidate = { key: string; shape: Shape; sample: PersonalizableProblem; text: string };
  const candidates: Candidate[] = [];
  const ready = new Map<string, { template: string; topic: InterestTopic }>();
  for (const shape of shapes) {
    const draft = drafts.get(shape.id);
    if (!draft) {
      fail(shape, "", "missing");
      continue;
    }
    const structural = checkTemplate(shape.signature, draft.template, shape.spans);
    if (!structural.ok) {
      fail(shape, draft.template, structural.reason, structural.detail);
      continue;
    }
    let broken: { reason: string; detail?: string } | null = null;
    const filled: Candidate[] = [];
    for (const [k, sample] of shape.samples.entries()) {
      const result = fill(sample, structural.template);
      if ("reason" in result) {
        broken = result;
        break;
      }
      filled.push({ key: `${shape.id}#${k}`, shape, sample, text: result.text });
    }
    if (broken) {
      fail(shape, structural.template, broken.reason, broken.detail);
      continue;
    }
    candidates.push(...filled);
    ready.set(shape.id, { template: structural.template, topic: draft.topic ?? topics[0] });
  }
  if (!candidates.length) return { accepted, failed };

  // The judge, on every filled-in version.
  const judged = await callJson({
    system: SOLVER_SYSTEM,
    user: solverUserMessage(
      candidates.map((c) => ({
        id: c.key,
        text: c.text,
        choices: c.sample.type === "multiple-choice" ? c.sample.choices : undefined,
        steps: isStepProblem(c.sample) ? c.sample.steps : undefined,
        type: c.sample.type,
      }))
    ),
    groqModels: JUDGE_MODELS,
    maxTokens: 500 + 250 * candidates.length,
    // qwen used 442 tokens on 7 stories.
    modelMaxTokens: { [QWEN]: Math.min(QWEN_MAX_TOKENS, 150 + 75 * candidates.length) },
    temperature: 0,
    timeoutMs: 15_000,
    reasoningEffort: "medium",
    retryWithinMs,
    onSkip,
  });
  if (!judged) {
    for (const shape of new Set(candidates.map((c) => c.shape))) fail(shape, ready.get(shape.id)?.template, "no-judge");
    return { accepted, failed };
  }
  stats.judge = judged.provider;

  type Entry = { answer?: unknown; fits?: unknown; gives_away?: unknown; engaging?: unknown; why?: unknown };
  const verdicts = new Map<string, Entry>();
  const got = parseModelJson(judged.text)?.answers;
  if (Array.isArray(got)) {
    for (const entry of got) {
      if (entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string") {
        verdicts.set((entry as { id: string }).id, entry as Entry);
      }
    }
  }

  if (!verdicts.size) stats.skipped?.push(`r${round} judge reply unreadable (${judged.provider}): ${judged.text.slice(0, 400)}`);

  // A template is kept only if every filled version is.
  for (const [shapeId, draft] of ready) {
    const mine = candidates.filter((c) => c.shape.id === shapeId);
    let failure: { reason: string; detail?: string } | null = null;
    for (const c of mine) {
      const entry = verdicts.get(c.key);
      const verdict = judgeVerdict(c.sample, entry);
      if (verdict !== "keep") {
        const why = typeof entry?.why === "string" && entry.why ? entry.why.slice(0, 120) : undefined;
        // For development: what the judge got, next to the key.
        const got = verdict === "verifier" ? (entry ? `judge said ${String(entry.answer)}, key ${String(c.sample.answer)}` : "no verdict") : undefined;
        failure = { reason: verdict, detail: why ?? got };
        break;
      }
    }
    if (failure) {
      fail(mine[0].shape, draft.template, failure.reason, failure.detail);
      continue;
    }
    accepted.set(shapeId, draft);
    stats.drafts?.push({ round, signature: mine[0].shape.signature, text: draft.template, outcome: `keep (${draft.topic.label})` });
  }
  return { accepted, failed };
}

export async function personalizeProblems(opts: {
  skillId: string;
  seed: number;
  ids: string[];
  topics: InterestTopic[];
  /** The first request of a visit: a student is waiting, so no second round. */
  firstBatch: boolean;
  /** Templates this student has already seen this session, oldest first. */
  seen?: string[];
}): Promise<{ problems: Written[]; stats: PipelineStats }> {
  const started = Date.now();
  const stats: PipelineStats = { asked: 0, fromLibrary: 0, newTemplates: 0, kept: 0, rejected: {} };
  if (process.env.NODE_ENV === "development") {
    stats.drafts = [];
    stats.skipped = [];
  }

  const skill = skills.get(opts.skillId);
  const topics = opts.topics;
  if (!skill || !topics.length) return { problems: [], stats };

  const bank = new Map(generateProblemBank(opts.skillId, skill.problems, opts.seed).map((p) => [p.id, p]));
  const items = opts.ids
    .map((id) => bank.get(id) as PersonalizableProblem | undefined)
    .filter((p): p is PersonalizableProblem => !!p && canPersonalize(p))
    .slice(0, BATCH_SIZE);
  stats.asked = items.length;
  if (!items.length) return { problems: [], stats };

  const seenOrder = opts.seen ?? [];
  const seen = new Set(seenOrder);
  const usedNow = new Set<string>();
  const kept = new Map<string, Written>();
  const use = (p: PersonalizableProblem, template: string, topic: string): boolean => {
    const result = fill(p, template);
    if ("reason" in result) return false;
    const id = templateId(template);
    kept.set(p.id, { id: p.id, prompt: result.text, topic, templateId: id });
    usedNow.add(id);
    return true;
  };

  // --- 1. The library ------------------------------------------------------
  // Stored templates are re-checked against today's rules, so tightening a
  // rule in code also retires every stored template that breaks it.
  const keys = [...new Set(items.flatMap((p) => topics.map((t) => templateKey(shapeOf(p).signature, t.label))))];
  const library = await getTemplates(keys);
  const storedFor = (signature: string, topic: InterestTopic): StoredTemplate[] =>
    (library.get(templateKey(signature, topic.label)) ?? []).filter(
      (t) => checkTemplate(signature, t.template, shapeSpans(signature)).ok
    );

  // A problem's stored stories across the student's interests, starting from
  // a different interest per problem so a session is not all one world.
  const optionsFor = (p: PersonalizableProblem, i: number): StoredTemplate[] => {
    const signature = shapeOf(p).signature;
    const start = seen.size + i;
    return topics.flatMap((_, k) => shuffled(storedFor(signature, topics[(start + k) % topics.length])));
  };
  items.forEach((p, i) => {
    for (const t of optionsFor(p, i)) {
      const id = templateId(t.template);
      if (seen.has(id) || usedNow.has(id)) continue;
      if (use(p, t.template, t.topic)) break;
    }
  });
  stats.fromLibrary = kept.size;

  // --- 2. Write what the library cannot cover without repeating ------------
  // One template per remaining problem. Each is steered to an interest that
  // shape has no story for yet, and away from the stories already used.
  const misses = items.filter((p) => !kept.has(p.id));
  let shapes: Shape[] = misses.map((p, n) => {
    const signature = shapeOf(p).signature;
    const stored = topics.map((t) => ({ t, list: storedFor(signature, t) }));
    const lacking = stored.filter((x) => !x.list.length).map((x) => x.t.label);
    const extra = extraSample(opts.skillId, signature, opts.seed, new Set([shapeOf(p).values.join("|")]));
    return {
      id: `s${n + 1}`,
      signature,
      spans: shapeSpans(signature),
      problems: [p],
      samples: extra ? [p, extra] : [p],
      useOneOf: lacking.length && lacking.length < topics.length ? [...lacking.slice(n % lacking.length), ...lacking.slice(0, n % lacking.length)] : undefined,
      alreadyUsed: stored.flatMap((x) => x.list.map((t) => t.template)).slice(0, 3),
    };
  });

  // Later batches are fetched ahead of the student, so they can wait out a
  // per-minute limit; the route allows 60 seconds.
  const retryWithinMs = opts.firstBatch ? 3_000 : 40_000;
  for (let round = 1; round <= 2 && shapes.length; round += 1) {
    if (round === 2 && (opts.firstBatch || Date.now() - started > REPAIR_DEADLINE_MS)) break;
    const { accepted, failed } = await writeTemplates(shapes, topics, retryWithinMs, round, stats);
    for (const shape of shapes) {
      const got = accepted.get(shape.id);
      if (!got) continue;
      await saveTemplate(templateKey(shape.signature, got.topic.label), shape.signature, {
        template: got.template,
        topic: got.topic.label,
      });
      stats.newTemplates += 1;
      for (const p of shape.problems) use(p, got.template, got.topic.label);
    }
    // Second round: only what the writer could fix. Not rate limits.
    shapes = shapes
      .filter((s) => !accepted.has(s.id))
      .map((s) => ({ s, f: failed.get(s.id) }))
      .filter(({ f }) => f && f.reason !== "no-writer" && f.reason !== "no-judge" && f.reason !== "missing")
      .map(({ s, f }) => ({ ...s, previous: f!.draft, rejectedBecause: whyRejected(f!.reason, f!.detail) }));
  }

  const problems = items.map((p) => kept.get(p.id)).filter((w): w is Written => !!w);
  stats.kept = problems.length;
  return { problems, stats };
}
