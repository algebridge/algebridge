import type { CheckHelpers, Checks } from "../algebra2-checks.ts";

const minus = (t: string) => t.replace(/[−–]/g, "-").trim();

/** An exact unit-circle value as a number: "−√3/2", "1/2", "√3", "0", "4/5". NaN when it is none of these. */
function exactVal(text: string): number {
  const t = minus(text).replace(/\s+/g, "");
  const m = t.match(/^(-?)(?:√(\d+)|(\d+))(?:\/(\d+))?$/);
  if (!m) return NaN;
  const top = m[2] ? Math.sqrt(+m[2]) : +m[3];
  const v = top / (m[4] ? +m[4] : 1);
  return m[1] ? -v : v;
}

/** An angle written in degrees ("150°") or as a multiple of π ("5π/6", "π", "2π", "0"), in degrees. NaN otherwise. */
function angleDeg(text: string): number {
  const t = minus(text).replace(/\s+/g, "");
  let m = t.match(/^(-?\d+(?:\.\d+)?)°$/);
  if (m) return +m[1];
  if (t === "0") return 0;
  m = t.match(/^(-?)(\d*)π(?:\/(\d+))?$/);
  if (!m) return NaN;
  const k = m[2] === "" ? 1 : +m[2];
  const v = (180 * k) / (m[3] ? +m[3] : 1);
  return m[1] ? -v : v;
}

/** A radian measure written as a multiple of π or as a plain decimal, in radians. NaN otherwise. */
function radians(text: string): number {
  const t = minus(text).replace(/\s+/g, "");
  if (/^-?\d+(\.\d+)?$/.test(t)) return +t;
  const d = angleDeg(t);
  return (d * Math.PI) / 180;
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };
const quadrantOf = (deg: number) => {
  const d = ((deg % 360) + 360) % 360;
  return d < 90 ? 1 : d < 180 ? 2 : d < 270 ? 3 : 4;
};
const refOf = (deg: number) => {
  const d = ((deg % 360) + 360) % 360;
  return d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
};
type Fn = "sin" | "cos" | "tan";
const trig = (fn: Fn, deg: number) => {
  const t = (deg * Math.PI) / 180;
  return fn === "sin" ? Math.sin(t) : fn === "cos" ? Math.cos(t) : Math.tan(t);
};
const signIn = (fn: Fn, q: number) => (fn === "sin" ? q <= 2 : fn === "cos" ? q === 1 || q === 4 : q === 1 || q === 3);

