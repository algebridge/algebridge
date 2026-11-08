import assert from "node:assert/strict";
import { checkAnswer, cleanTranscript, plainMath, takeScore, looksMisread, misreadLines, lineForQuestion, parseImages, readerVerdict, skillsToPractice } from "@/lib/test-review";
import { parseReaders } from "@/lib/test-review-read";

let checks = 0;
const ok = (cond: boolean, msg: string) => { assert.ok(cond, msg); checks++; };
const eq = <T>(a: T, b: T, msg: string) => { assert.deepEqual(a, b, msg); checks++; };

// Answers code can check: a wrong model answer must come back false.
const cases: [string, string, boolean | null][] = [
  ["Solve the equation 7x + 5 = 3x - 9.", "-2", false], ["Solve the equation 7x + 5 = 3x - 9.", "x = -3.5", true], ["Solve 7x + 5 = 3x - 9", "-7/2", true],
  ["Solve -3y + 7 = 1", "y = 2", true], ["Solve 4(t - 3) = 20", "t = 8", true], ["Solve x/3 + 1 = 4", "9", true],
  ["Solve for x: 5x - 4 = 2x + 11", "x = 5", true], ["Solve: 2(x - 3) = 10", "x = 8", true], ["Solve: 2(x - 3) = 10", "x = 6.5", false],
  ["Find the slope of the line passing through the points (5, 2) and (1, -6).", "2", true], ["Find the slope through (1,2) and (3,3)", "1", false],
  ["Find the slope of the line through (2, 3) and (6, 11)", "m = 2", true],
  ["What is the y‑intercept of the line y = -3x + 7?", "7", true], ["What is the slope of the line y = -4x + 9?", "-4", true],
  ["Find the y-intercept of the line y = (3/4)x - 2.", "-2", true], ["Graph the line y = (1/3)x - 2 and state its y-intercept.", "-2", true],
  ["Write the equation of a line with slope -2 that passes through (0, 5).", "y = -2x + 5", null],
  // Inequalities are not equations: never judged by plugging in.
  ["Solve the inequality: -3x > 12", "x < -4", null],
];
for (const [p, a, want] of cases) eq(checkAnswer(p, a), want, `${p} => ${a}`);

// Garbled lines, and the reader's own tags that are not garbling.
ok(looksMisread("2) Write y=wmx + b y==x+4x"), "== is garbled");
ok(looksMisread("5) Graph y = x/2 - |, b=1 X"), "| is garbled");
ok(!looksMisread("1) Find the slope of (2,3) and (6,11) m =2"), "clean line");
ok(!looksMisread("4) Solve 5x − 3 = 2x + 9"), "unicode minus is fine");
ok(!looksMisread("2) Solve 5x - 4 = 2x + 11   student wrote: x = 7/3   [marked wrong] [-2 points]"), "reader tags are fine");
ok(!looksMisread("3) [unreadable]   student wrote: [name] 4"), "unreadable and name tags are fine");
eq(misreadLines("a\n\nb==c\nok"), [3], "line numbers are 1-based and skip blanks");
eq(lineForQuestion("Quiz\n1) a\n2) b == c", "2"), "2) b == c", "finds the line for a question");
eq(lineForQuestion("Quiz\n1) a", "12"), null, "no line for a question not there");

// What the photo reader said.
eq(readerVerdict("NOT_A_TEST"), { kind: "not-a-test" }, "not a test");
eq(readerVerdict("  not a test.\n"), { kind: "not-a-test" }, "not a test, loosely");
eq(readerVerdict("UNREADABLE"), { kind: "unreadable" }, "unreadable");
eq(readerVerdict("[unreadable]\n[unreadable]"), { kind: "unreadable" }, "all holes is unreadable");
eq(readerVerdict("Score: 14/20\n1) 3x + 7 = 22   student wrote: x = 5\n2) [unreadable]   student wrote: 4"), { kind: "text", text: "Score: 14/20\n1) 3x + 7 = 22   student wrote: x = 5\n2) [unreadable]   student wrote: 4", unreadableParts: 1 }, "transcript with one hole");

// Reader output, made plain for the check screen.
eq(plainMath("1) \\(\\frac{x}{3} + 2 = 5\\)"), "1) x/3 + 2 = 5", "inline fraction");
eq(plainMath("\\frac{x+1}{2} = \\dfrac{3}{4}"), "(x+1)/2 = 3/4", "compound numerator keeps brackets");
eq(plainMath("x = \\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}"), "x = (-b ± sqrt(b^2-4ac))/(2a)", "nested root in a fraction");
eq(plainMath("2^{n+1} \\cdot 3 \\times 4 \\div 2"), "2^(n+1) * 3 * 4 / 2", "powers and operators");
eq(plainMath("x \\leq 4 \\text{ and } x \\neq 2"), "x ≤ 4 and x ≠ 2", "relations and text");
eq(plainMath("   &x = 9 \\\\"), "   x = 9", "alignment and line breaks go");
eq(plainMath("\\left( x \\right)"), "( x )", "left and right go");
eq(plainMath("\\frac{2}{3}x = \\frac{4}{5}"), "(2/3)x = 4/5", "a fraction times x keeps its brackets");
eq(plainMath("2\\*3 = 6, 8 \\cdot x^{6}"), "2*3 = 6, 8 * x^6", "escaped star and a grader's LaTeX");
eq(plainMath("2x + 3 = 11"), "2x + 3 = 11", "plain math is untouched");
eq(cleanTranscript("1) \\(\\frac{x}{3} + 2 = 5\\)\n   student wrote: \n   \\[\n   \\begin{aligned}\n   &\\frac{x}{3} = 3 \\\\\n   &x = 9\n   \\end{aligned}\n   \\]\n   [marked right]"),
  "1) x/3 + 2 = 5\n   student wrote:\n   x/3 = 3\n   x = 9\n   [marked right]", "a LaTeX block becomes plain lines");
