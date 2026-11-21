/**
 * The arcade: small games that live as static folders under public/arcade/<slug>/
 * (built on public/arcade/kit) and are framed by /games/play/<slug>. Alge Carts
 * is the one entry that has its own page.
 */
export type ArcadeTag = "action" | "sports" | "puzzle" | "daily" | "two-player" | "3d";

export interface ArcadeGame {
  slug: string;
  name: string;
  /** One line under the name. */
  blurb: string;
  /** What the math in it is. */
  math: string;
  tags: ArcadeTag[];
  controls: string;
  /** A double-size tile on the board. */
  big?: boolean;
  /** Its own page instead of the framed player. */
  href?: string;
  thumb?: string;
}

export const ARCADE_TAGS: { id: ArcadeTag | "all"; label: string }[] = [
  { id: "all", label: "All games" },
  { id: "action", label: "Action" },
  { id: "sports", label: "Sports" },
  { id: "puzzle", label: "Puzzle" },
  { id: "daily", label: "Daily" },
  { id: "two-player", label: "2 players" },
  { id: "3d", label: "3D" },
];

export const ARCADE_GAMES: ArcadeGame[] = [
  { slug: "carts", name: "Alge Carts", blurb: "Eight karts, one arena, three minutes.", math: "A question loads every booster", tags: ["action", "3d"], controls: "Arrow keys or WASD, Space to fire", big: true, href: "/games/carts", thumb: "/arcade/_thumbs/carts.jpg" },
  { slug: "bridge-run", name: "Bridge Run", blurb: "Sprint the bridge and pick the right arch.", math: "Run through the lane with the answer", tags: ["action", "3d"], controls: "Arrow keys or swipe", big: true },
  { slug: "number-snake", name: "Number Snake", blurb: "Grow the longest snake in the arena.", math: "Eat the orb that solves the problem", tags: ["action"], controls: "Mouse or arrow keys, hold to sprint" },
  { slug: "sum-blocks", name: "Sum Blocks", blurb: "Fit the pieces, clear the lines.", math: "Lines that add to a multiple pay triple", tags: ["puzzle"], controls: "Drag and drop" },
    { slug: "hoop-duel", name: "Hoop Duel", blurb: "Three on three. Real rules. Four quarters.", math: "A right answer lights the hot hand", tags: ["sports", "two-player"], controls: "Arrow keys to move, S to pass, D to shoot", big: true },
  { slug: "hop-across", name: "Hop Across", blurb: "Roads, rails and rivers. Keep hopping.", math: "Only the pads that fit the rule float", tags: ["action", "3d"], controls: "Arrow keys or swipe", big: true },
    { slug: "rare-find", name: "Rare Find", blurb: "Every answer is right. The rare ones score.", math: "Math, science, sports and more", tags: ["daily", "puzzle"], controls: "Type your answer" },
    { slug: "slope-rider", name: "Slope Rider", blurb: "Short, silly driving levels. Do not flip.", math: "Pick the ramp whose line fits the gap", tags: ["action", "3d"], controls: "Arrow keys or WASD, R to restart" },
  { slug: "wobble-league", name: "Wobble League", blurb: "Floppy hoops, soccer and volleyball.", math: "A quick pick earns a perk", tags: ["sports", "two-player"], controls: "One button each: W and Up", big: true },
  { slug: "swing-line", name: "Swing Line", blurb: "Hold to swing. Let go to fly.", math: "Only the right anchor holds", tags: ["action"], controls: "Space, click or touch" },
  { slug: "like-terms", name: "Like Terms", blurb: "Drop, bump and merge.", math: "Only like terms combine", tags: ["puzzle"], controls: "Mouse or arrow keys, Space to drop" },
  { slug: "drift-line", name: "Drift Line", blurb: "One button. One very narrow road.", math: "Take the fork with the answer", tags: ["action", "3d"], controls: "Hold Space, click or touch" },
  { slug: "six-guess", name: "Six Guess", blurb: "Find the hidden equation in six tries.", math: "Every guess has to balance", tags: ["daily", "puzzle"], controls: "Keyboard or tap" },
  { slug: "bump-arena", name: "Bump Arena", blurb: "Knock everyone off. Stay on.", math: "Answer for a perk each round", tags: ["action", "two-player"], controls: "Arrow keys or WASD, Space to go heavy" },
    { slug: "roof-dash", name: "Roof Dash", blurb: "Run, slide and wall-jump. Beat the clock.", math: "Hit the right pad to open the shortcut", tags: ["action"], controls: "Arrow keys or WASD, R to restart" },
  { slug: "twin-bridge", name: "Twin Bridge", blurb: "Two builders, one bridge.", math: "Stand on the numbers that open the door", tags: ["puzzle", "two-player"], controls: "Two players: WASD and arrow keys" },
    { slug: "fourth-down", name: "Fourth Down", blurb: "Four downs, ten yards. Real football.", math: "Read the defense with a quick answer", tags: ["sports"], controls: "1 pass, 2 run, click a receiver" },
    { slug: "roll-on", name: "Roll On", blurb: "Archie is the ball. Roll, bounce, squash.", math: "Roll onto the button with the answer", tags: ["action"], controls: "Arrow keys or WASD" },
  { slug: "sneaky-floors", name: "Sneaky Floors", blurb: "The level lies. The math does not.", math: "Read the rule or fall through", tags: ["action", "puzzle"], controls: "Arrow keys or WASD" },
];

export const arcadeThumb = (g: ArcadeGame) => g.thumb ?? `/arcade/${g.slug}/thumb.jpg`;
export const arcadeHref = (g: ArcadeGame) => g.href ?? `/games/play/${g.slug}`;
export const getArcadeGame = (slug: string) => ARCADE_GAMES.find((g) => g.slug === slug && !g.href) ?? null;
