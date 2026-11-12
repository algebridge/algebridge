/**
 * Text boxes on the call whiteboard (Nov 2026). A box sits at a normalized
 * (0..1) point, like the strokes, so it lands in the same place on both
 * screens. Boxes travel as small ops over the call's broadcast channel; a
 * box from the other side is checked here before it is shown.
 */

export interface WbText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export type WbTextOp = { op: "set"; box: WbText } | { op: "del"; id: string } | { op: "clear" };

export const MAX_TEXT = 500;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** An op from the other side, made safe to apply, or null when it is not one. */
export function parseTextOp(raw: unknown): WbTextOp | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.op === "clear") return { op: "clear" };
  if (o.op === "del") return typeof o.id === "string" && o.id.length <= 40 ? { op: "del", id: o.id } : null;
  if (o.op !== "set" || !o.box || typeof o.box !== "object") return null;
  const b = o.box as Record<string, unknown>;
  if (typeof b.id !== "string" || b.id.length > 40 || typeof b.text !== "string") return null;
  const color = typeof b.color === "string" && /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#0f172a";
  return { op: "set", box: { id: b.id, x: clamp01(Number(b.x)), y: clamp01(Number(b.y)), text: b.text.slice(0, MAX_TEXT), color } };
}

/** The boxes after one op. */
export function applyTextOp(boxes: WbText[], op: WbTextOp): WbText[] {
  if (op.op === "clear") return [];
  if (op.op === "del") return boxes.filter((b) => b.id !== op.id);
  const i = boxes.findIndex((b) => b.id === op.box.id);
  if (i === -1) return [...boxes, op.box];
  const next = boxes.slice();
  next[i] = op.box;
  return next;
}

/**
 * Math as it is typed: x^2 becomes x², <= becomes ≤, sqrt becomes √. The
 * keys above the board insert the same characters directly.
 */
export function mathShortcuts(text: string): string {
  return text
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠")
    .replace(/\+-/g, "±")
    .replace(/sqrt/gi, "√")
    .replace(/\bpi\b/gi, "π");
}

export const MATH_KEYS = ["²", "³", "√", "π", "≤", "≥", "≠", "±", "×", "÷"];
