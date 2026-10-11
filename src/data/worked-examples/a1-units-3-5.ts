import type { WorkedExamples } from "./types";

/*
 * Algebra 1, units 3 to 5: the coordinate plane, lines, and systems.
 * One example per kind of card each skill's generator deals, each card
 * written the way that generator writes it, so the skill's solver checks it.
 */
export const EXAMPLES: WorkedExamples = {
  "coordinate-plane": [
    {
      kind: "Distance along a horizontal line",
      card: { type: "numeric", prompt: "How far apart are the points (-3, 4) and (5, 4)?", answer: 8 },
      steps: [
        { work: "the y-values are both 4, so count along the x-axis: 5 − (-3)", why: "Points on a flat line only differ in x." },
        { work: "5 − (-3) = 5 + 3", why: "Subtracting a negative is the same as adding." },
        { work: "5 + 3 = 8", why: "Add to get the distance." },
      ],
      answer: "8",
    },
    {
      kind: "Finding a midpoint",
      card: {
        type: "multiple-choice",
        prompt: "What is the midpoint of (-4, 1) and (6, 7)?",
        answer: "(1, 4)",
        choices: ["(1, 4)", "(4, 1)", "(10, 6)", "(2, 8)"],
      },
      steps: [
        { work: "x: (-4 + 6) ÷ 2 = 1", why: "The midpoint averages the x-values: add them, divide by 2." },
        { work: "y: (1 + 7) ÷ 2 = 4", why: "Average the y-values the same way." },
        { work: "the midpoint is (1, 4)", why: "A point is written x first, then y." },
      ],
      answer: "(1, 4)",
    },
    {
      kind: "Reflecting across an axis",
      card: {
        type: "multiple-choice",
        prompt: "Reflect the point (3, -5) across the x-axis. Where does it land?",
        answer: "(3, 5)",
        choices: ["(3, 5)", "(-3, -5)", "(-3, 5)", "(-5, 3)"],
      },
      steps: [
        { work: "across the x-axis, y changes sign and x stays the same", why: "Flipping top to bottom only changes the y-value." },
        { work: "y: -5 becomes 5, x stays 3", why: "Change the sign of y only." },
        { work: "the point lands on (3, 5)", why: "Write the new point, x first." },
      ],
      answer: "(3, 5)",
    },
    {
      kind: "Sliding a point",
      card: {
        type: "multiple-choice",
        prompt: "Start at (2, -1). Move 3 units left and 4 units up. Where do you land?",
        answer: "(-1, 3)",
        choices: ["(-1, 3)", "(5, 3)", "(-1, -5)", "(6, -4)"],
      },
      steps: [
        { work: "x: 2 − 3 = -1", why: "Left takes away from x." },
        { work: "y: -1 + 4 = 3", why: "Up adds to y." },
        { work: "(-1, 3)", why: "Put the new x and y together." },
      ],
      answer: "(-1, 3)",
    },
    {
      kind: "Area of a rectangle on the grid",
      card: {
        type: "numeric",
        prompt: "Three corners of a rectangle are (-2, 3), (4, 3), and (4, -1). What is the rectangle's area?",
        answer: 24,
      },
      steps: [
        { work: "width = 4 − (-2) = 6", why: "A side's length is the bigger x minus the smaller x." },
        { work: "height = 3 − (-1) = 4", why: "Do the same with the y-values." },
        { work: "area = 6 × 4 = 24", why: "Area of a rectangle is width times height." },
      ],
      answer: "24",
    },
    {
      kind: "The missing corner of a rectangle",
      card: {
        type: "multiple-choice",
        prompt: "Three corners of a rectangle are (-2, 3), (4, 3), and (4, -1). What is the fourth corner?",
        answer: "(-2, -1)",
        choices: ["(-2, -1)", "(-1, -2)", "(4, 3)", "(-2, 3)"],
      },
      steps: [
        { work: "the x-values used are -2 and 4", why: "A grid rectangle uses only two x-values." },
        { work: "the y-values used are -1 and 3", why: "It also uses only two y-values." },
        { work: "among the three corners, x = -2 shows up once and y = -1 shows up once", why: "Each value appears twice once all four corners are there." },
        { work: "the fourth corner is (-2, -1)", why: "Pair the x and the y that are short one use." },
      ],
      answer: "(-2, -1)",
    },
    {
      kind: "Naming a point's quadrant",
      card: {
        type: "multiple-choice",
        prompt: "In which quadrant is the point (-3, 5)?",
        answer: "Quadrant II",
        choices: ["Quadrant I", "Quadrant II", "Quadrant III", "Quadrant IV"],
      },
      steps: [
        { work: "x = -3 is negative", why: "A negative x is left of the y-axis." },
        { work: "y = 5 is positive", why: "A positive y is above the x-axis." },
        { work: "(−, +) is Quadrant II", why: "Quadrants count counterclockwise from (+, +), Quadrant I." },
      ],
      answer: "Quadrant II",
    },
  ],

  slope: [
    {
      kind: "Slope from two points",
      card: {
        type: "numeric",
        prompt: "Find the slope between (1, 2) and (4, 8). Give it as a whole number or a fraction.",
        answer: 2,
      },
      steps: [
        { work: "rise = 8 − 2 = 6", why: "The rise is the change in y." },
        { work: "run = 4 − 1 = 3", why: "The run is the change in x, same order." },
        { work: "m = 6/3 = 2", why: "Slope is rise over run." },
      ],
      answer: "2",
    },
    {
      kind: "Slope from a table",
      card: {
        type: "numeric",
        prompt: "A table lists points on a line. When x is 0, 2, 4, 6, y is 5, 8, 11, 14. What is the slope? Give it as a whole number or a fraction.",
        answer: 1.5,
      },
      steps: [
        { work: "take two points from the table: (0, 5) and (2, 8)", why: "Any two rows of the table are points on the line." },
        { work: "change in y = 8 − 5 = 3", why: "Subtract the y-values." },
        { work: "change in x = 2", why: "Subtract the x-values in the same order." },
        { work: "slope = 3/2", why: "Slope is the change in y over the change in x." },
      ],
      answer: "3/2",
    },
    {
      kind: "A vertical line's slope",
      card: {
        type: "multiple-choice",
        prompt: "What is the slope of the line through (2, -1) and (2, 4)?",
        answer: "Undefined",
        choices: ["Undefined", "0", "5", "1/5"],
      },
      steps: [
        { work: "rise = 4 − (-1) = 5", why: "The rise is the change in y." },
        { work: "the x-values are both 2, so the run is 0", why: "Matching x-values mean no change in x." },
        { work: "slope = 5/0, and dividing by 0 is undefined: the line is vertical", why: "You can never divide by zero." },
      ],
      answer: "Undefined",
    },
    {
      kind: "A rate of change in a story",
      card: {
        type: "numeric",
        prompt: "A plant was 6 cm tall on day 2 and 15 cm tall on day 8. How many centimeters did it grow per day? Write your answer as a decimal.",
        answer: 1.5,
      },
      steps: [
        { work: "change in height = 15 − 6 = 9 cm", why: "Find how much the height changed." },
        { work: "change in days = 8 − 2 = 6", why: "Find how many days passed." },
        { work: "9 ÷ 6 = 1.5 cm per day", why: "A rate per day is change in height over change in days." },
      ],
      answer: "1.5",
    },
    {
      kind: "A missing coordinate from the slope",
      card: { type: "numeric", prompt: "The line through (1, 3) and (5, k) has slope 3/2. What is k?", answer: 9 },
      steps: [
        { work: "run = 5 − 1 = 4", why: "The run is how far x moves." },
        { work: "rise = 3/2 × 4 = 6", why: "Rise equals slope times run." },
        { work: "k = 3 + 6 = 9", why: "Add the rise to the starting y-value." },
      ],
      answer: "9",
    },
    {
      kind: "A negative rate as a fraction",
      card: {
        type: "numeric",
        prompt: "A car's gas tank held 15 gallons at mile 100 and 11 gallons at mile 220. What is the rate of change of the gas, in gallons per mile? Give it as a fraction.",
        answer: -1 / 30,
      },
      steps: [
        { work: "change in gas = 11 − 15 = -4 gallons", why: "The gas went down, so the change is negative." },
        { work: "change in miles = 220 − 100 = 120", why: "Find how many miles were driven." },
        { work: "-4/120 = -1/30 gallon per mile", why: "Rate is gallons over miles; simplify the fraction." },
      ],
      answer: "-1/30",
    },
    {
      kind: "A horizontal line's slope",
      card: {
        type: "multiple-choice",
        prompt: "What is the slope of the line through (1, 3) and (5, 3)?",
        answer: "0",
        choices: ["0", "Undefined", "4", "-4"],
      },
      steps: [
        { work: "the y-values are both 3, so the rise is 0", why: "Matching y-values mean no change in y." },
        { work: "run = 5 − 1 = 4", why: "The run is the change in x." },
        { work: "slope = 0/4 = 0: the line is horizontal", why: "Zero divided by any number is zero." },
      ],
      answer: "0",
    },
    {
      kind: "A missing x-coordinate from the slope",
      card: { type: "numeric", prompt: "The line through (2, 1) and (k, 7) has slope 3. What is k?", answer: 4 },
      steps: [
        { work: "rise = 7 − 1 = 6", why: "The rise is the change in y." },
        { work: "run = 6 ÷ 3 = 2", why: "Slope is rise over run, so run is rise over slope." },
        { work: "k = 2 + 2 = 4", why: "Add the run to the starting x-value." },
      ],
      answer: "4",
    },
  ],

  "graphing-lines": [
    {
      kind: "Reading the y-intercept",
      card: {
        type: "multiple-choice",
        prompt: "What is the y-intercept of y = 3x − 5?",
        answer: "-5",
        choices: ["-5", "3", "5", "-2"],
      },
      steps: [
        { work: "y = 3x − 5 is in the form y = mx + b", why: "In y = mx + b, b is the y-intercept." },
        { work: "m = 3 is the slope and b = -5 is the y-intercept", why: "The number alone keeps its own sign." },
        { work: "the line crosses the y-axis at (0, -5), so the y-intercept is -5", why: "At the y-axis, x is 0." },
      ],
      answer: "-5",
    },
    {
      kind: "Finding y for a given x",
      card: { type: "numeric", prompt: "For y = -2x + 7, what is y when x = 3?", answer: 1 },
      steps: [
        { work: "put 3 in for x: y = -2(3) + 7", why: "Replace x with its value." },
        { work: "multiply first: -2(3) = -6", why: "Order of operations: multiply before adding." },
        { work: "then add: -6 + 7 = 1", why: "Finish with the addition." },
      ],
      answer: "1",
    },
    {
      kind: "Finding x for a given y",
      card: { type: "numeric", prompt: "The point (a, 11) is on the line y = 2x + 5. What is a?", answer: 3 },
      steps: [
        { work: "put 11 in for y: 11 = 2a + 5", why: "The point's y-value goes in for y." },
        { work: "take 5 from both sides: 6 = 2a", why: "Undo adding 5 by subtracting 5." },
        { work: "a = 6 ÷ 2 = 3", why: "Undo multiplying by 2 by dividing by 2." },
      ],
      answer: "3",
    },
    {
      kind: "Where a line crosses the x-axis",
      card: { type: "numeric", prompt: "Where does the line y = (2/3)x − 4 cross the x-axis? Type the x-value.", answer: 6 },
      steps: [
        { work: "on the x-axis y = 0: 0 = (2/3)x − 4", why: "Every point on the x-axis has y = 0." },
        { work: "move the 4 across, changing its sign: (2/3)x = 4", why: "Add 4 to both sides." },
        { work: "multiply by the reciprocal 3/2: x = 4 × 3/2 = 6", why: "Multiplying by the flipped fraction undoes the fraction." },
      ],
      answer: "6",
    },
    {
      kind: "Following the slope from the y-intercept",
      card: {
        type: "multiple-choice",
        prompt: "Start at the y-intercept of y = (3/2)x − 1 and follow the slope for two steps, each one 2 to the right and 3 up. Where do you end up?",
        answer: "(4, 5)",
        choices: ["(4, 5)", "(2, 2)", "(6, 3)", "(4, 6)"],
      },
      steps: [
        { work: "start at the y-intercept, (0, -1)", why: "The y-intercept is where x is 0." },
        { work: "first step: 2 right and 3 up lands on (2, 2)", why: "The run moves x and the rise moves y." },
        { work: "second step: 2 right and 3 up again lands on (4, 5)", why: "Repeat the same run and rise." },
      ],
      answer: "(4, 5)",
    },
    {
      kind: "Checking which point is on a line",
      card: {
        type: "multiple-choice",
        prompt: "Which point is on the line y = 2x − 3?",
        answer: "(4, 5)",
        choices: ["(4, 5)", "(5, 4)", "(4, 7)", "(-4, 5)"],
      },
      steps: [
        { work: "put x = 4 into the equation: y = 2(4) − 3 = 8 − 3 = 5", why: "A point is on the line when its x gives its y." },
        { work: "the point on the line with x = 4 has y = 5, so it is (4, 5)", why: "Match the y that comes out to a choice." },
      ],
      answer: "(4, 5)",
    },
  ],

  intercepts: [
    {
      kind: "The x-intercept from standard form",
      card: { type: "numeric", prompt: "Find the x-intercept of 3x + 2y = 12. Type its x-value.", answer: 4 },
      steps: [
        { work: "at the x-intercept y = 0, so the y-term drops out: 3x = 12", why: "On the x-axis, y is 0." },
        { work: "x = 12 ÷ 3 = 4, so the x-intercept is (4, 0)", why: "Divide both sides by 3." },
      ],
      answer: "4",
    },
    {
      kind: "The y-intercept from standard form",
      card: { type: "numeric", prompt: "Find the y-intercept of 4x − 5y = 20. Type its y-value.", answer: -4 },
      steps: [
        { work: "at the y-intercept x = 0, so the x-term drops out: -5y = 20", why: "On the y-axis, x is 0." },
        { work: "y = 20 ÷ (-5) = -4, so the y-intercept is (0, -4)", why: "Divide by -5, keeping the sign." },
      ],
      answer: "-4",
    },
    {
      kind: "The triangle a line cuts off",
      card: {
        type: "numeric",
        prompt: "The line 3x + 4y = 12 makes a triangle with the x-axis and the y-axis. What is the triangle's area?",
        answer: 6,
      },
      steps: [
        { work: "x-intercept: set y = 0, so 3x = 12", why: "The x-intercept gives the base." },
        { work: "x = 12 ÷ 3 = 4, the base", why: "Divide to solve for x." },
        { work: "y-intercept: set x = 0, so 4y = 12", why: "The y-intercept gives the height." },
        { work: "y = 12 ÷ 4 = 3, the height", why: "Divide to solve for y." },
        { work: "area = ½ × 4 × 3 = 6", why: "Triangle area is half of base times height." },
      ],
      answer: "6",
    },
    {
      kind: "Slope from the two intercepts",
      card: {
        type: "numeric",
        prompt: "A line crosses the x-axis at (4, 0) and the y-axis at (0, 6). What is its slope? Give it as a whole number or a fraction.",
        answer: -1.5,
      },
      steps: [
        { work: "from (4, 0) to (0, 6), y goes from 0 to 6: change in y = 6", why: "The intercepts are two points on the line." },
        { work: "change in x = 0 − 4 = -4", why: "Subtract the x-values in the same order." },
        { work: "m = 6/-4 = -3/2", why: "Slope is rise over run, simplified." },
      ],
      answer: "-3/2",
    },
  ],

  "slope-intercept": [
    {
      kind: "Writing y = mx + b from m and b",
      card: {
        type: "multiple-choice",
        prompt: "Which equation has slope -2 and y-intercept 5?",
        answer: "y = -2x + 5",
        choices: ["y = -2x + 5", "y = 5x − 2", "y = 2x + 5", "y = -2x − 5"],
      },
      steps: [
        { work: "slope-intercept form is y = mx + b", why: "m is the slope and b is the y-intercept." },
        { work: "the slope m = -2 multiplies x: y = -2x + b", why: "The slope goes in front of x." },
        { work: "the y-intercept b = 5 goes on the end: y = -2x + 5", why: "The y-intercept is the number alone." },
      ],
      answer: "y = -2x + 5",
    },
    {
      kind: "The y-intercept from a slope and a point",
      card: { type: "numeric", prompt: "A line has slope 3 and passes through (2, 4). What is its y-intercept?", answer: -2 },
      steps: [
        { work: "4 = 3(2) + b", why: "Put the point and the slope into y = mx + b." },
        { work: "4 = 6 + b", why: "Multiply the slope by x." },
        { work: "b = 4 − 6 = -2", why: "Subtract 6 from both sides." },
      ],
      answer: "-2",
    },
    {
      kind: "The equation from two points",
      card: {
        type: "multiple-choice",
        prompt: "A line passes through (1, 5) and (3, 9). Which equation is it?",
        answer: "y = 2x + 3",
        choices: ["y = 2x + 3", "y = 2x + 5", "y = -2x + 3", "y = 2x − 3"],
      },
      steps: [
        { work: "m = (9 − 5) ÷ (3 − 1) = 4 ÷ 2 = 2", why: "Slope is change in y over change in x." },
        { work: "put (1, 5) into y = mx + b: 5 = 2(1) + b", why: "Use one point to find b." },
        { work: "5 = 2 + b, so b = 5 − 2 = 3", why: "Subtract 2 from both sides." },
        { work: "y = 2x + 3", why: "Write the slope and intercept into the form." },
      ],
      answer: "y = 2x + 3",
    },
    {
      kind: "Slope after rewriting standard form",
      card: {
        type: "numeric",
        prompt: "Rewrite 4x + 2y = 6 in slope-intercept form. What is the slope? Give it as a whole number or a fraction.",
        answer: -2,
      },
      steps: [
        { work: "move the x term across, changing its sign: 2y = -4x + 6", why: "Subtract 4x from both sides." },
        { work: "divide every term by 2: y = -2x + 3", why: "Get y by itself; every term is divided." },
        { work: "the number multiplying x is the slope: -2", why: "In y = mx + b, m is the slope." },
      ],
      answer: "-2",
    },
    {
      kind: "A flat fee as the intercept",
      card: {
        type: "numeric",
        prompt: "A ride-share charges a flat fee plus a price per mile. A 3-mile ride costs $11, and a 7-mile ride costs $19. What is the flat fee, in dollars?",
        answer: 5,
      },
      steps: [
        { work: "per mile = (19 − 11) ÷ (7 − 3) = 8 ÷ 4 = 2", why: "The price per mile is the slope." },
        { work: "put the 3-mile ride into cost = 2(miles) + b: 11 = 2(3) + b", why: "Use one ride to find the intercept." },
        { work: "11 = 6 + b, so b = 11 − 6 = 5", why: "Subtract 6 from both sides." },
      ],
      answer: "5",
    },
    {
      kind: "Writing a line from a story",
      card: {
        type: "multiple-choice",
        prompt: "A pool holds 600 gallons of water and drains 25 gallons each minute. Which equation gives g, the gallons left after t minutes?",
        answer: "g = -25t + 600",
        choices: ["g = -25t + 600", "g = 25t + 600", "g = -600t + 25", "g = 600t − 25"],
      },
      steps: [
        { work: "at t = 0 the pool holds 600 gallons: that is the intercept", why: "The starting amount is the y-intercept." },
        { work: "it loses 25 gallons each minute, so the slope is -25", why: "Draining takes water away, so the rate is negative." },
        { work: "g = (slope)t + (intercept): g = -25t + 600", why: "Slope-intercept form puts the rate on t." },
      ],
      answer: "g = -25t + 600",
    },
    {
      kind: "Sharing a y-intercept",
      card: {
        type: "multiple-choice",
        prompt: "Which line has the same y-intercept as y = 4x − 3 and passes through (2, 1)?",
        answer: "y = 2x − 3",
        choices: ["y = 2x − 3", "y = 4x + 1", "y = -2x − 3", "y = 2x + 3"],
      },
      steps: [
        { work: "the y-intercept of y = 4x − 3 is -3, so the new line is y = mx − 3", why: "Only the y-intercept is shared." },
        { work: "put (2, 1) in: 1 = m(2) − 3", why: "The point must make the equation true." },
        { work: "add 3 to both sides: 2m = 4", why: "Undo subtracting 3." },
        { work: "m = 4 ÷ 2 = 2", why: "Divide to find the slope." },
        { work: "y = 2x − 3", why: "Write the slope and intercept into the form." },
      ],
      answer: "y = 2x − 3",
    },
  ],

  "point-slope": [
    {
      kind: "Point-slope form from a point and a slope",
      card: {
        type: "multiple-choice",
        prompt: "Which equation is the line through (2, -3) with slope 4, written in point-slope form?",
        answer: "y + 3 = 4(x − 2)",
        choices: ["y + 3 = 4(x − 2)", "y − 2 = 4(x + 3)", "y + 3 = -4(x − 2)", "y − 3 = 4(x + 2)"],
      },
      steps: [
        { work: "point-slope form is y − y₁ = m(x − x₁), with x₁ = 2, y₁ = -3, m = 4", why: "The point's x and y each go in their own place." },
        { work: "put them in: y − (-3) = 4(x − 2)", why: "Replace y₁, m, and x₁." },
        { work: "a minus of a negative turns into a plus: y + 3 = 4(x − 2)", why: "Subtracting a negative is the same as adding." },
      ],
      answer: "y + 3 = 4(x − 2)",
    },
    {
      kind: "Point-slope form from two points",
      card: {
        type: "multiple-choice",
        prompt: "Which equation is the line through (1, 2) and (3, 8), in point-slope form with the first point?",
        answer: "y − 2 = 3(x − 1)",
        choices: ["y − 2 = 3(x − 1)", "y − 2 = -3(x − 1)", "y + 2 = 3(x + 1)", "y − 1 = 3(x − 2)"],
      },
      steps: [
        { work: "m = (8 − 2) ÷ (3 − 1) = 6 ÷ 2 = 3", why: "Slope is change in y over change in x." },
        { work: "use y − y₁ = m(x − x₁) with the first point: x₁ = 1, y₁ = 2, m = 3", why: "The question asks for the first point." },
        { work: "y − 2 = 3(x − 1)", why: "Put the numbers into the form." },
      ],
      answer: "y − 2 = 3(x − 1)",
    },
    {
      kind: "The y-intercept from point-slope form",
      card: { type: "numeric", prompt: "A line is written y − 4 = 2(x + 3). What is its y-intercept?", answer: 10 },
      steps: [
        { work: "distribute the 2: y − 4 = 2x + 6", why: "Multiply 2 by each term in the bracket." },
        { work: "move the 4 across, changing its sign: y = 2x + 10", why: "Add 4 to both sides to get y alone." },
        { work: "the constant left over is the y-intercept: 10", why: "In y = mx + b, b is the y-intercept." },
      ],
      answer: "10",
    },
    {
      kind: "A y-value from point-slope form",
      card: { type: "numeric", prompt: "A line is written y − 1 = (2/3)(x − 3). What is y when x = 9?", answer: 5 },
      steps: [
        { work: "put 9 in for x: y − 1 = (2/3)(9 − 3)", why: "Replace x with its value." },
        { work: "9 − 3 = 6, and (2/3)(6) = 4: y − 1 = 4", why: "Work out the bracket first, then multiply." },
        { work: "move the 1 across, changing its sign: y = 5", why: "Add 1 to both sides." },
      ],
      answer: "5",
    },
    {
      kind: "Where the line crosses the x-axis",
      card: {
        type: "numeric",
        prompt: "A line passes through (4, 6) with slope 2. Where does it cross the x-axis? Type the x-value.",
        answer: 1,
      },
      steps: [
        { work: "point-slope form with y = 0: 0 − 6 = 2(x − 4)", why: "On the x-axis, y is 0." },
        { work: "distribute: -6 = 2x − 8", why: "Multiply 2 by each term in the bracket." },
        { work: "move the 8 across, changing its sign: 2x = 2", why: "Add 8 to both sides." },
        { work: "x = 2 ÷ 2 = 1", why: "Divide by the slope's 2." },
      ],
      answer: "1",
    },
  ],

  "standard-form": [
    {
      kind: "Standard form to slope-intercept form",
      card: {
        type: "multiple-choice",
        prompt: "Convert 6x + 3y = 9 to slope-intercept form.",
        answer: "y = -2x + 3",
        choices: ["y = -2x + 3", "y = 2x + 3", "y = -2x + 9", "y = 3x − 2"],
      },
      steps: [
        { work: "subtract 6x from both sides: 3y = -6x + 9", why: "Move the x term to the other side." },
        { work: "divide every term by 3: y = -2x + 3", why: "Get y by itself; every term is divided." },
      ],
      answer: "y = -2x + 3",
    },
    {
      kind: "The slope of a line in standard form",
      card: {
        type: "numeric",
        prompt: "What is the slope of the line 3x + 4y = 8? Give it as a whole number or a fraction.",
        answer: -0.75,
      },
      steps: [
        { work: "move the x term across, changing its sign: 4y = -3x + 8", why: "Subtract 3x from both sides." },
        { work: "divide every term by 4: the x term becomes -(3/4)x", why: "Get y by itself." },
        { work: "the number multiplying x is the slope: -3/4", why: "In y = mx + b, m is the slope." },
      ],
      answer: "-3/4",
    },
    {
      kind: "Using a standard-form equation in a story",
      card: {
        type: "numeric",
        prompt: "Adult tickets cost $9 and student tickets cost $5. Ticket sales came to $230, so 9a + 5s = 230. If 15 adult tickets were sold, how many student tickets were sold?",
        answer: 19,
      },
      steps: [
        { work: "put 15 in for a: 9(15) + 5s = 230", why: "Replace the known count." },
        { work: "9 × 15 = 135: 135 + 5s = 230", why: "Multiply first." },
        { work: "take 135 from both sides: 5s = 95", why: "Undo adding 135." },
        { work: "s = 95 ÷ 5 = 19", why: "Divide by the price of a student ticket." },
      ],
      answer: "19",
    },
    {
      kind: "Slope-intercept form to standard form",
      card: {
        type: "multiple-choice",
        prompt: "Write y = (3/4)x + 2 in standard form, Ax + By = C, with whole numbers and A positive.",
        answer: "3x − 4y = -8",
        choices: ["3x − 4y = -8", "3x + 4y = -8", "3x − 4y = 8", "4x − 3y = -8"],
      },
      steps: [
        { work: "multiply every term by 4 to clear the fraction: 4y = 3x + 8", why: "Multiplying by the bottom number clears the fraction." },
        { work: "move the x term to the left, changing its sign: -3x + 4y = 8", why: "Standard form has x and y on one side." },
        { work: "multiply every term by -1 so A is positive: 3x − 4y = -8", why: "Standard form starts with a positive x term." },
      ],
      answer: "3x − 4y = -8",
    },
    {
      kind: "A missing coordinate on a standard-form line",
      card: { type: "numeric", prompt: "The point (2, k) is on the line 3x + 2y = 14. What is k?", answer: 4 },
      steps: [
        { work: "put 2 in for x: 3(2) + 2y = 14", why: "The point's x goes in for x." },
        { work: "3(2) = 6; move it across, changing its sign: 2y = 8", why: "Subtract 6 from both sides." },
        { work: "k = 8 ÷ 2 = 4", why: "Divide by the number on y." },
      ],
      answer: "4",
    },
  ],

  "parallel-perpendicular": [
    {
      kind: "A perpendicular slope",
      card: {
        type: "numeric",
        prompt: "Line A has slope 2/3. What is the slope of a line perpendicular to line A? Give it as a whole number or a fraction.",
        answer: -1.5,
      },
      steps: [
        { work: "flip 2/3 upside down: 3/2", why: "Perpendicular slopes are reciprocals." },
        { work: "change the sign: -3/2, so 2/3 × -3/2 = -1", why: "They also have opposite signs, so they multiply to -1." },
      ],
      answer: "-3/2",
    },
    {
      kind: "A parallel line through a point",
      card: {
        type: "multiple-choice",
        prompt: "Which line is parallel to 2x + y = 3 and passes through (1, 4)?",
        answer: "y = -2x + 6",
        choices: ["y = -2x + 6", "y = 2x + 2", "y = -2x + 4", "y = -2x + 3"],
      },
      steps: [
        { work: "get y by itself: y = -2x + 3", why: "Subtract 2x from both sides." },
        { work: "the slope is -2", why: "The number multiplying x is the slope." },
        { work: "a parallel line has the same slope; put (1, 4) in: 4 = -2(1) + b", why: "Parallel lines share a slope." },
        { work: "4 = -2 + b, so b = 4 − (-2) = 6", why: "Add 2 to both sides." },
        { work: "y = -2x + 6", why: "Write the slope and intercept into the form." },
      ],
      answer: "y = -2x + 6",
    },
    {
      kind: "A perpendicular line's y-intercept",
      card: {
        type: "numeric",
        prompt: "A line passes through (4, 1) and is perpendicular to y = 2x + 3. What is its y-intercept?",
        answer: 3,
      },
      steps: [
        { work: "the perpendicular slope is the negative reciprocal of 2: -1/2", why: "Flip the slope and change its sign." },
        { work: "put (4, 1) into y = mx + b: 1 = (-1/2)(4) + b", why: "Use the point to find b." },
        { work: "(-1/2)(4) = -2: 1 = -2 + b", why: "Multiply first." },
        { work: "b = 1 − (-2) = 3", why: "Add 2 to both sides." },
      ],
      answer: "3",
    },
    {
      kind: "Parallel, perpendicular, or neither",
      card: {
        type: "multiple-choice",
        prompt: "Are the lines y = (1/2)x + 3 and 2x + y = 5 parallel, perpendicular, or neither?",
        answer: "Perpendicular",
        choices: ["Parallel", "Perpendicular", "Neither", "The same line"],
      },
      steps: [
        { work: "the first line is in slope-intercept form, so its slope is 1/2", why: "In y = mx + b, m is the slope." },
        { work: "solve the second for y: y = -2x + 5, so its slope is -2", why: "Get y alone to read the slope." },
        { work: "1/2 × -2 = -1: perpendicular", why: "Slopes that multiply to -1 are perpendicular." },
      ],
      answer: "Perpendicular",
    },
    {
      kind: "The value that makes lines perpendicular",
      card: {
        type: "numeric",
        prompt: "For what value of k is the line y = kx + 2 perpendicular to y = (3/4)x − 1? Give it as a whole number or a fraction.",
        answer: -4 / 3,
      },
      steps: [
        { work: "perpendicular slopes multiply to -1: 3/4 × k = -1", why: "That is the test for perpendicular lines." },
        { work: "k is the negative reciprocal; flip 3/4: 4/3", why: "Flipping is the first half of a negative reciprocal." },
        { work: "change the sign: k = -4/3", why: "The second half is changing the sign." },
      ],
      answer: "-4/3",
    },
  ],

  "graphing-systems": [
    {
      kind: "Where two lines intersect",
      card: {
        type: "multiple-choice",
        prompt: "Where do y = 2x + 1 and y = -x + 7 intersect?",
        answer: "(2, 5)",
        choices: ["(2, 5)", "(5, 2)", "(0, 7)", "(3, 7)"],
      },
      steps: [
        { work: "where they cross, the y-values match: 2x + 1 = -x + 7", why: "The crossing point is on both lines." },
        { work: "collect x on the left and the numbers on the right: 3x = 6", why: "Add x and subtract 1 on both sides." },
        { work: "x = 6 ÷ 3 = 2", why: "Divide to solve for x." },
        { work: "put x into the first line: y = 2(2) + 1 = 4 + 1 = 5", why: "Either line gives the same y here." },
        { work: "they cross at (2, 5)", why: "Write the point, x first." },
      ],
      answer: "(2, 5)",
    },
    {
      kind: "When two amounts become equal",
      card: {
        type: "numeric",
        prompt: "Candle A is 20 cm tall and burns down 3 cm an hour. Candle B is 14 cm tall and burns down 1 cm an hour. After how many hours are they the same height?",
        answer: 3,
      },
      steps: [
        { work: "set the heights equal: 20 − 3t = 14 − t", why: "Where the two lines cross, the heights match." },
        { work: "add 3t and take 14 from both sides: 6 = 2t", why: "Gather t on one side, numbers on the other." },
        { work: "t = 6 ÷ 2 = 3 hours", why: "Divide to solve for t." },
      ],
      answer: "3",
    },
    {
      kind: "How many solutions a system has",
      card: {
        type: "multiple-choice",
        prompt: "How many solutions does the system y = 2x + 1 and 4x − 2y = 6 have?",
        answer: "None",
        choices: ["One", "None", "Infinitely many", "Two"],
      },
      steps: [
        { work: "move the x term across in the second equation: -2y = -4x + 6", why: "Start getting y by itself." },
        { work: "divide every term by -2: y = 2x − 3", why: "Now both lines are in y = mx + b form." },
        { work: "same slope, 2, but different y-intercepts: parallel lines, no solution", why: "Parallel lines never cross." },
      ],
      answer: "None",
    },
  ],

  substitution: [
    {
      kind: "Swapping in an expression for y",
      card: { type: "numeric", prompt: "Solve: y = 2x + 1 and x + y = 10. What is x?", answer: 3 },
      steps: [
        { work: "put 2x + 1 in for y: x + (2x + 1) = 10", why: "y equals that expression, so it can replace y." },
        { work: "combine the x terms: 3x + 1 = 10", why: "Add like terms." },
        { work: "take 1 from both sides: 3x = 9", why: "Undo adding 1." },
        { work: "x = 9 ÷ 3 = 3", why: "Divide to solve for x." },
      ],
      answer: "3",
    },
    {
      kind: "Swapping in an expression for x",
      card: { type: "numeric", prompt: "Solve: x = 2y + 1 and 3x − 2y = 11. What is y?", answer: 2 },
      steps: [
        { work: "put 2y + 1 in for x, in brackets: 3(2y + 1) − 2y = 11", why: "Brackets keep the 3 on the whole expression." },
        { work: "distribute the 3: 6y + 3 − 2y = 11", why: "Multiply 3 by each term in the bracket." },
        { work: "combine the y terms: 4y + 3 = 11", why: "Add like terms." },
        { work: "take 3 from both sides: 4y = 8", why: "Undo adding 3." },
        { work: "y = 8 ÷ 4 = 2", why: "Divide to solve for y." },
      ],
      answer: "2",
    },
    {
      kind: "Swapping in with a number on y",
      card: { type: "numeric", prompt: "Solve: y = x − 2 and 2x + 3y = 14. What is x?", answer: 4 },
      steps: [
        { work: "put x − 2 in for y, in brackets: 2x + 3(x − 2) = 14", why: "Brackets keep the 3 on the whole expression." },
        { work: "distribute the 3: 2x + 3x − 6 = 14", why: "Multiply 3 by each term in the bracket." },
        { work: "combine the x terms: 5x − 6 = 14", why: "Add like terms." },
        { work: "add 6 to both sides: 5x = 20", why: "Undo subtracting 6." },
        { work: "x = 20 ÷ 5 = 4", why: "Divide to solve for x." },
      ],
      answer: "4",
    },
    {
      kind: "Ages now and later",
      card: {
        type: "numeric",
        prompt: "Ava is 3 times as old as Leo. In 4 years, their ages will add up to 40. How old is Ava now?",
        answer: 24,
      },
      steps: [
        { work: "let Leo's age be a, so Ava is 3a; in 4 years: (3a + 4) + (a + 4) = 40", why: "Both get 4 years older." },
        { work: "combine like terms: 4a + 8 = 40", why: "Add the a terms and the numbers." },
        { work: "4a = 32, so a = 32 ÷ 4 = 8", why: "Subtract 8, then divide by 4." },
        { work: "Ava is 3 × 8 = 24", why: "The question asks for Ava, not Leo." },
      ],
      answer: "24",
    },
  ],

  elimination: [
    {
      kind: "Adding to cancel y",
      card: { type: "numeric", prompt: "Solve: 2x + y = 11 and x − y = 4. What is x?", answer: 5 },
      steps: [
        { work: "add the equations, so y and −y cancel: 3x = 11 + 4 = 15", why: "Opposite terms add to zero." },
        { work: "x = 15 ÷ 3 = 5", why: "Divide to solve for x." },
      ],
      answer: "5",
    },
    {
      kind: "Multiplying one equation first",
      card: { type: "numeric", prompt: "Solve: x + 2y = 7 and 3x − 4y = 1. What is x?", answer: 3 },
      steps: [
        { work: "multiply every term of the first equation by 2: 2x + 4y = 14", why: "Now the y terms are opposites." },
        { work: "add the equations, so the y terms cancel: 5x = 15", why: "4y and -4y add to zero." },
        { work: "x = 15 ÷ 5 = 3", why: "Divide to solve for x." },
      ],
      answer: "3",
    },
    {
      kind: "Multiplying both equations",
      card: { type: "numeric", prompt: "Solve: 2x + 3y = 12 and 3x + 2y = 13. What is y?", answer: 2 },
      steps: [
        { work: "multiply the first equation by 3: 6x + 9y = 36", why: "Make the x terms match." },
        { work: "multiply the second equation by 2: 6x + 4y = 26", why: "Every term gets multiplied." },
        { work: "subtract, so the x terms cancel: 5y = 10", why: "Matching terms subtract to zero." },
        { work: "y = 10 ÷ 5 = 2", why: "Divide to solve for y." },
      ],
      answer: "2",
    },
    {
      kind: "Subtracting two receipts",
      card: {
        type: "numeric",
        prompt: "4 pens and 3 notebooks cost $23. 2 pens and 3 notebooks cost $19. How many dollars does one pen cost?",
        answer: 2,
      },
      steps: [
        { work: "subtract the receipts, so the notebooks cancel: (4p + 3n) − (2p + 3n) = 23 − 19, so 2p = 4", why: "The same number of notebooks subtracts away." },
        { work: "p = 4 ÷ 2 = 2", why: "Divide by the number of pens left." },
      ],
      answer: "2",
    },
  ],

  "systems-word-problems": [
    {
      kind: "Tickets at two prices",
      card: {
        type: "numeric",
        prompt: "Tickets cost $8 (adult) and $5 (child). 12 tickets sold for $78. How many adult tickets?",
        answer: 6,
      },
      steps: [
        { work: "tickets: a + c = 12; money: 8a + 5c = 78", why: "One equation counts tickets, one counts dollars." },
        { work: "c = 12 − a, so 8a + 5(12 − a) = 78", why: "Substitute for c in the money equation." },
        { work: "distribute: 8a + 60 − 5a = 78", why: "Multiply 5 by each term in the bracket." },
        { work: "3a = 78 − 60 = 18", why: "Combine the a terms and subtract 60." },
        { work: "a = 18 ÷ 3 = 6", why: "Divide to solve for a." },
      ],
      answer: "6",
    },
    {
      kind: "Points from two kinds of baskets",
      card: {
        type: "numeric",
        prompt: "A player made 10 baskets, all 2-pointers and 3-pointers, for 24 points. How many 3-pointers?",
        answer: 4,
      },
      steps: [
        { work: "baskets: t + h = 10; points: 2t + 3h = 24", why: "One equation counts baskets, one counts points." },
        { work: "t = 10 − h, so 2(10 − h) + 3h = 24", why: "Substitute for t in the points equation." },
        { work: "distribute: 20 − 2h + 3h = 24, so 20 + h = 24", why: "Multiply out, then combine the h terms." },
        { work: "h = 24 − 20 = 4", why: "Subtract 20 from both sides." },
      ],
      answer: "4",
    },
    {
      kind: "Coins of two values",
      card: {
        type: "numeric",
        prompt: "You have 10 coins, all quarters and dimes, worth $1.75. How many quarters?",
        answer: 5,
      },
      steps: [
        { work: "coins: q + d = 10; value in cents: 25q + 10d = 175", why: "Working in cents keeps the numbers whole." },
        { work: "d = 10 − q, so 25q + 10(10 − q) = 175", why: "Substitute for d in the value equation." },
        { work: "distribute: 25q + 100 − 10q = 175, so 15q = 175 − 100 = 75", why: "Combine the q terms and subtract 100." },
        { work: "q = 75 ÷ 15 = 5", why: "Divide to solve for q." },
      ],
      answer: "5",
    },
    {
      kind: "A blend of two prices",
      card: {
        type: "numeric",
        prompt: "A coffee shop mixes beans that cost $8 a pound with beans that cost $12 a pound. It makes 20 pounds of a blend worth $9.00 a pound. How many pounds of the $8 beans go in?",
        answer: 15,
      },
      steps: [
        { work: "pounds: c + d = 20; money: 8c + 12d = 20 × 9.00 = 180", why: "One equation for weight, one for value." },
        { work: "d = 20 − c, so 8c + 12(20 − c) = 180", why: "Substitute for d in the money equation." },
        { work: "distribute: 8c + 240 − 12c = 180, so 240 − 4c = 180", why: "Multiply out, then combine the c terms." },
        { work: "4c = 240 − 180 = 60", why: "Move the terms so c is positive." },
        { work: "c = 60 ÷ 4 = 15", why: "Divide to solve for c." },
      ],
      answer: "15",
    },
    {
      kind: "With and against a current",
      card: {
        type: "numeric",
        prompt: "A boat travels 36 miles downstream in 2 hours and the same 36 miles back upstream in 3 hours. What is the speed of the current, in miles per hour?",
        answer: 3,
      },
      steps: [
        { work: "downstream the speeds add: b + c = 36 ÷ 2 = 18", why: "Speed is distance over time; the current helps." },
        { work: "upstream the current slows it: b − c = 36 ÷ 3 = 12", why: "Going against the current takes it away." },
        { work: "subtract the equations: 2c = 18 − 12 = 6", why: "Subtracting cancels b." },
        { work: "c = 6 ÷ 2 = 3", why: "Divide to solve for c." },
      ],
      answer: "3",
    },
  ],
};
