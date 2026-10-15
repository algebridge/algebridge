/**
 * Whole numbers from 0 to 99 as jerseys: the back of the shirt of the
 * best-known player who wore that number, in the colors of the team they
 * wore it for. Team colors only, never a crest or a logo. Rayla's soccer game
 * and Jordyn's volleyball game show their answers this way, and so does
 * practice for a student whose problems are set in soccer, basketball or
 * football (with a picture of the player a story names).
 *
 * Every pairing here is a player who wore that number at that team. A number
 * with no pairing anyone could name with confidence gets a plain jersey with
 * no name, never a guess. Numbers above 99 stay plain numbers.
 */

/** The sports that draw jerseys; each has its own cut of shirt. */
export type Sport = "soccer" | "basketball" | "football" | "volleyball";

/** How a club's shirt is laid out, seen from the back. */
export type KitPattern =
  /** One color. */
  | "solid"
  /** Vertical stripes of the two colors. */
  | "stripes"
  /** A body in one color, sleeves in the other (Arsenal). */
  | "sleeves"
  /** A broad band down the middle (Ajax, PSG). */
  | "band";

export interface Kit {
  club: string;
  pattern: KitPattern;
  /** The body. */
  base: string;
  /** Stripes, sleeves or the band. */
  second: string;
  /** Collar and cuffs. */
  trim: string;
  /** The name and number. */
  ink: string;
}

export interface JerseyPick {
  sport: Sport;
  number: number;
  /** The name on the back; null for a plain jersey. */
  name: string | null;
  /** Their full name, for screen readers and the card. */
  fullName: string | null;
  kit: Kit;
}

const KITS = {
  juventus: { club: "Juventus", pattern: "stripes", base: "#f8fafc", second: "#111111", trim: "#111111", ink: "#111111" },
  realMadrid: { club: "Real Madrid", pattern: "solid", base: "#f8fafc", second: "#f8fafc", trim: "#3b2a7a", ink: "#1e1b4b" },
  bayern: { club: "Bayern Munich", pattern: "solid", base: "#dc052d", second: "#dc052d", trim: "#f8fafc", ink: "#f8fafc" },
  barcelona: { club: "Barcelona", pattern: "stripes", base: "#a50044", second: "#004d98", trim: "#edbb00", ink: "#edbb00" },
  milan: { club: "AC Milan", pattern: "stripes", base: "#d6001c", second: "#111111", trim: "#111111", ink: "#f8fafc" },
  manUtd: { club: "Manchester United", pattern: "solid", base: "#da291c", second: "#da291c", trim: "#f8fafc", ink: "#f8fafc" },
  liverpool: { club: "Liverpool", pattern: "solid", base: "#c8102e", second: "#c8102e", trim: "#f8fafc", ink: "#f8fafc" },
  arsenal: { club: "Arsenal", pattern: "sleeves", base: "#ef0107", second: "#f8fafc", trim: "#f8fafc", ink: "#f8fafc" },
  chelsea: { club: "Chelsea", pattern: "solid", base: "#034694", second: "#034694", trim: "#f8fafc", ink: "#f8fafc" },
  manCity: { club: "Manchester City", pattern: "solid", base: "#6cabdd", second: "#6cabdd", trim: "#1c2c5b", ink: "#1c2c5b" },
  inter: { club: "Inter Milan", pattern: "stripes", base: "#0068a8", second: "#111111", trim: "#111111", ink: "#f8fafc" },
  napoli: { club: "Napoli", pattern: "solid", base: "#12a0d7", second: "#12a0d7", trim: "#f8fafc", ink: "#f8fafc" },
  santos: { club: "Santos", pattern: "solid", base: "#f8fafc", second: "#f8fafc", trim: "#111111", ink: "#111111" },
  newcastle: { club: "Newcastle United", pattern: "stripes", base: "#f8fafc", second: "#111111", trim: "#111111", ink: "#111111" },
  ajax: { club: "Ajax", pattern: "band", base: "#f8fafc", second: "#d2122e", trim: "#d2122e", ink: "#111111" },
  psg: { club: "Paris Saint-Germain", pattern: "band", base: "#004170", second: "#da291c", trim: "#f8fafc", ink: "#f8fafc" },
} satisfies Record<string, Kit>;

/** The plain jersey of each sport, no name: Rayla's red kit, Jordyn's purple, the app's navy. */
export const PLAIN_KITS: Record<Sport, Kit> = {
  soccer: { club: "", pattern: "solid", base: "#dc2626", second: "#dc2626", trim: "#f8fafc", ink: "#f8fafc" },
  volleyball: { club: "", pattern: "solid", base: "#7c3aed", second: "#7c3aed", trim: "#f8fafc", ink: "#f8fafc" },
  basketball: { club: "", pattern: "solid", base: "#1e3a8a", second: "#1e3a8a", trim: "#f8fafc", ink: "#f8fafc" },
  football: { club: "", pattern: "solid", base: "#1e3a8a", second: "#1e3a8a", trim: "#f8fafc", ink: "#f8fafc" },
};

type Wearer = { name: string; fullName: string; kit: Kit };
const w = (fullName: string, name: string, kit: Kit): Wearer => ({ fullName, name, kit });

/**
 * The wearers of each number. Where several are known for one number, the
 * game picks between them.
 */
type Roster = Partial<Record<number, Wearer[]>>;

