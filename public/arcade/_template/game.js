// Template game: catch the falling answer. Copy this folder, rename, and replace the game.
import { createGame, math, sfx, drawArchie, PAL, FONT, clamp, rand } from "../kit/kit.js";

const g = createGame({
  slug: "_template",
  title: "Catch It",
  tagline: "Catch the right answer.",
  how: ["Move Archie under the number that solves the problem."],
  controls: [{ keys: "← →", does: "Move" }],
  aspect: 16 / 9,
  bg: "#bfdbfe",
  instant: true,
});
const c = g.canvas2d(960, 540);
const { ctx } = c;
let x, drops, q, lives, score;

function next() {
  q = math.problem({ topic: "quick", level: 1 });
  drops = q.choices.map((v, i) => ({ v, x: 150 + i * 220, y: -40 - rand(0, 80), right: q.check(v) }));
}
g.onStart = () => { x = 480; lives = 3; score = 0; g.setScore(0); g.setHud("Lives", 3); next(); };
g.touchButtons([{ code: "ArrowLeft", label: "◀", side: "left" }, { code: "ArrowRight", label: "▶", side: "right" }]);

g.loop(
  (dt) => {
    x = clamp(x + g.keys.axis(["ArrowLeft", "KeyA"], ["ArrowRight", "KeyD"]) * 520 * dt, 50, 910);
    for (const d of drops) {
      d.y += (120 + score * 6) * dt;
      if (d.y > 440 && d.y < 500 && Math.abs(d.x - x) < 60) {
        if (d.right) { score++; g.setScore(score); sfx.play("coin"); g.toast("+1", 600, "good"); }
        else { lives--; g.setHud("Lives", lives); sfx.play("hit"); g.shake(10, 0.3); }
        return lives > 0 ? next() : g.over({ score });
      }
    }
    if (drops[0].y > 600) { lives--; g.setHud("Lives", lives); lives > 0 ? next() : g.over({ score }); }
  },
  () => {
    ctx.save();
    ctx.translate(g.shakeX, g.shakeY);
    ctx.fillStyle = "#bfdbfe"; ctx.fillRect(-20, -20, 1000, 580);
    ctx.fillStyle = PAL.green; ctx.fillRect(-20, 500, 1000, 60);
    if (q) {
      ctx.font = `900 44px ${FONT}`; ctx.textAlign = "center"; ctx.fillStyle = PAL.navy;
      ctx.fillText(q.text, 480, 110);
      for (const d of drops) {
        ctx.fillStyle = PAL.amber; ctx.beginPath(); ctx.arc(d.x, d.y, 38, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = `900 30px ${FONT}`; ctx.fillText(d.v, d.x, d.y + 10);
      }
    }
    drawArchie(ctx, x ?? 480, 452, 110, { pose: "idle", t: g.time });
    ctx.restore();
  }
);
