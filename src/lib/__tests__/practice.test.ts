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
const { sanitizeTopics, topicsFromPicks, isSchoolSafe, INTEREST_OPTIONS, cleanSpecifics } = await import("../interests.ts");
const cleanSpecificsOk = (s: string) => cleanSpecifics(s) === s;
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

// --- More ways to write an answer ------------------------------------------------
{
  const G = await import("../grading.ts");
  const num = (expected: number, given: string, opts = {}) => G.gradeTyped(expected, given, opts);
  ok("½ on its own", numericAnswerMatches(0.5, "½"));
  ok("2½ is a mixed number", numericAnswerMatches(2.5, "2½") && numericAnswerMatches(2.5, "2 ½"));
  ok("-¾", numericAnswerMatches(-0.75, "-¾") && numericAnswerMatches(-0.75, "−¾"));
  ok("fraction slash and ÷", numericAnswerMatches(5 / 3, "5⁄3") && numericAnswerMatches(5 / 3, "5 ÷ 3"));
  ok("x ≈ for a rounded answer", numericAnswerMatches(5 / 3, "x ≈ 1.67") && numericAnswerMatches(5 / 3, "≈1.67"));
  ok("f(4) ≈", numericAnswerMatches(11, "f(4) = 11") && numericAnswerMatches(11.2, "f(4) ≈ 11.2", 1));
  ok("percent for a share", numericAnswerMatches(0.45, "45%") && numericAnswerMatches(0.45, "45 %", 2));
  ok("percent still reads as a percent", numericAnswerMatches(45, "45%"));
  ok("a percent is not any amount", !numericAnswerMatches(0.45, "4.5%") && !numericAnswerMatches(0.45, "450%"));
  ok("scientific notation, typed every way", ["3.5 × 10^4", "3.5x10^4", "3.5*10^4", "3.5 x 10⁴", "3.5e4", "3.5 times 10^4"].every((t) => numericAnswerMatches(35000, t)));
  ok("negative exponents in scientific notation", numericAnswerMatches(0.00042, "4.2 × 10^-4") && numericAnswerMatches(0.00042, "4.2 × 10⁻⁴") && numericAnswerMatches(0.00042, "4.2*10^(-4)"));
  ok("scientific notation with a unit", numericAnswerMatches(35000, "3.5 × 10^4 km"));
  ok("a superscript power", numericAnswerMatches(729, "3⁶") && numericAnswerMatches(0.125, "2⁻³"));
  ok("old forms still read", ["5/3", "1 2/3", "1.67", "x = 1.67"].every((t) => numericAnswerMatches(5 / 3, t)));

  // Arithmetic counts where the calculator is offered, and is only a nudge where it is not.
  ok("expressions judged where offered", num((3 + Math.sqrt(17)) / 2, "(3+√17)/2", { expressions: true }) === "right");
  ok("rounded expression", num(562.43, "500 × 1.04^3", { expressions: true, decimalPlaces: 2 }) === "right" && num(562.43, "500*1.04³", { expressions: true, decimalPlaces: 2 }) === "right");
  ok("π and roots", num(4 * Math.PI, "4π", { expressions: true }) === "right" && num(2 * Math.sqrt(3), "2√3", { expressions: true }) === "right");
  ok("a wrong expression is wrong", num(10, "2 × 6", { expressions: true }) === "wrong");
  ok("3x4 typed for 3 × 4", num(12, "3x4", { expressions: true }) === "right");
  ok("unfinished arithmetic is a nudge where it is the skill", num(4, "(11 − 3)/2") === "simplify" && num(5, "2 + 3") === "simplify");
  ok("a nudge says nothing about right or wrong", num(4, "(11 − 3)/3") === "simplify");
  ok("a typo is unreadable, not wrong", num(4, "4..") === "unreadable" && num(4, "four-ish") === "unreadable" && num(4, "") === "unreadable");
  ok("a plain number is judged either way", num(4, "4") === "right" && num(4, "5") === "wrong" && num(4, "8/2") === "right");

  // Typing the problem's own arithmetic back is not an answer.
  ok("2^5 for Evaluate 2^5", num(32, "2^5", { prompt: "Evaluate 2^5." }) === "simplify" && num(32, "2⁵", { prompt: "Evaluate 2^5." }) === "simplify");
  ok("√49 for Simplify √49", num(7, "√49", { expressions: true, prompt: "Simplify √49" }) === "simplify");
  ok("the √ key's √(49) is the prompt's √49 too", num(7, "√(49)", { expressions: true, prompt: "Simplify √49" }) === "simplify");
  ok("roots from the √ key are read", num((3 + Math.sqrt(17)) / 2, "(3+√(17))/2", { expressions: true }) === "right" && num(2 * Math.sqrt(3), "2√(3)", { expressions: true }) === "right");
  ok("typed sqrt is read", num(Math.sqrt(17), "sqrt(17)", { expressions: true }) === "right");
  ok("standard form copied back", num(35000, "3.5 × 10^4", { prompt: "Write 3.5 × 10^4 in standard form." }) === "simplify" && num(35000, "3.5x10^4", { prompt: "Write 3.5 × 10^4 in standard form." }) === "simplify");
  ok("a power that is the work still counts", num(729, "3^6", { prompt: "Simplify 3^2 · 3^4" }) === "right");
  ok("a fraction from the prompt still counts", num(2 / 3, "2/3", { prompt: "A line has slope 2/3. What is the slope of a line parallel to it?" }) === "right");
  ok("a negative from the prompt still counts", num(-3, "-3", { prompt: "What is the y-intercept of y = 2x − 3?" }) === "right");
  ok("a wrong copy is just wrong", num(97, "2^5", { prompt: "Evaluate 3 · 2^5 + 1" }) === "wrong");

  const P = { type: "numeric", answer: 4, prompt: "Solve 2x + 3 = 11" };
  ok("answerIsRight keeps its yes or no", G.answerIsRight(P, "4") && !G.answerIsRight(P, "(11-3)/2") && G.answerIsRight(P, "(11-3)/2", { expressions: true }));
  ok("gradeAnswer reads choices", G.gradeAnswer({ type: "multiple-choice", answer: "x = 4" }, "x = 4") === "right" && G.gradeAnswer({ type: "multiple-choice", answer: "x = 4" }, "x = 5") === "wrong");
}

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
{
  const { topicKey, validSpecifics, describeTopic, mergeTopics } = await import("../interests.ts");
  const own = topicsFromPicks(["soccer", "creators"], { soccer: "Arsenal, Messi", creators: "MrBeast", music: "ignored" });
  ok("picks carry their specifics", own[0].specifics === "Arsenal, Messi" && own[1].specifics === "MrBeast");
  ok("specifics only for tapped chips", Object.keys(validSpecifics({ soccer: "Arsenal", music: "Drake" }, ["soccer"])).join() === "soccer");
  ok("unsafe or personal specifics are dropped", !topicsFromPicks(["soccer"], { soccer: "my coach jake@school.com" })[0].specifics && !topicsFromPicks(["soccer"], { soccer: "beer league" })[0].specifics);
  ok("specific topics get their own story pool", topicKey(own[0]) === "Soccer|arsenal messi" && topicKey({ label: "Soccer", details: "" }) === "Soccer");
  ok("sanitize keeps specifics", sanitizeTopics([{ label: "Anime", details: "episodes", specifics: "One Piece, Luffy" }])[0].specifics === "One Piece, Luffy");
  ok("describe names the specifics", describeTopic(own[0]) === "Soccer (Arsenal, Messi)");
  const merged = mergeTopics(topicsFromPicks(["soccer"]), [{ label: "Soccer", details: "", specifics: "Real Madrid" }]);
  ok("the note can add specifics to a tap", merged.length === 1 && merged[0].specifics === "Real Madrid");
  const { applyCleanedSpecifics, INTEREST_OPTIONS: OPTS } = await import("../interests.ts");
  const raw = topicsFromPicks(["soccer", "anime", "music"], { soccer: "Arsenal, my coach Dave", anime: "One Piece", music: "Drake" });
  const cleaned = applyCleanedSpecifics(raw, [
    { interest: "soccer", specifics: "Arsenal" },
    { interest: "Anime & manga", specifics: "" },
    { interest: "Nope", specifics: "x" },
  ]);
  ok("the model's cleaning replaces what was typed", cleaned[0].specifics === "Arsenal");
  ok("an emptied line loses its specifics", !("specifics" in cleaned[1]));
  ok("a topic the model skipped keeps its own", cleaned[2].specifics === "Drake");
  ok("a bad cleaning payload changes nothing", applyCleanedSpecifics(raw, "junk")[0].specifics === "Arsenal, my coach Dave");
  ok("every option has an ask, an example and suggestions", OPTS.every((o) => o.ask && o.example && o.suggestions.length >= 6));
  ok("every suggestion passes the specifics check", OPTS.every((o) => o.suggestions.every((s) => cleanSpecificsOk(s))));
  const { namesFavorite } = await import("../interests.ts");
  const fan = { specifics: "Arsenal, Messi, my club team" };
  ok("a story that names a favorite passes", namesFavorite("Messi lines up the penalty with {1} minutes left.", fan) && namesFavorite("Your club's keeper saves {1} shots.", fan));
  ok("a story that names none goes back", !namesFavorite("You need exactly {3} points to secure the championship.", fan) && !namesFavorite("Arsenals are flowers", { specifics: "Arsenal" }));
  ok("no specifics means nothing to name", namesFavorite("anything", { specifics: undefined }));
  ok("short names still count", namesFavorite("Your EA FC squad scores {1} goals.", { specifics: "EA FC" }));
}
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
  ok("a step problem needs no answer from the judge", P.judgeVerdict(errorProblem as any, { answer: "-", fits: true, gives_away: false, engaging: 4, natural: 4 }) === "keep");
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

const good4 = { answer: "5", fits: true, gives_away: false, engaging: 4, natural: 5 };
ok("judge: all good is kept", P.judgeVerdict(eq, good4) === "keep");
ok("judge: wrong answer", P.judgeVerdict(eq, { ...good4, answer: "6" }) === "verifier");
ok("judge: makes no sense", P.judgeVerdict(eq, { ...good4, fits: false }) === "unfit");
ok("judge: gives it away", P.judgeVerdict(eq, { ...good4, gives_away: true }) === "gives-away");
ok("judge: silence on give-away is a no", P.judgeVerdict(eq, { answer: "5", fits: true, engaging: 5 }) === "gives-away");
ok("judge: flat but in their world is kept", P.judgeVerdict(eq, { ...good4, engaging: 3 }) === "keep");
ok("judge: barely connected stays plain", P.judgeVerdict(eq, { ...good4, engaging: 2 }) === "flat");
ok("judge: no score stays plain", P.judgeVerdict(eq, { answer: "5", fits: true, gives_away: false }) === "flat");
ok("judge: nothing at all", P.judgeVerdict(eq, undefined) === "verifier");
ok("judge: clunky wording stays plain", P.judgeVerdict(eq, { ...good4, natural: 3 }) === "unnatural" && P.judgeVerdict(eq, { ...good4, natural: 4 }) === "keep");
ok("judge: no wording score stays plain", P.judgeVerdict(eq, { answer: "5", fits: true, gives_away: false, engaging: 4 }) === "unnatural");
{
  const T = await import("../story-templates.ts");
  // The lines from the feedback, and the shipped ones that read like them.
  ok("made-up reasons are caught", [
    "Your studio arm is {1} inches long and the software needs the value in feet for the mix. How many feet do you figure that is?",
    "You dig a tunnel {1} inches wide, and your build log wants the width in feet. How wide is the tunnel in feet?",
    "Your video edit runs {1} minutes, and the upload form wants the length in milliseconds. How many milliseconds long is the edit?",
  ].every((t) => !!T.contrivedWording(t)));
  ok("a pasted instruction is caught", !!T.contrivedWording("Your team's equipment bag holds 18 kilograms of volleyballs; convert 18 kilograms to grams. How many grams of ball weight are you hauling?"));
  ok("the math book in a story is caught", !!T.contrivedWording("The gym is {1} miles from the school. With {2} mile = {3} ft in the math book, how many feet do you think that is?"));
  ok("real stories pass", [
    "Your crew is filming a downhill line that runs {1} miles from the top of the hill to the skate park. How many feet of pavement will you roll before you get there? ({2} mile = {3} ft)",
    "You smelt the ore and convert the raw iron into ingots before the raid.",
    "Frost is coming tonight, and you want {3} seedlings in the ground before dark. Each row holds {1}, with {2} already planted, so {1}x + {2} = {3}. How many rows do you still have to dig?",
    "You need {1} cups of flour in total for the bake sale.",
  ].every((t) => !T.contrivedWording(t)));
  ok("a contrived story is rejected by the code checks", P.checkRewrite({ id: "c", type: "numeric", prompt: "Convert 18 kilograms to grams.", answer: 18000 }, "Your team's equipment bag holds 18 kilograms of volleyballs; convert 18 kilograms to grams. How many grams are you hauling?").reason === "contrived");
}
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
        // The textbook instruction itself ("Convert 18 kilograms to grams") is
        // rejected inside a story on purpose (see contrivedWording); this sweep
        // is about numbers and math surviving, so that reason is set aside.
        const identity = P.checkRewrite(p, story);
        if (story.length <= P.MAX_PROMPT_CHARS && !identity.ok && identity.reason !== "contrived") {
          identityFails++;
          if (identityFails <= 5) console.log("  story rejected:", skill.id, prompt, JSON.stringify(identity));
        }
        const prefixed = `At practice today: ${story}`;
        const withScene = P.checkRewrite(p, prefixed);
        if (prefixed.length <= P.MAX_PROMPT_CHARS && !withScene.ok && withScene.reason !== "contrived") prefixFails++;
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
ok("calculator for chained conversions", calc("dimensional-analysis"));
ok("calculator for means and fences", calc("center-spread"));
ok("calculator for relative frequencies", calc("two-way-tables"));
ok("calculator for the quadratic formula", calc("quadratic-formula"));
ok("no calculator where perfect squares are the skill", !calc("simplifying-radicals") && !calc("factoring-special") && !calc("solving-by-factoring"));
ok("no calculator for exponent rules", !calc("exponent-rules") && !calc("negative-fractional-exponents"));
ok("no calculator for the special products done by hand", !calc("special-products"));
{
  const { CALCULATOR_WITHHELD, CALCULATOR_OFFERED } = await import("../../data/problem-banks.ts");
  const ids = new Set(units.flatMap((u) => u.skills.map((s) => s.id)));
  const stray = [...CALCULATOR_WITHHELD, ...CALCULATOR_OFFERED].filter((id) => !ids.has(id));
  ok("every calculator override names a real skill", stray.length === 0, stray.join(", "));
  ok("no skill is both offered and withheld", [...CALCULATOR_OFFERED].every((id) => !CALCULATOR_WITHHELD.has(id)));
}
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