export const JERSEY_ROSTER: Roster = {
  1: [w("Gianluigi Buffon", "BUFFON", KITS.juventus), w("Iker Casillas", "CASILLAS", KITS.realMadrid), w("Manuel Neuer", "NEUER", KITS.bayern)],
  2: [w("Cafu", "CAFU", KITS.milan), w("Gary Neville", "G. NEVILLE", KITS.manUtd)],
  3: [w("Paolo Maldini", "MALDINI", KITS.milan), w("Roberto Carlos", "R. CARLOS", KITS.realMadrid)],
  4: [w("Sergio Ramos", "RAMOS", KITS.realMadrid), w("Virgil van Dijk", "VAN DIJK", KITS.liverpool)],
  5: [w("Franz Beckenbauer", "BECKENBAUER", KITS.bayern), w("Zinedine Zidane", "ZIDANE", KITS.realMadrid)],
  6: [w("Franco Baresi", "BARESI", KITS.milan), w("Xavi", "XAVI", KITS.barcelona)],
  7: [w("Cristiano Ronaldo", "RONALDO", KITS.realMadrid), w("Cristiano Ronaldo", "RONALDO", KITS.manUtd), w("David Beckham", "BECKHAM", KITS.manUtd), w("Eric Cantona", "CANTONA", KITS.manUtd)],
  8: [w("Steven Gerrard", "GERRARD", KITS.liverpool), w("Andrés Iniesta", "INIESTA", KITS.barcelona), w("Frank Lampard", "LAMPARD", KITS.chelsea)],
  9: [w("Erling Haaland", "HAALAND", KITS.manCity), w("Robert Lewandowski", "LEWANDOWSKI", KITS.bayern), w("Karim Benzema", "BENZEMA", KITS.realMadrid), w("Alan Shearer", "SHEARER", KITS.newcastle)],
  10: [w("Lionel Messi", "MESSI", KITS.barcelona), w("Pelé", "PELÉ", KITS.santos), w("Diego Maradona", "MARADONA", KITS.napoli)],
  11: [w("Ryan Giggs", "GIGGS", KITS.manUtd), w("Mohamed Salah", "SALAH", KITS.liverpool), w("Neymar", "NEYMAR JR", KITS.barcelona)],
  12: [w("Marcelo", "MARCELO", KITS.realMadrid)],
  13: [w("Alessandro Nesta", "NESTA", KITS.milan), w("Michael Ballack", "BALLACK", KITS.chelsea)],
  14: [w("Thierry Henry", "HENRY", KITS.arsenal), w("Johan Cruyff", "CRUYFF", KITS.ajax)],
  15: [w("Nemanja Vidić", "VIDIĆ", KITS.manUtd)],
  16: [w("Roy Keane", "KEANE", KITS.manUtd)],
  17: [w("Kevin De Bruyne", "DE BRUYNE", KITS.manCity)],
  18: [w("Paul Scholes", "SCHOLES", KITS.manUtd)],
  19: [w("Lamine Yamal", "LAMINE YAMAL", KITS.barcelona)],
  20: [w("Robin van Persie", "VAN PERSIE", KITS.manUtd)],
  21: [w("Andrea Pirlo", "PIRLO", KITS.milan)],
  22: [w("Kaká", "KAKÁ", KITS.milan)],
  23: [w("David Beckham", "BECKHAM", KITS.realMadrid), w("Marco Materazzi", "MATERAZZI", KITS.inter)],
  25: [w("Thomas Müller", "MÜLLER", KITS.bayern), w("Gianfranco Zola", "ZOLA", KITS.chelsea)],
  26: [w("John Terry", "TERRY", KITS.chelsea)],
  29: [w("Kai Havertz", "HAVERTZ", KITS.chelsea)],
  30: [w("Lionel Messi", "MESSI", KITS.psg)],
  31: [w("Bastian Schweinsteiger", "SCHWEINSTEIGER", KITS.bayern)],
  32: [w("Carlos Tevez", "TEVEZ", KITS.manCity)],
  45: [w("Mario Balotelli", "BALOTELLI", KITS.manCity)],
  47: [w("Phil Foden", "FODEN", KITS.manCity)],
  66: [w("Trent Alexander-Arnold", "ALEXANDER-ARNOLD", KITS.liverpool)],
  77: [w("Khvicha Kvaratskhelia", "KVARATSKHELIA", KITS.napoli)],
  80: [w("Ronaldinho", "RONALDINHO", KITS.milan)],
  99: [w("Ronaldo Nazário", "RONALDO", KITS.milan)],
};

