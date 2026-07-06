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
  { id: "streak-champion", name: "Streak Champion", emoji: "🔥", price: 450, description: "Day after day — you show up and slay." },
  { id: "infinity-icon", name: "Infinity Icon", emoji: "♾️", price: 550, description: "Your potential has no upper bound." },
  { id: "cosmic-calculator", name: "Cosmic Calculator", emoji: "🌌", price: 650, description: "You compute at galactic speed." },
  { id: "dragon-solver", name: "Dragon Solver", emoji: "🐉", price: 750, description: "Tough problems? You breathe fire through them." },
  { id: "quantum-queen", name: "Quantum Queen", emoji: "⚛️", price: 850, description: "Existing in multiple correct answers at once." },
  { id: "legend-of-algebridge", name: "Legend of AlgeBridge", emoji: "🏆", price: 1200, description: "The ultimate title — only the greatest earn this." },
  { id: "bridgey-billionaire", name: "Bridgey Billionaire", emoji: "💰", price: 2000, description: "Your house is basically a museum of flex." },
];

export function getDisplayTitle(id: string): DisplayTitle | undefined {
  return DISPLAY_TITLES.find((t) => t.id === id);
}
