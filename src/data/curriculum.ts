import type { Unit } from "@/types";
import { SKILL_VIDEOS } from "@/data/videos";

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
          { id: "u1-p1", type: "numeric", prompt: "Convert 3 miles to feet. (1 mile = 5280 ft)", hint: "Multiply 3 × 5280.", answer: 15840, explanation: "3 × 5280 = 15,840 feet" },
          { id: "u1-p2", type: "multiple-choice", prompt: "Which conversion factor converts inches to feet?", hint: "12 inches = 1 foot, divide inches by 12.", answer: "1 ft / 12 in", choices: ["12 in / 1 ft", "1 ft / 12 in", "12 ft / 1 in", "1 in / 12 ft"], explanation: "To convert inches to feet, multiply by 1 ft / 12 in." },
          { id: "u1-p3", type: "numeric", prompt: "A car travels 60 miles in 1 hour. How many feet per second is that?", hint: "Convert miles→feet, hours→seconds.", answer: 88, explanation: "60 mi/hr × 5280 ft/mi ÷ 3600 sec/hr = 88 ft/sec" },
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
          { id: "u1-p4", type: "numeric", prompt: "Convert 2.5 hours to seconds.", hint: "1 hour = 3600 seconds.", answer: 9000, explanation: "2.5 × 3600 = 9000 seconds" },
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
          { id: "u1-p6", type: "numeric", prompt: "A recipe needs 750 mL of milk. How many liters is that?", hint: "1000 mL = 1 L", answer: 0.75, explanation: "750 ÷ 1000 = 0.75 liters" },
          { id: "u1-p7", type: "multiple-choice", prompt: "You drive 150 miles using 5 gallons of gas. What is your fuel efficiency?", hint: "miles per gallon = miles ÷ gallons", answer: "30 mpg", choices: ["30 mpg", "750 mpg", "0.033 mpg", "155 mpg"], explanation: "150 ÷ 5 = 30 miles per gallon" },
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
          { id: "e1-p1", type: "numeric", prompt: "Solve for x: x + 7 = 15", hint: "Subtract 7 from both sides.", answer: 8, explanation: "x = 15 − 7 = 8" },
          { id: "e1-p2", type: "numeric", prompt: "Solve for x: 4x = 28", hint: "Divide both sides by 4.", answer: 7, explanation: "x = 28 ÷ 4 = 7" },
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
          { id: "e2-p1", type: "numeric", prompt: "Solve for x: 3x + 5 = 20", hint: "Subtract 5, then divide by 3.", answer: 5, explanation: "3x = 15 → x = 5" },
          { id: "e2-p2", type: "step-order", prompt: "Put these steps in the correct order to solve 2x − 8 = 14:", hint: "Undo subtraction before division.", correctOrder: [0, 1, 2], steps: ["Add 8 to both sides: 2x = 22", "Divide both sides by 2: x = 11", "Check: 2(11) − 8 = 14 ✓"], explanation: "Add/subtract first, then multiply/divide." },
          { id: "e2-p3", type: "numeric", prompt: "Solve for x: −2x + 10 = 4", hint: "Subtract 10, then divide by −2.", answer: 3, explanation: "−2x = −6 → x = 3" },
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
          { id: "e3-p1", type: "numeric", prompt: "Solve for x: 2(x + 3) = 16", hint: "Divide by 2 first, or distribute.", answer: 5, explanation: "x + 3 = 8 → x = 5" },
          { id: "e3-p2", type: "numeric", prompt: "Solve for x: 3x + 2 = x + 10", hint: "Get all x terms on one side.", answer: 4, explanation: "2x = 8 → x = 4" },
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
          { id: "e4-p1", type: "numeric", prompt: "Solve for x: x/3 + 2 = 7", hint: "Subtract 2, then multiply by 3.", answer: 15, explanation: "x/3 = 5 → x = 15" },
          { id: "e4-p2", type: "multiple-choice", prompt: "What is the LCD of 1/2, 1/3, and 1/6?", hint: "LCD = least common multiple of denominators.", answer: "6", choices: ["6", "12", "3", "18"], explanation: "LCM of 2, 3, 6 = 6" },
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
          { id: "e5-p1", type: "numeric", prompt: "Solve for x: 2x − 3 > 7. What number does x have to be greater than? Type just the number.", hint: "Add 3, divide by 2. x > ?", answer: 5, explanation: "2x > 10 → x > 5" },
          { id: "e5-p2", type: "multiple-choice", prompt: "When do you flip the inequality sign?", hint: "Think about multiplying by negative numbers.", answer: "When multiplying or dividing by a negative", choices: ["When adding a negative", "When multiplying or dividing by a negative", "When subtracting", "Never"], explanation: "Multiplying/dividing by negative reverses the inequality direction." },
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
          { id: "g1-p1", type: "multiple-choice", prompt: "In which quadrant is the point (−3, 4)?", hint: "Negative x, positive y.", answer: "Quadrant II", choices: ["Quadrant I", "Quadrant II", "Quadrant III", "Quadrant IV"], explanation: "(−, +) is Quadrant II." },
          { id: "g1-p2", type: "numeric", prompt: "What is the y-coordinate of point (5, −2)?", hint: "y comes second in (x, y).", answer: -2, explanation: "The y-coordinate is −2." },
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
          { id: "g2-p1", type: "numeric", prompt: "Find the slope between (1, 2) and (4, 8).", hint: "m = (8−2)/(4−1)", answer: 2, explanation: "m = 6/3 = 2" },
          { id: "g2-p2", type: "multiple-choice", prompt: "What is the slope of a horizontal line?", hint: "No rise, only run.", answer: "0", choices: ["0", "1", "Undefined", "−1"], explanation: "Horizontal lines have zero rise → slope = 0." },
          { id: "g2-p3", type: "multiple-choice", prompt: "What is the slope of a vertical line?", hint: "No run, division by zero.", answer: "Undefined", choices: ["0", "1", "Undefined", "−1"], explanation: "Vertical lines have undefined slope (run = 0)." },
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
          { id: "g3-p1", type: "multiple-choice", prompt: "What is the y-intercept of y = 3x − 4?", hint: "b in y = mx + b", answer: "−4", choices: ["3", "−4", "4", "−3"], explanation: "In y = 3x − 4, b = −4." },
          { id: "g3-p2", type: "numeric", prompt: "For y = 2x + 1, what is y when x = 3?", hint: "Substitute x = 3.", answer: 7, explanation: "y = 2(3) + 1 = 7" },
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
          { id: "g4-p1", type: "numeric", prompt: "Find the x-intercept of 2x + y = 10.", hint: "Set y = 0.", answer: 5, explanation: "2x = 10 → x = 5" },
          { id: "g4-p2", type: "numeric", prompt: "Find the y-intercept of 3x − 2y = 12.", hint: "Set x = 0.", answer: -6, explanation: "−2y = 12 → y = −6" },
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
          { id: "f1-p1", type: "multiple-choice", prompt: "Write the equation of a line with slope 3 and y-intercept −2.", hint: "y = mx + b", answer: "y = 3x − 2", choices: ["y = 3x − 2", "y = −2x + 3", "y = 3x + 2", "y = −2x − 3"], explanation: "m = 3, b = −2 → y = 3x − 2" },
          { id: "f1-p2", type: "numeric", prompt: "In y = −4x + 7, what is the slope?", hint: "m is the coefficient of x.", answer: -4, explanation: "The slope is −4." },
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
          { id: "f2-p1", type: "multiple-choice", prompt: "Line through (2, 5) with slope 3. Which is point-slope form?", hint: "y − y₁ = m(x − x₁)", answer: "y − 5 = 3(x − 2)", choices: ["y − 5 = 3(x − 2)", "y − 2 = 3(x − 5)", "y = 3x + 5", "y = 3x − 1"], explanation: "y − 5 = 3(x − 2)" },
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
          { id: "f3-p1", type: "multiple-choice", prompt: "Convert 2x + 4y = 8 to slope-intercept form.", hint: "Solve for y.", answer: "y = −½x + 2", choices: ["y = −½x + 2", "y = 2x + 4", "y = −2x + 8", "y = ½x − 2"], explanation: "4y = −2x + 8 → y = −½x + 2" },
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
          { id: "f4-p1", type: "numeric", prompt: "Line A has slope 2. What slope is perpendicular to A?", hint: "Negative reciprocal of 2.", answer: -0.5, explanation: "Perpendicular slope = −1/2 = −0.5" },
          { id: "f4-p2", type: "multiple-choice", prompt: "Which line is parallel to y = 3x + 1?", hint: "Same slope, different intercept.", answer: "y = 3x − 5", choices: ["y = 3x − 5", "y = −3x + 1", "y = ⅓x + 1", "y = −⅓x + 5"], explanation: "Parallel lines share slope m = 3." },
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
          { id: "s1-p1", type: "multiple-choice", prompt: "Where do y = x + 1 and y = −x + 5 intersect?", hint: "Set the equations equal.", answer: "(2, 3)", choices: ["(2, 3)", "(3, 2)", "(1, 4)", "(0, 5)"], explanation: "x + 1 = −x + 5 → x = 2, y = 3" },
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
          { id: "s2-p1", type: "numeric", prompt: "Solve: y = x + 2 and x + y = 8. What is x?", hint: "Substitute y = x + 2 into the second equation.", answer: 3, explanation: "x + (x + 2) = 8 → 2x = 6 → x = 3" },
          { id: "s2-p2", type: "numeric", prompt: "Solve: y = 2x and x + y = 9. What is y?", hint: "Substitute y = 2x.", answer: 6, explanation: "x + 2x = 9 → x = 3, y = 6" },
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
          { id: "s3-p1", type: "numeric", prompt: "Solve: x + y = 10 and x − y = 4. What is x?", hint: "Add the two equations.", answer: 7, explanation: "2x = 14 → x = 7" },
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
          { id: "s4-p1", type: "numeric", prompt: "Tickets cost $8 (adult) and $5 (child). 12 tickets sold for $78. How many adult tickets?", hint: "a + c = 12 and 8a + 5c = 78", answer: 6, explanation: "6 adult + 6 child: 48 + 30 = 78 ✓" },
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
          { id: "i1-p1", type: "multiple-choice", prompt: "y > 2x + 1: solid or dashed boundary line?", hint: "Strict inequality = not including the line.", answer: "Dashed", choices: ["Solid", "Dashed", "No line", "Either"], explanation: "y > (strict) uses a dashed boundary line." },
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
          { id: "i2-p1", type: "multiple-choice", prompt: "Solve: −3 < 2x + 1 < 9", hint: "Subtract 1 from all parts, then divide by 2.", answer: "−2 < x < 4", choices: ["−2 < x < 4", "−1 < x < 5", "−4 < x < 2", "x < 4"], explanation: "−4 < 2x < 8 → −2 < x < 4" },
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
          { id: "i3-p1", type: "multiple-choice", prompt: "Which point satisfies y ≤ x + 2 AND y > −1?", hint: "Test each point in both inequalities.", answer: "(0, 0)", choices: ["(0, 0)", "(0, 5)", "(−3, 0)", "(−2, −3)"], explanation: "(0, 0): 0 ≤ 2 ✓ and 0 > −1 ✓" },
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
          { id: "fn1-p1", type: "numeric", prompt: "If f(x) = 2x + 3, find f(4).", hint: "Replace x with 4.", answer: 11, explanation: "f(4) = 2(4) + 3 = 11" },
          { id: "fn1-p2", type: "numeric", prompt: "If g(x) = x² − 1, find g(−3).", hint: "Replace x with −3.", answer: 8, explanation: "g(−3) = 9 − 1 = 8" },
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
          { id: "fn2-p1", type: "multiple-choice", prompt: "What is the domain of f(x) = 1/(x − 2)?", hint: "Denominator cannot be zero.", answer: "All real numbers except 2", choices: ["All real numbers", "All real numbers except 2", "x > 2", "x ≥ 2"], explanation: "x = 2 makes denominator 0, so x ≠ 2." },
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
          { id: "fn3-p1", type: "multiple-choice", prompt: "A function graph passes through (0, 3) and (2, 7). What is the average rate of change?", hint: "(7−3)/(2−0)", answer: "2", choices: ["2", "3", "4", "7"], explanation: "(7−3)/(2−0) = 4/2 = 2" },
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
          { id: "sq1-p1", type: "numeric", prompt: "Sequence: 3, 7, 11, 15, ... What is the 10th term?", hint: "aₙ = a₁ + (n−1)d, d = 4", answer: 39, explanation: "a₁₀ = 3 + 9(4) = 39" },
          { id: "sq1-p2", type: "numeric", prompt: "What is the common difference in 5, 2, −1, −4, ...?", hint: "Subtract consecutive terms.", answer: -3, explanation: "2 − 5 = −3" },
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
          { id: "sq2-p1", type: "numeric", prompt: "Sequence: 81, 27, 9, 3, ... What is the common ratio? Give it as a fraction.", hint: "Divide any term by the one before it.", answer: 1 / 3, explanation: "27 ÷ 81 = 1/3: each term is a third of the one before." },
          { id: "sq2-p2", type: "numeric", prompt: "What is the 5th term of 3, 6, 12, 24, ...?", hint: "Multiply by 2 each time.", answer: 48, explanation: "3 × 2⁴ = 48" },
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
          { id: "ex1-p1", type: "numeric", prompt: "Simplify: 2³ × 2⁴ (enter as a number)", hint: "Add exponents: 2^(3+4)", answer: 128, explanation: "2⁷ = 128" },
          { id: "ex1-p2", type: "multiple-choice", prompt: "Simplify: (x³)²", hint: "Multiply exponents.", answer: "x⁶", choices: ["x⁶", "x⁵", "x⁹", "2x³"], explanation: "(x³)² = x^(3×2) = x⁶" },
          { id: "ex1-p3", type: "numeric", prompt: "Simplify: 5⁰", hint: "Any nonzero number to the 0 power equals...", answer: 1, explanation: "5⁰ = 1" },
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
          { id: "ex2-p1", type: "numeric", prompt: "Evaluate 2^(−3). Write it as a fraction.", hint: "A negative exponent means one over the power: 1/2³.", answer: 0.125, explanation: "2^(−3) = 1/2³ = 1/8" },
          { id: "ex2-p2", type: "multiple-choice", prompt: "Rewrite ³√x as an exponent.", hint: "x^(1/n)", answer: "x^(1/3)", choices: ["x^(1/3)", "x³", "x^(−3)", "3x"], explanation: "³√x = x^(1/3)" },
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
          { id: "ex3-p1", type: "multiple-choice", prompt: "Write 450,000 in scientific notation.", hint: "Move decimal 5 places left.", answer: "4.5 × 10⁵", choices: ["4.5 × 10⁵", "45 × 10⁴", "4.5 × 10⁶", "0.45 × 10⁶"], explanation: "450,000 = 4.5 × 10⁵" },
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
          { id: "ex4-p1", type: "multiple-choice", prompt: "Simplify √72", hint: "72 = 36 × 2", answer: "6√2", choices: ["6√2", "36√2", "8√2", "3√6"], explanation: "√72 = √(36 × 2) = √36 × √2 = 6√2" },
          { id: "ex4-p2", type: "numeric", prompt: "Simplify √49", hint: "What number squared equals 49?", answer: 7, explanation: "√49 = 7" },
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
          { id: "eg1-p1", type: "multiple-choice", prompt: "Which is an exponential function?", hint: "Variable in the exponent.", answer: "y = 3(2)ˣ", choices: ["y = 3(2)ˣ", "y = 2x + 3", "y = x²", "y = 3/x"], explanation: "y = 3(2)ˣ has x in the exponent." },
          { id: "eg1-p2", type: "numeric", prompt: "Evaluate f(x) = 2(3)ˣ at x = 2.", hint: "2 × 3²", answer: 18, explanation: "2 × 9 = 18" },
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
          { id: "eg2-p1", type: "numeric", prompt: "$1000 invested at 5% annual interest. Value after 2 years? (compound annually, round to the hundredths place, the nearest cent)", hint: "1000(1.05)²", answer: 1102.5, decimalPlaces: 2, explanation: "1000 × 1.1025 = $1102.50" },
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
          { id: "eg3-p1", type: "numeric", prompt: "A car worth $20,000 depreciates 15% per year. Value after 1 year?", hint: "20000(0.85)", answer: 17000, explanation: "$20,000 × 0.85 = $17,000" },
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
          { id: "q1-p1", type: "multiple-choice", prompt: "Expand (x + 3)(x + 5)", hint: "Use FOIL.", answer: "x² + 8x + 15", choices: ["x² + 8x + 15", "x² + 15x + 8", "2x² + 8", "x² + 2x + 15"], explanation: "x² + 5x + 3x + 15 = x² + 8x + 15" },
          { id: "q1-p2", type: "multiple-choice", prompt: "Expand (x − 2)(x + 7)", hint: "Watch the signs.", answer: "x² + 5x − 14", choices: ["x² + 5x − 14", "x² + 5x + 14", "x² − 5x − 14", "x² − 9x − 14"], explanation: "x² + 7x − 2x − 14 = x² + 5x − 14" },
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
          { id: "q2-p1", type: "multiple-choice", prompt: "Expand (x + 4)²", hint: "Don't forget the middle term!", answer: "x² + 8x + 16", choices: ["x² + 8x + 16", "x² + 16", "x² + 4x + 16", "x² + 16x + 16"], explanation: "(x+4)² = x² + 2(4x) + 16 = x² + 8x + 16" },
          { id: "q2-p2", type: "multiple-choice", prompt: "Expand (x + 3)(x − 3)", hint: "Difference of squares.", answer: "x² − 9", choices: ["x² − 9", "x² + 9", "x² − 6", "x² − 3"], explanation: "x² − 3² = x² − 9" },
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
          { id: "q3-p1", type: "multiple-choice", prompt: "Factor x² + 7x + 12", hint: "Numbers that multiply to 12, add to 7.", answer: "(x + 3)(x + 4)", choices: ["(x + 3)(x + 4)", "(x + 2)(x + 6)", "(x + 1)(x + 12)", "(x − 3)(x − 4)"], explanation: "3 × 4 = 12, 3 + 4 = 7" },
          { id: "q3-p2", type: "multiple-choice", prompt: "Factor x² − 5x + 6", hint: "Both numbers should be negative.", answer: "(x − 2)(x − 3)", choices: ["(x − 2)(x − 3)", "(x + 2)(x + 3)", "(x − 1)(x − 6)", "(x − 5)(x − 1)"], explanation: "(−2)(−3) = 6, (−2)+(−3) = −5" },
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
          { id: "q4-p1", type: "multiple-choice", prompt: "Factor x² − 25", hint: "Difference of squares.", answer: "(x + 5)(x − 5)", choices: ["(x + 5)(x − 5)", "(x − 5)²", "(x + 25)(x − 1)", "Cannot factor"], explanation: "x² − 5² = (x+5)(x−5)" },
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
          { id: "qf1-p1", type: "multiple-choice", prompt: "Does y = −x² + 4 open up or down?", hint: "Check the sign of a in ax² + bx + c.", answer: "Down", choices: ["Up", "Down", "Left", "Right"], explanation: "a = −1 < 0, so it opens downward." },
          { id: "qf1-p2", type: "numeric", prompt: "What is the x-coordinate of the vertex of y = (x − 3)² + 2?", hint: "Vertex form: (h, k) from (x − h)² + k", answer: 3, explanation: "The vertex is (3, 2), so its x-coordinate is 3." },
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
          { id: "qf2-p1", type: "numeric", prompt: "Solve x² − 5x + 6 = 0. Smaller root?", hint: "Factor: (x−2)(x−3) = 0", answer: 2, explanation: "x = 2 or x = 3. Smaller = 2." },
          { id: "qf2-p2", type: "numeric", prompt: "Solve x² − 9 = 0. Positive root?", hint: "Difference of squares.", answer: 3, explanation: "x = ±3. Positive = 3." },
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
          { id: "qf3-p1", type: "multiple-choice", prompt: "Complete the square: x² + 6x + ___ = (x + 3)²", hint: "(6/2)² = ?", answer: "9", choices: ["9", "6", "3", "36"], explanation: "(6/2)² = 9" },
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
          { id: "qf4-p1", type: "numeric", prompt: "Solve x² − 4x + 3 = 0. Smaller root?", hint: "Factor or use formula.", answer: 1, explanation: "(x−1)(x−3) = 0 → x = 1 or 3" },
          { id: "qf4-p2", type: "multiple-choice", prompt: "For x² + 2x + 5 = 0, how many real solutions?", hint: "Discriminant = 4 − 20 = −16", answer: "0", choices: ["0", "1", "2", "Infinitely many"], explanation: "Negative discriminant → no real solutions." },
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
          { id: "av1-p1", type: "numeric", prompt: "Solve |x| = 7. Positive solution?", hint: "x = 7 or x = −7", answer: 7, explanation: "x = ±7" },
          { id: "av1-p2", type: "numeric", prompt: "Solve |x − 3| = 5. Smaller solution?", hint: "x − 3 = 5 or x − 3 = −5", answer: -2, explanation: "x = 8 or x = −2" },
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
          { id: "av2-p1", type: "multiple-choice", prompt: "Solve |x| < 4", hint: "Between −4 and 4.", answer: "−4 < x < 4", choices: ["−4 < x < 4", "x < 4", "x > −4", "x < −4 or x > 4"], explanation: "|x| < 4 → −4 < x < 4" },
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
          { id: "av3-p1", type: "numeric", prompt: "f(x) = { x + 2 if x < 0; x² if x ≥ 0 }. Find f(−3).", hint: "−3 < 0, use first rule.", answer: -1, explanation: "f(−3) = −3 + 2 = −1" },
          { id: "av3-p2", type: "numeric", prompt: "f(x) = { x + 2 if x < 0; x² if x ≥ 0 }. Find f(3).", hint: "3 ≥ 0, use the second rule.", answer: 9, explanation: "f(3) = 3² = 9" },
        ],
      },
    ],
  },
];