/** A small steady hash, so the same problem picks the same jersey every time it draws. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BASKETBALL_TEAMS = {
  BostonCeltics: { club: "Boston Celtics", pattern: "solid", base: "#007a33", second: "#007a33", trim: "#ba9653", ink: "#f8fafc" },
  OklahomaCityThunder: { club: "Oklahoma City Thunder", pattern: "solid", base: "#007ac1", second: "#007ac1", trim: "#ef3b24", ink: "#f8fafc" },
  PortlandTrailBlazers: { club: "Portland Trail Blazers", pattern: "solid", base: "#e03a3e", second: "#e03a3e", trim: "#111111", ink: "#f8fafc" },
  SanAntonioSpurs: { club: "San Antonio Spurs", pattern: "solid", base: "#111111", second: "#111111", trim: "#c4ced4", ink: "#f8fafc" },
  ChicagoBulls: { club: "Chicago Bulls", pattern: "solid", base: "#ce1141", second: "#ce1141", trim: "#111111", ink: "#f8fafc" },
  OrlandoMagic: { club: "Orlando Magic", pattern: "solid", base: "#0077c0", second: "#0077c0", trim: "#111111", ink: "#f8fafc" },
  Philadelphia76ers: { club: "Philadelphia 76ers", pattern: "solid", base: "#006bb6", second: "#006bb6", trim: "#ed174c", ink: "#f8fafc" },
  MiamiHeat: { club: "Miami Heat", pattern: "solid", base: "#111111", second: "#111111", trim: "#98002e", ink: "#f8fafc" },
  PhoenixMercury: { club: "Phoenix Mercury", pattern: "solid", base: "#201747", second: "#201747", trim: "#cb6015", ink: "#f8fafc" },
  DetroitPistons: { club: "Detroit Pistons", pattern: "solid", base: "#1d42ba", second: "#1d42ba", trim: "#c8102e", ink: "#f8fafc" },
  SacramentoKings: { club: "Sacramento Kings", pattern: "solid", base: "#5a2d81", second: "#5a2d81", trim: "#63727a", ink: "#f8fafc" },
  MinnesotaTimberwolves: { club: "Minnesota Timberwolves", pattern: "solid", base: "#0c2340", second: "#0c2340", trim: "#78be20", ink: "#f8fafc" },
  DallasWings: { club: "Dallas Wings", pattern: "solid", base: "#002b5c", second: "#002b5c", trim: "#c4d600", ink: "#f8fafc" },
  NewYorkKnicks: { club: "New York Knicks", pattern: "solid", base: "#006bb6", second: "#006bb6", trim: "#f58426", ink: "#f8fafc" },
  PhoenixSuns: { club: "Phoenix Suns", pattern: "solid", base: "#1d1160", second: "#1d1160", trim: "#e56020", ink: "#f8fafc" },
  LosAngelesLakers: { club: "Los Angeles Lakers", pattern: "solid", base: "#fdb927", second: "#fdb927", trim: "#552583", ink: "#552583" },
  LosAngelesSparks: { club: "Los Angeles Sparks", pattern: "solid", base: "#552583", second: "#552583", trim: "#fdb927", ink: "#f8fafc" },
  SeattleStorm: { club: "Seattle Storm", pattern: "solid", base: "#2c5235", second: "#2c5235", trim: "#fee11a", ink: "#f8fafc" },
  GoldenStateWarriors: { club: "Golden State Warriors", pattern: "solid", base: "#1d428a", second: "#1d428a", trim: "#ffc72c", ink: "#ffc72c" },
  WashingtonMystics: { club: "Washington Mystics", pattern: "solid", base: "#c8102e", second: "#c8102e", trim: "#0c2340", ink: "#f8fafc" },
  UtahJazz: { club: "Utah Jazz", pattern: "solid", base: "#002b5c", second: "#002b5c", trim: "#f9a01b", ink: "#f8fafc" },
  MemphisGrizzlies: { club: "Memphis Grizzlies", pattern: "solid", base: "#12173f", second: "#12173f", trim: "#5d76a9", ink: "#f8fafc" },
  HoustonRockets: { club: "Houston Rockets", pattern: "solid", base: "#ce1141", second: "#ce1141", trim: "#c4ced4", ink: "#f8fafc" },
  DenverNuggets: { club: "Denver Nuggets", pattern: "solid", base: "#0e2240", second: "#0e2240", trim: "#fec524", ink: "#fec524" },
  TorontoRaptors: { club: "Toronto Raptors", pattern: "solid", base: "#ce1141", second: "#ce1141", trim: "#111111", ink: "#f8fafc" },
  NewYorkLiberty: { club: "New York Liberty", pattern: "solid", base: "#6eceb2", second: "#6eceb2", trim: "#111111", ink: "#111111" },
  IndianaFever: { club: "Indiana Fever", pattern: "solid", base: "#002d62", second: "#002d62", trim: "#e03a3e", ink: "#f8fafc" },
  LasVegasAces: { club: "Las Vegas Aces", pattern: "solid", base: "#111111", second: "#111111", trim: "#ba0c2f", ink: "#f8fafc" },
  ClevelandCavaliers: { club: "Cleveland Cavaliers", pattern: "solid", base: "#860038", second: "#860038", trim: "#fdbb30", ink: "#fdbb30" },
  MinnesotaLynx: { club: "Minnesota Lynx", pattern: "solid", base: "#0c2340", second: "#0c2340", trim: "#236192", ink: "#f8fafc" },
  IndianaPacers: { club: "Indiana Pacers", pattern: "solid", base: "#002d62", second: "#002d62", trim: "#fdbb30", ink: "#fdbb30" },
  MilwaukeeBucks: { club: "Milwaukee Bucks", pattern: "solid", base: "#00471b", second: "#00471b", trim: "#eee1c6", ink: "#eee1c6" },
  DallasMavericks: { club: "Dallas Mavericks", pattern: "solid", base: "#00538c", second: "#00538c", trim: "#b8c4ca", ink: "#f8fafc" },
  WashingtonBullets: { club: "Washington Bullets", pattern: "solid", base: "#002b5c", second: "#002b5c", trim: "#e31837", ink: "#f8fafc" },
  AtlantaHawks: { club: "Atlanta Hawks", pattern: "solid", base: "#e03a3e", second: "#e03a3e", trim: "#c1d32f", ink: "#f8fafc" },
  NewJerseyNets: { club: "New Jersey Nets", pattern: "solid", base: "#111111", second: "#111111", trim: "#ffffff", ink: "#f8fafc" },
} satisfies Record<string, Kit>;

/** NBA and WNBA: numbers checked against basketball-reference, retired-number lists and ESPN. */
export const BASKETBALL_ROSTER: Roster = {
  0: [w("Jayson Tatum", "TATUM", BASKETBALL_TEAMS.BostonCeltics), w("Russell Westbrook", "WESTBROOK", BASKETBALL_TEAMS.OklahomaCityThunder), w("Damian Lillard", "LILLARD", BASKETBALL_TEAMS.PortlandTrailBlazers)],
  1: [w("Victor Wembanyama", "WEMBANYAMA", BASKETBALL_TEAMS.SanAntonioSpurs), w("Derrick Rose", "ROSE", BASKETBALL_TEAMS.ChicagoBulls), w("Tracy McGrady", "McGRADY", BASKETBALL_TEAMS.OrlandoMagic)],
  2: [w("Shai Gilgeous-Alexander", "GILGEOUS-ALEXANDER", BASKETBALL_TEAMS.OklahomaCityThunder), w("Kawhi Leonard", "LEONARD", BASKETBALL_TEAMS.SanAntonioSpurs)],
  3: [w("Allen Iverson", "IVERSON", BASKETBALL_TEAMS.Philadelphia76ers), w("Dwyane Wade", "WADE", BASKETBALL_TEAMS.MiamiHeat), w("Diana Taurasi", "TAURASI", BASKETBALL_TEAMS.PhoenixMercury)],
  4: [w("Joe Dumars", "DUMARS", BASKETBALL_TEAMS.DetroitPistons), w("Chris Webber", "WEBBER", BASKETBALL_TEAMS.SacramentoKings)],
  5: [w("Kevin Garnett", "GARNETT", BASKETBALL_TEAMS.BostonCeltics), w("Anthony Edwards", "EDWARDS", BASKETBALL_TEAMS.MinnesotaTimberwolves), w("Paige Bueckers", "BUECKERS", BASKETBALL_TEAMS.DallasWings)],
  6: [w("Bill Russell", "RUSSELL", BASKETBALL_TEAMS.BostonCeltics), w("LeBron James", "JAMES", BASKETBALL_TEAMS.MiamiHeat), w("Julius Erving", "ERVING", BASKETBALL_TEAMS.Philadelphia76ers)],
  7: [w("Carmelo Anthony", "ANTHONY", BASKETBALL_TEAMS.NewYorkKnicks), w("Kevin Johnson", "JOHNSON", BASKETBALL_TEAMS.PhoenixSuns)],
  8: [w("Kobe Bryant", "BRYANT", BASKETBALL_TEAMS.LosAngelesLakers)],
  9: [w("Tony Parker", "PARKER", BASKETBALL_TEAMS.SanAntonioSpurs), w("Lisa Leslie", "LESLIE", BASKETBALL_TEAMS.LosAngelesSparks)],
  10: [w("Sue Bird", "BIRD", BASKETBALL_TEAMS.SeattleStorm), w("Walt Frazier", "FRAZIER", BASKETBALL_TEAMS.NewYorkKnicks), w("Dennis Rodman", "RODMAN", BASKETBALL_TEAMS.DetroitPistons)],
  11: [w("Klay Thompson", "THOMPSON", BASKETBALL_TEAMS.GoldenStateWarriors), w("Isiah Thomas", "THOMAS", BASKETBALL_TEAMS.DetroitPistons), w("Elena Delle Donne", "DELLE DONNE", BASKETBALL_TEAMS.WashingtonMystics)],
  12: [w("John Stockton", "STOCKTON", BASKETBALL_TEAMS.UtahJazz), w("Ja Morant", "MORANT", BASKETBALL_TEAMS.MemphisGrizzlies)],
  13: [w("James Harden", "HARDEN", BASKETBALL_TEAMS.HoustonRockets), w("Wilt Chamberlain", "CHAMBERLAIN", BASKETBALL_TEAMS.Philadelphia76ers), w("Steve Nash", "NASH", BASKETBALL_TEAMS.PhoenixSuns)],
  14: [w("Bob Cousy", "COUSY", BASKETBALL_TEAMS.BostonCeltics)],
  15: [w("Nikola Jokić", "JOKIĆ", BASKETBALL_TEAMS.DenverNuggets), w("Vince Carter", "CARTER", BASKETBALL_TEAMS.TorontoRaptors), w("Lauren Jackson", "JACKSON", BASKETBALL_TEAMS.SeattleStorm)],
  16: [w("Pau Gasol", "GASOL", BASKETBALL_TEAMS.LosAngelesLakers)],
  17: [w("John Havlicek", "HAVLICEK", BASKETBALL_TEAMS.BostonCeltics), w("Chris Mullin", "MULLIN", BASKETBALL_TEAMS.GoldenStateWarriors)],
  18: [w("Dave Cowens", "COWENS", BASKETBALL_TEAMS.BostonCeltics)],
  19: [w("Willis Reed", "REED", BASKETBALL_TEAMS.NewYorkKnicks)],
  20: [w("Manu Ginóbili", "GINOBILI", BASKETBALL_TEAMS.SanAntonioSpurs), w("Sabrina Ionescu", "IONESCU", BASKETBALL_TEAMS.NewYorkLiberty)],
  21: [w("Tim Duncan", "DUNCAN", BASKETBALL_TEAMS.SanAntonioSpurs), w("Joel Embiid", "EMBIID", BASKETBALL_TEAMS.Philadelphia76ers)],
  22: [w("Caitlin Clark", "CLARK", BASKETBALL_TEAMS.IndianaFever), w("A'ja Wilson", "WILSON", BASKETBALL_TEAMS.LasVegasAces), w("Clyde Drexler", "DREXLER", BASKETBALL_TEAMS.PortlandTrailBlazers)],
  23: [w("Michael Jordan", "JORDAN", BASKETBALL_TEAMS.ChicagoBulls), w("LeBron James", "JAMES", BASKETBALL_TEAMS.ClevelandCavaliers), w("Maya Moore", "MOORE", BASKETBALL_TEAMS.MinnesotaLynx)],
  24: [w("Kobe Bryant", "BRYANT", BASKETBALL_TEAMS.LosAngelesLakers), w("Tamika Catchings", "CATCHINGS", BASKETBALL_TEAMS.IndianaFever), w("Rick Barry", "BARRY", BASKETBALL_TEAMS.GoldenStateWarriors)],
  25: [w("Mark Price", "PRICE", BASKETBALL_TEAMS.ClevelandCavaliers)],
  30: [w("Stephen Curry", "CURRY", BASKETBALL_TEAMS.GoldenStateWarriors), w("Breanna Stewart", "STEWART", BASKETBALL_TEAMS.SeattleStorm)],
  31: [w("Reggie Miller", "MILLER", BASKETBALL_TEAMS.IndianaPacers)],
  32: [w("Magic Johnson", "JOHNSON", BASKETBALL_TEAMS.LosAngelesLakers), w("Karl Malone", "MALONE", BASKETBALL_TEAMS.UtahJazz), w("Shaquille O'Neal", "O'NEAL", BASKETBALL_TEAMS.OrlandoMagic)],
  33: [w("Larry Bird", "BIRD", BASKETBALL_TEAMS.BostonCeltics), w("Kareem Abdul-Jabbar", "ABDUL-JABBAR", BASKETBALL_TEAMS.LosAngelesLakers), w("Scottie Pippen", "PIPPEN", BASKETBALL_TEAMS.ChicagoBulls)],
  34: [w("Giannis Antetokounmpo", "ANTETOKOUNMPO", BASKETBALL_TEAMS.MilwaukeeBucks), w("Hakeem Olajuwon", "OLAJUWON", BASKETBALL_TEAMS.HoustonRockets), w("Shaquille O'Neal", "O'NEAL", BASKETBALL_TEAMS.LosAngelesLakers)],
  35: [w("Kevin Durant", "DURANT", BASKETBALL_TEAMS.OklahomaCityThunder)],
  40: [w("Bill Laimbeer", "LAIMBEER", BASKETBALL_TEAMS.DetroitPistons)],
  41: [w("Dirk Nowitzki", "NOWITZKI", BASKETBALL_TEAMS.DallasMavericks), w("Wes Unseld", "UNSELD", BASKETBALL_TEAMS.WashingtonBullets)],
  42: [w("James Worthy", "WORTHY", BASKETBALL_TEAMS.LosAngelesLakers), w("Brittney Griner", "GRINER", BASKETBALL_TEAMS.PhoenixMercury)],
  43: [w("Brad Daugherty", "DAUGHERTY", BASKETBALL_TEAMS.ClevelandCavaliers)],
  44: [w("Jerry West", "WEST", BASKETBALL_TEAMS.LosAngelesLakers), w("George Gervin", "GERVIN", BASKETBALL_TEAMS.SanAntonioSpurs), w("Pete Maravich", "MARAVICH", BASKETBALL_TEAMS.AtlantaHawks)],
  45: [w("Rudy Tomjanovich", "TOMJANOVICH", BASKETBALL_TEAMS.HoustonRockets)],
  50: [w("David Robinson", "ROBINSON", BASKETBALL_TEAMS.SanAntonioSpurs), w("Zach Randolph", "RANDOLPH", BASKETBALL_TEAMS.MemphisGrizzlies)],
  52: [w("Jamaal Wilkes", "WILKES", BASKETBALL_TEAMS.LosAngelesLakers), w("Buck Williams", "WILLIAMS", BASKETBALL_TEAMS.NewJerseyNets)],
  53: [w("Mark Eaton", "EATON", BASKETBALL_TEAMS.UtahJazz)],
  55: [w("Dikembe Mutombo", "MUTOMBO", BASKETBALL_TEAMS.DenverNuggets)],
  77: [w("Luka Dončić", "DONČIĆ", BASKETBALL_TEAMS.DallasMavericks)],
  91: [w("Dennis Rodman", "RODMAN", BASKETBALL_TEAMS.ChicagoBulls)],
};