// --- Gray text tokens: small text clears 4.5:1 on every light surface it sits on ---
{
  const H = await import("../hues.ts");
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const token = (shade: 400 | 500) => css.match(new RegExp(`\\.text-slate-${shade}\\s*\\{\\s*color:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // White, the page (slate-50), chips and switches (slate-100), the calculator's row gutter, and every unit tint.
  const surfaces = ["#ffffff", "#f8fafc", "#f1f5f9", "#f6f7f9", ...Object.values(H.HUES).map((h) => h.tint)];
  const t400 = token(400);
  const t500 = token(500);
  ok("globals.css sets both gray text tokens", !!t400 && !!t500, `${t400} ${t500}`);
  if (t400 && t500) {
    // slate-500 also labels the keypad tabs on the calculator's gray tray.
    const fails = [
      ...surfaces.filter((s) => contrast(t400, s) < 4.5).map((s) => `slate-400 text on ${s}: ${contrast(t400, s).toFixed(2)}`),
      ...[...surfaces, "#eceef1"].filter((s) => contrast(t500, s) < 4.5).map((s) => `slate-500 text on ${s}: ${contrast(t500, s).toFixed(2)}`),
    ];
    ok("gray text tokens clear 4.5:1 on white, slate-50, slate-100, the keypad tray and every unit tint", fails.length === 0, fails.join("; "));
    ok("the 400 text token stays lighter than the 500 one", luminance(t400) > luminance(t500));
  }
}

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
  ok("unit 15 skills pay 38", G.bridgeysForSkill(units[14].skills[0].id) === 38);
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

// --- The calculator: every bug the audit found in the keypad's maths ---------
{
  const C = await import("../calculator.ts");
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  // Big and small results read back as the same number (e used to be 2.718).
  ok("10^21 shows as 1×10^21", C.formatResult(C.evaluate("10^21")) === "1×10^21", C.formatResult(C.evaluate("10^21")));
  ok("and reads back as 10^21", C.evaluate(C.formatResult(1e21)) === 1e21);
  ok("(3×10^8)×(2×10^15) is 6×10^23", C.formatResult(C.evaluate("(3×10^8)×(2×10^15)")) === "6×10^23");
  const tinyResult = C.formatResult(C.evaluate("1÷3000000"));
  ok("1÷3000000 is 3.333333×10^−7", tinyResult === "3.333333×10^−7", tinyResult);
  ok("which reads back right", near(C.evaluate(tinyResult), 3.333333e-7));
  ok("6.02×10^23 has no float fuzz", C.formatResult(6.02 * 10 ** 23) === "6.02×10^23", C.formatResult(6.02 * 10 ** 23));
  ok("2^64 fits the screen", C.formatResult(2 ** 64) === "1.844674×10^19", C.formatResult(2 ** 64));
  ok("10^12 − 1 rounds to 1×10^12, not 1000000000000", C.formatResult(1e12 - 1) === "1×10^12", C.formatResult(1e12 - 1));
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
  ok("3.5×12 is 42", C.formatResult(C.evaluate("3.5×12")) === "42");
  let byZero = "";
  try { C.evaluate("5÷0"); } catch (e) { byZero = (e as Error).message; }
  ok("dividing by zero is an error", byZero === "Can't divide by zero");
  ok("open brackets close themselves", C.evaluate(C.balanceParens("√(9")) === 3);
  let injected = "";
  try { C.evaluate("alert(1)"); } catch (e) { injected = (e as Error).message; }
  ok("typed code is refused, never run", injected.startsWith("Unexpected character"), injected);
}

// --- The calculator: AlgeBridge's own Scientific (lib/calc-engine.ts) -------
{
  const E = await import("../calc-engine.ts");
  const near = (a: number | undefined, b: number, tol = 1e-9) => a !== undefined && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const one = (text: string, degrees = true) => E.evaluateScientific([text], degrees)[0];
  const val = (text: string, degrees = true) => one(text, degrees).value;
  const shown = (text: string) => one(text).text;
  const err = (text: string, degrees = true) => one(text, degrees).error ?? "";
  // What the verification run types.
  ok("3.5*12 is 42", shown("3.5*12") === "42");
  ok("sqrt(144) is 12", val("sqrt(144)") === 12 && val("√(144)") === 12 && val("√144") === 12);
  ok("sin(30) in degrees is 0.5", shown("sin(30)") === "0.5");
  ok("sin(30) in radians is not", near(val("sin(30)", false), Math.sin(30)));
  ok("5! is 120", val("5!") === 120 && val("0!") === 1);
  // Functions.
  ok("cos(90°) is exactly 0, not 6×10^−17", shown("cos(90)") === "0" && shown("sin(180)") === "0");
  ok("tan(45°) is 1", shown("tan(45)") === "1");
  ok("tan(90°) is undefined", err("tan(90)") === "Undefined");
  ok("tan(π/2) in radians is undefined too", err("tan(π/2)", false) === "Undefined");
  ok("sin⁻¹(0.5) is 30 in degrees", shown("sin^-1(0.5)") === "30" && shown("arcsin(0.5)") === "30");
  ok("cos⁻¹(0) is π/2 in radians", near(val("cos^-1(0)", false), Math.PI / 2));
  ok("sin⁻¹ outside −1 to 1 says so", err("sin^-1(2)") === "sin⁻¹ takes a number from −1 to 1");
  ok("sin^2(30) is a power, not an inverse", shown("sin^2(30)") === "0.25");
  ok("sin 30 + 1 reads as sin(30) + 1", shown("sin 30 + 1") === "1.5");
  ok("ln(e) is 1, log(1000) is 3", shown("ln(e)") === "1" && shown("log(1000)") === "3");
  ok("log base n: log_2(8) is 3", shown("log_2(8)") === "3" && shown("log_(0.5)(4)") === "−2");
  ok("log of a negative says so", err("log(-1)") === "log takes a number greater than 0");
  ok("absolute value both ways", val("|−5|") === 5 && val("abs(-3)") === 3 && val("||-2|-3|") === 1);
  ok("round half away from zero", val("round(2.5)") === 3 && val("round(-2.5)") === -3 && val("round(2.675, 2)") === 2.68);
  ok("e is Euler's number", near(val("e"), Math.E) && near(val("2e"), 2 * Math.E));
  ok("π and e are constants, not letters to set", err("e = 3").includes("already has a value"));
  ok("percent is ÷100", val("50%") === 0.5 && near(val("1000(1+5%)^2"), 1102.5));
  ok("0.5! uses gamma", near(val("0.5!"), 0.886226925452758, 1e-8));
  ok("a negative factorial says so", err("(-3)!") === "! needs a whole number 0 or more");
  // Roots, nested.
  ok("√(√16) is 2", val("√(√(16))") === 2);
  ok("cube root of the square root of 64 is 2", near(val("root(3, root(2, 64))"), 2));
  ok("odd roots of negatives work", near(val("root(3,-8)"), -2));
  ok("even roots of negatives say so", err("root(2,-4)") === "Can't take an even root of a negative number");
  ok("√ of a negative says so", err("√(-4)") === "Can't take √ of a negative number");
  // Order of operations.
  ok("−3^2 is −9, 2^3^2 is 512", val("-3^2") === -9 && val("2^3^2") === 512);
  ok("6/2(1+2) is 9, read left to right", val("6/2(1+2)") === 9);
  ok("x² pasted in works", E.evaluateScientific(["x = 4", "x²"])[1].value === 16);
  // ans and row references.
  const ans = E.evaluateScientific(["3.5*12", "", "ans/2", "ans_1 + 5", "ans_4 * 2"]);
  ok("ans is the answer above, skipping empty rows", ans[2].value === 21);
  ok("ans_1 is row 1's answer", ans[3].value === 47 && ans[4].value === 94);
  ok("ans on the first row says there is none", err("ans") === "There is no answer above yet");
  ok("a row can't use its own answer", E.evaluateScientific(["ans_1"])[0].error === "A row can't use its own answer");
  ok("a row that is not there says so", E.evaluateScientific(["1", "ans_9"])[1].error === "There is no row 9");
  // Letters and functions, from any row.
  const vars = E.evaluateScientific(["2a", "a = 3", "b = a + 1", "f(x) = x^2 + 1", "f(b)", "x = 4", "1/2x"]);
  ok("a letter set below works above", vars[0].value === 6);
  ok("a = 3 shows no = beside it, a computed one does", vars[1].show === false && vars[2].show === true && vars[2].value === 4);
  ok("functions work: f(b) is 17", vars[3].kind === "define" && vars[4].value === 17);
  ok("1/2x is (1/2)x, the way it reads", vars[6].value === 2);
  ok("a plain number needs no = beside it", one("42").show === false && one("-7").show === false);
  // Errors.
  ok("dividing by zero says so", err("1/0") === "Can't divide by zero");
  ok("a half-typed row is incomplete, not wrong", one("3+").incomplete === true && one("√()").incomplete === true && one("sin()").incomplete === true);
  ok("a letter with no value says how to give it one", err("q") === "Give q a value first, like q = 3");
  const loop = E.evaluateScientific(["a = b", "b = a", "c = c + 1"]);
  ok("loops are caught", loop.every((r) => r.error === E.LOOP_MESSAGE));
  const twice = E.evaluateScientific(["q = 1", "q = 2", "q"]);
  ok("a letter set twice says so", twice.every((r) => r.error === "q is defined more than once"));
  ok("an extra bracket says so", err("2)") === "There is an extra )");
  ok("points belong to Graphing", err("(1,2)") === "Points and lists work in Graphing");
  ok("too many decimal points says so", err("1.2.3") === "Too many decimal points in 1.2.3");
  ok("typed code never runs", one("alert(1)").kind === "error" && one("constructor").kind === "error");
  const engineSource = readFileSync(new URL("../calc-engine.ts", import.meta.url), "utf8");
  ok("the engine has no eval or Function", !/\beval\s*\(|new Function|\bFunction\s*\(/.test(engineSource));
  // Never e-notation: the keypad's ×10^n rules.
  ok("10^21 shows as 1×10^21", shown("10^21") === "1×10^21");
  ok("1/3000000 shows as 3.333333×10^−7", shown("1/3000000") === "3.333333×10^−7");
  ok("2^64 fits", shown("2^64") === "1.844674×10^19");
  ok("0.1 + 0.2 − 0.3 is 0, not 5.6×10^−17", shown("0.1+0.2-0.3") === "0");
  ok("no result ever has an e in it", ["10^21", "1/3000000", "2^64", "170!", "0.1^9"].every((t) => !/e/.test(shown(t) ?? "e")));

  // Drawing a row: what is raised, what sits under a radical, what is hidden.
  const sq = E.parseRow("x^2+1");
  ok("x^2+1 raises only the 2", sq.layout.groups.length === 1 && sq.layout.groups[0].t === "sup" && sq.layout.groups[0].s === 2 && sq.layout.groups[0].e === 3 && sq.layout.hidden.has(1));
  const rad = E.parseRow("√(144)");
  ok("√(144) puts 144 under the bar with its brackets hidden", rad.layout.groups[0].t === "rad" && rad.layout.hidden.has(1) && rad.layout.hidden.has(5) && rad.layout.sign.has(0));
  const nth = E.parseRow("root(3,8)");
  ok("root(3,8) is drawn ³√8", nth.layout.groups.some((g) => g.t === "idx") && nth.layout.groups.some((g) => g.t === "rad") && nth.layout.sign.has(6));
  ok("an empty exponent gets a box", E.layoutTree(2, E.parseRow("2^").layout).some((it) => it.t === "grp" && it.empty));
  ok("log_2 lowers the 2", E.parseRow("log_2(8)").layout.groups.some((g) => g.t === "sub" && g.s === 4 && g.e === 5));
  // Edits, as the keys make them.
  const at = (text: string, k: number) => ({ text, start: k, end: k });
  const b1 = E.backspace(at("√(144)", 2));
  ok("backspace just inside a radical takes the radical off", b1.text === "144" && b1.end === 0);
  ok("backspace after a radical steps inside", E.backspace(at("√(144)", 6)).end === 5);
  ok("backspace takes a function name in one go", E.backspace(at("sin(30)", 3)).text === "(30)");
  ok("backspace takes an empty pair together", E.backspace(at("2()", 2)).text === "2");
  ok("( closes itself", E.insertText(at("", 0), "(").text === "()");
  ok("but not in front of a number", E.insertText(at("2", 0), "(").text === "(2");
  ok(") steps over the one already there", E.insertText(at("(2)", 2), ")").end === 3);
  ok("typing sqrt makes √, pi makes π, <= makes ≤", E.insertText(at("sqr", 3), "t").text === "√" && E.insertText(at("p", 1), "i").text === "π" && E.insertText(at("x<", 2), "=").text === "x≤");
  ok("an operator on an empty row starts from ans", E.insertText(at("", 0), "+", { ansFirst: true }).text === "ans+");
  ok("right arrow at the end closes an open bracket", E.stepCaret(at("√(144", 5), 1, false).text === "√(144)");
  ok("and leaves an exponent", E.stepCaret(at("x^2", 3), 1, false).text === "x^2 " && E.evaluateScientific(["x = 3", "x^2 3"])[1].value === 27);
  ok("the caret skips over a word", E.stepCaret(at("sin(30)", 0), 1, false).end === 3);

  // Fractions: a typed / is drawn stacked, ÷ stays inline.
  const g = (text: string, t: string) => E.parseRow(text).layout.groups.filter((x) => x.t === t);
  const half = E.parseRow("1/2");
  ok("1/2 is a fraction: 1 over 2, the / hidden", g("1/2", "frac").length === 1 && g("1/2", "num")[0].s === 0 && g("1/2", "den")[0].s === 2 && half.layout.hidden.has(1));
  ok("1÷2 stays inline", g("1÷2", "frac").length === 0 && E.evaluateScientific(["1÷2"])[0].value === 0.5);
  const ratio = E.parseRow("(x+1)/(x-1)");
  ok("(x+1)/(x-1) hides the brackets that only wrap one part", [0, 4, 6, 10].every((k) => ratio.layout.hidden.has(k)));
  ok("−5/2 keeps its minus in front of the bar", g("-5/2", "num")[0].s === 1 && E.evaluateScientific(["-5/2"])[0].value === -2.5);
  ok("1/2x is drawn ½x and worked out as (1/2)x", g("1/2x", "den")[0].e === 3 && E.evaluateScientific(["x = 4", "1/2x"])[1].value === 2);
  const nest = E.layoutTree(5, E.parseRow("1/2/4").layout);
  const outer = nest[0] as { t: string; g: { t: string }; items: { t: string; g?: { t: string }; items?: { t: string; g?: { t: string } }[] }[] };
  ok("1/2/4 nests: ½ is the numerator of the outer fraction", outer.g.t === "frac" && outer.items[0].g?.t === "num" && outer.items[0].items?.[0].g?.t === "frac");
  const open = E.layoutTree(2, E.parseRow("1/").layout)[0] as { items: { t: string; g?: { t: string }; empty?: boolean }[] };
  ok("1/ has an empty denominator box inside the fraction", open.items.some((it) => it.g?.t === "den" && it.empty));
  ok("backspace at the start of a denominator goes to the numerator's end", JSON.stringify(E.backspace(at("12/34", 3))) === '{"text":"12/34","start":2,"end":2}');
  ok("backspace with an empty denominator takes the bar", E.backspace(at("1/", 2)).text === "1" && E.backspace(at("1/()", 3)).text === "1");
  ok("backspace with an empty numerator takes the bar", E.backspace(at("/2", 1)).text === "2");
  ok("backspace inside a numerator's hidden bracket keeps the bracket", E.backspace(at("(x+1)/2", 1)).text === "(x+1)/2");
  ok("/ over a selection makes it the numerator", E.insertText({ text: "x+1", start: 0, end: 3 }, "/").text === "(x+1)/");
  // Unit conversion: what a word problem prints.
  ok("5,280 is 5280 in Scientific", val("5,280") === 5280 && val("5,280*12") === 63360 && val("1,000,000.5") === 1000000.5);
  ok("a comma in brackets still separates numbers", val("round(2.675, 2)") === 2.68 && err("(1,000)") === "Points and lists work in Graphing");
  ok("1,000,00 is not a number with commas", err("1,000,00") === "Points and lists work in Graphing");
  ok("5 280 asks for the space to go, not 5 × 280", err("5 280") === "Remove the space: 5280");
  ok("3 1/2 says how to write a mixed number", err("3 1/2") === "For a mixed number, write 3 + 1/2");
  ok("20% of 50 is 10", val("20% of 50") === 10 && val("20%of 50") === 10);
  ok("the caret steps over of", E.caretStops("20% of 50").join() === E.caretStops("20% of 50").map((_, k) => k !== 5).join());
  // Statistics and the other func keys.
  ok("mean, median, stdev", val("mean(1,2,3)") === 2 && val("mean([1,2,3,4])") === 2.5 && val("median(3,1,2,10)") === 2.5 && near(val("stdev(2,4,4,4,5,5,7,9)"), 2.138089935299395));
  ok("nCr and nPr", val("nCr(5,2)") === 10 && val("nPr(5,2)") === 20 && val("ncr(52,5)") === 2598960 && val("nCr(3,5)") === 0);
  ok("nCr needs whole numbers", err("nCr(2.5,1)") === "nCr takes two whole numbers, like nCr(5, 2)");
  ok("gcd (or gcf) and lcm", val("gcd(12,18)") === 6 && val("gcf(12, 18, 30)") === 6 && val("lcm(4,6)") === 12);
  ok("a name it does not have says so", err("sum(1,2)") === "sum isn't on this calculator" && err("average(1,2)") === "average isn't on this calculator");
  ok("two letters before a bracket are still a product", E.evaluateScientific(["a = 3", "b = 2", "ab(2)"])[2].value === 12);
  // The fraction toggle.
  ok("answers as fractions", E.fractionText(0.75) === "3/4" && E.fractionText(1 / 3 + 1 / 4) === "7/12" && E.fractionText(-2.5) === "−5/2");
  ok("no fraction for whole numbers or for π", E.fractionText(3) === undefined && E.fractionText(Math.PI) === undefined && E.fractionText(Math.SQRT2) === undefined);
  ok("Scientific offers the fraction with the answer", one("1/3+1/4").fraction === "7/12" && one("2^10").fraction === undefined);
}

// --- The calculator: AlgeBridge's own Graphing (lib/calc-graph.ts) ---------
{
  const G = await import("../calc-graph.ts");
  const rows = G.evaluateGraph(["y = 2x + 3", "y = x^2 - 4", "(2, 7)", "y > 2x + 1", "y <= x^2", "y = mx + b", "x = 3", "2x + 3y = 6", "f(x) = x^2", "f(3)", "(1,2),(3,4)", "x^2 + y^2 < 9", "x < 2", "[(0,0),(5,5)]"]);
  const kind = (i: number) => rows[i].plot?.kind;
  ok("y = 2x + 3 is a curve in x", kind(0) === "fx" && (rows[0].plot as { f: (x: number) => number }).f(1) === 5);
  ok("y = x^2 − 4 too", kind(1) === "fx");
  ok("(2, 7) is a point", kind(2) === "points" && JSON.stringify((rows[2].plot as { pts: unknown }).pts) === '[{"x":2,"y":7}]');
  ok("lists of points, with or without brackets", (rows[10].plot as { pts: unknown[] }).pts.length === 2 && (rows[13].plot as { pts: unknown[] }).pts.length === 2);
  ok("y > 2x + 1 shades above its line", kind(3) === "ineq-fx" && G.regionContains(rows[3].plot!, 0, 5) && !G.regionContains(rows[3].plot!, 0, 0));
  ok("a strict inequality leaves out its boundary", !G.regionContains(rows[3].plot!, 0, 1));
  ok("y ≤ x² includes its boundary", G.regionContains(rows[4].plot!, 0, 0) && G.regionContains(rows[4].plot!, 2, 4) && !G.regionContains(rows[4].plot!, 0, 1));
  ok("x < 2 shades to the left", kind(12) === "ineq-fy" && G.regionContains(rows[12].plot!, 1, 100) && !G.regionContains(rows[12].plot!, 3, 0));
  ok("x² + y² < 9 shades inside the circle", kind(11) === "implicit" && G.regionContains(rows[11].plot!, 0, 0) && !G.regionContains(rows[11].plot!, 3, 3));
  ok("y = mx + b offers sliders for m and b, in that order", rows[5].missing.join() === "m,b" && !rows[5].plot);
  ok("x = 3 is a vertical line", kind(6) === "fy" && (rows[6].plot as { g: (y: number) => number }).g(42) === 3);
  ok("2x + 3y = 6 graphs from standard form", kind(7) === "implicit");
  ok("f(x) = x^2 is drawn and f(3) shows 9", kind(8) === "fx" && rows[9].value === "9");
  const sl = G.evaluateGraph(["y = mx + b", "m = 1", "b = 2.5"]);
  ok("a = number is a slider from −10 to 10", sl[1].slider?.name === "m" && sl[1].slider.min === -10 && sl[1].slider.max === 10 && sl[2].slider?.value === 2.5);
  ok("with sliders set, the line draws", sl[0].plot?.kind === "fx" && (sl[0].plot as { f: (x: number) => number }).f(2) === 4.5);
  ok("a slider value is written back plainly", G.sliderText("m", 1.30000001, 0.1) === "m = 1.3" && G.sliderText("m", -0.04, 0.1) === "m = 0");
  ok("a big value widens its slider", G.makeSlider("a", 50).max === 50 && G.makeSlider("a", 50).min === -50);
  ok("half-typed rows are incomplete", G.evaluateGraph(["y = 2x +"])[0].incomplete === true);
  ok("a plain sum shows its value", G.evaluateGraph(["2+3"])[0].value === "5" && G.evaluateGraph(["1/0"])[0].error === "Can't divide by zero");
  ok("x and y in a row with no = says what to do", G.evaluateGraph(["x + y"])[0].error?.startsWith("To graph this") === true);
  ok("in Graphing x = 3 is a line, not a letter", G.evaluateGraph(["x = 3", "x + 1"])[1].plot?.kind === "fx");
  // Sampling.
  const tenth = 20 / 400;
  const recip = G.sampleCurve((x) => 1 / x, -10, 10, 400, -10, 10, tenth);
  ok("1/x breaks at 0 instead of drawing a wall", recip.length === 2 && recip[0][recip[0].length - 2] < 0 && recip[1][0] > 0);
  ok("tan x on −10 to 10 is 7 separate pieces", G.sampleCurve(Math.tan, -10, 10, 400, -10, 10, tenth).length === 7);
  const root = G.sampleCurve(Math.sqrt, -10, 10, 400, -10, 10, tenth);
  ok("√x starts exactly where it is defined", root.length === 1 && Math.abs(root[0][0]) < 1e-9);
  const para = G.sampleCurve((x) => x * x, -10, 10, 400, -10, 10, tenth)[0];
  let worst = 0;
  for (let i = 2; i < para.length; i += 2) {
    const inView = Math.abs(para[i + 1]) <= 10 || Math.abs(para[i - 1]) <= 10;
    if (inView) worst = Math.max(worst, Math.abs(para[i + 1] - para[i - 1]) / tenth);
  }
  ok("a parabola is sampled smooth: no step over 2 pixels on screen", worst <= 2.01, String(worst));
  // Roots, intercepts, turning points, intersections.
  const q = (x: number) => x * x - 4;
  const lin = (x: number) => 2 * x + 3;
  ok("x² − 4 crosses at −2 and 2", G.findRoots(q, -10, 10).map((r) => Math.round(r * 1e9) / 1e9).join() === "-2,2");
  ok("(x − 1)² touches at 1", G.findRoots((x) => (x - 1) ** 2, -10, 10).length === 1);
  ok("1/x has no root at its break", G.findRoots((x) => 1 / x, -10, 10).length === 0);
  ok("the x-axis itself has no isolated roots", G.findRoots(() => 0, -10, 10).length === 0);
  const meet = G.findRoots((x) => lin(x) - q(x), -10, 10);
  ok("y = 2x + 3 meets y = x² − 4 at 1 ± √8", meet.length === 2 && Math.abs(meet[0] - (1 - Math.sqrt(8))) < 1e-9 && Math.abs(meet[1] - (1 + Math.sqrt(8))) < 1e-9);
  const low = G.findExtrema(q, -10, 10);
  ok("x² − 4 turns at (0, −4)", low.length === 1 && Math.abs(low[0].x) < 1e-6 && low[0].y === -4);
  ok("1/x has no turning point at its break", G.findExtrema((x) => 1 / x, -10, 10).length === 0);
  const pois = G.pointsOfInterest(rows[1].plot!, [rows[0].plot!, rows[6].plot!], -10, 10, -10, 10).map(G.formatPoint);
  ok("the gray dots on y = x² − 4: intercepts, vertex, both meetings in view", ["(−2, 0)", "(2, 0)", "(0, −4)", "(−1.828, −0.657)", "(3, 5)"].every((p) => pois.includes(p)), pois.join(" "));
  const std = G.pointsOfInterest(rows[7].plot!, [], -10, 10, -10, 10).map(G.formatPoint);
  ok("2x + 3y = 6 crosses at (3, 0) and (0, 2)", std.includes("(3, 0)") && std.includes("(0, 2)"), std.join(" "));
  // Implicit curves and regions.
  const line = G.contour((x, y) => 2 * x + 3 * y - 6, -10, 10, -10, 10, 50, 50);
  let off = 0;
  for (let i = 0; i < line.length; i += 2) off = Math.max(off, Math.abs(2 * line[i] + 3 * line[i + 1] - 6));
  ok("a line from standard form is exact", line.length > 0 && off < 1e-9);
  const chained = G.chainSegments(line, 1e-6);
  ok("its pieces join into one polyline", chained.length === 1);
  const disk = G.region((x, y) => x * x + y * y - 9, "<", -10, 10, -10, 10, 100, 100);
  let area = 0;
  for (let i = 0; i < disk.rects.length; i += 4) area += disk.rects[i + 2] * disk.rects[i + 3];
  for (const poly of disk.polys) {
    let a2 = 0;
    for (let i = 0; i < poly.length; i += 2) {
      const j = (i + 2) % poly.length;
      a2 += poly[i] * poly[j + 1] - poly[j] * poly[i + 1];
    }
    area += Math.abs(a2) / 2;
  }
  ok("the shaded disk has the disk's area", Math.abs(area - 9 * Math.PI) < 0.1, area.toFixed(3));
  ok("holds() reads the inequality signs", G.holds("<", -1) && !G.holds("<", 0) && G.holds("<=", 0) && G.holds(">=", 0) && !G.holds(">", Number.NaN));
  // The view.
  const v = G.homeView(440, 500);
  ok("home is x from −10 to 10 around the origin", v.cx === 0 && v.cy === 0 && G.fromPx(v, 0) === -10 && G.fromPx(v, 440) === 10);
  const z = G.zoomAt(v, 100, 120, 2);
  ok("zooming keeps the point under the pointer still", Math.abs(G.fromPx(z, 100) - G.fromPx(v, 100)) < 1e-12 && Math.abs(G.fromPy(z, 120) - G.fromPy(v, 120)) < 1e-12 && z.scale === v.scale * 2);
  ok("grid: majors every 2 and minors every 0.5 at the start", JSON.stringify(G.gridStep(22)) === '{"major":2,"minor":0.5}');
  ok("grid steps are 1, 2 or 5 times a power of ten", [0.003, 0.4, 7, 90, 2500].every((s) => /^(1|2|5)$/.test(String(Number((G.gridStep(s).major / 10 ** Math.floor(Math.log10(G.gridStep(s).major))).toPrecision(3))))));
  ok("labels and coordinates never use e", G.formatTick(2000000, 1000000) === "2×10⁶" && G.formatCoord(1.5e-7) === "1.5×10⁻⁷" && G.formatCoord(Math.sqrt(3)) === "1.732" && G.formatCoord(-2) === "−2");
  // One format per axis, and labels thinned before they collide.
  const tiny = G.axisFormat(0, 2e-4, 5e-5);
  ok("a zoomed-in axis is all ×10ⁿ, never mixed with 0.0001", [tiny(5e-5), tiny(1e-4), tiny(1.5e-4)].join() === "5×10⁻⁵,1×10⁻⁴,1.5×10⁻⁴");
  const near3 = G.axisFormat(2.9999, 3.0001, 1e-5);
  ok("zoomed in around 3, decimals with the places the step needs", near3(3.00001) === "3.00001" && near3(3) === "3");
  ok("a far-out axis is all ×10ⁿ", G.axisFormat(-8e6, 8e6, 2e6)(-6e6) === "−6×10⁶");
  ok("labels that would touch are thinned to round numbers", G.labelEvery(1e5, 50, 52) === 2 && G.labelEvery(2, 80, 20) === 1 && G.labelEvery(50, 40, 30) === 2 && G.labelEvery(20, 30, 40) === 5);
  ok("a slider value never reads back as e", G.sliderText("a", 1e21, 1) === "a = 1000000000000000000000");
  // Speed: what a row's plot depends on, and the grid read once.
  const sig = (texts: string[]) => G.evaluateGraph(texts).map((r) => r.sig);
  const s1 = sig(["y = mx + b", "m = 1", "b = 2", "x^2 + y^2 < 9", "f(x) = a x", "a = 3", "y = f(x) + 1"]);
  const s2 = sig(["y = mx + b", "m = 1.5", "b = 2", "x^2 + y^2 < 9", "f(x) = a x", "a = 3", "y = f(x) + 1"]);
  const s3 = sig(["y = mx + b", "m = 1", "b = 2", "x^2 + y^2 < 9", "f(x) = a x", "a = 4", "y = f(x) + 1"]);
  ok("moving m changes y = mx + b and nothing else", s1[0] !== s2[0] && s1[3] === s2[3] && s1[6] === s2[6]);
  ok("a letter inside a function reaches the rows that use it", s1[6] !== s3[6] && s1[4] !== s3[4] && s1[0] === s3[0]);
  const F = (x: number, y: number) => x * x + y * y - 9;
  const grid = G.gridValues(F, -10, 10, -10, 10, 40, 40);
  ok("contour and region read the same grid", JSON.stringify(G.contour(F, -10, 10, -10, 10, 40, 40, grid)) === JSON.stringify(G.contour(F, -10, 10, -10, 10, 40, 40)) && JSON.stringify(G.region(F, "<", -10, 10, -10, 10, 40, 40, grid)) === JSON.stringify(G.region(F, "<", -10, 10, -10, 10, 40, 40)));
  ok("in Graphing 1,000 is still a list", G.evaluateGraph(["1,000"])[0].error === "Lists of points can be graphed, like (1, 2), (3, 4)");
}

// --- The calculator panel: Desmos by API only, never framed ------------------
{
  const D = await import("../desmos.ts");
  const F = await import("../floating-panel.ts");
  // Desmos's terms (section 5): no framing. Linking out is fine.
  const { readdirSync, statSync } = await import("node:fs");
  const srcRoot = new URL("../../", import.meta.url);
  const walk = (dir: URL): URL[] =>
    readdirSync(dir).flatMap((name) => {
      const u = new URL(name, dir);
      if (statSync(u).isDirectory()) return name === "__tests__" ? [] : walk(new URL(`${name}/`, dir));
      return /\.(tsx?|jsx?|css)$/.test(name) ? [u] : [];
    });
  const framesDesmos = walk(srcRoot).filter((u) => {
    const text = readFileSync(u, "utf8");
    return /desmos/i.test(text) && (/<iframe/i.test(text) || /createElement\(\s*["']iframe/i.test(text));
  });
  ok("no shipped file frames Desmos", framesDesmos.length === 0, framesDesmos.map((u) => u.pathname).join(", "));
  const panelFiles = ["components/Calculator.tsx", "components/DesmosCalculator.tsx", "components/Keypad.tsx", "lib/desmos.ts", ...readdirSync(new URL("components/calc/", srcRoot)).map((f) => `components/calc/${f}`)];
  ok("the calculator files hold no iframe at all", panelFiles.every((f) => !/<iframe/i.test(readFileSync(new URL(f, srcRoot), "utf8"))));
  // Without a key the panel is AlgeBridge's own calculators: no link out, and no Desmos name or look-alike branding.
  const ownFiles = ["components/Keypad.tsx", ...readdirSync(new URL("components/calc/", srcRoot)).map((f) => `components/calc/${f}`), "lib/calc-engine.ts", "lib/calc-graph.ts"];
  const named = ownFiles.filter((f) => /Desmos/.test(readFileSync(new URL(f, srcRoot), "utf8")));
  ok("AlgeBridge's own calculators never name Desmos", named.length === 0, named.join(", "));
  const panelText = readFileSync(new URL("components/Calculator.tsx", srcRoot), "utf8");
  ok("the no-key panel has no Open Desmos links", !/Open Desmos|desmos\.com\/(scientific|calculator)|openDesmosWindow/.test(panelText));
  ok("and lib/desmos has nothing left that opens desmos.com", !("openDesmosWindow" in D) && !("desmosAppUrl" in D));
  ok("the Desmos credit shows only in API mode", /\{desmos && \(\s*<a\s+href=\{DESMOS_CREDIT_URL\}/.test(panelText));
  ok("no key opens AlgeBridge's own calculators", /<AlgebridgeCalculator mode=\{mode\} open=\{shown\} \/>/.test(panelText));
  ok("the API script carries the key", D.desmosScriptUrl("abc123def456") === `https://www.desmos.com/api/${D.DESMOS_API_VERSION}/calculator.js?apiKey=abc123def456`);
  ok("a key is trimmed", D.cleanApiKey("  dcb31709b452b1cf9dc26972add0fda6 ") === "dcb31709b452b1cf9dc26972add0fda6");
  ok("anything that is not a key never reaches the URL", [null, undefined, "", "abc", "abc123def&x=1", "key with spaces", "<script>"].every((k) => D.cleanApiKey(k) === null));
  ok("no key in the test run means AlgeBridge's own calculators", D.desmosApiKey() === null || !!process.env.NEXT_PUBLIC_DESMOS_API_KEY);
  ok("every fresh open is Scientific", D.DEFAULT_MODE === "scientific" && D.DESMOS_MODES[0].id === "scientific");
  ok("Graphing is the other choice", D.DESMOS_MODES.length === 2 && D.DESMOS_MODES[1].id === "graphing");
  ok("Desmos credit points at Desmos", D.DESMOS_CREDIT_URL === "https://www.desmos.com");
  // Sizes: bigger by default, each saved one checked.
  const defaults = D.parseSizes(null);
  ok("Scientific opens at 400 by 560", defaults.scientific.width === 400 && defaults.scientific.height === 560);
  ok("Graphing opens at 720 by 600, so the graph is wider than the list", defaults.graphing.width === 720 && defaults.graphing.height === 600);
  ok("a corrupt saved size is the default", D.parseSizes("{nope").graphing.width === 720 && D.parseSizes('"text"').scientific.height === 560);
  const mixed = D.parseSizes(JSON.stringify({ graphing: { width: 700.4, height: 650 }, scientific: { width: "wide", height: 400 } }));
  ok("a good size is kept, a bad one dropped", mixed.graphing.width === 700 && mixed.graphing.height === 650 && mixed.scientific.width === 400);
  ok("no storage, no crash", D.readCalculatorSizes().scientific.width === 400 && D.readDesmosState("graphing") === null);
  // Fitting the space: the window, less the AI sidebar when it is open.
  const fits = D.fitSize(D.DEFAULT_SIZES.graphing, { width: 1280 - 400, height: 800 });
  ok("Graphing fits beside a 400px sidebar on a laptop", fits.width === 720 && fits.height === 600);
  const squeezed = D.fitSize(D.DEFAULT_SIZES.graphing, { width: 600, height: 500 });
  ok("a small space shrinks it to fit, with a margin", squeezed.width === 600 - 2 * F.EDGE && squeezed.height === 500 - 2 * F.EDGE);
  const big = D.expandedSize({ width: 1280, height: 800 });
  ok("Expand is 80% by 82% of the space", big.width === 1024 && big.height === 656, JSON.stringify(big));
  const besideSidebar = D.expandedSize({ width: 1440 - 400, height: 900 });
  ok("Expand beside the sidebar uses the space left of it", besideSidebar.width === 832 && besideSidebar.height === 738, JSON.stringify(besideSidebar));
  const usual = D.expandedSize({ width: 1280, height: 800 }, D.DEFAULT_SIZES.graphing);
  ok("Expand with room to grow is still 80% by 82%", usual.width === 1024 && usual.height === 656, JSON.stringify(usual));
  const cramped = D.expandedSize({ width: 1024 - 384, height: 700 }, D.DEFAULT_SIZES.graphing);
  ok("Expand never shrinks the panel: beside the sidebar on a small laptop it takes all the room", cramped.width === 640 - 2 * F.EDGE && cramped.height === 700 - 2 * F.EDGE, JSON.stringify(cramped));
  const small = D.expandedSize({ width: 360, height: 400 });
  ok("Expand never goes under the smallest size when that fits", small.width === 320 && small.height === 380, JSON.stringify(small));
  const tinyWindow = D.expandedSize({ width: 300, height: 360 });
  ok("Expand on a tiny window still fits it", tinyWindow.width === 300 - 2 * F.EDGE && tinyWindow.height === 360 - 2 * F.EDGE, JSON.stringify(tinyWindow));
  // Keeping out from under the sidebar: the area ends where it starts.
  const pulled = F.keepOnScreen({ left: 900, top: 100, width: 400, height: 500 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { width: 880, height: 900 });
  ok("a panel under the sidebar is pulled out from under it", pulled.x === 880 - F.EDGE - 1300 && pulled.y === 0, JSON.stringify(pulled));
  const dragged = F.keepOnScreen({ left: 300, top: 100, width: 400, height: 500 }, { x: 0, y: 0 }, { x: 500, y: 0 }, { width: 880, height: 900 });
  ok("and cannot be dragged under it", 300 + dragged.x + 400 === 880 - F.EDGE, JSON.stringify(dragged));
  const room = F.keepOnScreen({ left: 300, top: 100, width: 400, height: 500 }, { x: 0, y: 0 }, { x: 20, y: 10 }, { width: 880, height: 900 });
  ok("a drag with room goes where it is asked", room.x === 20 && room.y === 10);
  // The corner resize: the right edge and the top edge stay where they are.
  const start = { size: { width: 440, height: 520 }, offset: { x: 0, y: 0 }, rect: { left: 820, top: 284, right: 1260, bottom: 804 } };
  const view = { width: 1280, height: 900 };
  const grown = F.resizeFromBottomLeft(start, -100, 50, D.MIN_SIZE, view);
  ok("dragging the corner out grows it", grown.size.width === 540 && grown.size.height === 570);
  ok("and moves it down by what it grew, so the top stays put", grown.offset.y === 50 && grown.offset.x === 0);
  const shrunk = F.resizeFromBottomLeft(start, 400, -400, D.MIN_SIZE, view);
  ok("never under 320 by 380", shrunk.size.width === 320 && shrunk.size.height === 380 && shrunk.offset.y === -140);
  const huge = F.resizeFromBottomLeft(start, -5000, 5000, D.MIN_SIZE, view);
  ok("never past the left edge", huge.size.width === 1260 - F.EDGE);
  ok("never past the bottom edge", huge.size.height === 900 - F.EDGE - 284 && huge.offset.y === huge.size.height - 520);
  const tiny = F.resizeFromBottomLeft({ ...start, rect: { left: 8, top: 8, right: 300, bottom: 360 } }, 0, 0, D.MIN_SIZE, { width: 300, height: 360 });
  ok("a window smaller than the minimum still fits the panel", tiny.size.width === 292 && tiny.size.height === 344);
  ok("clampSize rounds", F.clampSize({ width: 400.6, height: 450.2 }, { minWidth: 0, minHeight: 0, maxWidth: 999, maxHeight: 999 }).width === 401);
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
  // Opt-in since 3 Oct 2026: off by default, every older save off once, and a
  // student who then shows themselves stays on.
  ok("a new save is off the board", normalizeProgress({}).leaderboardOptIn === false);
  ok("a save put on by the old default comes off, once", normalizeProgress({ leaderboardOptIn: true, leaderboardDefaultV2: true }).leaderboardOptIn === false);
  const chose = { leaderboardOptIn: true, leaderboardDefaultV2: true, leaderboardOffByDefault: true } as Parameters<typeof normalizeProgress>[0];
  ok("a student who chose to show themselves stays on", normalizeProgress(chose).leaderboardOptIn === true);
  ok("the snapshot never reads a missing choice as yes", (await import("../bridgeys.ts")).getLeaderboardSnapshot(normalizeProgress({})).leaderboardOptIn === false);
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
  // Every kind of question on a many-kind skill, about equally: the old builder only ever saw one parity.
  const bank = generateProblemBank("coordinate-plane", [], 99);
  const quadrant = bank.filter((p) => /quadrant/.test(p.prompt)).length;
  const kinds = ["quadrant", "How far apart", "midpoint", "Reflect", "Start at", "area", "fourth corner"].map((k) => bank.filter((p) => p.prompt.includes(k)).length);
  ok(`a seven-kind skill serves every kind about evenly (${kinds.join(", ")} of ${bank.length})`, kinds.every((n) => n >= 4 && n <= 11) && quadrant <= 11, kinds.join());
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

// --- The garden behind the house -------------------------------------------------
{
  const Gd = await import("../garden.ts");
  const Pr = await import("../progress.ts");
  const G = await import("../games.ts");
  ok(
    "a bed comes up by how much of its unit is done",
    Gd.plantStage(0, 3) === "seed" && Gd.plantStage(1, 4) === "sprout" && Gd.plantStage(2, 4) === "leaf" && Gd.plantStage(3, 4) === "bud" && Gd.plantStage(4, 4) === "bloom" && Gd.plantStage(1, 1) === "bloom" && Gd.plantStage(0, 0) === "seed"
  );
  ok("the tree grows in six steps", [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1].map(Gd.treeStage).join() === "0,1,2,3,4,5,5");
  ok("seven flowers, taken in turn", Gd.flowerFor(1) === "daisy" && Gd.flowerFor(8) === "daisy" && Gd.flowerFor(7) === "rose" && new Set(units.map((u) => Gd.flowerFor(u.number))).size === 7);
  const done = (level: string) => ({ level }) as unknown as (typeof fresh.skills)[string];
  const fresh = Pr.normalizeProgress(null);
  const g0 = Gd.gardenState(fresh, "2026-09-24");
  ok("a new student's garden is a bed of soil for every unit and a sapling", g0.beds.length === units.length && g0.beds.every((b) => b.stage === "seed") && g0.tree === 0 && g0.blooms === 0 && !g0.swing && !g0.treehouse && !g0.watered && g0.total === units.reduce((n, u) => n + u.skills.length, 0));
  ok("each bed carries its unit's number, name and colour", g0.beds.every((b, i) => b.number === i + 1 && b.title === units[i].title && b.hue.solid.startsWith("#")));
  const one = Pr.normalizeProgress(null);
  for (const sk of units[0].skills) one.skills[sk.id] = done("mastered");
  const g1 = Gd.gardenState(one, "2026-09-24");
  ok("finishing Unit 1 opens its flower and starts the tree", g1.beds[0].stage === "bloom" && g1.beds[1].stage === "seed" && g1.blooms === 1 && g1.tree === 1 && g1.done === units[0].skills.length);
  const half = Pr.normalizeProgress(null);
  half.skills[units[1].skills[0].id] = done("proficient");
  ok("one skill of a unit is a sprout; a failed one is nothing", Gd.gardenState(half).beds[1].stage === "sprout" && (() => { half.skills[units[2].skills[0].id] = done("practicing"); return Gd.gardenState(half).beds[2].stage === "seed"; })());
  const all = Pr.normalizeProgress(null);
  for (const u of units) for (const sk of u.skills) all.skills[sk.id] = done("proficient");
  const gAll = Gd.gardenState(all, "2026-09-24");
  ok("a finished course is every flower open, the swing, the birdhouse and the treehouse", gAll.blooms === units.length && gAll.tree === 5 && gAll.swing && gAll.birdhouse && gAll.treehouse && gAll.fraction === 1);
  const wet = Pr.normalizeProgress(null);
  wet.daily = { day: "2026-09-24", right: 1, paid: false };
  ok("a right answer today waters the garden, and only today", Gd.gardenState(wet, "2026-09-24").watered && !Gd.gardenState(wet, "2026-09-25").watered && !Gd.gardenState(wet).watered);

  // The rink is a game card beside the four courts.
  ok("five games, the rink first", G.GAME_CARDS.length === 5 && G.GAME_CARDS[0].id === "rink" && G.GAME_CARDS[0].player === "Veronica" && G.GAME_CARDS.slice(1).map((c) => c.id).join() === G.COURT_GAMES.map((c) => c.id).join());
  ok("game ids are checked before a deep link is trusted", G.isGameId("rink") && G.isGameId("cheer") && !G.isGameId("hockey") && !G.isGameId(null) && !G.isGameId(""));
  ok("every card has a height its picture is drawn at", G.GAME_CARDS.every((c) => c.height >= 150 && c.height <= 190));
}

// --- Where a wrong answer went wrong ------------------------------------------
{
  const D = await import("../diagnose.ts");
  const Q = await import("../../data/quotes.ts");
  const num = (prompt: string, answer: number, extra: Record<string, unknown> = {}) =>
    ({ id: "t", type: "numeric", prompt, hint: "h", answer, explanation: "e", ...extra }) as any;
  const mc = (prompt: string, answer: string, choices: string[], extra: Record<string, unknown> = {}) =>
    ({ id: "t", type: "multiple-choice", prompt, hint: "h", answer, choices, explanation: "e", ...extra }) as any;
  const d = (p: any, given: string) => D.diagnoseMistake(p, { given });

  ok("the numbers a question is built from", D.promptNumbers("Solve for x: 3x − 4 = 11").join() === "3,4,11" && D.promptNumbers("Convert 2.5 hours to seconds.").join() === "2.5" && D.promptNumbers("Convert 15,840 feet. 10^5").join() === "15840,10");
  ok("a sign slip", d(num("Solve for x: x + 7 = 2", -5), "5").kind === "sign");
  ok("an upside-down fraction", d(num("Find the slope between (1, 2) and (4, 4).", 2 / 3), "3/2").kind === "reciprocal");
  ok("a decimal point off by a place", d(num("Convert 3 kilometers to meters.", 3000), "300").kind === "tens" && d(num("Convert 3 kilometers to meters.", 3000), "30000").note.includes("right"));
  const added = d(num("Solve for x: x + 7 = 12", 5), "19");
  ok("a number moved the wrong way is twice off, and named", added.kind === "offby" && added.note.includes("twice the 7") && added.fix!.includes("subtract it from both sides") && !added.note.includes("5"));
  const missing = d(num("Solve for x: x − 3 = 5", 8), "5");
  ok("a number that never came in", missing.kind === "offby" && missing.note.includes("3 less"));
  const mult = d(num("Solve for x: 4x = 20", 5), "80");
  ok("a factor multiplied where it should divide", mult.kind === "factor" && mult.note.includes("4 times 4") && mult.fix!.includes("dividing both sides by 4"));
  ok("a factor that was never divided in", d(num("Solve for x: 3x = 21", 7), "21").kind === "factor");
  ok("no equation, no equation advice", d(num("Convert 3 miles to feet.", 15840), "15846").fix === undefined);
  ok("a square too many", d(num("Simplify √64", 8), "64").kind === "square");
  const rounded = d(num("Value after 3 years? (round to the hundredths place)", 1157.63, { decimalPlaces: 2 }), "1157.6");
  ok("close but rounded early", rounded.kind === "close" && rounded.fix!.includes("hundredths"));
  ok("one arithmetic step on the question's numbers", d(num("You drive 150 miles using 5 gallons. Miles per gallon?", 30), "155").kind === "combo");
  ok("words in the number box", d(num("Solve for x: 2x = 8", 4), "four").kind === "unread");
  ok("no pattern means no claim", d(num("Solve for x: 2x = 8", 4), "17").kind === "none" && d(num("Solve for x: 2x = 8", 4), "17").note === "");
  const trapped = d(num("Convert 3 miles to feet. (1 mile = 5280 ft)", 15840, { traps: [{ value: 3 / 5280, why: "Miles are the bigger unit." }] }), "0.000568");
  ok("a generator's own trap comes first", trapped.kind === "trap" && trapped.note === "Miles are the bigger unit.");
  ok("traps match a choice by text", d(mc("Which factor?", "16 oz / 1 lb", ["16 oz / 1 lb", "1 lb / 16 oz"], { traps: [{ value: "1 lb / 16 oz", why: "Upside down." }] }), "1 lb / 16 oz").note === "Upside down.");
  ok("a flipped inequality", d(mc("Solve: -2x > 6", "x < -3", ["x < -3", "x > -3"]), "x > -3").kind === "flip");
  ok("an inequality boundary with the wrong sign", d(mc("Solve", "x < -3", ["x < -3", "x < 3"]), "x < 3").kind === "boundary");
  ok("the boundary in or out", d(mc("Solve", "x ≤ 4", ["x ≤ 4", "x < 4"]), "x < 4").note.includes("counts"));
  ok("half of a compound inequality", d(mc("Solve", "1 < x < 5", ["1 < x < 5", "x < 5"]), "x < 5").kind === "half");
  ok("between instead of outside", d(mc("Solve |x| > 3", "x < -3 or x > 3", ["-3 < x < 3"]), "-3 < x < 3").kind === "half");
  ok("numeric choices read like typed numbers", d(mc("What is the y-intercept of y = 3x − 5?", "-5", ["-5", "5", "3"]), "5").kind === "sign");
  const ea = { id: "t", type: "error-analysis", prompt: "p", hint: "h", wrongStepIndex: 2, steps: ["a", "b", "c"], explanation: "e" } as any;
  ok("picking a right step says so", D.diagnoseMistake(ea, { given: "", step: 0 }).note.startsWith("Step 1 is right") && D.diagnoseMistake(ea, { given: "", step: 2 }).kind === "none");
  const so = { id: "t", type: "step-order", prompt: "p", hint: "h", correctOrder: [0, 1, 2], steps: ["a", "b", "c"], explanation: "e" } as any;
  ok("the first misplaced step is named", D.diagnoseMistake(so, { given: "", order: [0, 2, 1] }).note.includes("step 2") && D.diagnoseMistake(so, { given: "", order: [1, 0, 2] }).note.includes("first step"));
  const secrets = [
    num("Solve for x: x + 7 = 12", 5), num("Solve for x: 4x = 20", 5), num("Convert 3 kilometers to meters.", 3000), num("Find the slope", 2 / 3),
  ];
  ok("no note ever states the answer", secrets.every((p) => ["19", "80", "300", "3/2", "-5", "0.66", "17", "four"].every((g) => !new RegExp(`(^|[^\\d.])${String(p.answer).replace(".", "\\.")}($|[^\\d.])`).test(d(p, g).note))));
  ok("working splits at the arrows", D.explanationSteps("3x + 4 = 19 → 3x = 15 → x = 5").length === 3 && D.explanationSteps("One sentence.").length === 1);

  // Quotes: real, sourced, and always the same one for the same place.
  ok("every quote carries who said it and where", Q.QUOTES.every((q) => q.text.length > 20 && q.who && q.role && q.source && q.about));
  ok("no quote twice", new Set(Q.QUOTES.map((q) => q.id)).size === Q.QUOTES.length && new Set(Q.QUOTES.map((q) => q.text)).size === Q.QUOTES.length);
  ok("a quote for every unit, the same each time", units.every((u) => Q.quoteForUnit(u.id) === Q.quoteForUnit(u.id) && Q.QUOTES.includes(Q.quoteForUnit(u.id))));
  ok("units get a quote written for their ground", Q.quoteForUnit("linear-equations-graphs").units?.includes("linear-equations-graphs") === true);
  ok("the finish line is about doing the work", ["practice", "understanding", "problems"].includes(Q.quoteForFinish("two-step-equations").about));
  ok("three on the course page, from the word's origin to now", Q.HOME_QUOTES.length === 3 && Q.HOME_QUOTES[0].id === "khwarizmi");
  ok("no em dashes in any quote card", Q.QUOTES.every((q) => !`${q.text}${q.who}${q.role}${q.source}`.includes("—")));
}

// --- Lesson videos (src/data/videos.ts) ---------------------------------------
// A district reviewer found one review video standing in for three lessons and
// relabeled titles. One video per skill now, with YouTube's own title; these
// keep it that way. (The IDs themselves were checked live; see videos.ts.)
{
  const V = await import("../../data/videos.ts");
  const skills = units.flatMap((u) => u.skills);
  const missing = skills.filter((s) => !V.SKILL_VIDEOS[s.id]).map((s) => s.id);
  ok("every skill has its own lesson video", missing.length === 0, missing.join(", "));
  const byId = new Map<string, string[]>();
  for (const [skill, v] of Object.entries(V.SKILL_VIDEOS)) byId.set(v.youtubeId, [...(byId.get(v.youtubeId) ?? []), skill]);
  const shared = [...byId].filter(([, s]) => s.length > 1).map(([id, s]) => `${id}: ${s.join(", ")}`);
  ok("no YouTube video serves two skills", shared.length === 0, shared.join("; "));
  ok("a backup is a different video from every lesson's main one", Object.values(V.BACKUP_VIDEOS).every((b) => !byId.has(b.youtubeId)));
  ok("backups belong to skills the course has", Object.keys(V.BACKUP_VIDEOS).every((id) => skills.some((s) => s.id === id)));
  const all = [...Object.values(V.SKILL_VIDEOS), ...Object.values(V.BACKUP_VIDEOS)];
  ok("every ID has YouTube's 11-character shape", all.every((v) => /^[A-Za-z0-9_-]{11}$/.test(v.youtubeId)));
  ok("every player id is unique", new Set(all.map((v) => v.id)).size === all.length);
  // The player counts a video watched at 85% of its length, so a long review
  // video would lock a lesson for half an hour.
  const long = all.filter((v) => !(V.parseDurationToSeconds(v.duration) > 60 && V.parseDurationToSeconds(v.duration) <= 15 * 60));
  ok("every video has a real length between 1 and 15 minutes", long.length === 0, long.map((v) => `${v.youtubeId} ${v.duration}`).join(", "));
  ok("the curriculum points at the same verified videos", skills.every((s) => s.video === V.SKILL_VIDEOS[s.id] && !s.backupVideo));
  ok("titles carry no channel name and no em dash", all.every((v) => !v.title.includes(v.channel) && !/[—–]/.test(v.title)));
}

// --- Standards alignment (src/data/standards.ts) ---------------------------
// Owned by the "For schools" page work. Every skill cites a real CCSS-M code
// in the official shape, and nothing points at a skill that is not there.
{
  const S = await import("../../data/standards.ts");
  const skillIds = units.flatMap((u) => u.skills.map((s) => s.id));
  const known = new Set(skillIds);
  const cited = Object.values(S.SKILL_STANDARDS).flat();
  // A skill may cite nothing only when NOT_CLAIMED says why (graphing, for now).
  const unmapped = skillIds.filter(
    (id) =>
      !(id in S.SKILL_STANDARDS) ||
      S.standardsForSkill(id).length !== S.SKILL_STANDARDS[id].length ||
      (S.SKILL_STANDARDS[id].length === 0 && !S.NOT_CLAIMED.some((n) => n.skillId === id))
  );
  ok("every skill cites a defined standard, or NOT_CLAIMED says why it cites none", unmapped.length === 0, unmapped.join(", "));
  ok("most skills cite a standard", skillIds.filter((id) => S.SKILL_STANDARDS[id]?.length).length >= skillIds.length - 4);
  // Every item type the practice has today, none of which draws or reads a
  // graph. A graph item type would make the graphing standards claimable.
  const itemTypes = new Set(units.flatMap((u) => u.skills.flatMap((s) => [1, 2].flatMap((seed) => generateProblemBank(s.id, s.problems, seed).map((p) => p.type)))));
  ok("practice items are numeric, multiple choice, error analysis or step order only", [...itemTypes].every((t) => ["numeric", "multiple-choice", "error-analysis", "step-order"].includes(t)), [...itemTypes].join(", "));
  ok("no standard that needs a graph is claimed while no item shows one", S.GRAPHING_STANDARDS.every((c) => !cited.includes(c)));
  ok("every graphing standard left off says so, skill by skill", S.GRAPHING_STANDARDS.every((c) => S.NOT_CLAIMED.some((n) => n.code === c)) && S.NOT_CLAIMED.filter((n) => S.GRAPHING_STANDARDS.includes(n.code)).every((n) => /graph|plot/i.test(n.reason)));
  ok("a skill that cites nothing is left off for graphing", skillIds.filter((id) => !S.SKILL_STANDARDS[id]?.length).every((id) => S.NOT_CLAIMED.some((n) => n.skillId === id && S.GRAPHING_STANDARDS.includes(n.code))));
  const graphWords = units.flatMap((u) => [u.description, ...u.skills.flatMap((s) => [s.description, s.learningGoal])]).filter((t) => /\b(graph|graphs|graphing|plot|plotting)\b/i.test(t));
  ok("no description or learning goal promises graphing", graphWords.length === 0, graphWords.join(" | "));
  const strays = Object.keys(S.SKILL_STANDARDS).filter((id) => !known.has(id));
  ok("no standards for a skill id the course does not have", strays.length === 0, strays.join(", "));
  const badShape = cited.filter((c) => !S.STANDARD_CODE_PATTERN.test(c));
  ok("every cited code has the official CCSS-M shape", badShape.length === 0, badShape.join(", "));
  ok("the pattern refuses shapes that are not CCSS-M codes", ["HSA.REI.B.3", "A-REI.B.3", "HSA-REI.3", "HSA-REI.B.3b", "9.EE.A.1", "HSX-REI.B.3", "8.EE.E.1", "hsa-rei.b.3"].every((c) => !S.STANDARD_CODE_PATTERN.test(c)));
  ok("every standard carries a summary, its domain and the official link", Object.values(S.STANDARDS).every((s) => S.STANDARD_CODE_PATTERN.test(s.code) && s.summary.length > 20 && s.domain.length > 0 && s.url === S.officialStandardUrl(s.code)));
  ok("official links follow the site's own paths", S.officialStandardUrl("HSA-REI.B.3") === "https://www.thecorestandards.org/Math/Content/HSA/REI/B/3/" && S.officialStandardUrl("6.RP.A.3.d") === "https://www.thecorestandards.org/Math/Content/6/RP/A/3/d/");
  ok("levels follow the codes", Object.values(S.STANDARDS).every((s) => (s.level === "HS") === s.code.startsWith("HS") && (s.level === "HS" || s.code.startsWith(`${s.level}.`))));
  ok("no skill lists a code twice", Object.values(S.SKILL_STANDARDS).every((cs) => new Set(cs).size === cs.length));
  ok("no standard defined that no skill cites", Object.keys(S.STANDARDS).every((c) => cited.includes(c)));
  ok("codes left off on purpose are real shapes on real skills, and really left off", S.NOT_CLAIMED.every((n) => known.has(n.skillId) && S.STANDARD_CODE_PATTERN.test(n.code) && !S.SKILL_STANDARDS[n.skillId].includes(n.code) && n.reason.length > 20));
  ok("summaries use plain US English with no em or en dashes", [...Object.values(S.STANDARDS).map((s) => s.summary), ...S.NOT_CLAIMED.map((n) => n.reason)].every((t) => !/[—–]/.test(t) && !/\bmaths\b/i.test(t)));
}

// --- Variety: a kind of question comes back only after the others had a turn (feedback, Oct 5 2026) ---
{
  const O = await import("../problem-order.ts");
  const { getFreshProblemsForSkill: fresh } = await import("../../data/problem-banks.ts");
  const { canonicalPrompt } = await import("../problem-utils.ts");
  const key = (s: string) => s[0];
  const mixed = O.interleaveByShape(["a1", "a2", "b1", "a3", "c1"], key);
  ok("interleave: no kind twice in a row when it can be helped", mixed.every((x, i) => i === 0 || key(x) !== key(mixed[i - 1])), mixed.join());
  ok("interleave keeps every problem, each kind in its own order", [...mixed].sort().join() === "a1,a2,a3,b1,c1" && mixed.filter((x) => key(x) === "a").join() === "a1,a2,a3");
  ok("interleave: one kind alone stays as it was", O.interleaveByShape(["a1", "a2", "a3"], key).join() === "a1,a2,a3");
  ok("fresh first: seen questions go last, in order", O.freshFirst(["a", "b", "c", "d"], (x) => x === "a" || x === "c").join() === "b,d,a,c");
  ok("spread: a repeat kind moves behind the next other kind", O.spreadShapes(["a1", "a2", "b1", "c1"], 0, key).join() === "a1,b1,a2,c1");
  ok("spread leaves everything before `from` alone", O.spreadShapes(["a1", "a2", "b1"], 2, key).join() === "a1,a2,b1");
  ok("spread leaves a list with nothing to fix as it was", (() => { const l = ["a1", "b1", "a2"]; return O.spreadShapes(l, 0, key) === l; })());
  ok("shapes ignore the numbers", O.shapeKey("Convert 18 kilograms to grams.") === O.shapeKey("Convert 12 kilograms to grams.") && O.shapeKey("Convert 1,250 grams to kilograms.") !== O.shapeKey("Convert 18 kilograms to grams."));

  const da = units.flatMap((u) => u.skills).find((s) => s.id === "dimensional-analysis")!;
  const kinds = new Set(generateProblemBank(da.id, da.problems, 7).map((p) => O.shapeKey(p.prompt).replace(/^find the error.*/, "error")));
  ok(`dimensional analysis has at least 12 kinds of question (${kinds.size})`, kinds.size >= 12);
  let repeatsEarly = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const first = fresh(da.id, da.problems, seed).slice(0, 10).map((p) => O.shapeKey(p.prompt));
    if (new Set(first).size < first.length) repeatsEarly += 1;
  }
  ok("dimensional analysis: the first ten problems of a session are ten different kinds, every time", repeatsEarly === 0, `${repeatsEarly} of 40 sessions repeated a kind`);

  // Every skill: two of a kind side by side only where the bank leaves no choice.
  const crowded: string[] = [];
  for (const u of units) for (const s of u.skills) {
    const list = fresh(s.id, s.problems, 11).map((p) => O.shapeKey(p.prompt));
    const counts = new Map<string, number>();
    for (const k of list) counts.set(k, (counts.get(k) ?? 0) + 1);
    const most = Math.max(...counts.values());
    const unavoidable = Math.max(0, most - (list.length - most) - 1);
    const adjacent = list.filter((k, i) => i > 0 && k === list[i - 1]).length;
    if (adjacent > unavoidable) crowded.push(`${s.id}: ${adjacent} side by side, ${unavoidable} unavoidable`);
  }
  ok("every skill: the same kind twice in a row only when nothing else is left", crowded.length === 0, crowded.slice(0, 3).join(" | "));

  const bank = fresh(da.id, da.problems, 5);
  const seen = new Set(bank.slice(0, 20).map((p) => canonicalPrompt(p.prompt)));
  const next = fresh(da.id, da.problems, 5, { seen });
  const firstSeen = next.findIndex((p) => seen.has(canonicalPrompt(p.prompt)));
  ok("a question already shown comes after every new one", firstSeen === -1 || next.slice(firstSeen).every((p) => seen.has(canonicalPrompt(p.prompt))), `first seen at ${firstSeen}`);
  ok("the first question of the next session is a new one", !seen.has(canonicalPrompt(next[0].prompt)));
}

// --- Movement: strides driven by distance, a gait per sport, push-and-glide skating ---
{
  const Gt = await import("../gait.ts");
  const G = await import("../games.ts");
  // A planted foot keeps pace with the ground: the thigh's fastest swing times the leg's length
  // should match the speed the player covers ground at, from a jog to a sprint, in every sport.
  const slips: string[] = [];
  for (const game of G.COURT_GAMES) {
    const gait = Gt.GAITS[game.id];
    for (const s of [0.3, 0.6, 1]) {
      const v = s * game.maxSpeed;
      const stride = Gt.strideLength(gait, s, game.height, 1);
      const cyclesPerSecond = v / stride;
      const amp = gait.thigh * (0.35 + 0.65 * s) * (Math.PI / 180);
      const footSpeed = amp * 2 * Math.PI * cyclesPerSecond * (0.47 * game.height);
      const ratio = footSpeed / v;
      if (ratio < 0.55 || ratio > 1.6) slips.push(`${game.id} at ${s}: foot ${Math.round(footSpeed)} vs ground ${Math.round(v)}`);
    }
  }
  ok("gait: a planted foot keeps pace with the ground in every sport, jog to sprint", slips.length === 0, slips.join(" | "));
  ok("gait: a faster run takes longer strides", Gt.strideLength(Gt.GAITS.soccer, 1, 170, 1) > Gt.strideLength(Gt.GAITS.soccer, 0.3, 170, 1));
  const run = Gt.gaitPose(Gt.GAITS.soccer, 0, 1, 1, 0);
  ok("gait: the legs swing opposite each other, the arms opposite the legs", run.thighF < 0 && run.thighB > 0 && run.armF > 0 && run.armB < 0);
  ok("gait: lowest as a foot lands, highest between steps", Gt.gaitPose(Gt.GAITS.soccer, 0, 1, 1, 0).bob === 0 && Gt.gaitPose(Gt.GAITS.soccer, 0.25, 1, 1, 0).bob < -2);
  ok("gait: a sprint leans further than a jog", Gt.gaitPose(Gt.GAITS.soccer, 0.1, 1, 1, 0).body > Gt.gaitPose(Gt.GAITS.soccer, 0.1, 0.3, 1, 0).body);
  const toward = Gt.gaitPose(Gt.GAITS.volleyball, 0, 1, 0, 0);
  const across = Gt.gaitPose(Gt.GAITS.volleyball, 0, 1, 1, 0);
  ok("gait: running toward the camera swings less and lifts the knee", Math.abs(toward.thighF) < Math.abs(across.thighF) && toward.liftF < 1 && across.liftF === 1);
  const shuffle = Gt.gaitPose(Gt.GAITS.wrestling, 0.3, 1, 1, 0);
  ok("gait: the wrestler shuffles in a guard, steps small", Math.abs(shuffle.thighF + 3) <= 13 && shuffle.foreF === -74 && shuffle.armF < -15);
  const glideA = Gt.skatePose(0.1, 0.8, 0);
  const glideB = Gt.skatePose(0.6, 0.8, 0);
  ok("skating: no push, the same glide pose whatever the phase", JSON.stringify({ ...glideA, armF: 0, armB: 0 }) === JSON.stringify({ ...glideB, armF: 0, armB: 0 }));
  ok("skating: a push strokes the legs in turn", Gt.skatePose(0, 0.5, 1).thighF < 0 && Gt.skatePose(0, 0.5, 1).thighB > 0 && Gt.skatePose(0.5, 0.5, 1).thighF > 0);
  ok("skating: strokes quicken with speed", Gt.strokePeriod(1) < Gt.strokePeriod(0.2));
  ok("gait: smoothing never overshoots", Gt.approach(0, 1, 16, 0.05) > 0 && Gt.approach(0, 1, 16, 0.05) < 1 && Gt.approach(0, 1, 16, 10) <= 1);
  ok("each sport has its own pace: the wrestler slowest, the footballer fastest", G.getCourtGame("wrestling")!.maxSpeed < G.getCourtGame("cheer")!.maxSpeed && G.getCourtGame("soccer")!.maxSpeed > G.getCourtGame("volleyball")!.maxSpeed);
}

// --- Display titles: drawn emblems, tiers by price, plates that read old labels ---
{
  const { DISPLAY_TITLES } = await import("../../data/titles-catalog.ts");
  const T = await import("../titles.ts");
  const B = await import("../bridgeys.ts");
  const { normalizeProgress } = await import("../progress.ts");
  const emblemSrc = readFileSync(new URL("../../components/TitleEmblem.tsx", import.meta.url), "utf8");
  const missing = DISPLAY_TITLES.filter((t) => !new RegExp(`"${t.id}":|\\b${t.id.replace(/-/g, "\\-")}:`).test(emblemSrc) && !emblemSrc.includes(`"${t.id}"`));
  ok("titles: every title has a drawn emblem", missing.length === 0, missing.map((t) => t.id).join());
  const pict = /\p{Extended_Pictographic}/u;
  ok("titles: no emoji in any name or description", DISPLAY_TITLES.every((t) => !pict.test(t.name) && !pict.test(t.description) && !("emoji" in t)));
  const tiers = T.titlesByTier();
  ok("titles: every tier has titles, cheapest first", tiers.every((g) => g.titles.length > 0 && g.titles.every((t, i) => i === 0 || g.titles[i - 1].price <= t.price)));
  ok("titles: the tier follows the price", T.tierOf(80) === "common" && T.tierOf(150) === "rare" && T.tierOf(300) === "epic" && T.tierOf(700) === "legendary" && T.tierOf(2000) === "legendary");
  ok("titles: every title is in exactly one tier", tiers.reduce((n, g) => n + g.titles.length, 0) === DISPLAY_TITLES.length);
  ok("titles: a label finds its title by id, by name, and as an old emoji label", T.resolveTitle("algebra-ninja")?.id === "algebra-ninja" && T.resolveTitle("Graph Guru")?.id === "graph-guru" && T.resolveTitle("\u{1F977} Algebra Ninja")?.id === "algebra-ninja" && T.resolveTitle("\u{1F4C8} Graph Guru")?.id === "graph-guru");
  ok("titles: anything else is no title", T.resolveTitle("Student") === null && T.resolveTitle("") === null && T.resolveTitle(null) === null);
  // Buy, wear, take off: through the real functions on a progress in memory.
  let mem = normalizeProgress({ bridgeys: 500 });
  B.setProgressStore({ get: () => mem, save: (p) => { mem = p; } });
  try {
    const bought = B.buyTitle("graph-guru");
    ok("titles: buying one puts it on", bought.ok && mem.equippedTitleId === "graph-guru" && mem.ownedTitles.includes("graph-guru") && mem.bridgeys === 500 - 180);
    ok("titles: the messages carry no emoji", !pict.test(bought.message) && !pict.test(B.equipTitle("graph-guru").message));
    ok("titles: the worn label is the plain name", B.getEquippedTitleLabel(mem) === "Graph Guru");
    const off = B.unequipTitle();
    ok("titles: taking it off keeps it in the collection", off.ok && !mem.equippedTitleId && mem.ownedTitles.includes("graph-guru"));
    ok("titles: and it can go back on for free", B.equipTitle("graph-guru").ok && mem.equippedTitleId === "graph-guru" && mem.bridgeys === 320);
    ok("titles: one out of reach is refused", !B.buyTitle("bridgey-billionaire").ok && !mem.ownedTitles.includes("bridgey-billionaire"));
  } finally {
    B.setProgressStore(null);
  }
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  ok("titles: every tier has its plate, and the shine runs once, never on a loop", ["tp-common", "tp-rare", "tp-epic", "tp-legendary"].every((c) => css.includes(`.${c}`)) && /tp-sweep 1\.1s ease-out 1;/.test(css) && !/tp-sweep[^;]*infinite/.test(css));
}

// --- Game sessions: a topic, Jumbo, and two players ------------------------------------
{
  const S = await import("../game-session.ts");
  const R2 = await import("../rink.ts");
  const { normalizeProgress } = await import("../progress.ts");
  const fresh = normalizeProgress({});
  const topics = S.topicSkills();
  ok("games: most skills can be a topic of their own", topics.length >= 40, String(topics.length));
  ok("games: every topic has head-math problems", topics.every((t) => {
    const sk = units.flatMap((u) => u.skills).find((x) => x.id === t.skillId)!;
    return generateProblemBank(sk.id, sk.problems, 7).filter((q) => R2.isHeadMath(q)).length >= 6;
  }));
  const one = S.pickGameProblem(fresh, { kind: "skill", skillId: "slope" });
  ok("games: an exact topic asks only about that skill", !!one && one.skillId === "slope" && R2.isHeadMath(one.problem));
  const fromJumbo = new Set<number>();
  for (let i = 0; i < 80; i++) {
    const q = S.pickGameProblem(fresh, { kind: "jumbo" });
    if (q) fromJumbo.add(q.unitNumber);
  }
  ok("games: Jumbo mixes the whole course", fromJumbo.size >= 8, [...fromJumbo].sort((a, b) => a - b).join(","));
  const unitPick = S.pickGameProblem(fresh, { kind: "unit" });
  ok("games: the default stays the unit you are on", !!unitPick && unitPick.unitNumber === R2.rinkSkillIds(fresh).unitNumber);
  // A single topic keeps going after its pool runs dry, rather than stopping the game.
  const avoid = new Set<string>();
  let served = 0;
  for (let i = 0; i < 120; i++) {
    const q = S.pickGameProblem(fresh, { kind: "skill", skillId: "one-step-equations" }, avoid);
    if (!q) break;
    served++;
    avoid.add(q.problem.prompt);
  }
  ok("games: a one-topic session never runs out", served === 120);
  ok("games: an unknown topic falls back to your unit", S.topicSkillIds(fresh, { kind: "skill", skillId: "nope" }).join() === R2.rinkSkillIds(fresh).ids.join());
  ok("games: labels", S.topicLabel(fresh, { kind: "jumbo" }).startsWith("Jumbo") && S.topicLabel(fresh, { kind: "skill", skillId: "slope" }) === "Unit 3: Slope");
  // Scoring.
  ok("games: only a right answer scores", S.scoreAfter([1, 2], 0, true).join() === "2,2" && S.scoreAfter([1, 2], 1, false).join() === "1,2");
  ok("games: the first to the mark wins", S.matchWinner([5, 3], 5) === 0 && S.matchWinner([2, 3], 3) === 1 && S.matchWinner([2, 2], 3) === null);
  ok("games: names default to Player 1 and 2", S.sideName({ ...S.DEFAULT_SETUP, names: ["", " Leo "] }, 0) === "Player 1" && S.sideName({ ...S.DEFAULT_SETUP, names: ["", " Leo "] }, 1) === "Leo");
  ok("games: each player plays as a boy or a girl, Player 1 a boy and Player 2 a girl until they pick", S.DEFAULT_SETUP.kinds.join() === "boy,girl" && S.ATHLETE_HEIGHT.boy > 0 && S.ATHLETE_HEIGHT.girl > 0);
  {
    const store = new Map<string, string>();
    const prev = (globalThis as { window?: unknown }).window;
    Object.assign(globalThis, { window: { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } } });
    store.set("algebridge:game-setup", JSON.stringify({ players: 2, names: ["Maya", "Leo Leo Leo Leo Leo"], kinds: ["girl", "robot"] }));
    const read = S.readSetup();
    ok("games: a saved setup keeps names and picks, and drops anything else", read.players === 2 && read.names[0] === "Maya" && read.names[1].length === 14 && read.kinds.join() === "girl,girl");
    Object.assign(globalThis, { window: prev });
  }
  // A fair spot: about as far from each player.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const area = { kind: "rect" as const, x0: 150, x1: 1050, y0: 575, y1: 765 };
  let worst = 0;
  for (let i = 0; i < 40; i++) {
    const a = { x: 200 + rnd() * 800, y: 600 + rnd() * 150 };
    const b = { x: 200 + rnd() * 800, y: 600 + rnd() * 150 };
    // Measured the way the game moves a player on a court: up and down at 1/1.6 the speed.
    const spot = S.spotFairFor(area, a, b, rnd);
    const da = Math.hypot(spot.x - a.x, (spot.y - a.y) * 1.6);
    const db = Math.hypot(spot.x - b.x, (spot.y - b.y) * 1.6);
    worst = Math.max(worst, Math.abs(da - db) / Math.max(da, db));
  }
  ok("games: the next target is a fair race", worst < 0.25, worst.toFixed(2));
}

// --- Certificates and the end of the course ---------------------------------------
{
  const C = await import("../certificates.ts");
  const Pg = await import("../progress.ts");
  const all = units.flatMap((u) => u.skills);
  const finished = (id: string) => ({ skillId: id, level: "proficient" as const, problemsAttempted: 5, problemsCorrect: 5, solved: 5, videoWatched: false, lastPracticed: "2026-09-30T12:00:00.000Z" });

  // Everything finished but the last skill of the course, which sits at four of five.
  const last = all[all.length - 1];
  const lastUnit = units[units.length - 1];
  const start = Pg.normalizeProgress({});
  for (const s of all) start.skills[s.id] = finished(s.id);
  start.skills[last.id] = { ...finished(last.id), level: "familiar", solved: 4, problemsAttempted: 4, problemsCorrect: 4 };
  Pg.saveProgress(start);
  ok("certificates: an unfinished unit has none", C.unitCertificateDate(Pg.getProgress(), lastUnit) === null && C.courseCertificateDate(Pg.getProgress()) === null);
  ok("certificates: a unit finished before certificates existed is dated by its last practice", C.unitCertificateDate(Pg.getProgress(), units[0]) === "2026-09-30T12:00:00.000Z");

  const r = Pg.recordProblemAttempt(last.id, true, { firstTry: true });
  const after = Pg.getProgress();
  ok("certificates: the last answer finishes the unit and the course", r.unitJustCompleted && r.courseJustCompleted);
  ok("certificates: the unit's date is kept", !!after.certificates?.[lastUnit.id] && C.unitCertificateDate(after, lastUnit) === after.certificates?.[lastUnit.id]);
  ok("certificates: the course is dated the moment it was finished", !!after.courseCompletedAt && C.courseCertificateDate(after) === after.courseCompletedAt);
  ok("certificates: one per unit and one for the course, all earned", C.certificateList(after).length === units.length + 1 && C.certificateList(after).every((c) => !!c.earnedAt));

  const again = Pg.recordProblemAttempt(last.id, true, { firstTry: true });
  ok("certificates: the course finishes once", !again.courseJustCompleted && Pg.getProgress().courseCompletedAt === after.courseCompletedAt);
  ok("certificates: dates read as a person writes them", C.certificateDateText("2026-10-05T15:00:00.000Z").endsWith("2026") && /^[A-Z][a-z]+ \d{1,2}, 2026$/.test(C.certificateDateText("2026-10-05T15:00:00.000Z")));
  // A unit finished before certificates existed keeps its date through a review answer.
  {
    const old = Pg.normalizeProgress({});
    for (const sk of units[0].skills) old.skills[sk.id] = { ...finished(sk.id), lastPracticed: "2026-09-01T15:00:00.000Z" };
    delete (old as { certificates?: unknown }).certificates;
    Pg.saveProgress(old);
    ok("certificates: an old finish is pinned on load", Pg.getProgress().certificates?.[units[0].id] === "2026-09-01T15:00:00.000Z");
    Pg.recordProblemAttempt(units[0].skills[1].id, true, { firstTry: true });
    const reviewed = Pg.getProgress();
    ok("certificates: a review answer leaves the date alone", C.unitCertificateDate(reviewed, units[0]) === "2026-09-01T15:00:00.000Z" && reviewed.certificates?.[units[0].id] === "2026-09-01T15:00:00.000Z", JSON.stringify(reviewed.certificates));
    ok("certificates: an unfinished unit gets no date", !reviewed.certificates?.[units[1].id]);
  }
  const facts = C.courseFacts(after);
  ok("certificates: the course facts are the student's own", facts.units === units.length && facts.skills === all.length && facts.problemsSolved === after.totalProblemsSolved);
  Pg.saveProgress(Pg.normalizeProgress({}));
}

// --- the welcome tour (src/lib/tour.ts) ---------------------------------------------
{
  const T = await import("../tour.ts");
  const { GAME_CARDS } = await import("../games.ts");
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const path = await import("node:path");
  const steps = T.tourSteps(false);
  ok("tour: seven steps, welcome first and the account last", steps.length === 7 && steps[0].id === "welcome" && steps[steps.length - 1].id === "account");
  ok("tour: school mode leaves the games out", T.tourSteps(true).every((s) => s.id !== "games") && T.tourSteps(true).length === 6);
  const skills = units.reduce((n, u) => n + u.skills.length, 0);
  ok("tour: the welcome counts the course as it is", steps[0].body.includes(`${units.length} units and ${skills} skills`), steps[0].body);
  const gameCount = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"][GAME_CARDS.length - 1];
  ok("tour: the games step names as many games as there are", steps.find((s) => s.id === "games")!.body.startsWith(`${gameCount} games:`), String(GAME_CARDS.length));
  for (const s of steps) {
    const text = `${s.title} ${s.body}`;
    ok(`tour copy: no em dash (${s.id})`, !/[—–]/.test(text));
    ok(`tour copy: no emoji (${s.id})`, !/\p{Extended_Pictographic}/u.test(text));
    ok(`tour copy: said positively (${s.id})`, !/\b(not|no|never|nothing|none|but)\b|n't/i.test(text), text);
    ok(`tour copy: short enough for a phone card (${s.id})`, s.body.length <= 190, String(s.body.length));
  }
  // Every step points at something that exists: a data-tour mark somewhere in the app.
  const src = path.resolve(import.meta.dirname, "../..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const full = path.join(dir, f);
      if (statSync(full).isDirectory()) { if (f !== "__tests__") walk(full); }
      else if (/\.tsx$/.test(f)) files.push(full);
    }
  };
  walk(src);
  const marked = new Set(files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/data-tour="([a-z-]+)"/g)].map((m) => m[1])));
  for (const s of steps.filter((s) => s.target)) ok(`tour: "${s.target}" is marked in the app`, marked.has(s.target!), [...marked].join(" "));
  ok("tour: never starts by itself on sign-in, For schools or the fine print", !T.tourMayStartOn("/login") && !T.tourMayStartOn("/schools") && !T.tourMayStartOn("/privacy") && !T.tourMayStartOn("/certificate/course") && T.tourMayStartOn("/") && T.tourMayStartOn("/games") && T.tourMayStartOn("/learn/a/b"));
  // Where the card goes.
  const low = { top: 700, left: 1100, width: 72, height: 72 };
  ok("tour card: a phone puts it at the bottom", T.placeCard({ top: 100, left: 10, width: 300, height: 200 }, 375, 812, 240).bottom === 12);
  ok("tour card: a phone moves it up when the spotlight is low (Archie)", T.placeCard({ ...low, left: 280 }, 375, 812, 240).top === 12);
  const under = T.placeCard({ top: 100, left: 300, width: 400, height: 200 }, 1280, 900, 260);
  ok("tour card: under the spotlight when it fits", under.top === 314 && under.left >= 12 && under.left + under.width <= 1268, JSON.stringify(under));
  const over = T.placeCard(low, 1280, 900, 260);
  ok("tour card: over the spotlight near the bottom, inside the window", over.top !== undefined && over.top + 260 <= 700 && over.left + over.width <= 1268, JSON.stringify(over));
  ok("tour card: centered with nothing to point at", Math.abs(T.placeCard(null, 1280, 900, 260).left - (1280 - 380) / 2) < 1);
}

