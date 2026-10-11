import type { SkillIdeas } from "./types";

/** "Get the idea" for Algebra 1, units 3 to 5 (types.ts). */
export const IDEAS: SkillIdeas = {
  "coordinate-plane": {
    idea: "The coordinate plane is a map made of two number lines that cross at 0, the origin. An ordered pair (x, y) is directions from there: x says how far to go right (left if it is negative), and y says how far to go up (down if it is negative). So (3, 2) means 3 right and 2 up, and order matters: (2, 3) is a different spot.",
    everyday: "In a game map with the spawn point at the center, a chest at (3, 2) is 3 squares east and 2 squares north. A friend at (-4, -1) is 4 squares west and 1 south, so the two of you are 7 squares apart going across.",
    picture: {
      kind: "graph",
      x: [-6, 6],
      y: [-6, 6],
      curves: [],
      points: [
        { x: 0, y: 0, label: "origin" },
        { x: 3, y: 2, label: "(3, 2)" },
        { x: 2, y: 3, label: "(2, 3)" },
        { x: -4, y: -1, label: "(-4, -1)" },
      ],
    },
    caption: "(3, 2) and (2, 3) use the same two numbers and land in different spots: x always comes first and moves you across, y comes second and moves you up.",
    why: [
      "Every point gets exactly one pair, and every pair names exactly one point, so a pair works as a precise address.",
      "Negative numbers point the other way: left for x, down for y.",
    ],
  },

  slope: {
    idea: "Slope is how steep a line is: how many steps it goes up for each one step to the right. You find it from two points: the rise is how much y changed, the run is how much x changed, and slope is rise ÷ run. A positive slope climbs, a negative slope falls, and a slope of 0 is flat.",
    everyday: "You have saved $20 by week 1 and $50 by week 4. The money rose $30 over 3 weeks, so the slope is 30 ÷ 3 = $10 a week: that is how fast your savings climb.",
    picture: {
      kind: "graph",
      x: [0, 6],
      y: [0, 70],
      curves: [{ f: "linear", m: 10, b: 10, label: "savings" }],
      points: [
        { x: 1, y: 20, label: "week 1: $20" },
        { x: 4, y: 50, label: "week 4: $50" },
      ],
    },
    caption: "From (1, 20) to (4, 50) the line goes 3 to the right and 30 up. Every single step right adds the same $10.",
    why: [
      "A straight line climbs at the same rate everywhere, so any two of its points give the same rise ÷ run.",
      "Subtract in the same order on top and bottom (second point minus first) so the sign of the slope comes out right.",
    ],
  },

  "graphing-lines": {
    idea: "y = mx + b is a recipe for drawing a line. b tells you where to start: the point (0, b) on the y-axis. m tells you how to step: go 1 right and m up (down if m is negative). Repeat the step, connect the dots, and every point you hit makes the equation true.",
    everyday: "A gym charges $10 to join plus $5 a visit, so the cost is y = 5x + 10 for x visits. Start at $10 with 0 visits, and each visit climbs $5: $15, $20, $25.",
    picture: {
      kind: "graph",
      x: [0, 6],
      y: [0, 45],
      curves: [{ f: "linear", m: 5, b: 10, label: "y = 5x + 10" }],
      points: [
        { x: 0, y: 10, label: "start (0, 10)" },
        { x: 1, y: 15, label: "(1, 15)" },
        { x: 2, y: 20, label: "(2, 20)" },
        { x: 3, y: 25, label: "(3, 25)" },
      ],
    },
    caption: "The line starts at 10 on the y-axis, and each step 1 to the right climbs 5. The dots line up because the climb is always the same.",
    why: [
      "Putting x = 0 into y = mx + b leaves y = b, so the line always crosses the y-axis at b.",
      "Adding 1 to x adds m to y, so each step right climbs by the slope.",
    ],
  },

  intercepts: {
    idea: "The intercepts are where a line crosses the two axes. On the x-axis the height is 0, so you find the x-intercept by putting y = 0. On the y-axis you are 0 steps across, so you find the y-intercept by putting x = 0. Two intercepts are two points, and two points are enough to draw the whole line.",
    everyday: "A $12 gift card buys songs at $3 and apps at $4, so 3x + 4y = 12. Spend it all on songs (y = 0) and you get 4 songs. Spend it all on apps (x = 0) and you get 3 apps.",
    picture: {
      kind: "graph",
      x: [-1, 6],
      y: [-1, 5],
      curves: [{ f: "linear", m: -0.75, b: 3, label: "3x + 4y = 12" }],
      points: [
        { x: 4, y: 0, label: "x-intercept (4, 0)" },
        { x: 0, y: 3, label: "y-intercept (0, 3)" },
      ],
    },
    caption: "The line meets the x-axis at (4, 0), where y is 0, and the y-axis at (0, 3), where x is 0. Those two points pin down the whole line.",
    why: [
      "Every point on the x-axis has y = 0 and every point on the y-axis has x = 0, so setting one of them to 0 lands you on that axis.",
      "With one variable gone, the equation has a single unknown left, which is quick to solve.",
    ],
  },

  "slope-intercept": {
    idea: "y = mx + b tells a line's whole story in two numbers. b is the starting value, where the line sits when x is 0. m is the rate, how much y changes each time x goes up by 1. Read those two numbers and you can picture the line before plotting a single point.",
    everyday: "A ride-share charges a $5 flat fee plus $2 a mile, so cost = 2x + 5. A 3-mile ride is 2 × 3 + 5 = $11, and a 7-mile ride is 2 × 7 + 5 = $19.",
    picture: {
      kind: "graph",
      x: [0, 8],
      y: [0, 25],
      curves: [{ f: "linear", m: 2, b: 5, label: "cost = 2x + 5" }],
      points: [
        { x: 0, y: 5, label: "fee: $5" },
        { x: 3, y: 11, label: "3 miles: $11" },
        { x: 7, y: 19, label: "7 miles: $19" },
      ],
    },
    caption: "The line starts at $5 on the cost axis, the fee you pay before any miles, and climbs $2 for every mile.",
    why: [
      "At x = 0 the mx part is 0, so y = b: the line crosses the y-axis at b.",
      "Each extra 1 in x adds m more to y, so m is the slope.",
    ],
  },

  "point-slope": {
    idea: "If you know one point on a line and how steep it is, you know the whole line. Point-slope form, y − y₁ = m(x − x₁), says exactly that: from the known point (x₁, y₁), move any distance across, x − x₁, and the line rises the slope times that distance, m(x − x₁). Any point that fits is on the line.",
    everyday: "A 4-mile taxi ride cost $14, and each extra mile adds $2. So cost − 14 = 2(miles − 4), and a 7-mile ride costs 14 + 2 × 3 = $20, with no need to know the starting fee first.",
    picture: {
      kind: "graph",
      x: [0, 8],
      y: [0, 25],
      curves: [{ f: "linear", m: 2, b: 6, label: "y − 14 = 2(x − 4)" }],
      points: [
        { x: 4, y: 14, label: "known (4, 14)" },
        { x: 7, y: 20, label: "(7, 20)" },
      ],
    },
    caption: "Start at the known point (4, 14). Going 3 miles farther right climbs 2 × 3 = 6, which reaches (7, 20).",
    why: [
      "Slope is rise over run between any two points, so (y − y₁) ÷ (x − x₁) = m, and multiplying both sides by the run gives y − y₁ = m(x − x₁).",
      "You skip finding the y-intercept: the known point does that job.",
    ],
  },

  "standard-form": {
    idea: "Standard form, Ax + By = C, puts both variables on one side and a total on the other. It reads like a budget: A for each of one thing plus B for each of another adds up to C. To graph it or read its slope, get y alone and it turns into y = mx + b.",
    everyday: "You have $20 for smoothies at $4 and cookies at $2: 4x + 2y = 20. Buy 2 smoothies and $12 is left, which is 6 cookies, since 4 × 2 + 2 × 6 = 20.",
    picture: {
      kind: "graph",
      x: [0, 6],
      y: [0, 12],
      curves: [{ f: "linear", m: -2, b: 10, label: "4x + 2y = 20" }],
      points: [
        { x: 5, y: 0, label: "5 smoothies" },
        { x: 0, y: 10, label: "10 cookies" },
        { x: 2, y: 6, label: "(2, 6)" },
      ],
    },
    caption: "Every point on the line spends exactly $20. One smoothie costs as much as 2 cookies, so the line drops 2 for each step right.",
    why: [
      "Subtracting Ax from both sides and then dividing every term by B keeps the equation true and gives y = (−A/B)x + C/B.",
      "So the slope is −A/B and the y-intercept is C/B: here −4/2 = −2 and 20/2 = 10.",
    ],
  },

  "parallel-perpendicular": {
    idea: "Two lines with the same slope climb at the same rate, so the gap between them never changes and they never meet: they are parallel. Turn a line a quarter turn and its rise and run swap places, and uphill becomes downhill. That is why perpendicular slopes are flipped with the sign changed, like 2 and -1/2, and multiply to -1.",
    everyday: "On a city map, streets drawn as y = 2x + 1 and y = 2x − 3 run side by side forever. A cross street drawn as y = -(1/2)x + 2 meets both of them at square corners.",
    picture: {
      kind: "graph",
      x: [-5, 5],
      y: [-5, 5],
      curves: [
        { f: "linear", m: 2, b: 1, label: "y = 2x + 1" },
        { f: "linear", m: 2, b: -3, label: "y = 2x − 3" },
        { f: "linear", m: -0.5, b: 2, label: "y = −(1/2)x + 2" },
      ],
    },
    caption: "The two lines with slope 2 never touch. The line with slope -1/2 crosses both of them at right angles.",
    why: [
      "Same slope means the same climb per step, so the distance between the lines stays fixed.",
      "A quarter turn changes a step of 1 right and 2 up into 2 left and 1 up, a slope of 1 ÷ (-2) = -1/2.",
    ],
  },

  "graphing-systems": {
    idea: "A system is two equations at once, and each one draws a line. A point on a line makes that line's equation true, so the point on both lines makes both equations true. That point is where the lines cross. Lines that cross once give one solution, parallel lines give none, and the same line drawn twice gives infinitely many.",
    everyday: "Plan A costs $10 a month plus $2 per movie. Plan B is $4 per movie with no fee. At 5 movies both cost $20, so that is where the cheaper plan switches.",
    picture: {
      kind: "graph",
      x: [0, 8],
      y: [0, 35],
      curves: [
        { f: "linear", m: 2, b: 10, label: "Plan A" },
        { f: "linear", m: 4, b: 0, label: "Plan B" },
      ],
      points: [{ x: 5, y: 20, label: "(5, 20)" }],
    },
    caption: "The lines cross at (5, 20): 5 movies cost $20 on both plans. Left of that point Plan B is cheaper, and right of it Plan A is.",
    why: [
      "Each line is every point that makes its equation true, so only the crossing point works for both.",
      "Reading the graph gives a good estimate; putting the point back into both equations proves it.",
    ],
  },

  substitution: {
    idea: "If one equation tells you exactly what a variable equals, like b = f + 3, you can swap that expression in wherever the variable shows up. It is like trading a $5 bill for five $1 bills: the value stays the same. The other equation then has only one unknown, and you can solve it.",
    everyday: "A burger costs $3 more than fries, and together they cost $11. Swap fries + 3 in for the burger: fries + fries + 3 = 11, so fries cost $4 and the burger costs $7.",
    picture: {
      kind: "chain",
      steps: ["b = f + 3 and b + f = 11", "(f + 3) + f = 11", "2f + 3 = 11", "2f = 8, so f = 4", "b = 4 + 3 = 7"],
    },
    caption: "The second step is the swap: b is replaced by f + 3, its exact value. After that, only f is left to find.",
    why: [
      "The two things are equal, so replacing one with the other keeps the equation true.",
      "Keep the swapped expression in brackets, so anything that multiplied the variable multiplies all of it.",
    ],
  },

  elimination: {
    idea: "Two equations are like two balanced scales. Adding or subtracting them keeps things balanced, because equal amounts go on both sides. If one variable shows up the same way in both, subtracting makes it vanish, and you are left with one equation and one unknown.",
    everyday: "3 tacos and 2 drinks cost $13. 3 tacos and 1 drink cost $11. The only difference is one drink, so a drink costs $13 − $11 = $2. Then 3 tacos cost $9, so each taco is $3.",
    picture: {
      kind: "tape",
      bars: [
        {
          label: "3 tacos + 2 drinks = $13",
          parts: [
            { label: "3 tacos: $9", value: 9 },
            { label: "drink: $2", value: 2 },
            { label: "drink: $2", value: 2 },
          ],
        },
        {
          label: "3 tacos + 1 drink = $11",
          parts: [
            { label: "3 tacos: $9", value: 9 },
            { label: "drink: $2", value: 2 },
          ],
        },
      ],
    },
    caption: "The 3 tacos are the same length in both bars, so taking one bar from the other leaves the extra drink: $13 − $11 = $2.",
    why: [
      "Adding or subtracting two true equations gives another true equation.",
      "When needed, multiply an equation first so one variable has matching or opposite numbers in both, and then it cancels.",
    ],
  },

  "systems-word-problems": {
    idea: "A word problem with two unknowns usually hands you two facts, and each fact becomes one equation. Name each unknown with a letter, then write one equation that counts things and one that counts value, like tickets and dollars. Solve the system and you have both answers.",
    everyday: "A school dance sold 50 tickets, $5 for students and $8 for guests, for $280. Then s + g = 50 and 5s + 8g = 280, which gives 40 students and 10 guests.",
    picture: {
      kind: "table",
      headers: ["guests", "students", "tickets", "money"],
      rows: [
        ["8", "42", "50", "$274"],
        ["9", "41", "50", "$277"],
        ["10", "40", "50", "$280"],
      ],
      note: "Each guest ticket in place of a student ticket adds $3, so the money climbs by 3 until it reaches $280.",
    },
    caption: "Every row keeps the ticket count at 50, and only one row also makes $280. That row answers both facts at once.",
    why: [
      "One equation alone has many answers, like every row of the table. A second fact narrows it to one.",
      "Put every amount in the same unit, all dollars or all cents, so the money equation adds like with like.",
    ],
  },
};
