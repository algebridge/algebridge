import type { Video } from "@/types";

/**
 * Verified YouTube video IDs (checked via oEmbed).
 * Keys match skill IDs in curriculum.ts.
 */
export const SKILL_VIDEOS: Record<string, Video> = {
  // Unit 1 — Working with Units
  "unit-basics": {
    id: "sv-unit-basics",
    title: "Unit Conversion within the Metric System",
    channel: "Khan Academy",
    duration: "9:17",
    youtubeId: "w0nqd_HXHPQ",
  },
  "dimensional-analysis": {
    id: "sv-dimensional-analysis",
    title: "Dimensional Analysis",
    channel: "Khan Academy",
    duration: "6:29",
    youtubeId: "hIAdCTNi1S8",
  },
  "unit-word-problems": {
    id: "sv-unit-word-problems",
    title: "Converting Units using Multiple Conversion Factors",
    channel: "Tyler DeWitt",
    duration: "10:05",
    youtubeId: "LdZ00OFAfaQ",
  },

  // Unit 2 — Solving Equations
  "one-step-equations": {
    id: "sv-one-step",
    title: "Solving Basic Equations Part 1",
    channel: "Math Antics",
    duration: "11:08",
    youtubeId: "l3XzepN03KQ",
  },
  "two-step-equations": {
    id: "sv-two-step",
    title: "Solving 2-Step Equations",
    channel: "Math Antics",
    duration: "9:30",
    youtubeId: "LDIiYKYvvdA",
  },
  "multi-step-equations": {
    id: "sv-multi-step",
    title: "The Distributive Property",
    channel: "Math Antics",
    duration: "11:54",
    youtubeId: "v-6MShC82ow",
  },
  "equations-with-fractions": {
    id: "sv-fractions",
    title: "How To Solve Equations Quickly",
    channel: "The Organic Chemistry Tutor",
    duration: "12:00",
    youtubeId: "Z-ZkmpQBIFo",
  },
  "linear-inequalities": {
    id: "sv-inequalities",
    title: "Basic Inequalities",
    channel: "Math Antics",
    duration: "12:31",
    youtubeId: "mgHO-bsCDrA",
  },

  // Unit 3 — Linear Equations & Graphs
  "coordinate-plane": {
    id: "sv-coordinate",
    title: "Graphing On The Coordinate Plane",
    channel: "Math Antics",
    duration: "9:00",
    youtubeId: "9Uc62CuQjc4",
  },
  slope: {
    id: "sv-slope",
    title: "Slope And Distance",
    channel: "Math Antics",
    duration: "12:00",
    youtubeId: "rpMu98yRk40",
  },
  "graphing-lines": {
    id: "sv-graphing",
    title: "Basic Linear Functions",
    channel: "Math Antics",
    duration: "13:23",
    youtubeId: "MXV65i9g1Xg",
  },
  intercepts: {
    id: "sv-intercepts",
    title: "Basic Linear Functions (Intercepts & Slope-Intercept)",
    channel: "Math Antics",
    duration: "13:23",
    youtubeId: "MXV65i9g1Xg",
  },

  // Unit 4 — Forms of Linear Equations
  "slope-intercept": {
    id: "sv-slope-intercept",
    title: "Basic Linear Functions — y = mx + b",
    channel: "Math Antics",
    duration: "13:23",
    youtubeId: "MXV65i9g1Xg",
  },
  "point-slope": {
    id: "sv-point-slope",
    title: "Algebra 1 Review — Linear Equations",
    channel: "The Organic Chemistry Tutor",
    duration: "2:12",
    youtubeId: "TbJ5gqLRpeM",
  },
  "standard-form": {
    id: "sv-standard-form",
    title: "Algebra 1 Review — Forms of Linear Equations",
    channel: "The Organic Chemistry Tutor",
    duration: "2:12",
    youtubeId: "TbJ5gqLRpeM",
  },
  "parallel-perpendicular": {
    id: "sv-parallel",
    title: "Algebra 1 Review — Parallel & Perpendicular Lines",
    channel: "The Organic Chemistry Tutor",
    duration: "2:12",
    youtubeId: "TbJ5gqLRpeM",
  },

  // Unit 5 — Systems of Equations
  "graphing-systems": {
    id: "sv-graph-systems",
    title: "Solving Systems by Graphing, Substitution & Elimination",
    channel: "The Organic Chemistry Tutor",
    duration: "10:26",
    youtubeId: "oKqtgz2eo-Y",
  },
  substitution: {
    id: "sv-substitution",
    title: "Solving Systems Using Substitution",
    channel: "The Organic Chemistry Tutor",
    duration: "17:15",
    youtubeId: "cblHUeq3bkE",
  },
  elimination: {
    id: "sv-elimination",
    title: "Solving Systems by Elimination & Substitution",
    channel: "The Organic Chemistry Tutor",
    duration: "10:26",
    youtubeId: "oKqtgz2eo-Y",
  },
  "systems-word-problems": {
    id: "sv-systems-word",
    title: "Systems of Equations Word Problems",
    channel: "The Organic Chemistry Tutor",
    duration: "10:26",
    youtubeId: "oKqtgz2eo-Y",
  },

  // Unit 6 — Inequalities
  "graphing-inequalities": {
    id: "sv-graph-ineq",
    title: "Inequalities In Algebra",
    channel: "Math Antics",
    duration: "14:10",
    youtubeId: "RyesLifeUBw",
  },
  "compound-inequalities": {
    id: "sv-compound",
    title: "Basic Inequalities (Compound)",
    channel: "Math Antics",
    duration: "12:31",
    youtubeId: "mgHO-bsCDrA",
  },
  "systems-inequalities": {
    id: "sv-systems-ineq",
    title: "Inequalities In Algebra (Systems)",
    channel: "Math Antics",
    duration: "14:10",
    youtubeId: "RyesLifeUBw",
  },

  // Unit 7 — Functions
  "function-notation": {
    id: "sv-functions",
    title: "What Are Functions?",
    channel: "Math Antics",
    duration: "11:34",
    youtubeId: "52tpYl2tTqk",
  },
  "domain-range": {
    id: "sv-domain",
    title: "What Are Functions? (Domain & Range)",
    channel: "Math Antics",
    duration: "11:34",
    youtubeId: "52tpYl2tTqk",
  },
  "function-graphs": {
    id: "sv-function-graphs",
    title: "What Are Functions? (Graphing)",
    channel: "Math Antics",
    duration: "11:34",
    youtubeId: "52tpYl2tTqk",
  },

  // Unit 8 — Sequences
  "arithmetic-sequences": {
    id: "sv-arithmetic",
    title: "Arithmetic Sequences and Series",
    channel: "The Organic Chemistry Tutor",
    duration: "10:00",
    youtubeId: "XZJdyPkCxuE",
  },
  "geometric-sequences": {
    id: "sv-geometric",
    title: "Arithmetic & Geometric Sequences",
    channel: "The Organic Chemistry Tutor",
    duration: "10:00",
    youtubeId: "XZJdyPkCxuE",
  },

  // Unit 9 — Exponents & Radicals
  "exponent-rules": {
    id: "sv-exponents",
    title: "Simplifying Exponents",
    channel: "The Organic Chemistry Tutor",
    duration: "15:00",
    youtubeId: "Zt2fdy3zrZU",
  },
  "negative-fractional-exponents": {
    id: "sv-neg-exponents",
    title: "Negative & Fractional Exponents",
    channel: "The Organic Chemistry Tutor",
    duration: "15:00",
    youtubeId: "Zt2fdy3zrZU",
  },
  "scientific-notation": {
    id: "sv-scientific",
    title: "Scientific Notation",
    channel: "Math Antics",
    duration: "14:28",
    youtubeId: "bXkewQ7WEdI",
  },
  "simplifying-radicals": {
    id: "sv-radicals",
    title: "Exponents and Square Roots",
    channel: "Math Antics",
    duration: "11:08",
    youtubeId: "B4zejSI8zho",
  },

  // Unit 10 — Exponential Growth & Decay
  "exponential-functions": {
    id: "sv-exp-func",
    title: "Intro To Exponents",
    channel: "Math Antics",
    duration: "10:04",
    youtubeId: "-zUmvpkhvW8",
  },
  "exponential-growth": {
    id: "sv-exp-growth",
    title: "Exponential Growth and Decay Word Problems",
    channel: "The Organic Chemistry Tutor",
    duration: "12:49",
    youtubeId: "e5nwJKUc3bA",
  },
  "exponential-decay": {
    id: "sv-exp-decay",
    title: "Exponential Growth and Decay",
    channel: "The Organic Chemistry Tutor",
    duration: "12:49",
    youtubeId: "e5nwJKUc3bA",
  },

  // Unit 11 — Quadratics: Factoring
  "multiplying-binomials": {
    id: "sv-multiply-binomials",
    title: "The Distributive Property (Multiplying Polynomials)",
    channel: "Math Antics",
    duration: "11:54",
    youtubeId: "v-6MShC82ow",
  },
  "special-products": {
    id: "sv-special-products",
    title: "How To Factor Polynomials",
    channel: "The Organic Chemistry Tutor",
    duration: "14:00",
    youtubeId: "U6FndtdgpcA",
  },
  "factoring-trinomials": {
    id: "sv-factor-trinomials",
    title: "Factoring Trinomials The Easy Fast Way",
    channel: "The Organic Chemistry Tutor",
    duration: "12:00",
    youtubeId: "-4jANGlJRSY",
  },
  "factoring-special": {
    id: "sv-factor-special",
    title: "Factoring Special Cases (Difference of Squares)",
    channel: "The Organic Chemistry Tutor",
    duration: "14:00",
    youtubeId: "U6FndtdgpcA",
  },

  // Unit 12 — Quadratic Functions
  "graphing-parabolas": {
    id: "sv-parabolas",
    title: "Graphing Quadratic Functions",
    channel: "The Organic Chemistry Tutor",
    duration: "47:00",
    youtubeId: "Hq2Up_1Ih5E",
  },
  "solving-by-factoring": {
    id: "sv-solve-factoring",
    title: "Solving Quadratic Equations By Factoring",
    channel: "The Organic Chemistry Tutor",
    duration: "12:00",
    youtubeId: "qeByhTF8WEw",
  },
  "completing-square": {
    id: "sv-complete-square",
    title: "Graphing Quadratics (Completing the Square)",
    channel: "The Organic Chemistry Tutor",
    duration: "47:00",
    youtubeId: "Hq2Up_1Ih5E",
  },
  "quadratic-formula": {
    id: "sv-quadratic-formula",
    title: "Quadratic Formula & Factoring",
    channel: "The Organic Chemistry Tutor",
    duration: "12:00",
    youtubeId: "qeByhTF8WEw",
  },

  // Unit 13 — Absolute Value & Piecewise
  "absolute-value": {
    id: "sv-abs-value",
    title: "Absolute Value",
    channel: "Math Antics",
    duration: "13:14",
    youtubeId: "BrYy1bgh3Y0",
  },
  "absolute-value-inequalities": {
    id: "sv-abs-ineq",
    title: "Absolute Value",
    channel: "Math Antics",
    duration: "13:14",
    youtubeId: "BrYy1bgh3Y0",
  },
  "piecewise-functions": {
    id: "sv-piecewise",
    title: "What Are Functions? (Piecewise Intro)",
    channel: "Math Antics",
    duration: "11:34",
    youtubeId: "52tpYl2tTqk",
  },
};

export const BACKUP_VIDEOS: Record<string, Video> = {
  "one-step-equations": {
    id: "sv-one-step-backup",
    title: "One Step Equations (Multiplication & Division)",
    channel: "Math Antics",
    duration: "10:00",
    youtubeId: "NybHckSEQBI",
  },
  "multi-step-equations": {
    id: "sv-multi-step-backup",
    title: "Combining Like Terms & Distributive Property",
    channel: "Khan Academy",
    duration: "5:00",
    youtubeId: "3NHSwiv_pSE",
  },
};

export function getVideoForSkill(skillId: string, fallback?: Video): Video {
  return SKILL_VIDEOS[skillId] ?? fallback!;
}

export function getBackupVideoForSkill(skillId: string): Video | undefined {
  return BACKUP_VIDEOS[skillId];
}

export function youtubeWatchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

/** Parses a "M:SS" or "H:MM:SS" duration string into total seconds. */
export function parseDurationToSeconds(duration: string): number {
  const parts = duration.split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

export function youtubeEmbedUrl(youtubeId: string): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    origin:
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000",
  });
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`;
}
