/**
 * A teacher makes accounts for their class, for students without one.
 *
 * The teacher pastes one student a line: "First Last", or "First Last,
 * email" for a student who has a school email. A student without an email
 * gets a username (first.last plus four digits) that signs in at
 * USERNAME_DOMAIN. Each account gets a password made here, shown to the
 * teacher once, on cards they print and hand out.
 *
 * The accounts are made by the make-student-accounts Edge Function, which
 * checks the caller teaches the class, makes each account already confirmed,
 * and adds it to the class, so it is in the class the moment it exists (and
 * school-managed, like any member).
 */

import { checkFullName, formatName } from "@/lib/name";
import { createClient } from "@/lib/supabase/client";

/** Usernames sign in as <username>@USERNAME_DOMAIN. Nothing is ever mailed there. */
export const USERNAME_DOMAIN = "students.algebridge.org";

/** "maria.lopez4821" signs in as maria.lopez4821@students.algebridge.org; an email signs in as itself. */
export function signInEmail(typed: string): string {
  const t = typed.trim().toLowerCase();
  return t.includes("@") ? t : `${t}@${USERNAME_DOMAIN}`;
}

export interface StudentLine {
  line: number;
  name: string;
  /** The school email, when the teacher gave one. */
  email: string | null;
  error: string | null;
}

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** One student a line: "First Last" or "First Last, email" (a tab works too, for a pasted spreadsheet). */
export function parseStudentLines(text: string): StudentLine[] {
  return text
    .split(/\r?\n/)
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter((l) => l.raw)
    .map(({ raw, line }) => {
      const parts = raw.split(/\s*[,\t;]\s*/).filter(Boolean);
      const emailPart = parts.find((p) => p.includes("@")) ?? null;
      const namePart = parts.filter((p) => p !== emailPart).join(" ");
      const check = checkFullName(namePart);
      let error: string | null = check.ok ? null : check.error;
      if (!error && emailPart && !EMAIL.test(emailPart)) error = "That email doesn't look right.";
      return { line, name: check.ok ? check.formatted : formatName(namePart), email: emailPart?.toLowerCase() ?? null, error };
    });
}

