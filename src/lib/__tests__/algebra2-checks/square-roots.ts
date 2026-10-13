import type { CheckHelpers, Checks } from "../algebra2-checks.ts";

/** One kind of minus, no spaces. */
const norm = (t: string) => t.replace(/[−–]/g, "-").replace(/\s+/g, "");

/** "6√2", "√5", "7" → {k, m} meaning k·√m; anything else → null. */
function parseRoot(text: string): { k: number; m: number } | null {
  const t = norm(text);
  if (/^\d+$/.test(t)) return { k: Number(t), m: 1 };
  const m = t.match(/^(\d*)√(\d+)$/);
  if (!m) return null;
  return { k: m[1] === "" ? 1 : Number(m[1]), m: Number(m[2]) };
}

function squareFree(m: number): boolean {
  for (let d = 2; d * d <= m; d++) if (m % (d * d) === 0) return false;
  return true;
}

const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));

/** The simplified form of √n is exactly k√m: same value, nothing square left inside. */
const simplifies = (c: string, n: number) => {
  const r = parseRoot(c);
  return !!r && r.k * r.k * r.m === n && squareFree(r.m) && (r.m > 1 || isSquare(n));
};

export default function checks(h: CheckHelpers): Checks {
  const { expectAnswer, onlyRight } = h;
  return {
    "square-roots": (p) => {
      let m;
      if ((m = p.prompt.match(/^What is √(\d+)\?$/))) {
        const n = Number(m[1]);
        if (!isSquare(n)) return "the number is not a perfect square";
        return expectAnswer(p, Math.sqrt(n));
      }
      if ((m = p.prompt.match(/^Solve x² = (\d+)\.$/))) {
        const r = Math.sqrt(Number(m[1]));
        return onlyRight(p, (c) => {
          const x = norm(c).match(/^x=±(\d+)$/);
          return !!x && Number(x[1]) === r;
        });
      }
      if ((m = p.prompt.match(/^Between which two whole numbers is √(\d+)\?$/))) {
        const n = Number(m[1]);
        return onlyRight(p, (c) => {
          const x = c.match(/^(\d+) and (\d+)$/);
          return !!x && Number(x[2]) === Number(x[1]) + 1 && Number(x[1]) ** 2 < n && n < Number(x[2]) ** 2;
        });
      }
      if ((m = p.prompt.match(/^A square has an area of (\d+) square (\w+)\. How long is one side, in \2\?$/))) return expectAnswer(p, Math.sqrt(Number(m[1])));
      if ((m = p.prompt.match(/^Which number is a perfect square: (\d+), (\d+), (\d+) or (\d+)\?$/))) {
        const listed = m.slice(1, 5).map(String);
        if (!(p.choices as string[]).every((c) => listed.includes(c))) return "the choices differ from the list in the prompt";
        return onlyRight(p, (c) => isSquare(Number(c)));
      }
      return "unread";
    },

    "negative-square-roots": (p) => {
      let m;
      if ((m = p.prompt.match(/^Simplify −√(\d+)\.$/))) return expectAnswer(p, -Math.sqrt(Number(m[1])));
      if ((m = p.prompt.match(/^What is √\(−(\d+)\) in the real numbers\?$/))) return onlyRight(p, (c) => c === "Not a real number");
      if ((m = p.prompt.match(/^Evaluate −(\d+)²\.$/))) return expectAnswer(p, -(Number(m[1]) ** 2));
      if ((m = p.prompt.match(/^Evaluate \(−(\d+)\)²\.$/))) return expectAnswer(p, (-Number(m[1])) ** 2);
      if ((m = p.prompt.match(/^How many real solutions does x² = (−?)(\d+) have\?$/))) {
        const c = (m[1] ? -1 : 1) * Number(m[2]);
        return expectAnswer(p, c > 0 ? 2 : c === 0 ? 1 : 0);
      }
      if ((m = p.prompt.match(/^Which one is not a real number: (.+), (.+), (.+) or (.+)\?$/))) {
        // Real when it has no negative under a root.
        return onlyRight(p, (c) => /√\(−\d+\)/.test(c));
      }
      return "unread";
    },

    "simplify-square-roots": (p) => {
      let m;
      if ((m = p.prompt.match(/^Simplify √(\d+)\.$/))) {
        const n = Number(m[1]);
        return onlyRight(p, (c) => simplifies(c, n));
      }
      if ((m = p.prompt.match(/^Write √(\d+) as a√b with b as small as possible\. What is a\?$/))) {
        const n = Number(m[1]);
        let k = 1;
        for (let d = 2; d * d <= n; d++) if (n % (d * d) === 0) k = d;
        return expectAnswer(p, k);
      }
      if ((m = p.prompt.match(/^Which square root is fully simplified: (.+), (.+), (.+) or (.+)\?$/))) {
        return onlyRight(p, (c) => {
          const r = parseRoot(c);
          return !!r && squareFree(r.m) && r.m > 1;
        });
      }
      return "unread";
    },

    "operations-square-roots": (p) => {
      let m;
      if ((m = p.prompt.match(/^Simplify (\d+)√(\d+) ([+−]) (\d*)√(\d+)\.$/))) {
        const [a, m1, op, bText, m2] = [Number(m[1]), Number(m[2]), m[3], m[4], Number(m[5])];
        if (m1 !== m2) return "the roots are not like roots";
        const c = op === "+" ? a + Number(bText || 1) : a - Number(bText || 1);
        return onlyRight(p, (x) => {
          const r = parseRoot(x);
          return !!r && r.m === m1 && r.k === c;
        });
      }
      if ((m = p.prompt.match(/^Multiply: √(\d+) · √(\d+)\.$/))) {
        const n = Number(m[1]) * Number(m[2]);
        return onlyRight(p, (c) => simplifies(c, n));
      }
      if ((m = p.prompt.match(/^Simplify \((\d+)√(\d+)\)²\. Write a plain number\.$/))) return expectAnswer(p, Number(m[1]) ** 2 * Number(m[2]));
      if ((m = p.prompt.match(/^Evaluate \(−√(\d+)\)²\. Write a plain number\.$/))) return expectAnswer(p, Number(m[1]));
      return "unread";
    },
  };
}
