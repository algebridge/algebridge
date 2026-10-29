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

/** The headings the picker groups the chips under, in order. */
export const INTEREST_GROUPS = ["Sports", "Games", "Screens & stories", "Make & do", "Life"] as const;
export type InterestGroup = (typeof INTEREST_GROUPS)[number];

export interface InterestOption {
  id: string;
  label: string;
  /** Where the chip sits in the picker. */
  group: InterestGroup;
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
  { id: "basketball", group: "Sports", label: "Basketball", details: "point guard, forwards and the center; threes are worth 3 points, twos 2, free throws 1; the shot clock, quarters and timeouts; layup lines and free-throw drills at practice; season averages; the team bus to an away game; tickets and snacks sold at the gym door", ask: "Which teams and players?", example: "e.g. the Celtics, Steph Curry, my school team", suggestions: ["Lakers","Celtics","Warriors","76ers","Knicks","Heat","Bulls","Thunder","Nuggets","Bucks","Mavericks","LeBron James","Steph Curry","Kevin Durant","Giannis","Nikola Jokić","Luka Dončić","Shai Gilgeous-Alexander","Victor Wembanyama","Jayson Tatum","Anthony Edwards","Joel Embiid","Ja Morant","Caitlin Clark","A'ja Wilson","Paige Bueckers","Angel Reese","WNBA","March Madness","NBA 2K","my school team"] },
  { id: "soccer", group: "Sports", label: "Soccer", details: "striker, midfielders, defenders and the keeper; goals, assists and clean sheets; a league table gives 3 points for a win and 1 for a draw; two halves, corner kicks and penalties; passing drills and sprints at practice; a tournament weekend; cleats, shin guards and jerseys", ask: "Which teams and players?", example: "e.g. Arsenal, Messi, the USWNT", suggestions: ["Real Madrid","Barcelona","Arsenal","Man City","Man United","Liverpool","Chelsea","Tottenham","Bayern Munich","PSG","Juventus","Inter Miami","Philadelphia Union","Messi","Ronaldo","Mbappé","Haaland","Vinícius Jr.","Jude Bellingham","Lamine Yamal","Mohamed Salah","Bukayo Saka","Christian Pulisic","Alex Morgan","Trinity Rodman","Sophia Smith","USWNT","USMNT","the World Cup","Premier League","Champions League","EA FC","my club team"] },
  { id: "football", group: "Sports", label: "Football", details: "quarterback, receivers, running backs and the kicker; a touchdown is worth 6 points, a field goal 3, an extra point 1; yards per carry; a first down after 10 yards; four quarters and the play clock; sprints at practice; Friday night games with the band and the student section", ask: "Which teams and players?", example: "e.g. the Eagles, Patrick Mahomes, my high school", suggestions: ["Eagles","Chiefs","Cowboys","Ravens","Bills","49ers","Lions","Packers","Steelers","Giants","Jets","Bengals","Patrick Mahomes","Jalen Hurts","Josh Allen","Lamar Jackson","Joe Burrow","Saquon Barkley","Travis Kelce","Justin Jefferson","Ja'Marr Chase","CeeDee Lamb","A.J. Brown","Micah Parsons","T.J. Watt","the Super Bowl","college football","Penn State","Alabama","Ohio State","fantasy football","Madden","flag football","my high school team"] },
  { id: "video-games", group: "Games", label: "Video games", details: "quests that give XP to level up, coins and gems, health bars and lives, boss fights, speedruns timed to the second, loot drops, crafting gear, the item shop and skins, ranked matches and leaderboards, daily challenges", ask: "Which games and characters?", example: "e.g. Fortnite, Zelda, Kirby", suggestions: ["Fortnite","Zelda","Mario Kart","Valorant","EA FC","Pokémon","NBA 2K","Call of Duty"] },
  { id: "minecraft", group: "Games", label: "Minecraft", details: "a survival world with friends; stacks of 64 and chests; furnaces smelting ore into ingots; villager trades for emeralds; rails and minecarts; redstone machines; crop and mob farms; building a base block by block; mining for diamonds; the Nether and the End", ask: "What do you build, play or watch?", example: "e.g. survival with friends, Hypixel, Technoblade", suggestions: ["survival with friends","Hypixel","Bedwars","redstone","building a base","Hardcore","speedrunning","my own server"] },
  { id: "roblox", group: "Games", label: "Roblox", details: "Robux and game passes; obbies with numbered stages; tycoons that earn cash every second; pets and eggs; simulators; building your own game in Studio; visits and likes on your game; trading with friends", ask: "Which games?", example: "e.g. Adopt Me, Blox Fruits, Tower of Hell", suggestions: ["Adopt Me","Blox Fruits","Tower of Hell","Brookhaven","Dress to Impress","Pet Simulator","building in Studio","obbies"] },
  { id: "music", group: "Make & do", label: "Music", details: "beats per minute, measures and bars; band or choir rehearsals before a concert; a setlist that has to fit the show; playlists and streams on a song; recording in a studio; tickets and merch at a gig; practicing an instrument every day", ask: "Which artists, songs or instruments?", example: "e.g. Taylor Swift, trumpet in band, Kendrick", suggestions: ["Taylor Swift","Drake","Billie Eilish","Kendrick Lamar","Olivia Rodrigo","Sabrina Carpenter","SZA","Frank Ocean","Bad Bunny","The Weeknd","Ariana Grande","Doja Cat","Travis Scott","Tyler the Creator","Post Malone","Morgan Wallen","Zach Bryan","Chappell Roan","Bruno Mars","Ed Sheeran","Harry Styles","Beyoncé","Rihanna","Lady Gaga","Dua Lipa","Peso Pluma","Karol G","Michael Jackson","BTS","Stray Kids","BLACKPINK","Imagine Dragons","Coldplay","Arctic Monkeys","Twenty One Pilots","Linkin Park","The Beatles","Queen","Metallica","hip hop","pop","country","rock","R&B","K-pop","Latin","EDM","jazz","classical","metal","Afrobeats","band","choir","orchestra","guitar","piano","drums","making beats"] },
  { id: "art", group: "Make & do", label: "Drawing & art", details: "sketchbooks, canvases and their sizes, paints and markers; commissions and what they cost; an art show at school; frames; sticker sheets and prints sold at a craft fair; layers in a digital drawing app", ask: "What do you draw, and with what?", example: "e.g. anime characters, Procreate, my dog", suggestions: ["Procreate","anime characters","sketching","watercolor","digital art","my own characters","comics","stickers"] },
  { id: "cooking", group: "Make & do", label: "Cooking & baking", details: "recipes scaled up for a crowd, cups and teaspoons, trays of cookies, oven timers, boxes of cupcakes, a bake sale with prices per item, groceries for a family dinner, a cooking competition on TV", ask: "What do you make?", example: "e.g. chocolate chip cookies, ramen, birthday cakes", suggestions: ["chocolate chip cookies","cupcakes","ramen","pizza from scratch","pancakes","cake decorating","tacos","bread"] },
  { id: "animals", group: "Life", label: "Animals & pets", details: "feeding schedules and cups of food per meal; dog walking jobs paid per walk; fish tanks measured in gallons; trips to the vet; shelter adoption days; training treats; a puppy growing month by month", ask: "Which animals or pets?", example: "e.g. my dog Max, horses, a betta fish", suggestions: ["my dog","my cat","horses","a betta fish","hamsters","birds","reptiles","volunteering at a shelter"] },
  { id: "space", group: "Screens & stories", label: "Space", details: "rocket launches and countdowns; fuel tanks; orbits around Earth; the Moon and Mars; satellites; the International Space Station; telescope nights; distances in miles or kilometers; astronaut training", ask: "What in space?", example: "e.g. SpaceX launches, Mars rovers, black holes", suggestions: ["SpaceX launches","Mars rovers","NASA Artemis","black holes","the James Webb telescope","the ISS","Saturn","astronaut training"] },
  { id: "cars", group: "Life", label: "Cars & racing", details: "laps around a track and lap times; pit stops for tires and fuel; miles per gallon; horsepower; a race weekend with qualifying; a family road trip with stops; saving up for a first car", ask: "Which cars, drivers or races?", example: "e.g. Verstappen, F1, Mustangs", suggestions: ["Formula 1","Max Verstappen","Lewis Hamilton","Lando Norris","Charles Leclerc","Oscar Piastri","Ferrari","McLaren","Red Bull Racing","Mercedes","NASCAR","Dale Earnhardt Jr.","IndyCar","Tesla","Mustangs","Corvettes","Porsche","Lamborghini","drifting","go-karts","Forza","Gran Turismo"] },
  { id: "anime", group: "Screens & stories", label: "Anime & manga", details: "episodes per season and minutes per episode; binge-watching a series; manga volumes and a new chapter every week; collecting figures; a convention with cosplay and an artist alley", ask: "Which shows and characters?", example: "e.g. One Piece, Luffy, Jujutsu Kaisen", suggestions: ["One Piece","Naruto","Jujutsu Kaisen","Demon Slayer","My Hero Academia","Attack on Titan","Dragon Ball","Spy x Family"] },
  { id: "creators", group: "Screens & stories", label: "YouTube & TikTok", details: "views, likes and subscribers; a posting schedule; video length and editing time; sponsor deals paid per video; going viral; livestreams; followers gained per day; filming a series with friends", ask: "Which creators and channels?", example: "e.g. MrBeast, Dude Perfect, my own channel", suggestions: ["MrBeast","Dude Perfect","Mark Rober","Marques Brownlee","IShowSpeed","Kai Cenat","Ryan Trahan","my own channel"] },
  { id: "fashion", group: "Life", label: "Fashion & sneakers", details: "sneaker drops and resale prices; thrifting; outfits planned for the week; sizes; store sales and discounts; saving up for a pair; a closet clean-out sale", ask: "Which brands or styles?", example: "e.g. Jordans, thrifting, Nike Dunks", suggestions: ["Jordans","Nike Dunks","New Balance","thrifting","streetwear","Converse","Crocs","Lululemon"] },
  { id: "dance", group: "Make & do", label: "Dance", details: "eight-counts and routines; rehearsals before a competition; costumes; a studio recital; formations on stage; practice minutes each week; scores from the judges", ask: "What kind, and who inspires you?", example: "e.g. hip hop, my studio team, ballet", suggestions: ["hip hop","ballet","jazz","my studio team","competitions","TikTok dances","tap","K-pop choreo"] },
  { id: "coding", group: "Make & do", label: "Coding & tech", details: "apps and their downloads; lines of code and bugs fixed; battery percent; screen pixels; a game you are building; a robotics team before a competition; upload and download speeds", ask: "What do you build, and in what?", example: "e.g. Python, a Discord bot, Scratch games", suggestions: ["Python","Scratch","JavaScript","a Discord bot","robotics team","Roblox Studio","making a game","Arduino"] },
  { id: "business", group: "Life", label: "Money & business", details: "a small business like a lemonade stand or a T-shirt shop; price per item, costs and profit; customers per day; saving each week toward a goal; a summer job that pays by the hour", ask: "What do you sell or plan to?", example: "e.g. lemonade stand, custom shirts, mowing lawns", suggestions: ["lemonade stand","custom shirts","mowing lawns","reselling sneakers","babysitting","an Etsy shop","car washing","a YouTube channel"] },
  // ---- Added Oct 26 2026: the rest of what students name when asked. ----------------------
  { id: "baseball", group: "Sports", label: "Baseball & softball", details: "nine innings; batting average as hits over at-bats; runs batted in; a pitcher's strikeouts per game; bases 90 feet apart; the count of balls and strikes; a tournament bracket; a bag of sunflower seeds split in the dugout", ask: "Which teams and players?", example: "e.g. the Phillies, Shohei Ohtani, my travel team", suggestions: ["Phillies","Yankees","Dodgers","Red Sox","Mets","Braves","Cubs","Astros","Orioles","Mariners","Padres","Shohei Ohtani","Aaron Judge","Bryce Harper","Kyle Schwarber","Juan Soto","Mookie Betts","Bobby Witt Jr.","Elly De La Cruz","Paul Skenes","Gunnar Henderson","the World Series","Little League World Series","MLB The Show","softball","Women's College World Series","my travel team"] },
  { id: "volleyball", group: "Sports", label: "Volleyball", details: "sets to 25 points, win by 2; kills, digs and aces per set; three touches a side; rotations through six positions; a net 7 feet 4 inches high for girls; tournaments with pool play; serving drills at practice", ask: "Which teams and players?", example: "e.g. my club team, Nebraska, the USA women", suggestions: ["my school team","my club team","Nebraska volleyball","Penn State volleyball","Texas volleyball","Wisconsin volleyball","USA women's team","USA men's team","Jordan Larson","Jordyn Poulter","beach volleyball","libero","setter","outside hitter","middle blocker","the Olympics"] },
  { id: "hockey", group: "Sports", label: "Hockey", details: "three periods of 20 minutes; goals and assists as points; plus-minus; a power play with one more skater; shots on goal; ice time per shift; skate sharpening; a tournament weekend out of town", ask: "Which teams and players?", example: "e.g. the Flyers, Connor McDavid, my travel team", suggestions: ["Flyers","Penguins","Rangers","Bruins","Maple Leafs","Oilers","Panthers","Lightning","Avalanche","Golden Knights","Connor McDavid","Sidney Crosby","Auston Matthews","Nathan MacKinnon","Cale Makar","Leon Draisaitl","Matthew Tkachuk","Connor Bedard","Jack Hughes","Alex Ovechkin","the Stanley Cup","PWHL","my travel team","street hockey","field hockey"] },
  { id: "track", group: "Sports", label: "Track & running", details: "100 meter, 400 meter and mile times to the hundredth; laps of a 400 meter track; splits per lap; a relay with four legs; personal records; cross country over 5 kilometers; miles per week in training", ask: "Which events, or who do you follow?", example: "e.g. the 400, cross country, Noah Lyles", suggestions: ["the 100","the 200","the 400","the 800","the mile","cross country","relays","hurdles","long jump","high jump","pole vault","shot put","marathons","Noah Lyles","Sha'Carri Richardson","Sydney McLaughlin-Levrone","Mondo Duplantis","Faith Kipyegon","Jakob Ingebrigtsen","Usain Bolt","Gabby Thomas","Quincy Wilson"] },
  { id: "swimming", group: "Sports", label: "Swimming", details: "laps of a 25 yard or 50 meter pool; times to the hundredth; a 200 freestyle as 8 lengths; relays with four swimmers; practice yardage per week; stroke counts per length; a meet with heats and finals", ask: "Which strokes, or who do you follow?", example: "e.g. butterfly, my swim club, Katie Ledecky", suggestions: ["freestyle","butterfly","backstroke","breaststroke","IM","relays","my swim club","Katie Ledecky","Caeleb Dressel","Léon Marchand","Summer McIntosh","Michael Phelps","Gretchen Walsh","Regan Smith","diving","water polo"] },
  { id: "gymnastics", group: "Sports", label: "Gymnastics & cheer", details: "routines scored to the tenth; difficulty and execution scores added; a stunt group of four; eight-counts in a routine; practice hours a week; a competition weekend with awards by level; flyers, bases and tumbling passes", ask: "What do you do, and who inspires you?", example: "e.g. level 5, competitive cheer, Simone Biles", suggestions: ["competitive cheer","sideline cheer","Simone Biles","Suni Lee","Jordan Chiles","Jade Carey","Hezly Rivera","Livvy Dunne","tumbling","bars","beam","vault","floor","my gym","college gymnastics","Varsity cheer"] },
  { id: "tennis", group: "Sports", label: "Tennis & pickleball", details: "games, sets and tiebreaks; first serve percentage; points scored 15, 30, 40; a doubles team of two; rallies counted in shots; court lines measured in feet; a ladder at the club; restringing a racket", ask: "Which players, or where do you play?", example: "e.g. Carlos Alcaraz, Coco Gauff, pickleball with my family", suggestions: ["Carlos Alcaraz","Jannik Sinner","Novak Djokovic","Coco Gauff","Aryna Sabalenka","Iga Świątek","Ben Shelton","Taylor Fritz","Frances Tiafoe","Serena Williams","Rafael Nadal","Roger Federer","Wimbledon","the US Open","pickleball","Ben Johns","Anna Leigh Waters","my school team","doubles"] },
  { id: "skate", group: "Sports", label: "Skateboarding & biking", details: "tricks landed out of attempts; a ramp's height and angle; wheels in millimeters; miles on a bike ride; a BMX race with heats; a skate park session timed; saving for a new deck or a set of trucks; gears and speed on a hill", ask: "What do you ride, and who do you follow?", example: "e.g. my skateboard, BMX, Tony Hawk", suggestions: ["skateboarding","BMX","mountain biking","scooters","Tony Hawk","Nyjah Huston","Sky Brown","Rayssa Leal","the X Games","the skate park","dirt jumps","road cycling","Tour de France"] },
  { id: "outdoors", group: "Sports", label: "Fishing & outdoors", details: "fish measured in inches and weighed in pounds; line test strength; a hike in miles with elevation gain; a campsite for a weekend; hunting seasons and tags; a boat's speed on the lake; the sunrise time for an early start", ask: "What do you do outside?", example: "e.g. bass fishing, hunting with my dad, camping", suggestions: ["bass fishing","fly fishing","hunting","camping","hiking","kayaking","a boat on the lake","archery"] },
  { id: "golf", group: "Sports", label: "Golf", details: "18 holes and par for each one; strokes over or under par; drives measured in yards; a putt's distance in feet; a handicap; a scorecard added up at the end; mini golf with friends; a driving range bucket of 50 balls", ask: "Which players, or where do you play?", example: "e.g. Scottie Scheffler, mini golf, my school team", suggestions: ["Scottie Scheffler","Rory McIlroy","Tiger Woods","Bryson DeChambeau","Nelly Korda","the Masters","mini golf","Topgolf","the driving range","Good Good Golf","my school team"] },
  { id: "lacrosse", group: "Sports", label: "Lacrosse", details: "four quarters; goals and assists; ground balls and faceoffs won; a shot clock; ten players a side in boys and twelve in girls; shots on goal and save percentage; a tournament weekend; stringing a new stick", ask: "Which teams and players?", example: "e.g. my club team, Syracuse, Premier Lacrosse League", suggestions: ["my school team","my club team","Premier Lacrosse League","Syracuse","Maryland","Notre Dame","Johns Hopkins","Charlotte North","Paul Rabil","box lacrosse","girls lacrosse"] },
  { id: "snowsports", group: "Sports", label: "Skiing & snowboarding", details: "runs down a mountain and the vertical drop in feet; a chairlift ride in minutes; green, blue and black trails; speed in miles per hour; a lift ticket's price; inches of fresh snow; a halfpipe's height; a ski trip weekend", ask: "What do you ride, and who do you follow?", example: "e.g. snowboarding, Chloe Kim, skiing with my family", suggestions: ["skiing","snowboarding","Chloe Kim","Shaun White","Mikaela Shiffrin","Lindsey Vonn","Eileen Gu","the Winter Olympics","the X Games","ski trips","sledding"] },
  { id: "surfing", group: "Sports", label: "Surfing & water sports", details: "wave height in feet; rides per session; a board's length in feet and inches; tide times; paddle strokes; wakeboarding behind a boat at a set speed; a beach week; a surf contest scored out of 10", ask: "What do you do on the water?", example: "e.g. surfing, wakeboarding, Carissa Moore", suggestions: ["surfing","bodyboarding","wakeboarding","water skiing","paddleboarding","sailing","rowing","Kelly Slater","Carissa Moore","Caroline Marks","the beach"] },
  { id: "cricket", group: "Sports", label: "Cricket & rugby", details: "overs of six balls; runs, wickets and a strike rate; a T20 match of 20 overs a side; boundaries for 4 and 6; a rugby try worth 5 and a conversion 2; 80 minute matches; a league table", ask: "Which teams and players?", example: "e.g. India, Virat Kohli, the All Blacks", suggestions: ["India","Australia","England","Virat Kohli","Rohit Sharma","Jasprit Bumrah","the IPL","T20 World Cup","the All Blacks","Rugby World Cup","Ilona Maher"] },
  { id: "bowling", group: "Sports", label: "Bowling & billiards", details: "ten frames; strikes and spares and how they score; pins knocked down per frame; a 300 perfect game; ball weight in pounds; a league night average; pool balls numbered 1 to 15; shoe and lane rental per hour", ask: "What do you play?", example: "e.g. bowling with friends, pool, a league", suggestions: ["bowling with friends","a bowling league","pool","billiards","darts","ping pong","air hockey","cornhole"] },
  { id: "combat", group: "Sports", label: "Wrestling & martial arts", details: "weight classes in pounds; a match of three periods; points for a takedown or a reversal; belt levels in karate or jiu-jitsu; rounds of three minutes in boxing; a tournament bracket; cutting weight before a weigh-in", ask: "What do you do, and who do you follow?", example: "e.g. wrestling at 126, jiu-jitsu, UFC", suggestions: ["wrestling","jiu-jitsu","karate","taekwondo","boxing","judo","MMA","UFC","WWE","Jon Jones","Alex Pereira","Ilia Topuria","Canelo Álvarez","Terence Crawford","Roman Reigns","Cody Rhodes","Rhea Ripley","Penn State wrestling","my wrestling team"] },
  { id: "cards", group: "Games", label: "Pokémon & trading cards", details: "a deck of 60 cards; booster packs with 10 cards; card prices and grades; a binder's pages of 9; trading two for one; a tournament with Swiss rounds; damage counters in tens; the pull rate of a rare card", ask: "Which cards or games?", example: "e.g. Pokémon cards, Charizard, Magic", suggestions: ["Pokémon cards","Charizard","Magic: The Gathering","Yu-Gi-Oh!","Pokémon video games","sports cards","Lorcana","opening packs"] },
  { id: "lego", group: "Games", label: "Lego & building", details: "a set's piece count and price; bags numbered in order; studs across a baseplate; a build's height in bricks; sorting pieces by color; a model that takes hours over several days; a display shelf with limited space", ask: "What do you build?", example: "e.g. Star Wars sets, my own creations, Technic", suggestions: ["Star Wars sets","Technic","my own creations","Lego Icons","model kits","Minecraft sets","Lego robotics","a city layout"] },
  { id: "boardgames", group: "Games", label: "Chess & board games", details: "a chess rating that rises and falls; moves in a game; pieces worth 1, 3, 5 and 9; game night with friends and a scoreboard; dice rolls and odds; a tournament with rounds; cards drawn from a deck of 52; a puzzle with 1000 pieces", ask: "Which games?", example: "e.g. chess, Catan, Uno", suggestions: ["chess","Catan","Monopoly","Uno","Dungeons & Dragons","Exploding Kittens","puzzles","online chess"] },
  { id: "esports", group: "Games", label: "Esports & streaming", details: "a team of five; kills, deaths and assists per match; ranks and ranked points; a tournament bracket with best-of-three matches; prize pools split by placing; stream viewers at peak; hours played a week", ask: "Which games, teams or streamers?", example: "e.g. Valorant, Sentinels, Kai Cenat", suggestions: ["Valorant","League of Legends","Rocket League","Fortnite competitive","Sentinels","Kai Cenat","Twitch","my school's esports team"] },
  { id: "movies", group: "Screens & stories", label: "Movies & TV", details: "a movie's runtime in minutes; episodes per season; box office in millions; ticket and popcorn prices; a movie marathon planned to the minute; a series rewatched for the third time; ratings out of 10", ask: "Which movies, shows or characters?", example: "e.g. Marvel, Stranger Things, Spider-Man", suggestions: ["Marvel","Star Wars","Stranger Things","Spider-Man","Harry Potter","Disney","horror movies","The Office"] },
  { id: "books", group: "Screens & stories", label: "Books & reading", details: "pages read a day and chapters left; a series of seven books; a reading goal for the year; library due dates; a book club meeting every two weeks; a bookstore's prices and a gift card; reading speed in pages an hour", ask: "Which books, series or authors?", example: "e.g. Percy Jackson, Hunger Games, manga", suggestions: ["Percy Jackson","The Hunger Games","Harry Potter","Wings of Fire","Diary of a Wimpy Kid","graphic novels","Rick Riordan","fantasy"] },
  { id: "science", group: "Screens & stories", label: "Science & nature", details: "an experiment with trials and averages; a plant's growth measured each week; the weather in degrees and inches of rain; a volcano's eruption height; animal speeds in miles per hour; a science fair with a poster board; a microscope's magnification", ask: "What are you into?", example: "e.g. dinosaurs, chemistry, weather", suggestions: ["dinosaurs","chemistry experiments","weather and storms","the ocean","volcanoes","biology","the science fair","Mark Rober"] },
  { id: "theater", group: "Make & do", label: "Theater & drama", details: "a script's pages and lines to memorize; rehearsals a week before opening night; tickets sold per show; a cast of 30; costumes and set pieces; a run of four shows; cues timed to the second; a musical's songs", ask: "Which shows, or what do you do?", example: "e.g. the school musical, Hamilton, stage crew", suggestions: ["the school musical","Hamilton","Wicked","stage crew","improv","Broadway","Six","acting classes"] },
  { id: "photo", group: "Make & do", label: "Photography & video editing", details: "megapixels and storage in gigabytes; shutter speed as a fraction of a second; a video's length and frames per second; clips cut down to a 60 second edit; export time; a photo shoot with 300 shots and 20 keepers; a memory card filling up", ask: "What do you shoot or edit?", example: "e.g. CapCut edits, my phone camera, sports photos", suggestions: ["CapCut edits","my phone camera","sports photos","a Canon camera","drone shots","vlogs","Premiere","nature photos"] },
  { id: "beauty", group: "Life", label: "Makeup & beauty", details: "a routine with steps timed in minutes; products priced and on sale; a palette of 12 shades; skincare used morning and night; a haul budget; a nail set that lasts two weeks; mixing two shades in a ratio; a tutorial's views", ask: "What do you like?", example: "e.g. skincare, nails, Sephora", suggestions: ["skincare","nails","Sephora","hair styling","Rare Beauty","makeup tutorials","Glossier","lashes"] },
  { id: "travel", group: "Life", label: "Travel & places", details: "miles between cities; flight times and time zones; a trip budget split over days; packing by weight; exchange rates; a road trip with gas stops; a theme park with ride wait times; countries visited and ones on the list", ask: "Where have you been, or where do you want to go?", example: "e.g. Disney World, Mexico, New York", suggestions: ["Disney World","the beach","New York","Mexico","Japan","a road trip","Universal","camping trips"] },
];

