import { activityLine, cleanDetail, firstNameOf, parseActivityRow, sameMoment, withArticle } from "../activity.ts";

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

console.log(`activity: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
