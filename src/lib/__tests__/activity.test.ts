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

// --- Probe's extra checks on mixNames, seededRand, nameKey and nextMoment (11 Nov 2026) --------------
{
  type P = { id: number; name: string };
  const pm = (names: string[]): P[] => names.map((name, i) => ({ id: i + 1, name }));
  const viol = (seq: string[], after = "") => {
    let v = 0, last = nameKey(after);
    for (const n of seq) { const k = nameKey(n); if (last && k === last) v++; last = k; }
    return v;
  };
  // the fewest same-name neighbours any order of these names can have, by trying every order
  const minViol = (names: string[], after: string) => {
    const counts = new Map<string, number>();
    for (const n of names) counts.set(nameKey(n), (counts.get(nameKey(n)) ?? 0) + 1);
    const keys = [...counts.keys()];
    let best = 99;
    const go = (left: number, last: string, v: number) => {
      if (v >= best) return;
      if (!left) { best = Math.min(best, v); return; }
      for (const k of keys) {
        if (counts.get(k)! > 0) {
          counts.set(k, counts.get(k)! - 1);
          go(left - 1, k, v + (last && k === last ? 1 : 0));
          counts.set(k, counts.get(k)! + 1);
        }
      }
    };
    go(names.length, nameKey(after), 0);
    return best;
  };
  const alpha = ["A", "B", "C"];
  let optimalBad = 0, optimalRuns = 0;
  const gen = (len: number, cur: string[]) => {
    if (cur.length === len) {
      for (const after of ["", "A", "Z"]) {
        const want = minViol(cur, after);
        for (let s = 1; s <= 2; s++) {
          const items = pm(cur);
          const out = mixNames(items, seededRand(s * 101 + len), after);
          optimalRuns++;
          const perm = out.length === items.length && items.every((x) => out.filter((y) => y === x).length === 1);
          if (!perm || viol(out.map((x) => x.name), after) !== want) optimalBad++;
        }
      }
      return;
    }
    for (const a of alpha) gen(len, [...cur, a]);
  };
  for (let len = 1; len <= 6; len++) gen(len, []);
  ok("mixNames: a permutation with the fewest possible same-name neighbours, every small list", optimalBad === 0, `${optimalBad} of ${optimalRuns}`);

  {
    let bad = 0;
    for (let t = 1; t <= 60; t++) {
      const r = seededRand(t);
      const k = 1 + Math.floor(r() * 15);
      const names = Array.from({ length: 60 }, () => "n" + Math.floor(r() * r() * k));
      const items = pm(names);
      const out = mixNames(items, r, "n0");
      if (out.length !== 60 || !items.every((x) => out.includes(x))) bad++;
    }
    ok("mixNames: 60 items of any shape come back as a permutation", bad === 0, String(bad));
  }
  {
    const maj = [...Array(31).fill("Maj"), ...Array.from({ length: 29 }, (_, i) => "o" + i)];
    ok("mixNames: a name holding 31 of 60 repeats only the one time it must", viol(mixNames(pm(maj), seededRand(3)).map((x) => x.name)) === 1);
    const half = [...Array(30).fill("Maj"), ...Array.from({ length: 30 }, (_, i) => "o" + i)];
    ok("mixNames: a name holding 30 of 60 never repeats", viol(mixNames(pm(half), seededRand(4)).map((x) => x.name)) === 0);
  }
  for (const [label, r] of [["0", () => 0], ["1", () => 1], ["NaN", () => NaN], ["-0.5", () => -0.5], ["2", () => 2]] as const) {
    let okRun = true;
    try { const out = mixNames(pm(["A", "B", "A", "C", "B", "A"]), r as () => number, "C"); okRun = out.length === 6 && out.every((x) => x !== undefined); } catch { okRun = false; }
    ok(`mixNames: rand returning ${label} still returns every item`, okRun);
  }
  {
    const input = pm(["A", "B", "C"]);
    const before = JSON.stringify(input);
    mixNames(input);
    ok("mixNames: the input list is not changed", JSON.stringify(input) === before);
    ok("mixNames: nothing in, nothing out", mixNames([]).length === 0);
  }
  for (const seed of [0, -1, 1.5, NaN, Infinity, -Infinity, 2 ** 53, 1e300]) {
    const r = seededRand(seed);
    let inRange = true;
    for (let i = 0; i < 500; i++) { const v = r(); if (!(v >= 0 && v < 1)) inRange = false; }
    ok(`seededRand(${seed}) stays in [0, 1)`, inRange);
  }
  ok("seededRand: the same seed gives the same numbers", [1, 2, 3].every((n) => { const a = seededRand(n), b = seededRand(n); return a() === b() && a() === b(); }));
  ok("nameKey: Ana, ana, ANA and Aña are one student", ["ana", "ANA", "Aña"].every((n) => nameKey(n) === nameKey("Ana")));
  ok("nameKey: José and Jose are one student, Ana and Anna are not", nameKey("José") === nameKey("Jose") && nameKey("Ana") !== nameKey("Anna"));
  {
    // every moment once per round, three rounds in a row, and no student twice in a row without new moments
    const pool = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, at: "", name: "n" + (i % 9), kind: "solved" as const, amount: null, detail: null }));
    const q = { fresh: [] as typeof pool, pool, round: [] as typeof pool, lastName: "" };
    let onceEach = true, repeats = 0, prev = "";
    for (let r = 0; r < 3; r++) {
      const ids = new Set<number>();
      for (let i = 0; i < 60; i++) {
        const it = nextMoment(q, seededRand(r * 60 + i + 1))!;
        ids.add(it.id);
        if (prev && nameKey(it.name) === prev) repeats++;
        prev = nameKey(it.name);
      }
      if (ids.size !== 60) onceEach = false;
    }
    ok("next: every moment once per round, 60 items, 3 rounds", onceEach);
    ok("next: no student twice in a row across round seams (no new moments)", repeats === 0, String(repeats));
  }
  {
    const q = { fresh: [] as ReturnType<typeof nextMoment>[] as never[], pool: [] as never[], round: [] as never[], lastName: "" };
    ok("next: nothing to show gives null", nextMoment(q) === null);
    const one = { id: 1, at: "", name: "A", kind: "solved" as const, amount: null, detail: null };
    const same = [one, { ...one, id: 2 }, { ...one, id: 3 }];
    const q2 = { fresh: [{ ...one, id: 9 }], pool: same, round: [...same], lastName: "" };
    ok("next: a new moment from the only student on the strip does not crash or lose the round", nextMoment(q2)!.id === 9 && q2.round.length === 3);
  }
}
// Known gap (reported 11 Nov 2026, not tested because it fails today): when a new moment has the same name as the
// head of the round, nextMoment swaps the head with the first different name. That can put the old head next to
// a same-name neighbour inside the round: round A,B,A and a new A gives B,A,A. Choose a swap target whose
// neighbours differ from the old head, or move the target to the front instead of swapping.

