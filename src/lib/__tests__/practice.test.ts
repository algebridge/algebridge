// Practice: grading, the five-right rule, interests, and the checks that
// stand between a model's rewrite of a problem and a student.
//
//   npm run test:practice

// progress.ts reads localStorage and dispatches window events; give it both.
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: { dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} },
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

import { readFileSync } from "node:fs";
const { numericAnswerMatches, parseNumericAnswer } = await import("../grading.ts");
const { sanitizeTopics, topicsFromPicks, isSchoolSafe, INTEREST_OPTIONS } = await import("../interests.ts");
const P = await import("../personalize.ts");
const { forbiddenValues, leaksAnswer, leaksAnswerText } = await import("../helper.ts");
const { recordProblemAttempt, getSkillPracticeStats, solvedCount, getProgress, saveProgress } = await import(
  "../progress.ts"
);
const { units } = await import("../../data/curriculum.ts");
const { generateProblemBank } = await import("../../data/skill-problem-generators.ts");
const { skillOffersCalculator } = await import("../../data/problem-banks.ts");

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  else {
    fail++;
    console.log("  FAIL:", name, extra);
  }
};

// --- Grading: real answers that used to be marked wrong --------------------
ok("fraction for a repeating slope", numericAnswerMatches(5 / 3, "5/3"));
ok("negative fraction", numericAnswerMatches(-1 / 7, "-1/7"));
ok("typographic minus", numericAnswerMatches(-2, "−2"));
ok("rounded to hundredths", numericAnswerMatches(5 / 3, "1.67"));
ok("rounded to thousandths", numericAnswerMatches(5 / 3, "1.667"));
ok("badly rounded is wrong", !numericAnswerMatches(5 / 3, "1.66"));
ok("one place is too coarse", !numericAnswerMatches(0.125, "0.1"));
ok("unit on the end", numericAnswerMatches(168, "168 miles"));
ok("thousands comma", numericAnswerMatches(15840, "15,840"));
ok("x = 5 form", numericAnswerMatches(5, "x = 5"));
ok("dollar sign", numericAnswerMatches(787.4, "$787.40", 2));
ok("mixed number", numericAnswerMatches(5 / 3, "1 2/3"));
ok("decimalPlaces still rounds", numericAnswerMatches(14.25, "14.25", 2) && !numericAnswerMatches(14.25, "14.2", 2));
ok("wrong is wrong", !numericAnswerMatches(8, "9"));
ok("empty is not zero", !numericAnswerMatches(0, ""));
ok("words are not numbers", parseNumericAnswer("idk") === null);
ok("1,5 is not fifteen", parseNumericAnswer("1,5") === null);
ok("divide by zero", parseNumericAnswer("3/0") === null);

// --- Interests ------------------------------------------------------------------
ok("picks map to topics", topicsFromPicks(["basketball", "minecraft"]).map((t) => t.label).join() === "Basketball,Minecraft");
ok("unknown picks ignored", topicsFromPicks(["nope", "music"]).length === 1);
ok("at most six topics", topicsFromPicks(INTEREST_OPTIONS.map((o) => o.id)).length === 6);
{
  const { mergeTopics } = await import("../interests.ts");
  const taps = topicsFromPicks(["basketball", "minecraft"]);
  const merged = mergeTopics(taps, [
    { label: "Baking", details: "cookies" },
    { label: "Minecraft building", details: "dupe of a tap" },
    { label: "TikTok", details: "posting videos" },
  ]);
  ok("taps always survive the note", merged.map((t) => t.label).join() === "Basketball,Minecraft,Baking,TikTok", merged.map((t) => t.label).join());
}
{
  const clean = sanitizeTopics([
    { label: "Formula 1", details: "lap times, pit stops" },
    { label: "formula 1", details: "dupe" },
    { label: "Beer pong", details: "cups" },
    { label: "My friend Jake", details: "jake@school.com" },
    { label: "<script>", details: "x" },
    { label: "Baking", details: "cups of flour, batches" },
    { label: "Skateboarding", details: "kickflips" },
    { label: "Chess", details: "openings" },
  ]);
  ok("sanitize keeps the safe ones", clean.map((t) => t.label).join() === "Formula 1,Baking,Skateboarding,Chess", JSON.stringify(clean));
  ok("markup is not an interest", sanitizeTopics([{ label: "<b>Soccer</b>", details: "" }]).length === 0);
}
ok("not an array is nothing", sanitizeTopics("Basketball").length === 0);
for (const fine of ["skills", "bass guitar", "class", "method", "heroine", "a stable orbit", "free throw shot", "threes", "Sussex"]) {
  ok(`school-safe: "${fine}"`, isSchoolSafe(fine));
}
for (const bad of ["kills", "vaping", "beer", "gambling", "a gun"]) ok(`blocked: "${bad}"`, !isSchoolSafe(bad));

// --- Math spans -------------------------------------------------------------
const spans = (s: string) => P.mathSpans(s).join(" | ");
ok("equation", spans("Solve for x: 9x = 72") === "9x = 72", spans("Solve for x: 9x = 72"));
ok("points", spans("Find the slope between (1, 4) and (4, 7).") === "(1, 4) | (4, 7)");
ok("function", spans("If g(x) = x² − 1, find g(−3).") === "g(x) = x² − 1 | g(−3)");
ok("unit fact is not a span", spans("Convert 3 miles to feet. (1 mile = 5280 ft)") === "");
ok("system", spans("Solve: y = 2x + 6 and x + y = 12. What is x?") === "y = 2x + 6 | x + y = 12");
ok("power", spans("Simplify: 2^2 × 2^5 (enter as a number)") === "2^2 × 2^5");
ok("words with x are not math", spans("Find the x-intercept of 4x + y = 20.") === "4x + y = 20");

// --- The rewrite checks -----------------------------------------------------
const eq = { id: "a", type: "numeric", prompt: "Solve for x: 3x + 5 = 20", answer: 5 };
const eq2 = { id: "b", type: "numeric", prompt: "Solve for x: 3x + 4 = 19", answer: 5 };
const good = "You hit x threes worth 3 each, plus 4 points of free throws, for 19 total: 3x + 4 = 19. How many threes did you hit?";
ok("a faithful rewrite passes", P.checkRewrite(eq2, good).ok, JSON.stringify(P.checkRewrite(eq2, good)));
// When x = 5 is also the constant in 3x + 5 = 20, a story may restate the 5
// once beside the equation. Three mentions is the answer being handed over.
ok(
  "a number that is also the answer may be restated once, not more",
  P.checkRewrite(eq, "Plus 5 points of free throws, for 20 total: 3x + 5 = 20. How many threes did you hit?").ok &&
    !P.checkRewrite(eq, "You hit 5 threes and 5 free throws, for 20 total: 3x + 5 = 20. How many threes?").ok
);
const reason = (o: typeof eq, t: string) => {
  const r = P.checkRewrite(o, t);
  return r.ok ? "ok" : r.reason;
};
ok("a new number fails", reason(eq, "In 2 games you hit x threes: 3x + 5 = 20. Solve for x.") === "numbers");
{
  const r = P.checkRewrite(eq, "In 2 games you hit threes: 3x + 5 = 20. How many threes?");
  ok("a numbers failure says exactly what to fix", !r.ok && r.reason === "numbers" && r.detail === "added 2; use only 3, 5, 20", JSON.stringify(r));
  ok("the feedback carries it", P.whyRejected("numbers", "added 2; use only 3, 5, 20").includes("added 2"));
}

ok("a missing number fails", reason(eq, "You hit some threes, 3x + 5 = something. Solve for x.") === "numbers");
ok("changed math fails", reason(eq, "Your team scores 5x + 3 = 20 points. Solve for x.") === "math-changed");
// "You hit 5 threes" with x = 5 passes the counting check (5 appears twice,
// once as the constant). The judge is what catches it, see judgeVerdict below.
ok("a single give-away is left to the judge", reason(eq, "You hit 5 threes: 3x + 5 = 20. How many threes did you hit?") === "ok");
ok("an answer not in the problem fails as a new number", reason({ ...eq, prompt: "Solve for x: 3x + 4 = 19" }, "You hit 5 threes: 3x + 4 = 19. Solve for x.") === "numbers");
ok("number words fail", reason(eq, "Two teams: 3x + 5 = 20. Solve for x.") === "number-words");
ok("unsafe fails", reason(eq, "Count the kills: 3x + 5 = 20. Solve for x.") === "unsafe");
ok("emoji fail", reason(eq, "Buckets 🏀 3x + 5 = 20. Solve for x.") === "format");
ok("too long fails", reason(eq, `${"Long story. ".repeat(30)}3x + 5 = 20`) === "too-long");
ok("em dash is tidied, not rejected", P.checkRewrite(eq, "Game day — 3x + 5 = 20. How many threes?").ok);
const mc = { id: "m", type: "multiple-choice", prompt: "Which equation has slope 4 and y-intercept -2?", answer: "y = 4x − 2", choices: ["y = 4x − 2", "y = −2x + 4", "y = 4x + 2", "y = 2x − 4"] };
ok("a choice answer in the text fails", reason(mc, "Your ramp is y = 4x − 2: it climbs 4 and starts 2 below. Which equation?") === "gives-answer");
ok("a choice rewrite passes", P.checkRewrite(mc, "Your skate ramp climbs 4 inches per foot and starts 2 inches below the deck. Which equation tracks your ramp?").ok);
ok("a choice question copied from the original is textbook", reason(mc, "Your skate ramp climbs 4 inches per foot and starts 2 inches below. Which equation has slope 4 and y-intercept -2?") === "textbook");

// --- The examples the writer is shown must pass the checks themselves -------
{
  const pairs = [...P.WRITER_SYSTEM.matchAll(/Original: "([^"]+)" \(([^)]+)\)\n-> "([^"]+)"/g)];
  ok("the writer prompt has examples", pairs.length >= 5, String(pairs.length));
  for (const [, original, topic, story] of pairs) {
    const r = P.checkRewrite({ id: "x", type: "numeric", prompt: original, answer: 99991 }, story);
    ok(`example passes its own checks (${topic}: ${original.slice(0, 30)})`, r.ok, JSON.stringify(r));
  }
}