export function getUnit(id: string): Unit | undefined {
  return units.find((u) => u.id === id);
}

export function getSkill(unitId: string, skillId: string) {
  const unit = getUnit(unitId);
  return unit?.skills.find((s) => s.id === skillId);
}

export function getAllSkillIds(): string[] {
  return units.flatMap((u) => u.skills.map((s) => s.id));
}

export function getNextSkill(unitId: string, skillId: string) {
  const unit = getUnit(unitId);
  if (!unit) return null;
  const idx = unit.skills.findIndex((s) => s.id === skillId);
  if (idx >= 0 && idx < unit.skills.length - 1) {
    return { unitId, skill: unit.skills[idx + 1] };
  }
  const unitIdx = units.findIndex((u) => u.id === unitId);
  if (unitIdx >= 0 && unitIdx < units.length - 1) {
    return { unitId: units[unitIdx + 1].id, skill: units[unitIdx + 1].skills[0] };
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
  const unitIdx = units.findIndex((u) => u.id === unitId);
  if (unitIdx > 0) {
    const prevUnit = units[unitIdx - 1];
    return { unitId: prevUnit.id, skill: prevUnit.skills[prevUnit.skills.length - 1] };
  }
  return null;
}

export const TOTAL_SKILLS = units.reduce((sum, u) => sum + u.skills.length, 0);