const FOOTBALL_TEAMS = {
  HoustonOilers: { club: "Houston Oilers", pattern: "solid", base: "#6cace4", second: "#6cace4", trim: "#c8102e", ink: "#f8fafc" },
  CincinnatiBengals: { club: "Cincinnati Bengals", pattern: "solid", base: "#111111", second: "#111111", trim: "#fb4f14", ink: "#f8fafc" },
  AtlantaFalcons: { club: "Atlanta Falcons", pattern: "solid", base: "#a71930", second: "#a71930", trim: "#111111", ink: "#f8fafc" },
  DenverBroncos: { club: "Denver Broncos", pattern: "solid", base: "#fb4f14", second: "#fb4f14", trim: "#002244", ink: "#f8fafc" },
  SeattleSeahawks: { club: "Seattle Seahawks", pattern: "solid", base: "#002244", second: "#002244", trim: "#69be28", ink: "#f8fafc" },
  LosAngelesChargers: { club: "Los Angeles Chargers", pattern: "solid", base: "#0080c6", second: "#0080c6", trim: "#ffc20e", ink: "#f8fafc" },
  GreenBayPackers: { club: "Green Bay Packers", pattern: "solid", base: "#203731", second: "#203731", trim: "#ffb612", ink: "#f8fafc" },
  DallasCowboys: { club: "Dallas Cowboys", pattern: "solid", base: "#f8fafc", second: "#f8fafc", trim: "#869397", ink: "#003594" },
  PhiladelphiaEagles: { club: "Philadelphia Eagles", pattern: "solid", base: "#004c54", second: "#004c54", trim: "#a5acaf", ink: "#f8fafc" },
  WashingtonCommanders: { club: "Washington Commanders", pattern: "solid", base: "#5a1414", second: "#5a1414", trim: "#ffb612", ink: "#f8fafc" },
  ChicagoBears: { club: "Chicago Bears", pattern: "solid", base: "#0b162a", second: "#0b162a", trim: "#c83803", ink: "#f8fafc" },
  TampaBayBuccaneers: { club: "Tampa Bay Buccaneers", pattern: "solid", base: "#d50a0a", second: "#d50a0a", trim: "#34302b", ink: "#f8fafc" },
  SanFrancisco49ers: { club: "San Francisco 49ers", pattern: "solid", base: "#aa0000", second: "#aa0000", trim: "#b3995d", ink: "#f8fafc" },
  BaltimoreRavens: { club: "Baltimore Ravens", pattern: "solid", base: "#241773", second: "#241773", trim: "#9e7c0c", ink: "#f8fafc" },
  NewOrleansSaints: { club: "New Orleans Saints", pattern: "solid", base: "#101820", second: "#101820", trim: "#d3bc8d", ink: "#d3bc8d" },
  NewYorkGiants: { club: "New York Giants", pattern: "solid", base: "#0b2265", second: "#0b2265", trim: "#a71930", ink: "#f8fafc" },
  MinnesotaVikings: { club: "Minnesota Vikings", pattern: "solid", base: "#4f2683", second: "#4f2683", trim: "#ffc62f", ink: "#f8fafc" },
  ArizonaCardinals: { club: "Arizona Cardinals", pattern: "solid", base: "#97233f", second: "#97233f", trim: "#111111", ink: "#f8fafc" },
  NewEnglandPatriots: { club: "New England Patriots", pattern: "solid", base: "#002244", second: "#002244", trim: "#c60c30", ink: "#f8fafc" },
  BuffaloBills: { club: "Buffalo Bills", pattern: "solid", base: "#00338d", second: "#00338d", trim: "#c60c30", ink: "#f8fafc" },
  MiamiDolphins: { club: "Miami Dolphins", pattern: "solid", base: "#008e97", second: "#008e97", trim: "#fc4c02", ink: "#f8fafc" },
  SanDiegoChargers: { club: "San Diego Chargers", pattern: "solid", base: "#0080c6", second: "#0080c6", trim: "#ffc20e", ink: "#f8fafc" },
  ClevelandBrowns: { club: "Cleveland Browns", pattern: "solid", base: "#311d00", second: "#311d00", trim: "#ff3c00", ink: "#f8fafc" },
  DetroitLions: { club: "Detroit Lions", pattern: "solid", base: "#0076b6", second: "#0076b6", trim: "#b0b7bc", ink: "#f8fafc" },
  KansasCityChiefs: { club: "Kansas City Chiefs", pattern: "solid", base: "#e31837", second: "#e31837", trim: "#ffb81c", ink: "#f8fafc" },
  IndianapolisColts: { club: "Indianapolis Colts", pattern: "solid", base: "#002c5f", second: "#002c5f", trim: "#ffffff", ink: "#f8fafc" },
  BaltimoreColts: { club: "Baltimore Colts", pattern: "solid", base: "#002c5f", second: "#002c5f", trim: "#ffffff", ink: "#f8fafc" },
  OaklandRaiders: { club: "Oakland Raiders", pattern: "solid", base: "#111111", second: "#111111", trim: "#a5acaf", ink: "#f8fafc" },
  PittsburghSteelers: { club: "Pittsburgh Steelers", pattern: "solid", base: "#101820", second: "#101820", trim: "#ffb612", ink: "#ffb612" },
  TennesseeTitans: { club: "Tennessee Titans", pattern: "solid", base: "#0c2340", second: "#0c2340", trim: "#4b92db", ink: "#f8fafc" },
  StLouisRams: { club: "St. Louis Rams", pattern: "solid", base: "#003594", second: "#003594", trim: "#ffa300", ink: "#f8fafc" },
  NewYorkJets: { club: "New York Jets", pattern: "solid", base: "#125740", second: "#125740", trim: "#ffffff", ink: "#f8fafc" },
  LosAngelesRams: { club: "Los Angeles Rams", pattern: "solid", base: "#003594", second: "#003594", trim: "#ffa300", ink: "#f8fafc" },
  Washington: { club: "Washington", pattern: "solid", base: "#5a1414", second: "#5a1414", trim: "#ffb612", ink: "#f8fafc" },
  LasVegasRaiders: { club: "Las Vegas Raiders", pattern: "solid", base: "#111111", second: "#111111", trim: "#a5acaf", ink: "#f8fafc" },
  CarolinaPanthers: { club: "Carolina Panthers", pattern: "solid", base: "#0085ca", second: "#0085ca", trim: "#101820", ink: "#f8fafc" },
} satisfies Record<string, Kit>;