eq(cleanTranscript("1) x^3 * x^4 = x^7\n   student wrote: √\n2) (2x^2)^3 = 6x^6\n   student wrote: ×"),
  "1) x^3 * x^4 = x^7\n   student wrote: [marked right]\n2) (2x^2)^3 = 6x^6\n   student wrote: [marked wrong]", "a lone tick or cross is the teacher's mark");
eq(cleanTranscript("3) 2 × 4 = 9"), "3) 2 × 4 = 9", "a times sign inside math stays");
ok(misreadLines(cleanTranscript("\\(\\frac{2}{3}x = \\frac{4}{5}\\)")).length === 0, "cleaned LaTeX is not flagged as garbled");
eq(takeScore("Score: 14/20\n1) a"), { text: "1) a", score: "14/20" }, "score line moves to the score box");
eq(takeScore("1) a\nScore:"), { text: "1) a", score: null }, "an empty score line goes");
eq(takeScore("Score: 3/4\n1) a\nScore: 2/4"), { text: "1) a\nScore: 2/4", score: "3/4" }, "only the first score is taken");
eq(takeScore("1) Find the score: 3x"), { text: "1) Find the score: 3x", score: null }, "a question that says score stays");

// Extra free readers from VISION_FALLBACKS: only well-formed ones, keys never inline.
const cf = { name: "cloudflare", url: "https://api.cloudflare.com/client/v4/accounts/abc/ai/v1/chat/completions", keyEnv: "CLOUDFLARE_AI_TOKEN", model: "@cf/meta/llama-4-scout-17b-16e-instruct" };
eq(parseReaders(JSON.stringify([cf])), [{ ...cf, maxTokens: undefined }], "a good reader is kept");
eq(parseReaders(undefined), [], "nothing set, no readers");
eq(parseReaders("not json"), [], "bad JSON, no readers");
eq(parseReaders(JSON.stringify({ name: "x" })), [], "not a list, no readers");
eq(parseReaders(JSON.stringify([{ ...cf, url: "http://evil.example/v1" }])), [], "plain http to another host is refused");
eq(parseReaders(JSON.stringify([{ ...cf, url: "http://127.0.0.1:11434/v1/chat/completions", keyEnv: undefined }])).length, 1, "a reader on this machine is allowed for tests");
eq(parseReaders(JSON.stringify([{ ...cf, keyEnv: "gsk_secret_value" }]))[0].keyEnv, undefined, "a key pasted in place of a variable name is not used");
eq(parseReaders(JSON.stringify([{ ...cf, name: "groq" }])), [], "a reader cannot take a built-in name");
eq(parseReaders(JSON.stringify([cf, cf])).length, 1, "the same name twice is kept once");
eq(parseReaders(JSON.stringify([{ ...cf, maxTokens: 99999 }]))[0].maxTokens, 4000, "reply budget is capped");

// Photo limits.
const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
eq(parseImages([jpeg])?.length, 1, "one jpeg");
eq(parseImages([jpeg, jpeg, jpeg, jpeg, jpeg, jpeg, jpeg]), null, "seven is too many");
eq(parseImages([]), null, "none is too few");
eq(parseImages(["data:image/gif;base64,R0lGOD"]), null, "gif is refused");
eq(parseImages(["https://example.com/a.jpg"]), null, "a url is refused");
eq(parseImages([`data:image/png;base64,${"A".repeat(6 * 1024 * 1024)}`]), null, "over 4 MB is refused");

// Which skills to practice.
const q = (status: "correct" | "wrong" | "partial" | "unclear", skill: string | null) => ({ status, skill });
eq(skillsToPractice([q("correct", "a"), q("wrong", "b"), q("partial", "c"), q("wrong", "b"), q("unclear", "d")]), ["b", "c"], "missed skills, in test order, no repeats");
eq(skillsToPractice([q("wrong", "b")], ["e", "b"]), ["b", "e"], "the model's skills join the missed ones");
eq(skillsToPractice([q("correct", "a"), q("correct", "b"), q("unclear", null)]), ["a", "b"], "a clean test practices what it covered");
eq(skillsToPractice([q("wrong", null)]), [], "nothing to practice without a skill");
eq(skillsToPractice([q("wrong", "a"), q("wrong", "b"), q("wrong", "c"), q("wrong", "d"), q("wrong", "e")]), ["a", "b", "c", "d"], "at most four");

console.log(`test-review: ${checks} checks passed`);
