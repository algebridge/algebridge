/**
 * What a student is into, and the worlds their practice problems get set in.
 *
 * Kept inside the progress document (`progress.interests`), which already
 * follows the student to their account, so it needs no new table. Pure and
 * shared: the picker, the practice panel and the API routes all use it.
 */

export interface InterestTopic {
  /** Shown on the problem card, e.g. "Basketball". */
  label: string;
  /** Real things from that world, so a problem can be specific. */
  details: string;
}

export interface InterestProfile {
  /** Chips the student tapped (ids from INTEREST_OPTIONS). */
  picks: string[];
  /** What they wrote in their own words. */
  note: string;
  /** What the picks and the note boil down to. Problems are set in these. */
  topics: InterestTopic[];
  /** "ai" when a model read the note, "picks" when only the chips were used. */
  source: "ai" | "picks";
  updatedAt: string;
  /** They chose to skip. The prompt does not come back on its own after that. */
  skipped?: boolean;
}

/** Chips plus what they wrote. The writer picks the best fit per problem, so more choice helps. */
export const MAX_TOPICS = 6;
export const NOTE_MAX = 200;

export const INTEREST_OPTIONS: { id: string; label: string; details: string }[] = [
  { id: "basketball", label: "Basketball", details: "threes (3 points), twos (2 points), free throws (1 point), the shot clock, laps at practice, tickets to games" },
  { id: "soccer", label: "Soccer", details: "goals, assists, league points (3 a win, 1 a draw), minutes played, laps at practice, jerseys" },
  { id: "football", label: "Football", details: "touchdowns (6 points), field goals (3 points), yards, first downs, laps at practice" },
  { id: "video-games", label: "Video games", details: "XP per quest, coins per level, lives, speedrun seconds, loot drops, skins in the shop" },
  { id: "minecraft", label: "Minecraft", details: "stacks of 64, blocks per row, chests, emeralds per trade, ingots per smelt, rails, diamonds" },
  { id: "roblox", label: "Roblox", details: "Robux per game pass, obby stages, pets, coins per round, visits to your game" },
  { id: "music", label: "Music", details: "beats per minute, songs per playlist, streams per day, concert tickets, minutes per song" },
  { id: "art", label: "Drawing & art", details: "sketches per page, paint tubes, canvas sizes, commissions and their prices, stickers per sheet" },
  { id: "cooking", label: "Cooking & baking", details: "cookies per tray, cups of flour per batch, minutes per batch, cupcakes per box, bake sale prices" },
  { id: "animals", label: "Animals & pets", details: "treats per day, dog walks and their pay, fish per tank, cups of food per meal, shelter adoptions" },
  { id: "space", label: "Space", details: "rockets, fuel tanks, orbits per day, launch countdown seconds, satellites, miles to orbit" },
  { id: "cars", label: "Cars & racing", details: "laps per race, lap times, miles per gallon, pit stops, horsepower, road trips" },
  { id: "anime", label: "Anime & manga", details: "episodes per season, minutes per episode, manga volumes, chapters per week, figures" },
  { id: "creators", label: "YouTube & TikTok", details: "views per video, followers per day, videos per week, likes, sponsor deals, subscribers" },
  { id: "fashion", label: "Fashion & sneakers", details: "sneaker drops and resale prices, outfits, thrift finds, pairs per box, price tags" },
  { id: "dance", label: "Dance", details: "eight-counts, moves per routine, rehearsal minutes, competitions, costumes" },
  { id: "coding", label: "Coding & tech", details: "app downloads per day, lines of code, pixels, battery percent, bugs fixed per hour" },
  { id: "business", label: "Money & business", details: "items sold, price per item, profit, savings per week, customers per day" },
];

const OPTION_BY_ID = new Map(INTEREST_OPTIONS.map((o) => [o.id, o]));

