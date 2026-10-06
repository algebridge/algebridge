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
  { id: "basketball", label: "Basketball", details: "point guard, forwards and the center; threes are worth 3 points, twos 2, free throws 1; the shot clock, quarters and timeouts; layup lines and free-throw drills at practice; season averages; the team bus to an away game; tickets and snacks sold at the gym door" },
  { id: "soccer", label: "Soccer", details: "striker, midfielders, defenders and the keeper; goals, assists and clean sheets; a league table gives 3 points for a win and 1 for a draw; two halves, corner kicks and penalties; passing drills and sprints at practice; a tournament weekend; cleats, shin guards and jerseys" },
  { id: "football", label: "Football", details: "quarterback, receivers, running backs and the kicker; a touchdown is worth 6 points, a field goal 3, an extra point 1; yards per carry; a first down after 10 yards; four quarters and the play clock; sprints at practice; Friday night games with the band and the student section" },
  { id: "video-games", label: "Video games", details: "quests that give XP to level up, coins and gems, health bars and lives, boss fights, speedruns timed to the second, loot drops, crafting gear, the item shop and skins, ranked matches and leaderboards, daily challenges" },
  { id: "minecraft", label: "Minecraft", details: "a survival world with friends; stacks of 64 and chests; furnaces smelting ore into ingots; villager trades for emeralds; rails and minecarts; redstone machines; crop and mob farms; building a base block by block; mining for diamonds; the Nether and the End" },
  { id: "roblox", label: "Roblox", details: "Robux and game passes; obbies with numbered stages; tycoons that earn cash every second; pets and eggs; simulators; building your own game in Studio; visits and likes on your game; trading with friends" },
  { id: "music", label: "Music", details: "beats per minute, measures and bars; band or choir rehearsals before a concert; a setlist that has to fit the show; playlists and streams on a song; recording in a studio; tickets and merch at a gig; practicing an instrument every day" },
  { id: "art", label: "Drawing & art", details: "sketchbooks, canvases and their sizes, paints and markers; commissions and what they cost; an art show at school; frames; sticker sheets and prints sold at a craft fair; layers in a digital drawing app" },
  { id: "cooking", label: "Cooking & baking", details: "recipes scaled up for a crowd, cups and teaspoons, trays of cookies, oven timers, boxes of cupcakes, a bake sale with prices per item, groceries for a family dinner, a cooking competition on TV" },
  { id: "animals", label: "Animals & pets", details: "feeding schedules and cups of food per meal; dog walking jobs paid per walk; fish tanks measured in gallons; trips to the vet; shelter adoption days; training treats; a puppy growing month by month" },
  { id: "space", label: "Space", details: "rocket launches and countdowns; fuel tanks; orbits around Earth; the Moon and Mars; satellites; the International Space Station; telescope nights; distances in miles or kilometers; astronaut training" },
  { id: "cars", label: "Cars & racing", details: "laps around a track and lap times; pit stops for tires and fuel; miles per gallon; horsepower; a race weekend with qualifying; a family road trip with stops; saving up for a first car" },
  { id: "anime", label: "Anime & manga", details: "episodes per season and minutes per episode; binge-watching a series; manga volumes and a new chapter every week; collecting figures; a convention with cosplay and an artist alley" },
  { id: "creators", label: "YouTube & TikTok", details: "views, likes and subscribers; a posting schedule; video length and editing time; sponsor deals paid per video; going viral; livestreams; followers gained per day; filming a series with friends" },
  { id: "fashion", label: "Fashion & sneakers", details: "sneaker drops and resale prices; thrifting; outfits planned for the week; sizes; store sales and discounts; saving up for a pair; a closet clean-out sale" },
  { id: "dance", label: "Dance", details: "eight-counts and routines; rehearsals before a competition; costumes; a studio recital; formations on stage; practice minutes each week; scores from the judges" },
  { id: "coding", label: "Coding & tech", details: "apps and their downloads; lines of code and bugs fixed; battery percent; screen pixels; a game you are building; a robotics team before a competition; upload and download speeds" },
  { id: "business", label: "Money & business", details: "a small business like a lemonade stand or a T-shirt shop; price per item, costs and profit; customers per day; saving each week toward a goal; a summer job that pays by the hour" },
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