export default function checks(h: CheckHelpers): Checks {
  const { expectAnswer, onlyRight, close } = h;
  const nearly = (a: number, b: number) => Math.abs(a - b) < 1e-7;
  const lastPart = (s: string) => s.split(/=|≈/).pop()!.trim();
  return {
    "radians-degrees": (p) => {
      let m;
      if (p.type === "error-analysis") {
        m = p.prompt.match(/^Find the error in this conversion of (\d+)° to radians\.$/);
        if (!m) return "unread";
        const want = (+m[1] * Math.PI) / 180;
        const stepTrue = (s: string) => {
          const tail = lastPart(s.replace(/\.$/, "").replace(/ radians$/, ""));
          const v = radians(tail);
          return Number.isFinite(v) && nearly(v, want);
        };
        const firstFalse = (p.steps as string[]).findIndex((s) => !stepTrue(s));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      if ((m = p.prompt.match(/^Convert (\d+)° to radians\.$/))) {
        const want = (+m[1] * Math.PI) / 180;
        return onlyRight(p, (c) => {
          const v = radians(c);
          return Number.isFinite(v) && nearly(v, want);
        });
      }
      if ((m = p.prompt.match(/^Convert (.+) radians to degrees\.$/))) {
        const deg = angleDeg(m[1]);
        if (!Number.isFinite(deg)) return "could not read the angle";
        return expectAnswer(p, deg);
      }
      if ((m = p.prompt.match(/^A circle has radius (\d+) [a-z]+\. Find the length of the arc cut off by a central angle of (.+?)( radians)?\. \(round to the nearest tenth\)$/))) {
        const r = +m[1];
        const theta = m[3] ? radians(m[2]) : (angleDeg(m[2]) * Math.PI) / 180;
        if (!Number.isFinite(theta)) return "could not read the angle";
        if (p.decimalPlaces !== 1) return "the rounding place is not tenths";
        return expectAnswer(p, r * theta);
      }
      if ((m = p.prompt.match(/^Convert (\d+)° to radians as a decimal\. \(round to the nearest hundredth\)$/))) {
        if (p.decimalPlaces !== 2) return "the rounding place is not hundredths";
        return expectAnswer(p, (+m[1] * Math.PI) / 180);
      }
      return "unread";
    },

    "unit-circle-values": (p) => {
      let m;
      if (p.type === "error-analysis") {
        m = p.prompt.match(/^Find the error in this evaluation of tan (\d+)° from sine and cosine\.$/);
        if (!m) return "unread";
        const deg = +m[1];
        const want = [trig("sin", deg), trig("cos", deg), trig("tan", deg)];
        const firstFalse = (p.steps as string[]).findIndex((s, k) => !nearly(exactVal(lastPart(s)), want[k]));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      if ((m = p.prompt.match(/^Find the exact value of (sin|cos|tan) (.+)\.$/))) {
        const deg = angleDeg(m[2]);
        if (!Number.isFinite(deg)) return "could not read the angle";
        const want = trig(m[1] as Fn, deg);
        if (Math.abs(want) > 1e6) return "the value is not defined";
        return onlyRight(p, (c) => nearly(exactVal(c), want));
      }
      if ((m = p.prompt.match(/^In which quadrant does an angle of (-?\d+)° in standard position lie\? \(answer 1, 2, 3 or 4\)$/))) {
        const deg = +m[1];
        if (deg % 90 === 0) return "the angle is on an axis";
        return expectAnswer(p, quadrantOf(deg));
      }
      if ((m = p.prompt.match(/^(sin|cos|tan) θ (<|>) 0 and (sin|cos|tan) θ (<|>) 0\. In which quadrant does θ lie\? \(answer 1, 2, 3 or 4\)$/))) {
        const fits = [1, 2, 3, 4].filter((q) => signIn(m![1] as Fn, q) === (m![2] === ">") && signIn(m![3] as Fn, q) === (m![4] === ">"));
        if (fits.length !== 1) return `${fits.length} quadrants fit`;
        return expectAnswer(p, fits[0]);
      }
      if ((m = p.prompt.match(/^What is the sign of (sin|cos|tan) θ when θ is in Quadrant (I|II|III|IV)\?$/))) {
        const want = signIn(m[1] as Fn, ROMAN[m[2]]) ? "positive" : "negative";
        return onlyRight(p, (c) => c.toLowerCase() === want);
      }
      if ((m = p.prompt.match(/^Find the angle θ with 0° ≤ θ < 360° in Quadrant (I|II|III|IV) where (sin|cos|tan) θ = (.+)\.$/))) {
        const q = ROMAN[m[1]];
        const v = exactVal(m[3]);
        const fits: number[] = [];
        for (let a = 0; a < 360; a += 15) if (quadrantOf(a) === q && a % 90 !== 0 && nearly(trig(m[2] as Fn, a), v)) fits.push(a);
        if (fits.length !== 1) return `${fits.length} angles fit`;
        return expectAnswer(p, fits[0]);
      }
      return "unread";
    },

    "reference-angles": (p) => {
      let m;
      if (p.type === "error-analysis") {
        m = p.prompt.match(/^Find the error in this evaluation of (sin|cos|tan) (\d+)° using a reference angle\.$/);
        if (!m) return "unread";
        const fn = m[1] as Fn;
        const deg = +m[2];
        const stepTrue = (s: string, k: number) => {
          if (k === 0) {
            const mm = s.match(/^(\d+)° is in Quadrant (I|II|III|IV)\.$/);
            return !!mm && +mm[1] === deg && ROMAN[mm[2]] === quadrantOf(deg);
          }
          if (k === 1) {
            const mm = s.match(/= (\d+)°$/);
            return !!mm && +mm[1] === refOf(deg);
          }
          const mm = s.match(/(sin|cos|tan) is (positive|negative) in Quadrant (I|II|III|IV), so (sin|cos|tan) (\d+)° = (.+)$/);
          if (!mm || mm[1] !== fn || mm[4] !== fn || +mm[5] !== deg) return false;
          if (ROMAN[mm[3]] !== quadrantOf(deg) || (mm[2] === "positive") !== signIn(fn, quadrantOf(deg))) return false;
          return nearly(exactVal(mm[6]), trig(fn, deg));
        };
        const firstFalse = (p.steps as string[]).findIndex((s, k) => !stepTrue(s, k));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      if ((m = p.prompt.match(/^Find the reference angle of (\d+)°\.$/)) || (m = p.prompt.match(/^Find the reference angle of an angle measuring (-?\d+)°\.$/))) {
        return expectAnswer(p, refOf(+m[1]));
      }
      if ((m = p.prompt.match(/^Find the reference angle of (.+)\.$/))) {
        const deg = angleDeg(m[1]);
        if (!Number.isFinite(deg)) return "could not read the angle";
        const want = refOf(deg);
        return onlyRight(p, (c) => close(angleDeg(c), want));
      }
      if ((m = p.prompt.match(/^Find the angle between 0° and 360° that is coterminal with (-?\d+)°\.$/))) {
        return expectAnswer(p, ((+m[1] % 360) + 360) % 360);
      }
      if ((m = p.prompt.match(/^(sin|cos) θ = (.+) and θ is in Quadrant (I|II|III|IV)\. Find (sin|cos) θ\.$/))) {
        const given = exactVal(m[2]);
        const q = ROMAN[m[3]];
        if ((given > 0) !== signIn(m[1] as Fn, q)) return "the given value has the wrong sign for its quadrant";
        const size = Math.sqrt(1 - given * given);
        const want = signIn(m[4] as Fn, q) ? size : -size;
        return onlyRight(p, (c) => nearly(exactVal(c), want));
      }
      return "unread";
    },
  };
}
