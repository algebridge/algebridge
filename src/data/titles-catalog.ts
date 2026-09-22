import type { DisplayTitle } from "@/types";

export const DISPLAY_TITLES: DisplayTitle[] = [
  { id: "algebra-ninja", name: "Algebra Ninja", emoji: "🥷", price: 80, description: "Silent, swift, and unstoppable with equations." },
  { id: "math-master", name: "Math Master", emoji: "🎓", price: 120, description: "Respected by every variable in town." },
  { id: "slope-superstar", name: "Slope Superstar", emoji: "⭐", price: 150, description: "Rise over run? More like rise to the top." },
  { id: "graph-guru", name: "Graph Guru", emoji: "📈", price: 180, description: "Every coordinate plane is your canvas." },
  { id: "bridge-builder", name: "Bridge Builder", emoji: "🌉", price: 100, description: "Connecting ideas across every algebra unit." },
  { id: "equation-emperor", name: "Equation Emperor", emoji: "👑", price: 220, description: "Rule over polynomials and linear systems." },
  { id: "fraction-pharaoh", name: "Fraction Pharaoh", emoji: "🏺", price: 240, description: "Ancient wisdom meets modern algebra." },
  { id: "quadratic-queen", name: "Quadratic Queen", emoji: "💎", price: 280, description: "Parabolas bow before your factoring skills." },
  { id: "variable-victor", name: "Variable Victor", emoji: "🏅", price: 320, description: "No unknown is safe when you're on the case." },
  { id: "brainstorm-boss", name: "Brainstorm Boss", emoji: "🧠", price: 350, description: "Ideas hit you faster than lightning." },
  { id: "bridgey-baron", name: "Bridgey Baron", emoji: "🪙", price: 400, description: "Wealthy in Bridgeys and wisdom." },
  { id: "streak-champion", name: "Streak Champion", emoji: "🔥", price: 450, description: "Day after day, you show up and slay." },
  { id: "infinity-icon", name: "Infinity Icon", emoji: "♾️", price: 550, description: "Your potential has no upper bound." },
  { id: "cosmic-calculator", name: "Cosmic Calculator", emoji: "🌌", price: 650, description: "You compute at galactic speed." },
  { id: "dragon-solver", name: "Dragon Solver", emoji: "🐉", price: 750, description: "Tough problems? You breathe fire through them." },
  { id: "quantum-queen", name: "Quantum Queen", emoji: "⚛️", price: 850, description: "Existing in multiple correct answers at once." },
  { id: "legend-of-algebridge", name: "Legend of AlgeBridge", emoji: "🏆", price: 1200, description: "The ultimate title, only the greatest earn this." },
  { id: "bridgey-billionaire", name: "Bridgey Billionaire", emoji: "💰", price: 2000, description: "Your house is basically a museum of flex." },

  // Added Sep 2026: one for each way of being good at this.
  { id: "path-finder", name: "Path Finder", emoji: "🧭", price: 90, description: "One skill at a time, and always the next one." },
  { id: "unit-unlocker", name: "Unit Unlocker", emoji: "🗝️", price: 110, description: "Every locked door has opened for you so far." },
  { id: "story-solver", name: "Story Solver", emoji: "📖", price: 140, description: "The problems are about your world now." },
  { id: "comeback-kid", name: "Comeback Kid", emoji: "🔁", price: 160, description: "A miss is just the setup for the next hit." },
  { id: "intercept-ace", name: "Intercept Ace", emoji: "🎯", price: 170, description: "You always know where the line crosses." },
  { id: "inequality-judge", name: "Inequality Judge", emoji: "⚖️", price: 190, description: "Greater, less, or equal: you make the call." },
  { id: "early-bird-solver", name: "Early Bird Solver", emoji: "🌅", price: 200, description: "The variables get solved before breakfast." },
  { id: "night-owl", name: "Night Owl Mathematician", emoji: "🦉", price: 200, description: "Equations at midnight, calm as ever." },
  { id: "systems-strategist", name: "Systems Strategist", emoji: "♟️", price: 210, description: "Two equations, one plan, zero panic." },
  { id: "sequence-seer", name: "Sequence Seer", emoji: "🔮", price: 220, description: "You see the tenth term before the third." },
  { id: "radical-rebel", name: "Radical Rebel", emoji: "🎸", price: 230, description: "Square roots have never been this loud." },
  { id: "exponent-explorer", name: "Exponent Explorer", emoji: "🚀", price: 240, description: "Your ideas grow at exponential speed." },
  { id: "function-whisperer", name: "Function Whisperer", emoji: "🐺", price: 260, description: "Every input tells you its output." },
  { id: "factoring-fox", name: "Factoring Fox", emoji: "🦊", price: 270, description: "You spot the pair hiding in every trinomial." },
  { id: "parabola-pilot", name: "Parabola Pilot", emoji: "🛩️", price: 290, description: "Up, over, and back down, smooth as a curve." },
  { id: "absolute-legend", name: "Absolute Legend", emoji: "🧊", price: 300, description: "Distance from zero, always positive." },
  { id: "piecewise-pioneer", name: "Piecewise Pioneer", emoji: "🧩", price: 310, description: "A different rule for every stretch of road." },
  { id: "gridmaster", name: "Gridmaster", emoji: "🗺️", price: 330, description: "The coordinate plane is your home turf." },
  { id: "first-try-phenom", name: "First-Try Phenom", emoji: "⚡", price: 380, description: "Five right, first try, every time." },
  { id: "keeper-of-the-bridge", name: "Keeper of the Bridge", emoji: "🌉", price: 900, description: "You hold every unit's key." },
];

export function getDisplayTitle(id: string): DisplayTitle | undefined {
  return DISPLAY_TITLES.find((t) => t.id === id);
}
