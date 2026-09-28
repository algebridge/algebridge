/**
 * Mathematicians on why algebra, and mathematics, are worth the work.
 *
 * Every quote here is real and carries its source. None is paraphrased into
 * something its author did not say, and none is invented: a student who
 * looks one up should find it. A fragment starts with an ellipsis. Where a
 * quote reached us through a later collection, the collection is named.
 */

import { hashString } from "@/lib/problem-utils";

export type QuoteTopic = "algebra" | "why" | "practice" | "understanding" | "problems";

export interface MathQuote {
  id: string;
  text: string;
  who: string;
  /** Who they were, in a line, so a student knows why to listen. */
  role: string;
  /** Where the words come from. */
  source: string;
  about: QuoteTopic;
  /** Units the quote fits; a unit page shows one of these first. */
  units?: string[];
}

export const QUOTES: MathQuote[] = [
  {
    id: "khwarizmi",
    text: "…what is easiest and most useful in arithmetic, such as men constantly require in cases of inheritance, legacies, partition, lawsuits, and trade, and in all their dealings with one another.",
    who: "Muhammad ibn Musa al-Khwarizmi",
    role: "Persian mathematician, about 780 to 850. The word algebra comes from the title of his book.",
    source: "On what his book of algebra was for, about 820, in Frederic Rosen's 1831 translation",
    about: "algebra",
    units: ["working-with-units", "solving-equations"],
  },
  {
    id: "khayyam-relations",
    text: "What one searches for in the algebraic art are the relations which lead from the known to the unknown.",
    who: "Omar Khayyam",
    role: "Persian mathematician and poet, 1048 to 1131",
    source: "A Treatise on Algebra, about 1070, translated by Daoud S. Kasir",
    about: "algebra",
    units: ["solving-equations", "systems-equations"],
  },
  {
    id: "khayyam-trick",
    text: "Whoever thinks algebra is a trick in obtaining unknowns has thought it in vain.",
    who: "Omar Khayyam",
    role: "Persian mathematician and poet, 1048 to 1131",
    source: "A paper of Omar Khayyam, translated by A. R. Amir-Moez in Scripta Mathematica, 1963",
    about: "understanding",
    units: ["quadratics-factoring", "quadratic-functions"],
  },
  {
    id: "descartes",
    text: "Each problem that I solved became a rule which served afterwards to solve other problems.",
    who: "René Descartes",
    role: "French mathematician and philosopher, 1596 to 1650. The x-y plane is named after him.",
    source: "Discourse on the Method, 1637",
    about: "problems",
    units: ["linear-equations-graphs", "forms-linear-equations"],
  },
  {
    id: "germain",
    text: "Algebra is but written geometry and geometry is but figured algebra.",
    who: "Sophie Germain",
    role: "French mathematician, 1776 to 1831",
    source: "Mémoire sur les surfaces élastiques, as quoted in Memorabilia Mathematica, 1914",
    about: "algebra",
    units: ["linear-equations-graphs", "inequalities-systems", "quadratic-functions"],
  },
  {
    id: "dalembert",
    text: "Algebra is generous; she often gives more than is asked of her.",
    who: "Jean le Rond d'Alembert",
    role: "French mathematician and physicist, 1717 to 1783",
    source: "As quoted in Memorabilia Mathematica, 1914",
    about: "algebra",
    units: ["systems-equations", "quadratics-factoring"],
  },
  {
    id: "lovelace",
    text: "The Analytical Engine weaves algebraical patterns just as the Jacquard loom weaves flowers and leaves.",
    who: "Ada Lovelace",
    role: "English mathematician, 1815 to 1852. She wrote the first published computer program.",
    source: "Notes on the Analytical Engine, 1843",
    about: "algebra",
    units: ["sequences", "functions"],
  },
  {
    id: "whitehead",
    text: "Algebra is the intellectual instrument which has been created for rendering clear the quantitative aspects of the world.",
    who: "Alfred North Whitehead",
    role: "English mathematician and philosopher, 1861 to 1947",
    source: "An Introduction to Mathematics, 1911",
    about: "algebra",
    units: ["working-with-units", "exponents-radicals", "exponential-growth-decay"],
  },
  {
    id: "moses",
    text: "In today's world, economic access and full citizenship depend crucially on math and science literacy.",
    who: "Robert P. Moses",
    role: "Math teacher and civil rights organizer, 1935 to 2021. He founded the Algebra Project to get every student through algebra.",
    source: "Radical Equations, 2001",
    about: "why",
  },
  {
    id: "halmos",
    text: "The only way to learn mathematics is to do mathematics.",
    who: "Paul Halmos",
    role: "Hungarian-American mathematician, 1916 to 2006",
    source: "A Hilbert Space Problem Book, 1967",
    about: "practice",
  },
  {
    id: "polya",
    text: "If you cannot solve the proposed problem try to solve first some related problem.",
    who: "George Pólya",
    role: "Hungarian mathematician, 1887 to 1985, who wrote the book on how to solve problems",
    source: "How to Solve It, 1945",
    about: "problems",
  },
  {
    id: "thurston",
    text: "Mathematics is a process of staring hard enough with enough perseverance at the fog of muddle and confusion to eventually break through to improved clarity.",
    who: "William Thurston",
    role: "American mathematician, 1946 to 2012, Fields Medal 1982",
    source: "His profile on MathOverflow",
    about: "understanding",
  },
  {
    id: "mirzakhani",
    text: "The beauty of mathematics only shows itself to more patient followers.",
    who: "Maryam Mirzakhani",
    role: "Iranian mathematician, 1977 to 2017, the first woman to win the Fields Medal",
    source: "Interview with the Clay Mathematics Institute, 2008",
    about: "practice",
  },
  {
    id: "johnson",
    text: "There will always, always be mathematics. Everything is physics and math.",
    who: "Katherine Johnson",
    role: "American mathematician at NASA, 1918 to 2020. Her calculations put astronauts into orbit and on the Moon.",
    source: "Speaking to students after her NASA career, as recorded by NASA",
    about: "why",
    units: ["working-with-units", "exponential-growth-decay"],
  },
  {
    id: "tao",
    text: "Does one have to be a genius to do maths? The answer is an emphatic NO.",
    who: "Terence Tao",
    role: "Australian-American mathematician, born 1975, Fields Medal 2006",
    source: "Career advice on his blog, reprinted in the Notices of the American Mathematical Society, 2024",
    about: "practice",
  },
  {
    id: "su",
    text: "The practice of mathematics cultivates virtues that help people flourish.",
    who: "Francis Su",
    role: "American mathematician, born 1970, past president of the Mathematical Association of America",
    source: "Mathematics for Human Flourishing, his address of January 2017",
    about: "why",
  },
];

function byId(id: string): MathQuote {
  const q = QUOTES.find((x) => x.id === id);
  if (!q) throw new Error(`no quote ${id}`);
  return q;
}

/** The three on the course page: what algebra is for, from the man the word comes from to now. */
export const HOME_QUOTES: MathQuote[] = [byId("khwarizmi"), byId("moses"), byId("whitehead")];

/** One of a set, chosen by a key and always the same for that key. */
export function quoteFor(about: QuoteTopic | QuoteTopic[], key: string): MathQuote {
  const topics = Array.isArray(about) ? about : [about];
  const pool = QUOTES.filter((q) => topics.includes(q.about));
  return pool[hashString(key) % pool.length];
}

/** The quote a unit page opens with: one written for its ground, or one about algebra. */
export function quoteForUnit(unitId: string): MathQuote {
  const own = QUOTES.filter((q) => q.units?.includes(unitId));
  if (own.length) return own[hashString(unitId) % own.length];
  return quoteFor("algebra", unitId);
}

/** The line under a finished skill: doing the work is how it is learned. */
export function quoteForFinish(skillId: string): MathQuote {
  return quoteFor(["practice", "understanding", "problems"], skillId);
}
