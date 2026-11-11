import { activityLine, cleanDetail, firstNameOf, mixNames, nameKey, nextMoment, parseActivityRow, sameMoment, seededRand, withArticle } from "../activity.ts";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; } else { fail++; console.log("  FAIL:", name, extra); }
};

// --- the words ---------------------------------------------------------------
const line = (kind: Parameters<typeof activityLine>[0]["kind"], amount: number | null = null, detail: string | null = null) =>
  activityLine({ name: "Ava", kind, amount, detail });
ok("solved", line("solved").rest === "solved a problem");
ok("bridgeys", line("bridgeys", 25).rest === "earned 25 Bridgeys");
ok("one bridgey", line("bridgeys", 1).rest === "earned 1 Bridgey");
ok("bridgeys without a number still reads", line("bridgeys").rest === "earned 1 Bridgey");
ok("skill", line("skill", null, "Two-Step Equations").rest === "finished Two-Step Equations");
ok("skill without a title", line("skill").rest === "finished a lesson");
ok("unit", line("unit", null, "Unit 3: Linear Equations").rest === "finished Unit 3: Linear Equations");
ok("bought a", line("bought", null, "Lava Lamp").rest === "bought a Lava Lamp");
ok("bought an", line("bought", null, "Arcade Cabinet").rest === "bought an Arcade Cabinet");
ok("bought the", line("bought", null, "The Loft").rest === "bought The Loft");
ok("game", line("game", null, "Bat with Liam").rest === "played Bat with Liam");
ok("name comes back apart", line("solved").name === "Ava");
ok("no name", activityLine({ name: "", kind: "solved", amount: null, detail: null }).name === "Someone");
ok("article helper", withArticle("owl") === "an owl" && withArticle("bed") === "a bed" && withArticle("") === "");

// --- first names ---------------------------------------------------------------
ok("first of First Last", firstNameOf("Jordyn Harwood") === "Jordyn");
ok("one name", firstNameOf("Shaurya") === "Shaurya");
ok("accents and apostrophes", firstNameOf("Zoë O'Neil") === "Zoë" && firstNameOf("D'Angelo Ray") === "D'Angelo");
ok("spaces trimmed", firstNameOf("  Ava   Lee ") === "Ava");
ok("empty", firstNameOf("") === "" && firstNameOf(null) === "" && firstNameOf(undefined) === "");
ok("digits are not a name", firstNameOf("xX_mathgod") === "" && firstNameOf("1234 Smith") === "");
ok("too long", firstNameOf("A".repeat(31)) === "");

// --- details ---------------------------------------------------------------------
ok("title passes", cleanDetail("Two-Step Equations") === "Two-Step Equations");
ok("unit title with colon", cleanDetail("Unit 3: Linear Equations & Inequalities") === "Unit 3: Linear Equations & Inequalities");
ok("whitespace squeezed", cleanDetail("  Lava   Lamp ") === "Lava Lamp");
ok("too long is cut then checked", cleanDetail("A".repeat(60)) === "A".repeat(48));
ok("markup refused", cleanDetail("<b>hi</b>") === null && cleanDetail("a;b") === null);
ok("empty refused", cleanDetail("") === null && cleanDetail(null) === null);

// --- rows from the database ---------------------------------------------------------
const good = parseActivityRow({ id: 12, at: "2026-11-02T15:00:00Z", first_name: "Ava", kind: "bridgeys", amount: 25, detail: null });
ok("good row", !!good && good.id === 12 && good.name === "Ava" && good.kind === "bridgeys" && good.amount === 25 && good.detail === null);
ok("string id", parseActivityRow({ id: "7", first_name: "Ava", kind: "solved" })?.id === 7);
ok("unknown kind", parseActivityRow({ id: 1, first_name: "Ava", kind: "hacked" }) === null);
ok("no name", parseActivityRow({ id: 1, first_name: "", kind: "solved" }) === null);
ok("full name is cut to the first", parseActivityRow({ id: 1, first_name: "Ava Lee", kind: "solved" })?.name === "Ava");
ok("odd amount dropped", parseActivityRow({ id: 1, first_name: "Ava", kind: "solved", amount: -3 })?.amount === null);
ok("odd detail dropped", parseActivityRow({ id: 1, first_name: "Ava", kind: "skill", detail: "<script>" })?.detail === null);
ok("not an object", parseActivityRow(null) === null && parseActivityRow([1]) === null && parseActivityRow("x") === null);

// --- the same moment twice ------------------------------------------------------------
const echo = { id: -1, at: "2026-11-02T15:00:00Z", name: "Ava", kind: "solved" as const, amount: null, detail: null };
ok("echo and row match", sameMoment(echo, { ...echo, id: 40, at: "2026-11-02T15:00:20Z" }));
ok("a minute and a half apart is another moment", !sameMoment(echo, { ...echo, id: 40, at: "2026-11-02T15:02:00Z" }));
ok("another kind", !sameMoment(echo, { ...echo, id: 40, kind: "bridgeys", amount: 5 }));
ok("another student", !sameMoment(echo, { ...echo, id: 40, name: "Liam" }));

