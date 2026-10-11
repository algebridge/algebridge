import type { Unit } from "@/types";
import { SKILL_VIDEOS } from "@/data/videos";
import { algebra2Units } from "@/data/algebra2";

// Each skill's lesson video lives in src/data/videos.ts, the one verified list.

export const units: Unit[] = [
  {
    id: "working-with-units",
    number: 1,
    title: "Working with Units",
    description: "Convert between units and solve real-world problems using dimensional analysis.",
    icon: "📏",
    skills: [
      {
        id: "unit-basics",
        title: "Unit Conversion Basics",
        description: "Understand how to convert between common units.",
        learningGoal: "Convert measurements using conversion factors.",
        keyIdea: "Multiply by a fraction equal to 1 (e.g., 5280 ft / 1 mile).",
        video: SKILL_VIDEOS["unit-basics"],
        generatorKey: "unit-conversion",
        problems: [
          { id: "u1-p1", type: "numeric", prompt: "Convert 3 miles to feet. (1 mile = 5280 ft)", hint: "Multiply 3 × 5280.", answer: 15840, explanation: "1 mile = 5280 ft, so multiply the miles by 5280 → 3 × 5280 = 15,840 feet" },
          { id: "u1-p2", type: "multiple-choice", prompt: "Which conversion factor converts inches to feet?", hint: "12 inches = 1 foot, divide inches by 12.", answer: "1 ft / 12 in", choices: ["12 in / 1 ft", "1 ft / 12 in", "12 ft / 1 in", "1 in / 12 ft"], explanation: "12 in = 1 ft → inches go on the bottom so they cancel, feet go on top → multiply by 1 ft / 12 in" },
          { id: "u1-p3", type: "numeric", prompt: "A car travels 60 miles in 1 hour. How many feet per second is that?", hint: "Convert miles→feet, hours→seconds.", answer: 88, explanation: "60 mi/hr × 5280 ft/mi = 316,800 ft/hr → 316,800 ft/hr ÷ 3600 sec/hr = 88 ft/sec" },
        ],
      },
      {
        id: "dimensional-analysis",
        title: "Dimensional Analysis",
        description: "Use unit fractions to solve multi-step conversion problems.",
        learningGoal: "Set up and solve multi-step unit conversion problems.",
        keyIdea: "Units cancel like numbers, track units through every step.",
        video: SKILL_VIDEOS["dimensional-analysis"],
        generatorKey: "unit-conversion",
        problems: [
          { id: "u1-p4", type: "numeric", prompt: "Convert 2.5 hours to seconds.", hint: "1 hour = 3600 seconds.", answer: 9000, explanation: "2.5 h × 60 min/h = 150 min → 150 min × 60 s/min = 9000 seconds" },
          { id: "u1-p5", type: "error-analysis", prompt: "Find the error in this conversion of 5 km to centimeters.", hint: "Check each conversion factor: is it right side up?", wrongStepIndex: 2, steps: ["Start with 5 km.", "5 km × 1000 m/km = 5000 m", "5000 m × 1 m/100 cm = 50 cm"], explanation: "Step 3 has the factor upside down: meters must be on the bottom to cancel. 5000 m × 100 cm/m = 500,000 cm." },
        ],
      },
      {
        id: "unit-word-problems",
        title: "Unit Word Problems",
        description: "Apply unit conversions to real-world scenarios.",
        learningGoal: "Solve word problems involving rates and unit conversions.",
        keyIdea: "Identify what units you start with and what units you need.",
        video: SKILL_VIDEOS["unit-word-problems"],
        problems: [
          { id: "u1-p6", type: "numeric", prompt: "A recipe needs 750 mL of milk. How many liters is that?", hint: "1000 mL = 1 L", answer: 0.75, explanation: "1000 mL = 1 L, so divide the milliliters by 1000 → 750 ÷ 1000 = 0.75 liters" },
          { id: "u1-p7", type: "multiple-choice", prompt: "You drive 150 miles using 5 gallons of gas. What is your fuel efficiency?", hint: "miles per gallon = miles ÷ gallons", answer: "30 mpg", choices: ["30 mpg", "750 mpg", "0.033 mpg", "155 mpg"], explanation: "miles per gallon means miles ÷ gallons → 150 ÷ 5 = 30 mpg" },
        ],
      },
    ],
  },
  {
    id: "solving-equations",
    number: 2,
    title: "Solving Equations & Inequalities",
    description: "Master the art of solving linear equations step by step.",
    icon: "⚖️",
    skills: [
      {
        id: "one-step-equations",
        title: "One-Step Equations",
        description: "Solve equations using addition, subtraction, multiplication, and division.",
        learningGoal: "Solve one-step linear equations.",
        keyIdea: "Do the opposite operation to both sides to isolate x.",
        video: SKILL_VIDEOS["one-step-equations"],
        generatorKey: "one-step-add",
        problems: [
          { id: "e1-p1", type: "numeric", prompt: "Solve for x: x + 7 = 15", hint: "Subtract 7 from both sides.", answer: 8, explanation: "x + 7 − 7 = 15 − 7 → x = 8" },
          { id: "e1-p2", type: "numeric", prompt: "Solve for x: 4x = 28", hint: "Divide both sides by 4.", answer: 7, explanation: "4x ÷ 4 = 28 ÷ 4 → x = 7" },
          { id: "e1-p3", type: "error-analysis", prompt: "Jamie solved x + 6 = 14. Find the error.", hint: "Check each step carefully.", wrongStepIndex: 1, steps: ["x + 6 = 14", "x = 14 + 6", "x = 20"], explanation: "Jamie added 6 instead of subtracting. Correct: x = 14 − 6 = 8." },
        ],
      },
      {
        id: "two-step-equations",
        title: "Two-Step Equations",
        description: "Solve equations that require two operations.",
        learningGoal: "Solve two-step linear equations.",
        keyIdea: "Undo addition/subtraction first, then multiplication/division (SADM).",
        video: SKILL_VIDEOS["two-step-equations"],
        generatorKey: "two-step",
        problems: [
          { id: "e2-p1", type: "numeric", prompt: "Solve for x: 3x + 5 = 20", hint: "Subtract 5, then divide by 3.", answer: 5, explanation: "3x = 20 − 5 = 15 → x = 15 ÷ 3 = 5" },
          { id: "e2-p2", type: "step-order", prompt: "Put these steps in the correct order to solve 2x − 8 = 14:", hint: "Undo subtraction before division.", correctOrder: [0, 1, 2], steps: ["Add 8 to both sides: 2x = 22", "Divide both sides by 2: x = 11", "Check: 2(11) − 8 = 14 ✓"], explanation: "Add/subtract first, then multiply/divide." },
          { id: "e2-p3", type: "numeric", prompt: "Solve for x: −2x + 10 = 4", hint: "Subtract 10, then divide by −2.", answer: 3, explanation: "−2x = 4 − 10 = −6 → x = −6 ÷ (−2) = 3" },
        ],
      },
      {
        id: "multi-step-equations",
        title: "Multi-Step Equations",
        description: "Solve equations with distribution and combining like terms.",
        learningGoal: "Solve multi-step equations including those with parentheses.",
        keyIdea: "Simplify each side first (distribute, combine like terms), then solve.",
        video: SKILL_VIDEOS["multi-step-equations"],
        problems: [
          { id: "e3-p1", type: "numeric", prompt: "Solve for x: 2(x + 3) = 16", hint: "Divide by 2 first, or distribute.", answer: 5, explanation: "x + 3 = 16 ÷ 2 = 8 → x = 8 − 3 = 5" },
          { id: "e3-p2", type: "numeric", prompt: "Solve for x: 3x + 2 = x + 10", hint: "Get all x terms on one side.", answer: 4, explanation: "subtract x from both sides: 2x + 2 = 10 → 2x = 10 − 2 = 8 → x = 8 ÷ 2 = 4" },
          { id: "e3-p3", type: "error-analysis", prompt: "Find the error in this solution of 2(x + 4) = 18.", hint: "Check the distribution step.", wrongStepIndex: 0, steps: ["2x + 4 = 18", "2x = 14", "x = 7"], explanation: "Distribute: 2x + 8 = 18, not 2x + 4." },
        ],
      },
      {
        id: "equations-with-fractions",
        title: "Equations with Fractions",
        description: "Clear fractions and solve linear equations that have fractions in them.",
        learningGoal: "Solve equations containing fractions.",
        keyIdea: "Multiply every term by the LCD to eliminate fractions.",
        video: SKILL_VIDEOS["equations-with-fractions"],
        problems: [
          { id: "e4-p1", type: "numeric", prompt: "Solve for x: x/3 + 2 = 7", hint: "Subtract 2, then multiply by 3.", answer: 15, explanation: "x/3 = 7 − 2 = 5 → x = 5 × 3 = 15" },
          { id: "e4-p2", type: "multiple-choice", prompt: "What is the LCD of 1/2, 1/3, and 1/6?", hint: "LCD = least common multiple of denominators.", answer: "6", choices: ["6", "12", "3", "18"], explanation: "start with the biggest denominator, 6 → 6 ÷ 2 = 3 and 6 ÷ 3 = 2, so 2, 3 and 6 all divide into 6 → the LCD is 6" },
        ],
      },
      {
        id: "linear-inequalities",
        title: "Linear Inequalities",
        description: "Solve one-variable inequalities.",
        learningGoal: "Solve linear inequalities and know when to flip the inequality sign.",
        keyIdea: "Treat like equations, but flip the sign when multiplying/dividing by a negative.",
        video: SKILL_VIDEOS["linear-inequalities"],
        problems: [
          { id: "e5-p1", type: "numeric", prompt: "Solve for x: 2x − 3 > 7. What number does x have to be greater than? Type just the number.", hint: "Add 3, divide by 2. x > ?", answer: 5, explanation: "2x > 7 + 3 = 10 → x > 10 ÷ 2 = 5" },
          { id: "e5-p2", type: "multiple-choice", prompt: "When do you flip the inequality sign?", hint: "Think about multiplying by negative numbers.", answer: "When multiplying or dividing by a negative", choices: ["When adding a negative", "When multiplying or dividing by a negative", "When subtracting", "Never"], explanation: "adding or subtracting moves both sides the same way, so the sign stays → multiplying by a negative reverses the order: 2 < 5 but −2 > −5 → so flip the sign when multiplying or dividing by a negative" },
        ],
      },
    ],
  },
  {
    id: "linear-equations-graphs",
    number: 3,
    title: "Linear Equations & Graphs",
    description: "Work with points, slope and intercepts, and read what a line's equation tells you.",
    icon: "📈",
    skills: [
      {
        id: "coordinate-plane",
        title: "The Coordinate Plane",
        description: "Name the quadrant a point is in and read its coordinates.",
        learningGoal: "Identify the quadrant and the coordinates of an ordered pair.",
        keyIdea: "An ordered pair (x, y) tells you how far right and up to go.",
        video: SKILL_VIDEOS["coordinate-plane"],
        problems: [
          { id: "g1-p1", type: "multiple-choice", prompt: "In which quadrant is the point (−3, 4)?", hint: "Negative x, positive y.", answer: "Quadrant II", choices: ["Quadrant I", "Quadrant II", "Quadrant III", "Quadrant IV"], explanation: "x = −3 is negative and y = 4 is positive, so the signs are (−, +) → (−, +) is the upper left: Quadrant II" },
          { id: "g1-p2", type: "numeric", prompt: "What is the y-coordinate of point (5, −2)?", hint: "y comes second in (x, y).", answer: -2, explanation: "a point is written (x, y), so the second number is y → in (5, −2), the y-coordinate is −2" },
        ],
      },
      {
        id: "slope",
        title: "Slope",
        description: "Calculate and interpret slope as rate of change.",
        learningGoal: "Find the slope of a line from two points, including horizontal and vertical lines.",
        keyIdea: "Slope = rise over run = (y₂ − y₁) / (x₂ − x₁)",
        video: SKILL_VIDEOS["slope"],
        generatorKey: "slope",
        problems: [
          { id: "g2-p1", type: "numeric", prompt: "Find the slope between (1, 2) and (4, 8).", hint: "m = (8−2)/(4−1)", answer: 2, explanation: "rise: 8 − 2 = 6 → run: 4 − 1 = 3 → m = 6/3 = 2" },
          { id: "g2-p2", type: "multiple-choice", prompt: "What is the slope of a horizontal line?", hint: "No rise, only run.", answer: "0", choices: ["0", "1", "Undefined", "−1"], explanation: "a horizontal line has the same y everywhere, so its rise is 0 → slope = rise ÷ run = 0" },
          { id: "g2-p3", type: "multiple-choice", prompt: "What is the slope of a vertical line?", hint: "No run, division by zero.", answer: "Undefined", choices: ["0", "1", "Undefined", "−1"], explanation: "a vertical line has the same x everywhere, so its run is 0 → slope = rise ÷ run divides by 0, so the slope is undefined" },
        ],
      },
      {
        id: "graphing-lines",
        title: "Graphing Linear Equations",
        description: "Read the y-intercept of y = mx + b and find points on the line.",
        learningGoal: "Use y = mx + b to find the y-intercept and the y-value at a given x.",
        keyIdea: "y = mx + b: start at b on the y-axis, use slope m to find next point.",
        video: SKILL_VIDEOS["graphing-lines"],
        problems: [
          { id: "g3-p1", type: "multiple-choice", prompt: "What is the y-intercept of y = 3x − 4?", hint: "b in y = mx + b", answer: "−4", choices: ["3", "−4", "4", "−3"], explanation: "in y = mx + b, b is the y-intercept → in y = 3x − 4, b = −4" },
          { id: "g3-p2", type: "numeric", prompt: "For y = 2x + 1, what is y when x = 3?", hint: "Substitute x = 3.", answer: 7, explanation: "y = 2(3) + 1 → 2(3) = 6 → y = 6 + 1 = 7" },
        ],
      },
      {
        id: "intercepts",
        title: "X and Y Intercepts",
        description: "Find where a line crosses the axes.",
        learningGoal: "Find x- and y-intercepts of a linear equation.",
        keyIdea: "y-intercept: set x = 0. x-intercept: set y = 0.",
        video: SKILL_VIDEOS["intercepts"],
        problems: [
          { id: "g4-p1", type: "numeric", prompt: "Find the x-intercept of 2x + y = 10.", hint: "Set y = 0.", answer: 5, explanation: "the x-intercept is where y is 0, so 2x = 10 → x = 10 ÷ 2 = 5" },
          { id: "g4-p2", type: "numeric", prompt: "Find the y-intercept of 3x − 2y = 12.", hint: "Set x = 0.", answer: -6, explanation: "the y-intercept is where x is 0, so −2y = 12 → y = 12 ÷ (−2) = −6" },
        ],
      },
    ],
  },
  {
    id: "forms-linear-equations",
    number: 4,
    title: "Forms of Linear Equations",
    description: "Work with slope-intercept, point-slope, and standard form.",
    icon: "📝",
    skills: [
      {
        id: "slope-intercept",
        title: "Slope-Intercept Form",
        description: "Write and interpret y = mx + b.",
        learningGoal: "Write equations in slope-intercept form and identify m and b.",
        keyIdea: "y = mx + b where m = slope, b = y-intercept.",
        video: SKILL_VIDEOS["slope-intercept"],
        problems: [
          { id: "f1-p1", type: "multiple-choice", prompt: "Write the equation of a line with slope 3 and y-intercept −2.", hint: "y = mx + b", answer: "y = 3x − 2", choices: ["y = 3x − 2", "y = −2x + 3", "y = 3x + 2", "y = −2x − 3"], explanation: "slope-intercept form is y = mx + b → m = 3 and b = −2 → y = 3x − 2" },
          { id: "f1-p2", type: "numeric", prompt: "In y = −4x + 7, what is the slope?", hint: "m is the coefficient of x.", answer: -4, explanation: "in y = mx + b, the slope m is the number times x → in y = −4x + 7, m = −4" },
        ],
      },
      {
        id: "point-slope",
        title: "Point-Slope Form",
        description: "Write equations given a point and slope.",
        learningGoal: "Write and use point-slope form: y − y₁ = m(x − x₁).",
        keyIdea: "Point-slope uses one point and the slope to define a line.",
        video: SKILL_VIDEOS["point-slope"],
        problems: [
          { id: "f2-p1", type: "multiple-choice", prompt: "Line through (2, 5) with slope 3. Which is point-slope form?", hint: "y − y₁ = m(x − x₁)", answer: "y − 5 = 3(x − 2)", choices: ["y − 5 = 3(x − 2)", "y − 2 = 3(x − 5)", "y = 3x + 5", "y = 3x − 1"], explanation: "point-slope form is y − y₁ = m(x − x₁) → the point gives x₁ = 2 and y₁ = 5, and m = 3 → y − 5 = 3(x − 2)" },
        ],
      },
      {
        id: "standard-form",
        title: "Standard Form",
        description: "Convert between Ax + By = C and slope-intercept form.",
        learningGoal: "Convert linear equations between standard and slope-intercept form.",
        keyIdea: "Standard form Ax + By = C; solve for y to convert to slope-intercept.",
        video: SKILL_VIDEOS["standard-form"],
        problems: [
          { id: "f3-p1", type: "multiple-choice", prompt: "Convert 2x + 4y = 8 to slope-intercept form.", hint: "Solve for y.", answer: "y = −½x + 2", choices: ["y = −½x + 2", "y = 2x + 4", "y = −2x + 8", "y = ½x − 2"], explanation: "subtract 2x from both sides: 4y = −2x + 8 → divide every term by 4: y = −2x/4 + 8/4 → y = −½x + 2" },
        ],
      },
      {
        id: "parallel-perpendicular",
        title: "Parallel & Perpendicular Lines",
        description: "Identify slopes of parallel and perpendicular lines.",
        learningGoal: "Write equations of parallel and perpendicular lines.",
        keyIdea: "Parallel: same slope. Perpendicular: slopes are negative reciprocals.",
        video: SKILL_VIDEOS["parallel-perpendicular"],
        problems: [
          { id: "f4-p1", type: "numeric", prompt: "Line A has slope 2. What slope is perpendicular to A?", hint: "Negative reciprocal of 2.", answer: -0.5, explanation: "perpendicular slopes are negative reciprocals → the reciprocal of 2 is 1/2 → make it negative: −1/2 = −0.5" },
          { id: "f4-p2", type: "multiple-choice", prompt: "Which line is parallel to y = 3x + 1?", hint: "Same slope, different intercept.", answer: "y = 3x − 5", choices: ["y = 3x − 5", "y = −3x + 1", "y = ⅓x + 1", "y = −⅓x + 5"], explanation: "parallel lines have the same slope → y = 3x + 1 has slope 3 → y = 3x − 5 also has slope 3, so it is parallel" },
        ],
      },
    ],
  },
  {
    id: "systems-equations",
    number: 5,
    title: "Systems of Equations",
    description: "Solve systems of two linear equations, and find where two lines cross.",
    icon: "🔗",
    skills: [
      {
        id: "graphing-systems",
        title: "Graphing Systems",
        description: "Find the point where two lines cross.",
        learningGoal: "Find the intersection of two lines written in slope-intercept form.",
        keyIdea: "The solution is the intersection point of the two lines.",
        video: SKILL_VIDEOS["graphing-systems"],
        problems: [
          { id: "s1-p1", type: "multiple-choice", prompt: "Where do y = x + 1 and y = −x + 5 intersect?", hint: "Set the equations equal.", answer: "(2, 3)", choices: ["(2, 3)", "(3, 2)", "(1, 4)", "(0, 5)"], explanation: "set the two right sides equal: x + 1 = −x + 5 → 2x = 4, so x = 2 → y = 2 + 1 = 3, so they meet at (2, 3)" },
        ],
      },
      {
        id: "substitution",
        title: "Substitution Method",
        description: "Solve systems by substituting one equation into another.",
        learningGoal: "Solve systems of equations using substitution.",
        keyIdea: "Solve one equation for a variable, then substitute into the other.",
        video: SKILL_VIDEOS["substitution"],
        generatorKey: "substitution",
        problems: [
          { id: "s2-p1", type: "numeric", prompt: "Solve: y = x + 2 and x + y = 8. What is x?", hint: "Substitute y = x + 2 into the second equation.", answer: 3, explanation: "put y = x + 2 into x + y = 8: x + (x + 2) = 8 → 2x + 2 = 8 → 2x = 6 → x = 3" },
          { id: "s2-p2", type: "numeric", prompt: "Solve: y = 2x and x + y = 9. What is y?", hint: "Substitute y = 2x.", answer: 6, explanation: "put y = 2x into x + y = 9: x + 2x = 9 → 3x = 9, so x = 3 → y = 2(3) = 6" },
        ],
      },
      {
        id: "elimination",
        title: "Elimination Method",
        description: "Add or subtract equations to eliminate a variable.",
        learningGoal: "Solve systems using the elimination method.",
        keyIdea: "Add or subtract equations so one variable cancels out.",
        video: SKILL_VIDEOS["elimination"],
        problems: [
          { id: "s3-p1", type: "numeric", prompt: "Solve: x + y = 10 and x − y = 4. What is x?", hint: "Add the two equations.", answer: 7, explanation: "add the equations, so y cancels: (x + y) + (x − y) = 10 + 4 → 2x = 14 → x = 14 ÷ 2 = 7" },
          { id: "s3-p2", type: "step-order", prompt: "Order the steps to solve: 2x + 3y = 12 and 4x − 3y = 6", hint: "Add to eliminate y.", correctOrder: [0, 1, 2, 3], steps: ["Add equations: 6x = 18", "Solve: x = 3", "Substitute x = 3 into first equation", "Solve for y: y = 2"], explanation: "Adding eliminates y immediately." },
        ],
      },
      {
        id: "systems-word-problems",
        title: "Systems Word Problems",
        description: "Model real situations with systems of equations.",
        learningGoal: "Write and solve systems from word problems.",
        keyIdea: "Define two variables, write two equations from the problem constraints.",
        video: SKILL_VIDEOS["systems-word-problems"],
        problems: [
          { id: "s4-p1", type: "numeric", prompt: "Tickets cost $8 (adult) and $5 (child). 12 tickets sold for $78. How many adult tickets?", hint: "a + c = 12 and 8a + 5c = 78", answer: 6, explanation: "a + c = 12 and 8a + 5c = 78 → c = 12 − a, so 8a + 5(12 − a) = 78 → 8a + 60 − 5a = 78 → 3a = 18 → a = 6 adult tickets" },
        ],
      },
    ],
  },
  {
    id: "inequalities-systems",
    number: 6,
    title: "Inequalities (Systems & Graphs)",
    description: "Decide how a two-variable inequality is drawn, and find points that satisfy two at once.",
    icon: "📊",
    skills: [
      {
        id: "graphing-inequalities",
        title: "Graphing Inequalities",
        description: "Choose the boundary line and the side to shade for a two-variable inequality.",
        learningGoal: "Decide whether the boundary is solid or dashed, and which side holds the solutions.",
        keyIdea: "Dashed line for < or >; solid for ≤ or ≥. Shade the side that satisfies the inequality.",
        video: SKILL_VIDEOS["graphing-inequalities"],
        problems: [
          { id: "i1-p1", type: "multiple-choice", prompt: "y > 2x + 1: solid or dashed boundary line?", hint: "Strict inequality = not including the line.", answer: "Dashed", choices: ["Solid", "Dashed", "No line", "Either"], explanation: "> is strict: points on the line itself are not included → a strict sign gets a dashed boundary line: Dashed" },
        ],
      },
      {
        id: "compound-inequalities",
        title: "Compound Inequalities",
        description: "Solve compound inequalities joined by AND or OR.",
        learningGoal: "Solve compound inequalities and write the solution as an inequality.",
        keyIdea: "AND means overlap; OR means union of solution sets.",
        video: SKILL_VIDEOS["compound-inequalities"],
        problems: [
          { id: "i2-p1", type: "multiple-choice", prompt: "Solve: −3 < 2x + 1 < 9", hint: "Subtract 1 from all parts, then divide by 2.", answer: "−2 < x < 4", choices: ["−2 < x < 4", "−1 < x < 5", "−4 < x < 2", "x < 4"], explanation: "subtract 1 from all three parts: −4 < 2x < 8 → divide all three parts by 2: −2 < x < 4" },
        ],
      },
      {
        id: "systems-inequalities",
        title: "Systems of Inequalities",
        description: "Find the points that satisfy two inequalities at once.",
        learningGoal: "Test points against every inequality in a system.",
        keyIdea: "The solution is the overlapping shaded region.",
        video: SKILL_VIDEOS["systems-inequalities"],
        problems: [
          { id: "i3-p1", type: "multiple-choice", prompt: "Which point satisfies y ≤ x + 2 AND y > −1?", hint: "Test each point in both inequalities.", answer: "(0, 0)", choices: ["(0, 0)", "(0, 5)", "(−3, 0)", "(−2, −3)"], explanation: "test (0, 0) in y ≤ x + 2: 0 ≤ 2 ✓ → test (0, 0) in y > −1: 0 > −1 ✓ → both hold, so (0, 0) works" },
        ],
      },
    ],
  },
  {
    id: "functions",
    number: 7,
    title: "Functions",
    description: "Evaluate functions, find domains, and find average rates of change.",
    icon: "ƒ",
    skills: [
      {
        id: "function-notation",
        title: "Function Notation",
        description: "Evaluate functions using f(x) notation.",
        learningGoal: "Use function notation to evaluate functions.",
        keyIdea: "f(x) means the output when the input is x.",
        video: SKILL_VIDEOS["function-notation"],
        generatorKey: "function-eval",
        problems: [
          { id: "fn1-p1", type: "numeric", prompt: "If f(x) = 2x + 3, find f(4).", hint: "Replace x with 4.", answer: 11, explanation: "f(4) = 2(4) + 3 → 2(4) = 8 → 8 + 3 = 11" },
          { id: "fn1-p2", type: "numeric", prompt: "If g(x) = x² − 1, find g(−3).", hint: "Replace x with −3.", answer: 8, explanation: "g(−3) = (−3)² − 1 → (−3)² = 9 → 9 − 1 = 8" },
        ],
      },
      {
        id: "domain-range",
        title: "Domain and Range",
        description: "Find the inputs a function allows, its domain.",
        learningGoal: "Find the domain of a function from its equation.",
        keyIdea: "Domain = all valid inputs. Range = all possible outputs.",
        video: SKILL_VIDEOS["domain-range"],
        problems: [
          { id: "fn2-p1", type: "multiple-choice", prompt: "What is the domain of f(x) = 1/(x − 2)?", hint: "Denominator cannot be zero.", answer: "All real numbers except 2", choices: ["All real numbers", "All real numbers except 2", "x > 2", "x ≥ 2"], explanation: "you cannot divide by 0, so x − 2 cannot be 0 → x − 2 is 0 when x = 2 → so the domain is all real numbers except 2" },
        ],
      },
      {
        id: "function-graphs",
        title: "Interpreting Function Graphs",
        description: "Find the average rate of change between two points of a function.",
        learningGoal: "Calculate a function's average rate of change over an interval.",
        keyIdea: "Graphs show how output changes as input changes.",
        video: SKILL_VIDEOS["function-graphs"],
        problems: [
          { id: "fn3-p1", type: "multiple-choice", prompt: "A function graph passes through (0, 3) and (2, 7). What is the average rate of change?", hint: "(7−3)/(2−0)", answer: "2", choices: ["2", "3", "4", "7"], explanation: "change in y: 7 − 3 = 4 → change in x: from 0 up to 2 is 2 → rate of change = 4 ÷ 2 = 2" },
        ],
      },
    ],
  },
  {
    id: "sequences",
    number: 8,
    title: "Sequences",
    description: "Explore arithmetic and geometric patterns.",
    icon: "🔢",
    skills: [
      {
        id: "arithmetic-sequences",
        title: "Arithmetic Sequences",
        description: "Find terms and formulas for arithmetic sequences.",
        learningGoal: "Write and use the formula for arithmetic sequences.",
        keyIdea: "Each term differs by a constant amount d (common difference).",
        video: SKILL_VIDEOS["arithmetic-sequences"],
        problems: [
          { id: "sq1-p1", type: "numeric", prompt: "Sequence: 3, 7, 11, 15, ... What is the 10th term?", hint: "aₙ = a₁ + (n−1)d, d = 4", answer: 39, explanation: "the common difference is 7 − 3 = 4 → aₙ = a₁ + (n − 1)d, so a₁₀ = 3 + 9(4) → 3 + 36 = 39" },
          { id: "sq1-p2", type: "numeric", prompt: "What is the common difference in 5, 2, −1, −4, ...?", hint: "Subtract consecutive terms.", answer: -3, explanation: "subtract a term from the one after it: 2 − 5 = −3 → check the next pair: −1 − 2 = −3, so the common difference is −3" },
        ],
      },
      {
        id: "geometric-sequences",
        title: "Geometric Sequences",
        description: "Identify and work with geometric patterns.",
        learningGoal: "Recognize and extend geometric sequences.",
        keyIdea: "Each term is multiplied by a constant ratio r.",
        video: SKILL_VIDEOS["geometric-sequences"],
        problems: [
          { id: "sq2-p1", type: "numeric", prompt: "Sequence: 81, 27, 9, 3, ... What is the common ratio? Give it as a fraction.", hint: "Divide any term by the one before it.", answer: 1 / 3, explanation: "divide a term by the one before it: 27 ÷ 81 = 1/3 → check the next pair: 9 ÷ 27 = 1/3, so the common ratio is 1/3" },
          { id: "sq2-p2", type: "numeric", prompt: "What is the 5th term of 3, 6, 12, 24, ...?", hint: "Multiply by 2 each time.", answer: 48, explanation: "the common ratio is 6 ÷ 3 = 2 → the 5th term is 3 × 2⁴ → 2⁴ = 16, and 3 × 16 = 48" },
        ],
      },
    ],
  },
  {
    id: "exponents-radicals",
    number: 9,
    title: "Exponents & Radicals",
    description: "Master exponent rules and simplify radical expressions.",
    icon: "²",
    skills: [
      {
        id: "exponent-rules",
        title: "Exponent Rules",
        description: "Apply product, quotient, and power rules.",
        learningGoal: "Simplify expressions using exponent rules.",
        keyIdea: "Same base: add exponents when multiplying, subtract when dividing.",
        video: SKILL_VIDEOS["exponent-rules"],
        generatorKey: "exponent-mult",
        problems: [
          { id: "ex1-p1", type: "numeric", prompt: "Simplify: 2³ × 2⁴ (enter as a number)", hint: "Add exponents: 2^(3+4)", answer: 128, explanation: "same base, so add the exponents: 2³ × 2⁴ = 2^(3 + 4) = 2⁷ → 2⁷ = 128" },
          { id: "ex1-p2", type: "multiple-choice", prompt: "Simplify: (x³)²", hint: "Multiply exponents.", answer: "x⁶", choices: ["x⁶", "x⁵", "x⁹", "2x³"], explanation: "a power of a power multiplies the exponents: (x³)² = x^(3 × 2) → 3 × 2 = 6, so (x³)² = x⁶" },
          { id: "ex1-p3", type: "numeric", prompt: "Simplify: 5⁰", hint: "Any nonzero number to the 0 power equals...", answer: 1, explanation: "dividing a power by itself subtracts the exponents: 5³ ÷ 5³ = 5^(3 − 3) = 5⁰ → but 5³ ÷ 5³ = 1, so 5⁰ = 1" },
        ],
      },
      {
        id: "negative-fractional-exponents",
        title: "Negative & Fractional Exponents",
        description: "Work with negative and fractional exponents.",
        learningGoal: "Convert between radical and exponential form.",
        keyIdea: "x^(−n) = 1/xⁿ. x^(1/n) = ⁿ√x.",
        video: SKILL_VIDEOS["negative-fractional-exponents"],
        problems: [
          { id: "ex2-p1", type: "numeric", prompt: "Evaluate 2^(−3). Write it as a fraction.", hint: "A negative exponent means one over the power: 1/2³.", answer: 0.125, explanation: "a negative exponent means one over the power: 2^(−3) = 1/2³ → 2³ = 8, so 2^(−3) = 1/8" },
          { id: "ex2-p2", type: "multiple-choice", prompt: "Rewrite ³√x as an exponent.", hint: "x^(1/n)", answer: "x^(1/3)", choices: ["x^(1/3)", "x³", "x^(−3)", "3x"], explanation: "an nth root is the 1/n power → a cube root is n = 3, so ³√x = x^(1/3)" },
        ],
      },
      {
        id: "scientific-notation",
        title: "Scientific Notation",
        description: "Express very large and small numbers efficiently.",
        learningGoal: "Convert to and from scientific notation.",
        keyIdea: "a × 10ⁿ where 1 ≤ a < 10.",
        video: SKILL_VIDEOS["scientific-notation"],
        problems: [
          { id: "ex3-p1", type: "multiple-choice", prompt: "Write 450,000 in scientific notation.", hint: "Move decimal 5 places left.", answer: "4.5 × 10⁵", choices: ["4.5 × 10⁵", "45 × 10⁴", "4.5 × 10⁶", "0.45 × 10⁶"], explanation: "move the decimal point to make a number from 1 to 10: 4.5 → the point moved 5 places left, so multiply by 10⁵ → 450,000 = 4.5 × 10⁵" },
        ],
      },
      {
        id: "simplifying-radicals",
        title: "Simplifying Radicals",
        description: "Simplify square roots and higher-order radicals.",
        learningGoal: "Simplify radical expressions.",
        keyIdea: "Factor out perfect squares from under the radical.",
        video: SKILL_VIDEOS["simplifying-radicals"],
        problems: [
          { id: "ex4-p1", type: "multiple-choice", prompt: "Simplify √72", hint: "72 = 36 × 2", answer: "6√2", choices: ["6√2", "36√2", "8√2", "3√6"], explanation: "find the biggest perfect square factor: 72 = 36 × 2 → √72 = √36 × √2 → √36 = 6, so √72 = 6√2" },
          { id: "ex4-p2", type: "numeric", prompt: "Simplify √49", hint: "What number squared equals 49?", answer: 7, explanation: "find the number whose square is 49 → 7 × 7 = 49, so √49 = 7" },
        ],
      },
    ],
  },
  {
    id: "exponential-growth-decay",
    number: 10,
    title: "Exponential Growth & Decay",
    description: "Model real-world growth and decay with exponential functions.",
    icon: "📉",
    skills: [
      {
        id: "exponential-functions",
        title: "Exponential Functions",
        description: "Recognize, evaluate and read y = abˣ.",
        learningGoal: "Identify exponential functions, their starting value, and growth or decay.",
        keyIdea: "Exponential functions have a constant multiplier (base b).",
        video: SKILL_VIDEOS["exponential-functions"],
        problems: [
          { id: "eg1-p1", type: "multiple-choice", prompt: "Which is an exponential function?", hint: "Variable in the exponent.", answer: "y = 3(2)ˣ", choices: ["y = 3(2)ˣ", "y = 2x + 3", "y = x²", "y = 3/x"], explanation: "an exponential function has x in the exponent → in y = 3(2)ˣ the x is the exponent; the others have x in a base or a bottom → y = 3(2)ˣ" },
          { id: "eg1-p2", type: "numeric", prompt: "Evaluate f(x) = 2(3)ˣ at x = 2.", hint: "2 × 3²", answer: 18, explanation: "f(2) = 2(3)² → 3² = 9 → 2 × 9 = 18" },
        ],
      },
      {
        id: "exponential-growth",
        title: "Exponential Growth",
        description: "Model population growth and compound interest.",
        learningGoal: "Write and use exponential growth models.",
        keyIdea: "Growth: y = a(1 + r)ᵗ where r is the growth rate.",
        video: SKILL_VIDEOS["exponential-growth"],
        problems: [
          { id: "eg2-p1", type: "numeric", prompt: "$1000 invested at 5% annual interest. Value after 2 years? (compound annually, round to the hundredths place, the nearest cent)", hint: "1000(1.05)²", answer: 1102.5, decimalPlaces: 2, explanation: "each year multiplies the money by 1 + 0.05 = 1.05 → after 2 years: 1000 × 1.05² → 1.05² = 1.1025 → 1000 × 1.1025 = $1102.50" },
        ],
      },
      {
        id: "exponential-decay",
        title: "Exponential Decay",
        description: "Model depreciation and radioactive decay.",
        learningGoal: "Write and use exponential decay models.",
        keyIdea: "Decay: y = a(1 − r)ᵗ where r is the decay rate.",
        video: SKILL_VIDEOS["exponential-decay"],
        problems: [
          { id: "eg3-p1", type: "numeric", prompt: "A car worth $20,000 depreciates 15% per year. Value after 1 year?", hint: "20000(0.85)", answer: 17000, explanation: "losing 15% leaves 100% − 15% = 85% → 85% = 0.85 → $20,000 × 0.85 = $17,000" },
        ],
      },
    ],
  },
  {
    id: "quadratics-factoring",
    number: 11,
    title: "Quadratics: Multiplying & Factoring",
    description: "Multiply polynomials and factor quadratic expressions.",
    icon: "✖️",
    skills: [
      {
        id: "multiplying-binomials",
        title: "Multiplying Binomials",
        description: "Use FOIL and the distributive property.",
        learningGoal: "Multiply binomials using FOIL.",
        keyIdea: "FOIL: First, Outer, Inner, Last.",
        video: SKILL_VIDEOS["multiplying-binomials"],
        problems: [
          { id: "q1-p1", type: "multiple-choice", prompt: "Expand (x + 3)(x + 5)", hint: "Use FOIL.", answer: "x² + 8x + 15", choices: ["x² + 8x + 15", "x² + 15x + 8", "2x² + 8", "x² + 2x + 15"], explanation: "multiply each term by each term: x(x) + x(5) + 3(x) + 3(5) → x² + 5x + 3x + 15 → combine like terms: x² + 8x + 15" },
          { id: "q1-p2", type: "multiple-choice", prompt: "Expand (x − 2)(x + 7)", hint: "Watch the signs.", answer: "x² + 5x − 14", choices: ["x² + 5x − 14", "x² + 5x + 14", "x² − 5x − 14", "x² − 9x − 14"], explanation: "multiply each term by each term: x(x) + x(7) − 2(x) − 2(7) → x² + 7x − 2x − 14 → combine like terms: x² + 5x − 14" },
        ],
      },
      {
        id: "special-products",
        title: "Special Products",
        description: "Recognize perfect square trinomials and difference of squares.",
        learningGoal: "Identify and expand special polynomial products.",
        keyIdea: "(a + b)² = a² + 2ab + b². (a + b)(a − b) = a² − b².",
        video: SKILL_VIDEOS["special-products"],
        problems: [
          { id: "q2-p1", type: "multiple-choice", prompt: "Expand (x + 4)²", hint: "Don't forget the middle term!", answer: "x² + 8x + 16", choices: ["x² + 8x + 16", "x² + 16", "x² + 4x + 16", "x² + 16x + 16"], explanation: "(x + 4)² = (x + 4)(x + 4) → x² + 4x + 4x + 16 → combine like terms: x² + 8x + 16" },
          { id: "q2-p2", type: "multiple-choice", prompt: "Expand (x + 3)(x − 3)", hint: "Difference of squares.", answer: "x² − 9", choices: ["x² − 9", "x² + 9", "x² − 6", "x² − 3"], explanation: "multiply each term by each term: x² − 3x + 3x − 9 → the x terms cancel → x² − 9" },
        ],
      },
      {
        id: "factoring-trinomials",
        title: "Factoring Trinomials",
        description: "Factor x² + bx + c and ax² + bx + c.",
        learningGoal: "Factor quadratic trinomials.",
        keyIdea: "Find two numbers that multiply to c and add to b.",
        video: SKILL_VIDEOS["factoring-trinomials"],
        generatorKey: "factor-trinomial",
        problems: [
          { id: "q3-p1", type: "multiple-choice", prompt: "Factor x² + 7x + 12", hint: "Numbers that multiply to 12, add to 7.", answer: "(x + 3)(x + 4)", choices: ["(x + 3)(x + 4)", "(x + 2)(x + 6)", "(x + 1)(x + 12)", "(x − 3)(x − 4)"], explanation: "find two numbers that multiply to 12 and add to 7 → 3 × 4 = 12 and 3 + 4 = 7 → x² + 7x + 12 = (x + 3)(x + 4)" },
          { id: "q3-p2", type: "multiple-choice", prompt: "Factor x² − 5x + 6", hint: "Both numbers should be negative.", answer: "(x − 2)(x − 3)", choices: ["(x − 2)(x − 3)", "(x + 2)(x + 3)", "(x − 1)(x − 6)", "(x − 5)(x − 1)"], explanation: "find two numbers that multiply to 6 and add to −5 → (−2)(−3) = 6 and (−2) + (−3) = −5 → x² − 5x + 6 = (x − 2)(x − 3)" },
        ],
      },
      {
        id: "factoring-special",
        title: "Factoring Special Cases",
        description: "Factor difference of squares and perfect square trinomials.",
        learningGoal: "Factor using special patterns.",
        keyIdea: "a² − b² = (a+b)(a−b). a² + 2ab + b² = (a+b)².",
        video: SKILL_VIDEOS["factoring-special"],
        problems: [
          { id: "q4-p1", type: "multiple-choice", prompt: "Factor x² − 25", hint: "Difference of squares.", answer: "(x + 5)(x − 5)", choices: ["(x + 5)(x − 5)", "(x − 5)²", "(x + 25)(x − 1)", "Cannot factor"], explanation: "25 = 5², so x² − 25 = x² − 5², a difference of squares → a² − b² = (a + b)(a − b) → x² − 25 = (x + 5)(x − 5)" },
        ],
      },
    ],
  },
  {
    id: "quadratic-functions",
    number: 12,
    title: "Quadratic Functions & Equations",
    description: "Read a parabola's key features from its equation and solve quadratic equations.",
    icon: "⌒",
    skills: [
      {
        id: "graphing-parabolas",
        title: "Graphing Parabolas",
        description: "Read a parabola's direction, vertex and axis of symmetry from its equation.",
        learningGoal: "Identify the direction, vertex and axis of symmetry of a parabola from its equation.",
        keyIdea: "Parabolas are U-shaped. Vertex is the turning point.",
        video: SKILL_VIDEOS["graphing-parabolas"],
        problems: [
          { id: "qf1-p1", type: "multiple-choice", prompt: "Does y = −x² + 4 open up or down?", hint: "Check the sign of a in ax² + bx + c.", answer: "Down", choices: ["Up", "Down", "Left", "Right"], explanation: "the sign of a, the number times x², decides the direction → here a = −1, which is negative → a negative a opens Down" },
          { id: "qf1-p2", type: "numeric", prompt: "What is the x-coordinate of the vertex of y = (x − 3)² + 2?", hint: "Vertex form: (h, k) from (x − h)² + k", answer: 3, explanation: "vertex form y = (x − h)² + k has its vertex at (h, k) → here h = 3 and k = 2, so the vertex is (3, 2) → its x-coordinate is 3" },
        ],
      },
      {
        id: "solving-by-factoring",
        title: "Solving by Factoring",
        description: "Use the zero product property to solve quadratics.",
        learningGoal: "Solve quadratic equations by factoring.",
        keyIdea: "If ab = 0, then a = 0 or b = 0.",
        video: SKILL_VIDEOS["solving-by-factoring"],
        problems: [
          { id: "qf2-p1", type: "numeric", prompt: "Solve x² − 5x + 6 = 0. Smaller root?", hint: "Factor: (x−2)(x−3) = 0", answer: 2, explanation: "factor: (x − 2)(x − 3) = 0 → x − 2 = 0 or x − 3 = 0 → x = 2 or x = 3, so the smaller root is 2" },
          { id: "qf2-p2", type: "numeric", prompt: "Solve x² − 9 = 0. Positive root?", hint: "Difference of squares.", answer: 3, explanation: "add 9 to both sides: x² = 9 → x = 3 or x = −3 → the positive root is 3" },
        ],
      },
      {
        id: "completing-square",
        title: "Completing the Square",
        description: "Convert to vertex form by completing the square.",
        learningGoal: "Solve quadratics by completing the square.",
        keyIdea: "Add (b/2)² to both sides to create a perfect square trinomial.",
        video: SKILL_VIDEOS["completing-square"],
        problems: [
          { id: "qf3-p1", type: "multiple-choice", prompt: "Complete the square: x² + 6x + ___ = (x + 3)²", hint: "(6/2)² = ?", answer: "9", choices: ["9", "6", "3", "36"], explanation: "take half of the x coefficient: 6 ÷ 2 = 3 → square it: 3² = 9 → x² + 6x + 9 = (x + 3)²" },
        ],
      },
      {
        id: "quadratic-formula",
        title: "The Quadratic Formula",
        description: "Use the quadratic formula and the discriminant to solve quadratics.",
        learningGoal: "Apply the quadratic formula to solve equations.",
        keyIdea: "x = (−b ± √(b² − 4ac)) / 2a",
        video: SKILL_VIDEOS["quadratic-formula"],
        generatorKey: "quadratic-formula",
        problems: [
          { id: "qf4-p1", type: "numeric", prompt: "Solve x² − 4x + 3 = 0. Smaller root?", hint: "Factor or use formula.", answer: 1, explanation: "factor: (x − 1)(x − 3) = 0 → x = 1 or x = 3 → the smaller root is 1" },
          { id: "qf4-p2", type: "multiple-choice", prompt: "For x² + 2x + 5 = 0, how many real solutions?", hint: "Discriminant = 4 − 20 = −16", answer: "0", choices: ["0", "1", "2", "Infinitely many"], explanation: "discriminant: b² − 4ac = 2² − 4(1)(5) → 4 − 20 = −16 → a negative discriminant means 0 real solutions" },
        ],
      },
    ],
  },
  {
    id: "absolute-value-piecewise",
    number: 13,
    title: "Absolute Value & Piecewise Functions",
    description: "Work with absolute value equations and piecewise-defined functions.",
    icon: "|x|",
    skills: [
      {
        id: "absolute-value",
        title: "Absolute Value Equations",
        description: "Solve equations involving absolute value.",
        learningGoal: "Solve absolute value equations.",
        keyIdea: "|x| = a means x = a or x = −a (when a ≥ 0).",
        video: SKILL_VIDEOS["absolute-value"],
        problems: [
          { id: "av1-p1", type: "numeric", prompt: "Solve |x| = 7. Positive solution?", hint: "x = 7 or x = −7", answer: 7, explanation: "|x| = 7 means x is 7 away from 0 → x = 7 or x = −7 → the positive solution is 7" },
          { id: "av1-p2", type: "numeric", prompt: "Solve |x − 3| = 5. Smaller solution?", hint: "x − 3 = 5 or x − 3 = −5", answer: -2, explanation: "x − 3 is 5 away from 0: x − 3 = 5 or x − 3 = −5 → x = 5 + 3 = 8 or x = −5 + 3 = −2 → the smaller solution is −2" },
        ],
      },
      {
        id: "absolute-value-inequalities",
        title: "Absolute Value Inequalities",
        description: "Solve absolute value inequalities.",
        learningGoal: "Solve absolute value inequalities.",
        keyIdea: "|x| < a means −a < x < a. |x| > a means x < −a or x > a.",
        video: SKILL_VIDEOS["absolute-value-inequalities"],
        problems: [
          { id: "av2-p1", type: "multiple-choice", prompt: "Solve |x| < 4", hint: "Between −4 and 4.", answer: "−4 < x < 4", choices: ["−4 < x < 4", "x < 4", "x > −4", "x < −4 or x > 4"], explanation: "|x| < 4 means x is less than 4 away from 0 → so x is between −4 and 4: −4 < x < 4" },
        ],
      },
      {
        id: "piecewise-functions",
        title: "Piecewise Functions",
        description: "Evaluate piecewise-defined functions.",
        learningGoal: "Evaluate piecewise functions at given inputs.",
        keyIdea: "Different rules apply for different input ranges.",
        video: SKILL_VIDEOS["piecewise-functions"],
        problems: [
          { id: "av3-p1", type: "numeric", prompt: "f(x) = { x + 2 if x < 0; x² if x ≥ 0 }. Find f(−3).", hint: "−3 < 0, use first rule.", answer: -1, explanation: "−3 < 0, so use the piece x + 2 → f(−3) = −3 + 2 = −1" },
          { id: "av3-p2", type: "numeric", prompt: "f(x) = { x + 2 if x < 0; x² if x ≥ 0 }. Find f(3).", hint: "3 ≥ 0, use the second rule.", answer: 9, explanation: "3 ≥ 0, so use the piece x² → f(3) = 3² = 9" },
        ],
      },
    ],
  },
  {
    id: "data-statistics",
    number: 14,
    title: "Data & Statistics",
    description: "Summarize data with center and spread, predict with trend lines, and compare groups in two-way tables.",
    icon: "x̄",
    skills: [
      {
        id: "center-spread",
        title: "Center & Spread",
        description: "Find the mean, median and interquartile range, and see how an outlier pulls on each.",
        learningGoal: "Compute and compare the mean, median and IQR of a data set, and judge the effect of an outlier.",
        keyIdea: "The median and IQR hold steady when an outlier appears; the mean is pulled toward it.",
        video: SKILL_VIDEOS["center-spread"],
        problems: [
          { id: "ds1-p1", type: "numeric", prompt: "Find the median of 12, 7, 19, 7, 25, 15, 10.", hint: "Put the numbers in order first. The median is the one in the middle.", answer: 12, explanation: "In order: 7, 7, 10, 12, 15, 19, 25 → the middle value is 12" },
          { id: "ds1-p2", type: "numeric", prompt: "Find the interquartile range (IQR) of 3, 5, 8, 10, 13, 15, 21.", hint: "Q1 is the median of the lower half and Q3 of the upper half. IQR = Q3 − Q1.", answer: 10, explanation: "median 10 → Q1 = 5 and Q3 = 15 → IQR = 15 − 5 = 10" },
        ],
      },
      {
        id: "trend-lines",
        title: "Trend Lines & Correlation",
        description: "Predict with a line of fit, read its slope and intercept, and judge a correlation.",
        learningGoal: "Use a linear model to predict, interpret its slope and intercept in context, and read a correlation coefficient.",
        keyIdea: "A trend line's slope is the change in y for each 1 added to x. An r near 1 or −1 is a strong linear pattern, and a cause takes more than a correlation to show.",
        video: SKILL_VIDEOS["trend-lines"],
        problems: [
          { id: "ds2-p1", type: "numeric", prompt: "A line of fit for hours studied, x, and test score, y, is y = 6x + 55. What does the line predict when x = 4?", hint: "Put 4 in for x and work out y.", answer: 79, explanation: "put x = 4 into the line: y = 6(4) + 55 → 6(4) = 24 → y = 24 + 55 = 79" },
        ],
      },
      {
        id: "two-way-tables",
        title: "Two-Way Tables",
        description: "Find joint, marginal and conditional relative frequencies from survey counts, and compare groups.",
        learningGoal: "Interpret relative frequencies from a two-way table, including conditional ones, and compare groups by rate.",
        keyIdea: "A conditional relative frequency divides by the total of the group you are given, not the grand total.",
        video: SKILL_VIDEOS["two-way-tables"],
        problems: [
          { id: "ds3-p1", type: "numeric", prompt: "A survey asked 9th graders and 10th graders whether they walk to school or ride the bus. 24 of the 9th graders walk and 36 ride the bus; 30 of the 10th graders walk and 20 ride the bus. What fraction of the 9th graders walk to school? Give it as a fraction.", hint: "Only the 9th graders count: divide by their total.", answer: 0.4, explanation: "all the 9th graders: 24 + 36 = 60 → the walkers out of all of them: 24/60 → divide top and bottom by 12: 2/5" },
        ],
      },
    ],
  },
  {
    id: "modeling-functions",
    number: 15,
    title: "Modeling with Functions",
    description: "Rearrange formulas, transform functions, and choose between linear and exponential models.",
    icon: "↦",
    skills: [
      {
        id: "literal-equations",
        title: "Literal Equations",
        description: "Solve a formula for any one of its letters, then use it.",
        learningGoal: "Rearrange a formula to isolate a chosen variable, then evaluate it.",
        keyIdea: "Solve for a letter the way you solve for x: undo each operation in reverse order.",
        video: SKILL_VIDEOS["literal-equations"],
        problems: [
          { id: "mf1-p1", type: "numeric", prompt: "A rectangle's area is A = lw. Solve for w, then find w when A = 72 and l = 9.", hint: "w is multiplied by l, so divide both sides by l.", answer: 8, explanation: "divide both sides of A = lw by l: w = A/l → w = 72 ÷ 9 = 8" },
        ],
      },
      {
        id: "function-transformations",
        title: "Transforming Functions",
        description: "Shift, stretch and reflect a function by changing its rule.",
        learningGoal: "Describe and apply shifts, stretches and reflections of a function from its rule.",
        keyIdea: "f(x) + k moves it up k. f(x − h) moves it right h. −f(x) flips it over the x-axis. a·f(x) stretches it by a.",
        video: SKILL_VIDEOS["function-transformations"],
        problems: [
          { id: "mf2-p1", type: "multiple-choice", prompt: "Move y = x² right 2 units and up 3 units. Which equation is the result?", hint: "A move right goes inside with a minus. A move up is added at the end.", answer: "y = (x − 2)² + 3", choices: ["y = (x − 2)² + 3", "y = (x + 2)² + 3", "y = (x − 2)² − 3", "y = (x − 3)² + 2"], explanation: "right 2: x becomes x − 2, so y = (x − 2)² → up 3: add 3 to the whole right side → y = (x − 2)² + 3" },
        ],
      },
      {
        id: "linear-vs-exponential",
        title: "Linear vs. Exponential Models",
        description: "Tell linear change from exponential change, and continue each from a table or a story.",
        learningGoal: "Distinguish linear from exponential relationships and use either model to predict.",
        keyIdea: "Linear change adds the same amount each step; exponential change multiplies by the same factor.",
        video: SKILL_VIDEOS["linear-vs-exponential"],
        problems: [
          { id: "mf3-p1", type: "multiple-choice", prompt: "When x is 0, 1, 2, 3, y is 3, 6, 12, 24. Is the relationship linear, exponential, or neither?", hint: "Check the differences between y-values, then the ratios.", answer: "Exponential", choices: ["Linear", "Exponential", "Neither"], explanation: "ratios: 6 ÷ 3 = 2, 12 ÷ 6 = 2, 24 ÷ 12 = 2 → every step multiplies by the same 2 → a constant ratio means Exponential" },
        ],
      },
    ],
  },
];

