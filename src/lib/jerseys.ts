/**
 * Rayla's soccer game shows whole numbers from 0 to 99 as jerseys: the back
 * of the shirt of the best-known player who wore that number, in the colors
 * of the club they wore it for. Club colors only, never a crest or a logo.
 *
 * Every pairing here is a player who wore that number at that club. A number
 * with no pairing anyone could name with confidence gets a plain jersey with
 * no name, never a guess. Numbers above 99 stay plain numbers.
 */

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

/** The plain jersey: Rayla's own red kit, no name. */
export const PLAIN_KIT: Kit = { club: "", pattern: "solid", base: "#dc2626", second: "#dc2626", trim: "#f8fafc", ink: "#f8fafc" };

type Wearer = { name: string; fullName: string; kit: Kit };
const w = (fullName: string, name: string, kit: Kit): Wearer => ({ fullName, name, kit });

/**
 * The wearers of each number. Where several are known for one number, the
 * game picks between them.
 */
export const JERSEY_ROSTER: Partial<Record<number, Wearer[]>> = {
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

/** The jersey for a number from 0 to 99; `seed` picks between wearers. Null above 99, below 0, or for a fraction. */
export function jerseyFor(number: number, seed = ""): JerseyPick | null {
  if (!Number.isInteger(number) || number < 0 || number > 99) return null;
  const wearers = JERSEY_ROSTER[number];
  if (!wearers?.length) return { number, name: null, fullName: null, kit: PLAIN_KIT };
  const pick = wearers[hash(`${seed}#${number}`) % wearers.length];
  return { number, name: pick.name, fullName: pick.fullName, kit: pick.kit };
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