/** NFL: numbers checked against retired-number lists, Fox Sports and CBS Sports 0-99 lists. 00 is not 0, so Jim Otto is out. */
export const FOOTBALL_ROSTER: Roster = {
  1: [w("Warren Moon", "MOON", FOOTBALL_TEAMS.HoustonOilers), w("Ja'Marr Chase", "CHASE", FOOTBALL_TEAMS.CincinnatiBengals)],
  2: [w("Matt Ryan", "RYAN", FOOTBALL_TEAMS.AtlantaFalcons), w("Patrick Surtain II", "SURTAIN II", FOOTBALL_TEAMS.DenverBroncos)],
  3: [w("Russell Wilson", "WILSON", FOOTBALL_TEAMS.SeattleSeahawks), w("Derwin James", "JAMES", FOOTBALL_TEAMS.LosAngelesChargers)],
  4: [w("Brett Favre", "FAVRE", FOOTBALL_TEAMS.GreenBayPackers), w("Dak Prescott", "PRESCOTT", FOOTBALL_TEAMS.DallasCowboys)],
  5: [w("Paul Hornung", "HORNUNG", FOOTBALL_TEAMS.GreenBayPackers), w("Donovan McNabb", "McNABB", FOOTBALL_TEAMS.PhiladelphiaEagles), w("Jayden Daniels", "DANIELS", FOOTBALL_TEAMS.WashingtonCommanders)],
  6: [w("Jay Cutler", "CUTLER", FOOTBALL_TEAMS.ChicagoBears), w("Baker Mayfield", "MAYFIELD", FOOTBALL_TEAMS.TampaBayBuccaneers)],
  7: [w("John Elway", "ELWAY", FOOTBALL_TEAMS.DenverBroncos), w("Bijan Robinson", "ROBINSON", FOOTBALL_TEAMS.AtlantaFalcons)],
  8: [w("Steve Young", "YOUNG", FOOTBALL_TEAMS.SanFrancisco49ers), w("Lamar Jackson", "JACKSON", FOOTBALL_TEAMS.BaltimoreRavens)],
  9: [w("Drew Brees", "BREES", FOOTBALL_TEAMS.NewOrleansSaints), w("Joe Burrow", "BURROW", FOOTBALL_TEAMS.CincinnatiBengals)],
  10: [w("Eli Manning", "MANNING", FOOTBALL_TEAMS.NewYorkGiants), w("Fran Tarkenton", "TARKENTON", FOOTBALL_TEAMS.MinnesotaVikings)],
  11: [w("Larry Fitzgerald", "FITZGERALD", FOOTBALL_TEAMS.ArizonaCardinals), w("Micah Parsons", "PARSONS", FOOTBALL_TEAMS.DallasCowboys)],
  12: [w("Tom Brady", "BRADY", FOOTBALL_TEAMS.NewEnglandPatriots), w("Aaron Rodgers", "RODGERS", FOOTBALL_TEAMS.GreenBayPackers), w("Jim Kelly", "KELLY", FOOTBALL_TEAMS.BuffaloBills)],
  13: [w("Dan Marino", "MARINO", FOOTBALL_TEAMS.MiamiDolphins)],
  14: [w("Dan Fouts", "FOUTS", FOOTBALL_TEAMS.SanDiegoChargers), w("Otto Graham", "GRAHAM", FOOTBALL_TEAMS.ClevelandBrowns), w("Amon-Ra St. Brown", "ST. BROWN", FOOTBALL_TEAMS.DetroitLions)],
  15: [w("Patrick Mahomes", "MAHOMES II", FOOTBALL_TEAMS.KansasCityChiefs), w("Bart Starr", "STARR", FOOTBALL_TEAMS.GreenBayPackers)],
  16: [w("Joe Montana", "MONTANA", FOOTBALL_TEAMS.SanFrancisco49ers)],
  17: [w("Josh Allen", "ALLEN", FOOTBALL_TEAMS.BuffaloBills), w("Philip Rivers", "RIVERS", FOOTBALL_TEAMS.SanDiegoChargers)],
  18: [w("Peyton Manning", "MANNING", FOOTBALL_TEAMS.IndianapolisColts), w("Justin Jefferson", "JEFFERSON", FOOTBALL_TEAMS.MinnesotaVikings)],
  19: [w("Johnny Unitas", "UNITAS", FOOTBALL_TEAMS.BaltimoreColts)],
  20: [w("Barry Sanders", "SANDERS", FOOTBALL_TEAMS.DetroitLions)],
  21: [w("Deion Sanders", "SANDERS", FOOTBALL_TEAMS.DallasCowboys), w("LaDainian Tomlinson", "TOMLINSON", FOOTBALL_TEAMS.SanDiegoChargers)],
  22: [w("Emmitt Smith", "SMITH", FOOTBALL_TEAMS.DallasCowboys), w("Derrick Henry", "HENRY", FOOTBALL_TEAMS.BaltimoreRavens)],
  23: [w("Devin Hester", "HESTER", FOOTBALL_TEAMS.ChicagoBears), w("Christian McCaffrey", "McCAFFREY", FOOTBALL_TEAMS.SanFrancisco49ers)],
  24: [w("Champ Bailey", "BAILEY", FOOTBALL_TEAMS.DenverBroncos)],
  25: [w("Fred Biletnikoff", "BILETNIKOFF", FOOTBALL_TEAMS.OaklandRaiders)],
  26: [w("Saquon Barkley", "BARKLEY", FOOTBALL_TEAMS.PhiladelphiaEagles), w("Rod Woodson", "WOODSON", FOOTBALL_TEAMS.PittsburghSteelers)],
  27: [w("Steve Atwater", "ATWATER", FOOTBALL_TEAMS.DenverBroncos), w("Eddie George", "GEORGE", FOOTBALL_TEAMS.TennesseeTitans)],
  28: [w("Marshall Faulk", "FAULK", FOOTBALL_TEAMS.StLouisRams), w("Curtis Martin", "MARTIN", FOOTBALL_TEAMS.NewYorkJets), w("Jonathan Taylor", "TAYLOR", FOOTBALL_TEAMS.IndianapolisColts)],
  29: [w("Eric Dickerson", "DICKERSON", FOOTBALL_TEAMS.LosAngelesRams)],
  30: [w("Terrell Davis", "DAVIS", FOOTBALL_TEAMS.DenverBroncos)],
  31: [w("Jim Taylor", "TAYLOR", FOOTBALL_TEAMS.GreenBayPackers)],
  32: [w("Jim Brown", "BROWN", FOOTBALL_TEAMS.ClevelandBrowns), w("Franco Harris", "HARRIS", FOOTBALL_TEAMS.PittsburghSteelers)],
  33: [w("Sammy Baugh", "BAUGH", FOOTBALL_TEAMS.Washington)],
  34: [w("Walter Payton", "PAYTON", FOOTBALL_TEAMS.ChicagoBears), w("Earl Campbell", "CAMPBELL", FOOTBALL_TEAMS.HoustonOilers), w("Thurman Thomas", "THOMAS", FOOTBALL_TEAMS.BuffaloBills)],
  35: [w("Aeneas Williams", "WILLIAMS", FOOTBALL_TEAMS.ArizonaCardinals)],
  36: [w("Jerome Bettis", "BETTIS", FOOTBALL_TEAMS.PittsburghSteelers)],
  39: [w("Larry Csonka", "CSONKA", FOOTBALL_TEAMS.MiamiDolphins)],
  40: [w("Gale Sayers", "SAYERS", FOOTBALL_TEAMS.ChicagoBears), w("Pat Tillman", "TILLMAN", FOOTBALL_TEAMS.ArizonaCardinals)],
  42: [w("Ronnie Lott", "LOTT", FOOTBALL_TEAMS.SanFrancisco49ers)],
  43: [w("Troy Polamalu", "POLAMALU", FOOTBALL_TEAMS.PittsburghSteelers)],
  44: [w("John Riggins", "RIGGINS", FOOTBALL_TEAMS.Washington)],
  47: [w("Mel Blount", "BLOUNT", FOOTBALL_TEAMS.PittsburghSteelers)],
  49: [w("Bobby Mitchell", "MITCHELL", FOOTBALL_TEAMS.Washington)],
  50: [w("Mike Singletary", "SINGLETARY", FOOTBALL_TEAMS.ChicagoBears)],
  51: [w("Dick Butkus", "BUTKUS", FOOTBALL_TEAMS.ChicagoBears)],
  52: [w("Ray Lewis", "LEWIS", FOOTBALL_TEAMS.BaltimoreRavens)],
  54: [w("Randy White", "WHITE", FOOTBALL_TEAMS.DallasCowboys), w("Fred Warner", "WARNER", FOOTBALL_TEAMS.SanFrancisco49ers)],
  55: [w("Junior Seau", "SEAU", FOOTBALL_TEAMS.SanDiegoChargers), w("Derrick Brooks", "BROOKS", FOOTBALL_TEAMS.TampaBayBuccaneers)],
  56: [w("Lawrence Taylor", "TAYLOR", FOOTBALL_TEAMS.NewYorkGiants)],
  58: [w("Jack Lambert", "LAMBERT", FOOTBALL_TEAMS.PittsburghSteelers), w("Derrick Thomas", "THOMAS", FOOTBALL_TEAMS.KansasCityChiefs)],
  59: [w("Jack Ham", "HAM", FOOTBALL_TEAMS.PittsburghSteelers)],
  60: [w("Chuck Bednarik", "BEDNARIK", FOOTBALL_TEAMS.PhiladelphiaEagles)],
  62: [w("Jason Kelce", "KELCE", FOOTBALL_TEAMS.PhiladelphiaEagles)],
  66: [w("Ray Nitschke", "NITSCHKE", FOOTBALL_TEAMS.GreenBayPackers)],
  73: [w("John Hannah", "HANNAH", FOOTBALL_TEAMS.NewEnglandPatriots)],
  74: [w("Merlin Olsen", "OLSEN", FOOTBALL_TEAMS.LosAngelesRams)],
  75: [w("Joe Greene", "GREENE", FOOTBALL_TEAMS.PittsburghSteelers), w("Deacon Jones", "JONES", FOOTBALL_TEAMS.LosAngelesRams)],
  76: [w("Lou Groza", "GROZA", FOOTBALL_TEAMS.ClevelandBrowns)],
  78: [w("Anthony Muñoz", "MUNOZ", FOOTBALL_TEAMS.CincinnatiBengals), w("Bruce Smith", "SMITH", FOOTBALL_TEAMS.BuffaloBills)],
  80: [w("Jerry Rice", "RICE", FOOTBALL_TEAMS.SanFrancisco49ers), w("Steve Largent", "LARGENT", FOOTBALL_TEAMS.SeattleSeahawks), w("Cris Carter", "CARTER", FOOTBALL_TEAMS.MinnesotaVikings)],
  82: [w("Ozzie Newsome", "NEWSOME", FOOTBALL_TEAMS.ClevelandBrowns)],
  84: [w("Randy Moss", "MOSS", FOOTBALL_TEAMS.MinnesotaVikings)],
  85: [w("George Kittle", "KITTLE", FOOTBALL_TEAMS.SanFrancisco49ers), w("Jack Youngblood", "YOUNGBLOOD", FOOTBALL_TEAMS.LosAngelesRams)],
  87: [w("Travis Kelce", "KELCE", FOOTBALL_TEAMS.KansasCityChiefs), w("Rob Gronkowski", "GRONKOWSKI", FOOTBALL_TEAMS.NewEnglandPatriots)],
  88: [w("Tony Gonzalez", "GONZALEZ", FOOTBALL_TEAMS.KansasCityChiefs), w("CeeDee Lamb", "LAMB", FOOTBALL_TEAMS.DallasCowboys), w("Alan Page", "PAGE", FOOTBALL_TEAMS.MinnesotaVikings)],
  89: [w("Mike Ditka", "DITKA", FOOTBALL_TEAMS.ChicagoBears), w("Brock Bowers", "BOWERS", FOOTBALL_TEAMS.LasVegasRaiders)],
  90: [w("T.J. Watt", "WATT", FOOTBALL_TEAMS.PittsburghSteelers), w("Julius Peppers", "PEPPERS", FOOTBALL_TEAMS.CarolinaPanthers)],
  92: [w("Reggie White", "WHITE", FOOTBALL_TEAMS.GreenBayPackers), w("Michael Strahan", "STRAHAN", FOOTBALL_TEAMS.NewYorkGiants)],
  93: [w("John Randle", "RANDLE", FOOTBALL_TEAMS.MinnesotaVikings)],
  94: [w("DeMarcus Ware", "WARE", FOOTBALL_TEAMS.DallasCowboys)],
  95: [w("Richard Dent", "DENT", FOOTBALL_TEAMS.ChicagoBears)],
  96: [w("Cortez Kennedy", "KENNEDY", FOOTBALL_TEAMS.SeattleSeahawks)],
  97: [w("Nick Bosa", "BOSA", FOOTBALL_TEAMS.SanFrancisco49ers), w("Cameron Heyward", "HEYWARD", FOOTBALL_TEAMS.PittsburghSteelers)],
  98: [w("Maxx Crosby", "CROSBY", FOOTBALL_TEAMS.LasVegasRaiders)],
  99: [w("Aaron Donald", "DONALD", FOOTBALL_TEAMS.LosAngelesRams), w("Warren Sapp", "SAPP", FOOTBALL_TEAMS.TampaBayBuccaneers)],
};

