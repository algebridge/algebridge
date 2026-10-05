import type { Video } from "@/types";

/**
 * One lesson video per skill, each chosen because it teaches that skill's
 * practice. Every ID was found in a live YouTube search, then checked with
 * oEmbed (real title and channel) and on its watch page (public, playable in
 * an embed, real length) on October 2, 2026. Titles are YouTube's own, minus
 * the channel name or Khan Academy's course breadcrumb. Durations matter: the
 * player counts a video watched at 85% of this length.
 * Keys match skill IDs in curriculum.ts. No ID serves two skills (tested).
 */
export const SKILL_VIDEOS: Record<string, Video> = {
  // Unit 1, Working with Units
  "unit-basics": {
    id: "sv-unit-basics",
    title: "Unit conversion word problem: yards to inches",
    channel: "Khan Academy",
    duration: "5:48",
    youtubeId: "jFSenp9ueaI",
  },
  "dimensional-analysis": {
    id: "sv-dimensional-analysis",
    title: "Treating units algebraically and dimensional analysis",
    channel: "Khan Academy",
    duration: "6:29",
    youtubeId: "hIAdCTNi1S8",
  },
  "unit-word-problems": {
    id: "sv-unit-word-problems",
    title: "Unit conversion word problem: roadtrip",
    channel: "Khan Academy",
    duration: "3:47",
    youtubeId: "xpzt0wqMT6Y",
  },

  // Unit 2, Solving Equations
  "one-step-equations": {
    id: "sv-one-step",
    title: "Algebra Basics: Solving Basic Equations Part 1",
    channel: "Math Antics",
    duration: "11:08",
    youtubeId: "l3XzepN03KQ",
  },
  "two-step-equations": {
    id: "sv-two-step",
    title: "Algebra Basics: Solving 2-Step Equations",
    channel: "Math Antics",
    duration: "10:29",
    youtubeId: "LDIiYKYvvdA",
  },
  "multi-step-equations": {
    id: "sv-multi-step",
    title: "Introduction to solving an equation with variables on both sides",
    channel: "Khan Academy",
    duration: "8:53",
    youtubeId: "f15zA0PhSek",
  },
  "equations-with-fractions": {
    id: "sv-fractions",
    title: "How To Solve Linear Equations With Fractions",
    channel: "The Organic Chemistry Tutor",
    duration: "5:36",
    youtubeId: "GYNK6NDNEFk",
  },
  "linear-inequalities": {
    id: "sv-inequalities",
    title: "Algebra Basics: Inequalities In Algebra",
    channel: "Math Antics",
    duration: "14:10",
    youtubeId: "RyesLifeUBw",
  },

  // Unit 3, Linear Equations & Graphs
  "coordinate-plane": {
    id: "sv-coordinate",
    title: "Algebra Basics: Graphing On The Coordinate Plane",
    channel: "Math Antics",
    duration: "10:14",
    youtubeId: "9Uc62CuQjc4",
  },
  slope: {
    id: "sv-slope",
    title: "Algebra Basics: Slope And Distance",
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
    title: "Finding intercepts from an equation",
    channel: "Khan Academy",
    duration: "4:08",
    youtubeId: "xGmef7lFc5w",
  },

  // Unit 4, Forms of Linear Equations
  "slope-intercept": {
    id: "sv-slope-intercept",
    title: "Slope-intercept form",
    channel: "Khan Academy",
    duration: "8:59",
    youtubeId: "IL3UCuXrUzE",
  },
  "point-slope": {
    id: "sv-point-slope",
    title: "Introduction to point-slope form",
    channel: "Khan Academy",
    duration: "6:07",
    youtubeId: "K_OI9LA54AA",
  },
  "standard-form": {
    id: "sv-standard-form",
    title: "Converting linear equations to slope-intercept form",
    channel: "Khan Academy",
    duration: "5:07",
    youtubeId: "V6Xynlqc_tc",
  },
  "parallel-perpendicular": {
    id: "sv-parallel",
    title: "Finding Slopes of Parallel and Perpendicular Lines (and Graphing)!",
    channel: "Mashup Math",
    duration: "5:07",
    youtubeId: "acsR7w0I__w",
  },

  // Unit 5, Systems of Equations
  "graphing-systems": {
    id: "sv-graph-systems",
    title: "Solving Systems of Equations By Graphing",
    channel: "The Organic Chemistry Tutor",
    duration: "5:14",
    youtubeId: "Pd4hwS8qHms",
  },
  substitution: {
    id: "sv-substitution",
    title: "The substitution method",
    channel: "Khan Academy",
    duration: "4:38",
    youtubeId: "uzyd_mIJaoc",
  },
  elimination: {
    id: "sv-elimination",
    title: "Addition elimination method 1",
    channel: "Khan Academy",
    duration: "3:38",
    youtubeId: "0P0SCQf-hWQ",
  },
  "systems-word-problems": {
    id: "sv-systems-word",
    title: "Systems of Linear Equations (Word Problems)",
    channel: "Mario's Math Tutoring",
    duration: "7:03",
    youtubeId: "zS6iXOZFkG4",
  },

  // Unit 6, Inequalities
  "graphing-inequalities": {
    id: "sv-graph-ineq",
    title: "Introduction to graphing inequalities",
    channel: "Khan Academy",
    duration: "8:03",
    youtubeId: "unSBFwK881s",
  },
  "compound-inequalities": {
    id: "sv-compound",
    title: "Compound inequalities",
    channel: "Khan Academy",
    duration: "4:31",
    youtubeId: "0YErxSShF0A",
  },
  "systems-inequalities": {
    id: "sv-systems-ineq",
    title: "Introduction to graphing systems of linear inequalities",
    channel: "Khan Academy",
    duration: "5:36",
    youtubeId: "CA4S7S-3Lg4",
  },

  // Unit 7, Functions
  "function-notation": {
    id: "sv-functions",
    title: "Evaluating Functions (Intro to Function Notation)",
    channel: "Mario's Math Tutoring",
    duration: "4:02",
    youtubeId: "_e0EdFGpcvc",
  },
  "domain-range": {
    id: "sv-domain",
    title: "How to find the domain of a rational function - domain and range",
    channel: "Brian McLogan",
    duration: "3:37",
    youtubeId: "5lYSYUmZZ78",
  },
  "function-graphs": {
    id: "sv-function-graphs",
    title: "Introduction to average rate of change",
    channel: "Khan Academy",
    duration: "5:31",
    youtubeId: "oT6LclcJ-I8",
  },

  // Unit 8, Sequences
  "arithmetic-sequences": {
    id: "sv-arithmetic",
    title: "How To Find The Nth Term of an Arithmetic Sequence",
    channel: "The Organic Chemistry Tutor",
    duration: "6:12",
    youtubeId: "PStn9zHgXHU",
  },
  "geometric-sequences": {
    id: "sv-geometric",
    title: "Geometric Sequence Formula",
    channel: "Mario's Math Tutoring",
    duration: "5:48",
    youtubeId: "3xbormMmuK4",
  },

  // Unit 9, Exponents & Radicals
  "exponent-rules": {
    id: "sv-exponents",
    title: "Algebra Basics: Laws Of Exponents",
    channel: "Math Antics",
    duration: "13:46",
    youtubeId: "LkhPRz7Hocg",
  },
  "negative-fractional-exponents": {
    id: "sv-neg-exponents",
    title: "Negative fractional exponent examples",
    channel: "Khan Academy",
    duration: "3:01",
    youtubeId: "tn53EdOr6Rw",
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
    title: "Simplifying Radicals Easy Method",
    channel: "Mario's Math Tutoring",
    duration: "3:41",
    youtubeId: "u2Z1hoXSrXk",
  },

  // Unit 10, Exponential Growth & Decay
  "exponential-functions": {
    id: "sv-exp-func",
    title: "Initial value & common ratio of exponential functions",
    channel: "Khan Academy",
    duration: "5:26",
    youtubeId: "G2WybA4Hf7Y",
  },
  "exponential-growth": {
    id: "sv-exp-growth",
    title: "Exponential Growth and Decay Word Problems & Functions - Algebra & Precalculus",
    channel: "The Organic Chemistry Tutor",
    duration: "12:49",
    youtubeId: "e5nwJKUc3bA",
  },
  "exponential-decay": {
    id: "sv-exp-decay",
    title: "Introduction to exponential decay",
    channel: "Khan Academy",
    duration: "8:11",
    youtubeId: "v4IdaXvyE7U",
  },

  // Unit 11, Quadratics: Factoring
  "multiplying-binomials": {
    id: "sv-multiply-binomials",
    title: "Example 1: Multiplying a binomial by a binomial",
    channel: "Khan Academy",
    duration: "5:47",
    youtubeId: "ZMLFfTX615w",
  },
  "special-products": {
    id: "sv-special-products",
    title: "Introduction to special products of binomials",
    channel: "Khan Academy",
    duration: "10:36",
    youtubeId: "bFtjG45-Udk",
  },
  "factoring-trinomials": {
    id: "sv-factor-trinomials",
    title: "Factoring Trinomials The Easy Fast Way",
    channel: "The Organic Chemistry Tutor",
    duration: "12:16",
    youtubeId: "-4jANGlJRSY",
  },
  "factoring-special": {
    id: "sv-factor-special",
    title: "Factoring Binomials & Trinomials - Special Cases",
    channel: "The Organic Chemistry Tutor",
    duration: "11:19",
    youtubeId: "6QQJoDshUt8",
  },

  // Unit 12, Quadratic Functions
  "graphing-parabolas": {
    id: "sv-parabolas",
    title: "Parabola vertex and axis of symmetry",
    channel: "Khan Academy",
    duration: "7:22",
    youtubeId: "dfoXtodyiIA",
  },
  "solving-by-factoring": {
    id: "sv-solve-factoring",
    title: "How To Solve Quadratic Equations By Factoring - Quick & Simple!",
    channel: "The Organic Chemistry Tutor",
    duration: "12:29",
    youtubeId: "qeByhTF8WEw",
  },
  "completing-square": {
    id: "sv-complete-square",
    title: "Completing the square for vertex form",
    channel: "Khan Academy",
    duration: "6:14",
    youtubeId: "02h9yhc7ruc",
  },
  "quadratic-formula": {
    id: "sv-quadratic-formula",
    title: "How To Solve Quadratic Equations Using The Quadratic Formula",
    channel: "The Organic Chemistry Tutor",
    duration: "5:55",
    youtubeId: "IlNAJl36-10",
  },

  // Unit 13, Absolute Value & Piecewise
  "absolute-value": {
    id: "sv-abs-value",
    title: "How To Solve Absolute Value Equations, Basic Introduction, Algebra",
    channel: "The Organic Chemistry Tutor",
    duration: "4:21",
    youtubeId: "_cHbhzQVd7Y",
  },
  "absolute-value-inequalities": {
    id: "sv-abs-ineq",
    title: "Absolute Value Inequalities - How to Solve",
    channel: "Mario's Math Tutoring",
    duration: "5:14",
    youtubeId: "dCA-XdjJ1MA",
  },
  "piecewise-functions": {
    id: "sv-piecewise",
    title: "How to evaluate a piecewise function (example)",
    channel: "Khan Academy",
    duration: "4:23",
    youtubeId: "hg2HR9zJFq4",
  },

  // Unit 14, Data & Statistics (checked live October 5, 2026)
  "center-spread": {
    id: "sv-center-spread",
    title: "Mean and standard deviation versus median and IQR",
    channel: "Khan Academy",
    duration: "7:58",
    youtubeId: "qNKOi08NxHs",
  },
  "trend-lines": {
    id: "sv-trend-lines",
    title: "Interpreting slope of regression line",
    channel: "Khan Academy",
    duration: "2:57",
    youtubeId: "PplggM0KtJ8",
  },
  "two-way-tables": {
    id: "sv-two-way-tables",
    title: "Two-way relative frequency tables",
    channel: "Khan Academy",
    duration: "4:27",
    youtubeId: "_ETPMszULXc",
  },

  // Unit 15, Modeling with Functions (checked live October 5, 2026)
  "literal-equations": {
    id: "sv-literal-equations",
    title: "Literal Equations (Solving for a Variable)",
    channel: "Mario's Math Tutoring",
    duration: "4:55",
    youtubeId: "GgCk-1C-EQI",
  },
  "function-transformations": {
    id: "sv-function-transformations",
    title: "Shifting functions introduction",
    channel: "Khan Academy",
    duration: "5:38",
    youtubeId: "RttvubuBhAE",
  },
  "linear-vs-exponential": {
    id: "sv-linear-vs-exponential",
    title: "Linear vs. exponential growth: from data",
    channel: "Khan Academy",
    duration: "5:56",
    youtubeId: "721RrH6auoU",
  },
};

