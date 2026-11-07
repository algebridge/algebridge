import assert from "node:assert/strict";
import { checkAnswer, looksMisread, misreadLines, lineForQuestion, parseImages, readerVerdict, skillsToPractice } from "@/lib/test-review";

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
