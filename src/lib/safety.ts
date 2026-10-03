/**
 * Student safety where students talk to people: direct messages, group
 * chats, calls and profiles.
 *
 * Three things live here, all pure and testable offline (the tests are the
 * safety block at the end of src/lib/__tests__/helper.test.ts):
 *
 *   1. The personal information guard. Before a message is sent, it looks
 *      for phone numbers, email addresses, street addresses, social media
 *      usernames, links to other sites, invitations to talk somewhere else,
 *      and requests to keep a chat secret. A student's message with any of
 *      them is not sent; a staff member gets a warning they can override,
 *      except for secrecy, which the app never sends to a student. It also
 *      reads the sender's last few messages joined to the new one, so a
 *      number sent in pieces is caught. This guard runs in the app: a
 *      client that writes to the database directly skips it.
 *   2. Reports. The reasons a student can pick, how a report is checked on
 *      the server, and how it is written into the feedback table.
 *   3. Blocks on this device. The list of people a student has blocked,
 *      kept in this browser's localStorage. The server-side block is the
 *      user_blocks table in supabase/schema-2026-10-03-safety.sql.
 *
 * The database has its own, narrower guard: a trigger in the same migration
 * refuses a student's message holding a phone number or an email address
 * (invisible characters removed and every script's digits read as 0 to 9,
 * and joined to the sender's last three messages there too), whatever
 * client sent it.
 */

// ---------------------------------------------------------------------------
// 1. Personal information
// ---------------------------------------------------------------------------

export type PersonalInfoKind = "phone" | "email" | "address" | "handle" | "link" | "off-platform" | "secrecy";

export interface PersonalInfoHit {
  kind: PersonalInfoKind;
  /** The text that matched, as the guard read it (lower case). */
  match: string;
}

/** How each kind is named in the message a student sees. */
export const PERSONAL_INFO_LABELS: Record<PersonalInfoKind, string> = {
  phone: "a phone number",
  email: "an email address",
  address: "a home address",
  handle: "a social media username",
  link: "a link to another site",
  "off-platform": "a plan to talk somewhere else or a personal question",
  secrecy: "a request to keep something secret",
};

/** Kinds a staff member may still send after a warning. Secrecy is never sent. */
const STAFF_OVERRIDABLE = new Set<PersonalInfoKind>(["phone", "email", "address", "handle", "link", "off-platform"]);

/**
 * Characters that print as nothing (zero-width spaces and joiners, soft
 * hyphens, direction marks). "302<zero-width space>555<zero-width space>0142"
 * reads as a phone number on screen, so the guard reads it as one too.
 */
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁤⁪-⁯ㅤ︀-️﻿ﾠ]/g;

