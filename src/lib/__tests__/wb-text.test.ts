import assert from "node:assert/strict";
import { applyTextOp, mathShortcuts, parseTextOp, MAX_TEXT } from "@/lib/wb-text";

let checks = 0;
const eq = <T>(a: T, b: T, msg: string) => { assert.deepEqual(a, b, msg); checks++; };

const box = { id: "a", x: 0.2, y: 0.3, text: "x = 4", color: "#2563eb" };
eq(applyTextOp([], { op: "set", box }), [box], "a new box is added");
eq(applyTextOp([box], { op: "set", box: { ...box, text: "x = 5" } })[0].text, "x = 5", "an edit replaces the box");
eq(applyTextOp([box], { op: "set", box: { ...box, x: 0.9 } }).length, 1, "a move keeps one box");
eq(applyTextOp([box], { op: "del", id: "a" }), [], "delete removes it");
eq(applyTextOp([box], { op: "clear" }), [], "clear removes every box");

// From the other side: only well-formed ops, made safe.
eq(parseTextOp({ op: "set", box: { id: "b", x: 5, y: -1, text: "hi", color: "red" } }), { op: "set", box: { id: "b", x: 1, y: 0, text: "hi", color: "#0f172a" } }, "position clamped, bad color replaced");
eq((parseTextOp({ op: "set", box: { id: "c", x: 0, y: 0, text: "x".repeat(900), color: "#000000" } }) as { box: { text: string } }).box.text.length, MAX_TEXT, "text capped");
eq(parseTextOp({ op: "set", box: { id: 7, x: 0, y: 0, text: "hi" } }), null, "a box without a string id is refused");
eq(parseTextOp({ op: "del", id: "x".repeat(80) }), null, "an overlong id is refused");
eq(parseTextOp("nope"), null, "not an object");
eq(parseTextOp({ op: "clear" }), { op: "clear" }, "clear passes");

// Math as typed
eq(mathShortcuts("x^2 + y^3 <= 10"), "x² + y³ ≤ 10", "powers and less-or-equal");
eq(mathShortcuts("a >= b, a != c, +-3"), "a ≥ b, a ≠ c, ±3", "greater-or-equal, not equal, plus-minus");
eq(mathShortcuts("sqrt(16) and 2pi"), "√(16) and 2pi", "sqrt becomes a root; pi inside a word stays");
eq(mathShortcuts("pi r^2"), "π r²", "pi alone becomes π");

console.log(`wb-text: ${checks} checks passed`);