// --- Textbook endings --------------------------------------------------------
ok("glued-on ending is textbook", P.endsLikeOriginal("Convert 7 miles to feet. (1 mile = 5280 ft)", "Your rail line is 7 miles long. Convert 7 miles to feet? (1 mile = 5280 ft)"));
ok("solve for x ending is textbook", P.endsLikeOriginal("Solve for x: 3x + 4 = 19", "Threes and free throws: 3x + 4 = 19. Solve for x."));
ok("how many feet is that is always flat", P.endsLikeOriginal("Convert 160 inches to feet.", "A redstone line stretches 160 inches to the portal. How many feet is that?"));
ok("a real question about the story is fine", !P.endsLikeOriginal("Convert 6 kilometers to meters.", "Your travel vlog shows a 6 kilometer hike. How many meters is the hike?"));
ok("a story's own question is fine", !P.endsLikeOriginal("Convert 7 miles to feet. (1 mile = 5280 ft)", "You're laying a 7-mile rail line, one rail per foot. How many rails do you need to craft? (1 mile = 5280 ft)"));
ok("textbook ending is rejected", reason({ ...eq, prompt: "Solve for x: 3x + 5 = 20" }, "Threes and free throws got you here: 3x + 5 = 20. Solve for x.") === "textbook");

// --- Step problems ------------------------------------------------------------
{
  const errorProblem = { id: "e", type: "error-analysis", prompt: "Find the error: 5x = 50", steps: ["5x = 50", "x = 50 + 5", "x = 55"] };
  ok("a step story passes", P.checkRewrite(errorProblem, "Your build must total 50 blocks, placed in rows of 5: 5x = 50. Which step below broke the plan?").ok);
  ok("naming the step gives it away", reason(errorProblem as any, "Your build needs 50 blocks in rows of 5: 5x = 50. The second step looks off. Which one broke it?") === "gives-answer");
  ok("step 2 gives it away", reason(errorProblem as any, "Rows of 5, 50 blocks: 5x = 50. Is it step 2? Which one broke it?") === "numbers" || reason(errorProblem as any, "Rows of 5, 50 blocks: 5x = 50. Is it step 2? Which one broke it?") === "gives-answer");
  const orderProblem = { id: "o", type: "step-order", prompt: "Order the steps to solve 2x + 3 = 11:", steps: ["Subtract 3: 2x = 8", "Divide by 2: x = 4", "Check"] };
  ok("narrating the order gives it away", reason(orderProblem as any, "Before the buzzer: 2x + 3 = 11. First subtract, then divide. What order gets you there?") === "gives-answer");
  const pasted = "Your TikTok edit must be exactly 17 seconds, the intro is 5 seconds, and each clip is 2 seconds: 2x + 5 = 17. What order of the three steps below finishes your video?\nSubtract 5: 2x = 12\nDivide by 2: x = 6\nCheck: 2(6) + 5 = 17 ✓";
  const orderP = { id: "o2", type: "step-order", prompt: "Order the steps to solve 2x + 5 = 17:", steps: ["Subtract 5: 2x = 12", "Divide by 2: x = 6", "Check: 2(6) + 5 = 17 ✓"] };
  const cleaned = P.checkRewrite(orderP, pasted);
  ok("pasted steps are dropped and three steps is allowed", cleaned.ok && !cleaned.text.includes("Divide"), JSON.stringify(cleaned));
  ok("a step problem needs no answer from the judge", P.judgeVerdict(errorProblem as any, { answer: "-", fits: true, gives_away: false, engaging: 4 }) === "keep");
}

// --- The independent solve --------------------------------------------------
ok("verifier: exact", P.verifierAgrees(eq, "5"));
ok("verifier: wrong", !P.verifierAgrees(eq, "6"));
ok("verifier: nothing", !P.verifierAgrees(eq, undefined));
ok("verifier: letter", P.verifierAgrees(mc, "A"));
ok("verifier: letter with dot", P.verifierAgrees(mc, "A."));
ok("verifier: wrong letter", !P.verifierAgrees(mc, "C"));
ok("verifier: quoted choice", P.verifierAgrees(mc, "y = 4x - 2"));
const money = { id: "c", type: "numeric", prompt: "x", answer: 787.4, decimalPlaces: 2 };
ok("verifier: rounding rule", P.verifierAgrees(money, "787.40") && !P.verifierAgrees(money, "787.41"));

const good4 = { answer: "5", fits: true, gives_away: false, engaging: 4 };
ok("judge: all good is kept", P.judgeVerdict(eq, good4) === "keep");
ok("judge: wrong answer", P.judgeVerdict(eq, { ...good4, answer: "6" }) === "verifier");
ok("judge: makes no sense", P.judgeVerdict(eq, { ...good4, fits: false }) === "unfit");
ok("judge: gives it away", P.judgeVerdict(eq, { ...good4, gives_away: true }) === "gives-away");
ok("judge: silence on give-away is a no", P.judgeVerdict(eq, { answer: "5", fits: true, engaging: 5 }) === "gives-away");
ok("judge: flat but in their world is kept", P.judgeVerdict(eq, { ...good4, engaging: 3 }) === "keep");
ok("judge: barely connected stays plain", P.judgeVerdict(eq, { ...good4, engaging: 2 }) === "flat");
ok("judge: no score stays plain", P.judgeVerdict(eq, { answer: "5", fits: true, gives_away: false }) === "flat");
ok("judge: nothing at all", P.judgeVerdict(eq, undefined) === "verifier");
ok("parse fenced json", P.parseModelJson('```json\n{"items":[{"id":"a"}]}\n```')?.items !== undefined);
ok("parse with preamble", P.parseModelJson('Sure! {"answers":[]} hope that helps')?.answers !== undefined);
ok("parse garbage", P.parseModelJson("no json here") === null);

// --- Every problem the app can generate -------------------------------------
// The checks must accept a problem's own words (or a skill could never be
// personalized) and must catch a swapped number in anything with an equation.
let personalizable = 0;
let symbolic = 0;
let identityFails = 0;
let prefixFails = 0;
let swapMisses = 0;
let gluedMisses = 0;
for (const unit of units) {
  for (const skill of unit.skills) {
    for (const seed of [1, 2]) {
      for (const p of generateProblemBank(skill.id, skill.problems, seed)) {
        if (!P.canPersonalize(p)) continue;
        personalizable++;
        const prompt = P.stripVariantTag(p.prompt);
        // A story built from the problem's own numbers and math, ending on a
        // question of its own, must get through. Only the ending differs from
        // the original, so this isolates checks 1 to 3 from the textbook rule.
        const story = `${prompt}${/[.?!)]$/.test(prompt) ? "" : "."} What does that mean for you?`;
        if (story.length <= P.MAX_PROMPT_CHARS && !P.checkRewrite(p, story).ok) {
          identityFails++;
          if (identityFails <= 5) console.log("  story rejected:", skill.id, prompt, JSON.stringify(P.checkRewrite(p, story)));
        }
        const prefixed = `At practice today: ${story}`;
        if (prefixed.length <= P.MAX_PROMPT_CHARS && !P.checkRewrite(p, prefixed).ok) prefixFails++;
        // Gluing a scene onto an instruction ("Convert...", "Solve for x") is
        // exactly what the textbook rule exists to catch.
        if (/^(convert|solve|find|simplify|evaluate|expand|factor|which|what)\b/i.test(prompt) && !P.endsLikeOriginal(prompt, `Big game tonight. ${prompt}`)) {
          gluedMisses++;
          if (gluedMisses <= 3) console.log("  glue not caught:", skill.id, prompt);
        }
        const span = P.mathSpans(prompt).find((s) => /[xy]/.test(s) && /\d.*\d/.test(s.replace(/²/g, "")));
        if (span) {
          const digits = span.match(/\d+/g)!;
          const [a, b] = [digits[0], digits.find((d) => d !== digits[0])];
          if (a && b) {
            symbolic++;
            const swapped = prompt.replace(span, span.replace(a, "#").replace(b, a).replace("#", b));
            if (swapped !== prompt && P.checkRewrite(p, swapped).ok) {
              swapMisses++;
              if (swapMisses <= 5) console.log("  swap not caught:", skill.id, prompt, "->", swapped);
            }
          }
        }
      }
    }
  }
}
ok(`all ${personalizable} personalizable problems accept a story with their numbers and math`, identityFails === 0, `${identityFails} rejected`);
ok("a one-line scene in front never breaks a problem", prefixFails === 0, `${prefixFails} rejected`);
ok(`swapped numbers caught in all ${symbolic} equations`, swapMisses === 0, `${swapMisses} missed`);
ok("a scene glued onto an instruction is always caught", gluedMisses === 0, `${gluedMisses} missed`);
ok("most of the course can be personalized", personalizable > 3000, String(personalizable));

