import { MOOD_GAP_MS, MOOD_MIN_ACTIVE_MS, moodAllowedOn, moodContext, moodDueAfter, parseInsightBeacon, rpcArgs } from "../insights.ts";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; } else { fail++; console.log("  FAIL:", name, extra); }
};

const v = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";

// --- a good beacon goes through, lower-cased and bounded --------------------
const a = parseInsightBeacon({ v, role: "student", name: "problem_attempt", skill: "Solving-One-Step", unit: "linear-equations", course: "algebra-1", label: "numeric", value: 22.26, ok: true, first: false, n: 2 });
ok("attempt parses", !!a && a.visitor === v.toLowerCase() && a.skill === "solving-one-step" && a.value === 22.3 && a.ok === true && a.first === false && a.n === 2, JSON.stringify(a));
ok("rpc args use the database names", !!a && rpcArgs(a).p_skill === "solving-one-step" && rpcArgs(a).p_n === 2 && rpcArgs(a).p_visitor === v.toLowerCase());

// --- what is refused ---------------------------------------------------------
ok("no visitor", parseInsightBeacon({ name: "mood", value: 3 }) === null);
ok("bad visitor", parseInsightBeacon({ v: "nope", name: "mood", value: 3 }) === null);
ok("unknown name", parseInsightBeacon({ v, name: "hack" }) === null);
ok("free text in a label", parseInsightBeacon({ v, name: "mood", value: 3, label: "I hate this" }) === null);
ok("long label", parseInsightBeacon({ v, name: "mood", value: 3, label: "a".repeat(61) }) === null);
ok("negative seconds", parseInsightBeacon({ v, name: "skill_time", value: -4 }) === null);
ok("huge seconds", parseInsightBeacon({ v, name: "skill_time", value: 1e9 }) === null);
ok("ok must be boolean", parseInsightBeacon({ v, name: "problem_attempt", ok: "yes" }) === null);
ok("mood needs 1 to 5", parseInsightBeacon({ v, name: "mood", value: 6 }) === null && parseInsightBeacon({ v, name: "mood", value: 0 }) === null && parseInsightBeacon({ v, name: "mood", value: 2.5 }) === null);
ok("mood needs a value", parseInsightBeacon({ v, name: "mood" }) === null);
ok("mood 4 passes", parseInsightBeacon({ v, name: "mood", value: 4, label: "practice" })?.value === 4);
ok("array is not a beacon", parseInsightBeacon([1]) === null && parseInsightBeacon("x") === null && parseInsightBeacon(null) === null);

// --- role falls back to guest ------------------------------------------------
ok("unknown role is guest", parseInsightBeacon({ v, name: "archie_open", role: "owner" })?.role === "guest");
ok("missing role is guest", parseInsightBeacon({ v, name: "archie_open" })?.role === "guest");
ok("teacher stays teacher", parseInsightBeacon({ v, name: "archie_open", role: "teacher" })?.role === "teacher");
ok("missing fields are null", (() => { const b = parseInsightBeacon({ v, name: "archie_open" }); return !!b && b.skill === null && b.value === null && b.ok === null && b.n === null; })());

// --- where a mood was asked ----------------------------------------------------
ok("skill page is practice", moodContext("/learn/linear-equations/solving-one-step?x=1") === "practice" && moodContext("/unit/exponents") === "practice");
ok("games", moodContext("/games") === "games" && moodContext("/arena/abc") === "games");
ok("house", moodContext("/house") === "house");
ok("messages are social", moodContext("/messages/123") === "social" && moodContext("/tutor-hub") === "social");
ok("home", moodContext("/") === "home");
ok("other", moodContext("/profile") === "other");
ok("no card on a call or the console", !moodAllowedOn("/room/abc") && !moodAllowedOn("/admin") && !moodAllowedOn("/login") && !moodAllowedOn("/teacher/classes"));
ok("card allowed on a skill page", moodAllowedOn("/learn/linear-equations/solving-one-step") && moodAllowedOn("/games"));

// --- when the card is due --------------------------------------------------------
const now = 1_800_000_000_000;
ok("never asked: due after 4 min plus a random wait", (() => { const d = moodDueAfter(null, now, () => 0); return d === MOOD_MIN_ACTIVE_MS; })());
ok("random wait is at most 10 min", (() => { const d = moodDueAfter(null, now, () => 0.999999); return d !== null && d < MOOD_MIN_ACTIVE_MS + 10 * 60 * 1000; })());
ok("asked an hour ago: not due", moodDueAfter(now - 60 * 60 * 1000, now) === null);
ok("asked seven hours ago: due", moodDueAfter(now - MOOD_GAP_MS - 1000, now) !== null);

console.log(`insights: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
