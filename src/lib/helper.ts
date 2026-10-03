/**
 * The AlgeBridge study helper.
 *
 * Three modes share one rule: the helper never hands over the answer to a
 * problem the student is working on. That rule is enforced here, in code,
 * rather than in a system prompt. A prompt is a request; this is a gate. It
 * holds even when no model is configured, when a model misbehaves, and when
 * the provider is swapped out.
 *
 * The single exception is arithmetic the student could do on a calculator
 * anyway: a bare multiplication or division. Those get the number and nothing
 * else, because refusing them is theatre, not teaching. With a problem on
 * screen the exception narrows: a sum built from that problem's numbers, or
 * one whose result is a value the student is meant to reach, is a step of the
 * problem and stays theirs (see arithmeticIsStep).
 *
 * One thing outranks the answer rule: a message that sounds like the student
 * is in danger (detectCrisis) gets a fixed reply that sends them to people,
 * and never reaches a model.
 */

export type HelperMode = "tutor" | "reminder" | "scheduler";

/**
 * The quick actions a student can press instead of typing. Each one shapes
 * the system prompt; none of them gets past the answer gate, because the gate
 * reads the student's words, not the button.
 */
export const HELPER_ACTIONS = ["hint", "first-step", "key-idea", "example", "another-way", "next-step"] as const;
export type HelperAction = (typeof HELPER_ACTIONS)[number];

export function isHelperAction(value: unknown): value is HelperAction {
  return typeof value === "string" && (HELPER_ACTIONS as readonly string[]).includes(value);
}

export interface HelperContext {
  /** The skill being practised, when the helper is opened from a problem. */
  skillTitle?: string;
  keyIdea?: string;
  problemPrompt?: string;
  hint?: string;
  /**
   * The worked solution. Never sent to the student. Used to build the list of
   * values the reply is not allowed to contain.
   */
  explanation?: string;
  /**
   * The answer key, for the filter only. Explanations do not always state
   * the final value, and a multiple-choice answer ("y = 3x - 2") is text the
   * number filter cannot see.
   */
  answer?: string;
}

export interface HelperMessage {
  role: "user" | "assistant";
  content: string;
}

/** What the helper decided the student was asking for. */
export type Intent =
  | "answer_request"
  | "arithmetic"
  | "formula"
  | "escalate"
  | "scheduling"
  | "general";

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

const ANSWER_PATTERNS = [
  /\b(what|whats|what's)\s+(is\s+)?(the\s+)?answer\b/,
  /\b(just|please|pls|plz)?\s*(tell|give|show)\s+(me\s+)?(the\s+)?(answer|solution)\b/,
  /\bsolve\s+(it|this|the\s+problem)\b/,
  /\bdo\s+(it|this)\s+for\s+me\b/,
  /\bwhat\s+does\s+[a-z]\s+equal\b/,
  /\banswer\s+(it|this)\b/,
  /\bgive\s+me\s+the\s+(final\s+)?(answer|result)\b/,
  /\bwhat'?s\s+[a-z]\s*=\s*\?/,
];

const ESCALATE_PATTERNS = [
  /\b(i\s+)?(still\s+)?(don'?t|do\s+not|dont)\s+(get|understand)\s+(it|this|any\s+of\s+it)\b/,
  /\b(i\s+)?need\s+(a\s+)?(real\s+)?(person|human|tutor|teacher)\b/,
  /\bcan\s+i\s+(talk|speak)\s+to\s+(a|someone)\b/,
  /\b(i'?m\s+)?(completely|totally|so)\s+lost\b/,
  /\bthis\s+(isn'?t|is\s+not)\s+helping\b/,
  /\bi\s+give\s+up\b/,
  /\bmore\s+help\b/,
];

const FORMULA_PATTERNS = [
  /\bformula\b/,
  /\bwhat'?s\s+the\s+(rule|equation)\s+for\b/,
  /\bhow\s+do\s+(i|you)\s+remember\b/,
  /\bremind\s+me\b/,
  /\bmemoriz/,
];

const YES = /^\s*(y|ya|yes|yeah|yep|yup|sure|ok|okay|please|sounds good|do it|book it)\b/i;
const NO = /^\s*(n|no|nope|nah|not now|later|no thanks|maybe later)\b/i;

export function isYes(text: string): boolean {
  return YES.test(text);
}
export function isNo(text: string): boolean {
  return NO.test(text);
}

// ---------------------------------------------------------------------------
// Crisis
// ---------------------------------------------------------------------------

/**
 * The reply to a message that signals self-harm, suicide, abuse or danger.
 * Fixed text, reviewed once, never generated: a model asked about this once
 * gave 988 and then two wrong numbers for other countries.
 *
 * Both services checked on their own sites (988lifeline.org and
 * crisistextline.org, 2 Oct 2026): 988 takes calls and texts, Crisis Text
 * Line takes HOME to 741741 from anywhere in the US, and both say free,
 * confidential and 24/7.
 */
export const CRISIS_REPLY =
  "I'm really glad you told me. I'm an AI math helper, and this needs a real person who can help you. " +
  "Please talk to a trusted adult now, like a parent, a teacher, or your school counselor. " +
  "In the US, from any phone, you can call or text 988 (the 988 Suicide and Crisis Lifeline) or text HOME to 741741 (Crisis Text Line). " +
  "On a computer, chat with 988 at chat.988lifeline.org. " +
  "Both are free, confidential, and open 24/7. If you are in danger right now, call 911.";

/**
 * The same help as CRISIS_REPLY, as the things the panel lets a student tap:
 * call or text 988, text HOME to 741741, and 911. On a phone each one opens
 * the dialer or the messages app with the number filled in. The test in
 * helper.test.ts holds these to the reply's own words.
 */
export const CRISIS_CONTACTS = [
  { id: "call-988", action: "Call 988", detail: "988 Suicide and Crisis Lifeline", href: "tel:988" },
  { id: "text-988", action: "Text 988", detail: "988 Suicide and Crisis Lifeline", href: "sms:988" },
  // "?&body=" is the one form both iOS and Android read as a prefilled text.
  { id: "text-741741", action: "Text HOME to 741741", detail: "Crisis Text Line", href: "sms:741741?&body=HOME" },
] as const;
export const CRISIS_EMERGENCY = { action: "Call 911", href: "tel:911" } as const;

/**
 * The 988 Lifeline's web chat, for a school Chromebook, where a tel: or sms:
 * link does nothing. The address is the one 988lifeline.org's own Chat
 * button opens (checked 3 Oct 2026); ?lang=es is its Spanish chat.
 */
export const CRISIS_CHAT = {
  action: "Chat with 988 online",
  detail: "chat.988lifeline.org, from any computer",
  href: "https://chat.988lifeline.org/",
} as const;

/**
 * Spanish help on the same line, in 988's own words (988lifeline.org,
 * "Servicios en español", checked 3 Oct 2026): dial 988 and press 2, or text
 * AYUDA to 988. Not a translation of CRISIS_REPLY: that still needs a Spanish
 * speaker's review before it ships.
 */
export const CRISIS_SPANISH = {
  text: "En español: llama al 988 y presiona 2, o envía AYUDA al 988.",
  chatHref: "https://chat.988lifeline.org/?lang=es",
} as const;

export type CrisisKind = "self-harm" | "abuse" | "danger";

/**
 * The model-side net. A message the patterns below miss (another language, a
 * new slang word) still reaches a model, and the model is told to answer it
 * with this one word, which the server and the panel turn into CRISIS_REPLY
 * and the card. CRISIS_MODEL_RULE is the line every system prompt that sees a
 * student's words should carry.
 */
export const CRISIS_SIGNAL = "CRISIS";
export const CRISIS_MODEL_RULE =
  "If the student's message, in any language, suggests self-harm, suicide, abuse, neglect, or that they are in danger, reply with exactly CRISIS and nothing else.";

/** Did a model answer with the crisis signal, give or take quotes, a period or JSON? */
export function modelSignalsCrisis(reply: string | null | undefined): boolean {
  if (!reply) return false;
  let t = reply.trim();
  try {
    const parsed = JSON.parse(t) as unknown;
    if (parsed && typeof parsed === "object" && typeof (parsed as { reply?: unknown }).reply === "string") {
      t = (parsed as { reply: string }).reply.trim();
    }
  } catch {
    /* plain text */
  }
  return t.replace(/^[\s"'`*_]+|[\s"'`*_.!]+$/g, "").toUpperCase() === CRISIS_SIGNAL;
}

/** Digits and symbols standing in for letters: k1ll, su1c1de, d3ad. */
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

/**
 * Letters from other alphabets that look like Latin ones (a Cyrillic "і" in
 * "suіcide"), read as the Latin letter they imitate.
 */
const LOOKALIKE: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ӏ": "l",
  "ο": "o", "α": "a", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
};
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKE).join("")}]`, "g");

/** Characters that print as nothing: zero-width spaces and joiners, soft hyphens, direction marks. */
export const INVISIBLE_RE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁤⁪-⁯ㅤ︀-️﻿ﾠ]/g;

/** Text with look-alike letters read as Latin and invisible characters taken out. */
export function foldLookalikes(text: string): string {
  return text.replace(INVISIBLE_RE, "").replace(LOOKALIKE_RE, (c) => LOOKALIKE[c] ?? c);
}

/**
 * Words in scripts the Latin patterns cannot read, checked on the text as
 * typed: Chinese, Arabic, Russian and Ukrainian, Korean, Hindi. A short list
 * of the plainest ways to say "I want to die" or "suicide", not a translation
 * of the English patterns. The model-side net (CRISIS_MODEL_RULE) is there
 * for everything else.
 */
const OTHER_SCRIPTS: RegExp[] = [
  /我想死|想自杀|自杀|不想活|活不下去|想去死|自殺/,
  /أريد\s*أن\s*أموت|اريد\s*ان\s*اموت|انتحار|أنتحر|انتحر|أقتل\s*نفسي|اقتل\s*نفسي/,
  /хочу\s+умереть|хочу\s+померти|убить\s+себя|убью\s+себя|вбити\s+себе|покончить\s+с\s+собой|суицид|самоубийств|самогубств/i,
  /죽고\s?싶|자살/,
  /मरना\s?चाह|आत्महत्या|खुदकुशी/,
];

/**
 * Text as the patterns read it: lower case, no accents or apostrophes
 * ("don't" is "dont"), leetspeak inside words undone, runs of three or more
 * of a letter cut to one ("diiie"), punctuation as spaces, and single letters
 * spelled out with gaps joined ("k i l l", "k.m.s"). Invisible characters
 * go first, and letters from other alphabets that imitate Latin ones are read
 * as Latin; a star or an exclamation mark between two letters stands for a
 * vowel ("k*ll", "d!e"), and "11" inside a word for "ll" ("ki11").
 */
export function safetyText(text: string): string {
  let t = foldLookalikes(text.toLowerCase())
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['‘’ʼ`´]/g, "");
  t = t.replace(/(?<=[a-z])[*!|](?=[a-z])/g, "i");
  t = t.replace(/(?<=[a-z]{2})11(?=[a-z]|\b)/g, "ll");
  // Only inside words that start with a letter and hold two or more letters,
  // so "3x", "x1" and "$20" are left alone.
  t = t.replace(/\b[a-z][a-z0-9@$]*[0-9@$][a-z0-9@$]*/g, (w) =>
    (w.match(/[a-z]/g) ?? []).length >= 2 ? w.replace(/[0-9@$]/g, (c) => LEET[c] ?? c) : w
  );
  t = t.replace(/([a-z])\1{2,}/g, "$1");
  t = t.replace(/[^a-z0-9]+/g, " ");
  t = t.replace(/\b[a-z](?: [a-z]\b){2,}/g, (m) => m.replace(/ /g, ""));
  return t.replace(/\s+/g, " ").trim();
}