export type CourseId = "algebra-1" | "algebra-2";
export interface Course {
  id: CourseId;
  title: string;
  units: Unit[];
}

/**
 * The courses on the platform. `units` above stays Algebra 1, which every
 * count-keyed system (prizes, beds, marks, certificates) is built on; the
 * lookups below search every course so a unit or skill page works for both.
 */
export const COURSES: Course[] = [
  { id: "algebra-1", title: "Algebra 1", units },
  { id: "algebra-2", title: "Algebra 2", units: algebra2Units },
];

export function allUnits(): Unit[] {
  return COURSES.flatMap((c) => c.units);
}

export function courseOfUnit(unitId: string): Course | undefined {
  return COURSES.find((c) => c.units.some((u) => u.id === unitId));
}

export function courseOfSkill(skillId: string): Course | undefined {
  return COURSES.find((c) => c.units.some((u) => u.skills.some((s) => s.id === skillId)));
}

export function getUnit(id: string): Unit | undefined {
  return allUnits().find((u) => u.id === id);
}

export function getSkill(unitId: string, skillId: string) {
  const unit = getUnit(unitId);
  return unit?.skills.find((s) => s.id === skillId);
}

export function getAllSkillIds(): string[] {
  return allUnits().flatMap((u) => u.skills.map((s) => s.id));
}