// --- names mixed up ---------------------------------------------------------------------
const mk = (id: number, name: string) => ({ id, at: "2026-11-02T15:00:00Z", name, kind: "solved" as const, amount: null, detail: null });
// Newest first, the way the pool holds them: runs of the same student.
const clumped = [mk(1, "Ava"), mk(2, "Ava"), mk(3, "Ava"), mk(4, "Liam"), mk(5, "Liam"), mk(6, "Noor"), mk(7, "Noor"), mk(8, "Ava"), mk(9, "Sam"), mk(10, "Sam")];
let sameNeighbours = 0, lostOrDuplicated = 0, changed = 0;
for (let seed = 1; seed <= 200; seed++) {
  const mixed = mixNames(clumped, seededRand(seed));
  for (let i = 1; i < mixed.length; i++) if (mixed[i].name === mixed[i - 1].name) sameNeighbours++;
  if (mixed.map((m) => m.id).sort((a, b) => a - b).join() !== clumped.map((m) => m.id).join()) lostOrDuplicated++;
  if (mixed.map((m) => m.id).join() !== clumped.map((m) => m.id).join()) changed++;
}
ok("mixed: no name twice in a row (200 shuffles)", sameNeighbours === 0, `${sameNeighbours} repeats`);
ok("mixed: every moment kept, once each", lostOrDuplicated === 0);
ok("mixed: the order really changes", changed > 150, `${changed} of 200`);
ok("mixed: same seed, same order", mixNames(clumped, seededRand(7)).map((m) => m.id).join() === mixNames(clumped, seededRand(7)).map((m) => m.id).join());
ok("mixed: input list untouched", clumped.map((m) => m.id).join() === "1,2,3,4,5,6,7,8,9,10");
ok("mixed: empty and single", mixNames([]).length === 0 && mixNames([mk(1, "Ava")]).length === 1);
let startsWithAfter = 0;
for (let seed = 1; seed <= 200; seed++) if (mixNames(clumped, seededRand(seed), "Ava")[0].name === "Ava") startsWithAfter++;
ok("mixed: first one is not the name just shown", startsWithAfter === 0, `${startsWithAfter} of 200`);
const oneStudent = [mk(1, "Ava"), mk(2, "Ava"), mk(3, "Ava")];
ok("mixed: one student only still returns all", mixNames(oneStudent, seededRand(3)).length === 3);
const busy = [mk(1, "Ava"), mk(2, "Ava"), mk(3, "Ava"), mk(4, "Ava"), mk(5, "Liam")];
ok("mixed: a student with most moments keeps them all", mixNames(busy, seededRand(5)).filter((m) => m.name === "Ava").length === 4);
ok("seeded random stays in 0..1", (() => { const r = seededRand(42); for (let i = 0; i < 1000; i++) { const v = r(); if (!(v >= 0 && v < 1)) return false; } return true; })());

// --- names compared without case or accents ----------------------------------------------
ok("name key", nameKey("José") === "jose" && nameKey("ANA") === "ana" && nameKey("Aña") === "ana");
const cased = [mk(1, "Ana"), mk(2, "ana"), mk(3, "ANA"), mk(4, "Liam"), mk(5, "liam"), mk(6, "Noor")];
let casedRepeats = 0;
for (let seed = 1; seed <= 200; seed++) {
  const m = mixNames(cased, seededRand(seed));
  for (let i = 1; i < m.length; i++) if (nameKey(m[i].name) === nameKey(m[i - 1].name)) casedRepeats++;
}
ok("mixed: Ana, ana and ANA are one student", casedRepeats === 0, `${casedRepeats} repeats`);

// --- the next moment: new ones first, then the mixed round, no repeats at the seams ------------
const names = ["Ava", "Liam", "Noor", "Sam", "Ivy", "Max"];
const mkPool = (n: number) => Array.from({ length: n }, (_, i) => mk(100 - i, names[(i * 7 + (i >> 1)) % names.length]));
let calm = 0, calmSteps = 0;
{
  const q = { fresh: [] as ReturnType<typeof mk>[], pool: mkPool(40), round: [] as ReturnType<typeof mk>[], lastName: "" };
  const r = seededRand(11);
  let prev = "";
  for (let i = 0; i < 5000; i++) {
    const it = nextMoment(q, r)!;
    if (prev && nameKey(it.name) === prev) calm++;
    prev = nameKey(it.name); calmSteps++;
  }
}
ok("next: no name twice in a row over 5000 steps, rounds included", calm === 0, `${calm} repeats in ${calmSteps}`);
ok("next: nothing to show", nextMoment({ fresh: [], pool: [], round: [], lastName: "" }) === null);
{
  const q = { fresh: [mk(201, "Zed"), mk(202, "Yan")], pool: mkPool(10), round: [] as ReturnType<typeof mk>[], lastName: "" };
  const a = nextMoment(q)!, b = nextMoment(q)!, c = nextMoment(q)!;
  ok("next: new moments go first, in the order they came", a.id === 201 && b.id === 202 && c.id !== 201 && c.id !== 202);
}
{
  // A moment arrives while a round is half done: the line after it is not the same student, over many tries.
  let bad = 0, tries = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const r = seededRand(seed);
    const q = { fresh: [] as ReturnType<typeof mk>[], pool: mkPool(20), round: [] as ReturnType<typeof mk>[], lastName: "" };
    for (let i = 0; i < 5; i++) nextMoment(q, r);
    const target = q.round[0].name; // the student about to come next in the round
    q.fresh.push(mk(900 + seed, target));
    const arrived = nextMoment(q, r)!;
    const after = nextMoment(q, r)!;
    tries++;
    if (nameKey(after.name) === nameKey(arrived.name)) bad++;
  }
  ok("next: the line after a new moment is another student", bad === 0, `${bad} of ${tries}`);
}

console.log(`activity: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