export const BACKUP_VIDEOS: Record<string, Video> = {
  "unit-basics": {
    id: "sv-unit-basics-backup",
    title: "Unit conversion within the metric system",
    channel: "Khan Academy",
    duration: "9:17",
    youtubeId: "w0nqd_HXHPQ",
  },
  "one-step-equations": {
    id: "sv-one-step-backup",
    title: "Algebra Basics: Solving Basic Equations Part 2",
    channel: "Math Antics",
    duration: "9:34",
    youtubeId: "Qyd_v3DGzTM",
  },
  "multi-step-equations": {
    id: "sv-multi-step-backup",
    title: "How to simplify an expression by combining like terms and the distributive property",
    channel: "Khan Academy",
    duration: "4:07",
    youtubeId: "3NHSwiv_pSE",
  },
  "function-notation": {
    id: "sv-functions-backup",
    title: "Algebra Basics: What Are Functions?",
    channel: "Math Antics",
    duration: "11:34",
    youtubeId: "52tpYl2tTqk",
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
  // NOTE: deliberately no `origin` param. It depends on window.location, which
  // differs between the server render ("http://localhost:3000") and the real
  // client origin, that produced a React hydration mismatch on every lesson
  // page. The YouTube IFrame API attaches to the iframe by id (enablejsapi=1),
  // so the origin URL param isn't needed for playback tracking to work.
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`;
}
