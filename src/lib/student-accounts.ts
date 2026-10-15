/**
 * A teacher makes accounts for their class, for students without one.
 *
 * The teacher pastes one student a line: "First Last", or "First Last,
 * email" for a student who has a school email. A student without an email
 * gets a username (first.last plus four digits) that signs in at
 * USERNAME_DOMAIN. Each account gets a password made here, shown to the
 * teacher once, on cards they print and hand out.
 *
 * The accounts are made the way a student makes their own: a sign-up on the
 * public key, in a separate client that never touches the teacher's own
 * session, then the new account joins the class with its code, so it is in
 * the class the moment it exists (and school-managed, like any member).
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkFullName, formatName } from "@/lib/name";

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

// No 0/O, 1/l/I: these get read off a printed card.
const WORDS = [
  "maple", "river", "comet", "tiger", "panda", "cedar", "orbit", "piano", "lemon", "otter",
  "eagle", "mango", "cloud", "storm", "pearl", "raven", "sunny", "zebra", "bison", "koala",
  "delta", "frost", "grape", "honey", "jelly", "karma", "lunar", "metro", "noble", "ocean",
];

/** Two words and two digits, like "otter-maple-47": easy to type, 8+ characters. */
export function makePassword(randomInts: (n: number) => number[] = cryptoInts): string {
  const [a, b, c] = randomInts(3);
  const w1 = WORDS[a % WORDS.length];
  let w2 = WORDS[b % WORDS.length];
  if (w2 === w1) w2 = WORDS[(b + 1) % WORDS.length];
  const n = String(20 + (c % 80));
  return `${w1}-${w2}-${n}`;
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
  joinCode: string,
  lines: StudentLine[],
  onEach: (made: MadeAccount, done: number) => void
): Promise<MadeAccount[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const results: MadeAccount[] = [];
  for (const l of lines) {
    let made: MadeAccount;
    if (l.error) {
      made = { name: l.name, signIn: l.email ?? "", password: null, error: l.error };
    } else if (!url || !key) {
      made = { name: l.name, signIn: "", password: null, error: "Cloud login is not configured yet." };
    } else {
      made = await createOne(url, key, joinCode, l);
    }
    results.push(made);
    onEach(made, results.length);
  }
  return results;
}

async function createOne(url: string, key: string, joinCode: string, l: StudentLine): Promise<MadeAccount> {
  // Its own client, kept in memory: the teacher stays signed in as themself.
  const client = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "algebridge-teacher-made" },
  });
  const password = makePassword();
  const username = l.email ? null : makeUsername(l.name);
  const email = l.email ?? signInEmail(username!);
  const signIn = username ?? email;
  try {
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: l.name } } });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return {
        name: l.name,
        signIn,
        password: null,
        error: taken ? "That email already has an account. Ask the student to join with the class code." : error.message,
      };
    }
    if (!data.session) return { name: l.name, signIn, password: null, error: "The account was made but could not sign in to join the class." };
    await client.from("profiles").update({ display_name: l.name }).eq("id", data.session.user.id);
    const { error: joinError } = await client.rpc("join_class_by_code", { p_code: joinCode });
    await client.auth.signOut({ scope: "local" });
    if (joinError) return { name: l.name, signIn, password, error: `Made, but not added to the class: ${joinError.message}` };
    return { name: l.name, signIn, password, error: null };
  } catch (e) {
    return { name: l.name, signIn, password: null, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
