import type { Video } from "@/types";

/**
 * One lesson video per Algebra 2 skill, keyed by skill id (the ids in the
 * unit files under src/data/algebra2/). Sourced on October 10, 2026 the same
 * way as src/data/videos.ts: each id came from a live YouTube search, was
 * kept only if its channel is on the trusted list (Khan Academy, Math Antics,
 * The Organic Chemistry Tutor, Mario's Math Tutoring, Brian McLogan,
 * Mashup Math, Professor Dave Explains, Eddie Woo, Krista King, PatrickJMT,
 * Mr. Dong's Math), then passed two live checks: oEmbed returned 200 with a
 * title and author (the channel written here), and the watch page carried
 * "playableInEmbed":true with a lengthSeconds between 1:00 and 15:00 (the
 * duration written here). Titles are YouTube's own, minus the channel name
 * and Khan Academy's course breadcrumb, with no em or en dashes.
 * No id serves two skills here or in Algebra 1. A skill with no entry shows
 * its key idea in place of a player (the player counts a video watched at
 * 85% of its length, so nothing longer than 15:00 is allowed).
 */
export const A2_VIDEOS: Record<string, Video> = {
  // Complex Numbers
  "imaginary-unit": {
    id: "a2v-imaginary-unit",
    title: "Introduction to i and imaginary numbers",
    channel: "Khan Academy",
    duration: "5:19",
    youtubeId: "ysVcAYo7UPI",
  },
  "complex-arithmetic": {
    id: "a2v-complex-arithmetic",
    title: "Complex Numbers Add, Subtract, Multiply, Divide",
    channel: "Mario's Math Tutoring",
    duration: "5:57",
    youtubeId: "OzU_1EwaF9Y",
  },
  "complex-roots": {
    id: "a2v-complex-roots",
    title: "Example: Complex roots for a quadratic",
    channel: "Khan Academy",
    duration: "10:15",
    youtubeId: "dnjK4DPqh0k",
  },

  // Polynomial Functions
  "polynomial-end-behavior": {
    id: "a2v-polynomial-end-behavior",
    title: "Polynomial end behavior",
    channel: "Khan Academy",
    duration: "8:10",
    youtubeId: "tZKzaF28sOk",
  },
  "polynomial-division": {
    id: "a2v-polynomial-division",
    title: "Intro to polynomial synthetic division",
    channel: "Khan Academy",
    duration: "4:59",
    youtubeId: "z7JiQ5etCZs",
  },
  "remainder-factor-theorem": {
    id: "a2v-remainder-factor-theorem",
    title: "Polynomial remainder theorem to test factor",
    channel: "Khan Academy",
    duration: "3:25",
    youtubeId: "JAdNNJynWM4",
  },

  // Quadratics Revisited
  "vertex-form": {
    id: "a2v-vertex-form",
    title: "Introduction to vertex form of a quadratic",
    channel: "Khan Academy",
    duration: "6:12",
    youtubeId: "_QqhuLixNEk",
  },
  "discriminant": {
    id: "a2v-discriminant",
    title: "Discriminant for types of solutions for a quadratic",
    channel: "Khan Academy",
    duration: "4:36",
    youtubeId: "1213qW5k55I",
  },
  "linear-quadratic-systems": {
    id: "a2v-linear-quadratic-systems",
    title: "Quadratic systems: a line and a parabola",
    channel: "Khan Academy",
    duration: "6:12",
    youtubeId: "Cy1Pxz_wLfA",
  },

  // Rational Expressions & Equations
  "simplify-rational": {
    id: "a2v-simplify-rational",
    title: "Simplifying rational expressions introduction",
    channel: "Khan Academy",
    duration: "7:27",
    youtubeId: "7Uos1ED3KHI",
  },
  "multiply-divide-rational": {
    id: "a2v-multiply-divide-rational",
    title: "Multiplying and dividing rational expressions 1",
    channel: "Khan Academy",
    duration: "3:37",
    youtubeId: "3GL69IA2q4s",
  },
  "rational-equations": {
    id: "a2v-rational-equations",
    title: "Solving rational equations 1",
    channel: "Khan Academy",
    duration: "4:12",
    youtubeId: "Yaeze9u6Cv8",
  },

  // Radicals & Rational Exponents
  "nth-roots": {
    id: "a2v-nth-roots",
    title: "Radical expressions with higher roots",
    channel: "Khan Academy",
    duration: "8:46",
    youtubeId: "iX7ivCww2ws",
  },
  "rational-exponents-evaluate": {
    id: "a2v-rational-exponents-evaluate",
    title: "Fractional exponents with numerators other than 1",
    channel: "Khan Academy",
    duration: "5:53",
    youtubeId: "S34NM0Po0eA",
  },
  "radical-equations": {
    id: "a2v-radical-equations",
    title: "Solving radical equations",
    channel: "Khan Academy",
    duration: "3:11",
    youtubeId: "pFFoAGIEyJc",
  },

  // Exponential & Logarithmic Functions
  "log-basics": {
    id: "a2v-log-basics",
    title: "Logarithms",
    channel: "Khan Academy",
    duration: "7:02",
    youtubeId: "Z5myJ8dg_rM",
  },
  "log-properties": {
    id: "a2v-log-properties",
    title: "Introduction to logarithm properties",
    channel: "Khan Academy",
    duration: "9:15",
    youtubeId: "PupNgv49_WY",
  },
  "solve-exponential-equations": {
    id: "a2v-solve-exponential-equations",
    title: "Solving exponential equation",
    channel: "Khan Academy",
    duration: "5:12",
    youtubeId: "7Ig6kVZaWoU",
  },

  // Sequences & Series
  "arithmetic-series": {
    id: "a2v-arithmetic-series",
    title: "Arithmetic series intro",
    channel: "Khan Academy",
    duration: "3:56",
    youtubeId: "cYw4MFWsB6c",
  },
  "geometric-series": {
    id: "a2v-geometric-series",
    title: "Formula for finite geometric series",
    channel: "Khan Academy",
    duration: "5:45",
    youtubeId: "Naf6_lRRdyM",
  },
  "sigma-notation": {
    id: "a2v-sigma-notation",
    title: "Sigma notation for sums",
    channel: "Khan Academy",
    duration: "4:26",
    youtubeId: "5jwXThH6fg4",
  },

  // Trigonometry
  "radians-degrees": {
    id: "a2v-radians-degrees",
    title: "Radian and degree conversion practice",
    channel: "Khan Academy",
    duration: "7:11",
    youtubeId: "z8vj8tUCkxY",
  },
  "unit-circle-values": {
    id: "a2v-unit-circle-values",
    title: "Introduction to the unit circle",
    channel: "Khan Academy",
    duration: "9:04",
    youtubeId: "1m9p9iubMLU",
  },
  "reference-angles": {
    id: "a2v-reference-angles",
    title: "Identifying reference angles of positive angles in standard position",
    channel: "Khan Academy",
    duration: "4:36",
    youtubeId: "DUNQsJAJZOU",
  },
};
