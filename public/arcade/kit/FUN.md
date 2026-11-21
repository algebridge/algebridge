# What makes these games fun (read before you touch a game)

The first version of this arcade worked and was not fun. We then studied the hit browser games in each genre.
What they share is below. Every rule here is a requirement, and each one can be measured.

## The seven rules

1. **Playing within one second.** No menu card, no instructions page. The page opens on the live game scene with the hero
   already there, the title, and one prompt. Any key or tap starts. Use `createGame({ instant: true, ... })`.
   If the game has levels, Play goes straight into the next unfinished level. Level select is a small button, never a gate.
2. **Teach by level design, not by text.** The first 20 seconds are impossible to fail and need one input.
   Level 1 of a hit swing game is one hook and a finish line. Introduce one idea at a time. At most one short hint line
   on screen (6 words), drawn in the world, gone after the first success. `how:` text is not shown in instant mode.
3. **Short runs, instant retry.** A failed run costs under one second: no card, no fade longer than 0.3 s. In level games,
   death respawns in place at once (R also restarts). In endless games the game-over strip is small and Space restarts.
   Early runs last 5 to 40 seconds. Target: retry-to-control under 0.6 s.
4. **Every input answers back.** Each press makes sound, motion and particles within one frame: squash and stretch,
   dust, trails, `g.shake`, `g.hitstop(0.05)` on impacts, `g.slowmo` on near misses and finishes, floating numbers
   (`createFx`). Coins and pickups come in lines that draw the eye along the best path and rise in pitch as you chain them.
5. **A real difficulty curve.** Easy for 30 seconds, then one new thing every 20 to 30 seconds or every 2 to 3 levels:
   a new obstacle, a new rule, more speed. Mix patterns so no two runs feel the same. Near misses are rewarded.
6. **Always something to earn.** Call `g.unlocks([...])` with 6 to 10 skins or hats or trails and `g.addXp(n)` after every
   run or level. The result strip shows the bar to the next unlock by itself. Let the player pick a skin from a small
   button on the title screen (`onMenu`). Skins change looks only. Also show a personal best to beat during play
   (a ghost line, a marker, "12 m to your best").
7. **Math never stops the action.** No pop-up question cards in action games: do not call `g.ask` there. The math is
   something you steer at, jump on, swing to or drive through, shown early and large, readable in under 2 seconds.
   Start with the easiest problems (level 1, `quick` topics) and rise slowly. A right answer is the exciting path
   (boost, coins, combo, shortcut). A wrong answer costs a little and is never the reason a new player quits.
   In the first 20 seconds there is no math at all: the player learns to move first.
   Turn-based and puzzle games may put math in the turn itself.

## How to check yourself (do all of these, report the numbers)

- Time from Play to first control: under 1 s. Count the clicks from page load to moving: it must be 1.
- An idle player (no input at all) survives at least 8 s in an endless game, and cannot die in level 1's first 5 s.
- Retry: after a death, how many seconds and presses until control? Target under 0.6 s and at most 1 press.
- A scripted "average" player (some mistakes) gets a run of 20 to 60 s on the first try, and sees an unlock within 3 runs.
- Screenshot the title, mid-play, and the result strip. If the mid-play shot does not look exciting, it is not done.

## Poster mode (for the tile art)

Every game exposes `g.debug.poster()`: it sets up and draws ONE composed hero shot of the game with no HUD and no text:
the hero large (about a third of the frame) in its best action pose, a little left of center and low, with the world,
an obstacle or rival, and pickups arranged around it like a movie poster, bright and readable at 150 px.
Leave the top 30% of the frame calm (sky or plain background) because the logo goes there.
It must draw into the normal canvas at any stage size (it will be captured at 1024 x 1024 with `--size 1024x1024`,
so make sure the stage aspect can be forced: read `g.posterMode` if you need to, and frame for a square crop of the center).
After calling it the frame stays put until the next start.