// --- a new moment must not bring two of the same name together inside the round ------------------
{
  const A1 = mk(1, "Ava"), B = mk(2, "Liam"), A2 = mk(3, "Ava"), C = mk(4, "Noor");
  const pairs = (xs: { name: string }[]) => xs.filter((x, i) => i && nameKey(x.name) === nameKey(xs[i - 1].name)).length;
  const q1 = { fresh: [mk(50, "Ava")], pool: [A1, B, A2, C], round: [A1, B, A2, C], lastName: "Zed" };
  nextMoment(q1);
  ok("arrival: Ava, Liam, Ava, Noor stays free of Ava, Ava", pairs(q1.round) === 0 && q1.round.length === 4, q1.round.map((m) => m.name).join());
  ok("arrival: the round now starts with a different student", nameKey(q1.round[0].name) !== "ava");
  const q2 = { fresh: [mk(51, "Ava")], pool: [A1, B, A2], round: [A1, B, A2], lastName: "Zed" };
  nextMoment(q2);
  ok("arrival: Ava, Liam, Ava has no good move, so the round is left alone", q2.round.map((m) => m.id).join() === "1,2,3");
  const q3 = { fresh: [mk(52, "Ava")], pool: [A1], round: [A1], lastName: "" };
  nextMoment(q3);
  ok("arrival: a round of one student is kept", q3.round.length === 1);
}

console.log(`activity: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
