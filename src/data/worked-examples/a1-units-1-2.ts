import type { WorkedExamples } from "./types";

/*
 * "See it done" for units 1 and 2: one solved problem per kind of card each
 * skill's practice deals. Every card is written the way its generator writes
 * it, so npm run test:problems checks each answer with the skill's solver.
 */
export const EXAMPLES: WorkedExamples = {
  "unit-basics": [
    {
      kind: "Choosing a conversion factor",
      card: {
        type: "multiple-choice",
        prompt: "Which conversion factor converts feet to inches? (1 ft = 12 in)",
        choices: ["12 in / 1 ft", "1 ft / 12 in", "12 ft / 1 in", "1 in / 12 ft"],
        answer: "12 in / 1 ft",
      },
      steps: [
        { work: "1 ft = 12 in", why: "The bigger number goes with the smaller unit." },
        { work: "feet on the bottom, inches on top", why: "The unit you are leaving goes on the bottom so it cancels." },
        { work: "12 in / 1 ft", why: "Multiplying by this turns feet into inches." },
      ],
      answer: "12 in / 1 ft",
    },
    {
      kind: "Converting and rounding",
      card: { type: "numeric", prompt: "Convert 50 inches to feet. (round to the hundredths place)", answer: 4.17, decimalPlaces: 2 },
      steps: [
        { work: "feet = inches ÷ 12", why: "12 inches make 1 foot, so divide by 12." },
        { work: "50 ÷ 12 ≈ 4.1667", why: "Divide past the hundredths place so you can round." },
        { work: "4.1667 rounds to 4.17", why: "The digit after the hundredths is 6, so round up." },
      ],
      answer: "4.17 feet",
    },
    {
      kind: "Convert, then subtract",
      card: {
        type: "numeric",
        prompt: "A hiking trail is 2.5 miles long. You have walked 6,500 feet of it. How many feet are left? (1 mile = 5,280 ft)",
        answer: 6700,
      },
      steps: [
        { work: "2.5 mi × 5,280 ft/mi = 13,200 ft", why: "Change miles to feet so both numbers use the same unit." },
        { work: "13,200 − 6,500 = 6,700 ft", why: "Take away the part already walked." },
      ],
      answer: "6,700 feet",
    },
    {
      kind: "Area in square yards",
      card: { type: "numeric", prompt: "A rug is 12 feet long and 9 feet wide. What is its area in square yards? (1 yard = 3 feet)", answer: 12 },
      steps: [
        { work: "length: 12 ft ÷ 3 = 4 yd", why: "3 feet make a yard, so divide each side by 3." },
        { work: "width: 9 ft ÷ 3 = 3 yd", why: "Do the same to the width." },
        { work: "area: 4 × 3 = 12 square yards", why: "Area is length times width." },
      ],
      answer: "12 square yards",
    },
    {
      kind: "A speed in new units",
      card: { type: "numeric", prompt: "A cyclist rides at 15 miles per hour. How many feet per minute is that? (1 mile = 5,280 ft)", answer: 1320 },
      steps: [
        { work: "15 mi/h × 5,280 ft/mi = 79,200 ft/h", why: "Miles cancel and leave feet per hour." },
        { work: "79,200 ÷ 60 = 1,320 ft per minute", why: "An hour has 60 minutes, so a minute gets a sixtieth." },
      ],
      answer: "1,320 feet per minute",
    },
    {
      kind: "Convert, then divide",
      card: { type: "numeric", prompt: "A cooler holds 6 liters of water. How many 500-milliliter bottles can you fill from it? (1 L = 1,000 mL)", answer: 12 },
      steps: [
        { work: "6 L × 1,000 mL/L = 6,000 mL", why: "Put the cooler in milliliters, the same unit as a bottle." },
        { work: "6,000 ÷ 500 = 12 bottles", why: "Dividing counts how many bottles fit." },
      ],
      answer: "12 bottles",
    },
    {
      kind: "Meters to kilometers",
      card: {
        type: "numeric",
        prompt: "One lap of a running track is 400 meters. You run 9 laps. How many kilometers is that? Write your answer as a decimal.",
        answer: 3.6,
      },
      steps: [
        { work: "9 × 400 m = 3,600 m", why: "Find the whole distance in meters first." },
        { work: "3,600 ÷ 1,000 = 3.6 km", why: "1,000 meters make a kilometer." },
      ],
      answer: "3.6 km",
    },
  ],

  "dimensional-analysis": [
    {
      kind: "Two factors in a row",
      card: { type: "numeric", prompt: "Convert 3 hours to seconds.", answer: 10800 },
      steps: [
        { work: "3 h × 60 min/h = 180 min", why: "Each hour is 60 minutes." },
        { work: "180 min × 60 s/min = 10,800 seconds", why: "Each minute is 60 seconds." },
      ],
      answer: "10,800 seconds",
    },
    {
      kind: "Days to minutes",
      card: { type: "numeric", prompt: "Convert 4 days to minutes.", answer: 5760 },
      steps: [
        { work: "4 days × 24 h/day = 96 h", why: "A day has 24 hours." },
        { work: "96 h × 60 min/h = 5,760 minutes", why: "Each hour has 60 minutes." },
      ],
      answer: "5,760 minutes",
    },
    {
      kind: "Convert, then share out",
      card: { type: "numeric", prompt: "A 6-kilogram sack of rice is split evenly into 8 bags. How many grams go in each bag?", answer: 750 },
      steps: [
        { work: "6 kg × 1,000 g/kg = 6,000 g", why: "Kilo means a thousand, so 1 kg is 1,000 g." },
        { work: "6,000 ÷ 8 = 750 grams per bag", why: "Split evenly means divide by the number of bags." },
      ],
      answer: "750 grams",
    },
    {
      kind: "Kilometers per hour to meters per second",
      card: { type: "numeric", prompt: "A cyclist rides at 36 kilometers per hour. How many meters per second is that?", answer: 10 },
      steps: [
        { work: "36 km/h × 1000 m/km = 36,000 m/h", why: "Each kilometer is 1000 meters." },
        { work: "36,000 m/h ÷ 3600 s/h = 10 meters per second", why: "An hour is 3600 seconds, so divide by 3600." },
      ],
      answer: "10 meters per second",
    },
    {
      kind: "Changing both units of a rate",
      card: { type: "numeric", prompt: "A toy car rolls 25 centimeters per second. How many meters per minute is that?", answer: 15 },
      steps: [
        { work: "25 cm/s × 60 s/min = 1,500 cm/min", why: "A minute is 60 seconds, so 60 times as far." },
        { work: "1,500 ÷ 100 = 15 meters per minute", why: "100 centimeters make a meter." },
      ],
      answer: "15 meters per minute",
    },
    {
      kind: "How many fit",
      card: { type: "numeric", prompt: "Every song on a playlist is 240 seconds long. How many songs fit in 2 hours?", answer: 30 },
      steps: [
        { work: "2 h × 3,600 s/h = 7,200 s", why: "Put the time in seconds, like the songs." },
        { work: "7,200 ÷ 240 = 30 songs", why: "Divide the total time by one song." },
      ],
      answer: "30 songs",
    },
    {
      kind: "Grams to kilograms",
      card: {
        type: "numeric",
        prompt: "A box holds 12 cans of beans, and each can weighs 450 grams. How many kilograms of beans are in the box? Write your answer as a decimal.",
        answer: 5.4,
      },
      steps: [
        { work: "12 × 450 g = 5,400 g", why: "Find the whole box in grams first." },
        { work: "5,400 ÷ 1,000 = 5.4 kilograms", why: "1,000 grams make a kilogram." },
      ],
      answer: "5.4 kilograms",
    },
    {
      kind: "Weeks to hours",
      card: { type: "numeric", prompt: "Convert 3 weeks to hours.", answer: 504 },
      steps: [
        { work: "3 weeks × 7 days/week = 21 days", why: "A week has 7 days." },
        { work: "21 days × 24 hours/day = 504 hours", why: "A day has 24 hours." },
      ],
      answer: "504 hours",
    },
    {
      kind: "Liters per hour to milliliters per minute",
      card: { type: "numeric", prompt: "A water tank leaks 6 liters per hour. How many milliliters per minute is that?", answer: 100 },
      steps: [
        { work: "6 L/h × 1000 mL/L = 6,000 mL/h", why: "Each liter is 1000 milliliters." },
        { work: "6,000 mL/h ÷ 60 min/h = 100 milliliters per minute", why: "An hour is 60 minutes, so divide by 60." },
      ],
      answer: "100 milliliters per minute",
    },
    {
      kind: "Yards to inches",
      card: { type: "numeric", prompt: "Convert 5 yards to inches.", answer: 180 },
      steps: [
        { work: "5 yd × 3 ft/yd = 15 ft", why: "A yard is 3 feet." },
        { work: "15 ft × 12 in/ft = 180 inches", why: "A foot is 12 inches." },
      ],
      answer: "180 inches",
    },
    {
      kind: "Minutes to milliseconds",
      card: { type: "numeric", prompt: "Convert 4 minutes to milliseconds.", answer: 240000 },
      steps: [
        { work: "4 min × 60 s/min = 240 s", why: "A minute is 60 seconds." },
        { work: "240 s × 1,000 ms/s = 240,000 milliseconds", why: "A second is 1,000 milliseconds." },
      ],
      answer: "240,000 milliseconds",
    },
  ],

  "unit-word-problems": [
    {
      kind: "Scaling a recipe",
      card: { type: "numeric", prompt: "A recipe makes 10 cookies with 3 cups of flour. How many cups of flour do you need for 30 cookies?", answer: 9 },
      steps: [
        { work: "30 ÷ 10 = 3 batches", why: "Find how many batches make 30 cookies." },
        { work: "3 × 3 = 9 cups of flour", why: "Each batch takes the full 3 cups again." },
      ],
      answer: "9 cups",
    },
    {
      kind: "Gas for a trip",
      card: {
        type: "numeric",
        prompt: "You drive 200 miles in a car that gets 25 miles per gallon. Gas costs $3.40 a gallon. How much does the gas for the trip cost? (round to the nearest cent)",
        answer: 27.2,
        decimalPlaces: 2,
      },
      steps: [
        { work: "200 ÷ 25 = 8 gallons", why: "Miles divided by miles per gallon gives gallons." },
        { work: "8 × $3.40 = $27.20", why: "Each gallon costs $3.40." },
      ],
      answer: "$27.20",
    },
    {
      kind: "Time from speed",
      card: { type: "numeric", prompt: "A train travels at 60 miles per hour. How many minutes does it take to go 45 miles?", answer: 45 },
      steps: [
        { work: "45 ÷ 60 = 0.75 hours", why: "Time is distance divided by speed." },
        { work: "0.75 × 60 = 45 minutes", why: "Each hour is 60 minutes." },
      ],
      answer: "45 minutes",
    },
    {
      kind: "Same pace, new distance",
      card: { type: "numeric", prompt: "A runner finishes 4 kilometers in 24 minutes. At the same pace, how many minutes would 10 kilometers take?", answer: 60 },
      steps: [
        { work: "24 ÷ 4 = 6 minutes per km", why: "Find the time for one kilometer first." },
        { work: "6 × 10 = 60 minutes", why: "Each kilometer takes 6 more minutes." },
      ],
      answer: "60 minutes",
    },
    {
      kind: "Comparing unit prices",
      card: {
        type: "numeric",
        prompt: "A 10-ounce bag of trail mix costs $3.00. A 20-ounce bag costs $5.00. How many cents more per ounce does the small bag cost?",
        answer: 5,
      },
      steps: [
        { work: "small bag: $3.00 ÷ 10 = 30¢ per ounce", why: "Price divided by ounces is the price of one ounce." },
        { work: "big bag: $5.00 ÷ 20 = 25¢ per ounce", why: "Do the same for the big bag." },
        { work: "30 − 25 = 5 cents", why: "Subtract to see how much more the small bag costs." },
      ],
      answer: "5 cents",
    },
    {
      kind: "A chain of factors",
      card: {
        type: "numeric",
        prompt: "A leaky faucet drips 5 milliliters every minute. How many liters does it waste in one week? Write your answer as a decimal.",
        answer: 50.4,
      },
      steps: [
        { work: "5 mL/min × 60 min/h = 300 mL per hour", why: "An hour has 60 minutes." },
        { work: "300 × 24 h/day = 7,200 mL per day", why: "A day has 24 hours." },
        { work: "7,200 × 7 days = 50,400 mL", why: "A week has 7 days." },
        { work: "50,400 ÷ 1,000 = 50.4 L", why: "1,000 milliliters make a liter." },
      ],
      answer: "50.4 liters",
    },
    {
      kind: "Miles per gallon",
      card: { type: "numeric", prompt: "You drive 224 miles using 7 gallons of gas. How many miles per gallon?", answer: 32 },
      steps: [
        { work: "miles per gallon means miles ÷ gallons", why: "Per means divide." },
        { work: "224 ÷ 7 = 32 miles per gallon", why: "Share the miles out over the gallons." },
      ],
      answer: "32 miles per gallon",
    },
  ],

  "one-step-equations": [
    {
      kind: "Undoing adding, with a negative answer",
      card: { type: "numeric", prompt: "Solve for x: x + 12 = 5", answer: -7 },
      steps: [
        { work: "x + 12 − 12 = 5 − 12", why: "Subtract 12 from both sides to undo adding 12." },
        { work: "x = -7", why: "5 − 12 goes below zero, so x is negative." },
      ],
      answer: "x = -7",
    },
    {
      kind: "Dividing by a negative",
      card: { type: "numeric", prompt: "Solve for x: -6x = 42", answer: -7 },
      steps: [
        { work: "-6x ÷ (-6) = 42 ÷ (-6)", why: "Divide both sides by -6 to undo multiplying by -6." },
        { work: "x = -7", why: "A positive divided by a negative is negative." },
      ],
      answer: "x = -7",
    },
    {
      kind: "Undoing dividing",
      card: { type: "numeric", prompt: "Solve for x: x/4 = -5", answer: -20 },
      steps: [
        { work: "x/4 × 4 = -5 × 4", why: "Multiply both sides by 4 to undo dividing by 4." },
        { work: "x = -20", why: "A negative times a positive stays negative." },
      ],
      answer: "x = -20",
    },
    {
      kind: "A fraction times x",
      card: { type: "numeric", prompt: "Solve for x: (3/4)x = 12", answer: 16 },
      steps: [
        { work: "x = 12 × 4/3", why: "Multiply by the reciprocal, 4/3, to undo 3/4." },
        { work: "12 × 4 = 48", why: "Multiply by the top of the reciprocal." },
        { work: "x = 48 ÷ 3 = 16", why: "Then divide by its bottom." },
      ],
      answer: "x = 16",
    },
    {
      kind: "Decimals",
      card: { type: "numeric", prompt: "Solve for x: x − 2.75 = 4.5", answer: 7.25 },
      steps: [
        { work: "x = 4.5 + 2.75", why: "Add 2.75 to both sides to undo subtracting it." },
        { work: "4.50 + 2.75 = 7.25", why: "Line up the decimal points, then add." },
      ],
      answer: "x = 7.25",
    },
    {
      kind: "A story to turn into an equation",
      card: {
        type: "numeric",
        prompt: "Sam bought a video game for $40 and snacks for $7, and has $23 left. How many dollars did Sam have before shopping?",
        answer: 70,
      },
      steps: [
        { work: "x − 40 − 7 = 23", why: "Call the money before x; both buys came out of it." },
        { work: "x − 47 = 23", why: "Add up what was spent." },
        { work: "x = 23 + 47 = 70 dollars", why: "Add back what was spent to undo taking it away." },
      ],
      answer: "$70",
    },
    {
      kind: "Splitting a bill",
      card: { type: "numeric", prompt: "4 friends split a dinner bill evenly. Each of them paid $15. How many dollars was the whole bill?", answer: 60 },
      steps: [
        { work: "x/4 = 15", why: "Call the bill x; split 4 ways, each paid 15." },
        { work: "x = 15 × 4 = 60 dollars", why: "Multiply by 4 to undo dividing by 4." },
      ],
      answer: "$60",
    },
  ],

  "two-step-equations": [
    {
      kind: "Undo the subtracting, then the multiplying",
      card: { type: "numeric", prompt: "Solve for x: 3x − 4 = 11", answer: 5 },
      steps: [
        { work: "3x = 11 + 4 = 15", why: "Add 4 to both sides first to undo subtracting 4." },
        { work: "x = 15 ÷ 3 = 5", why: "Then divide both sides by 3." },
      ],
      answer: "x = 5",
    },
    {
      kind: "A negative coefficient",
      card: { type: "numeric", prompt: "Solve for x: -4x + 7 = -9", answer: 4 },
      steps: [
        { work: "-4x = -9 − 7 = -16", why: "Subtract 7 from both sides to undo adding 7." },
        { work: "x = -16 ÷ (-4) = 4", why: "A negative divided by a negative is positive." },
      ],
      answer: "x = 4",
    },
    {
      kind: "x divided by a number",
      card: { type: "numeric", prompt: "Solve for x: x/5 − 3 = 2", answer: 25 },
      steps: [
        { work: "x/5 = 2 + 3 = 5", why: "Move the 3 first; it sits outside the fraction." },
        { work: "x = 5 × 5 = 25", why: "Multiply by 5 to undo dividing by 5." },
      ],
      answer: "x = 25",
    },
    {
      kind: "The x term taken away",
      card: { type: "numeric", prompt: "Solve for x: 20 − 3x = 5", answer: 5 },
      steps: [
        { work: "-3x = 5 − 20 = -15", why: "Subtract 20 from both sides; the x term is -3x." },
        { work: "x = -15 ÷ (-3) = 5", why: "Divide by -3, the whole coefficient, sign included." },
      ],
      answer: "x = 5",
    },
    {
      kind: "A fraction coefficient",
      card: { type: "numeric", prompt: "Solve for x: (2/3)x + 4 = 10", answer: 9 },
      steps: [
        { work: "(2/3)x = 10 − 4 = 6", why: "Subtract 4 from both sides first." },
        { work: "x = 6 × 3/2", why: "Multiply by the reciprocal, 3/2, to undo 2/3." },
        { work: "x = 18 ÷ 2 = 9", why: "6 times 3 is 18, then divide by 2." },
      ],
      answer: "x = 9",
    },
    {
      kind: "A fee plus a monthly price",
      card: {
        type: "numeric",
        prompt: "A gym charges a $30 sign-up fee plus $20 a month. Ana has paid $190 in all. How many months has Ana been a member?",
        answer: 8,
      },
      steps: [
        { work: "20m + 30 = 190", why: "Each month adds $20; the fee is paid once." },
        { work: "20m = 190 − 30 = 160", why: "Take the one-time fee off the total." },
        { work: "m = 160 ÷ 20 = 8 months", why: "Divide by the price of one month." },
      ],
      answer: "8 months",
    },
    {
      kind: "A decimal coefficient",
      card: { type: "numeric", prompt: "Solve for x: 2.5x − 3 = 12", answer: 6 },
      steps: [
        { work: "2.5x = 12 + 3 = 15", why: "Add 3 to both sides first." },
        { work: "x = 15 ÷ 2.5 = 6", why: "Divide by 2.5 to undo multiplying by it." },
      ],
      answer: "x = 6",
    },
    {
      kind: "A starting charge plus a price per mile",
      card: {
        type: "numeric",
        prompt: "A taxi charges $4 to start plus $3 for each mile. A ride cost $31. How many miles long was the ride?",
        answer: 9,
      },
      steps: [
        { work: "3m + 4 = 31", why: "Each mile adds $3; the start charge is paid once." },
        { work: "3m = 31 − 4 = 27", why: "Take the starting charge off the total." },
        { work: "m = 27 ÷ 3 = 9 miles", why: "Divide by the price of one mile." },
      ],
      answer: "9 miles",
    },
  ],

  "multi-step-equations": [
    {
      kind: "A bracket plus a number",
      card: { type: "numeric", prompt: "Solve for x: 3(x − 2) + 5 = 17", answer: 6 },
      steps: [
        { work: "3(x − 2) = 17 − 5 = 12", why: "Subtract 5 from both sides first." },
        { work: "x − 2 = 12 ÷ 3 = 4", why: "Divide by 3, which multiplies the whole bracket." },
        { work: "x = 4 + 2 = 6", why: "Add 2 to undo subtracting 2." },
      ],
      answer: "x = 6",
    },
    {
      kind: "x on both sides",
      card: { type: "numeric", prompt: "Solve for x: 7x − 4 = 3x + 12", answer: 4 },
      steps: [
        { work: "7x − 4 − 3x = 3x + 12 − 3x", why: "Subtract 3x from both sides to gather the x terms." },
        { work: "4x − 4 = 12", why: "7x − 3x is 4x." },
        { work: "4x = 12 + 4 = 16", why: "Add 4 to both sides." },
        { work: "x = 16 ÷ 4 = 4", why: "Divide both sides by 4." },
      ],
      answer: "x = 4",
    },
    {
      kind: "Like terms to combine first",
      card: { type: "numeric", prompt: "Solve for x: 4x + 3 + 2x = 2x + 23", answer: 5 },
      steps: [
        { work: "6x + 3 = 2x + 23", why: "Combine like terms: 4x + 2x is 6x." },
        { work: "4x + 3 = 23", why: "Subtract 2x from both sides." },
        { work: "4x = 23 − 3 = 20", why: "Subtract 3 from both sides." },
        { work: "x = 20 ÷ 4 = 5", why: "Divide both sides by 4." },
      ],
      answer: "x = 5",
    },
    {
      kind: "A negative in front of a bracket",
      card: { type: "numeric", prompt: "Solve for x: -2(3x − 4) = x − 6", answer: 2 },
      steps: [
        { work: "-6x + 8 = x − 6", why: "Distribute -2 to both terms; -2 times −4 is +8." },
        { work: "-7x + 8 = -6", why: "Subtract x from both sides: -6x − x is -7x." },
        { work: "-7x = -6 − 8 = -14", why: "Subtract 8 from both sides." },
        { work: "x = -14 ÷ (-7) = 2", why: "A negative divided by a negative is positive." },
      ],
      answer: "x = 2",
    },
    {
      kind: "Consecutive integers",
      card: { type: "numeric", prompt: "The sum of three consecutive integers is 48. What is the smallest of the three?", answer: 15 },
      steps: [
        { work: "n + (n + 1) + (n + 2) = 48", why: "Consecutive integers go up by 1 each time." },
        { work: "3n + 3 = 48", why: "Combine like terms." },
        { work: "3n = 48 − 3 = 45", why: "Subtract 3 from both sides." },
        { work: "n = 45 ÷ 3 = 15", why: "Divide by 3; n is the smallest one." },
      ],
      answer: "15",
    },
    {
      kind: "When two plans cost the same",
      card: {
        type: "numeric",
        prompt: "Phone plan A costs $15 a month plus $9 per GB of data. Plan B costs $27 a month plus $5 per GB. For how many GB do the plans cost the same?",
        answer: 3,
      },
      steps: [
        { work: "15 + 9g = 27 + 5g", why: "Set the two costs equal." },
        { work: "9g − 5g = 27 − 15, so 4g = 12", why: "Gather g terms on one side, numbers on the other." },
        { work: "g = 12 ÷ 4 = 3 GB", why: "Divide both sides by 4." },
      ],
      answer: "3 GB",
    },
    {
      kind: "Brackets on both sides",
      card: { type: "numeric", prompt: "Solve for x: 3(x − 2) + 2x = 2(x + 4) + 1", answer: 5 },
      steps: [
        { work: "3x − 6 + 2x = 2x + 8 + 1", why: "Distribute on both sides." },
        { work: "5x − 6 = 2x + 9", why: "Combine like terms on each side." },
        { work: "3x = 9 + 6 = 15", why: "Subtract 2x and add 6 on both sides." },
        { work: "x = 15 ÷ 3 = 5", why: "Divide both sides by 3." },
      ],
      answer: "x = 5",
    },
    {
      kind: "A rectangle's perimeter",
      card: {
        type: "numeric",
        prompt: "A rectangle's length is 4 cm more than twice its width. Its perimeter is 50 cm. What is its width, in cm?",
        answer: 7,
      },
      steps: [
        { work: "2(w + 2w + 4) = 50", why: "Perimeter is 2 times length plus width; the length is 2w + 4." },
        { work: "6w + 8 = 50", why: "Combine w + 2w, then distribute the 2." },
        { work: "6w = 50 − 8 = 42", why: "Subtract 8 from both sides." },
        { work: "w = 42 ÷ 6 = 7 cm", why: "Divide both sides by 6." },
      ],
      answer: "7 cm",
    },
    {
      kind: "A number times a bracket",
      card: { type: "numeric", prompt: "Solve for x: 4(x + 3) = 28", answer: 4 },
      steps: [
        { work: "x + 3 = 28 ÷ 4 = 7", why: "Divide both sides by 4, which multiplies the whole bracket." },
        { work: "x = 7 − 3 = 4", why: "Subtract 3 to undo adding 3." },
      ],
      answer: "x = 4",
    },
  ],

  "equations-with-fractions": [
    {
      kind: "Finding the least common denominator",
      card: {
        type: "multiple-choice",
        prompt: "What is the least common denominator of 1/4 and 1/6?",
        choices: ["12", "24", "6", "10"],
        answer: "12",
      },
      steps: [
        { work: "count up by 6: 6, 12, 18, 24", why: "List multiples of the biggest denominator." },
        { work: "6 ÷ 4 is not whole, 12 ÷ 4 = 3", why: "Check which multiple 4 divides into evenly." },
        { work: "12", why: "It is the smallest number both denominators divide into." },
      ],
      answer: "12",
    },
    {
      kind: "x over a number, plus a number",
      card: { type: "numeric", prompt: "Solve for x: x/3 + 4 = 9", answer: 15 },
      steps: [
        { work: "x/3 = 9 − 4 = 5", why: "Subtract 4 first; it is outside the fraction." },
        { work: "x = 5 × 3 = 15", why: "Multiply by 3 to undo dividing by 3." },
      ],
      answer: "x = 15",
    },
    {
      kind: "A number times x over a number",
      card: { type: "numeric", prompt: "Solve for x: 2x/5 + 3 = 7", answer: 10 },
      steps: [
        { work: "2x/5 = 7 − 3 = 4", why: "Subtract 3 from both sides." },
        { work: "2x = 4 × 5 = 20", why: "Multiply by 5 to clear the denominator." },
        { work: "x = 20 ÷ 2 = 10", why: "Divide by 2 to finish." },
      ],
      answer: "x = 10",
    },
    {
      kind: "Two fractions of x",
      card: { type: "numeric", prompt: "Solve for x: x/2 + x/3 = 10", answer: 12 },
      steps: [
        { work: "multiply every term by 6: 3x + 2x = 60", why: "6 is the least common denominator; the fractions clear." },
        { work: "5x = 60", why: "Combine like terms." },
        { work: "x = 60 ÷ 5 = 12", why: "Divide both sides by 5." },
      ],
      answer: "x = 12",
    },
    {
      kind: "A proportion",
      card: { type: "numeric", prompt: "Solve for x: (x + 2)/3 = (x + 6)/5", answer: 4 },
      steps: [
        { work: "5(x + 2) = 3(x + 6)", why: "Cross-multiply: each top times the other bottom." },
        { work: "5x + 10 = 3x + 18", why: "Distribute to both terms in each bracket." },
        { work: "2x = 8", why: "Subtract 3x and 10 from both sides." },
        { work: "x = 8 ÷ 2 = 4", why: "Divide both sides by 2." },
      ],
      answer: "x = 4",
    },
    {
      kind: "A fraction times a bracket",
      card: { type: "numeric", prompt: "Solve for x: (2/3)(x − 4) = 6", answer: 13 },
      steps: [
        { work: "multiply both sides by 3/2: x − 4 = 6 × 3/2", why: "The reciprocal undoes multiplying by 2/3." },
        { work: "x − 4 = 9", why: "6 times 3 is 18, and 18 ÷ 2 is 9." },
        { work: "x = 9 + 4 = 13", why: "Add 4 to undo subtracting 4." },
      ],
      answer: "x = 13",
    },
    {
      kind: "Fractions of x on both sides",
      card: { type: "numeric", prompt: "Solve for x: x/2 − 3 = x/4 + 1", answer: 16 },
      steps: [
        { work: "multiply every term by 4: 2x − 12 = x + 4", why: "4 is the least common denominator; the fractions clear." },
        { work: "subtract x from both sides: x − 12 = 4", why: "Gather the x terms on one side." },
        { work: "x = 4 + 12 = 16", why: "Add 12 to both sides." },
      ],
      answer: "x = 16",
    },
  ],

  "linear-inequalities": [
    {
      kind: "Solving for the boundary number",
      card: {
        type: "numeric",
        prompt: "Solve for x: 4x + 3 > 23. What number does x have to be greater than? Type just the number.",
        answer: 5,
      },
      steps: [
        { work: "4x > 23 − 3 = 20", why: "Subtract 3 from both sides, just like an equation." },
        { work: "x > 20 ÷ 4 = 5", why: "Dividing by a positive keeps the sign the same." },
      ],
      answer: "5",
    },
    {
      kind: "Dividing by a negative",
      card: {
        type: "multiple-choice",
        prompt: "Solve: -3x + 4 ≥ 19",
        choices: ["x ≤ -5", "x ≥ -5", "x ≤ 5", "x ≥ 5"],
        answer: "x ≤ -5",
      },
      steps: [
        { work: "-3x ≥ 19 − 4 = 15", why: "Subtract 4 from both sides." },
        { work: "x ≤ 15 ÷ (-3)", why: "Dividing by a negative flips the inequality sign." },
        { work: "x ≤ -5", why: "A positive divided by a negative is negative." },
      ],
      answer: "x ≤ -5",
    },
    {
      kind: "Multiplying by a negative",
      card: {
        type: "multiple-choice",
        prompt: "Solve: -x/2 + 3 < 7",
        choices: ["x > -8", "x < -8", "x > 8", "x < 8"],
        answer: "x > -8",
      },
      steps: [
        { work: "-x/2 < 7 − 3 = 4", why: "Subtract 3 from both sides." },
        { work: "x > 4 × (-2)", why: "Multiplying by -2 undoes -x/2 and flips the sign." },
        { work: "x > -8", why: "A positive times a negative is negative." },
      ],
      answer: "x > -8",
    },
    {
      kind: "x on both sides",
      card: {
        type: "multiple-choice",
        prompt: "Solve: 2x + 5 > 6x − 7",
        choices: ["x < 3", "x > 3", "x < -3", "x > -3"],
        answer: "x < 3",
      },
      steps: [
        { work: "subtract 6x from both sides: -4x + 5 > -7", why: "Gather the x terms on one side." },
        { work: "-4x > -7 − 5 = -12", why: "Subtract 5 from both sides." },
        { work: "x < -12 ÷ (-4) = 3", why: "Dividing by -4 flips the sign; negative over negative is positive." },
      ],
      answer: "x < 3",
    },
    {
      kind: "A negative in front of a bracket",
      card: {
        type: "multiple-choice",
        prompt: "Solve: -2(x − 3) ≤ x + 12",
        choices: ["x ≥ -2", "x ≤ -2", "x ≥ 2", "x ≤ 2"],
        answer: "x ≥ -2",
      },
      steps: [
        { work: "-2x + 6 ≤ x + 12", why: "Distribute -2 to both terms; -2 times −3 is +6." },
        { work: "-3x + 6 ≤ 12", why: "Subtract x from both sides." },
        { work: "-3x ≤ 12 − 6 = 6", why: "Subtract 6 from both sides." },
        { work: "x ≥ 6 ÷ (-3) = -2", why: "Dividing by -3 flips the inequality sign." },
      ],
      answer: "x ≥ -2",
    },
    {
      kind: "The most you can buy",
      card: {
        type: "numeric",
        prompt: "Mia has $50 to spend on a $14 shirt and some pairs of socks at $5 a pair. What is the greatest number of pairs of socks Mia can buy?",
        answer: 7,
      },
      steps: [
        { work: "5n + 14 ≤ 50", why: "The shirt is paid once; each pair adds $5." },
        { work: "5n ≤ 50 − 14 = 36", why: "Take the shirt's price off the budget." },
        { work: "n ≤ 36 ÷ 5 = 7.2", why: "Divide by the price of one pair." },
        { work: "the most is 7", why: "Only whole pairs can be bought, so round down." },
      ],
      answer: "7 pairs",
    },
    {
      kind: "When the sign flips",
      card: {
        type: "multiple-choice",
        prompt: "When do you flip the inequality sign?",
        choices: ["When adding a negative", "When multiplying or dividing by a negative", "When subtracting", "Never"],
        answer: "When multiplying or dividing by a negative",
      },
      steps: [
        { work: "2 < 5 and 2 − 3 < 5 − 3", why: "Adding or subtracting moves both sides the same way." },
        { work: "2 < 5 but -2 > -5", why: "Multiplying by a negative reverses the order." },
        { work: "flip when multiplying or dividing by a negative", why: "Only that changes which side is bigger." },
      ],
      answer: "When multiplying or dividing by a negative",
    },
    {
      kind: "A monthly plan with a limit",
      card: {
        type: "numeric",
        prompt: "A streaming plan costs $12 a month plus $4 for each movie rental. Leo can spend at most $35 a month. What is the greatest number of movies Leo can rent in a month?",
        answer: 5,
      },
      steps: [
        { work: "4n + 12 ≤ 35", why: "At most means less than or equal to." },
        { work: "4n ≤ 35 − 12 = 23", why: "Take the monthly price off the limit." },
        { work: "n ≤ 23 ÷ 4 = 5.75", why: "Divide by the price of one movie." },
        { work: "the most is 5", why: "Only whole movies count, so round down." },
      ],
      answer: "5 movies",
    },
    {
      kind: "A less-than boundary",
      card: {
        type: "numeric",
        prompt: "Solve for x: 3x − 5 < 16. What number does x have to be less than? Type just the number.",
        answer: 7,
      },
      steps: [
        { work: "3x < 16 + 5 = 21", why: "Add 5 to both sides." },
        { work: "x < 21 ÷ 3 = 7", why: "Dividing by a positive keeps the sign." },
      ],
      answer: "7",
    },
  ],
};