// The kill verb with its common slips ("kil", "kiling"), and "myself" with its
// common slips ("my self", "myslef", "mysef", "mself").
const KILL = "k+i+l+(?:ing|in|s|ed)?";
const MYSELF = "m[yie]?\\s?s(?:elf|elv|lef|lf|ef|efl|el|eff)\\w*";
const PERSON =
  "(?:dad|father|stepdad|step dad|mom|mother|mum|stepmom|step mom|parents?|brother|sister|uncle|aunt|grandpa|grandfather|grandma|grandmother|cousin|boyfriend|girlfriend|bf|gf|he|she|they|someone|somebody|teacher|coach|man|guy|adult|kids|bully|bullies|people|family|guardian|foster \\w+)";

const SELF_HARM: RegExp[] = [
  // kill myself, killmyself, kil myslef, hurt myself, cut myself, unalive myself
  new RegExp(`\\b(?:${KILL}|off|end|ending|hurt|hurting|harm|harming|cut|cutting|hang|hanging|shoot|shooting|stab|stabbing|starve|starving|drown|drowning|poison|poisoning|unalive|unaliving|burn|burning|scratch|scratching|choke|choking|suffocate|suffocating)\\s?${MYSELF}\\b`),
  // suicide, suicidal and the ways it gets misspelled
  /\bsu[aeiouy]*[cs]{1,2}[aeiy]*i[aeiy]*d(?:e|es|al|ally|ing|ed|le|el|l)?\b/,
  /\b(?:suicd\w*|suecid\w*|sewer ?slide\w*|sewerslid\w*|un ?aliv\w*|commit (?:die|sudoku|toaster bath))\b/,
  /\bself ?harm\w*\b/,
  // want to die, wanna die, ready to die, want to be dead, want to disappear forever
  /\b(?:want|wnat|wamt|wnt|wan|wanna|wana|wnna|wanted|ready|deserve|deserves)\s+(?:to\s+|2\s+)?(?:just\s+|really\s+|literally\s+|honestly\s+|lowkey\s+)?(?:die|be dead|be ded|stop existing|not exist|not be alive|not live|disappear|end it all|end it|end my life|kill me)\b/,
  // "i wanna dye" (but not "i want to dye my hair")
  /\b(?:want|wanna|wana|wnt)\s+(?:to\s+|2\s+)?dye\b(?! (?:my|your|her|his|the|it|them|a|some|their|our)\b)/,
  /\bidw(?:tl|t live| to live| 2 live)\b/,
  /\b(?:want|wanna|wish i could) (?:to )?sleep forever\b/,
  /\bwish (?:that )?i (?:wasnt|was not|werent|were not) (?:alive|here anymore|here|born|around)\b/,
  /\bwant (?:it all|everything|all of it|the pain|this pain|my life) to (?:stop|end)\b/,
  /\bdone with (?:life|living|existing|being alive)\b(?! (?:science|skills?|cycles?|insurance|lessons?|unit|class)\b)/,
  /\b(?:have|made|got|making|wrote|written) (?:a |my )?plan to (?:end it|end my life|kill myself|die|end things|end everything)\b/,
  /\bplan(?:ning)? (?:to|on) (?:end|ending) (?:it|my life|things|everything)\b/,
  /\b(?:goodbye|suicide) (?:letter|note)s?\b/,
  /\b(?:dont|do not|cant|cannot) see (?:the|any) point (?:anymore|any more|in (?:living|life|anything|going on|being alive))\b/,
  /\b(?:thinking (?:about|of)|want to|going to|gonna|wanna) end(?:ing)? (?:things|everything)\b/,
  /\bi cant go on\b(?! (?:to|with)\b)/,
  /\b(?:wont|will not) be (?:around|here) (?:much longer|tomorrow|anymore)\b/,
  /\bgoodbye forever\b/,
  /\bwant (?:someone|somebody|anyone|you) to kill me\b/,
  /\bi should (?:just )?(?:die|end it)\b/,
  /\bwish (?:that )?i (?:was|were|could be|would be|had been) (?:dead|never born|gone forever)\b/,
  /\bwish i (?:could|would) (?:just )?(?:die|disappear forever|not wake up|never wake up)\b/,
  /\b(?:hope|wish|want) (?:i |to )?(?:never|dont|do not|wouldnt|would not|will not|wont) wake up\b/,
  /\bsleep (?:and )?never wake up\b/,
  /\bbetter off (?:dead|without me)\b/,
  /\b(?:no|nothing to|what is the|whats the) (?:reason|point) (?:to|in|of|for) (?:live|living|life|being alive|going on|existing)\b/,
  /\blife (?:isnt|is not|aint|is no longer|not) worth\b/,
  /\blife is (?:pointless|meaningless|over)\b/,
  /\b(?:dont|do not|no longer) (?:want|wanna) (?:to )?(?:live|be alive|exist|wake up|go on|be here anymore|be on this earth)\b/,
  /\bcant (?:go on living|keep living|live like this|go on anymore)\b/,
  /\b(?:end|ending|take|taking) my (?:own )?life\b/,
  /\bend(?:ing)? it all\b/,
  /\b(?:care|notice|miss me|matter)\b.{0,24}\bif i (?:died|was dead|were dead|was gone|were gone|disappeared|wasnt here|wasnt around)\b/,
  /\bhate (?:my life|myself|being alive|my existence)\b/,
  /\b(?:im|i am) (?:just )?a burden\b/,
  /\boverdos\w*\b/,
  /\b(?:take|took|taking|swallow|swallowed) (?:all|a bunch|a lot|a handful|too many|way too many) (?:of )?(?:my |the |those |these )?(?:\w+ )?(?:pills|meds|medicine|tablets)\b/,
  /\bswallow(?:ed|ing)? (?:\w+ ){0,3}?(?:pills|tablets|bleach)\b/,
  /\b(?:i|im|i am|gonna|wanna|want to|going to|about to|will|might|should|ill|id) (?:just )?jump (?:off|from|in front of)\b/,
  /\b(?:think|thinking|thought|keep thinking|dream|dreaming) (?:about|of) (?:jumping|jump) (?:off|from|in front of)\b/,
  /\b(?:started|been|keep|kept|i) cutting (?:again|myself|my (?:arm|arms|wrist|wrists|leg|legs|skin))\b/,
  // "i've been cutting", "im cutting again" in the middle of a math question,
  // but not "i'm cutting the pizza into 8 slices" or "i keep cutting corners".
  /\b(?:im|i am|ive|i have|i|i keep|i kept|i started|i still|im still)(?: been| still| started)? cutting\b(?! (?:\d|the|a|an|it|its|this|that|these|those|out|in|into|up|down|back|off|class|school|corners|paper|my hair|my nails|hair|his|her|their|our|your|some|cake|pizza|wood|lines?|shapes?|fabric|coupons?|across|through|each|every|both|half|halves)\b)/,
  /\b(?:slit|cut|cutting) my wrists?\b/,
  /\b(?:told|tell|telling|tells|said) me to (?:kys|kill myself|die)\b/,
  // Spanish (accents are gone by now: "aquí" reads "aqui", "daño" "dano").
  /\b(?:me )?quiero (?:morir(?:me)?|matarme|suicidarme|desaparecer para siempre|cortarme|hacerme dano|estar muert[oa])\b(?! de (?:la |el )?(?:risa|verguenza|pena|amor|ganas|hambre|sueno|aburrimiento|calor|frio)\b)/,
  /\bme quiero (?:morir|matar|suicidar|cortar)\b(?! de (?:la |el )?(?:risa|verguenza|pena|amor|ganas|hambre|sueno|aburrimiento|calor|frio)\b)/,
  /\b(?:me voy a (?:matar|suicidar|cortar)|voy a (?:matarme|suicidarme|cortarme))\b/,
  /\bsuicid(?:ar|arme|arse|io|a|o)\b/,
  /\b(?:ya )?no quiero (?:vivir|seguir viviendo|existir|estar aqui|estar viv[oa])\b/,
  /\bme (?:corto|lastimo|hago dano)\b(?! (?:el|la|las|los|mis) (?:pelo|cabello|unas|flequillo)\b)/,
  // Haitian Creole, Portuguese, Hindi in Latin letters, Vietnamese without accents.
  /\b(?:mwen|m) vle mouri\b/,
  /\btouye tet (?:mwen|m)\b/,
  /\bswisid\w*\b/,
  /\b(?:eu )?quero morrer\b/,
  /\b(?:quero|vou|queria) me matar\b/,
  /\bnao quero (?:mais )?viver\b/,
  /\bmarna chah(?:ta|ti|te|ti hu|ta hu)\b/,
  /\b(?:khudkushi|aatmahatya|atmahatya)\b/,
  /\btoi muon chet\b/,
];