/** Letters from other alphabets that imitate Latin ones ("snаp" with a Cyrillic а). */
const LOOKALIKE: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ӏ": "l",
  "ο": "o", "α": "a", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
};
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKE).join("")}]`, "g");

/**
 * Every decimal digit, in any script, as 0 to 9: Arabic-Indic "٣٠٢" is 302.
 * Unicode keeps each script's digits in a run of ten starting at zero, so a
 * digit's value is its distance from the start of its run.
 */
export function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (d) => {
    if (d >= "0" && d <= "9") return d;
    const cp = d.codePointAt(0)!;
    let start = cp;
    while (cp - start < 60 && /\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
    return String((cp - start) % 10);
  });
}

/**
 * Text as the guard reads it: invisible characters taken out, accents and
 * full-width characters folded (NFKD), look-alike letters read as Latin,
 * digits of every script read as 0 to 9, lower case, curly quotes
 * straightened, and the many dashes made one.
 */
export function guardText(text: string): string {
  return asciiDigits(
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(INVISIBLE, "")
      .replace(LOOKALIKE_RE, (c) => LOOKALIKE[c] ?? c)
  )
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The same text with the disguises taken off, for the patterns that look for
 * usernames and invitations: symbols inside a word read as the letter they
 * stand for ("sn@p"), letters spelled out with gaps joined ("s n a p",
 * "s.n.a.p"), and an arrow read as a colon.
 */
function squash(t: string): string {
  return t
    .replace(/(?<=[a-z])[@4](?=[a-z])/g, "a")
    .replace(/(?<=[a-z])0(?=[a-z])/g, "o")
    .replace(/(?<=[a-z])[1!|](?=[a-z])/g, "i")
    .replace(/(?<=[a-z])3(?=[a-z])/g, "e")
    .replace(/(?<=[a-z])\$(?=[a-z])/g, "s")
    .replace(/\b[a-z](?:[\s.*_-][a-z]\b){2,}/g, (m) => m.replace(/[\s.*_-]/g, ""))
    .replace(/\s*(?:→|->|=>)\s*/g, ": ");
}

/** Digits spelled as words, and a letter o beside digits, read as digits: "302-five five five-o142". */
const DIGIT_WORDS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", niner: "9",
};
function digitWordsAsDigits(t: string): string {
  return t
    .replace(/(?<![a-z])(zero|oh|one|two|three|four|five|six|seven|eight|niner|nine)(?![a-z])/g, (w) => DIGIT_WORDS[w] ?? w)
    .replace(/(?<=\d)o|o(?=\d)/g, "0");
}

/**
 * Phone numbers broken into groups some other way: "302 555 01 42",
 * "302-5 5 5-0142" (after digitWordsAsDigits). A run of digit groups joined by
 * single spaces, dots, dashes, slashes or underscores that starts with a
 * three-digit area code and holds ten digits in all (eleven with a leading 1).
 * Commas never join, so a list like "20, 22, 24, 26, 28" stays math.
 */
const DIGIT_RUN = /(?<![\d.,])\+?\d+(?:[ ._/-]\d+)+(?![\d])/g;
function groupedPhones(t: string): string[] {
  const out: string[] = [];
  for (const m of t.matchAll(DIGIT_RUN)) {
    const groups = m[0].replace(/^\+/, "").split(/[ ._/-]/);
    const digits = groups.join("");
    if (groups.length > 6) continue;
    const ten = digits.length === 10 && /^[2-9]/.test(digits) && groups[0].length === 3;
    const eleven = digits.length === 11 && digits[0] === "1" && (groups[0].length === 1 || groups[0].length === 4);
    if (ten || eleven) out.push(m[0]);
  }
  return out;
}

/** A link's host name, or null when it does not read as a link. */
function linkHost(raw: string): string | null {
  let s = raw.trim().replace(/[).,;!?]+$/, "");
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
  try {
    return new URL(s).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Links to AlgeBridge itself are fine: a tutor pointing at a lesson. Read
 * from the link's real host, so "evil.com/algebridge.org" and
 * "algebridge.org.evil.com" are other sites, and so is "algebridge.org@evil.com".
 */
export function isOwnSiteLink(raw: string): boolean {
  const host = linkHost(raw);
  return !!host && (host === "algebridge.org" || host.endsWith(".algebridge.org"));
}

// --- phone numbers ----------------------------------------------------------

// 302-555-0142, (302) 555 0142, +1 302.555.0142, 3025550142
const PHONE_TEN = /(?<![\d.])(?:\+?1[\s._/-]*)?\(?\s*[2-9]\d{2}\s*\)?[\s._/-]*\d{3}[\s._/-]*\d{4}(?![\d])/g;
// +44 7700 900123: a plus sign and eight or more digits.
const PHONE_INTL = /(?<![\w.])\+\d{1,3}[\s.-]*\d(?:[\s.-]*\d){6,13}(?![\d])/g;
// 07700900123: a number that starts with 0 and runs ten or eleven digits.
const PHONE_ZERO = /(?<![\d.,])0\d{9,10}(?![\d.])/g;
// 555-0142 is only a phone number when the message talks about calling or texting.
const PHONE_SEVEN = /(?<![\d.])\d{3}[\s.-]\d{4}(?![\d.])/g;
const PHONE_CONTEXT = /\b(?:call|calling|text|txt|texting|phone|cell|digits|hmu|reach me|ring me|my number|my num)\b|my #/;
// 3 0 2 5 5 5 0 1 4 2: seven or more single digits with gaps.
const PHONE_SPACED = /(?<![\d.])(?:\d[\s.-]+){6,}\d(?![\d.])/g;
// three oh two five five five ...: seven or more digits spelled out.
const DIGIT_WORD = "(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|niner)";
const PHONE_WORDS = new RegExp(`\\b${DIGIT_WORD}(?:[\\s,.-]+${DIGIT_WORD}\\b){6,}`, "g");

// --- email ------------------------------------------------------------------

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/g;
// jay (at) gmail (dot) com, jay at gmail dot com, jay[at]yahoo.com
const EMAIL_SPELLED =
  /\b[a-z0-9._%+-]{2,}\s*(?:\(at\)|\[at\]|\{at\}|\bat\b)\s*(?:gmail|yahoo|ymail|hotmail|outlook|icloud|aol|proton(?:mail)?|live|msn|me|mac|comcast|verizon|att|gmx|mail)\s*(?:\.|\(dot\)|\[dot\]|\{dot\}|\bdot\b)\s*(?:com|net|org|edu|us|me)\b/g;
const EMAIL_MINE = /\bmy\s+(?:e-?mail|gmail|icloud|hotmail|outlook|yahoo)\s*(?:address\s*|adress\s*)?(?:is\b|=|:)/g;
// jay at gmail, jaysmith on gmail, jay.smith@gmail, jay at g mail dot com, jay at gmailcom
const EMAIL_PROVIDER =
  /\b[a-z0-9._%+-]{2,}\s*(?:@|\(at\)|\[at\]|\{at\}|\bat\b|\bon\b)\s*(?:g ?mail|yahoo|ymail|hotmail|outlook|icloud|aol|proton(?:mail)?|gmx)(?:\s*(?:\.|\bdot\b)?\s*(?:com|net|me))?\b/g;

// --- street addresses ---------------------------------------------------------

const STREET_SUFFIX =
  "(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|terrace|circle|parkway|pkwy|highway|hwy|trail|pike|alley)";
const STREET = new RegExp(`\\b(\\d{1,6})\\s+((?:[a-z0-9]+\\.?\\s+){1,3})${STREET_SUFFIX}\\b\\.?`, "g");
// Words that put "3 more ways" or "2 sides of the road" in a math sentence, not an address.
const NOT_A_STREET_NAME = new Set([
  "of", "the", "a", "an", "to", "in", "on", "at", "for", "and", "or", "by", "is", "are", "was", "be", "it", "its",
  "more", "other", "different", "easy", "easier", "simple", "same", "best", "better", "only", "another", "this",
  "that", "these", "those", "step", "steps", "side", "sides", "times", "ways", "my", "your", "our", "their",
  "math", "x", "y", "minus", "plus", "equals", "divided", "times", "squared", "cubed", "over", "less", "greater",
  "than", "units", "unit", "feet", "miles", "meters", "inches", "hours", "minutes", "cars", "people", "kids",
  "decimal", "numbers", "number", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "hundred", "thousand", "whole", "right", "wrong", "correct", "simpler", "faster", "quick", "quicker", "good",
]);
const ADDRESS_CONTEXT =
  /\b(?:i live (?:at|on)|my (?:home |house |street )?(?:address|adress) (?:is|=)|my (?:house|home) is (?:at|on)|my street is|come (?:over )?to my (?:house|place)|my zip(?: code)? is|zip code is|apartment (?:number|#)|apt (?:number|#|\d))/g;

// --- usernames and links -----------------------------------------------------

// Anywhere a conversation could move to.
const PLATFORM =
  "(?:snap(?:chat)?|sc|insta(?:gram)?|ig|tik ?tok|discord|whats ?app|telegram|kik|facebook|fb|messenger|twitter|roblox|fortnite|xbox|psn|playstation|steam|wechat|skype|twitch|reddit|youtube|minecraft|bereal|pinterest|vsco|google meet|zoom)";
// Where a student would have a username. Kept to apps, not everyday words
// ("my line" is a graph, "my signal" is wifi).
const HANDLE_APP =
  "(?:snap(?:chat)?|sc|insta(?:gram)?|ig|tik ?tok|discord|whats ?app|telegram|kik|facebook|fb|twitter|roblox|xbox|psn|steam|bereal|vsco|twitch|skype)";
const HANDLE_AT = /(?<![a-z0-9._%+-])@[a-z0-9_.]{3,30}\b/g;
const HANDLE_MINE = new RegExp(`\\bmy\\s+(?:${HANDLE_APP}|user ?name|gamer ?tag)\\b`, "g");
const HANDLE_IS = new RegExp(
  `\\b${HANDLE_APP}\\s*(?:user ?name|user|id|handle|name|tag|@|:|=|->)\\s*(?:is\\s*)?@?[a-z0-9_.]{3,30}\\b`,
  "g"
);
// snap jay2010, ig jay_r, tt: jay2010. The name must hold a digit, a dot or an
// underscore, so "snap a picture of the graph" is not a username.
const HANDLE_BARE =
  /\b(?:snap(?:chat)?|insta(?:gram)?|ig|tik ?tok|tt|discord|kik|roblox|xbox|psn|steam|twitch|telegram|whats ?app)\s*[:=-]?\s*@?[a-z][a-z0-9_.]*[\d_.][a-z0-9_.]*\b/g;
// add me jay2010 on snap
const HANDLE_ADD = new RegExp(`\\badd me\\s+@?[a-z0-9_.]{3,30}\\s+(?:on|at)\\s+${"(?:snap(?:chat)?|sc|insta(?:gram)?|ig|tik ?tok|discord|roblox|xbox|psn|steam|kik)"}\\b`, "g");
// discord jay#1234, jay#1234
const HANDLE_TAG = /\b[a-z][a-z0-9_.]{1,31}#\d{4}\b/g;

const LINK_URL = /\b(?:https?:\/\/|www\.)\S+/g;
const LINK_DOMAIN =
  /\b[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63})*\.(?:com|net|org|io|gg|me|co|ly|app|xyz|tv|us|info|biz|link|site|online|dev|page|chat|social|edu|gov)\b(?:\/\S*)?/g;

// --- talking somewhere else, and secrecy ---------------------------------------

const OFF_PLATFORM: RegExp[] = [
  // text me, snap me, facetime me, email me. ("dm me" is AlgeBridge's own messages.)
  /\b(?:text|txt|snap|snapchat|facetime|ft|whatsapp|skype|discord|insta|kik|telegram|email|e-mail|mail)\s+me\b/,
  /\bhmu\b/,
  /\bhit me up\b/,
  // message me on discord, talk on snap, chat on insta, join my discord
  new RegExp(`\\b(?:message|msg|talk|chat|text|call|add|follow|find|meet|join|play|dm)\\s+(?:me\\s+|us\\s+)?(?:on|at|in|over|via|through)\\s+${PLATFORM}\\b`),
  new RegExp(`\\b(?:join|add)\\s+(?:my|our)\\s+(?:${PLATFORM}|server|group chat|gc)\\b`),
  /\b(?:talk|chat|text|message|move|switch|go)\s+(?:somewhere else|outside (?:of )?(?:here|this|the app|algebridge)|off (?:of )?(?:here|this|the app|algebridge)|in private|privately|on (?:another|a different|some other) app)\b/,
  // where do you live, what school do you go to
  /\bwhere (?:do|did) (?:you|u) (?:live|stay|go to school)\b/,
  /\b(?:what|which|wat|wut)\s+(?:school|middle school|high school)\s+(?:do|did|are|r)\s+(?:you|u)\b/,
  /\bwhere (?:do|did) (?:you|u) go to school\b/,
  /\bwhat'?s? (?:is )?(?:your|ur|yo) (?:school|address|adress|number|phone|phone number|cell|snap|snapchat|insta|instagram|ig|discord|tiktok|email|e-mail|username|user name|gamertag|last name|real name|location)\b/,
  /\b(?:send|give|tell|dm|text)\s+(?:me\s+)?(?:your|ur|yo)\s+(?:number|phone|cell|address|adress|snap|snapchat|insta|ig|discord|email|e-mail|location|pic|pics|picture|pictures|photo|photos|selfie)\b/,
  /\b(?:can|could|may) i (?:have|get) (?:your|ur) (?:number|phone|cell|address|snap|snapchat|insta|ig|discord|email)\b/,
  /\b(?:send|show) (?:me )?(?:a |some )?(?:pic|pics|picture|pictures|photo|photos|selfie|selfies) of (?:you|u|yourself)\b/,
  /\bmeet (?:me |up |in person|irl|after school)\b|\bmeet up\b/,
  /\b(?:are|r) (?:you|u) (?:home )?alone\b/,
  // where u live, wya, what school u go to, how old are you, are your parents home
  /\bwhere (?:do |did )?(?:you|u) (?:live|stay|at)\b/,
  /\bwya\b/,
  /\b(?:what|which|wat|wut)\s+(?:school|middle school|high school)\s+(?:(?:do|did|are|r)\s+)?(?:you|u)\b/,
  /\bhow old (?:are|r) (?:you|u)\b/,
  /\b(?:are|r|is) (?:your|ur|yo) (?:parents?|mom|dad|mum|family|folks) (?:home|there|around|out|away|gone)\b/,
  // wats ur snap, whats ur sc, drop ur snap, u got snap?, do you have snapchat
  /\b(?:what|wat|wut)'?s?\s+(?:is\s+)?(?:your|ur|yo|u r)\s+(?:snap(?:chat)?|sc|insta(?:gram)?|ig|discord|tik ?tok|tt|number|num|digits|phone|cell|e-?mail|address|addy|school|last name|real name|location|age)\b/,
  /\b(?:drop|send|give|share|post|dm)\s+(?:me\s+)?(?:your|ur|yo|u r)\s+(?:snap(?:chat)?|sc|insta(?:gram)?|ig|discord|tik ?tok|tt|number|num|digits|phone|cell|e-?mail|address|addy|location|pic|pics|selfie)\b/,
  /\b(?:do (?:you|u) have|(?:you|u) (?:got|have)|got)\s+(?:a\s+)?(?:snap(?:chat)?|insta(?:gram)?|discord|tik ?tok|whats ?app|kik|telegram|sc|ig)\b/,
  // send pics, send a pic, send me a selfie (not "send a pic of your work")
  /\bsend (?:me )?(?:a |some |more |ur |your )?(?:pic|pics|picture|pictures|photo|photos|selfie|selfies|nudes)\b(?! of (?:the|your|ur|this|that) (?:work|homework|problem|answer|graph|notes|worksheet|steps|board|whiteboard)\b)/,
  /\b(?:hang out|hangout|chill|link up|meet) (?:irl|in person|in real life|sometime|after school|this weekend|tonight|tomorrow)\b/,
];
const SECRECY: RegExp[] = [
  /\b(?:don'?t|do not|dont|never) tell (?:your|ur) (?:parents?|mom|mum|dad|mother|father|teacher|family|guardian|counselor)\b/,
  /\bkeep (?:this|it|our chat|this chat|these messages) (?:a )?secret\b/,
  /\bour (?:little )?secret\b/,
  /\ba secret between (?:us|you and me|me and you)\b/,
  /\b(?:this|it) (?:stays|is|will stay|stay) between (?:us|you and me|me and you)\b/,
  /\bjust between (?:us|you and me|me and you)\b/,
  /\bdelete (?:this|these|our|the) (?:message|messages|chat|texts?) (?:after|so|before)\b/,
  // keep this between us, don't tell anyone, no one needs to know, you can't
  // tell your parents, delete this after you read it, don't show this to anyone
  /\bkeep (?:this|it|that|these|our chat) (?:between us|between (?:you and me|me and you)|to yourself|on the down ?low|quiet|private|hidden)\b/,
  // (Followed by the end of the sentence or "about this", so "don't tell anyone
  // the answer, let them try" and "no one has to know it by heart" are math.)
  /\b(?:don'?t|do not|never|can'?t|cannot|shouldn'?t|should not|mustn'?t|must not) (?:tell|show|mention (?:this |it )?to) (?:anyone|anybody|no one|nobody|any1)(?=\s*(?:$|[.!?,]|about\b|that\b|what\b|this\b|ok\b|okay\b|pls\b|please\b|lol\b|i\b|we\b|ever\b))/,
  /\b(?:you|u) (?:can'?t|cannot|shouldn'?t|should not|mustn'?t|must not|better not) (?:tell|show) (?:your|ur) (?:parents?|mom|mum|dad|mother|father|teacher|family|guardian|counselor|folks)\b/,
  /\b(?:no one|noone|nobody|no1) (?:needs|has|have|got|gets) to (?:know|find out)(?=\s*(?:$|[.!?,]|about\b|that\b|what\b|this\b|we\b|you\b|u\b))/,
  /\bdelete (?:this|these|it|that|our|the)\s*(?:message|messages|chat|texts?|convo|conversation)?\s*(?:after|once|when|before|right after)\s+(?:you|u)\b/,
  /\bdon'?t show (?:this|it|that|these) to (?:anyone|anybody|your|ur)\b/,
];

/** "call me" is an invitation, but "you can call me Sam" is a name. */
const CALL_ME = /\bcall me\b(?:\s+([a-z']+))?/g;
const CALL_ME_INVITES = new Set(["at", "on", "later", "tonight", "now", "after", "when", "sometime", "back", "asap", "pls", "please", "plz", "tmrw", "tomorrow", "today", "anytime", "whenever", "if"]);

function addAll(out: PersonalInfoHit[], kind: PersonalInfoKind, re: RegExp, t: string, keep: (m: RegExpExecArray) => boolean = () => true) {
  re.lastIndex = 0;
  if (!re.global) {
    const m = re.exec(t);
    if (m && keep(m)) out.push({ kind, match: m[0].trim() });
    return;
  }
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (keep(m)) out.push({ kind, match: m[0].trim() });
    if (m[0].length === 0) re.lastIndex += 1;
  }
}

/**
 * Everything in a message that shares personal information or moves the
 * conversation off AlgeBridge. Empty when the message is fine. Broad on
 * purpose: a student whose message is held back loses a few seconds; a
 * phone number that gets through cannot be taken back.
 */
export function detectPersonalInfo(text: string): PersonalInfoHit[] {
  const t = guardText(text);
  if (!t) return [];
  const out: PersonalInfoHit[] = [];

  // "jay @ gmail . com": the spaces around @ and the dots closed up.
  const collapsed = t.replace(/\s*@\s*/g, "@").replace(/(?<=[a-z0-9])\s*\.\s*(?=[a-z]{2,}\b)/g, ".");
  addAll(out, "email", EMAIL, t);
  addAll(out, "email", EMAIL, collapsed);
  addAll(out, "email", EMAIL_SPELLED, t);
  addAll(out, "email", EMAIL_MINE, t);
  addAll(out, "email", EMAIL_PROVIDER, t);
  // An email address holds a domain; do not count it twice as a link.
  const noEmail = t.replace(EMAIL, " ");
  const plain = squash(noEmail);
  const digits = digitWordsAsDigits(noEmail);

  addAll(out, "phone", PHONE_TEN, noEmail);
  addAll(out, "phone", PHONE_TEN, digits);
  if (PHONE_CONTEXT.test(noEmail)) addAll(out, "phone", PHONE_SEVEN, noEmail);
  addAll(out, "phone", PHONE_SPACED, noEmail);
  addAll(out, "phone", PHONE_WORDS, noEmail);
  addAll(out, "phone", PHONE_INTL, noEmail);
  addAll(out, "phone", PHONE_ZERO, noEmail);
  for (const m of groupedPhones(digits)) out.push({ kind: "phone", match: m });

  addAll(out, "address", STREET, noEmail, (m) => {
    const words = m[2].trim().split(/\s+/).map((w) => w.replace(/\.$/, ""));
    return words.every((w) => !NOT_A_STREET_NAME.has(w) && !/^\d+$/.test(w));
  });
  addAll(out, "address", ADDRESS_CONTEXT, noEmail);

  addAll(out, "handle", HANDLE_AT, noEmail);
  for (const s of [noEmail, plain]) {
    addAll(out, "handle", HANDLE_MINE, s);
    addAll(out, "handle", HANDLE_IS, s);
    addAll(out, "handle", HANDLE_BARE, s);
    addAll(out, "handle", HANDLE_ADD, s);
  }
  addAll(out, "handle", HANDLE_TAG, noEmail);

  // "www dot discord dot gg slash abc" read as the link it spells.
  const spelled = noEmail
    .replace(/\s+dot\s+/g, ".")
    .replace(/\s+slash\s+/g, "/")
    .replace(/(?<=[a-z0-9])\s+\.\s*(?=[a-z]{2,}\b)|(?<=[a-z0-9])\s*\.\s+(?=[a-z]{2,}\b)/g, ".")
    .replace(/(?<=\.[a-z]{2,})\s*\/\s*/g, "/");
  for (const s of [noEmail, spelled]) {
    addAll(out, "link", LINK_URL, s, (m) => !isOwnSiteLink(m[0]));
    addAll(out, "link", LINK_DOMAIN, s, (m) => !isOwnSiteLink(m[0]) && !/^\d/.test(m[0]));
  }

  for (const s of [noEmail, plain]) {
    for (const re of OFF_PLATFORM) addAll(out, "off-platform", new RegExp(re.source, "g"), s);
  }
  addAll(out, "off-platform", CALL_ME, noEmail, (m) => !m[1] || CALL_ME_INVITES.has(m[1]));

  for (const re of SECRECY) addAll(out, "secrecy", new RegExp(re.source, "g"), noEmail);

  // One hit per kind and text.
  const seen = new Set<string>();
  return out.filter((h) => {
    const key = `${h.kind}:${h.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type GuardVerdict =
  | { action: "send" }
  /** Not sent. The student is told why, kindly. */
  | { action: "block"; kinds: PersonalInfoKind[]; message: string }
  /** A staff member is warned and may send it anyway. */
  | { action: "warn"; kinds: PersonalInfoKind[]; message: string };

function listKinds(kinds: PersonalInfoKind[]): string {
  const labels = kinds.map((k) => PERSONAL_INFO_LABELS[k]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * What happens to a message before it is sent. Students: anything the guard
 * finds holds the message back, with a plain reason. Staff: a warning they
 * can override, because a teacher may need to share a school phone line,
 * except a request for secrecy, which is held back for everyone.
 */
export function guardMessage(text: string, opts: { staff: boolean }): GuardVerdict {
  const hits = detectPersonalInfo(text);
  if (hits.length === 0) return { action: "send" };
  const kinds = [...new Set(hits.map((h) => h.kind))];
  if (opts.staff && kinds.every((k) => STAFF_OVERRIDABLE.has(k))) {
    return {
      action: "warn",
      kinds,
      message: `This looks like it shares ${listKinds(kinds)}. Students on AlgeBridge are minors, so keep contact here, where it can be seen and reported. Send it anyway only if a student truly needs it.`,
    };
  }
  if (opts.staff) {
    return {
      action: "block",
      kinds,
      message: `Not sent: it looks like it holds ${listKinds(kinds.filter((k) => !STAFF_OVERRIDABLE.has(k)))}, and AlgeBridge never sends that to a student.`,
    };
  }
  return {
    action: "block",
    kinds,
    message: `Not sent: it looks like it has ${listKinds(kinds)}. To keep everyone safe, messages here can't share contact details or move the chat somewhere else. Take that part out and try again. If someone asked you for this, you can say no and report them.`,
  };
}

/**
 * A phone number sent a piece at a time ("302", then "555", then "0142") is
 * still a phone number. The guard also reads the sender's last few messages in
 * this conversation, sent in the last ten minutes, joined to the new one. The
 * database trigger in supabase/schema-2026-10-03-safety.sql does the same.
 */
export const SPLIT_WINDOW_MS = 10 * 60 * 1000;
export const SPLIT_MESSAGES = 3;

/** The sender's own recent messages the split check reads, oldest first. */
export function recentForGuard(
  messages: { senderId: string; body: string; createdAt: string }[],
  myId: string | null | undefined,
  now: number = Date.now()
): string[] {
  if (!myId) return [];
  return messages
    .filter((m) => m.senderId === myId && now - Date.parse(m.createdAt) <= SPLIT_WINDOW_MS)
    .slice(-SPLIT_MESSAGES)
    .map((m) => m.body);
}

/**
 * guardMessage, reading the new message on its own and then joined to the
 * sender's recent ones (recentForGuard). Only what the joining adds counts, so
 * something a staff member already chose to send is not held against the next
 * message.
 */
export function guardWithRecent(text: string, recent: string[], opts: { staff: boolean }): GuardVerdict {
  const alone = guardMessage(text, opts);
  if (alone.action !== "send" || recent.length === 0) return alone;
  const key = (h: PersonalInfoHit) => `${h.kind}:${h.match.replace(/\s+/g, "")}`;
  const before = new Set(detectPersonalInfo(recent.join(" ")).map(key));
  const added = detectPersonalInfo([...recent, text].join(" ")).filter((h) => !before.has(key(h)));
  if (added.length === 0) return alone;
  const joined = guardMessage(added.map((h) => h.match).join(" "), opts);
  if (joined.action === "send") return alone;
  return {
    ...joined,
    message: `${joined.message} (This reads your last few messages together, so a number sent in pieces counts too.)`,
  };
}

/**
 * Free text that other people will read outside a chat: an answer in Archie's
 * Book a tutor form, which every tutor can read, or a profile bio, which
 * every student sees on a tutor's card. The same guard as a student's
 * message, with words that fit the place. Null when the text is fine.
 */
export function guardFreeText(text: string, place: "booking" | "bio"): string | null {
  const hits = detectPersonalInfo(text);
  if (hits.length === 0) return null;
  const kinds = listKinds([...new Set(hits.map((h) => h.kind))]);
  return place === "booking"
    ? `I left that out: it looks like it has ${kinds}, and tutors can read what goes in a booking. Just tell me the days and times that work, and you can talk with your tutor here in AlgeBridge.`
    : `Not saved: your bio looks like it has ${kinds}. Bios are shown to students, so keep contact details and other apps out of it.`;
}

/**
 * A refused send, in plain words. The database answers with Postgres's own
 * text ("new row violates row-level security policy for table
 * \"direct_messages\""), which means nothing to a 12 year old. Who blocked
 * whom is never said, so a block cannot be detected from this message.
 */
export function sendErrorText(raw: string | null | undefined): string {
  const text = raw ?? "";
  if (/phone numbers? or email/i.test(text) || /\b22023\b/.test(text)) {
    return "Not sent: messages from students can't include phone numbers or email addresses, even split across a few messages.";
  }
  if (/row-level security|42501|permission denied/i.test(text)) {
    return "This message could not be sent. On AlgeBridge, students and tutors or teachers can only message each other when they are working together.";
  }
  if (/fetch|network|timeout|Failed to/i.test(text)) return "That did not send. Check your connection and try again.";
  return text ? "That did not send. Try again in a moment." : "That did not send. Try again.";
}

// ---------------------------------------------------------------------------
// 2. Reports
// ---------------------------------------------------------------------------

export const REPORT_REASONS = [
  { id: "bullying", label: "Bullying or harassment" },
  { id: "personal-info", label: "Asked for personal information" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "uncomfortable", label: "Made me uncomfortable" },
  { id: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

/** Where the report was made: a direct message thread, a group chat, a call or a profile. */
export type ReportPlace = "dm" | "group" | "call" | "profile";

export interface ReportInput {
  reason: ReportReason;
  details?: string;
  /** The person being reported, when there is one. */
  reportedUserId: string | null;
  place: ReportPlace;
  /** The thread, group or room id. */
  placeId: string;
  /**
   * What the reporter saw, as their client sent it. Only kept for a report
   * without a message id; the database replaces it with its own copy of the
   * message whenever messageId is given (see the report trigger in
   * supabase/schema-2026-10-03-safety.sql), so a report cannot quote a
   * message that was never sent.
   */
  excerpt?: string | null;
  /**
   * The reported message's id, in direct_messages for a "dm" report and in
   * group_messages for a "group" one. The database checks that the reporter
   * could see it and that the reported person sent it.
   */
  messageId?: string | null;
}

export const REPORT_LIMITS = { details: 1000, excerpt: 500 } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACE_ID = /^[A-Za-z0-9-]{1,120}$/;

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && REPORT_REASONS.some((r) => r.id === value);
}

export function reportReasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((r) => r.id === reason)?.label ?? "Something else";
}

/**
 * A report as the server accepts it, or null. Text is trimmed and capped,
 * ids must look like ids, and nothing else the client sends is kept.
 */
export function cleanReport(body: unknown): ReportInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!isReportReason(b.reason)) return null;
  const place = b.place;
  if (place !== "dm" && place !== "group" && place !== "call" && place !== "profile") return null;
  if (typeof b.placeId !== "string" || !PLACE_ID.test(b.placeId)) return null;
  const reported = b.reportedUserId;
  if (reported !== null && reported !== undefined && (typeof reported !== "string" || !UUID.test(reported))) return null;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const messageId = typeof b.messageId === "string" && UUID.test(b.messageId) && (place === "dm" || place === "group") ? b.messageId.toLowerCase() : null;
  return {
    reason: b.reason,
    details: text(b.details, REPORT_LIMITS.details) || undefined,
    reportedUserId: typeof reported === "string" ? reported.toLowerCase() : null,
    place,
    placeId: b.placeId,
    // With a message id the database quotes the message itself.
    excerpt: messageId ? null : text(b.excerpt, REPORT_LIMITS.excerpt) || null,
    ...(messageId ? { messageId } : {}),
  };
}

/**
 * The report as one readable message, the way it is stored in the feedback
 * table's message column. Every field is in it, so a report reads whole in
 * the database even before the migration adds its own columns.
 */
export function reportMessage(r: ReportInput): string {
  const lines = [
    `Report: ${reportReasonLabel(r.reason)}`,
    `Where: ${r.place}:${r.placeId}`,
    `Reported user: ${r.reportedUserId ?? "none"}`,
  ];
  if (r.messageId) lines.push(`Message id: ${r.messageId} (${r.place === "dm" ? "direct_messages" : "group_messages"})`);
  if (r.excerpt) lines.push(`Message: "${r.excerpt}"`);
  if (r.details) lines.push(`Details: ${r.details}`);
  return lines.join("\n");
}

/** The columns supabase/schema-2026-10-03-safety.sql adds to feedback for a report. */
export function reportColumns(r: ReportInput): Record<string, string | null> {
  return {
    report_reason: r.reason,
    report_where: `${r.place}:${r.placeId}`,
    reported_user_id: r.reportedUserId,
    report_excerpt: r.excerpt ?? null,
    ...(r.messageId ? { report_message_id: r.messageId } : {}),
  };
}

// ---------------------------------------------------------------------------
// 3. Blocks on this device
// ---------------------------------------------------------------------------

export interface BlockedPerson {
  id: string;
  name: string | null;
  /** When it was blocked (Date.now()). */
  at: number;
}

/** Fired on window when this device's block list changes. */
export const BLOCKS_EVENT = "algebridge:blocks-changed";

type KeyStore = Pick<Storage, "getItem" | "setItem">;

function browserStore(): KeyStore | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Each account on a shared computer keeps its own list. */
export function blockKey(myId: string): string {
  return `algebridge:blocked:${myId}`;
}

export function readBlocked(myId: string | null | undefined, store: KeyStore | null = browserStore()): BlockedPerson[] {
  if (!myId || !store) return [];
  try {
    const raw = JSON.parse(store.getItem(blockKey(myId)) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p): p is BlockedPerson => !!p && typeof p.id === "string" && UUID.test(p.id))
      .map((p) => ({ id: p.id, name: typeof p.name === "string" ? p.name.slice(0, 120) : null, at: Number(p.at) || 0 }));
  } catch {
    return [];
  }
}