/** The picks alone, as topics. Used whenever no model reads the note. */
export function topicsFromPicks(picks: string[]): InterestTopic[] {
  const out: InterestTopic[] = [];
  for (const id of picks) {
    const o = OPTION_BY_ID.get(id);
    if (o && !out.some((t) => t.label === o.label)) out.push({ label: o.label, details: o.details });
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

export function validPicks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((id): id is string => typeof id === "string" && OPTION_BY_ID.has(id))));
}

/**
 * Words that keep a topic, or a problem written about one, out of a classroom.
 * Deliberately blunt. A false alarm costs one plain problem; a miss puts
 * something in front of a twelve-year-old.
 */
const UNSAFE = new RegExp(
  "\\b(" +
    [
      "sex\\w*", "porn\\w*", "nude\\w*", "naked", "boobs?", "hookup",
      "drugs?", "weed", "marijuana", "cocaine", "heroin", "meth", "vap(e|es|ing)", "alcohol", "beers?",
      "wine", "vodka", "drunk", "smok(e|es|ing)", "cigarettes?",
      "guns?", "rifles?", "pistols?", "shotguns?", "kill\\w*", "murder\\w*", "blood\\w*", "gore",
      "suicide", "self-harm", "stab(s|bed|bing)?", "bombs?", "terror\\w*", "nazi\\w*", "hitler",
      "gambl\\w*", "casinos?", "betting", "lottery",
      "fuck\\w*", "shit\\w*", "bitch\\w*", "ass", "asshole", "damn", "crap", "dick", "piss\\w*",
    ].join("|") +
    ")\\b",
  "i"
);

export function isSchoolSafe(text: string): boolean {
  return !UNSAFE.test(text);
}

/** Collapses whitespace and removes anything that is not ordinary text. */
export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f<>{}\[\]`\\]/g, " ")
    .replace(/[—–]/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Looks like contact details, which have no business in a topic. */
const PERSONAL = /(@|https?:|www\.|\.com\b|\d{3}[-. ]?\d{3}[-. ]?\d{4})/i;

/**
 * Whatever a topic list came from (a model, or a client), this is the only
 * way it gets into the product: short, plain, safe, and at most six.
 */
export function sanitizeTopics(raw: unknown): InterestTopic[] {
  if (!Array.isArray(raw)) return [];
  const out: InterestTopic[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    // Markup in a label is not an interest, whatever is left once it is stripped.
    const rawLabel = (item as { label?: unknown }).label;
    if (typeof rawLabel !== "string" || /[<>{}\[\]`\\]/.test(rawLabel)) continue;
    const label = cleanText(rawLabel, 32);
    const details = cleanText((item as { details?: unknown }).details, 90);
    if (label.length < 2 || !/^[\p{L}\p{N}][\p{L}\p{N} &'.,\-+!]*$/u.test(label)) continue;
    if (!isSchoolSafe(`${label} ${details}`) || PERSONAL.test(`${label} ${details}`)) continue;
    if (out.some((t) => t.label.toLowerCase() === label.toLowerCase())) continue;
    out.push({ label, details });
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

/**
 * What they tapped always survives, whatever a model made of the note: a
 * model once read "I bake cookies and post on TikTok" alongside Basketball
 * and Minecraft taps and returned only "Baking". Topics from the note are
 * added after the taps, skipping any that overlap one ("Minecraft building").
 */
export function mergeTopics(fromPicks: InterestTopic[], fromNote: InterestTopic[]): InterestTopic[] {
  const out = [...fromPicks];
  const overlaps = (a: string, b: string) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x === y || x.includes(y) || y.includes(x);
  };
  for (const t of fromNote) {
    if (out.length >= MAX_TOPICS) break;
    if (!out.some((p) => overlaps(p.label, t.label))) out.push(t);
  }
  return out.slice(0, MAX_TOPICS);
}

/** Problems rotate through the topics, so one session is not all one world. */
export function topicForIndex(topics: InterestTopic[], index: number): InterestTopic | null {
  if (!topics.length) return null;
  return topics[((index % topics.length) + topics.length) % topics.length];
}

/** "Basketball, Minecraft and Music" */
export function listTopics(topics: InterestTopic[]): string {
  const labels = topics.map((t) => t.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
