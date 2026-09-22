/**
 * Real-name rules for AlgeBridge accounts.
 *
 * AlgeBridge is a school platform: teachers grade a roster, tutors join video
 * calls, and classmates see each other in group chats. Handles like "xX_mathgod"
 * make all three unusable, so every account carries the student's actual name
 * in one shape, "First Last": a first name and a full last name, capitalized
 * the way names are. Whatever shape it arrives in ("MARIA ALVAREZ",
 * "alvarez, maria", "maria  alvarez.") is tidied into that one, and a last
 * initial on its own is sent back for the full name.
 */

const NAME_CHARS = /^[\p{L}\p{M}'’.\-\s]+$/u;
const HAS_LETTER = /\p{L}/u;

/** Names people type when they're dodging the question. */
const PLACEHOLDERS = new Set([
  "test",
  "testing",
  "asdf",
  "qwerty",
  "student",
  "teacher",
  "tutor",
  "user",
  "admin",
  "anonymous",
  "anon",
  "none",
  "na",
  "n/a",
  "unknown",
  "nobody",
  "me",
  "myself",
  "first last",
  "firstname lastname",
  "john doe",
  "jane doe",
]);

export const MAX_NAME_LENGTH = 60;

export interface NameCheck {
  ok: boolean;
  /** Cleaned-up version of the input, safe to store. */
  formatted: string;
  /** Student-readable reason, empty when ok. */
  error: string;
  /** Which box the problem is in, when the form has two. */
  field?: "first" | "last";
}

/** Collapse whitespace and trim. Does not change capitalization. */
export function cleanName(raw: string): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

/** Name particles that stay lowercase in the middle of a name. */
const PARTICLES = new Set([
  "van", "von", "der", "den", "de", "del", "della", "di", "da", "dos", "du",
  "la", "le", "bin", "ibn", "af", "av", "ter", "ten", "zu",
]);

/** "jean-pierre" -> "Jean-Pierre", "o'brien" -> "O'Brien". */
function titleCasePart(part: string): string {
  return part.toLowerCase().replace(/(^|[-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Typed in one case only (all lowercase or ALL CAPS), so the capitals need fixing. */
function oneCase(word: string): boolean {
  return word === word.toLowerCase() || word === word.toUpperCase();
}

/** Stray punctuation off the ends of a word: "Smith." -> "Smith", "D." -> "D". */
function trimWord(word: string): string {
  return word.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, "");
}

/** Only the letters of a word, for length checks. */
function letters(word: string): string {
  return word.replace(/[^\p{L}\p{M}]/gu, "");
}

/**
 * Tidies a name into "First Last" shape without asking.
 *
 * Lowercase and ALL CAPS words are capitalized ("maria alvarez", "MARIA
 * ALVAREZ" -> "Maria Alvarez"); a word the student capitalized themselves
 * ("McKay", "O'Brien", "DeLuca") is left exactly as typed; lowercase
 * particles inside a surname stay lowercase ("willem van der berg" ->
 * "Willem van der Berg"); "Alvarez, Maria" turns round; stray punctuation at
 * the ends of words goes; spaces collapse.
 */
export function formatName(raw: string): string {
  let text = cleanName(raw);
  // "Smith, Maria" is how a roster writes it. Turn it round.
  const comma = text.split(",");
  if (comma.length === 2 && comma[0].trim() && comma[1].trim()) text = `${comma[1].trim()} ${comma[0].trim()}`;
  const words = text.replace(/,/g, " ").split(/\s+/).map(trimWord).filter(Boolean);
  return words
    .map((word, i) => {
      if (!oneCase(word)) return word;
      const inner = i > 0 && i < words.length - 1;
      if (inner && PARTICLES.has(word.toLowerCase())) return word.toLowerCase();
      return titleCasePart(word);
    })
    .join(" ");
}

/** Does this look like an initial ("D", "D.") rather than a name? */
export function isInitial(word: string): boolean {
  return letters(word).length < 2;
}

/**
 * Validate a full name for signup / profile edits.
 * Returns the formatted name so callers can store exactly what was checked.
 */
export function checkFullName(raw: string): NameCheck {
  const formatted = formatName(raw ?? "");
  const fail = (error: string, field?: "first" | "last"): NameCheck => ({ ok: false, formatted, error, field });

  if (!formatted) return fail("Enter your first and last name.", "first");
  if (formatted.length > MAX_NAME_LENGTH)
    return fail(`Names can be at most ${MAX_NAME_LENGTH} characters.`);
  // Checked on what was typed: tidying drops stray characters at the ends of
  // words, and "sam d2011" should be told about the digits.
  if (/\d/.test(raw ?? "")) return fail("Names can't contain numbers, use your real name.");
  if (/[_@/\\|<>]/.test(raw ?? ""))
    return fail("Use your real name, not a username or email address.");
  if (!NAME_CHARS.test(formatted))
    return fail("Use letters only (hyphens and apostrophes are fine).");
  if (!HAS_LETTER.test(formatted)) return fail("Enter your first and last name.", "first");

  const parts = formatted.split(" ").filter(Boolean);
  if (parts.length < 2) return fail("Please enter both your first and last name.", "last");

  const first = letters(parts[0]);
  const last = parts[parts.length - 1];
  if (first.length < 2) return fail("Your first name looks too short, please spell it out.", "first");
  // "Ivan D." used to be allowed. A roster needs the whole last name.
  if (isInitial(last)) return fail("Please enter your full last name, not just the initial.", "last");

  if (PLACEHOLDERS.has(formatted.toLowerCase())) return fail("Please use your real name.");
  for (const part of parts) {
    const ls = letters(part).toLowerCase();
    if (ls.length >= 3 && new Set(ls).size === 1) return fail("Please use your real name.");
    if (PLACEHOLDERS.has(ls) && parts.length === 2) return fail("Please use your real name.");
  }

  return { ok: true, formatted, error: "" };
}

/**
 * The same check for a form with a First box and a Last box, so the error
 * lands under the box it is about. A whole name typed into the first box with
 * an initial in the second is caught here rather than accepted as
 * "Ivan Dubovyi D".
 */
export function checkNameParts(first: string, last: string): NameCheck {
  const f = formatName(first);
  const l = formatName(last);
  if (!f) return { ok: false, formatted: "", error: "Enter your first name.", field: "first" };
  if (!l) return { ok: false, formatted: f, error: "Enter your full last name.", field: "last" };
  if (isInitial(l))
    return { ok: false, formatted: `${f} ${l}`, error: "Please enter your full last name, not just the initial.", field: "last" };
  const check = checkFullName(`${f} ${l}`);
  if (!check.ok && !check.field && f.split(" ").length > 1 && l.split(" ").length === 1)
    return { ...check, field: "first" };
  return check;
}

/** "Ivan Dubovyi" -> { first: "Ivan", last: "Dubovyi" }, for prefilling a form. A last initial is left blank. */
export function splitName(displayName: string | null | undefined): { first: string; last: string } {
  const parts = formatName(displayName ?? "").split(" ").filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  const last = parts.slice(1).join(" ");
  return { first: parts[0], last: isInitial(parts[parts.length - 1]) && parts.length === 2 ? "" : last };
}

/**
 * Does a stored display name already satisfy the real-name rule?
 *
 * Accounts created before this rule got `email.split("@")[0]` as their name
 * (e.g. "ivan.d2011"), and some later ones carry a last initial ("Ivan D.").
 * Both fail here and are asked once for the full name.
 */
export function isRealName(displayName: string | null | undefined): boolean {
  if (!displayName) return false;
  return checkFullName(displayName).ok;
}

/** "Ivan Dubovyi" -> "ID", for avatar fallbacks. */
export function initialsOf(displayName: string | null | undefined): string {
  const parts = cleanName(displayName ?? "").split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}
