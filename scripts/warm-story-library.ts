/**
 * Writes story templates ahead of time into src/data/story-library.ts, so
 * students get stories without waiting on the AI, and the free tier's daily
 * quota is spent once per kind of problem instead of once per student.
 *
 *   npm run stories:warm -- --units working-with-units --topics 6 --rounds 25
 *
 *   --units a,b     units to cover, by id (default: the first unit)
 *   --skills a,b    or single skills
 *   --topics N      the N interests first in line below (default 6), or ids
 *   --rounds N      AI rounds to spend on this run (default 25). A round is
 *                   one writer call and one judge call, about 6,000 tokens,
 *                   so 25 rounds is under a third of a day's free quota and
 *                   live students keep the rest.
 *
 * Each round writes up to 5 templates, proves each on two sets of numbers and
 * has the judge check every filled version, exactly as live requests do. A
 * template that fails twice is skipped until the rules change. Safe to stop
 * at any time: the library is saved after every round.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  /* the key may already be in the environment */
}

const { units } = await import("@/data/curriculum");
const { generateProblemBank } = await import("@/data/skill-problem-generators");
const { STORY_LIBRARY } = await import("@/data/story-library");
const { INTEREST_OPTIONS } = await import("@/lib/interests");
const { canPersonalize, whyRejected } = await import("@/lib/personalize");
type PersonalizableProblem = import("@/lib/personalize").PersonalizableProblem;
const { templateKey, TEMPLATE_RULES } = await import("@/lib/story-templates");
const { extraSample, shapeOf, shapeSpans, writeTemplates } = await import("@/lib/story-pipeline");
type Shape = import("@/lib/story-pipeline").Shape;
type PipelineStats = import("@/lib/story-pipeline").PipelineStats;

/** Interests in the order they are covered. A guess until real picks are counted. */
const TOPIC_ORDER = [
  "video-games", "minecraft", "basketball", "music", "soccer", "creators",
  "roblox", "football", "anime", "animals", "cooking", "fashion",
  "art", "cars", "space", "dance", "coding", "business",
];

const LIBRARY_FILE = path.join(process.cwd(), "src/data/story-library.ts");
const SKIPS_FILE = path.join(process.cwd(), ".cache/story-warm-skips.json");
const PER_ROUND = 5;
const ROUND_SPACING_MS = 60_000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (!process.env.GROQ_API_KEY) {
  console.error("No GROQ_API_KEY in .env.local or the environment.");
  process.exit(1);
}

const allSkills = units.flatMap((u) => u.skills.map((s) => ({ ...s, unitId: u.id })));
const unitIds = arg("units")?.split(",");
const skillIds = arg("skills")?.split(",");
const skills = allSkills.filter((s) =>
  skillIds ? skillIds.includes(s.id) : (unitIds ?? [units[0].id]).includes(s.unitId)
);
const topicArg = arg("topics") ?? "6";
const topicIds = /^\d+$/.test(topicArg) ? TOPIC_ORDER.slice(0, Number(topicArg)) : topicArg.split(",");
const topics = topicIds.map((id) => {
  const o = INTEREST_OPTIONS.find((x) => x.id === id);
  if (!o) throw new Error(`Unknown interest "${id}"`);
  return { label: o.label, details: o.details };
});
const maxRounds = Number(arg("rounds") ?? 25);

const library: Record<string, { template: string; topic: string }[]> = structuredClone(STORY_LIBRARY);
let skips: Record<string, string> = {};
try {
  const saved = JSON.parse(await fs.readFile(SKIPS_FILE, "utf8"));
  if (saved.rules === TEMPLATE_RULES) skips = saved.skips ?? {};
} catch {
  /* first run */
}

// --- The work: every shape of every chosen skill, for every chosen interest --
interface Item {
  key: string;
  skillId: string;
  signature: string;
  problems: PersonalizableProblem[];
  topic: { label: string; details: string };
  attempts: number;
  previous?: string;
  rejectedBecause?: string;
}
const queue: Item[] = [];
for (const skill of skills) {
  const bySignature = new Map<string, PersonalizableProblem[]>();
  for (let seed = 1; seed <= 40; seed += 1) {
    for (const raw of generateProblemBank(skill.id, skill.problems, seed * 104729)) {
      const p = raw as PersonalizableProblem;
      if (!canPersonalize(p)) continue;
      const { signature } = shapeOf(p);
      bySignature.set(signature, [...(bySignature.get(signature) ?? []), p]);
    }
  }
  // Most common shapes first: they are most of what a student sees.
  const shapes = [...bySignature.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [signature, problems] of shapes) {
    for (const topic of topics) {
      const key = templateKey(signature, topic.label);
      if (library[key]?.length || skips[key]) continue;
      queue.push({ key, skillId: skill.id, signature, problems, topic, attempts: 0 });
    }
  }
}