const VOLLEYBALL_TEAMS = {
  USA: { club: "USA", pattern: "solid", base: "#0a3161", second: "#0a3161", trim: "#b31942", ink: "#f8fafc" },
  Brazil: { club: "Brazil", pattern: "solid", base: "#ffdf00", second: "#ffdf00", trim: "#009c3b", ink: "#002776" },
  France: { club: "France", pattern: "solid", base: "#002395", second: "#002395", trim: "#ed2939", ink: "#f8fafc" },
  Poland: { club: "Poland", pattern: "solid", base: "#f8fafc", second: "#f8fafc", trim: "#dc143c", ink: "#dc143c" },
  Italy: { club: "Italy", pattern: "solid", base: "#0066cc", second: "#0066cc", trim: "#ffffff", ink: "#f8fafc" },
  SouthKorea: { club: "South Korea", pattern: "solid", base: "#cd2e3a", second: "#cd2e3a", trim: "#0047a0", ink: "#f8fafc" },
  Japan: { club: "Japan", pattern: "solid", base: "#bc002d", second: "#bc002d", trim: "#ffffff", ink: "#f8fafc" },
  Serbia: { club: "Serbia", pattern: "solid", base: "#c6363c", second: "#c6363c", trim: "#0c4076", ink: "#f8fafc" },
} satisfies Record<string, Kit>;

