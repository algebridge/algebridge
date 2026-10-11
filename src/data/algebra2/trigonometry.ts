import type { Unit } from "@/types";
import { videoFor } from "@/data/algebra2/shared";

export const unit: Unit = {
  id: "trigonometry",
  number: 8,
  title: "Trigonometry",
  description: "Radians, the unit circle, and reference angles.",
  icon: "",
  skills: [
    {
      id: "radians-degrees",
      title: "Radians and Degrees",
      description: "Switch an angle between degrees and radians, and use radians to measure an arc.",
      learningGoal: "Convert between degrees and radians in both directions and find an arc length from a radius and a central angle.",
      keyIdea: "180° is π radians, so multiply degrees by π/180 to get radians and radians by 180/π to get degrees; an arc is s = rθ with θ in radians.",
      video: videoFor("radians-degrees"),
      problems: [
        {
          id: "a2-rd-p1",
          type: "multiple-choice",
          prompt: "Convert 150° to radians.",
          hint: "Multiply by π/180, then reduce the fraction 150/180.",
          answer: "5π/6",
          choices: ["5π/6", "5π/3", "π/6", "5/6"],
          traps: [
            { value: "5π/3", why: "150/180 reduces by 30: the bottom becomes 6, not 3.", step: 2 },
            { value: "π/6", why: "150/180 is not 1/6. Divide both numbers by 30.", step: 2 },
            { value: "5/6", why: "The radian measure keeps the π: 150 × π/180.", step: 0 },
          ],
          explanation: "multiply by π/180: 150 × π/180 = 150π/180 → the greatest common factor of 150 and 180 is 30 → divide top and bottom by 30: 150π/180 = 5π/6",
        },
        {
          id: "a2-rd-p2",
          type: "numeric",
          prompt: "Convert 3π/4 radians to degrees.",
          hint: "Replace π with 180°: 3 × 180°/4.",
          answer: 135,
          traps: [
            { value: 240, why: "The fraction is 3/4 of 180°, not 4/3 of it.", step: 0 },
            { value: 0.75, why: "That drops the π. Each π is 180°.", step: 0 },
          ],
          explanation: "each π is 180°: 3π/4 = 3 × 180° ÷ 4 → 3 × 180° = 540° → 540° ÷ 4 = 135°",
        },
      ],
    },
    {
      id: "unit-circle-values",
      title: "Unit Circle Values",
      description: "Read exact sine, cosine and tangent values straight off the unit circle, with the right sign for the quadrant.",
      learningGoal: "Give exact trig values for the special angles in degrees and radians, place an angle in its quadrant, and know the sign of each function there.",
      keyIdea: "On the unit circle cos θ is the x-coordinate and sin θ is the y-coordinate, so the quadrant tells you the signs and the special triangles tell you the sizes.",
      video: videoFor("unit-circle-values"),
      problems: [
        {
          id: "a2-uc-p1",
          type: "multiple-choice",
          prompt: "Find the exact value of sin 150°.",
          hint: "150° is in Quadrant II, where sine is positive, and its reference angle is 30°.",
          answer: "1/2",
          choices: ["1/2", "−1/2", "√3/2", "−√3/2"],
          traps: [
            { value: "−1/2", why: "Sine is the y-coordinate, and y is positive in Quadrant II.", step: 2 },
            { value: "√3/2", why: "That is the cosine of the 30° reference angle, not the sine.", step: 1 },
            { value: "−√3/2", why: "Check both the function and the sign: sine is positive in Quadrant II.", step: 1 },
          ],
          explanation: "150° is in Quadrant II, with reference angle 180° − 150° = 30° → sin 30° = 1/2 → sin is positive in Quadrant II → sin 150° = 1/2",
        },
        {
          id: "a2-uc-p2",
          type: "numeric",
          prompt: "In which quadrant does an angle of 250° in standard position lie? (answer 1, 2, 3 or 4)",
          hint: "Quadrant I is 0° to 90°, II is 90° to 180°, III is 180° to 270°, IV is 270° to 360°.",
          answer: 3,
          traps: [
            { value: 4, why: "250° has not reached 270° yet, so it has not crossed into the fourth quadrant.", step: 0 },
            { value: 2, why: "250° is past 180°, so it is below the x-axis.", step: 0 },
          ],
          explanation: "180° < 250° < 270° → that is Quadrant III, so the answer is 3",
        },
      ],
    },
    {
      id: "reference-angles",
      title: "Reference Angles",
      description: "Fold any angle back to the acute angle it makes with the x-axis, and use it to find trig values anywhere on the circle.",
      learningGoal: "Find reference angles and coterminal angles for angles in degrees and radians, and use the quadrant to find one trig value from another.",
      keyIdea: "A reference angle is the acute angle between the terminal side and the x-axis; the size of a trig value comes from it, and the sign comes from the quadrant.",
      video: videoFor("reference-angles"),
      problems: [
        {
          id: "a2-ra-p1",
          type: "numeric",
          prompt: "Find the reference angle of 210°.",
          hint: "210° is in Quadrant III, so measure from 180°.",
          answer: 30,
          traps: [
            { value: 150, why: "360° − 210° measures to the wrong side of the axis. In Quadrant III, subtract 180°.", step: 1 },
            { value: 210, why: "A reference angle is always acute: between 0° and 90°.", step: 1 },
          ],
          explanation: "180° < 210° < 270°, so it is in Quadrant III → measure to the x-axis: 210° − 180° = 30°",
        },
        {
          id: "a2-ra-p2",
          type: "numeric",
          prompt: "Find the angle between 0° and 360° that is coterminal with -45°.",
          hint: "Add 360° until the angle lands between 0° and 360°.",
          answer: 315,
          traps: [
            { value: 45, why: "Changing the sign changes the angle. Add 360° instead.", step: 0 },
            { value: 135, why: "Adding 180° gives the opposite direction, not the same side.", step: 0 },
          ],
          explanation: "the angle is below 0°, so add full turns of 360° → 1 turn lands between 0° and 360°: −45° + 360° = 315°",
        },
      ],
    },
  ],
};