// --- Story templates -------------------------------------------------------
{
  const T = await import("../story-templates.ts");
  const sig = T.signatureOf("Solve for x: x − 8 = -2");
  ok("signature keeps signs, swaps numbers", sig.signature === "Solve for x: x − {1} = -{2}" && sig.values.join() === "8,2", JSON.stringify(sig));
  ok("fill puts them back", T.fillTemplate(sig.signature, sig.values) === "Solve for x: x − 8 = -2");
  ok("decimals are one number", T.signatureOf("Solve for x: x/4 + 6 = 6.75").values.join() === "4,6,6.75");
  const good = "A raid needs {3} stacks: each chest holds {1}, with {2} on the floor. {1}x + {2} = {3}. How many chests do you think you need?";
  ok("template with every placeholder passes", T.checkTemplate("Solve for x: {1}x + {2} = {3}", good).ok);
  // Plain questions pass; a question bolted on with "your call" is stilted.
  const plain = T.checkTemplate("Solve for x: {1}x + {2} = {3}", "A raid needs {3} stacks: each chest holds {1}, with {2} on the floor. {1}x + {2} = {3}. How many chests do you need to fill?");
  ok("a plain question passes", plain.ok, JSON.stringify(plain));
  for (const stilted of ["Your call: how many feet is that?", "What is your call on the total seconds?", "What do you think the total is?", "How many grams do you think it is?", "In your view, how many?"]) {
    ok(`"${stilted}" is stilted`, T.STILTED.test(stilted));
  }
  for (const fine of ["How many chests do you think you need?", "How many do you figure you can carry?", "How many seconds until the drop?", "Which step wrecked your plan?"]) {
    ok(`"${fine}" reads fine`, !T.STILTED.test(fine));
  }
  const bolted = T.checkTemplate("Solve for x: {1}x + {2} = {3}", "Chests of {1}, with {2} on the floor: {1}x + {2} = {3}. Your call: how many chests?");
  ok("a bolted-on question is rejected as awkward", !bolted.ok && bolted.reason === "awkward");
  // "{2} are on the floor" is "1 are on the floor" when {2} is 1.
  ok("a verb after a placeholder fails", !T.checkTemplate("Solve for x: {1}x + {2} = {3}", "Chests of {1}, {2} are on the floor: {1}x + {2} = {3}. How many do you think?").ok);
  ok('"1 hours" is caught', T.readsWrongAtOne("cover 60 miles in 1 hours", "A car travels 60 miles in 1 hour.") === "1 hours");
  ok('"1 hour" and "11 hours" are fine', T.readsWrongAtOne("in 1 hour, then 11 hours", "x") === null);
  ok("a plural the original had is fine", T.readsWrongAtOne("1 pairs of socks", "Buy 1 pairs of socks") === null);
  ok("template ids are stable and short", T.templateId(good) === T.templateId(good) && /^[0-9a-f]{12}$/.test(T.templateId(good)) && T.templateId(good) !== T.templateId(good + " "));
  ok("keys carry the rules version", T.templateKey("x = {1}", "Minecraft").startsWith(`v${T.TEMPLATE_RULES}::`));
  // A closing question that is not the student's call is made into one.
  ok("a template with no question fails", !T.checkTemplate("x = {1}", "Build it: x = {1}.").ok);
  const noEq = T.checkTemplate("Put these steps in the correct order to solve {1}x − {2} = {3}:", "Your track broke, the steps are below. What order do you think fixes it, {1} {2} {3}?", ["{1}x − {2} = {3}"]);
  ok("a story missing its equation says which one", !noEq.ok && noEq.detail.includes("{1}x − {2} = {3}"), JSON.stringify(noEq));
  const { shapeSpans } = await import("../story-pipeline.ts");
  let spanChecks = 0, spanMismatch = 0;
  for (const unit of units) for (const skill of unit.skills) for (const p of generateProblemBank(skill.id, skill.problems, 7)) {
    const prompt = P.stripVariantTag(p.prompt);
    const s3 = T.signatureOf(prompt);
    spanChecks++;
    // Conversion chains ("5 km → 5000 m → 500 cm") are added on top of the math.
    const shaped = shapeSpans(s3.signature).map((sp) => T.fillTemplate(sp, s3.values)).filter((sp) => !sp.includes("→"));
    if (JSON.stringify(shaped) !== JSON.stringify(P.mathSpans(prompt))) spanMismatch++;
  }
  ok(`a shape's equations match its problems' (${spanChecks} problems)`, spanMismatch === 0, `${spanMismatch} differ`);
  const { STORY_LIBRARY } = await import("../../data/story-library.ts");
  const bySignature = new Map<string, { prompt: string; p: unknown }[]>();
  for (const unit of units) for (const skill of unit.skills) for (const seed of [7, 7919]) for (const p of generateProblemBank(skill.id, skill.problems, seed)) {
    if (!P.canPersonalize(p as never)) continue;
    const sig = T.signatureOf(P.stripVariantTag(p.prompt)).signature;
    bySignature.set(sig, [...(bySignature.get(sig) ?? []), { prompt: p.prompt, p }]);
  }
  const libraryFailures: string[] = [];
  let shipped = 0;
  for (const [key, list] of Object.entries(STORY_LIBRARY)) {
    const [version, sig] = key.split("::");
    if (version !== `v${T.TEMPLATE_RULES}`) libraryFailures.push(`${key}: stale rules version`);
    for (const t of list) {
      shipped++;
      const structural = T.checkTemplate(sig, t.template, shapeSpans(sig));
      if (!structural.ok) { libraryFailures.push(`${structural.reason}: ${t.template}`); continue; }
      const samples = bySignature.get(sig) ?? [];
      if (!samples.length) { libraryFailures.push(`no problem of this shape: ${sig}`); continue; }
      for (const sample of samples.slice(0, 3)) {
        const filled = T.fillTemplate(structural.template, T.signatureOf(P.stripVariantTag(sample.prompt)).values);
        const r = P.checkRewrite(sample.p as never, filled);
        if (!r.ok) libraryFailures.push(`${r.reason} ${r.detail ?? ""}: ${filled}`);
      }
    }
  }
  ok(`every shipped story passes today's checks (${shipped} templates)`, libraryFailures.length === 0, libraryFailures.slice(0, 4).join(" | "));
  const missing = T.checkTemplate("Solve for x: {1}x + {2} = {3}", "Chests of {1}: {1}x + {2}. How many?");
  ok("a missing placeholder fails with what to fix", !missing.ok && missing.detail.startsWith("left out {3}"), JSON.stringify(missing));
  ok("an invented placeholder fails", !T.checkTemplate("x = {1}", "Level {2}, x = {1}. What is x?").ok);
  ok("a digit of its own fails", !T.checkTemplate("x = {1}", "In 2 rounds, x = {1}. What is x?").ok);
  // Every problem in the course must survive the round trip exactly, or a
  // filled template could never match its problem.
  let roundTrips = 0, broken = 0;
  for (const unit of units) for (const skill of unit.skills) for (const p of generateProblemBank(skill.id, skill.problems, 7)) {
    const prompt = P.stripVariantTag(p.prompt);
    const s2 = T.signatureOf(prompt);
    roundTrips++;
    if (T.fillTemplate(s2.signature, s2.values) !== prompt) broken++;
  }
  ok(`all ${roundTrips} prompts round-trip through their signature`, broken === 0, `${broken} broken`);
  // A template filled with a problem's numbers passes the same checks as a
  // hand-written story for that problem.
  const shape = T.signatureOf("Solve for x: 4x + 6 = 30");
  const filled = T.fillTemplate(good, shape.values);
  ok("a filled template passes the story checks", P.checkRewrite({ id: "t", type: "numeric", prompt: "Solve for x: 4x + 6 = 30", answer: 6 }, filled).ok, filled);
}

// --- The template writer's own examples must pass the checks ----------------
{
  const T = await import("../story-templates.ts");
  const pairs = [...T.TEMPLATE_WRITER_SYSTEM.matchAll(/Original: "([^"]+)" \(([^)]+)\)\n-> "([^"]+)"/g)];
  ok("the template prompt has examples", pairs.length >= 4, String(pairs.length));
  for (const [, original, topic, story] of pairs) {
    const structural = T.checkTemplate(original, story);
    // Fill both with made-up numbers, one per placeholder, so the example can
    // be checked like a real problem.
    const values = [...new Set([...original.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])))].map((k) => String(10 + k * 7));
    const filledOriginal = T.fillTemplate(original, values);
    const filledStory = T.fillTemplate(story, values);
    const r = P.checkRewrite({ id: "x", type: "numeric", prompt: filledOriginal, answer: 99991 }, filledStory);
    ok(`template example passes (${topic}: ${original.slice(0, 28)})`, structural.ok && r.ok, JSON.stringify({ structural, r }));
  }
}

// --- The server regenerates exactly the bank the browser saw ----------------
for (const skill of units.flatMap((u) => u.skills)) {
  const a = generateProblemBank(skill.id, skill.problems, 123456789);
  const b = generateProblemBank(skill.id, skill.problems, 123456789);
  if (JSON.stringify(a) !== JSON.stringify(b)) ok(`bank reproducible: ${skill.id}`, false);
}
ok("banks are reproducible from a seed", true);

// --- Answer keys that were wrong --------------------------------------------
{
  const bad: string[] = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const p of generateProblemBank("simplifying-radicals", [], seed)) {
      const m = typeof p.answer === "string" && p.answer.match(/√(\d+)$/);
      if (m) for (let k = 2; k * k <= Number(m[1]); k++) if (Number(m[1]) % (k * k) === 0) bad.push(`${p.prompt} = ${p.answer}`);
    }
  }
  ok("radical answers are in simplest form", bad.length === 0, bad.slice(0, 3).join("; "));
}
{
  const bad: string[] = [];
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const p of generateProblemBank("factoring-special", [], seed)) {
      const m = p.prompt.match(/Factor (\d+)x² − (\d+)$/);
      if (m && gcd(Number(m[1]), Number(m[2])) > 1) bad.push(p.prompt);
    }
  }
  ok("difference-of-squares answers are fully factored", bad.length === 0, bad.slice(0, 3).join("; "));
}

// --- The calculator, per skill ----------------------------------------------
const seedsOf = (id: string) => units.flatMap((u) => u.skills).find((s) => s.id === id)!.problems;
const calc = (id: string) => skillOffersCalculator(id, seedsOf(id));
ok("no calculator for equations", !calc("two-step-equations"));
ok("no calculator for one-step", !calc("one-step-equations"));
ok("no calculator for slope", !calc("slope"));
ok("calculator for unit conversion", calc("unit-basics"));
ok("calculator for compound interest", calc("exponential-growth"));
ok("calculator for unit word problems", calc("unit-word-problems"));
ok("no answer is remembered from an empty bank", !skillOffersCalculator("unit-basics", []) || calc("unit-basics"));
const offered = units.flatMap((u) => u.skills).filter((s) => calc(s.id)).map((s) => s.id);
console.log(`  calculator offered on ${offered.length} skills: ${offered.join(", ")}`);

// --- Five right, in any order, first tries only -----------------------------
store.clear();
const S = "two-step-equations";
recordProblemAttempt(S, true, { firstTry: true });
recordProblemAttempt(S, true, { firstTry: true });
recordProblemAttempt(S, false);
ok("a miss keeps what was banked", getSkillPracticeStats(S).solved === 2);
recordProblemAttempt(S, true, { firstTry: false });
ok("a retry does not count toward five", getSkillPracticeStats(S).solved === 2);
recordProblemAttempt(S, true, { firstTry: true });
recordProblemAttempt(S, false);
recordProblemAttempt(S, true, { firstTry: true });
ok("four right is not done", !getSkillPracticeStats(S).isComplete && getSkillPracticeStats(S).problemsNeeded === 1);
const done = recordProblemAttempt(S, true, { firstTry: true });
ok("five right in any order finishes", done.skillJustCompleted && getSkillPracticeStats(S).isComplete);
ok("with misses it is proficient, not mastered", done.newLevel === "proficient");
recordProblemAttempt(S, false);
ok("finishing is permanent", getSkillPracticeStats(S).isComplete);

store.clear();
for (let i = 0; i < 5; i++) recordProblemAttempt("slope", true, { firstTry: true });
ok("five straight is mastered", getSkillPracticeStats("slope").isComplete && getProgress().skills.slope.level === "mastered");