/** National teams: numbers checked against USA Volleyball, CEV, Volleyball World and Olympic rosters. Unconfirmed ones (Kiraly 15, Zhu Ting 2) are left out. */
export const VOLLEYBALL_ROSTER: Roster = {
  1: [w("Matt Anderson", "ANDERSON", VOLLEYBALL_TEAMS.USA)],
  7: [w("Giba", "GIBA", VOLLEYBALL_TEAMS.Brazil)],
  9: [w("Earvin N'Gapeth", "NGAPETH", VOLLEYBALL_TEAMS.France), w("Wilfredo León", "LEON", VOLLEYBALL_TEAMS.Poland), w("Ivan Zaytsev", "ZAYTSEV", VOLLEYBALL_TEAMS.Italy)],
  10: [w("Jordan Larson", "LARSON", VOLLEYBALL_TEAMS.USA), w("Kim Yeon-koung", "KIM", VOLLEYBALL_TEAMS.SouthKorea)],
  11: [w("Micah Christenson", "CHRISTENSON", VOLLEYBALL_TEAMS.USA)],
  14: [w("Yuki Ishikawa", "ISHIKAWA", VOLLEYBALL_TEAMS.Japan)],
  18: [w("Paola Egonu", "EGONU", VOLLEYBALL_TEAMS.Italy), w("Tijana Bošković", "BOŠKOVIĆ", VOLLEYBALL_TEAMS.Serbia)],
};