function writeBlocked(myId: string, list: BlockedPerson[], store: KeyStore | null): boolean {
  if (!store) return false;
  try {
    store.setItem(blockKey(myId), JSON.stringify(list));
  } catch {
    return false;
  }
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(BLOCKS_EVENT));
  } catch {
    /* no window in tests */
  }
  return true;
}

/** Blocks someone on this device. False when this browser cannot keep it (a private window that refuses storage). */
export function blockOnDevice(myId: string, person: { id: string; name: string | null }, store: KeyStore | null = browserStore()): boolean {
  if (!UUID.test(person.id) || person.id === myId) return false;
  const list = readBlocked(myId, store).filter((p) => p.id !== person.id);
  return writeBlocked(myId, [...list, { id: person.id, name: person.name, at: Date.now() }], store);
}

export function unblockOnDevice(myId: string, otherId: string, store: KeyStore | null = browserStore()): boolean {
  return writeBlocked(myId, readBlocked(myId, store).filter((p) => p.id !== otherId), store);
}

export function isBlocked(list: BlockedPerson[], otherId: string | null | undefined): boolean {
  return !!otherId && list.some((p) => p.id === otherId);
}

// ---------------------------------------------------------------------------
// 4. What the policy pages say is waiting on the database
// ---------------------------------------------------------------------------