const ABUSE: RegExp[] = [
  /\b(?:abus(?:e|ed|es|ing|ive)|molest\w*|rap(?:e|ed|es|ing|ist)|groom(?:ed|ing) me)\b/,
  /\bsexual(?:ly)? (?:abus\w*|assault\w*|touch\w*|harass\w*)\b/,
  /\bmade me (?:touch|do (?:stuff|things) i didnt want)\b/,
  /\b(?:asked|asking|asks|wants|wanted) (?:me )?(?:for )?(?:nudes|naked (?:pics|pictures|photos)|pics of my body)\b/,
  // "my dad hits me", "she touched me", "they hurt me", but not "it hit me"
  // (a realisation), "hit me up" (a message) or "kicks me out" (of class).
  new RegExp(
    `\\b${PERSON} (?:\\w+ ){0,2}?(?:hits|hit|hitting|punches|punched|punching|slaps|slapped|slapping|kicks|kicked|kicking|chokes|choked|choking|strangles|strangled|burns|burned|burnt|whips|whipped|touches|touched|touching|hurts|hurt|hurting|grabs|grabbed|locks|locked|starves|starved|threatens|threatened|threatening) me\\b(?! (?:up|out|off|back)\\b)`
  ),
  // "my dad beats me", "they beat me up", but not "she beat me at chess"
  new RegExp(`\\b${PERSON} (?:\\w+ ){0,2}?(?:beats|beat|beating) me(?: up\\b|\\b(?! (?:at|in|by|to|on|again)\\b))`),
  /\bthreat\w* to (?:kill|hurt|hit|beat|shoot|stab) me\b/,
  /\b(?:being|getting) (?:abused|bullied|beaten|beat up|groomed|stalked|threatened|molested)\b/,
  /\bbull(?:y|ies|ied|ying) me\b/,
  /\b(?:scared|afraid|terrified) (?:to go|of going) home\b/,
  // "my uncle makes me do things", "he makes me keep secrets"
  new RegExp(`\\b${PERSON} (?:\\w+ ){0,2}?(?:makes|made|forces|forced) me (?:do|touch|watch) (?:things|stuff|something|sexual \\w+)\\b(?! (?:like|for)\\b)`),
  /\b(?:makes|made|forces|forced) me (?:to )?keep (?:it |this |them |a |our )?secrets?\b/,
  /\bwhat (?:he|she|they) (?:does|did|do) to me\b/,
  /\b(?:scared|afraid|terrified) of (?:my )?(?:dad|father|stepdad|step dad|mom|mother|stepmom|uncle|aunt|parents?|brother|grandpa|grandfather|boyfriend|coach|tutor)\b/,
  // "my tutor asked me for pictures", "an adult asked me to send pics of my
  // body", but not "asked me for pictures of my homework"
  /\b(?:asked|asking|asks|wants|wanted|told|tells) me (?:for|to send|to take|to show) (?:\w+ )?(?:pics|pictures|photos|nudes|selfies|videos)\b(?! of (?:the|my|your|our) (?:homework|work|graph|project|answer|answers|notes|problem|worksheet|whiteboard)\b)/,
  /\bsend (?:\w+ )?(?:pics|pictures|photos) of my body\b/,
  /\bget (?:hit|beaten|beat up|beat|slapped|punched|kicked|choked|hurt|touched) (?:at home|by (?:my|him|her|them)|every day|everyday)\b/,
  /\b(?:keep|keeps|kept|always) (?:threatening|bullying|hitting|hurting|harassing|touching|beating) me\b/,
  new RegExp(`\\b${PERSON} (?:\\w+ ){0,2}?(?:kick|punch|slap|choke|whip|grab|starve|threaten|touch|burn) me\\b(?! (?:up|out|off|back)\\b)`),
  /\b(?:locks|locked|lock) me (?:in|inside) (?:my|the|a|our) (?:room|closet|basement|house|car)\b/,
  // Spanish
  /\bmi (?:papa|padre|mama|madre|padrastro|madrastra|tio|tia|hermano|hermana|abuelo|primo|novio|novia|maestro|entrenador) me (?:pega|golpea|toca|lastima|maltrata|viola|amenaza|quema|ahorca|hace cosas)\b/,
  /\bme (?:pegan|golpean|tocan|violan|maltratan|amenazan)\b/,
  /\b(?:abuso|abusa|abusan|abusaron) de mi\b/,
  /\btengo miedo de (?:ir a|volver a) (?:mi )?casa\b/,
];

