// node public/arcade/rare-find/bank.test.mjs
// Checks the hand-written bank: no empty lists, tiers present, every answer and alias resolves to
// exactly one answer, typo matching never steals an exact answer, and the daily mix is 3 math + 4 general.
import assert from "node:assert/strict";
import { BANK, BANK_CATS, match, keyOf, oneTypo, clean, bankPrompt, TIER_POINTS } from "./bank.js";
import { makeGame } from "./prompts.js";

let answers = 0, aliases = 0;
const ids = new Set();
assert.ok(BANK.length >= 60, `bank has ${BANK.length} prompts, need 60`);
for (const b of BANK) {
  assert.deepEqual(b.problems, [], `${b.text}: ${b.problems.join("; ")}`);
  assert.ok(!ids.has(b.id), `duplicate prompt ${b.id}`); ids.add(b.id);
  assert.ok(BANK_CATS.includes(b.cat), `${b.text}: unknown category`);
  assert.ok(b.answers.length >= 3, `${b.text}: needs at least 3 answers`);
  assert.ok(!/[—–]/.test(b.text), `${b.text}: dash`);
  const names = new Set();
  for (const a of b.answers) {
    answers++;
    assert.ok([0, 1, 2, 3].includes(a.tier), `${b.text} / ${a.name}: tier`);
    assert.ok(a.name && a.keys.length, `${b.text}: empty answer`);
    const k = keyOf(a.name, b.drop);
    assert.ok(!names.has(k), `${b.text}: "${a.name}" is listed twice`); names.add(k);
    for (const al of a.aliases) {
      aliases++;
      const m = match(b, al);
      assert.ok(m && m.answer === a && m.via === "exact", `${b.text}: "${al}" does not resolve to ${a.name}`);
      // messy typing still resolves
      const messy = match(b, "  " + al.toUpperCase().replace(/ /g, "  ") + "!! ");
      assert.ok(messy && messy.answer === a, `${b.text}: messy "${al}"`);
    }
    for (const key of a.keys) assert.equal(b.index.get(key), a, `${b.text}: key ${key}`);
  }
  // every key belongs to exactly one answer
  for (const [key, a] of b.index) assert.equal(b.answers.filter((x) => x.keys.includes(key)).length, 1, `${b.text}: key ${key} shared`);
  assert.ok(b.answers.some((a) => a.tier === 0), `${b.text}: no common answer`);
  // the playable shape
  const p = bankPrompt(b, () => 0.5);
  const first = p.judge(b.answers[0].name);
  assert.equal(first.status, "ok"); assert.equal(first.points, TIER_POINTS[b.answers[0].tier]);
  assert.equal(p.judge("zzzz not a thing").status, "wrong");
  assert.equal(p.judge("   ").status, "reject");
  const ex = p.examples(b.answers[0].name);
  assert.ok(ex.length >= 1 && ex.every((e) => e.text !== b.answers[0].name));
}

// known set sizes
const size = (text) => BANK.find((b) => b.text === text).answers.length;
assert.equal(size("Name any chemical element"), 118);
assert.equal(size("Name one of the 88 official constellations"), 88);
assert.equal(size("Name a country in Africa"), 54);
assert.equal(size("Name a US state"), 50);
assert.equal(size("Name an NBA team"), 30);
assert.equal(size("Name an NFL team"), 32);
assert.equal(size("Name a Greek letter"), 24);
assert.equal(size("Name a metric prefix"), 24);
assert.equal(size("Name a person who has walked on the Moon"), 12);
assert.equal(size("Name the capital city of a country in Europe"), 46);

// normalizing and typos
const P = (text) => BANK.find((b) => b.text === text);
assert.equal(clean("  Côte d'Ivoire!  "), "cote divoire");
assert.equal(match(P("Name a country in Africa"), "cote d'ivoire").answer.name, "Ivory Coast");
assert.equal(match(P("Name a country in Africa"), "Madagasgar").via, "typo");
assert.equal(match(P("Name a country in Africa"), "Niger").answer.name, "Niger");
assert.equal(match(P("Name a country in Africa"), "Nigeria").answer.name, "Nigeria");
assert.equal(match(P("Name a country in Africa"), "the gambia").answer.name, "Gambia");
assert.equal(match(P("Name a country in Africa"), "Kenia"), null, "short words get no typo help");
assert.equal(match(P("Name a famous mathematician"), "gauss").answer.name, "Carl Friedrich Gauss");
assert.equal(match(P("Name a famous mathematician"), "Gödel").answer.name, "Kurt Godel");
assert.equal(match(P("Name a famous mathematician"), "einstein"), null);
assert.equal(match(P("Name a scientist who won a Nobel Prize in Physics"), "Curie").answer.name, "Marie Curie");
assert.equal(match(P("Name a scientist who won a Nobel Prize in Physics"), "hawking"), null);
assert.equal(match(P("Name an NBA team"), "lakers").answer.name, "Los Angeles Lakers");
assert.equal(match(P("Name an NBA team"), "76ers").answer.name, "Philadelphia 76ers");
assert.equal(match(P("Name a type of triangle"), "isosceles triangle").answer.name, "Isosceles");
assert.equal(match(P("Name a type of triangle"), "isoceles").via, "typo");
assert.equal(match(P("Name a chess piece"), "pawns").answer.name, "Pawn");
assert.equal(match(P("Name a planet in our solar system"), "pluto"), null);
assert.equal(match(P("Name one of the five Great Lakes"), "Lake Erie").answer.name, "Erie");
assert.equal(match(P("Name any chemical element"), "erbium").answer.name, "Erbium");
assert.equal(match(P("Name any chemical element"), "terbium").answer.name, "Terbium");
assert.equal(match(P("Name a famous classical composer"), "Williams"), null);
assert.ok(oneTypo("saturn", "satrun") && oneTypo("saturn", "satur") && oneTypo("saturn", "saturnn") && !oneTypo("saturn", "sautrm"));

// the game: 7 prompts, 3 math and 4 general from 4 different categories, the same for the same seed
for (let seed = 1; seed <= 400; seed++) {
  const game = makeGame(seed, 7);
  assert.equal(game.length, 7);
  const bank = game.filter((p) => p.kind === "bank");
  assert.equal(bank.length, 4, `seed ${seed}`);
  assert.equal(new Set(bank.map((p) => p.cat)).size, 4);
  assert.equal(new Set(game.filter((p) => p.kind !== "bank").map((p) => p.type)).size, 3);
  assert.deepEqual(makeGame(seed, 7).map((p) => p.text), game.map((p) => p.text));
  for (const p of game) {
    assert.ok(p.text && p.hint && typeof p.judge === "function" && p.examples(null).length);
    assert.ok(!/\d+\s?%/.test(p.text + p.hint), "no percentages");
  }
}
console.log(`bank ok: ${BANK.length} prompts, ${answers} answers, ${aliases} accepted spellings`);
for (const c of BANK_CATS) console.log(" ", c.padEnd(9), BANK.filter((b) => b.cat === c).length);