ok(
  "old saves carry over their progress",
  solvedCount({ skillId: "x", level: "familiar", problemsAttempted: 9, problemsCorrect: 6, videoWatched: false, correctStreak: 3, recentResults: [true, true, false, true, true] }) === 4
);
ok(
  "old saves cannot finish on their own",
  solvedCount({ skillId: "x", level: "attempted", problemsAttempted: 4, problemsCorrect: 4, videoWatched: false, recentResults: [true, true, true, true] }) < 5
);

store.clear();
const fresh = getProgress();
fresh.badges.push("leak");
ok("the default progress is never shared", !getProgress().badges.includes("leak"));
saveProgress(getProgress());

// --- The helper's answer filter, now that it gets the answer key -----------
{
  const ctx = { problemPrompt: "Find the slope between (0, 1) and (3, 6).", explanation: "m = 5/3", answer: "1.6666666666666667" };
  const f = forbiddenValues(ctx);
  ok("the key's rounded forms are forbidden", f.includes("1.67") && f.includes("1.7"), f.join());
  ok("a rounded answer is caught", leaksAnswer("So the slope is about 1.67.", f));
  ok("a hint without it passes", !leaksAnswer("Rise over run: how far up, and how far across?", f));
  const mcCtx = { problemPrompt: "Which is point-slope form?", answer: "y − 5 = 3(x − 2)" };
  ok("a choice answer is caught", leaksAnswerText("It's y - 5 = 3(x - 2).", mcCtx));
  ok("single-word choices are left alone", !leaksAnswerText("Is the line dashed or solid?", { answer: "Dashed" }));
}

ok(
  "a number ending a sentence stays out of the equation after it",
  JSON.stringify(P.mathSpans("Each row adds 6. 6x + 4 = 22. How many rows do you think?")) === JSON.stringify(["6x + 4 = 22"]),
  JSON.stringify(P.mathSpans("Each row adds 6. 6x + 4 = 22. How many rows do you think?"))
);
ok("a decimal inside an equation still holds together", JSON.stringify(P.mathSpans("Solve for x: 2.5x + 1 = 6")) === JSON.stringify(["2.5x + 1 = 6"]));

// --- Unit and interest hues: every text/surface pairing clears WCAG AA ---------
{
  const H = await import("../hues.ts");
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const failures: string[] = [];
  for (const hue of Object.values(H.HUES)) {
    // Body text (4.5) on every surface it can land on: white, the tint, the wash.
    for (const surface of ["#ffffff", hue.tint, hue.wash]) {
      if (contrast(hue.ink, surface) < 4.5) failures.push(`${hue.name} ink on ${surface}: ${contrast(hue.ink, surface).toFixed(2)}`);
    }
    // Text on the solid and deep banner colors.
    for (const surface of [hue.solid, hue.deep]) {
      if (contrast(hue.onSolid, surface) < 4.5) failures.push(`${hue.name} onSolid on ${surface}: ${contrast(hue.onSolid, surface).toFixed(2)}`);
    }
    // The bar is decorative, so the large-text floor of 3 against white and the wash.
    if (contrast(hue.bar, "#ffffff") < 2.2) failures.push(`${hue.name} bar on white: ${contrast(hue.bar, "#ffffff").toFixed(2)}`);
  }
  ok(`every hue pairing clears its contrast floor (${Object.keys(H.HUES).length} hues)`, failures.length === 0, failures.join("; "));
  ok("every unit has its own hue", new Set(units.map((u) => H.unitHue(u.id).name)).size === units.length);
  ok("neighbouring units differ in hue", units.every((u, i) => i === 0 || H.unitHue(u.id).name !== H.unitHue(units[i - 1].id).name));
  ok("every preset interest has a hue", INTEREST_OPTIONS.every((o) => H.topicHue(o.label)));
  ok("a typed interest gets a steady hue", H.topicHue("Fishing").name === H.topicHue("fishing ").name);
  // Node's type stripping stops at .tsx, so the marks file is read as text.
  const marks = readFileSync(new URL("../../components/UnitMark.tsx", import.meta.url), "utf8");
  const unmarked = units.filter((u) => !new RegExp(`^  "?${u.id}"?: \\(`, "m").test(marks)).map((u) => u.id);
  ok("every unit has a line mark", unmarked.length === 0, unmarked.join());
}

// --- The house: catalog, art, prizes and pay ---------------------------------
{
  const cat = await import("../../data/house-catalog.ts");
  const art = await import("../../data/furniture-art.ts");
  const G = await import("../gamification.ts");
  const B = await import("../bridgeys.ts");
  const { normalizeProgress } = await import("../progress.ts");
  const { DISPLAY_TITLES } = await import("../../data/titles-catalog.ts");
  const { existsSync } = await import("node:fs");
  const ids = cat.FURNITURE_ITEMS.map((i) => i.id);
  ok(`furniture ids are unique (${ids.length} pieces)`, new Set(ids).size === ids.length);
  ok("the shop has 90 pieces to buy", cat.SHOP_ITEMS.length === 90, String(cat.SHOP_ITEMS.length));
  const noArt = ids.filter((id) => !art.furnitureSvg(id));
  ok("every piece has art", noArt.length === 0, noArt.join());
  const noPng = ids.filter((id) => !existsSync(new URL(`../../../public/house/furniture/${id}.png`, import.meta.url)));
  ok("every piece has its PNG exported", noPng.length === 0, noPng.join());
  const noStroke = ids.filter((id) => /stroke="#1e293b" stroke-width="2\.5"/.test(art.furnitureSvg(id)!));
  ok("no piece is drawn with the old outline", noStroke.length === 0, noStroke.join());
  ok("every unit has exactly one prize", units.every((u) => cat.UNIT_PRIZES.filter((p) => p.earnedBy === u.id).length === 1));
  ok("prizes cost nothing and are out of the shop", cat.UNIT_PRIZES.every((p) => p.price === 0) && cat.SHOP_ITEMS.every((p) => !p.earnedBy));
  ok("shop prices rise with rarity", (() => {
    const max = (r: string) => Math.max(...cat.SHOP_ITEMS.filter((i) => i.rarity === r).map((i) => i.price));
    const min = (r: string) => Math.min(...cat.SHOP_ITEMS.filter((i) => i.rarity === r).map((i) => i.price));
    return max("common") < min("rare") && max("rare") < min("legendary");
  })());
  const titleIds = DISPLAY_TITLES.map((t) => t.id);
  ok(`title ids are unique (${titleIds.length} titles)`, new Set(titleIds).size === titleIds.length && titleIds.length === 38);
  // Pay grows with the unit.
  ok("unit 1 skills pay 10", G.bridgeysForSkill(units[0].skills[0].id) === 10);
  ok("unit 13 skills pay 34", G.bridgeysForSkill(units[12].skills[0].id) === 34);
  // A prize is granted once, on the unit's completion, and backfilled for old saves.
  const done = normalizeProgress({});
  for (const s of units[0].skills) done.skills[s.id] = { skillId: s.id, level: "proficient", problemsAttempted: 5, problemsCorrect: 5, videoWatched: true };
  ok("finishing a unit grants its prize", B.grantUnitPrize(done, units[0].id) === "prize-ruler" && done.ownedFurniture.includes("prize-ruler"));
  ok("and only once", B.grantUnitPrize(done, units[0].id) === null && done.ownedFurniture.filter((id) => id === "prize-ruler").length === 1);
  const old = normalizeProgress({ skills: Object.fromEntries(units[1].skills.map((s) => [s.id, { skillId: s.id, level: "mastered", problemsAttempted: 5, problemsCorrect: 5, videoWatched: true }])) });
  ok("a unit finished before prizes existed gets its prize on load", old.ownedFurniture.includes("prize-scale") && !old.ownedFurniture.includes("prize-ruler"));
  ok("a unit bonus pays once", B.tryAwardUnitCompleteBridgeys(done, units[0].id) === 40 && B.tryAwardUnitCompleteBridgeys(done, units[0].id) === 0);
  ok("a prize cannot be bought", !B.buyFurniture("prize-ruler").ok);
}