const DANGER: RegExp[] = [
  /\b(?:im|i am|i feel) (?:not|un) ?safe\b/,
  /\b(?:dont|do not|never) feel safe\b/,
  /\b(?:not|un) ?safe at home\b/,
  /\b(?:im|i am|we are|were) in danger\b/,
  /\b(?:someone|somebody) (?:is|keeps) (?:following|chasing|stalking) me\b/,
  /\b(?:someone|somebody|he|she|they|a man|a guy|theres someone|there is someone) (?:has|have|got|is holding|pulled) a (?:gun|knife|weapon)\b/,
  /\b(?:shoot|shooting|bomb|bombing|blow) up (?:the|my|this|our) school\b/,
  /\bbring(?:ing)? a (?:gun|knife|weapon) to school\b/,
  /\bno food (?:at home|in the house|in my house)\b/,
  /\b(?:havent|have not|didnt|did not) (?:eat|eaten|had food) (?:in|for) (?:\d+|two|three|four|five|a few|several) days\b/,
  // A threat to someone else. "kill the x term" has no person in it, and
  // "gonna kill my brother if he eats my fries" is the idiom, so a
  // condition straight after it lets it pass.
  /\b(?:want|wanna|going|gonna|about|plan|planning) (?:to )?(?:kill|hurt|shoot|stab) (?:him|her|them|someone|somebody|everyone|everybody|people|my (?:dad|father|mom|mother|stepdad|stepmom|parents?|brother|sister|teacher|friends?|classmates?|family|cousin|uncle|aunt|boyfriend|girlfriend))\b(?! (?:\w+ )?(?:if|when|for|because)\b)/,
];

const KMS_UNIT_BEFORE = new Set(["many", "much", "the", "in", "of", "into", "per", "few", "convert", "converting", "those", "these", "total", "than"]);
const KMS_UNIT_AFTER = new Set(["to", "per", "into", "equals", "equal", "h", "hr", "hrs", "hour", "hours", "away", "long", "wide", "from", "of", "an"]);
const KMS_VERB = new Set(["want", "wanna", "going", "gonna", "about", "need", "ready", "trying", "try", "like", "hope", "plan", "planning", "have"]);

/**
 * "kms" is slang for "kill myself" and also the plural of km. It counts as
 * slang unless a number or a unit phrase sits next to it: "12 kms",
 * "how many kms", "kms per hour", "miles to kms".
 */
function kmsAsSlang(t: string): boolean {
  const words = t.split(" ");
  return words.some((w, i) => {
    if (w !== "kms") return false;
    const prev = words[i - 1] ?? "";
    const prev2 = words[i - 2] ?? "";
    const next = words[i + 1] ?? "";
    if (/^\d/.test(prev)) return false;
    if (prev === "to" && !KMS_VERB.has(prev2)) return false;
    if (KMS_UNIT_BEFORE.has(prev)) return false;
    if (KMS_UNIT_AFTER.has(next)) return false;
    if (next === "in" && /^(?:a|one|an|\d.*)$/.test(words[i + 2] ?? "")) return false;
    return true;
  });
}

/**
 * Does this message sound like the student is in danger, from themselves or
 * someone else? Broad on purpose: a false alarm costs one kind message, a
 * miss costs far more. Two idioms are deliberately left alone because they
 * are everyday maths talk and a crisis reply to them would teach students to
 * ignore it: "this problem is killing me" and "my mom is going to kill me if
 * I fail". The list of what must and must not fire is in helper.test.ts.
 */
export function detectCrisis(text: string): CrisisKind | null {
  const raw = (text ?? "").replace(INVISIBLE_RE, "");
  // Scripts the Latin patterns cannot read, and "s/h", which punctuation
  // removal would turn into two loose letters.
  if (OTHER_SCRIPTS.some((r) => r.test(raw)) || /(?:^|[\s(])s\/h(?=$|[\s.,!?)])(?!\s*(?:ratio|rate|=|is\s+\d))/i.test(raw)) return "self-harm";
  const t = safetyText(raw);
  if (!t) return null;
  if (SELF_HARM.some((r) => r.test(t)) || kmsAsSlang(t)) return "self-harm";
  if (ABUSE.some((r) => r.test(t))) return "abuse";
  if (DANGER.some((r) => r.test(t))) return "danger";
  return null;
}

/**
 * The student's last message, and their one before it read together with it,
 * so a disclosure split in two ("i want to", then "die") is caught. A message
 * that already matched on its own was already answered, so it is not joined
 * again (or every later message would bring the card back).
 */
export function detectCrisisInTurns(previous: string | null | undefined, latest: string): CrisisKind | null {
  const alone = detectCrisis(latest);
  if (alone || !previous || !previous.trim() || detectCrisis(previous)) return alone;
  return detectCrisis(`${previous.trim()} ${latest}`);
}

/**
 * The conversation without its crisis turns, for the model. A disclosure
 * stays between the student and the fixed reply: it is not sent on to a
 * third party, and a model cannot improvise on it later in the thread.
 */
export function withoutCrisisTurns(messages: HelperMessage[]): HelperMessage[] {
  return messages.filter((m) =>
    m.role === "user" ? !detectCrisis(m.content) : m.content.trim() !== CRISIS_REPLY
  );
}

