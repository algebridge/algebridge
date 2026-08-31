import {
  classifyIntent, parseArithmetic, arithmeticReply, forbiddenValues,
  leaksAnswer, advanceScheduler, isYes, isNo,
} from "../helper.ts";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; } else { fail++; console.log("  FAIL:", name, extra); }
};

// --- the student must never be handed the answer -------------------------
for (const q of [
  "what's the answer", "just tell me the answer", "give me the answer",
  "solve it for me", "do this for me", "what does x equal",
  "please show me the solution", "answer this",
]) ok(`refuses: "${q}"`, classifyIntent(q) === "answer_request", `-> ${classifyIntent(q)}`);

// --- the arithmetic exception, and only that ------------------------------
for (const [q, expected] of [
  ["what is 4728 / 12", "4728 / 12 = 394"],
  ["347 x 89", "347 x 89 = 30883"],
  ["1024 divided by 32", "1024 / 32 = 32"],
  ["what's 96 times 45", "96 x 45 = 4320"],
] as const) {
  const a = parseArithmetic(q);
  ok(`computes: "${q}"`, !!a && arithmeticReply(a) === expected, `-> ${a ? arithmeticReply(a) : "null"}`);
}

// times tables and non-arithmetic stay teaching moments
for (const q of ["what is 7 x 8", "12 times 12", "solve 2x + 3 = 11", "what is 5 + 9",
                 "what is x / 4", "144 / 12"])
  ok(`does not compute: "${q}"`, parseArithmetic(q) === null, `-> ${JSON.stringify(parseArithmetic(q))}`);

// --- the post-filter catches a model that leaks --------------------------
const ctx = { problemPrompt: "Solve 3x + 6 = 27", explanation: "Subtract 6 to get 3x = 21, then divide by 3 so x = 7." };
const forbidden = forbiddenValues(ctx);
ok("forbidden excludes numbers already in the problem", !forbidden.includes("3") && !forbidden.includes("6") && !forbidden.includes("27"), JSON.stringify(forbidden));
ok("forbidden includes the solution", forbidden.includes("7") && forbidden.includes("21"), JSON.stringify(forbidden));
ok("blocks a leaking reply", leaksAnswer("Nice work, x = 7 is right.", forbidden));
ok("blocks the intermediate too", leaksAnswer("So you get 3x = 21.", forbidden));
ok("allows a clean reply", !leaksAnswer("Undo the +6 first. What do both sides become?", forbidden));
ok("does not trip on a substring", !leaksAnswer("Try problem 70 next.", forbidden), "70 must not match 7");

// decimal boundaries must survive the fix
ok("does not trip inside a decimal", !leaksAnswer("about 3.21 units", forbidden), "3.21 must not match 21");
ok("still blocks a bare decimal answer", leaksAnswer("you get 7, done", forbidden));
ok("blocks at end of string", leaksAnswer("the value is 21", forbidden));

// --- the booking conversation --------------------------------------------
ok("yes", isYes("yeah") && isYes("Sure") && !isYes("nope"));
ok("no", isNo("no thanks") && isNo("nah") && !isNo("yes"));
let s = advanceScheduler({ step: "offered" }, "yes");
ok("offered -> awaiting_time", s.step === "awaiting_time");
s = advanceScheduler(s, "Tuesday after 4");
ok("captures the time", s.step === "awaiting_tutor" && s.freeText === "Tuesday after 4", JSON.stringify(s));
s = advanceScheduler(s, "Zachary");
ok("captures the tutor", s.step === "done" && s.tutorName === "Zachary", JSON.stringify(s));
const anyone = advanceScheduler({ step: "awaiting_tutor" }, "anyone");
ok("anyone leaves it unassigned", anyone.step === "done" && anyone.tutorName === undefined, JSON.stringify(anyone));
ok("declining stops it", advanceScheduler({ step: "offered" }, "no thanks").step === "declined");

// --- escalation ----------------------------------------------------------
for (const q of ["i still don't get it", "can i talk to a person", "i need a tutor",
                 "this isn't helping", "i'm completely lost", "i need more help"])
  ok(`escalates: "${q}"`, classifyIntent(q) === "escalate", `-> ${classifyIntent(q)}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