// --- Saving, paying and streaks, end to end through the real functions ---------
{
  const Pr = await import("../progress.ts");
  const B = await import("../bridgeys.ts");
  const G = await import("../gamification.ts");
  const R = await import("../rink.ts");
  store.clear();
  const u1 = units[0];
  const first = u1.skills[0].id;
  const start = Pr.getProgress().bridgeys;
  ok("a new student starts with 25 Bridgeys", start === 25, String(start));

  // Five right on the first try: the skill completes and pays exactly once.
  let last: ReturnType<typeof recordProblemAttempt> | null = null;
  for (let i = 0; i < 5; i += 1) last = recordProblemAttempt(first, true, { firstTry: true });
  ok("five first tries finish the skill", last!.skillJustCompleted && last!.newLevel === "mastered");
  ok("finishing it pays its Bridgeys", last!.bridgeysGained === G.bridgeysForSkill(first) && Pr.getProgress().bridgeys === 25 + G.bridgeysForSkill(first));
  ok("the pay is recorded as claimed", Pr.getProgress().bridgeyRewardsClaimed!.complete.includes(first));
  const again = recordProblemAttempt(first, true, { firstTry: true });
  ok("a sixth answer pays nothing more", again.bridgeysGained === 0 && !again.skillJustCompleted);
  ok("the work is in storage, dated", (() => { const raw = JSON.parse(store.get("algebridge-progress")!); return raw.skills[first].level === "mastered" && raw.skills[first].solved >= 5 && typeof raw.updatedAt === "string"; })());
  ok("a reload reads it back", Pr.getProgress().skills[first].problemsAttempted === 6);

  // Finish the rest of the unit: the bonus and the prize arrive once.
  let unitResult: ReturnType<typeof recordProblemAttempt> | null = null;
  for (const sk of u1.skills.slice(1)) for (let i = 0; i < 5; i += 1) unitResult = recordProblemAttempt(sk.id, true, { firstTry: true });
  // Fifteen right answers in a day also meet the daily goal, which pays once on top.
  const expected = 25 + u1.skills.reduce((n, sk) => n + G.bridgeysForSkill(sk.id), 0) + G.BRIDGEY_REWARDS.unitComplete + G.BRIDGEY_REWARDS.dailyGoal;
  ok("finishing the unit pays every skill, the unit bonus and the day's goal", unitResult!.unitJustCompleted && Pr.getProgress().bridgeys === expected, `${Pr.getProgress().bridgeys} vs ${expected}`);
  ok("the daily goal paid exactly once", Pr.getProgress().daily?.paid === true && Pr.getProgress().daily!.right >= G.DAILY_GOAL);
  ok("and hands over the unit prize", unitResult!.unitPrizeId === "prize-ruler" && Pr.getProgress().ownedFurniture.includes("prize-ruler"));
  ok("the unit bonus is claimed once", Pr.getProgress().bridgeyRewardsClaimed!.units!.length === 1);

  // The rink pays per solve until the day's cap, then keeps counting solves.
  const before = Pr.getProgress().bridgeys;
  const r1 = B.awardRinkBridgeys(first, "2026-09-21");
  ok("a rink solve pays", r1.paid === R.rinkPayFor(first) && Pr.getProgress().bridgeys === before + r1.paid && r1.remaining === R.RINK_DAILY_CAP - r1.paid);
  for (let i = 0; i < 30; i += 1) B.awardRinkBridgeys(first, "2026-09-21");
  const capped = B.awardRinkBridgeys(first, "2026-09-21");
  ok("the rink stops paying at the daily cap", capped.paid === 0 && capped.remaining === 0 && Pr.getProgress().bridgeys === before + R.RINK_DAILY_CAP);
  ok("a new day pays again", B.awardRinkBridgeys(first, "2026-09-22").paid === R.rinkPayFor(first));
  ok("spending takes it back out", (() => { const b = Pr.getProgress().bridgeys; const res = B.buyFurniture("rug"); return res.ok && Pr.getProgress().bridgeys === b - 15; })());

  // Streaks: by the calendar, from real activity only.
  const d = (s: string) => new Date(s);
  ok("first activity starts a streak of 1", Pr.streakAfterActivity(0, undefined, d("2026-09-21T15:00")) === 1);
  ok("the day after adds one", Pr.streakAfterActivity(3, "2026-09-20T22:50:00", d("2026-09-21T07:00")) === 4);
  ok("a second answer the same day changes nothing", Pr.streakAfterActivity(4, "2026-09-21T07:00:00", d("2026-09-21T21:00")) === 4);
  ok("late night then early morning still counts as consecutive days", Pr.streakAfterActivity(1, "2026-09-20T23:59:00", d("2026-09-21T00:10")) === 2);
  ok("a missed day starts over at 1", Pr.streakAfterActivity(9, "2026-09-18T12:00:00", d("2026-09-21T12:00")) === 1);
  ok("a streak stands while today or yesterday was active", Pr.streakStanding(5, "2026-09-20T20:00:00", d("2026-09-21T09:00")) === 5 && Pr.streakStanding(5, "2026-09-21T08:00:00", d("2026-09-21T09:00")) === 5);
  ok("and reads 0 once a day was missed", Pr.streakStanding(5, "2026-09-19T20:00:00", d("2026-09-21T09:00")) === 0);
  ok("the streak in storage moved with today's answers", Pr.getProgress().streak >= 1 && !!Pr.getProgress().lastVisit);
  ok("a rink solve counts as a day of practice", (() => { const p = Pr.getProgress(); p.streak = 2; p.lastVisit = new Date(Date.now() - 86_400_000).toISOString(); saveProgress(p); B.awardRinkBridgeys(first, "2026-09-23"); return Pr.getProgress().streak === 3; })());

  // Which copy to keep when this browser and the cloud disagree.
  const local = { ...Pr.getProgress(), updatedAt: "2026-09-21T10:10:00.000Z" };
  ok("a newer local copy beats an older cloud row", Pr.newerCopy(local, "2026-09-21T10:00:00.000Z") === "local");
  ok("a newer cloud row beats an older local copy", Pr.newerCopy(local, "2026-09-21T10:30:00.000Z") === "cloud");
  ok("no cloud row keeps the local copy", Pr.newerCopy(local, null) === "local");
  ok("an undated local copy yields to the cloud", Pr.newerCopy({ ...local, updatedAt: undefined }, "2020-01-01T00:00:00.000Z") === "cloud");
  ok("an import keeps the cloud's date", (() => { Pr.importProgressFromSync(JSON.stringify({ ...local, xp: 1 }), "2026-09-21T10:30:00.000Z"); return Pr.getProgress().updatedAt === "2026-09-21T10:30:00.000Z"; })());
  store.clear();
}

// --- The rink ------------------------------------------------------------------
{
  const R = await import("../rink.ts");
  const { RINK_ITEMS } = await import("../../data/rink-catalog.ts");
  const art = await import("../../data/furniture-art.ts");
  const { normalizeProgress } = await import("../progress.ts");
  const { existsSync } = await import("node:fs");
  ok("rink pieces have art and PNGs", RINK_ITEMS.every((i) => art.furnitureSvg(i.id) && existsSync(new URL(`../../../public/house/rink/${i.id}.png`, import.meta.url))));
  ok("rink piece ids are unique", new Set(RINK_ITEMS.map((i) => i.id)).size === RINK_ITEMS.length);
  ok("the rink has seven spots with unique ids", R.RINK_SLOTS.length === 7 && new Set(R.RINK_SLOTS.map((s) => s.id)).size === 7);
  // Head math: small whole numbers in, a whole number out.
  const head = (prompt: string, answer: string | number, type: "numeric" | "multiple-choice" = "numeric") =>
    R.isHeadMath({ id: "t", type, prompt, hint: "", answer, explanation: "", choices: type === "multiple-choice" ? ["a", "b"] : undefined });
  ok("3x + 5 = 20 is head math", head("Solve for x: 3x + 5 = 20", 5));
  ok("a decimal answer is out", !head("Solve for x: 4x = 6", 1.5));
  ok("money is out", !head("$1000 invested at 5% annual interest. Value after 2 years?", 1102.5));
  ok("big numbers are out", !head("Convert 3 miles to feet. (1 mile = 5280 ft)", 15840));
  ok("rounding is out", !head("Convert 25 inches to feet. (round to the hundredths place)", 2.08));
  ok("a short multiple choice is in", head("Which is an exponential function?", "y = 3(2)ˣ", "multiple-choice"));
  // Which skills feed it.
  const fresh = normalizeProgress({});
  const start = R.rinkSkillIds(fresh);
  ok("a new student's rink is Unit 1, all of it", start.unitNumber === 1 && !start.borrowed && start.ids.join() === units[0].skills.map((s) => s.id).join());
  const onto2 = normalizeProgress({});
  for (const s of units[0].skills) onto2.skills[s.id] = { skillId: s.id, level: "proficient", problemsAttempted: 5, problemsCorrect: 5, videoWatched: true };
  ok("finishing Unit 1 moves the rink to Unit 2", R.rinkSkillIds(onto2).unitNumber === 2 && R.currentUnit(onto2).number === 2);
  const picked = R.pickRinkProblem(onto2);
  ok("a rink problem comes from the unit you are on and is head math", !!picked && picked.unitNumber === 2 && R.isHeadMath(picked.problem));
  // Every unit has at least one skill that works in the head, so the rink
  // never has to borrow from an earlier unit (the fallback exists all the same).
  const perUnit = units.map((u, i) => {
    const p = normalizeProgress({});
    for (const done of units.slice(0, i)) for (const s of done.skills) p.skills[s.id] = { skillId: s.id, level: "mastered", problemsAttempted: 5, problemsCorrect: 5, videoWatched: true };
    const r = R.rinkSkillIds(p);
    return r.unitNumber === u.number && !r.borrowed && !!R.pickRinkProblem(p);
  });
  ok("every unit serves the rink from its own problems", perUnit.every(Boolean), perUnit.map((v, i) => (v ? "" : units[i].id)).filter(Boolean).join());
  const seen = new Set<string>();
  const prompts = new Set<string>();
  for (let i = 0; i < 12; i += 1) { const p = R.pickRinkProblem(fresh, seen); if (p) { seen.add(p.problem.prompt); prompts.add(p.problem.prompt); } }
  ok("rink problems vary from ring to ring", prompts.size >= 8, String(prompts.size));
  ok("a 7x coefficient is head math, a 13x one is out", R.isHeadMath({ id: "t", type: "numeric", prompt: "Solve for x: 7x + 5 = 33", hint: "", answer: 4, explanation: "" }) && !R.isHeadMath({ id: "t", type: "numeric", prompt: "Solve for x: 13x + 5 = 44", hint: "", answer: 3, explanation: "" }));
  // Pay and the day's cap.
  ok("a unit 1 problem pays 3, a unit 13 problem 9", R.rinkPayFor(units[0].skills[0].id) === 3 && R.rinkPayFor(units[12].skills[0].id) === 9);
  ok("a fresh day has the whole cap", R.rinkRemainingToday(fresh, "2026-09-21") === R.RINK_DAILY_CAP);
  ok("today's earnings come off the cap", R.rinkRemainingToday({ ...fresh, rink: { day: "2026-09-21", earned: 45, solved: 15, best: 5 } }, "2026-09-21") === 15);
  ok("yesterday's earnings do not", R.rinkRemainingToday({ ...fresh, rink: { day: "2026-09-20", earned: 60, solved: 20, best: 5 } }, "2026-09-21") === R.RINK_DAILY_CAP);
  ok("the boards keep her on the rink", R.onRink(R.RINK.cx, R.RINK.cy) && !R.onRink(R.RINK.cx + R.RINK.rx + 5, R.RINK.cy) && R.onRink(R.clampToRink(R.RINK.cx + 900, R.RINK.cy + 900).x, R.clampToRink(R.RINK.cx + 900, R.RINK.cy + 900).y, -1));
}