// ---------------------------------------------------------------------------
// Off topic
// ---------------------------------------------------------------------------

export const OFF_TOPIC_REPLY =
  "I'm built for Algebra 1, so for that one your teacher is the better help. Got a math problem? I can give you a hint, a first step, or a formula.";

const OFF_TOPIC_PATTERNS = [
  /\b(?:write|type|do|finish|make)\s+(?:me\s+)?(?:my|an|a|the|this)\s+(?:\w+\s+){0,3}?(?:essay|poem|book report|lab report|speech|cover letter|haiku|song lyrics)\b/,
  /\b(?:my|this|the|for)\s+(?:history|english|biology|spanish|french|german|social studies|ela|reading|geography|civics|health|art|music)\s+(?:homework|assignment|essay|project|test|quiz|worksheet|class)\b/,
];

/** A plain request for work in another subject. Narrow: anything mathematical goes through. */
export function isOffTopicRequest(text: string): boolean {
  const t = text.toLowerCase().replace(/['’]/g, "");
  return OFF_TOPIC_PATTERNS.some((r) => r.test(t));
}

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  if (!t) return "general";
  // Arithmetic wins over answer_request: "what's 4728 divided by 12" reads as
  // both, and the arithmetic branch is the deliberate exception.
  if (parseArithmetic(t)) return "arithmetic";
  if (ANSWER_PATTERNS.some((r) => r.test(t))) return "answer_request";
  if (ESCALATE_PATTERNS.some((r) => r.test(t))) return "escalate";
  if (FORMULA_PATTERNS.some((r) => r.test(t))) return "formula";
  return "general";
}

// ---------------------------------------------------------------------------
// The arithmetic exception
// ---------------------------------------------------------------------------

export interface Arithmetic {
  a: number;
  op: "*" | "/";
  b: number;
  value: number;
}

const NUM = "\\d{1,12}(?:\\.\\d{1,6})?";
const OP = "(?:\\*|x|×|times|multiplied by|/|÷|divided by|over)";
const MUL = new RegExp(`(${NUM})\\s*(?:\\*|x|×|times|multiplied by)\\s*(${NUM})`, "i");
const DIV = new RegExp(`(${NUM})\\s*(?:/|÷|divided by|over)\\s*(${NUM})`, "i");
const EVERY_OP = new RegExp(`${NUM}\\s*${OP}\\s*(?=${NUM})`, "gi");

/**
 * Recognises a bare multiplication or division and nothing else. Deliberately
 * narrow: no variables, no addition, no chained expressions, no parentheses.
 * Anything richer than "a times b" is a problem to be taught, not computed.
 * "12000 * 0.9 * 0.9" used to come back as "12000 x 0.9 = 10800", silently
 * dropping a factor; a second operator now means it is not arithmetic here.
 *
 * "Tough" means it is not something worth refusing over: single-digit times
 * tables are the one case where handing over the number really is unhelpful,
 * so those fall through to teaching.
 */
export function parseArithmetic(text: string): Arithmetic | null {
  // "5,280" is one number, not 5 and 280.
  const t = plainNumbers(text.toLowerCase());
  // A letter next to the numbers means it is algebra, not arithmetic.
  if (/[a-z]\s*[*/×÷]|[*/×÷]\s*[a-z]/.test(t.replace(/x\s*\d/g, ""))) return null;
  if (/[+\-^=()]/.test(t.replace(/[a-z\s,?.!'"]/g, ""))) return null;
  if ((t.match(EVERY_OP) ?? []).length !== 1) return null;

  for (const [re, op] of [
    [DIV, "/"],
    [MUL, "*"],
  ] as const) {
    const m = re.exec(t);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (op === "/" && b === 0) return null;
    // Times tables stay a teaching moment.
    if (op === "*" && a < 13 && b < 13 && Number.isInteger(a) && Number.isInteger(b)) return null;
    if (op === "/" && a < 145 && b < 13 && Number.isInteger(a) && Number.isInteger(b)) return null;
    const value = op === "*" ? a * b : a / b;
    return { a, op, b, value };
  }
  return null;
}

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1e6) / 1e6);
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * "$12,000" is twelve thousand, not 12 and 000, and a typographic minus is a
 * minus. Without this a reply saying "$17,000" walked straight past a filter
 * looking for 17000, and the 0 in "12,000" was read as a separate number.
 */
export function plainNumbers(text: string): string {
  return text.replace(/−/g, "-").replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
}

/** The numbers written in a text, in order. */
export function numbersIn(text: string): string[] {
  return plainNumbers(text).match(/-?\d+(?:\.\d+)?/g) ?? [];
}

const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

/** One spelling per value: "8748.00" and "8748" are the same number. */
function canon(v: string): string {
  return PLAIN_NUMBER.test(v) ? formatNumber(Number(v)) : v;
}

function decimals(v: string): number {
  return (v.split(".")[1] ?? "").length;
}

// 0 and 1 appear everywhere and blocking them would gag the helper.
const TRIVIAL = new Set(["0", "1", "-1"]);

// ---------------------------------------------------------------------------
// Unit facts
// ---------------------------------------------------------------------------

const U = {
  inch: /\binch(?:es)?\b/,
  foot: /\b(?:foot|feet|ft)\b/,
  yard: /\b(?:yards?|yds?)\b/,
  mile: /\b(?:miles?|mph)\b/,
  second: /\b(?:seconds|secs?|per second|a second|one second|1 second)\b/,
  minute: /\b(?:minutes?|mins?)\b/,
  hour: /\b(?:hours?|hrs?|mph)\b/,
  day: /\bdays?\b/,
  week: /\bweeks?\b/,
  month: /\bmonths?\b/,
  year: /\b(?:years?|yrs?)\b/,
  ounce: /\b(?:ounces?|oz)\b/,
  pound: /\b(?:pounds?|lbs?)\b/,
  ton: /\btons?\b/,
  cup: /\bcups?\b/,
  pint: /\bpints?\b/,
  quart: /\bquarts?\b/,
  gallon: /\bgallons?\b/,
  mm: /\b(?:millimet(?:er|re)s?|mm)\b/,
  cm: /\b(?:centimet(?:er|re)s?|cm)\b/,
  meter: /\b(?:met(?:er|re)s?)\b/,
  km: /\b(?:kilomet(?:er|re)s?|km|kms)\b/,
  gram: /\bgrams?\b/,
  kg: /\b(?:kilograms?|kgs?)\b/,
  ml: /\b(?:millilit(?:er|re)s?|ml)\b/,
  liter: /\b(?:lit(?:er|re)s?)\b/,
  cent: /\bcents?\b/,
  dollar: /\$|\bdollars?\b/,
  dozen: /\bdozens?\b/,
  percent: /%|\bpercent\b/,
};
type Unit = keyof typeof U;

/**
 * Conversion facts every student is allowed to know. A fact counts only when
 * the problem itself names both of its units, so 12 is usable on an inches to
 * feet problem and stays guarded on a linear equation.
 */
const UNIT_FACTS: [string[], Unit[]][] = [
  [["12"], ["inch", "foot"]],
  [["12"], ["month", "year"]],
  [["12"], ["dozen"]],
  [["36"], ["inch", "yard"]],
  [["3"], ["foot", "yard"]],
  [["5280"], ["mile", "foot"]],
  [["1760"], ["mile", "yard"]],
  [["63360"], ["mile", "inch"]],
  [["60"], ["minute", "second"]],
  [["60"], ["minute", "hour"]],
  [["3600"], ["hour", "second"]],
  [["24"], ["hour", "day"]],
  [["1440"], ["minute", "day"]],
  [["7"], ["day", "week"]],
  [["365"], ["day", "year"]],
  [["52"], ["week", "year"]],
  [["16"], ["ounce", "pound"]],
  [["16"], ["cup", "gallon"]],
  [["2000"], ["pound", "ton"]],
  [["8"], ["ounce", "cup"]],
  [["2"], ["cup", "pint"]],
  [["2"], ["pint", "quart"]],
  [["4"], ["quart", "gallon"]],
  [["4"], ["cup", "quart"]],
  [["128"], ["ounce", "gallon"]],
  [["10"], ["mm", "cm"]],
  [["100"], ["cm", "meter"]],
  [["1000"], ["mm", "meter"]],
  [["1000"], ["meter", "km"]],
  [["1000"], ["gram", "kg"]],
  [["1000"], ["ml", "liter"]],
  [["100"], ["cent", "dollar"]],
  [["100"], ["percent"]],
  [["2.54"], ["inch", "cm"]],
  [["1.6", "1.61", "1.609"], ["mile", "km"]],
  [["0.62", "0.621"], ["mile", "km"]],
  [["2.2", "2.205"], ["pound", "kg"]],
  [["0.3048", "3.28", "3.281"], ["foot", "meter"]],
  [["39.37"], ["inch", "meter"]],
  [["28.35"], ["ounce", "gram"]],
  [["453.6", "454"], ["pound", "gram"]],
  [["3.785"], ["gallon", "liter"]],
];

/** The unit facts this problem's own words make fair to say. */
export function unitFactsFor(ctx: HelperContext): string[] {
  const words = [ctx.problemPrompt, ctx.hint, ctx.keyIdea, ctx.skillTitle].filter(Boolean).join(" ").toLowerCase();
  if (!words) return [];
  const out: string[] = [];
  for (const [values, units] of UNIT_FACTS) if (units.every((u) => U[u].test(words))) out.push(...values);
  return Array.from(new Set(out));
}

// ---------------------------------------------------------------------------
// The answer gate
// ---------------------------------------------------------------------------

/**
 * The answer key and the ways it gets said: 16.666... as 16.67 or 16.7,
 * -1.25 as -5/4, 3/2 as 1.5. Empty for an answer that is not a number,
 * which leaksAnswerText guards instead.
 */
export function answerForms(answer?: string): string[] {
  const raw = plainNumbers((answer ?? "").trim()).replace(/^\$\s*/, "");
  if (!raw) return [];
  let key: number;
  const plain = /^(-?\d+(?:\.\d+)?)(?:\s*(?:%|[a-z][a-z .]*))?$/i.exec(raw);
  const frac = /^(-?\d+)\s*\/\s*(\d+)$/.exec(raw);
  if (plain) key = Number(plain[1]);
  else if (frac && Number(frac[2]) !== 0) key = Number(frac[1]) / Number(frac[2]);
  else return [];
  if (!Number.isFinite(key)) return [];
  const forms = [formatNumber(key)];
  if (!Number.isInteger(key)) {
    forms.push(canon(key.toFixed(2)), canon(key.toFixed(1)));
    for (let b = 2; b <= 100; b += 1) {
      const a = Math.round(key * b);
      if (Math.abs(key * b - a) < 1e-9) {
        forms.push(`${a}/${b}`);
        break;
      }
    }
  }
  return Array.from(new Set(forms));
}

/**
 * The values a reply may not contain: the answer in any of its forms, and
 * every intermediate result of the worked solution.
 *
 * What the student already has is allowed: numbers in the problem, numbers in
 * the key idea, and unit facts the problem's units call for ("12 inches in a
 * foot" on an inches problem). Banning those used to throw away three good
 * replies in four on a unit conversion, because "divide by 12" holds a number
 * the solution uses. The answer itself is only ever allowed when the problem
 * prints it (a choice in a multiple-choice list).
 */
export function forbiddenValues(ctx: HelperContext): string[] {
  const inProblem = new Set(numbersIn(ctx.problemPrompt ?? "").map(canon));
  const given = new Set([...inProblem, ...numbersIn(ctx.keyIdea ?? "").map(canon), ...unitFactsFor(ctx).map(canon)]);
  const solution = numbersIn(ctx.explanation ?? "").map(canon);
  const answers = answerForms(ctx.answer);
  // Without a key, the last number the solution reaches stands in for it.
  if (!answers.length && solution.length) answers.push(solution[solution.length - 1]);
  const out = new Set<string>();
  for (const v of solution) if (!given.has(v)) out.add(v);
  for (const v of answers) if (!inProblem.has(v)) out.add(v);
  return Array.from(out).filter((v) => !TRIVIAL.has(v));
}

/** True when a computed value is one of the values, or rounds to one. */
export function hitsValue(value: number, values: string[]): boolean {
  return values.some((v) => {
    const frac = /^(-?\d+)\/(\d+)$/.exec(v);
    if (frac) return Math.abs(value - Number(frac[1]) / Number(frac[2])) < 1e-9;
    if (!PLAIN_NUMBER.test(v)) return false;
    const f = Number(v);
    return Math.abs(value - f) < 1e-9 || Number(value.toFixed(decimals(v))) === f;
  });
}

/**
 * With a problem on screen, is this calculation a step of it? It is when the
 * result is, or rounds to, a value the student is meant to reach or the
 * answer key ("5280 x 6" on "Convert 6 miles to feet"), or when it is built
 * only from the problem's own numbers and the unit facts it calls for. Then
 * the number is the student's to find. With no problem open, a bare sum is
 * just a sum and the exception stands.
 */
export function arithmeticIsStep(a: Arithmetic, ctx: HelperContext): boolean {
  if (!ctx.problemPrompt?.trim()) return false;
  if (hitsValue(a.value, [...forbiddenValues(ctx), ...answerForms(ctx.answer)])) return true;
  const own = new Set<string>();
  for (const v of [...numbersIn(ctx.problemPrompt), ...unitFactsFor(ctx)]) {
    own.add(canon(v));
    own.add(canon(v.replace(/^-/, "")));
  }
  return own.has(formatNumber(a.a)) && own.has(formatNumber(a.b));
}

function squash(s: string): string {
  return plainNumbers(s.toLowerCase())
    .replace(/[×·*]/g, "x")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\s+/g, "");
}

/**
 * The text form of the same rule, for answers that are not a number:
 * "Quadrant II", "(x + 3)(x + 4)", "y = 3x - 2". Single words are left out,
 * because "dashed" or "up" also turn up in any honest hint about the choice.
 */
export function leaksAnswerText(reply: string, ctx: HelperContext): boolean {
  const answer = (ctx.answer ?? "").trim();
  if (!answer || Number.isFinite(Number(answer))) return false;
  const worthGuarding = /[\d=()^²√]/.test(answer) || /\s/.test(answer);
  if (!worthGuarding) return false;
  const a = squash(answer);
  if (a.length < 3 || squash(ctx.problemPrompt ?? "").includes(a)) return false;
  return squash(reply).includes(a);
}

// A number standing on its own: not the 12 in "120" or in "3.12", not the
// coefficient in "3x", but still the 7 in "x = 7." at the end of a sentence.
const NUMBER_TOKEN = /(?<![\w.])-?\d+(?:\.\d+)?(?!\w)(?!\.\d)/g;

/**
 * True when a reply hands over a value the student was meant to find.
 *
 * The boundaries are fussier than \b for a reason. "12" must not fire on
 * "120" or on the "12" inside "3.12", but it must still fire on "12." at the
 * end of a sentence, which is where a naive rule that rejects any trailing
 * dot quietly lets the answer through.
 *
 * Numbers are compared as values, so "$17,000" is 17000 and "8748.00" is
 * 8748. A more precise number that rounds to a guarded one is the same leak:
 * "19.083" says 19.08. That rounding rule skips small whole numbers, where a
 * 2.5 in a made-up example landing near a guarded 3 is chance, not a leak.
 *
 * By default a positive value also fires on its negative ("-7" for 7), which
 * is how this has always read and what the extension's filter expects.
 * `signed` compares signs too. The helper uses it: on "(3, -4) and (-1, 1)"
 * the slope -5/4 guards a 4, and the unsigned rule then threw away every
 * reply that quoted the problem's own -4.
 */
export function leaksAnswer(reply: string, forbidden: string[], opts: { signed?: boolean } = {}): boolean {
  if (!forbidden.length) return false;
  const text = plainNumbers(reply);
  const tokens = text.match(NUMBER_TOKEN) ?? [];
  return forbidden.some((v) => {
    if (PLAIN_NUMBER.test(v)) {
      const f = Number(v);
      const d = decimals(v);
      const same = (x: number) => Math.abs(x - f) < 1e-9 || (!opts.signed && f > 0 && Math.abs(x + f) < 1e-9);
      return tokens.some((tok) => {
        const t = Number(tok);
        if (same(t)) return true;
        return decimals(tok) > d && (d > 0 || Math.abs(f) >= 100) && same(Number(t.toFixed(d)));
      });
    }
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\w.])${esc}(?!\\w)(?!\\.\\d)`).test(text);
  });
}

// Words that state a result just before a number: "x = 7", "the answer is 7",
// "there were 7 adult tickets", "it comes to 7".
const STATES_RESULT =
  /(?:=|≈|\b(?:is|are|was|were|get|gets|got|equals?|makes?|gives?|be|answer|comes? (?:out )?to|works? out to|thats|its))\s*\$?\s*$/i;

/**
 * Sometimes the answer is also a number the problem prints for another
 * reason: 7 tickets on a problem where a child ticket costs $7, 2 in
 * "g(x) = 4x^2 - 2". forbiddenValues has to let that number through, or no
 * reply could quote the problem. What it must still catch is the number
 * stated as the result. A statement that is a quote of the problem itself
 * ("|x| = 21" on "Solve |x| = 21") is not one.
 */
export function statesAnswer(reply: string, ctx: HelperContext): boolean {
  const problem = ctx.problemPrompt ?? "";
  const inProblem = new Set(numbersIn(problem).map(canon));
  const values = answerForms(ctx.answer).filter((v) => inProblem.has(v) && !TRIVIAL.has(v));
  if (!values.length) return false;
  const text = plainNumbers(reply);
  const quoted = squash(problem);
  for (const m of text.matchAll(NUMBER_TOKEN)) {
    if (!values.includes(canon(m[0]))) continue;
    const before = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index);
    if (!STATES_RESULT.test(before)) continue;
    if (quoted.includes(squash(before).slice(-3) + squash(m[0]))) continue;
    // "child tickets are $7" quotes a price the problem prints.
    if (/\$\s*$/.test(before) && quoted.includes(`$${squash(m[0])}`)) continue;
    return true;
  }
  return false;
}

/** Every leak rule at once: a guarded value, the answer as text, or the answer stated. */
export function replyLeaks(reply: string, ctx: HelperContext, forbidden: string[] = forbiddenValues(ctx)): boolean {
  return leaksAnswer(reply, forbidden, { signed: true }) || leaksAnswerText(reply, ctx) || statesAnswer(reply, ctx);
}

// ---------------------------------------------------------------------------
// Deterministic replies
// ---------------------------------------------------------------------------

export const ESCALATION_OFFER =
  "That sounds like it needs a person, not a hint. I can set you up with one of our tutors. Want me to find you a time?";

export function refuseAnswer(ctx: HelperContext): string {
  const idea = ctx.keyIdea ? ` The idea it turns on: ${ctx.keyIdea}` : "";
  return (
    "I won't give you the answer, that part is yours. What I can do is take it one step at a time." +
    idea +
    "\n\nTell me the first thing you tried and I'll tell you whether the move was sound."
  );
}

/**
 * Opened from a page with no problem on it, the helper has no key idea or hint
 * to quote. Saying "the key idea here:" and then nothing is worse than saying
 * something plain, so this covers the contextless case.
 */
export function generalReply(text: string): string {
  const t = text.toLowerCase();
  if (/\b(hi|hey|hello|yo)\b/.test(t) || !t)
    return "Hey. Tell me the step you are stuck on and I will take it from there, or switch to Formulas if you want a formula back.";
  if (/\b(how|what|why|explain)\b/.test(t))
    return "Open the skill you are working on and ask me there, and I can point at the exact step. From here I can still give you a formula, or put you with a tutor. Which would help more?";
  return "Tell me what you tried and where it stopped making sense. If it is a formula you want, switch to Formulas. If you want a person, choose Book a tutor.";
}

export function arithmeticReply(a: Arithmetic): string {
  const sym = a.op === "*" ? "x" : "/";
  return `${formatNumber(a.a)} ${sym} ${formatNumber(a.b)} = ${formatNumber(a.value)}`;
}

/** The reply when a calculation is a step of the problem on screen. It names no number. */
export function arithmeticStepReply(a: Arithmetic): string {
  const what = a.op === "*" ? "multiplication" : "division";
  return `That ${what} is a step in the problem you are working on, so the number it gives is yours to find. Work it out on paper, or on the calculator if this problem has one, then tell me what you got and why you picked that step, and we can look at the move together.`;
}

export function reminderReply(ctx: HelperContext, text: string): string {
  const f = findFormulaCard(text);
  if (f) return formulaCardText(f);
  if (ctx.keyIdea) {
    return `For ${ctx.skillTitle ?? "this skill"}, the one to keep: ${ctx.keyIdea}\n\nName the formula you are trying to remember and I will give you a way to hold on to it.`;
  }
  return "Name the formula you want to hold on to, slope, the quadratic formula, the Pythagorean theorem, and I will give you the statement plus a way to remember it.";
}

export interface FormulaCard {
  name: string;
  match: string[];
  formula: string;
  mnemonic: string;
}

export function formulaCardText(f: FormulaCard): string {
  return `${f.name}\n\n${f.formula}\n\nHow to hold on to it: ${f.mnemonic}`;
}

/**
 * The card a request names. The card's own name wins, then the longest match
 * phrase found: "slope-intercept form" contains "slope", and the first card
 * used to win on that alone, so asking for y = mx + b gave back rise over run.
 */
export function findFormulaCard(text: string): FormulaCard | null {
  const t = text.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const named = FORMULA_CARDS.find((f) => f.name.toLowerCase().replace(/-/g, " ") === t);
  if (named) return named;
  let best: { card: FormulaCard; len: number } | null = null;
  for (const card of FORMULA_CARDS) {
    for (const m of card.match) {
      const phrase = m.replace(/-/g, " ");
      if (t.includes(phrase) && (!best || phrase.length > best.len)) best = { card, len: phrase.length };
    }
  }
  return best?.card ?? null;
}

/**
 * Statements of standard formulas. These are not answers to anybody's problem,
 * they are the reference a student is allowed to look up, so the gate does not
 * apply to them.
 */
export const FORMULA_CARDS: FormulaCard[] = [
  {
    name: "Slope between two points",
    match: ["slope", "gradient", "rise over run"],
    formula: "m = (y2 - y1) / (x2 - x1)",
    mnemonic: "Rise over run. The y values are the climb, the x values are the walk.",
  },
  {
    name: "Slope-intercept form",
    match: ["slope intercept", "y = mx", "y=mx", "intercept form"],
    formula: "y = mx + b",
    mnemonic: "m is the steepness, b is where the line crosses the y axis.",
  },
  {
    name: "The quadratic formula",
    match: ["quadratic formula", "quadratic"],
    formula: "x = (-b +/- sqrt(b^2 - 4ac)) / (2a)",
    mnemonic: "Negative b, plus or minus the root of b squared minus four a c, all over two a.",
  },
  {
    name: "Difference of squares",
    match: ["difference of squares", "a2 - b2", "a^2 - b^2"],
    formula: "a^2 - b^2 = (a + b)(a - b)",
    mnemonic: "Same two terms, one sum and one difference.",
  },
  {
    name: "The Pythagorean theorem",
    match: ["pythagor", "hypotenuse", "right triangle"],
    formula: "a^2 + b^2 = c^2",
    mnemonic: "The two short sides, squared and added, equal the long side squared.",
  },
  {
    name: "Point-slope form",
    match: ["point slope", "point-slope"],
    formula: "y - y1 = m(x - x1)",
    mnemonic: "Start from a point you know, then travel at slope m.",
  },
  {
    name: "Distance between two points",
    match: ["distance formula", "distance between"],
    formula: "d = sqrt((x2 - x1)^2 + (y2 - y1)^2)",
    mnemonic: "Pythagoras with the legs measured off the axes.",
  },
  {
    name: "Exponent rules",
    match: ["exponent rule", "power rule", "laws of exponents"],
    formula: "a^m * a^n = a^(m+n),  a^m / a^n = a^(m-n),  (a^m)^n = a^(mn)",
    mnemonic: "Multiplying adds the powers, dividing subtracts them, a power of a power multiplies.",
  },
];

// ---------------------------------------------------------------------------
// The scheduling handoff
// ---------------------------------------------------------------------------

export type SchedulerStep = "offered" | "awaiting_time" | "awaiting_tutor" | "done" | "declined";

export interface SchedulerState {
  step: SchedulerStep;
  freeText?: string;
  tutorName?: string;
}

export function schedulerPrompt(step: SchedulerStep): string {
  switch (step) {
    case "offered":
      return ESCALATION_OFFER;
    case "awaiting_time":
      return "Good. When are you free? Say it however you like, \"Tuesday after 4\" or \"weekday evenings\" both work.";
    case "awaiting_tutor":
      return "Anyone in particular you want? Name a tutor, or say \"anyone\" and I will send it to whoever is free first.";
    case "done":
      return "Sent. A tutor will confirm from their side, and you will see it on your messages. You can keep working in the meantime.";
    case "declined":
      return "No problem. I am here if you change your mind. Where do you want to pick up?";
  }
}

/** Moves the little booking conversation along. Pure, so it is easy to test. */
export function advanceScheduler(state: SchedulerState, text: string): SchedulerState {
  switch (state.step) {
    case "offered":
      if (isYes(text)) return { ...state, step: "awaiting_time" };
      if (isNo(text)) return { ...state, step: "declined" };
      return state;
    case "awaiting_time":
      return { ...state, step: "awaiting_tutor", freeText: text.trim() };
    case "awaiting_tutor": {
      const t = text.trim();
      const anyone = /^(anyone|any|whoever|no preference|doesn'?t matter|dont care)\b/i.test(t);
      return { ...state, step: "done", tutorName: anyone ? undefined : t };
    }
    default:
      return state;
  }
}

/** What the panel says when a student picks Book a tutor themselves. */
export const BOOKING_INTRO =
  "I can set you up with one of our tutors, a real person who can work through it with you. Want me to find you a time?";

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

/**
 * How each quick action shapes the model's job. These sit on top of the tutor
 * prompt and its absolute rule, and the reply is still filtered afterwards:
 * an instruction is a request, the filter is the guarantee.
 *
 * `avoid` is the list of numbers the reply may not contain. A worked example
 * is full of numbers, so it is told which ones are off limits up front rather
 * than finding out from the filter.
 */
export function actionInstruction(action: HelperAction, avoid: string[] = []): string {
  switch (action) {
    case "hint":
      return `The student pressed "Give me a hint". Give one hint that points at the next move without making the move for them. If a hint is listed above, build on it in your own words. End with a short question.`;
    case "first-step":
      return `The student asked for the first step. Name the very first move and say in one sentence why it is a good place to start. Do not carry it out and do not say what it produces. End by asking them to try it.`;
    case "key-idea":
      return `Explain the key idea of this skill in plain words a 13 year old would use, with one tiny example that is not their problem. Then say in one sentence how it applies to their problem, without solving any of it. Stay under 70 words.`;
    case "example": {
      const numbers = avoid.length ? ` Never write any of these numbers anywhere in your reply: ${avoid.join(", ")}.` : "";
      return `The student asked for a similar example. Make up a NEW problem of the same kind with different numbers, and work it all the way through so they can copy the method on their own problem. The absolute rule above is about the student's problem; your made-up example has its own answer and you should show it.
Format: one line that starts "Here is a similar one:" and states the new problem. Then the steps, one short sentence each, one per line, numbered like "1. ", at most 5 steps, and the last step states the example's own answer. Then one short line inviting them to use the same steps on their problem.
Do not reuse the student's problem or its numbers, and never refer to a step by its number in a sentence. This reply may run to about 120 words.${numbers}`;
    }
    case "another-way":
      return `The student asked you to explain your last message another way. Say the same idea differently: a picture in words, an everyday comparison, or the same move on smaller, easier numbers that are not from their problem. Do not repeat your earlier wording. End with a short question.`;
    case "next-step":
      return `The student wants the next step. Look at what has been done so far in this conversation and name the one next move, without doing it for them. End with a short question.`;
  }
}

