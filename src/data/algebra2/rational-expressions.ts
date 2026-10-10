import type { Unit } from "@/types";
import { NO_VIDEO } from "@/data/algebra2/shared";

export const unit: Unit = {
  id: "rational-expressions",
  number: 4,
  title: "Rational Expressions & Equations",
  description: "Simplify, multiply and divide fractions with variables, and solve equations that have them.",
  icon: "",
  skills: [
    {
      id: "simplify-rational",
      title: "Simplify Rational Expressions",
      description: "Find the values a fraction with variables cannot take, factor top and bottom, and cancel what they share.",
      learningGoal: "State the excluded values of a rational expression, simplify it by factoring and canceling a common factor, and evaluate it at a given x.",
      keyIdea: "Factor the top and the bottom first; only whole factors cancel, and any x that makes the bottom 0 stays excluded.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-re-p1",
          type: "multiple-choice",
          prompt: "Which values of x are excluded from the domain of (x + 3)/(x² − 16)?",
          hint: "A fraction is undefined when its bottom is 0. Factor x² − 16 as a difference of squares and set each factor to 0.",
          answer: "x = -4 and x = 4",
          choices: ["x = -4 and x = 4", "x = 4", "x = -3", "x = -3, x = -4 and x = 4"],
          traps: [
            { value: "x = 4", why: "x² − 16 = (x − 4)(x + 4) has two factors, and each one can be 0." },
            { value: "x = -3", why: "x = -3 makes the top 0, which is fine: the fraction is just 0 there. Look at the bottom." },
            { value: "x = -3, x = -4 and x = 4", why: "Only values that make the bottom 0 are excluded. The top being 0 is allowed." },
          ],
          explanation: "x² − 16 = (x − 4)(x + 4) = 0 when x = 4 or x = -4, so those two values are excluded.",
        },
        {
          id: "a2-re-p2",
          type: "multiple-choice",
          prompt: "Simplify (x² + 7x + 12)/(x + 3).",
          hint: "Factor the top: find two numbers that multiply to 12 and add to 7. Then cancel the factor that matches the bottom.",
          answer: "x + 4",
          choices: ["x + 4", "x − 4", "x + 7", "x + 3"],
          traps: [
            { value: "x − 4", why: "The factors of x² + 7x + 12 are both plus: (x + 3)(x + 4)." },
            { value: "x + 7", why: "You cannot cancel the x² against the x. Factor the top first, then cancel a whole factor." },
            { value: "x + 3", why: "(x + 3) is the factor that cancels with the bottom. The other factor is what remains." },
          ],
          explanation: "(x² + 7x + 12)/(x + 3) = (x + 3)(x + 4)/(x + 3) = x + 4",
        },
      ],
    },
    {
      id: "multiply-divide-rational",
      title: "Multiply & Divide Rational Expressions",
      description: "Multiply fractions with variables across, flip to divide, and cancel matching factors before anything else.",
      learningGoal: "Multiply and divide rational expressions by factoring, flipping the divisor, and canceling common factors, then evaluate the simplified result.",
      keyIdea: "Dividing by a fraction is multiplying by its flip; cancel a factor that appears on a top and a bottom before multiplying.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-re-p3",
          type: "multiple-choice",
          prompt: "Multiply and simplify: (x + 2)/(x + 5) × (x + 5)/(x − 1)",
          hint: "Multiply tops together and bottoms together, then cancel any factor that appears on both.",
          answer: "(x + 2)/(x − 1)",
          choices: ["(x + 2)/(x − 1)", "(x − 1)/(x + 2)", "(x + 2)/(x + 5)", "(x + 5)/(x − 1)"],
          traps: [
            { value: "(x − 1)/(x + 2)", why: "Multiplying keeps tops on top and bottoms on the bottom; nothing flips." },
            { value: "(x + 2)/(x + 5)", why: "(x + 5) appears once on a top and once on a bottom, so it cancels." },
            { value: "(x + 5)/(x − 1)", why: "(x + 5) cancels; the factor left on top is the one that did not cancel." },
          ],
          explanation: "(x + 2)(x + 5) over (x + 5)(x − 1): cancel (x + 5) to get (x + 2)/(x − 1).",
        },
        {
          id: "a2-re-p4",
          type: "numeric",
          prompt: "Simplify (6x²/5) × (10/(3x)), then find its value when x = 7.",
          hint: "Multiply across: 60x² over 15x. Cancel the numbers and one x, then substitute.",
          answer: 28,
          traps: [
            { value: 4, why: "4x is the simplified expression. The question asks for its value at x = 7." },
            { value: 196, why: "One x on top cancels with the x on the bottom, so only one x is left." },
            { value: 14, why: "60 ÷ 15 is 4, not 2." },
          ],
          explanation: "(6x²/5) × (10/(3x)) = 60x²/(15x) = 4x, and 4 × 7 = 28.",
        },
      ],
    },
    {
      id: "rational-equations",
      title: "Rational Equations",
      description: "Clear the fractions, solve what is left, and throw out any answer that makes a bottom zero.",
      learningGoal: "Solve equations with x in a denominator by multiplying through, spot extraneous solutions, and model a shared-work situation with a rational equation.",
      keyIdea: "Multiply every term by the common denominator to clear the fractions, then check each answer against the original bottoms.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-re-p5",
          type: "numeric",
          prompt: "Solve 12/x + 1 = 4.",
          hint: "Get the fraction alone first: 12/x = 3. Then ask what x makes 12 divided by x equal 3.",
          answer: 4,
          traps: [
            { value: 36, why: "12/x = 3 means 12 ÷ x = 3. Divide, do not multiply." },
            { value: 2.4, why: "Subtract 1 from both sides before dealing with the fraction: 12/x = 3, not 5." },
            { value: 0.25, why: "That is 3/12, upside down. x = 12 ÷ 3." },
          ],
          explanation: "12/x + 1 = 4 → 12/x = 3 → 12 = 3x → x = 4",
        },
        {
          id: "a2-re-p6",
          type: "numeric",
          prompt: "Maya can paint a room in 3 hours and Kai can paint it in 6 hours. Working together, how many hours do they need? (round to the nearest tenth)",
          hint: "In one hour Maya does 1/3 of the room and Kai does 1/6. Together they do 1/3 + 1/6 of it per hour; the time is 1 over that.",
          answer: 2,
          decimalPlaces: 1,
          traps: [
            { value: 4.5, why: "Averaging the two times ignores that both are working at once; together they are faster than either alone." },
            { value: 9, why: "Working together takes less time than either person alone, not more." },
            { value: 0.5, why: "1/3 + 1/6 = 1/2 is the share of the room done per hour. The time is 1 divided by that." },
          ],
          explanation: "1/3 + 1/6 = 1/2 of the room per hour, so the whole room takes 1 ÷ (1/2) = 2 hours.",
        },
      ],
    },
  ],
};