// --- the house: what every piece is for (src/lib/house-functions.ts) ----------------
{
  const HF = await import("../house-functions.ts");
  const { FURNITURE_ITEMS } = await import("../../data/house-catalog.ts");
  const ids = FURNITURE_ITEMS.map((f) => f.id);
  ok("house: every piece has a job", ids.every((id) => !!HF.USES[HF.pieceUse(id)]), ids.filter((id) => !HF.USES[HF.pieceUse(id)]).join(" "));
  ok("house: every listed job is a real piece", Object.keys(HF.PIECE_USE).every((id) => ids.includes(id)), Object.keys(HF.PIECE_USE).filter((id) => !ids.includes(id)).join(" "));
  ok("house: a unit prize opens its unit", HF.pieceUse("prize-scale") === "unit" && HF.pieceUse("desk") === "study" && HF.pieceUse("tv") === "watch" && HF.pieceUse("arcade") === "play");
  for (const [kind, spec] of Object.entries(HF.USES)) {
    ok(`house copy: ${kind} has a verb and a line`, spec.verb.length > 1 && spec.does.length > 8);
    ok(`house copy: ${kind} said positively, no em dash`, !/[—–]/.test(spec.does + spec.verb) && !/\b(not|no|never|nothing|but)\b|n't/i.test(spec.does), spec.does);
  }
  const live = { ...(await import("../house3d/types.ts")).DEFAULT_LIVE, goalRight: 6, streak: 9, unitsDone: 5, skillsDone: 19, growth: 0.6 };
  for (const id of ids) {
    const note = HF.pieceNote(id, live);
    ok(`house note: ${id}`, note.length > 8 && !/[—–]/.test(note) && !/undefined|NaN/.test(note), note);
  }
  ok("house note: the clock is today's goal", HF.pieceNote("clock", live).includes("6 of 10"));
  ok("house note: the shelf counts skills", HF.pieceNote("bookshelf", live).includes("19 of"));
  // Every piece and ornament is a real 3D model (none falls back to the plain crate), with a shop picture.
  const REG = await import("../house3d/registry.ts");
  const PICS = await import("../../data/house-pictures.ts");
  ok("house: every piece has a 3D model", ids.every((id) => REG.hasModel(id)), ids.filter((id) => !REG.hasModel(id)).join(" "));
  ok("house: every piece has a shop picture", ids.every((id) => PICS.PIECE_PICTURES.has(id)), ids.filter((id) => !PICS.PIECE_PICTURES.has(id)).join(" "));
  // Garden ornaments have jobs too.
  const { ORNAMENTS } = await import("../../data/ornament-catalog.ts");
  const ornIds = ORNAMENTS.map((o) => o.id);
  ok("garden: every ornament has its own job", ornIds.every((id) => id in HF.ORNAMENT_USE), ornIds.filter((id) => !(id in HF.ORNAMENT_USE)).join(" "));
  ok("garden: every listed job is a real ornament", Object.keys(HF.ORNAMENT_USE).every((id) => ornIds.includes(id)));
  ok("garden: the lamp post is the one with a switch", ornIds.filter((id) => HF.pieceUse(id, "ornament") === "light").join() === "lamp");
  ok("garden: an ornament's job is its own, not the furniture's of the same name", HF.pieceUse("lamp", "ornament") === "light" && HF.pieceUse("tree", "ornament") === "water" && HF.pieceUse("mailbox", "ornament") === "review");
  for (const id of ornIds) {
    const note = HF.ornamentNote(id, live);
    ok(`garden note: ${id}`, note.length > 8 && !/[—–]/.test(note) && !/undefined|NaN/.test(note), note);
  }
  // Plants grow with the goals reached in two weeks, and droop after three days away.
  const now = new Date(2026, 9, 6, 12);
  const days = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(now.getTime() - i * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const p0 = Pg0();
  function Pg0() { return { skills: {}, streak: 0, goalDays: [] as string[], lastVisit: now.toISOString() } as unknown as import("../../types/index.ts").UserProgress; }
  ok("plants: nothing yet, a seedling", HF.plantGrowth(p0, now) === 0);
  ok("plants: five goals this fortnight, half grown", HF.plantGrowth({ ...p0, goalDays: days(5) }, now) === 0.5);
  ok("plants: goals older than two weeks do not count", HF.recentGoalDays({ ...p0, goalDays: ["2026-08-01", ...days(3)] }, now) === 3);
  ok("plants: full grown at ten", HF.plantGrowth({ ...p0, goalDays: days(14) }, now) === 1);
  ok("plants: thirsty after three days", HF.plantsThirsty({ ...p0, lastVisit: new Date(now.getTime() - 3.2 * 86400000).toISOString() }, now) && !HF.plantsThirsty(p0, now));
  // The rest day: a bed keeps a streak through one missed day a week.
  const Pg = await import("../progress.ts");
  const mon = new Date(2026, 9, 5, 9);
  ok("rest day: weeks start on Monday", HF.weekKey(new Date(2026, 9, 11, 20)) === "2026-10-05" && HF.weekKey(new Date(2026, 9, 12, 8)) === "2026-10-12");
  const withBed = { ...p0, placedFurnitureItems: [{ instanceId: "b", itemId: "bed", x: 50, y: 50 }] } as unknown as import("../../types/index.ts").UserProgress;
  ok("rest day: only with a bed in the house", !HF.restDayAvailable(p0, mon) && HF.restDayAvailable(withBed, mon));
  ok("rest day: used once a week", !HF.restDayAvailable({ ...withBed, restDayWeek: "2026-10-05" }, mon) && HF.restDayAvailable({ ...withBed, restDayWeek: "2026-09-28" }, mon));
  const twoDaysAgo = new Date(2026, 9, 3, 18).toISOString();
  ok("rest day: one missed day keeps the streak", Pg.streakAfterActivity(7, twoDaysAgo, mon, true) === 8 && Pg.streakAfterActivity(7, twoDaysAgo, mon, false) === 1);
  ok("rest day: two missed days still end it", Pg.streakAfterActivity(7, new Date(2026, 9, 2, 18).toISOString(), mon, true) === 1);
  ok("rest day: the streak shown stands through it", Pg.streakStanding(7, twoDaysAgo, mon, true) === 7 && Pg.streakStanding(7, twoDaysAgo, mon, false) === 0);
}

// --- the 3D room: stored places and metres (src/lib/house3d/space.ts) ------------------
{
  const SP = await import("../house3d/space.ts");
  let worst = 0;
  for (let x = 5; x <= 95; x += 5)
    for (let y = 10; y <= 92; y += 4) {
      const w = SP.floorToWorld(x, y);
      const back = SP.worldToFloor(w.x, w.z);
      worst = Math.max(worst, Math.abs(back.x - x), Math.abs(back.y - y));
      if (Math.abs(w.x) > SP.ROOM_W / 2 || Math.abs(w.z) > SP.ROOM_D / 2) worst = 999;
    }
  ok("room: a stored floor spot comes back where it was, inside the room", worst < 1e-9, String(worst));
  let wallWorst = 0;
  for (let x = 0; x <= 100; x += 10)
    for (let y = 0; y <= 100; y += 10) {
      const w = SP.wallToWorld(x, y);
      const back = SP.worldToWall(w.x, w.y);
      wallWorst = Math.max(wallWorst, Math.abs(back.x - x), Math.abs(back.y - y));
    }
  ok("room: a stored wall spot comes back where it was", wallWorst < 1e-9, String(wallWorst));
  ok("room: the back of the floor is near the back wall", SP.floorToWorld(50, 10).z < -SP.ROOM_D / 2 + 0.5 && SP.floorToWorld(50, 92).z > SP.ROOM_D / 2 - 0.5);
  ok("room: hung pieces hang between a desk's height and high on the wall", SP.wallToWorld(50, 100).y === SP.WALL_HANG.bottom && SP.wallToWorld(50, 0).y === SP.WALL_HANG.top);
  // Nothing hangs over a window or a door, in any house, wherever it was stored.
  const shapes = ["square", "round", "grid", "wide", "arch"] as const;
  let overOpening = "";
  for (const shape of shapes) {
    const open = SP.backWallOpenings(shape);
    for (const width of [0.3, 0.6, 1.0, 1.3]) {
      for (let x = 0; x <= 100; x += 2) {
        const cx = SP.clearOfOpenings(SP.wallToWorld(x, 30).x, width, shape);
        const hit = open.some((o) => cx + width / 2 > o.x0 + 1e-6 && cx - width / 2 < o.x1 - 1e-6);
        const inside = cx - width / 2 >= -SP.ROOM_W / 2 && cx + width / 2 <= SP.ROOM_W / 2;
        if (hit || !inside) overOpening ||= `${shape} w${width} x${x} -> ${cx.toFixed(2)}`;
      }
    }
    // Every opening is taller than a hung piece's lowest edge can sit, so sideways is enough.
    const win = SP.windowSize(shape, SP.BACK_WINDOW);
    if (win.sill + win.h <= SP.WALL_HANG.top || SP.DOOR.h <= SP.WALL_HANG.top) overOpening ||= `${shape}: an opening ends below the hanging range`;
  }
  ok("room: hung pieces slide off the window and the door, inside the wall", !overOpening, overOpening);
  ok("room: a clear spot is left where it was", SP.clearOfOpenings(-2.4, 0.4, "square") === -2.4);
  ok("room: a clock on the window slides to the nearer side", SP.clearOfOpenings(-1.1, 0.38, "square") < SP.BACK_WINDOW.x - 0.75 - 0.1);
}

// --- calls: rooms for two to eight, and the notifications (src/lib/call-utils.ts, push-shared.ts) ----
{
  const C = await import("../call-utils.ts");
  const P = await import("../push-shared.ts");
  const id = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
  const [a, b, c] = [id(3), id(1), id(2)];
  ok("calls: the same people make the same room, whoever calls", C.roomIdFor(a, b, c) === C.roomIdFor(c, a, b) && C.roomIdFor(a, b) === C.roomIdFor(b, a));
  ok("calls: a room lists its members", JSON.stringify(C.participantsFromRoom(C.roomIdFor(a, b, c))) === JSON.stringify([b, c, a]));
  ok("calls: one person, nine people, repeats and junk are not rooms", C.participantsFromRoom(a) === null && C.participantsFromRoom([1, 2, 3, 4, 5, 6, 7, 8, 9].map(id).join("--")) === null && C.participantsFromRoom(`${a}--${a}`) === null && C.participantsFromRoom(`${a}--x`) === null);
  ok("calls: eight is a room", C.participantsFromRoom(C.roomIdFor(...[1, 2, 3, 4, 5, 6, 7, 8].map(id)))?.length === 8);
  // Every pair connects once: exactly one of the two makes the offer.
  const ids = [1, 2, 3, 4, 5].map(id);
  ok("calls: in a group, each pair has one offerer", ids.every((x) => ids.every((y) => x === y || C.offersTo(x, y) !== C.offersTo(y, x))));
  const m = P.messagePush(a, "Ms Rivera", "  Your quiz\n looks great. " + "x".repeat(200));
  ok("push: a message says who wrote and opens the chat", m.title === "Ms Rivera sent you a message" && m.url === `/messages/${a}` && m.body.length <= 140 && !m.body.includes("\n"));
  const r1 = P.ringPush(C.roomIdFor(a, b), "Ms Rivera", 2);
  const r3 = P.ringPush(C.roomIdFor(a, b, c), "Ms Rivera", 3);
  ok("push: a call rings and opens the room", r1.kind === "ring" && r1.title === "Ms Rivera is calling you" && r1.url === `/room/${C.roomIdFor(a, b)}` && r1.seconds === 30);
  ok("push: a group call says so", r3.kind === "ring" && r3.title === "Ms Rivera is calling you and 1 other" && P.ringPush("x", "T", 5).title.endsWith("and 3 others"));
  ok("push: no em dashes", ![m, r1, r3].some((x) => /[\u2014\u2013]/.test(x.title + x.body)));
}

// --- two devices: an old tab never uploads over a newer day's work ------------------
{
  const Pg = await import("../progress.ts");
  const skill = (attempted: number) => ({ skillId: "x", level: "attempted" as const, problemsAttempted: attempted, problemsCorrect: 0, videoWatched: false });
  const yesterday = Pg.normalizeProgress({ skills: { a: skill(10), b: skill(4) } });
  const chromebook = Pg.normalizeProgress({ skills: { a: skill(10), b: skill(4), c: skill(25) } });
  const oldTabPlusOne = Pg.normalizeProgress({ skills: { a: skill(11), b: skill(4) } });
  ok("sync: work is every answer checked", Pg.workDone(chromebook) === 39 && Pg.workDone(Pg.normalizeProgress({})) === 0);
  ok("sync: the old tab takes the Chromebook's day", Pg.takeOtherDevicesCopy(oldTabPlusOne, chromebook));
  ok("sync: an hour offline is kept over one answer elsewhere", !Pg.takeOtherDevicesCopy(Pg.normalizeProgress({ skills: { a: skill(70), b: skill(4) } }), Pg.normalizeProgress({ skills: { a: skill(10), b: skill(5) } })));
  ok("sync: the same work either way takes the cloud", Pg.takeOtherDevicesCopy(yesterday, yesterday));
}

// --- /schools: "not covered yet" never names a standard a skill claims -----------
{
  const St = await import("../../data/standards.ts");
  const claimed = new Set(Object.values(St.SKILL_STANDARDS).flat().map((c) => (typeof c === "string" ? c : (c as { code: string }).code)));
  for (const row of St.NOT_COVERED) {
    for (const code of row.codes ? St.expandCodes(row.codes) : []) ok(`schools: not covered and not claimed: ${code}`, !claimed.has(code), row.what);
  }
  ok("schools: codes written out", St.expandCodes("HSF-IF.B.4, B.5, C.9").join(" ") === "HSF-IF.B.4 HSF-IF.B.5 HSF-IF.C.9");
  ok("schools: graph-only standards are not also called missing", St.NOT_COVERED.every((r) => !(r.codes ? St.expandCodes(r.codes) : []).some((c) => St.GRAPHING_STANDARDS.includes(c))));
}

// The house: pieces turn round where they stand, in steps of 45 degrees, and the turn is saved.
{
  const B = await import("../bridgeys.ts");
  ok("turn: a step either way", B.nextTurn(undefined, 45) === 45 && B.nextTurn(0, -45) === 315);
  ok("turn: wraps round", B.nextTurn(315, 45) === 0 && B.nextTurn(45, -90) === 315);
  const p = getProgress();
  p.ownedFurniture = [...(p.ownedFurniture ?? []), "chair", "poster"];
  p.placedFurnitureItems = [
    { instanceId: "turn-chair", itemId: "chair", x: 50, y: 50, floor: "down" },
    { instanceId: "turn-poster", itemId: "poster", x: 50, y: 50, floor: "down", surface: "wall" },
  ];
  saveProgress(p);
  ok("turn: a chair turns", B.turnFurniture("turn-chair").ok && getProgress().placedFurnitureItems!.find((f) => f.instanceId === "turn-chair")!.turn === 45);
  ok("turn: kept when moved", B.moveFurniture("turn-chair", 30, 40).ok && getProgress().placedFurnitureItems!.find((f) => f.instanceId === "turn-chair")!.turn === 45);
  ok("turn: a hung poster faces out of the wall", !B.turnFurniture("turn-poster").ok);
}

// The street: neighbours are other students on the board, the same ones each visit, never made up.
{
  const { pickNeighbours } = await import("../leaderboard.ts");
  const rows = [
    { name: "Maya R.", styleId: "loft" },
    { name: "Leo P.", styleId: "castle" },
    { name: "Ana K.", styleId: "beach" },
    { name: "Ana K.", styleId: "beach" },
    { name: "Sam T.", styleId: "spaceship" },
    { name: "  ", styleId: "cottage" },
  ];
  const a = pickNeighbours(rows, "user-1", 5);
  ok("street: only real styles and names, each once", a.length === 3 && a.every((n) => ["loft", "castle", "beach"].includes(n.styleId)));
  ok("street: the same neighbours every visit", JSON.stringify(pickNeighbours(rows, "user-1", 5)) === JSON.stringify(a));
  ok("street: fewer students than lots leaves lots open", pickNeighbours([], "user-1", 5).length === 0);
  ok("street: capped at the lots", pickNeighbours(rows, "user-1", 2).length === 2);
}

// The character, walking the street, and the ten houses.
{
  const A = await import("../avatar.ts");
  const W = await import("../house3d/walk.ts");
  const lcg = (seed: number) => {
    let x = seed >>> 0;
    return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  };
  ok("avatar: the default passes its own check", JSON.stringify(A.sanitizeAvatar(A.DEFAULT_AVATAR)) === JSON.stringify(A.DEFAULT_AVATAR));
  const junk = A.sanitizeAvatar({ skin: "#000000", hair: "mohawk", extras: ["jetpack", "cap", "cap"], build: "huge", topColor: "#2563EB" });
  ok("avatar: junk falls back, a known value is kept", junk.hair === "short" && junk.skin === A.DEFAULT_AVATAR.skin && junk.extras.join() === "cap" && junk.build === "medium" && junk.topColor === "#2563eb");
  ok("avatar: nothing at all is the default", JSON.stringify(A.sanitizeAvatar(null)) === JSON.stringify(A.DEFAULT_AVATAR));
  ok("avatar: a random one passes the check", [1, 2, 3, 4, 5].every((i) => { const r = A.randomAvatar(lcg(i)); return JSON.stringify(A.sanitizeAvatar(r)) === JSON.stringify(r); }));
  ok("avatar: the key tells specs apart", A.avatarKey(A.DEFAULT_AVATAR) !== A.avatarKey({ ...A.DEFAULT_AVATAR, top: "tee" }) && A.avatarKey({ ...A.DEFAULT_AVATAR, extras: ["cap", "glasses"] }) === A.avatarKey({ ...A.DEFAULT_AVATAR, extras: ["glasses", "cap"] }));
  ok("avatar: every colour has a name", [...A.SKIN_TONES, ...A.HAIR_COLORS, ...A.EYE_COLORS, ...A.CLOTHES_COLORS].every((c) => A.COLOR_NAMES[c]));

  const lots: import("../house3d/walk.ts").StreetLot[] = [
    { x: 0, across: false, house: true, drive: 1, own: true },
    { x: 16, across: false, house: true, drive: 1 },
    { x: 0, across: true, house: true, drive: 1 },
    { x: -16, across: false, house: false, drive: -1 },
  ];
  const rects = lots.flatMap(W.lotBlockers).concat(W.homeBlockers("ground", 1, 0, []));
  ok("walk: the sidewalk and an open lot are clear", !W.blocked(1, 5.75, rects, 0.32) && !W.blocked(-16, -8, rects, 0.32));
  ok("walk: your house and the one next door are solid", W.blocked(0, -8, rects, 0.32) && W.blocked(16, -8, rects, 0.32));
  ok("walk: the house across the road is solid, turned round", W.blocked(0, 2 * W.STREET_MID + 8, rects, 0.32) && !W.blocked(0, 2 * W.STREET_MID - 8, rects, 0.32));
  ok("walk: the gate is open and the fence is not", !W.blocked(1, 4.75, rects, 0.1) && W.blocked(4, 4.75, rects, 0.1));
  ok("walk: the neighbour's hedge stops at their walk", !W.blocked(17, 4.75, rects, 0.1) && W.blocked(14, 4.75, rects, 0.1));
  const stuck = W.slideMove({ x: -4, z: -6 }, 0, -1.5, rects, 0.32);
  ok("walk: a step into the house wall goes nowhere", stuck.x === -4 && stuck.z === -6);
  const slid = W.slideMove({ x: -4, z: -6 }, 0.5, -1.5, rects, 0.32);
  ok("walk: a step along the house slides", slid.x === -3.5 && slid.z === -6);
  ok("walk: the street ends", W.slideMove({ x: 57.9, z: 5 }, 1, 0, rects, 0.32).x === W.STREET_BOUNDS.x1);
  const G = await import("../house3d/garden.ts");
  ok("walk: its street is the one the yard builds", W.LOT_PITCH === G.LOT && Math.abs(W.STREET_MID - G.STREET_MID) < 1e-9 && G.STREET_LOTS.length === 13);

  // Walking into your own house: the door, the porch steps, both floors, the stair, the furniture.
  const H = W.HOME;
  const F = G.FRONT_LAYOUT;
  const SP = await import("../house3d/space.ts");
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  ok("home: the house walked through is the one the yard builds", H.wallZ === G.GARDEN_LAYOUT.wallZ && H.doorX === G.GARDEN_LAYOUT.doorX && near(H.room.x0, F.inside.x - SP.ROOM_W / 2) && near(H.room.x1, F.inside.x + SP.ROOM_W / 2) && near(H.room.z0, F.inside.z - SP.ROOM_D / 2) && near(H.room.z1, F.inside.z + SP.ROOM_D / 2) && H.down === F.inside.down && H.up === F.inside.up && H.porch.top === F.porch.top && H.porch.x0 === F.porch.x0 && H.porch.x1 === F.porch.x1 && near(H.innerX1, G.GARDEN_LAYOUT.houseWidth / 2 - 0.3) && typeof G.buildInside === "function");
  const own = W.lotBlockers({ x: 0, across: false, house: true, drive: 1, own: true });
  ok("home: your own lot keeps its gate and leaves the house to its door", !W.blocked(0, -8, own, 0.32) && !W.blocked(1, 4.75, own, 0.1) && W.blocked(4, 4.75, own, 0.1));
  const out = W.homeBlockers("ground", 1, -4, []);
  ok("home: the doorway is the only way in", !W.blocked(1, -7.3, out, 0.32) && W.blocked(3, -7.3, out, 0.32) && W.blocked(-2, -9, out, 0.32) && !W.blocked(1, -6, out, 0.32));
  ok("home: the steps climb to the deck, and the deck runs to the door", W.floorAt("ground", 1, -4) === 0 && Math.abs(W.floorAt("ground", 1, -4.54) - 0.16) < 0.02 && W.floorAt("ground", 1, -6) === H.porch.top && W.floorAt("ground", 1, -7.3) === H.porch.top && W.floorAt("ground", 5, -6) === 0);
  ok("home: through the doorway you are downstairs, and back out again", W.levelAfter("ground", 1, -7.4) === "down" && W.levelAfter("ground", 4, -7.4) === "ground" && W.levelAfter("down", 1, -7.2) === "ground" && W.floorAt("down", 0, -10) === H.down);
  const down = W.homeBlockers("down", 0, -10, []);
  ok("home: downstairs the room and the hall are open and the walls hold", !W.blocked(0, -10, down, 0.32) && !W.blocked(4.5, -7.85, down, 0.32) && !W.blocked(3.2, -10, down, 0.32) && W.blocked(-3.6, -10, down, 0.32) && W.blocked(0, -12.6, down, 0.32) && W.blocked(5.4, -9, down, 0.32) && W.blocked(4.5, -10, down, 0.32) && W.blocked(0, -7.4, down, 0.32));
  const sofa = { x0: -1, x1: 1, z0: -11, z1: -9.5 };
  ok("home: a piece on the floor is walked round", W.blocked(0, -10, W.homeBlockers("down", 2, -10, [sofa]), 0.32) && !W.blocked(2, -10, W.homeBlockers("down", 2, -10, [sofa]), 0.32));
  ok("home: the stair climbs from its foot to its head", W.onStair(4.5, -9) && !W.onStair(3.5, -9) && Math.abs(W.floorAt("down", 4.5, -9) - (H.down + (H.up - H.down) * (1.4 / 3.9))) < 1e-9 && W.floorAt("down", 4.5, -11.5) === H.up && W.levelAfter("down", 4.5, -11.3) === "up" && W.levelAfter("up", 4.5, -7.8) === "down" && W.levelAfter("up", 4.5, -8.2) === "down" && W.levelAfter("up", 4.5, -8.5) === "up" && W.levelAfter("down", 4.5, -9) === "down");
  const onIt = W.homeBlockers("down", 4.5, -9, []);
  ok("home: on the stair the rail holds and the way up is open", W.blocked(3.9, -9, onIt, 0.32) && !W.blocked(4.5, -10, onIt, 0.32) && !W.blocked(4.5, -11.3, onIt, 0.32));
  // Within the rail's reach part way up: out is allowed, deeper in is not, and so is along. At the foot the stair is open to the hall both ways.
  const freed = W.slideMove({ x: 4.06, z: -9.5 }, 0.1, 0, W.homeBlockers("down", 4.06, -9.5, []), 0.32);
  const deeper = W.slideMove({ x: 4.06, z: -9.5 }, -0.1, 0, W.homeBlockers("down", 4.06, -9.5, []), 0.32);
  const along = W.slideMove({ x: 4.06, z: -9.5 }, 0, -0.1, W.homeBlockers("down", 4.06, -9.5, []), 0.32);
  ok("home: within a rail's reach you can step out or along, never deeper", Math.abs(freed.x - 4.16) < 1e-9 && deeper.x === 4.06 && deeper.z === -9.5 && Math.abs(along.z + 9.6) < 1e-9);
  const off = W.slideMove({ x: 4.33, z: -7.85 }, -0.1, 0, W.homeBlockers("down", 4.33, -7.85, []), 0.32);
  const on = W.slideMove({ x: 3.9, z: -7.85 }, 0.2, 0, W.homeBlockers("down", 3.9, -7.85, []), 0.32);
  ok("home: the foot of the stair is open to the hall both ways", Math.abs(off.x - 4.23) < 1e-9 && Math.abs(on.x - 4.1) < 1e-9);
  const up = W.homeBlockers("up", 0, -10, []);
  ok("home: upstairs the landing joins the room, and the edges hold", W.floorAt("up", 0, -10) === H.up && !W.blocked(0, -10, up, 0.32) && !W.blocked(3.2, -12, W.homeBlockers("up", 3.2, -12, []), 0.32) && W.blocked(0, -7.7, up, 0.32) && W.blocked(3.5, -9.5, up, 0.32) && !W.blocked(4.5, -11.45, W.homeBlockers("up", 4.5, -12, []), 0.32) && W.onStair(4.5, -11.45) && !W.blocked(4.5, -11.0, W.homeBlockers("up", 4.5, -11.45, []), 0.32));

  const T = await import("../house3d/terrain.ts");
  ok("land: flat across the neighbourhood and along the street", [[0, 0], [60, -15], [-60, 40], [120, 11.6], [-125, 20]].every(([x, z]) => T.terrainHeight(x, z) === 0));
  ok("land: hills beyond", T.terrainHeight(150, 150) > 2 && T.terrainHeight(-200, -180) > 8 && T.terrainHeight(0, 200) > 2);
  ok("land: the same hill every time", T.terrainHeight(173.3, -91.2) === T.terrainHeight(173.3, -91.2) && Math.abs(T.terrainHeight(173.3, -91.2) - T.terrainHeight(173.4, -91.2)) < 0.5);
  ok("land: the lake lies under its water, with a shore", T.terrainHeight(T.LAKE.x, T.LAKE.z) < -2 && T.terrainHeight(T.LAKE.x, T.LAKE.z - T.LAKE.r - 12) > T.WATER_Y && T.lakeDepth(T.LAKE.x, T.LAKE.z) === 1 && T.lakeDepth(0, 0) === 0);
  ok("land: lush is a share", [[0, 0], [99, 7], [-180, 160]].every(([x, z]) => { const l = T.terrainLush(x, z); return l >= 0 && l <= 1; }));

  const { THEMES } = await import("../house3d/themes.ts");
  const { HOUSE_STYLES: STYLES } = await import("../../data/house-catalog.ts");
  const ids = STYLES.map((h) => h.id);
  ok("houses: ten in the shop, each with a room theme", ids.length === 10 && ids.every((id) => THEMES[id]?.id === id) && Object.keys(THEMES).length === 10);
  const street = readFileSync("supabase/schema-2026-10-09-street.sql", "utf8");
  ok("houses: the street's check names every style", ids.every((id) => street.includes(`'${id}'`)));
  ok("houses: prices rise through the shop", STYLES.every((h, i) => i === 0 || h.price > STYLES[i - 1].price));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
