# AlgeBridge Arcade: how to build a game here

Each game is a self-contained static folder: `public/arcade/<slug>/` with

- `index.html` (copy `_template/index.html`, change the title)
- `game.js` (ES module; split into more modules in the same folder if it helps)
- `meta.json` (same fields as `_template/meta.json`)
- `thumb.jpg` (the tile: a real 512 x 512 screenshot of the game in play, HUD hidden. Never drawn art: the tile must show what the game looks like)

No build step, no npm packages, no asset files: all art is drawn in code (canvas or three.js), all sound comes from `sfx`.
The only library is three.js for 3D games: `import * as THREE from "../vendor/three.module.min.js";`

**Read `FUN.md` first. It is the design law for every game here.**

## Shell: `createGame(opts)` from `../kit/kit.js`

```js
import { createGame, math, sfx, drawArchie, buildArchie3D, PAL, FONT, clamp, lerp, damp, ease, rand, randInt, choose } from "../kit/kit.js";
const g = createGame({ slug, title, tagline, how: ["one line", "two lines"], controls: [{ keys: "← →", does: "Steer" }], aspect: 16 / 9, bg: "#0f172a" });
```

The shell draws the menu (with Archie), HUD pills, pause (P or Esc), sound toggle (M), full screen (F), the question card and the game-over card. You do not build those.

| Call | What it does |
| --- | --- |
| `g.canvas2d(960, 540)` | 2D canvas with a fixed logical size, DPR-aware. Returns `{ canvas, ctx, w, h }`. Draw in logical units. |
| `g.canvas3d((w, h, dpr) => {...})` | A canvas filling the stage for three.js. The callback fires now and on resize: call `renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()`. |
| `g.onStart = () => {...}` | Reset your world here. Runs on Play and Play again. |
| `g.loop(update, render)` | `update(dt)` runs at a fixed 1/60 s only while playing. `render(alpha)` draws once per frame, and once whenever the screen needs a still (menu, pause). Render must work before the first start. |
| `g.keys.down("ArrowLeft", "KeyA")` | Held. Codes are `KeyboardEvent.code`. |
| `g.keys.pressed("Space")` | True for the single update after the press. |
| `g.keys.axis(["ArrowLeft","KeyA"], ["ArrowRight","KeyD"])` | -1, 0 or 1. |
| `g.pointer` | `{ x, y }` as 0..1 of the stage, `down`, `pressed`, `released`. `g.pointer.at(c)` gives logical canvas coordinates. |
| `g.touchButtons([{ code, label, side: "left" or "right" }])` | On-screen buttons on touch devices that feed `g.keys`. Every game must be playable by touch. |
| `g.setScore(n)`, `g.setHud("Lives", 3)` | HUD pills. `g.setHud(label, null)` removes one. |
| `g.toast("Nice!", 1200, "good")` | Pop text. Tones: `good`, `bad`, `gold`, or none. |
| `g.shake(10, 0.3)` then `g.shakeX`, `g.shakeY` | Screen shake offsets to add to your camera or ctx in render. |
| `await g.ask(problem, { title, seconds })` | Pauses play, shows the problem with 4 choices (keys 1 to 4), resolves `true` or `false`. |
| `g.over({ score, title, lines: [], won, scoreLabel, higherIsBetter })` | Ends the run, saves the best, shows Play again. |
| `g.panel(html, "ak-wide")`, `g.closePanel()` | A custom card over the game (level select, mode pick). Use `.ak-btn` buttons; handle clicks yourself. `opts.onMenu(el)` lets you add things to the menu card (mode buttons). |
| `g.save(key, value)`, `g.load(key, fallback)`, `g.best` | localStorage under `arcade:<slug>:`. |
| `g.time`, `g.state` | Seconds since start; `menu`, `playing`, `paused`, `asking`, `over`. |
| `g.advance(seconds)` | Test hook: steps the sim instantly. Keep all game logic inside `update` so this works. Use `g.time`, never `performance.now()` or `setTimeout`, for game timing. |

### Instant play, juice and unlocks (added after the first playtest)

| Call | What it does |
| --- | --- |
| `createGame({ instant: true, prompt })` | No menu card. The title screen is your live scene with the title and one prompt; any key or tap starts. Game over is a small strip; Space, Enter, R or a tap restarts. Use this for every game. |
| `g.hitstop(0.05)`, `g.slowmo(0.35, 0.6)` | Freeze for a few frames on impact; slow time for a moment. |
| `createFx()` (import from the kit) | Pooled particles, floating text and rings: `fx.burst`, `fx.text`, `fx.ring`, `fx.update(dt)`, `fx.draw(ctx)`. See `kit/fx.js`. |
| `g.unlocks([{ id, name, need }])`, `g.addXp(n)`, `g.unlocked(id)`, `g.skin` | Things to earn. The result strip shows the bar to the next unlock. |
| `g.coins`, `g.addCoins(n)` | Coins shared by the whole arcade. |
| `await g.levelDone({ title, stars, lines, auto: 1.5 })` | Small between-level strip; any key continues. |