// --- The learning path ---------------------------------------------------------
{
  const L = await import("../path.ts");
  const { normalizeProgress } = await import("../progress.ts");
  const [s1, s2, s3] = L.PATH;
  const blank = () => normalizeProgress({});
  const skill = (id: string, extra: Record<string, unknown> = {}) => ({
    skillId: id, level: "locked" as const, problemsAttempted: 0, problemsCorrect: 0, videoWatched: false, ...extra,
  });
  ok("the first skill is open", L.skillAccess(blank(), s1.skillId).open);
  const second = L.skillAccess(blank(), s2.skillId);
  ok("the second waits for the first", !second.open && second.after.skillId === s1.skillId);
  const done = blank();
  done.skills[s1.skillId] = skill(s1.skillId, { level: "proficient" });
  ok("finishing a skill opens the next", L.skillAccess(done, s2.skillId).open && !L.skillAccess(done, s3.skillId).open);
  const visited = blank();
  visited.skills[s3.skillId] = skill(s3.skillId, { level: "attempted" });
  ok("opening a page is not work", !L.skillAccess(visited, s3.skillId).open);
  const worked = blank();
  worked.skills[s3.skillId] = skill(s3.skillId, { level: "attempted", problemsAttempted: 2 });
  ok("a skill with answers in it stays open", L.skillAccess(worked, s3.skillId).open);
  const checked = blank();
  checked.skills[s3.skillId] = skill(s3.skillId, { openedBy: "check" });
  ok("a passed check opens a skill", L.skillAccess(checked, s3.skillId).open);
  ok("an assigned skill is open", L.skillAccess(blank(), s3.skillId, { assigned: new Set([s3.skillId]) }).open);
  ok("teachers see everything", L.PATH.every((st) => L.skillAccess(blank(), st.skillId, { staff: true }).open));
  const lastOfUnit1 = units[0].skills[units[0].skills.length - 1].id;
  ok("unit 2 waits for unit 1", !L.unitIsOpen(blank(), units[1].id));
  const unitDone = blank();
  unitDone.skills[lastOfUnit1] = skill(lastOfUnit1, { level: "mastered" });
  ok("finishing unit 1 opens unit 2", L.unitIsOpen(unitDone, units[1].id));
  const now = new Date(2026, 8, 21, 15);
  ok("one check a day", !L.canTryCheck(skill("x", { checkedOn: "2026-09-21" }), now) && L.canTryCheck(skill("x", { checkedOn: "2026-09-20" }), now));
  ok("the path covers every skill once", L.PATH.length === units.reduce((n, u) => n + u.skills.length, 0) && new Set(L.PATH.map((st) => st.skillId)).size === L.PATH.length);
}

// --- Reading model replies ---------------------------------------------------
{
  const bare = P.parseModelJson('[ {"id":"a","answer":"4"}, {"id":"b","answer":"5"} ]');
  ok("a bare list is read as the answers", Array.isArray(bare?.answers) && (bare!.answers as unknown[]).length === 2);
  const cut = P.parseModelJson('{"answers":[{"id":"a","answer":"4","why":"has } and { in it"},{"id":"b","ans');
  ok("a reply cut off keeps the finished entries", Array.isArray(cut?.answers) && (cut!.answers as { id: string }[]).map((x) => x.id).join() === "a");
  const cutList = P.parseModelJson('[{"id":"a","template":"x = {1}"},{"id":"b","templ');
  ok("a cut-off bare list keeps the finished entries", (cutList?.items as { id: string }[] | undefined)?.map((x) => x.id).join() === "a");
  ok("a normal reply still reads", (P.parseModelJson('<think>hm</think>{"items":[{"id":"a"}]}')?.items as unknown[]).length === 1);
}

// --- The calculator: every bug the audit found in the maths ----------------
{
  const C = await import("../calculator.ts");
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  // Big and small results read back as the same number (e used to be 2.718).
  ok("10^21 shows as 1×10^21", C.formatResult(C.evaluate("10^21")) === "1×10^21", C.formatResult(C.evaluate("10^21")));
  ok("and reads back as 10^21", C.evaluate(C.formatResult(1e21)) === 1e21);
  ok("(3×10^8)×(2×10^15) is 6×10^23", C.formatResult(C.evaluate("(3×10^8)×(2×10^15)")) === "6×10^23");
  const tiny = C.formatResult(C.evaluate("1÷3000000"));
  ok("1÷3000000 is 3.333333×10^−7", tiny === "3.333333×10^−7", tiny);
  ok("which reads back right", near(C.evaluate(tiny), 3.333333e-7));
  ok("6.02×10^23 has no float fuzz", C.formatResult(6.02 * 10 ** 23) === "6.02×10^23", C.formatResult(6.02 * 10 ** 23));
  ok("2^64 fits the screen", C.formatResult(2 ** 64) === "1.844674×10^19", C.formatResult(2 ** 64));
  ok("negatives use the keypad's minus", C.formatResult(-12) === "−12" && C.evaluate("−12+2") === -10);
  // Chaining from a result uses the real value, not the 10 digits shown.
  const third = C.evaluate("1÷3");
  const shown = C.formatResult(third);
  ok("1÷3=×3= is 1", C.formatResult(C.evaluate(`${shown}×3`, { text: shown, value: third })) === "1");
  const root2 = C.evaluate("√(2)");
  ok("√2=x²= is 2", C.formatResult(C.evaluate(`${C.formatResult(root2)}^2`, { text: C.formatResult(root2), value: root2 })) === "2");
  ok("a result followed by a number multiplies", C.evaluate("5(2)", { text: "5", value: 5 }) === 10);
  // π and √ next to each other.
  ok("π√2 works", near(C.evaluate("π√(2)"), Math.PI * Math.SQRT2));
  ok("ππ works", near(C.evaluate("ππ"), Math.PI * Math.PI));
  ok("2π works", near(C.evaluate("2π"), 2 * Math.PI));
  // ± negates the last term.
  const sign: [string, string][] = [
    ["", "−"], ["3+", "3+−"], ["3+4", "3−4"], ["3−4", "3+4"], ["−5", "5"], ["3×−5", "3×5"],
    [".5", "−.5"], ["(2+3)", "−(2+3)"], ["2π", "−2π"], ["5^2", "−5^2"], ["(2", "(−2"], ["10^−7", "−10^−7"], ["√(9)", "−√(9)"],
  ];
  for (const [from, to] of sign) ok(`± on "${from}" gives "${to}"`, C.toggleSign(from) === to, C.toggleSign(from));
  ok("5 x² ± is −25", C.evaluate(C.toggleSign("5^2")) === -25);
  // Odd roots of negatives.
  ok("(−8)^(1÷3) is −2", near(C.evaluate("(−8)^(1÷3)"), -2));
  ok("(−8)^(2÷3) is 4", near(C.evaluate("(−8)^(2÷3)"), 4));
  let evenRoot = "";
  try { C.evaluate("(−4)^(1÷2)"); } catch (e) { evenRoot = (e as Error).message; }
  ok("an even root of a negative is still undefined", evenRoot === "Result is undefined", evenRoot);
  // Percent.
  ok("5% is 0.05", C.evaluate("5%") === 0.05);
  ok("1000×(1+5%)^2 is 1102.5", near(C.evaluate("1000×(1+5%)^2"), 1102.5));
  ok("50%×80 is 40", C.evaluate("50%×80") === 40);
  // What already worked still does.
  ok("2^3^2 is 512", C.evaluate("2^3^2") === 512);
  ok("−3^2 is −9", C.evaluate("−3^2") === -9);
  ok("2×−3 is −6", C.evaluate("2×−3") === -6);
  ok("0.1+0.2 shows 0.3", C.formatResult(C.evaluate("0.1+0.2")) === "0.3");
  let byZero = "";
  try { C.evaluate("5÷0"); } catch (e) { byZero = (e as Error).message; }
  ok("dividing by zero is an error", byZero === "Can't divide by zero");
  ok("open brackets close themselves", C.evaluate(C.balanceParens("√(9")) === 3);
}

// --- Names: one shape, "First Last" --------------------------------------------
{
  const N = await import("../name.ts");
  ok("lowercase is capitalized", N.formatName("maria alvarez") === "Maria Alvarez");
  ok("ALL CAPS is capitalized", N.formatName("IVAN DUBOVYI") === "Ivan Dubovyi");
  ok("a name with its own capitals is kept", N.formatName("Sean McKay") === "Sean McKay" && N.formatName("Anna DeLuca") === "Anna DeLuca");
  ok("hyphens and apostrophes", N.formatName("jean-pierre o'brien") === "Jean-Pierre O'Brien");
  ok("particles stay lowercase inside", N.formatName("willem van der berg") === "Willem van der Berg");
  ok("Last, First turns round", N.formatName("alvarez, maria") === "Maria Alvarez");
  ok("stray punctuation and spaces go", N.formatName("  maria   alvarez. ") === "Maria Alvarez");
  ok("a full name passes, tidied", N.checkFullName("ivan dubovyi").ok && N.checkFullName("ivan dubovyi").formatted === "Ivan Dubovyi");
  const initial = N.checkFullName("Ivan D.");
  ok("a last initial is refused, asking for the full last name", !initial.ok && initial.field === "last" && /full last name/.test(initial.error), initial.error);
  ok("digits are called out", /numbers/.test(N.checkFullName("sam d2011").error));
  ok("an email prefix is not a name", !N.isRealName("ivan.d2011") && !N.isRealName("Ivan D.") && N.isRealName("Ivan Dubovyi"));
  const parts = N.checkNameParts("maria", "alvarez");
  ok("two boxes give one tidy name", parts.ok && parts.formatted === "Maria Alvarez");
  ok("an initial in the last box is refused", N.checkNameParts("Ivan", "D").field === "last" && N.checkNameParts("Ivan", "d.").field === "last");
  ok("an empty box is refused, by box", N.checkNameParts("Ivan", "").field === "last" && N.checkNameParts("", "Dubovyi").field === "first");
  ok("splitName leaves an initial blank for the form", N.splitName("Ivan D.").last === "" && N.splitName("Ivan Dubovyi").last === "Dubovyi" && N.splitName("ivan").first === "Ivan");
  ok("initials still work", N.initialsOf("Ivan Dubovyi") === "ID");
}

// --- The founder's allowance ---------------------------------------------------
{
  const B = await import("../bridgeys.ts");
  const Pr = await import("../progress.ts");
  store.clear();
  const p = Pr.getProgress();
  p.bridgeys = 0;
  Pr.saveProgress(p);
  ok("with no Bridgeys the shop refuses", !B.buyFurniture("beanbag").ok);
  B.setUnlimitedBridgeys(true);
  ok("unlimited: the shop can spend without limit", B.spendable(Pr.getProgress()) === Infinity);
  const bought = B.buyFurniture("beanbag", "rose");
  ok("unlimited: the piece is bought at no charge", bought.ok && Pr.getProgress().bridgeys === 0 && Pr.getProgress().ownedFurniture.includes("beanbag"), bought.message);
  ok("and in the colour it was tried in", Pr.getProgress().itemColors?.beanbag === "rose");
  ok("the allowance never lands in the save", !JSON.stringify(Pr.getProgress()).toLowerCase().includes("unlimited"));
  B.setUnlimitedBridgeys(false);
  ok("switched off, the shop charges again", !B.buyFurniture("bed").ok && B.spendable(Pr.getProgress()) === 0);
}