console.log(`${skills.length} skills, ${topics.length} interests: ${queue.length} templates to write, ${maxRounds} rounds this run.`);

async function save() {
  const keys = Object.keys(library).sort();
  const header = (await fs.readFile(LIBRARY_FILE, "utf8")).split("export const STORY_LIBRARY")[0];
  const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(library[k])},`).join("\n");
  await fs.writeFile(
    LIBRARY_FILE,
    `${header}export const STORY_LIBRARY: Record<string, { template: string; topic: string }[]> = {\n${body}${body ? "\n" : ""}};\n`
  );
  await fs.mkdir(path.dirname(SKIPS_FILE), { recursive: true });
  await fs.writeFile(SKIPS_FILE, JSON.stringify({ rules: TEMPLATE_RULES, skips }, null, 1));
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
let written = 0;
let outages = 0;
for (let round = 1; round <= maxRounds && queue.length; round += 1) {
  const started = Date.now();
  const batch = queue.splice(0, PER_ROUND);
  const shapes: Shape[] = batch.map((item, n) => {
    const p = pick(item.problems);
    const seen = new Set([shapeOf(p).values.join("|")]);
    const other = item.problems.find((q) => !seen.has(shapeOf(q).values.join("|"))) ?? extraSample(item.skillId, item.signature, 1, seen);
    return {
      id: `w${n + 1}`,
      signature: item.signature,
      spans: shapeSpans(item.signature),
      problems: [p],
      samples: other ? [p, other] : [p],
      useOneOf: [item.topic.label],
      previous: item.previous,
      rejectedBecause: item.rejectedBecause,
    };
  });
  const roundTopics = [...new Map(batch.map((b) => [b.topic.label, b.topic])).values()];
  const stats: PipelineStats = { asked: batch.length, fromLibrary: 0, newTemplates: 0, kept: 0, rejected: {}, drafts: [], skipped: [] };
  const { accepted, failed } = await writeTemplates(shapes, roundTopics, 65_000, 1, stats);

  const retry: Item[] = [];
  let quotaOut = false;
  batch.forEach((item, n) => {
    const shape = shapes[n];
    const got = accepted.get(shape.id);
    if (got) {
      const key = templateKey(item.signature, got.topic.label);
      library[key] = [...(library[key] ?? []), { template: got.template, topic: got.topic.label }];
      written += 1;
      console.log(`  + [${got.topic.label}] ${got.template}`);
      return;
    }
    const f = failed.get(shape.id);
    if (!f || f.reason === "no-writer" || f.reason === "no-judge") {
      quotaOut = true;
      retry.push(item);
      return;
    }
    console.log(`  - [${item.topic.label}] ${f.reason}${f.detail ? `: ${f.detail}` : ""} :: ${f.draft.slice(0, 160)}`);
    if (item.attempts + 1 >= 2) skips[item.key] = `${f.reason}${f.detail ? `: ${f.detail}` : ""}`;
    else retry.push({ ...item, attempts: item.attempts + 1, previous: f.draft || undefined, rejectedBecause: whyRejected(f.reason, f.detail) });
  });
  queue.unshift(...retry);
  await save();
  console.log(`round ${round}: ${accepted.size}/${batch.length} kept (writer ${stats.writer ?? "-"}, judge ${stats.judge ?? "-"}), ${written} new in all, ${queue.length} to go`);
  for (const s of stats.skipped ?? []) console.log(`    skipped ${s}`);

  outages = quotaOut && !accepted.size ? outages + 1 : 0;
  if (outages >= 2) {
    console.log("Both models are out of quota for now. Run again later; nothing is lost.");
    break;
  }
  const rest = ROUND_SPACING_MS - (Date.now() - started);
  if (rest > 0 && round < maxRounds && queue.length) await new Promise((r) => setTimeout(r, rest));
}
console.log(`Done: ${written} templates added. The library has ${Object.values(library).reduce((n, v) => n + v.length, 0)}.`);