`createGame` options also take `keepF: true` (if your game needs the F key) and `noAutoPause: true`.

## Math: `math` (kit/math.js)

`math.problem({ topic, level })` returns `{ text, answer, choices: [4 values], check(input) }`. `text` is short (about 20 characters at most) and has no words, so it fits on a sign, a tile or a ball.
Topics: `add subtract multiply divide integers oneStep twoStep evaluate likeTerms exponents slope percent squares`, or a mix name: `quick`, `prealgebra`, `algebra`, `all`, or your own array. Level 1 to 3.
Also: `math.rng(seed)`, `math.dailySeed()`, `math.factors(n)`, `math.isPrime(n)`, `math.gcd`, `math.shuffle(r, arr)`, `math.int(r, lo, hi)`, `math.pick(r, arr)`.
You may write your own generators when the game needs a special shape of problem. Check every generated answer in code.

## Archie

`drawArchie(ctx, cx, cy, size, { pose: "idle"|"happy"|"sad"|"run"|"jump"|"wave", look: {x,y}, blink, squashX, squashY, rotation, t, flip, color, arms })` draws him centered on (cx, cy).
`buildArchie3D(THREE, { color })` returns a Group about 1 unit tall, feet at y = 0, facing +Z, with `userData.arms` (two shoulder pivots) and `userData.pupils`.
`archieSVG(pose, size)` returns an SVG string. Other characters you invent should share his language: rounded shapes, thick navy outline (#1e3a8a) in 2D, big simple eyes.

## Sound

`sfx.play("jump"|"land"|"coin"|"hit"|"crash"|"whoosh"|"click"|"pop"|"bounce"|"tick"|"power"|"correct"|"wrong"|"win"|"lose")`, or build your own with `sfx.tone(freq, seconds, { type, vol, slide, delay })` and `sfx.noise(seconds, { freq, vol })`. No looping music.

## Rules every game follows

1. **Original.** This is our own game in a known genre: our own name (given to you), our own art style, our own levels and characters. Do not recreate any existing game's look, characters, level layouts, names or sounds.
2. **Fun first.** A first-time player understands it within 5 seconds and wants one more run. Tight controls (coyote time and jump buffering in platformers), a difficulty ramp, and juice: squash and stretch, particles, screen shake, sound on every action, a clear win or lose moment.
3. **Math is light and fast.** Where the brief makes math the mechanic, it is the mechanic. Otherwise a question takes under 5 seconds and earns something (never a wall you must pass to keep playing unless the brief says so). A wrong answer costs a little, never the whole run.
4. **Looks finished.** Layered backgrounds, consistent palette (start from `PAL`), outlines or shading, readable text (`FONT`). No placeholder rectangles. 3D games: antialias on, the dpr from `canvas3d` (up to 2), soft shadows from one directional light (2048 map), fog, toon or standard materials, rounded low-poly shapes.
5. **Light on the machine.** The kit loop sleeps unless playing: do not add your own `requestAnimationFrame`, `setInterval` or CSS animations that run on the menu. Pool particles, reuse geometries and materials, use InstancedMesh for repeated things, dispose what you remove. Target a steady 60 fps on a school Chromebook.
6. **Words.** Player-facing text uses plain short sentences. No em dashes. No emoji. No made-up stats, reviews or player counts. Computer-controlled players get ordinary names and are never called bots or CPU in the UI... except a mode button may say "1 player" and "2 players".
7. **Touch and keyboard** both work. Arrow keys and WASD both work where it makes sense.
8. Stay inside your own `public/arcade/<slug>/` folders. Do not edit the kit, other games, or anything else in the repo. Do not run git commit, npm, or any dev server. If you find a kit bug, work around it and report it.

## Testing

```
node scripts/arcade-smoke.mjs <slug> --shot /path/menu.png --play --advance 2 --down ArrowRight --advance 1 --shot /path/play.png
```

Run it from the repo root (`~/algebridge-arcade`). It serves `public/`, opens the game in headless Chrome, runs your steps in order, reports page errors, and saves screenshots you can open with the Read tool. Steps: `--play`, `--advance <sec>`, `--wait <ms>`, `--down <Code>`, `--up <Code>`, `--tap <Code>`, `--click <fx,fy>`, `--answer right|wrong`, `--eval "<js>"` (`window.__arcade` is the game; expose your own state on it, like `g.debug = { player }`, to assert on it), `--shot <png>`, `--size <WxH>`.

Look at your screenshots. Play a full run through the hooks: start, score, hit a question, answer right and wrong, die, restart. Check a phone-sized viewport (`--size 800x450` and `--size 390x220`). Run one Chrome at a time and keep runs short: the owner's computer must not lag.