/**
 * The deterministic engine reads the student's words, not the button, so a
 * quick action is translated into the words that steer it.
 */
export function actionAsWords(action: HelperAction): string {
  switch (action) {
    case "hint":
      return "give me a hint";
    case "first-step":
      return "how do i start";
    case "key-idea":
      return "explain the key idea";
    case "example":
      return "explain the key idea";
    case "another-way":
      return "explain why";
    case "next-step":
      return "what next";
  }
}

/** When no clean example can be made, the method is the next best thing. */
export function exampleFallback(ctx: HelperContext): string {
  const idea = ctx.keyIdea ? ` The idea to copy: ${ctx.keyIdea}` : "";
  return `I could not build a clean example this time, so here is the method instead.${idea}\n\nTry the first move on your problem and tell me what you get. I will check the move with you.`;
}

/**
 * A worked example is a numbered list, and "2. Subtract..." must not trip the
 * filter when the answer happens to be 2. Only markers that count up from 1 at
 * the start of a line are removed, so a number that is part of the maths is
 * still checked.
 */
export function withoutListMarkers(text: string): string {
  let expect = 1;
  return text
    .split("\n")
    .map((line) => {
      const m = /^(\s*)(\d{1,2})[.)]\s+/.exec(line);
      if (m && Number(m[2]) === expect) {
        expect += 1;
        return m[1] + line.slice(m[0].length);
      }
      return line;
    })
    .join("\n");
}

/** Emoji are not house style, and the older local engine still greets with one. */
export function stripEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,!?])/g, "$1");
}
