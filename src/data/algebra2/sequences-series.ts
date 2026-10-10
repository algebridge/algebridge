import type { Unit } from "@/types";
import { NO_VIDEO } from "@/data/algebra2/shared";

export const unit: Unit = {
  id: "sequences-series",
  number: 7,
  title: "Sequences & Series",
  description: "Add up arithmetic and geometric sequences, and read sigma notation.",
  icon: "",
  skills: [
    {
      id: "arithmetic-series",
      title: "Arithmetic Series",
      description: "Add the first n terms of an arithmetic sequence with one formula instead of one term at a time.",
      learningGoal: "Find the sum of an arithmetic series from its first term, common difference and number of terms, and count the terms of a listed sum.",
      keyIdea: "The sum of an arithmetic series is the number of terms times the average of the first and last term: S = n(a₁ + aₙ)/2.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-as-p1",
          type: "numeric",
          prompt: "An arithmetic sequence has first term 4 and common difference 3. Find the sum of its first 10 terms.",
          hint: "Find the 10th term first: a₁₀ = 4 + 9 × 3. Then S = 10(a₁ + a₁₀)/2.",
          answer: 175,
          traps: [
            { value: 31, why: "That is the 10th term, not the sum of all ten." },
            { value: 350, why: "n(a₁ + aₙ) counts every pair twice. Divide by 2." },
          ],
          explanation: "a₁₀ = 4 + 9 × 3 = 31 → S = 10(4 + 31)/2 = 10 × 35/2 = 175",
        },
        {
          id: "a2-as-p2",
          type: "numeric",
          prompt: "Find the sum 3 + 7 + 11 + ... + 43.",
          hint: "Count the terms first: n = (43 − 3)/4 + 1. Then S = n(first + last)/2.",
          answer: 253,
          traps: [
            { value: 230, why: "The count is (last − first)/d + 1. The + 1 counts the first term." },
            { value: 506, why: "n(first + last) counts every pair twice. Divide by 2." },
          ],
          explanation: "n = (43 − 3)/4 + 1 = 11 → S = 11(3 + 43)/2 = 11 × 23 = 253",
        },
      ],
    },
    {
      id: "geometric-series",
      title: "Geometric Series",
      description: "Add the terms of a geometric sequence, and decide when an endless one still adds to a number.",
      learningGoal: "Find the sum of a finite geometric series, tell whether an infinite geometric series converges, and find its sum when it does.",
      keyIdea: "A finite geometric series sums to a₁(1 − rⁿ)/(1 − r); an infinite one converges only when |r| < 1, and then its sum is a₁/(1 − r).",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-gs-p1",
          type: "numeric",
          prompt: "A geometric sequence has first term 3 and common ratio 2. Find the sum of its first 5 terms.",
          hint: "S = a₁(1 − rⁿ)/(1 − r) with a₁ = 3, r = 2, n = 5. Or write out the five terms and add.",
          answer: 93,
          traps: [
            { value: 48, why: "That is the 5th term alone. The sum needs all five." },
            { value: 45, why: "The series has 5 terms, so use 2⁵ in the formula, not 2⁴." },
          ],
          explanation: "S = 3(1 − 2⁵)/(1 − 2) = 3(1 − 32)/(-1) = 3 × 31 = 93",
        },
        {
          id: "a2-gs-p2",
          type: "numeric",
          prompt: "An infinite geometric series has first term 6 and common ratio 1/3. Find its sum. (write as a fraction or decimal)",
          hint: "|1/3| < 1, so the series converges and S = a₁/(1 − r).",
          answer: 9,
          traps: [
            { value: 4.5, why: "The formula divides by 1 − r, not 1 + r." },
            { value: 18, why: "Divide a₁ by 1 − r; multiplying by 3 is dividing by r." },
          ],
          explanation: "S = 6/(1 − 1/3) = 6/(2/3) = 9",
        },
      ],
    },
    {
      id: "sigma-notation",
      title: "Sigma Notation",
      description: "Read and write sums with the Σ symbol: the index, where it starts, where it stops, and the rule for each term.",
      learningGoal: "Evaluate a sum written in sigma notation, write a listed sum in sigma notation, and count the terms a Σ adds.",
      keyIdea: "Σ from k = m to n of f(k) means: plug in every whole number from m to n, then add the results; that is n − m + 1 terms.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-sn-p1",
          type: "numeric",
          prompt: "Evaluate Σ from k = 1 to 5 of (2k + 1).",
          hint: "Plug in k = 1, 2, 3, 4, 5 to get five terms, then add them.",
          answer: 35,
          traps: [
            { value: 11, why: "That is only the last term (k = 5). Add all five terms." },
            { value: 30, why: "Every term includes the + 1. Five terms add five 1s." },
          ],
          explanation: "3 + 5 + 7 + 9 + 11 = 35",
        },
        {
          id: "a2-sn-p2",
          type: "numeric",
          prompt: "How many terms are in Σ from k = 3 to 12 of (k² − 1)?",
          hint: "Count every whole number from 3 to 12, including both ends.",
          answer: 10,
          traps: [
            { value: 9, why: "12 − 3 misses one end. Both k = 3 and k = 12 are terms." },
            { value: 12, why: "The index starts at 3, not 1." },
          ],
          explanation: "k runs 3, 4, ..., 12 → 12 − 3 + 1 = 10 terms",
        },
      ],
    },
  ],
};
