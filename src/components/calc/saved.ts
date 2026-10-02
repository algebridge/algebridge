/**
 * What a student typed into the calculators, kept in this browser between
 * visits (and nowhere else). A blocked or full store only means the rows
 * start empty next time.
 */

export function readSaved(key: string): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

export function writeSaved(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* not remembered, which is all */
  }
}

/** Saved rows, each checked: text only, a sane length, a sane count. */
export function savedTexts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => (typeof r === "string" ? r : r && typeof r === "object" && typeof (r as { text?: unknown }).text === "string" ? (r as { text: string }).text : null))
    .filter((t): t is string => t !== null)
    .slice(0, 100)
    .map((t) => t.replace(/[\r\n]+/g, " ").slice(0, 400));
}

/** How a screen reader should say a result: "−5" and "10^23" read badly as symbols. */
export function spoken(text: string): string {
  return text.replace(/−/g, "minus ").replace(/×10\^/g, " times 10 to the power ");
}