/**
 * The rules supabase/schema-2026-10-03-safety.sql adds, in the words /privacy,
 * /safety and /schools all show under "Waiting on a database update". One
 * list, so the three pages cannot drift from each other or from the file.
 * Each line names something that is NOT true until Ivan applies it.
 */
export const PENDING_SAFETY_UPDATE: string[] = [
  "A tutor or teacher can message or call a student only if the student is in that teacher's class, asked for help and that tutor took the request (or named that tutor on a request in the last two weeks), or wrote to them first, and never after the student blocks them.",
  "Only a teacher account can make a class, and a student joins one only with the class code or by accepting a teacher's invite. Today the database checks neither, so a class can be made, and a student put in it, without the student agreeing.",
  "A student who joins a teacher's class becomes a school account wherever they sign in: the app turns school mode on for them, the database lets only their teacher and AlgeBridge admins message or call them, and tutors stop seeing their requests for help.",
  "Tutors no longer see student email addresses, only the names and photos of the students in the first rule or in their own group chats, and students no longer see tutors' email addresses.",
  "A block is kept with the account, so the blocked person cannot message, call or add the student to a group chat on any device.",
  "The database itself refuses a student's message with a phone number or an email address, whatever app sends it, including one hidden with invisible characters or sent a few digits at a time, and refuses a profile bio with contact details.",
  "A report quotes the reported message from the database's own copy, and each account can send at most 30 reports an hour.",
  "Profile photos are no longer at a public link.",
  "Students who were shown on the leaderboard under the old default, and have not signed in since, are taken off it, and the board no longer hands out account ids.",
  "A deleted account's messages are kept for 90 days for an admin's safety review, then deleted.",
  "Students can leave a group chat.",
];