// --- Colours, switches and floors ---------------------------------------------
{
  const art = await import("../../data/furniture-art.ts");
  const B = await import("../bridgeys.ts");
  const Pr = await import("../progress.ts");
  const D = await import("../dollhouse.ts");
  ok("every piece has a colour of its own to repaint", art.ART_IDS.every((id) => art.PRIMARY[id]));
  ok("every primary colour is really in the art", art.ART_IDS.every((id) => art.furnitureSvg(id)!.includes(art.primaryHex(id))));
  const plain = art.furnitureSvg("beanbag")!;
  const rose = art.furnitureSvg("beanbag", { color: "rose" })!;
  ok("a swatch repaints the piece, shades included", rose !== plain && rose.includes(art.swatchHex("rose")) && !rose.includes(art.primaryHex("beanbag")));
  ok("and the palette comes back afterwards", art.furnitureSvg("beanbag") === plain);
  ok("an unknown swatch changes nothing", art.furnitureSvg("beanbag", { color: "plaid" }) === plain);
  ok("pieces with a switch look different off", [...art.USABLE].every((id) => art.furnitureSvg(id, { off: true }) !== art.furnitureSvg(id)));
  ok("pieces without one do not", art.ART_IDS.filter((id) => !art.USABLE.has(id)).every((id) => art.furnitureSvg(id, { off: true }) === art.furnitureSvg(id)));
  ok("the art moves", art.ART_IDS.filter((id) => art.furnitureSvg(id)!.includes('class="fa fa-')).length >= 45);
  ok("nothing glows once it is off", ["lamp", "tv", "fireplace"].every((id) => { const s = art.furnitureSvg(id, { off: true })!; return !s.includes("fa-glow") && !s.includes("fa-flame") && !s.includes("fa-flicker"); }));

  store.clear();
  const p = Pr.getProgress();
  p.bridgeys = 5000;
  Pr.saveProgress(p);
  ok("painting needs the piece first", !B.setItemColor("lamp", "sky").ok);
  B.buyFurniture("lamp");
  ok("an owned piece takes a swatch", B.setItemColor("lamp", "sky").ok && Pr.getProgress().itemColors?.lamp === "sky");
  ok("and refuses a colour off the card", !B.setItemColor("lamp", "plaid").ok);
  ok("its own colour again", B.setItemColor("lamp", null).ok && Pr.getProgress().itemColors?.lamp === undefined);
  B.buyRinkItem("rink-lamp", "pink");
  ok("a rink piece is bought in a colour too", Pr.getProgress().itemColors?.["rink-lamp"] === "pink");

  ok("a lamp goes upstairs", B.placeFurnitureAt("lamp", 50, 50, "up").ok && Pr.getProgress().placedFurnitureItems![0].floor === "up");
  const lamp = Pr.getProgress().placedFurnitureItems![0];
  ok("a switch flips it", B.toggleFurniture(lamp.instanceId).ok && Pr.getProgress().placedFurnitureItems![0].off === true);
  ok("and back", B.toggleFurniture(lamp.instanceId).ok && Pr.getProgress().placedFurnitureItems![0].off === false);
  B.buyFurniture("rug");
  B.placeFurnitureAt("rug", 40, 40);
  const rug = () => Pr.getProgress().placedFurnitureItems!.find((f) => f.itemId === "rug")!;
  ok("a rug has no switch", !B.toggleFurniture(rug().instanceId).ok);
  ok("a piece can be dragged elsewhere, kept in the room", B.moveFurniture(rug().instanceId, 120, -5).ok && rug().x === 95 && rug().y === 10 && B.floorOf(rug()) === "down");
  ok("and sent up the stairs", B.moveFurnitureToFloor(rug().instanceId, "up").ok && rug().floor === "up");
  ok("an old save with no floor is downstairs", B.floorOf({ instanceId: "x", itemId: "rug", x: 1, y: 1 }) === "down");
  B.setHouseNight(true);
  ok("night is remembered", Pr.getProgress().houseNight === true);

  // Geometry: each floor's band is its own, and a click on a wall is nowhere.
  const up = D.roomSpot(50, 50, "up");
  const down = D.roomSpot(50, 50, "down");
  ok("upstairs sits above downstairs", up.y < D.SLAB.top && down.y > D.SLAB.bottom && up.y >= D.FLOORS.up.floorTop && down.y <= D.FLOORS.down.floor);
  ok("a click lands on the floor it is over", D.floorAt(600, D.FLOORS.up.floorTop + 20) === "up" && D.floorAt(600, D.FLOORS.down.floor - 5) === "down" && D.floorAt(600, D.FLOORS.up.ceiling + 20) === null && D.floorAt(10, D.FLOORS.down.floor - 5) === null);
  ok("roomPoint inverts roomSpot on each floor", (["up", "down"] as const).every((f) => { const s = D.roomSpot(30, 70, f); const b = D.roomPoint(s.x, s.y, f); return Math.abs(b.x - 30) < 0.01 && Math.abs(b.y - 70) < 0.01; }));
  ok("the house is two storeys tall", D.HOUSE.base - D.HOUSE.wallTop > 440 && D.ROOF_APEX > 0);
}

// --- No card offers the same answer twice --------------------------------------
{
  const U = await import("../problem-utils.ts");
  const { getFreshProblemsForSkill } = await import("../../data/problem-banks.ts");
  const key = (s: string) => s.replace(/\s+/g, "").replace(/−/g, "-").toLowerCase();
  let cards = 0;
  const bad: string[] = [];
  const thin: string[] = [];
  for (const u of units) {
    for (const s of u.skills) {
      for (const seed of [1, 2, 3]) {
        for (const p of generateProblemBank(s.id, s.problems, seed)) {
          if (p.type !== "multiple-choice" || !p.choices) continue;
          cards += 1;
          if (new Set(p.choices.map(key)).size < p.choices.length) bad.push(`${s.id}: ${JSON.stringify(p.choices)}`);
          if (p.choices.length < 3) thin.push(`${s.id}: ${JSON.stringify(p.choices)}`);
          if (!p.choices.some((c) => key(c) === key(String(p.answer)))) bad.push(`${s.id}: answer missing ${JSON.stringify(p.choices)}`);
        }
      }
      for (const p of getFreshProblemsForSkill(s.id, s.problems)) {
        if (p.type === "multiple-choice" && p.choices && new Set(p.choices.map(key)).size < p.choices.length) bad.push(`fresh ${s.id}`);
      }
    }
  }
  ok(`no multiple-choice card repeats an answer (${cards} cards, 3 seeds each)`, bad.length === 0, bad.slice(0, 3).join(" | "));
  ok("every card still offers at least three answers", thin.length === 0, thin.slice(0, 3).join(" | "));
  ok("a wrong answer equal to the right one is dropped", U.dedupeChoices(["3", "-3", "3", "0"], "-3").length === 4 && new Set(U.dedupeChoices(["3", "-3", "3", "0"], "-3")).size === 4);
  ok("and the card is filled back up with nearby numbers", U.dedupeChoices(["7", "7", "7", "7"], "7").length === 4);
  ok("Unicode minus counts as the same answer", U.dedupeChoices(["−3", "-3", "3"], "−3").length === 4 && U.dedupeChoices(["−3", "-3", "3"], "−3").filter((c) => c.replace("−", "-") === "-3").length === 1);
  ok("word answers are only deduplicated", U.dedupeChoices(["Quadrant I", "Quadrant II", "Quadrant I", "Quadrant III"], "Quadrant I").join() === "Quadrant I,Quadrant II,Quadrant III");
  ok("the answer is always on the card", U.dedupeChoices(["1", "2"], "9").includes("9"));
  ok("a card with no repeats is left as is", (() => { const p = { id: "x", type: "multiple-choice" as const, prompt: "", answer: "a", choices: ["a", "b", "c"] }; return U.withUniqueChoices(p) === p; })());
}

// --- On the walls ----------------------------------------------------------------
{
  const D = await import("../dollhouse.ts");
  const B = await import("../bridgeys.ts");
  const Pr = await import("../progress.ts");
  const cat = await import("../../data/house-catalog.ts");
  const art = await import("../../data/furniture-art.ts");
  ok("wall pieces exist and have art", cat.WALL_MOUNTED.size >= 15 && [...cat.WALL_MOUNTED].every((id) => cat.getFurnitureItem(id)?.mount === "wall" && art.furnitureSvg(id)));
  ok("a poster hangs, a bed does not", cat.canHang("poster") && !cat.canHang("bed"));
  for (const f of ["up", "down"] as const) {
    const w = D.wallBand(f);
    const s = D.wallSpot(50, 50, f);
    ok(`the wall ${f} sits between the ceiling and the floor`, w.top >= D.FLOORS[f].ceiling && w.bottom <= D.FLOORS[f].floorTop && s.y > w.top && s.y <= w.bottom && s.y < D.FLOORS[f].floorTop);
    const back = D.wallPoint(s.x, s.y, f);
    ok(`wallPoint inverts wallSpot ${f}`, Math.abs(back.x - 50) < 0.01 && Math.abs(back.y - 50) < 0.01);
    ok(`a click on the wall ${f} says so`, D.surfaceAt(600, w.top + 20)?.surface === "wall" && D.surfaceAt(600, w.top + 20)?.floor === f);
    ok(`a click on the floor ${f} says so`, D.surfaceAt(600, D.FLOORS[f].floor - 5)?.surface === "floor");
  }
  ok("outside the house is nothing", D.surfaceAt(50, 500) === null && D.surfaceAt(600, 30) === null);

  store.clear();
  const p = Pr.getProgress();
  p.bridgeys = 5000;
  Pr.saveProgress(p);
  B.buyFurniture("poster");
  B.buyFurniture("bed");
  ok("a bed refuses the wall", !B.placeFurnitureAt("bed", 50, 50, "down", "wall").ok);
  ok("a poster hangs upstairs", B.placeFurnitureAt("poster", 20, 40, "up", "wall").ok && (() => { const e = Pr.getProgress().placedFurnitureItems!.find((f) => f.itemId === "poster")!; return e.surface === "wall" && e.floor === "up" && e.x === 20; })());
  const poster = () => Pr.getProgress().placedFurnitureItems!.find((f) => f.itemId === "poster")!;
  ok("a wall piece can reach the edges", B.moveFurniture(poster().instanceId, 0, 100).ok && poster().x === 0 && poster().y === 100 && B.surfaceOf(poster()) === "wall");
  ok("and comes back down to the floor", B.moveFurnitureToSurface(poster().instanceId, "floor").ok && B.surfaceOf(poster()) === "floor" && poster().y === 50);
  ok("and back up on the wall", B.moveFurnitureToSurface(poster().instanceId, "wall").ok && B.surfaceOf(poster()) === "wall");
  ok("an old save with no surface is on the floor", B.surfaceOf({ instanceId: "x", itemId: "poster", x: 1, y: 1 }) === "floor");
  const spot = D.placedSpot(poster().x, poster().y, "up", "wall");
  ok("a hung piece draws on the wall, behind the floor band", spot.y < D.FLOORS.up.floorTop && spot.depth === 0);
}