export const ROSTERS: Record<Sport, Roster> = {
  soccer: JERSEY_ROSTER,
  basketball: BASKETBALL_ROSTER,
  football: FOOTBALL_ROSTER,
  volleyball: VOLLEYBALL_ROSTER,
};

/** The jersey for a number from 0 to 99; `seed` picks between wearers. Null above 99, below 0, or for a fraction. */
export function jerseyFor(number: number, seed = "", sport: Sport = "soccer"): JerseyPick | null {
  if (!Number.isInteger(number) || number < 0 || number > 99) return null;
  const wearers = ROSTERS[sport][number];
  if (!wearers?.length) return { sport, number, name: null, fullName: null, kit: PLAIN_KITS[sport] };
  const pick = wearers[hash(`${seed}#${number}`) % wearers.length];
  return { sport, number, name: pick.name, fullName: pick.fullName, kit: pick.kit };
}

/** The sport a story's interest is set in, when it has jerseys. */
export function sportOfTopic(label: string | null | undefined): Sport | null {
  const t = (label ?? "").toLowerCase();
  if (/\bsoccer\b/.test(t)) return "soccer";
  if (/\bbasketball\b/.test(t)) return "basketball";
  if (/\bfootball\b/.test(t)) return "football";
  if (/\bvolleyball\b/.test(t)) return "volleyball";
  return null;
}

const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Surnames that are also everyday first names or words: a story's "Taylor" is a person, not Lawrence Taylor. */
const COMMON = new Set(
  "james thomas johnson taylor davis smith brown williams jackson martin allen moore miller wilson anderson carter henry white young price parker bird rose west reed page moon graham kelly george harris lewis jones malone rice starr payton green greene lamb dent ham ryan jordan leon kim chase curry daniels robinson russell anthony wade barry".split(" ")
);

/**
 * What fans call them, checked first. "Ronaldo" on its own is Cristiano, the
 * one a student today means (and an app suggestion).
 */
const NICKNAMES: Record<Sport, [string, string][]> = {
  soccer: [["Cristiano", "Cristiano Ronaldo"], ["CR7", "Cristiano Ronaldo"], ["Ronaldo", "Cristiano Ronaldo"], ["Leo Messi", "Lionel Messi"], ["Lamine", "Lamine Yamal"], ["Yamal", "Lamine Yamal"], ["Kvara", "Khvicha Kvaratskhelia"], ["Ronaldinho", "Ronaldinho"]],
  basketball: [["Steph Curry", "Stephen Curry"], ["Steph", "Stephen Curry"], ["LeBron", "LeBron James"], ["Shaq", "Shaquille O'Neal"], ["Kobe", "Kobe Bryant"], ["Giannis", "Giannis Antetokounmpo"], ["Wemby", "Victor Wembanyama"], ["SGA", "Shai Gilgeous-Alexander"], ["Luka", "Luka Dončić"], ["Jokic", "Nikola Jokić"], ["KD", "Kevin Durant"], ["Ant Edwards", "Anthony Edwards"], ["A'ja", "A'ja Wilson"]],
  football: [["Mahomes", "Patrick Mahomes"], ["Gronk", "Rob Gronkowski"], ["Prime Time", "Deion Sanders"], ["CMC", "Christian McCaffrey"], ["Saquon", "Saquon Barkley"]],
  volleyball: [],
};

/** The surname a back carries: "MAHOMES II" is Mahomes, "G. NEVILLE" is Neville. */
function surnameOf(back: string): string {
  return plain(back).replace(/^[A-Z]\.\s*/, "").replace(/\s+(II|III|JR)$/, "");
}

/**
 * The first player of `sport` a story names: their full name anywhere, a
 * nickname fans use (NICKNAMES), or their surname alone, written as a name (capitalized, not part of a longer
 * name like "James Harden"), when only one listed player has it and it is
 * not an everyday name. The lowest number a player is listed under wins,
 * so "Messi" is his 10 at Barcelona; "Ronaldo" alone is two players and
 * draws nobody.
 */
export function playerNamedIn(text: string, sport: Sport): JerseyPick | null {
  const story = plain(text);
  const roster = ROSTERS[sport];
  const numbers = Object.keys(roster).map(Number).sort((a, b) => a - b);
  const pick = (number: number, p: Wearer): JerseyPick => ({ sport, number, name: p.name, fullName: p.fullName, kit: p.kit });
  // A full name first, then what fans call them, then a surname alone.
  for (const n of numbers) {
    for (const p of roster[n] ?? []) {
      if (new RegExp(`(^|[^\\p{L}])${escape(plain(p.fullName))}(?![\\p{L}])`, "iu").test(story)) return pick(n, p);
    }
  }
  for (const [nick, fullName] of NICKNAMES[sport]) {
    if (!new RegExp(`(^|[^\\p{L}])${escape(nick)}(?![\\p{L}])`, "u").test(story)) continue;
    for (const n of numbers) {
      const p = roster[n]?.find((x) => x.fullName === fullName);
      if (p) return pick(n, p);
    }
  }
  const owners = new Map<string, Set<string>>();
  for (const n of numbers) for (const p of roster[n] ?? []) {
    const key = surnameOf(p.name).toLowerCase();
    owners.set(key, (owners.get(key) ?? new Set()).add(p.fullName));
  }
  for (const number of numbers) {
    for (const p of roster[number] ?? []) {
      const sur = surnameOf(p.name);
      const word = sur.charAt(0) + sur.slice(1).toLowerCase();
      const alone =
        sur.length >= 4 &&
        !/[\s'-]/.test(sur) &&
        !COMMON.has(sur.toLowerCase()) &&
        owners.get(sur.toLowerCase())?.size === 1 &&
        new RegExp(`(?<![\\p{Lu}][\\p{L}.']*\\s)(?<![\\p{L}])${escape(word)}(?![\\p{L}])(?!\\s+\\p{Lu})`, "u").test(story);
      if (alone) return pick(number, p);
    }
  }
  return null;
}

/**
 * A number an answer shows as a jersey: "10", or "x = 10". The number has
 * to be written plainly (no leading zero, no sign, no decimal).
 */
export function jerseyNumberIn(text: string): { prefix: string; number: number } | null {
  const m = text.trim().match(/^(?:([a-z])\s*=\s*)?(0|[1-9]\d?)$/i);
  if (!m) return null;
  return { prefix: m[1] ? `${m[1]} =` : "", number: Number(m[2]) };
}
