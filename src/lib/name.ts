/**
 * Real-name rules for AlgeBridge accounts.
 *
 * AlgeBridge is a school platform: teachers grade a roster, tutors join video
 * calls, and classmates see each other in group chats. Handles like "xX_mathgod"
 * make all three unusable, so every account must carry the student's actual
 * name, a first name plus a last name (a last initial is allowed for privacy).
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
}

/** Collapse whitespace and trim. Does not change capitalization. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Name particles that stay lowercase in the middle of a name. */
const PARTICLES = new Set([
  "van", "von", "der", "den", "de", "del", "della", "di", "da", "dos", "du",
  "la", "le", "bin", "ibn", "af", "av", "ter", "ten", "zu",
]);

function titleCasePart(part: string): string {
  return part.replace(/(^|[-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Light-touch capitalization: fixes "maria alvarez" without mangling names the
 * student capitalized themselves ("McKay", "O'Brien") or lowercase particles
 * inside a surname ("willem van der berg" -> "Willem van der Berg").
 */
export function formatName(raw: string): string {
  const parts = cleanName(raw).split(" ").filter(Boolean);
  // Any capital at all means they typed it deliberately, leave it alone.
  if (parts.some((p) => p !== p.toLowerCase())) return parts.join(" ");
  return parts
    .map((part, i) => {
      const isEdge = i === 0 || i === parts.length - 1;
      if (!isEdge && PARTICLES.has(part)) return part;
      return titleCasePart(part);
    })
    .join(" ");
}

/**
 * Validate a full name for signup / profile edits.
 * Returns the formatted name so callers can store exactly what was checked.
 */
export function checkFullName(raw: string): NameCheck {
  const formatted = formatName(raw ?? "");
  const fail = (error: string): NameCheck => ({ ok: false, formatted, error });

  if (!formatted) return fail("Enter your first and last name.");
  if (formatted.length > MAX_NAME_LENGTH)
    return fail(`Names can be at most ${MAX_NAME_LENGTH} characters.`);
  if (/\d/.test(formatted)) return fail("Names can't contain numbers, use your real name.");
  if (/[_@/\\|<>]/.test(formatted))
    return fail("Use your real name, not a username or email address.");
  if (!NAME_CHARS.test(formatted))
    return fail("Use letters only (hyphens and apostrophes are fine).");
  if (!HAS_LETTER.test(formatted)) return fail("Enter your first and last name.");

  const parts = formatted.split(" ").filter(Boolean);
  if (parts.length < 2) return fail("Please enter both your first and last name.");

  const first = parts[0].replace(/[.'’-]/g, "");
  const last = parts[parts.length - 1].replace(/[.'’-]/g, "");
  if (first.length < 2) return fail("Your first name looks too short, please spell it out.");
  // A last initial ("Ivan D.") is allowed; anything longer must be a real word.
  if (last.length < 1) return fail("Please enter your last name or last initial.");

  if (PLACEHOLDERS.has(formatted.toLowerCase())) return fail("Please use your real name.");
  for (const part of parts) {
    const letters = part.replace(/[^\p{L}]/gu, "").toLowerCase();
    if (letters.length >= 3 && new Set(letters).size === 1)
      return fail("Please use your real name.");
    if (PLACEHOLDERS.has(letters) && parts.length === 2)
      return fail("Please use your real name.");
  }

  return { ok: true, formatted, error: "" };
}

/**
 * Does a stored display name already satisfy the real-name rule?
 *
 * Accounts created before this rule got `email.split("@")[0]` as their name
 * (e.g. "ivan.d2011"), so they fail here and are asked to fix it once.
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