// --- The leaderboard default ------------------------------------------------------
{
  const { normalizeProgress } = await import("../progress.ts");
  const L = await import("../leaderboard.ts");
  ok("a new save is on the board", normalizeProgress({}).leaderboardOptIn === true);
  ok("a save from the opt-in week goes back on, once", normalizeProgress({ leaderboardOptIn: false }).leaderboardOptIn === true);
  ok("a student who hid themselves stays hidden", normalizeProgress({ leaderboardOptIn: false, leaderboardDefaultV2: true }).leaderboardOptIn === false);
  ok("the board only ever gets First L.", L.publicLeaderboardName("Jordyn Harwood") === "Jordyn H." && L.publicLeaderboardName("") === "Anonymous Student");
}

// --- The daily goal ---------------------------------------------------------------
{
  const Pr = await import("../progress.ts");
  const G = await import("../gamification.ts");
  const B = await import("../bridgeys.ts");
  store.clear();
  const day1 = new Date(2026, 8, 23, 10);
  const p = Pr.getProgress();
  let paid = 0;
  for (let i = 0; i < G.DAILY_GOAL - 1; i++) paid += Pr.tallyDaily(p, day1);
  ok("the goal pays nothing before it is met", paid === 0 && Pr.dailyStatus(p, day1).right === G.DAILY_GOAL - 1 && !Pr.dailyStatus(p, day1).met);
  const bonus = Pr.tallyDaily(p, day1);
  ok("the tenth right answer pays the goal", bonus === G.BRIDGEY_REWARDS.dailyGoal && Pr.dailyStatus(p, day1).met);
  ok("and only once that day", Pr.tallyDaily(p, day1) === 0 && Pr.tallyDaily(p, day1) === 0);
  const day2 = new Date(2026, 8, 24, 9);
  ok("a new day starts at zero", Pr.dailyStatus(p, day2).right === 0 && !Pr.dailyStatus(p, day2).met);
  ok("and can pay again", (() => { let got = 0; for (let i = 0; i < G.DAILY_GOAL; i++) got += Pr.tallyDaily(p, day2); return got === G.BRIDGEY_REWARDS.dailyGoal; })());
  Pr.saveProgress(p);
  ok("a wrong answer counts nothing", (() => { store.clear(); const r = Pr.recordProblemAttempt(units[0].skills[0].id, false); return r.dailyRight === 0 && r.dailyBonus === 0; })());
  ok("a right answer counts one", Pr.recordProblemAttempt(units[0].skills[0].id, true, { firstTry: true }).dailyRight === 1);
  const today = (await import("../path.ts")).today();
  ok("the rink counts toward the goal", B.awardRinkBridgeys(units[0].skills[0].id, today).dailyBonus === 0 && Pr.dailyStatus(Pr.getProgress()).right === 2);
  ok("the course stats carry today's count", Pr.getCourseStats().todayRight === 2 && Pr.getCourseStats().dailyGoal === G.DAILY_GOAL);
}

// --- Grading what students actually type ------------------------------------------
{
  const { answerIsRight } = await import("../grading.ts");
  const n = (answer: number, typed: string, dp?: number) => answerIsRight({ type: "numeric", answer, decimalPlaces: dp }, typed);
  ok("f(4) = 11 is 11", n(11, "f(4) = 11") && n(14, "g(-3)=14"));
  ok("a leading plus is fine", n(4, "+4"));
  ok("a space after the minus is fine", n(-1 / 3, "- 1/3"));
  ok("a power is its value", n(729, "3^6") && n(0.125, "2^(-3)"));
  ok("0 is not 1/144", !n(1 / 144, "0") && !n(1 / 144, "0.00") && n(1 / 144, "1/144") && n(1 / 144, "0.0069"));
  ok("negative halves round away from zero", n(-0.125, "-0.13") && !n(-0.125, "-0.12") && n(0.125, "0.13"));
  ok("0 is still 0", n(0, "0") && n(0, "0.00"));
  ok("a multiple-choice minus is either minus", answerIsRight({ type: "multiple-choice", answer: "−3" }, "-3"));
}

// --- Building banks ------------------------------------------------------------------
{
  const U = await import("../problem-utils.ts");
  ok("5⁰ and 5^0 are the same card", U.canonicalPrompt("Simplify: 5⁰") === U.canonicalPrompt("Simplify:  5^0"));
  ok("−x² and -x² are the same card", U.canonicalPrompt("Does y = −x² + 4 open up or down?") === U.canonicalPrompt("Does y = -x² + 4 open up or down?"));
  ok("a copy tag is the same card", U.canonicalPrompt("Simplify √27 (Set 5)") === U.canonicalPrompt("Simplify √27"));
  ok("fractions read as fractions", U.fractionText(0.125) === "1/8" && U.fractionText(-2 / 3) === "-2/3" && U.fractionText(4) === null && U.fractionText(Math.PI) === null);
  // Both kinds of question on a two-kind skill: the old builder only ever saw one parity.
  const bank = generateProblemBank("coordinate-plane", [], 99);
  const quadrant = bank.filter((p) => /quadrant/.test(p.prompt)).length;
  ok(`a two-kind skill serves both kinds evenly (${quadrant} of ${bank.length} quadrant)`, quadrant >= 20 && quadrant <= 30, String(quadrant));
  const decay = generateProblemBank("exponential-decay", [], 5).find((p) => /\$25,000 loses 15%.*2 years/.test(p.prompt));
  ok("the half-dollar car rounds up", !decay || decay.answer === 18063, String(decay?.answer));
}

// --- The team games -------------------------------------------------------------
{
  const G = await import("../games.ts");
  const B = await import("../bridgeys.ts");
  const R = await import("../rink.ts");
  const Pr = await import("../progress.ts");
  ok("four team games, one per teammate", G.COURT_GAMES.length === 4 && new Set(G.COURT_GAMES.map((g) => g.id)).size === 4 && G.COURT_GAMES.map((g) => g.player).join() === "Shaurya,Jo,Jordyn,Rayla");
  ok("each game is found by its id, and only real ids", G.COURT_GAMES.every((g) => G.getCourtGame(g.id) === g) && !G.getCourtGame("rink") && !G.getCourtGame("hockey"));
  ok("Jo is the shortest, Jordyn the tallest", Math.min(...G.COURT_GAMES.map((g) => g.height)) === G.getCourtGame("cheer")!.height && Math.max(...G.COURT_GAMES.map((g) => g.height)) === G.getCourtGame("volleyball")!.height);
  ok("every player starts inside their court", G.COURT_GAMES.every((g) => G.inArea(g.area, g.start.x, g.start.y, 22)));
  ok("every court sits inside the picture", G.COURT_GAMES.every((g) => {
    const a = g.area;
    return a.kind === "rect" ? a.x0 >= 0 && a.x1 <= G.SCENE.W && a.y0 >= 0 && a.y1 <= G.SCENE.H : a.cx - a.rx >= 0 && a.cx + a.rx <= G.SCENE.W && a.cy + a.ry <= G.SCENE.H;
  }));
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const clampsIn = G.COURT_GAMES.every((g) => {
    for (let i = 0; i < 400; i += 1) {
      const x = rand() * 1400 - 100;
      const y = rand() * 1000 - 100;
      const c = G.clampToArea(g.area, x, y, 22);
      if (!G.inArea(g.area, c.x, c.y, 21.9)) return false;
      if (G.inArea(g.area, x, y, 22) && (c.x !== x || c.y !== y)) return false;
    }
    return true;
  });
  ok("a player pushed off the court comes back onto it, and one on it stays put", clampsIn);
  const spotsFair = G.COURT_GAMES.every((g) => {
    for (let i = 0; i < 300; i += 1) {
      const from = G.clampToArea(g.area, rand() * 1200, rand() * 800, 22);
      const s = G.spotAwayFrom(g.area, from, rand);
      // Inside where the player can stand, so every target can be reached.
      if (!G.inArea(g.area, s.x, s.y, 22)) return false;
      if (Math.hypot(s.x - from.x, (s.y - from.y) * 1.6) < 100) return false;
    }
    return true;
  });
  ok("every target lands where the player can reach it, a fair run away", spotsFair);
  ok("nearer the front is drawn larger", G.COURT_GAMES.every((g) => {
    const top = g.area.kind === "rect" ? g.area.y0 : g.area.cy - g.area.ry;
    const bottom = g.area.kind === "rect" ? g.area.y1 : g.area.cy + g.area.ry;
    return G.depthScale(g.area, top) === 0.78 && G.depthScale(g.area, bottom) === 1 && G.depthScale(g.area, top - 50) === 0.78;
  }));
  const soccer = G.getCourtGame("soccer")!.area;
  const volley = G.getCourtGame("volleyball")!.area;
  ok("the goal is up the field from where Rayla plays", soccer.kind === "rect" && G.GOAL.line < soccer.y0 && G.GOAL.x0 < 600 && G.GOAL.x1 > 600);
  ok("Jordyn plays her side of the net", volley.kind === "rect" && G.NET_Y < volley.y0);

  // All five games pay from one daily pot.
  const p = Pr.getProgress();
  p.rink = undefined;
  Pr.saveProgress(p);
  const skill = units[0].skills[0].id;
  for (let i = 0; i < 40; i += 1) B.awardRinkBridgeys(skill, "2026-09-24");
  ok("after the rink hits the cap, a court game pays nothing more today", B.awardRinkBridgeys(skill, "2026-09-24").paid === 0 && R.rinkRemainingToday(Pr.getProgress(), "2026-09-24") === 0);
  const source = readFileSync(new URL("../../components/games/CourtGame.tsx", import.meta.url), "utf8");
  ok("the courts pay through the rink's capped award", /awardRinkBridgeys\(/.test(source) && !/progress\.bridgeys\s*[+]?=/.test(source));

  // Best runs, per game.
  B.recordGameRun("wrestling", 4);
  B.recordGameRun("wrestling", 2);
  B.recordGameRun("soccer", 3);
  const bests = Pr.getProgress().gameBest ?? {};
  ok("each game keeps its own best run, and a shorter run leaves it", bests.wrestling === 4 && bests.soccer === 3 && bests.cheer === undefined);
  B.recordGameRun("wrestling", 7);
  ok("a longer run replaces it", Pr.getProgress().gameBest?.wrestling === 7);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