/** The chips in a group, in catalog order. */
export function optionsInGroup(group: InterestGroup): InterestOption[] {
  return INTEREST_OPTIONS.filter((o) => o.group === group);
}

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

/**
 * Words that say nothing real on their own: "Frank Ocean's new track" or
 * "LeBron's big game" could be anyone. Stat words (goals, assists, threes)
 * are not here: what a player is known for counting is a real detail.
 */
const GENERIC_DETAIL = new Set([
  "new", "latest", "big", "next", "last", "first", "final", "famous", "favorite", "huge", "best", "own",
  "track", "tracks", "song", "songs", "album", "albums", "single", "hit", "hits", "music", "beat", "beats",
  "show", "shows", "concert", "concerts", "gig", "set", "setlist", "playlist", "video", "stream", "streams",
  "game", "games", "match", "matches", "season", "practice", "drill", "training", "career", "fans", "crowd",
  "player", "players", "star", "squad", "club", "night", "day", "week", "year", "stage", "studio", "event",
  "is", "was", "are", "s", "his", "her", "their", "from", "by", "as", "or", "but",
]);

/**
 * A story about a student's favorite must use something real from that
 * favorite's world, not just the name: a song or album title, an award, a
 * trophy, a stadium, a position, a stat they are known for. The writer
 * returns the words it used as `real_detail`; this checks they are in the
 * story and say more than the name and a generic noun. The judge then
 * checks the fact is true.
 */
export function realDetailProblem(text: string, detail: unknown, topic: Pick<InterestTopic, "specifics">): string | null {
  if (!topic.specifics) return null;
  if (typeof detail !== "string" || detail.trim().length < 3) return "missing";
  const norm = (s: string) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
  const d = norm(detail);
  if (d.length > 80) return "too long";
  if (!norm(text).includes(d)) return `"${detail.trim()}" is not in the story`;
  const names = new Set(
    topic.specifics.split(",").flatMap((item) => favoriteWords(item.trim())).flatMap((w) => w.split(/[^\p{L}\p{N}]+/u))
  );
  const left = d
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !FILLER.has(w) && !GENERIC_DETAIL.has(w) && !names.has(w));
  return left.length ? null : `"${detail.trim()}" is only the name and a generic word`;
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
