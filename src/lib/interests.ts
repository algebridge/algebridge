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
  /**
   * The student's own: the teams and players, the characters, the games, the
   * artists they actually follow. Written in their words, kept with the
   * topic, and handed to the writer so a fan sees their own names.
   */
  specifics?: string;
}

export interface InterestProfile {
  /** Chips the student tapped (ids from INTEREST_OPTIONS). */
  picks: string[];
  /** What they wrote in their own words. */
  note: string;
  /** Per tapped chip (by id): the specific teams, players, characters, games they named. */
  specifics?: Record<string, string>;
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
/** One line per interest: a few teams, players, characters or games. */
export const SPECIFICS_MAX = 120;

export interface InterestOption {
  id: string;
  label: string;
  /** Real things from that world, so a problem can be specific. */
  details: string;
  /** The question under the chip: "Which teams and players?" */
  ask: string;
  /** Placeholder for the answer. */
  example: string;
  /** Real, public, evergreen names a student can tap instead of typing. */
  suggestions: string[];
}

export const INTEREST_OPTIONS: InterestOption[] = [
  { id: "basketball", label: "Basketball", details: "point guard, forwards and the center; threes are worth 3 points, twos 2, free throws 1; the shot clock, quarters and timeouts; layup lines and free-throw drills at practice; season averages; the team bus to an away game; tickets and snacks sold at the gym door", ask: "Which teams and players?", example: "e.g. the Celtics, Steph Curry, my school team", suggestions: ["Lakers","Celtics","Warriors","LeBron James","Steph Curry","Caitlin Clark","WNBA","my school team"] },
  { id: "soccer", label: "Soccer", details: "striker, midfielders, defenders and the keeper; goals, assists and clean sheets; a league table gives 3 points for a win and 1 for a draw; two halves, corner kicks and penalties; passing drills and sprints at practice; a tournament weekend; cleats, shin guards and jerseys", ask: "Which teams and players?", example: "e.g. Arsenal, Messi, the USWNT", suggestions: ["Real Madrid","Barcelona","Arsenal","Man City","Messi","Ronaldo","USWNT","my club team"] },
  { id: "football", label: "Football", details: "quarterback, receivers, running backs and the kicker; a touchdown is worth 6 points, a field goal 3, an extra point 1; yards per carry; a first down after 10 yards; four quarters and the play clock; sprints at practice; Friday night games with the band and the student section", ask: "Which teams and players?", example: "e.g. the Eagles, Patrick Mahomes, my high school", suggestions: ["Eagles","Chiefs","Cowboys","Patrick Mahomes","Jalen Hurts","Travis Kelce","fantasy football","my high school team"] },
  { id: "video-games", label: "Video games", details: "quests that give XP to level up, coins and gems, health bars and lives, boss fights, speedruns timed to the second, loot drops, crafting gear, the item shop and skins, ranked matches and leaderboards, daily challenges", ask: "Which games and characters?", example: "e.g. Fortnite, Zelda, Kirby", suggestions: ["Fortnite","Zelda","Mario Kart","Valorant","EA FC","Pokémon","NBA 2K","Call of Duty"] },
  { id: "minecraft", label: "Minecraft", details: "a survival world with friends; stacks of 64 and chests; furnaces smelting ore into ingots; villager trades for emeralds; rails and minecarts; redstone machines; crop and mob farms; building a base block by block; mining for diamonds; the Nether and the End", ask: "What do you build, play or watch?", example: "e.g. survival with friends, Hypixel, Technoblade", suggestions: ["survival with friends","Hypixel","Bedwars","redstone","building a base","Hardcore","speedrunning","my own server"] },
  { id: "roblox", label: "Roblox", details: "Robux and game passes; obbies with numbered stages; tycoons that earn cash every second; pets and eggs; simulators; building your own game in Studio; visits and likes on your game; trading with friends", ask: "Which games?", example: "e.g. Adopt Me, Blox Fruits, Tower of Hell", suggestions: ["Adopt Me","Blox Fruits","Tower of Hell","Brookhaven","Dress to Impress","Pet Simulator","building in Studio","obbies"] },
  { id: "music", label: "Music", details: "beats per minute, measures and bars; band or choir rehearsals before a concert; a setlist that has to fit the show; playlists and streams on a song; recording in a studio; tickets and merch at a gig; practicing an instrument every day", ask: "Which artists, songs or instruments?", example: "e.g. Taylor Swift, trumpet in band, Kendrick", suggestions: ["Taylor Swift","Drake","Billie Eilish","Kendrick Lamar","Olivia Rodrigo","K-pop","band","choir","guitar","piano"] },
  { id: "art", label: "Drawing & art", details: "sketchbooks, canvases and their sizes, paints and markers; commissions and what they cost; an art show at school; frames; sticker sheets and prints sold at a craft fair; layers in a digital drawing app", ask: "What do you draw, and with what?", example: "e.g. anime characters, Procreate, my dog", suggestions: ["Procreate","anime characters","sketching","watercolor","digital art","my own characters","comics","stickers"] },
  { id: "cooking", label: "Cooking & baking", details: "recipes scaled up for a crowd, cups and teaspoons, trays of cookies, oven timers, boxes of cupcakes, a bake sale with prices per item, groceries for a family dinner, a cooking competition on TV", ask: "What do you make?", example: "e.g. chocolate chip cookies, ramen, birthday cakes", suggestions: ["chocolate chip cookies","cupcakes","ramen","pizza from scratch","pancakes","cake decorating","tacos","bread"] },
  { id: "animals", label: "Animals & pets", details: "feeding schedules and cups of food per meal; dog walking jobs paid per walk; fish tanks measured in gallons; trips to the vet; shelter adoption days; training treats; a puppy growing month by month", ask: "Which animals or pets?", example: "e.g. my dog Max, horses, a betta fish", suggestions: ["my dog","my cat","horses","a betta fish","hamsters","birds","reptiles","volunteering at a shelter"] },
  { id: "space", label: "Space", details: "rocket launches and countdowns; fuel tanks; orbits around Earth; the Moon and Mars; satellites; the International Space Station; telescope nights; distances in miles or kilometers; astronaut training", ask: "What in space?", example: "e.g. SpaceX launches, Mars rovers, black holes", suggestions: ["SpaceX launches","Mars rovers","NASA Artemis","black holes","the James Webb telescope","the ISS","Saturn","astronaut training"] },
  { id: "cars", label: "Cars & racing", details: "laps around a track and lap times; pit stops for tires and fuel; miles per gallon; horsepower; a race weekend with qualifying; a family road trip with stops; saving up for a first car", ask: "Which cars, drivers or races?", example: "e.g. Verstappen, F1, Mustangs", suggestions: ["Formula 1","Max Verstappen","Lewis Hamilton","Lando Norris","Tesla","Mustangs","drifting","NASCAR"] },
  { id: "anime", label: "Anime & manga", details: "episodes per season and minutes per episode; binge-watching a series; manga volumes and a new chapter every week; collecting figures; a convention with cosplay and an artist alley", ask: "Which shows and characters?", example: "e.g. One Piece, Luffy, Jujutsu Kaisen", suggestions: ["One Piece","Naruto","Jujutsu Kaisen","Demon Slayer","My Hero Academia","Attack on Titan","Dragon Ball","Spy x Family"] },
  { id: "creators", label: "YouTube & TikTok", details: "views, likes and subscribers; a posting schedule; video length and editing time; sponsor deals paid per video; going viral; livestreams; followers gained per day; filming a series with friends", ask: "Which creators and channels?", example: "e.g. MrBeast, Dude Perfect, my own channel", suggestions: ["MrBeast","Dude Perfect","Mark Rober","Marques Brownlee","IShowSpeed","Kai Cenat","Ryan Trahan","my own channel"] },
  { id: "fashion", label: "Fashion & sneakers", details: "sneaker drops and resale prices; thrifting; outfits planned for the week; sizes; store sales and discounts; saving up for a pair; a closet clean-out sale", ask: "Which brands or styles?", example: "e.g. Jordans, thrifting, Nike Dunks", suggestions: ["Jordans","Nike Dunks","New Balance","thrifting","streetwear","Converse","Crocs","Lululemon"] },
  { id: "dance", label: "Dance", details: "eight-counts and routines; rehearsals before a competition; costumes; a studio recital; formations on stage; practice minutes each week; scores from the judges", ask: "What kind, and who inspires you?", example: "e.g. hip hop, my studio team, ballet", suggestions: ["hip hop","ballet","jazz","my studio team","competitions","TikTok dances","tap","K-pop choreo"] },
  { id: "coding", label: "Coding & tech", details: "apps and their downloads; lines of code and bugs fixed; battery percent; screen pixels; a game you are building; a robotics team before a competition; upload and download speeds", ask: "What do you build, and in what?", example: "e.g. Python, a Discord bot, Scratch games", suggestions: ["Python","Scratch","JavaScript","a Discord bot","robotics team","Roblox Studio","making a game","Arduino"] },
  { id: "business", label: "Money & business", details: "a small business like a lemonade stand or a T-shirt shop; price per item, costs and profit; customers per day; saving each week toward a goal; a summer job that pays by the hour", ask: "What do you sell or plan to?", example: "e.g. lemonade stand, custom shirts, mowing lawns", suggestions: ["lemonade stand","custom shirts","mowing lawns","reselling sneakers","babysitting","an Etsy shop","car washing","a YouTube channel"] },
];

const OPTION_BY_ID = new Map(INTEREST_OPTIONS.map((o) => [o.id, o]));

/** The picks alone, as topics, each carrying what the student named for it. Used whenever no model reads the note. */
export function topicsFromPicks(picks: string[], specifics: Record<string, string> = {}): InterestTopic[] {
  const out: InterestTopic[] = [];
  for (const id of picks) {
    const o = OPTION_BY_ID.get(id);
    if (o && !out.some((t) => t.label === o.label)) {
      const own = cleanSpecifics(specifics[id]);
      out.push({ label: o.label, details: o.details, ...(own ? { specifics: own } : {}) });
    }
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

/**
 * One student's specifics for one interest: plain text, short, school-safe,
 * and free of anything that looks like contact details. Empty when not.
 */
export function cleanSpecifics(raw: unknown): string {
  const text = cleanText(raw, SPECIFICS_MAX);
  if (!text || !isSchoolSafe(text) || PERSONAL.test(text)) return "";
  return text;
}

/**
 * What the model made of each tapped interest's specifics: public teams,
 * players, characters, games and brands kept; a friend, a coach, a school
 * or a town dropped. A topic the model says nothing about keeps what the
 * student wrote (the model may be down); one it returns empty for loses
 * its specifics and gets plain stories, which beats a classmate's name in
 * a word problem.
 */
export function applyCleanedSpecifics(
  topics: InterestTopic[],
  cleaned: unknown
): InterestTopic[] {
  if (!Array.isArray(cleaned)) return topics;
  const byLabel = new Map<string, string>();
  for (const item of cleaned) {
    if (!item || typeof item !== "object") continue;
    const { interest, specifics } = item as { interest?: unknown; specifics?: unknown };
    if (typeof interest !== "string" || typeof specifics !== "string") continue;
    byLabel.set(interest.trim().toLowerCase(), cleanSpecifics(specifics));
  }
  return topics.map((t) => {
    const own = byLabel.get(t.label.toLowerCase());
    if (own === undefined) return t;
    const { specifics: _dropped, ...rest } = t;
    return own ? { ...rest, specifics: own } : rest;
  });
}

/** The specifics a client sent, kept only for chips it actually tapped. */
export function validSpecifics(raw: unknown, picks: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of picks) {
    const own = cleanSpecifics((raw as Record<string, unknown>)[id]);
    if (own) out[id] = own;
  }
  return out;
}

/**
 * The key a topic's stories are stored under. A topic with specifics gets
 * its own pool, so one student's players never turn up in another's
 * problems, and the plain pool stays plain.
 */
export function topicKey(topic: InterestTopic): string {
  const own = (topic.specifics ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return own ? `${topic.label}|${own}` : topic.label;
}

const FILLER = new Set(["my", "the", "a", "an", "own", "with", "in", "at", "of", "and", "on", "for", "to", "team", "channel"]);

/** The words that make a favorite recognizable: "my club team" is "club"; "Jujutsu Kaisen" is either word. */
export function favoriteWords(item: string): string[] {
  const words = item.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((w) => w && !FILLER.has(w));
  const strong = words.filter((w) => w.length >= 4);
  return strong.length ? strong : words.filter((w) => w.length >= 2);
}

/**
 * Does a story set in this topic name one of the student's favorites? A
 * topic without specifics always does. Code checks this because a writer
 * told "Messi is the point" still wrote about "the championship" half the
 * time; a story that fails goes back for a repair, naming the miss.
 */
export function namesFavorite(text: string, topic: Pick<InterestTopic, "specifics">): boolean {
  if (!topic.specifics) return true;
  const haystack = text.toLowerCase();
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordIn = (w: string) => new RegExp("(^|[^\\p{L}\\p{N}])" + escape(w) + "(?=$|[^\\p{L}\\p{N}])", "u").test(haystack);
  return topic.specifics
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((item) => favoriteWords(item).some(wordIn));
}

/** "Soccer (Arsenal, Messi)" for a topic with specifics, else the label. */
export function describeTopic(topic: InterestTopic): string {
  return topic.specifics ? `${topic.label} (${topic.specifics})` : topic.label;
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
    const specifics = cleanSpecifics((item as { specifics?: unknown }).specifics);
    if (label.length < 2 || !/^[\p{L}\p{N}][\p{L}\p{N} &'.,\-+!]*$/u.test(label)) continue;
    if (!isSchoolSafe(`${label} ${details}`) || PERSONAL.test(`${label} ${details}`)) continue;
    if (out.some((t) => t.label.toLowerCase() === label.toLowerCase())) continue;
    out.push({ label, details, ...(specifics ? { specifics } : {}) });
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
  const out = fromPicks.map((t) => ({ ...t }));
  const overlaps = (a: string, b: string) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x === y || x.includes(y) || y.includes(x);
  };
  for (const t of fromNote) {
    if (out.length >= MAX_TOPICS) break;
    const same = out.find((p) => overlaps(p.label, t.label));
    if (!same) out.push(t);
    else if (!same.specifics && t.specifics) same.specifics = t.specifics;
  }
  return out.slice(0, MAX_TOPICS);
}

/** Problems rotate through the topics, so one session is not all one world. */
export function topicForIndex(topics: InterestTopic[], index: number): InterestTopic | null {
  if (!topics.length) return null;
  return topics[((index % topics.length) + topics.length) % topics.length];
}

/** "Basketball (the Celtics), Minecraft and Music" */
export function listTopics(topics: InterestTopic[]): string {
  const labels = topics.map(describeTopic);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