export function getNextSkill(unitId: string, skillId: string) {
  const unit = getUnit(unitId);
  if (!unit) return null;
  const idx = unit.skills.findIndex((s) => s.id === skillId);
  if (idx >= 0 && idx < unit.skills.length - 1) {
    return { unitId, skill: unit.skills[idx + 1] };
  }
  const course = courseOfUnit(unitId)?.units ?? units;
  const unitIdx = course.findIndex((u) => u.id === unitId);
  if (unitIdx >= 0 && unitIdx < course.length - 1) {
    return { unitId: course[unitIdx + 1].id, skill: course[unitIdx + 1].skills[0] };
  }
  return null;
}

export function getPrevSkill(unitId: string, skillId: string) {
  const unit = getUnit(unitId);
  if (!unit) return null;
  const idx = unit.skills.findIndex((s) => s.id === skillId);
  if (idx > 0) {
    return { unitId, skill: unit.skills[idx - 1] };
  }
  const course = courseOfUnit(unitId)?.units ?? units;
  const unitIdx = course.findIndex((u) => u.id === unitId);
  if (unitIdx > 0) {
    const prevUnit = course[unitIdx - 1];
    return { unitId: prevUnit.id, skill: prevUnit.skills[prevUnit.skills.length - 1] };
  }
  return null;
}

export const TOTAL_SKILLS = units.reduce((sum, u) => sum + u.skills.length, 0);
