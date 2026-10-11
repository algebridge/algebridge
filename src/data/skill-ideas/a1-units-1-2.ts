import type { SkillIdeas } from "./types";

/** "Get the idea" for Algebra 1, units 1 and 2 (types.ts). */
export const IDEAS: SkillIdeas = {
  "unit-basics": {
    idea: "A unit says what you are measuring with: inches, feet, miles. Converting changes the unit and keeps the real amount the same. Since 1 inch and 2.54 centimeters are the same length, the fraction 2.54 cm / 1 in is worth exactly 1, and multiplying by 1 changes nothing real. Units on top and bottom cancel like matching numbers.",
    everyday: "A phone is 6 inches tall. With 1 in = 2.54 cm, 6 in × 2.54 cm / 1 in = 15.24 cm. Same phone, new unit.",
    picture: { kind: "chain", steps: ["6 in", "× 2.54 cm / 1 in", "inches cancel", "6 × 2.54 = 15.24 cm"] },
    caption: "The fraction in the middle is worth 1, so the phone's height stays the same. Only the unit changes, from inches to centimeters.",
    why: [
      "A fraction with the same length on top and bottom equals 1, and multiplying by 1 keeps the amount the same.",
      "Put the unit you have on the bottom so it cancels, and the unit you want on top so it stays.",
    ],
  },
  "dimensional-analysis": {
    idea: "Units act like numbers in a fraction: hours on top cancel hours on the bottom. So you can chain several conversions in a row, each one a fraction worth 1, and watch the units cancel until only the one you want is left. If the units come out wrong, one of the fractions is upside down.",
    everyday: "A 2-hour movie: 2 h × 60 min / 1 h = 120 min, then 120 min × 60 s / 1 min = 7,200 seconds of movie.",
    picture: { kind: "chain", steps: ["2 h", "× 60 min / 1 h", "120 min", "× 60 s / 1 min", "7,200 s"] },
    caption: "Each arrow multiplies by a fraction worth 1. Hours cancel first, then minutes, and seconds are what is left.",
    why: [
      "Every factor equals 1, so the amount of time never changes, only how it is written.",
      "Checking which units cancel tells you each fraction is the right way up before you do any arithmetic.",
    ],
  },
  "unit-word-problems": {
    idea: "A word problem gives amounts with units, like miles, gallons and dollars, and asks for an amount in another unit. Start with what you have, then use the rates in the story (miles per gallon, dollars per gallon) as fractions that turn one unit into the next. The units tell you whether to multiply or divide.",
    everyday: "A road trip is 150 miles, the car gets 30 miles per gallon, and gas is $3.50 a gallon. 150 ÷ 30 = 5 gallons, and 5 × $3.50 = $17.50 for gas.",
    picture: { kind: "chain", steps: ["150 mi", "× 1 gal / 30 mi", "5 gal", "× $3.50 / 1 gal", "$17.50"] },
    caption: "Miles cancel to give gallons, then gallons cancel to give dollars. Each rate from the story is one link in the chain.",
    why: [
      "A rate like 30 miles per gallon is a fraction, 30 mi / 1 gal, and you can flip it to 1 gal / 30 mi when you need gallons.",
      "Write the units on every number. If the leftover unit is the one the question asks for, the setup is right.",
    ],
  },
  "one-step-equations": {
    idea: "An equation is a balance: both sides weigh the same. In a one-step equation only one thing was done to x, like adding 8 or multiplying by 3. Do the opposite move to both sides and x stands alone: subtracting undoes adding, and dividing undoes multiplying.",
    everyday: "You had some money, got $8 for your birthday, and now have $20. That is x + 8 = 20. Take 8 away from both sides: you had $12.",
    picture: { kind: "balance", left: { x: 1, ones: 8 }, right: { ones: 20 }, solution: 12 },
    caption: "One box and eight 1s weigh as much as twenty 1s. Take eight 1s off each side and the box balances twelve 1s.",
    why: [
      "Each operation has an opposite that cancels it: plus 8 then minus 8 makes 0, and times 3 then divided by 3 gets back to the start.",
      "Doing the same move to both sides keeps the balance level, so the x you find makes the original equation true.",
    ],
  },
  "two-step-equations": {
    idea: "An equation is a balance: both sides weigh exactly the same. x is a box whose weight you have to find. Take the same thing off both sides and the balance stays level, so keep doing that until the box is alone on one side.",
    everyday: "A taxi charges $4 to start plus $3 a mile, and your ride cost $19. Take away the $4 start fee and $15 is left for the miles, so you rode 15 ÷ 3 = 5 miles.",
    picture: { kind: "balance", left: { x: 3, ones: 4 }, right: { ones: 19 }, solution: 5 },
    caption: "Three boxes and four 1s weigh as much as nineteen 1s. Take four 1s off each side, then share 15 between three boxes: each box is 5.",
    why: [
      "Doing the same thing to both sides keeps the balance level, so the answer stays the same at every step.",
      "Undo what was done to x in reverse order: x was tripled and then 4 was added, so first take away 4, then divide by 3.",
    ],
  },
  "multi-step-equations": {
    idea: "A multi-step equation is a balance that starts messy: brackets, several x terms, maybe x on both sides. First tidy each side by distributing and combining like terms. Then take the same boxes off both sides until x is on one side only, and finish it like a two-step equation.",
    everyday: "Phone plan A costs $10 plus $2 per GB, and plan B costs $4 plus $5 per GB. Solving 10 + 2g = 4 + 5g gives g = 2: at 2 GB both plans cost $14.",
    picture: { kind: "balance", left: { x: 2, ones: 10 }, right: { x: 5, ones: 4 }, solution: 2 },
    caption: "Take two boxes off each side: ten 1s balance three boxes and four 1s. Take four 1s off each side: six 1s balance three boxes, so each box is 2.",
    why: [
      "Distributing and combining like terms rewrite a side without changing its value, so the balance stays level.",
      "Taking the same number of x boxes off both sides is allowed for the same reason as taking off 1s: both sides lose the same weight.",
    ],
  },
  "equations-with-fractions": {
    idea: "A fraction of x is a part of it: x/2 is half of x and x/3 is a third. Fractions are awkward to add, so multiply every term on both sides by a number all the bottoms divide into. That scales the whole balance up evenly, every fraction turns into a whole number, and the answer stays the same.",
    everyday: "You spend half your allowance on food and a third on games, $25 in all. x/2 + x/3 = 25. Times 6: 3x + 2x = 150, so 5x = 150 and your allowance is $30.",
    picture: {
      kind: "tape",
      bars: [
        { label: "allowance $30", parts: [{ label: "half $15", value: 15 }, { label: "third $10", value: 10 }, { label: "left $5", value: 5 }] },
        {
          label: "in sixths",
          parts: [
            { label: "1/6", value: 5 },
            { label: "1/6", value: 5 },
            { label: "1/6", value: 5 },
            { label: "1/6", value: 5 },
            { label: "1/6", value: 5 },
            { label: "1/6", value: 5 },
          ],
        },
      ],
    },
    caption: "Cut the allowance into 6 equal pieces: half is 3 pieces and a third is 2 pieces. So 5 pieces are $25, each piece is $5, and the whole is $30.",
    why: [
      "Multiplying both sides by the same number keeps them equal, just like any other move on a balance.",
      "Use the least common denominator so every bottom divides into it and every fraction becomes a whole number.",
    ],
  },
  "linear-inequalities": {
    idea: "An inequality says one side is bigger or smaller, like 3n + 2 ≤ 20. Its answer is a whole stretch of numbers, drawn on a number line as a ray. Solve it like an equation, with one twist: multiplying or dividing by a negative flips the order of numbers, so the sign flips too.",
    everyday: "You have $20 for snacks at $3 each plus a $2 drink. 3n + 2 ≤ 20 gives 3n ≤ 18, so n ≤ 6: you can buy up to 6 snacks.",
    picture: { kind: "numberLine", min: 0, max: 10, marks: [{ at: 6, label: "n ≤ 6" }], ray: { from: 6, dir: "left", closed: true } },
    caption: "The filled dot at 6 means 6 itself works, and the ray to the left shows every amount below 6 works too.",
    why: [
      "Adding, subtracting, or multiplying and dividing by a positive move both sides the same way, so their order stays.",
      "Multiplying by a negative mirrors numbers across zero: 2 < 5 becomes -2 > -5, so the sign has to flip to stay true.",
    ],
  },
};