function letters(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** "Maria José López" -> "maria.lopez4821". */
export function makeUsername(name: string, rand: () => number = Math.random): string {
  const parts = name.split(" ").filter(Boolean);
  const first = letters(parts[0] ?? "") || "student";
  const last = letters(parts[parts.length - 1] ?? "") || "student";
  const digits = String(1000 + Math.floor(rand() * 9000));
  return `${first}.${last}`.slice(0, 40) + digits;
}

// Lowercase words only, and digits 2 to 9, so nothing on a printed card can
// be misread (no 0/O, no 1/l/I). No two words are one letter apart.
// 227 words, three of them, and two digits: about 750 million passwords.
export const WORDS = [
  "maple", "river", "comet", "tiger", "panda", "cedar", "orbit", "piano", "lemon", "otter",
  "eagle", "mango", "cloud", "storm", "pearl", "raven", "sunny", "zebra", "bison", "koala",
  "delta", "frost", "grape", "honey", "jelly", "lunar", "metro", "noble", "ocean", "acorn",
  "anchor", "apple", "apron", "arrow", "aspen", "atlas", "badge", "bagel", "bamboo", "banjo",
  "basil", "beacon", "berry", "blaze", "bloom", "blossom", "bongo", "branch", "brave", "breeze",
  "brick", "bridge", "brook", "bubble", "bucket", "butter", "cactus", "camel", "candle",
  "canoe", "canyon", "cherry", "chess", "chirp", "cider", "circus", "citrus", "clover",
  "cobalt", "cocoa", "coral", "cotton", "cozy", "crayon", "cricket", "crown", "crystal",
  "cupcake", "daisy", "dance", "desert", "dingo", "dolphin", "donut", "dragon", "dream", "drum",
  "dune", "fable", "falcon", "feather", "fern", "fiddle", "field", "flame", "flute", "forest",
  "fossil", "fox", "galaxy", "garden", "gecko", "giant", "ginger", "glacier", "globe", "gnome",
  "goose", "gravy", "guitar", "hammock", "harbor", "hawk", "hazel", "heron", "hiker", "hippo",
  "hollow", "jaguar", "jasmine", "jigsaw", "jungle", "kayak", "kettle", "kiwi", "ladder",
  "lagoon", "lantern", "lava", "lilac", "llama", "lobster", "magnet", "marble", "meadow",
  "melon", "meteor", "mint", "mitten", "monkey", "mosaic", "nectar", "nest", "noodle", "nugget",
  "oasis", "olive", "onion", "opal", "owl", "paddle", "pancake", "parrot", "pasta", "peach",
  "pebble", "pepper", "pickle", "pigeon", "pine", "planet", "plum", "pony", "popcorn", "poppy",
  "pretzel", "puffin", "pumpkin", "puzzle", "quail", "quartz", "quill", "rabbit", "radish",
  "rainbow", "ranger", "ribbon", "robin", "rocket", "salmon", "sandal", "satin", "scarf",
  "shell", "sierra", "silver", "sketch", "sled", "snail", "spark", "sparrow", "spruce", "squid",
  "star", "sugar", "summit", "swan", "taco", "teapot", "thistle", "thunder", "tiki", "toast",
  "tomato", "topaz", "tornado", "tulip", "tundra", "turtle", "tuxedo", "velvet", "violet",
  "volcano", "waffle", "walnut", "walrus", "willow", "window", "winter", "wizard", "wombat",
  "yak", "yarn", "yeti", "yogurt", "yoyo", "zinnia",
];

/** Three words and two digits, like "otter-maple-comet-47": easy to type, hard to guess. */
export function makePassword(randomInts: (n: number) => number[] = cryptoInts): string {
  const r = randomInts(5);
  const picked: string[] = [];
  for (let i = 0; i < 3; i++) {
    let k = (r[i] ?? 0) % WORDS.length;
    while (picked.includes(WORDS[k])) k = (k + 1) % WORDS.length;
    picked.push(WORDS[k]);
  }
  const digit = (x: number | undefined) => String(2 + ((x ?? 0) % 8));
  return `${picked.join("-")}-${digit(r[3])}${digit(r[4])}`;
}

function cryptoInts(n: number): number[] {
  const out = new Uint32Array(n);
  globalThis.crypto.getRandomValues(out);
  return [...out];
}

export interface MadeAccount {
  name: string;
  /** What the student types to sign in: their username, or their email. */
  signIn: string;
  password: string | null;
  error: string | null;
}

/** Make the accounts one at a time (the auth server limits bursts), reporting each as it lands. */
export async function createStudentAccounts(
  classId: string,
  lines: StudentLine[],
  onEach: (made: MadeAccount, done: number) => void
): Promise<MadeAccount[]> {
  const supabase = createClient();
  const results: MadeAccount[] = [];
  for (const l of lines) {
    let made: MadeAccount;
    if (l.error) {
      made = { name: l.name, signIn: l.email ?? "", password: null, error: l.error };
    } else if (!supabase) {
      made = { name: l.name, signIn: "", password: null, error: "Cloud login is not configured yet." };
    } else {
      made = await createOne(supabase, classId, l);
    }
    results.push(made);
    onEach(made, results.length);
  }
  return results;
}

async function createOne(supabase: NonNullable<ReturnType<typeof createClient>>, classId: string, l: StudentLine): Promise<MadeAccount> {
  const password = makePassword();
  const username = l.email ? null : makeUsername(l.name);
  const signIn = username ?? l.email!;
  try {
    // The account is made on the server, already confirmed, so the teacher
    // stays signed in as themself and public sign-ups can still require a
    // confirmed email (supabase/functions/make-student-accounts).
    const { data, error } = await supabase.functions.invoke("make-student-accounts", {
      body: { classId, name: l.name, email: l.email, username, password },
    });
    if (error) return { name: l.name, signIn, password: null, error: "Something went wrong. Try again in a minute." };
    const res = data as { error: string | null; id?: string };
    if (!res.id) return { name: l.name, signIn, password: null, error: res.error ?? "The account could not be made." };
    return { name: l.name, signIn, password, error: res.error };
  } catch (e) {
    return { name: l.name, signIn, password: null, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
