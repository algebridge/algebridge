// Every worked example's problem and answer, as JSON: compare before and after an edit to the explanations.
import { WORKED_EXAMPLES } from "../src/data/worked-examples/index.ts";
const out: Record<string, unknown[]> = {};
for (const [id, list] of Object.entries(WORKED_EXAMPLES)) out[id] = list.map((e) => ({ kind: e.kind, card: e.card, answer: e.answer }));
console.log(JSON.stringify(out));
