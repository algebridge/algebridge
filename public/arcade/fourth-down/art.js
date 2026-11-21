// Fourth Down pixel art: everything is drawn in code on a 320 x 180 canvas and scaled up with crisp pixels.
export const W = 320, H = 180, PX = 6, FY0 = 46, FY1 = 140, FW = 34, ZS = (FY1 - FY0) / FW;
export const lo = document.createElement("canvas");
lo.width = W; lo.height = H;
export const L = lo.getContext("2d");
export const wy = (z) => Math.round(FY0 + z * ZS);

// ---------- 3 x 5 bitmap font ----------
const GLY = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
  G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101",
  S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110", 4: "101101111001001",
  5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001110",
  ".": "000000000000010", ",": "000000000010100", ":": "000010000010000", "!": "010010010000010", "?": "110001010000010",
  "-": "000000111000000", "+": "000010111010000", "=": "000111000111000", "/": "001001010100100", "'": "010010000000000",
  "(": "001010010010001", ")": "100010010010100", "*": "000101010101000", "%": "101001010100101", ">": "100010001010100", "<": "001010100010001",
};
export const tw = (s, sc = 1) => String(s).length * 4 * sc - sc;
/** Pixel text. al: 0 left, 1 center, 2 right. */
export function txt(s, x, y, col = "#fff", sc = 1, al = 0) {
  s = String(s).toUpperCase();
  x = Math.round(al === 1 ? x - tw(s, sc) / 2 : al === 2 ? x - tw(s, sc) : x);
  y = Math.round(y);
  L.fillStyle = col;
  for (const ch of s) {
    const gl = GLY[ch];
    if (gl) for (let i = 0; i < 15; i++) if (gl[i] === "1") L.fillRect(x + (i % 3) * sc, y + ((i / 3) | 0) * sc, sc, sc);
    x += 4 * sc;
  }
}
/** Pixel text with a one pixel drop shadow. */
export function txs(s, x, y, col = "#fff", sc = 1, al = 0, sh = "#0b1220") { txt(s, x, y + sc, sh, sc, al); txt(s, x, y, col, sc, al); }
export function box(x, y, w, h, fill, edge) {
  L.fillStyle = edge || fill; L.fillRect(x + 1, y, w - 2, h); L.fillRect(x, y + 1, w, h - 2);
  if (edge) { L.fillStyle = fill; L.fillRect(x + 1, y + 1, w - 2, h - 2); }
}

// ---------- players ----------
const RUN = [[[-4, -1], [2, 0]], [[-2, 0], [0, 0]], [[2, -1], [-3, 0]], [[0, 0], [-1, 0]]];
/** A chunky helmeted player. (x, y) is the feet. f is facing (1 right, -1 left). fr is the run frame 0 to 3, or -1 standing. */
export function spr(x, y, c, f = 1, fr = -1, o = {}) {
  const R = (dx, dy, w, h, col) => { L.fillStyle = col; L.fillRect(f > 0 ? x + dx : x - dx - w, y + dy, w, h); };
  if (!o.noShadow) { L.fillStyle = "rgba(0,0,0,.3)"; L.fillRect(x - 4, y - 1, 8, 2); }
  if (o.down) {
    R(-7, -5, 5, 4, c.h); R(-6, -6, 3, 1, c.h); R(-2, -4, 5, 3, c.a); R(3, -3, 4, 2, c.p); R(7, -2, 2, 1, "#111827"); R(-8, -3, 1, 2, "#1f2937");
    return;
  }
  for (const [lx, ly] of fr < 0 ? [[-2, 0], [1, 0]] : RUN[fr]) { R(lx, -3 + ly, 2, 2, c.s || "#f8fafc"); R(lx, -1 + ly, 3, 1, "#111827"); }
  if (fr === 1 || fr === 3) y -= 1;
  R(-3, -6, 6, 3, c.p);
  R(-3, -11, 6, 5, c.a);
  R(-4, -11, 8, 2, c.a);
  R(-1, -9, 3, 2, c.b);
  if (o.arms) { R(-4, -15, 1, 4, "#e8b48a"); R(3, -15, 1, 4, "#e8b48a"); }
  else R(2, -9, 2, 2, "#e8b48a");
  if (o.ball) { R(2, -8, 4, 2, "#8b4513"); R(3, -8, 2, 1, "#f8fafc"); }
  R(-3, -16, 6, 5, c.h); R(-2, -17, 4, 1, c.h);
  R(-1, -17, 2, 3, c.b);
  R(2, -13, 2, 2, "#1f2937"); R(3, -14, 1, 1, "#1f2937");
}
export function ballSpr(x, y) { L.fillStyle = "#8b4513"; L.fillRect(x - 1, y - 2, 3, 2); L.fillStyle = "#f8fafc"; L.fillRect(x, y - 2, 1, 1); }

// ---------- stadium ----------
export function makeCrowd(cols, dark) {
  const c = document.createElement("canvas");
  c.width = 240; c.height = 24;
  const k = c.getContext("2d");
  k.fillStyle = dark; k.fillRect(0, 0, 240, 24);
  let s = 7;
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const skin = ["#f1c9a5", "#c68958", "#8d5a3b", "#e8b48a"];
  for (let row = 0; row < 5; row++) for (let x = (row & 1) * 2; x < 240; x += 4) {
    const y = row * 5 - 1;
    if (R() < 0.07) continue;
    k.fillStyle = cols[Math.floor(R() * cols.length)]; k.fillRect(x, y + 2, 3, 3);
    k.fillStyle = skin[Math.floor(R() * 4)]; k.fillRect(x, y, 2, 2);
  }
  return c;
}
const ADS = ["ALGEBRIDGE", "GO ARCHERS", "MATH WINS GAMES", "READ THE DEFENSE"];
export function drawStadium(cam, st, crowd, bounce) {
  L.fillStyle = st.dark; L.fillRect(0, 0, W, FY0);
  const off = -(Math.round(cam * 0.7) % 240);
  for (let x = off; x < W; x += 240) L.drawImage(crowd, x, 14 + (bounce ? 1 : 0));
  L.fillStyle = st.wall; L.fillRect(0, 38, W, 7);
  L.fillStyle = "rgba(255,255,255,.18)"; L.fillRect(0, 38, W, 1);
  for (let i = 0, x = -(cam % 400) - 20; x < W; x += 100, i++) txt(ADS[(i + Math.floor(cam / 400) * 4) & 3], x, 39, st.ad);
}
export function drawField(cam, st, me, opp) {
  for (let yd = -10; yd < 110; yd += 5) {
    const x = (yd + 10) * PX - cam;
    if (x > W || x + 30 < 0) continue;
    L.fillStyle = yd < 0 ? me.a : yd >= 100 ? opp.a : ((yd / 5) & 1 ? st.f1 : st.f2);
    L.fillRect(x, FY0, 30, FY1 - FY0);
  }
  const ez = (yd, name, col) => {
    const x = (yd + 15) * PX - cam;
    if (x < -30 || x > W + 30) return;
    const n = name.length, y0 = FY0 + Math.round((FY1 - FY0 - n * 12) / 2) + 1;
    for (let i = 0; i < n; i++) txs(name[i], x, y0 + i * 12, col, 2, 1, "rgba(0,0,0,.35)");
  };
  ez(-10, me.name, me.b); ez(100, opp.name, opp.b);
  for (let yd = 0; yd <= 100; yd++) {
    const x = (yd + 10) * PX - cam;
    if (x < -1 || x > W) continue;
    L.fillStyle = st.line;
    if (yd % 5 === 0) { L.globalAlpha = yd % 100 === 0 ? 1 : 0.75; L.fillRect(x, FY0, yd % 100 === 0 ? 2 : 1, FY1 - FY0); L.globalAlpha = 1; }
    else { L.fillRect(x, wy(13.5), 1, 1); L.fillRect(x, wy(20.5), 1, 1); L.fillRect(x, FY0 + 1, 1, 2); L.fillRect(x, FY1 - 3, 1, 2); }
  }
  L.globalAlpha = 0.75;
  for (let yd = 10; yd <= 90; yd += 10) {
    const x = (yd + 10) * PX - cam;
    if (x < -20 || x > W + 20) continue;
    const n = yd <= 50 ? yd : 100 - yd;
    txt(n, x + 1, FY0 + 9, st.line, 1, 1); txt(n, x + 1, FY1 - 15, st.line, 1, 1);
  }
  const mx = 60 * PX - cam;
  if (mx > -30 && mx < W + 30) { L.globalAlpha = 0.3; box(mx - 12, wy(17) - 9, 25, 19, me.a); L.globalAlpha = 0.6; txt("A", mx - 4, wy(17) - 7, me.b, 3); }
  L.globalAlpha = 1;
  L.fillStyle = st.line;
  const x0 = -cam, x1 = 120 * PX - cam;
  L.fillRect(x0, FY0 - 1, x1 - x0, 2); L.fillRect(x0, FY1 - 1, x1 - x0, 2);
  L.fillRect(x0 - 1, FY0 - 1, 2, FY1 - FY0 + 2); L.fillRect(x1 - 1, FY0 - 1, 2, FY1 - FY0 + 2);
  L.fillStyle = st.side; L.fillRect(0, FY1 + 1, W, 3);
}
/** Goal posts at the back of an end zone, seen a little from the side. */
export function drawPosts(cam, yd) {
  const x = (yd + 10) * PX - cam;
  if (x < -12 || x > W + 12) return;
  const ya = wy(13.5) - 13, yb = wy(20.5) - 13;
  L.fillStyle = "rgba(0,0,0,.25)"; L.fillRect(x - 2, wy(17) - 1, 5, 2);
  L.fillStyle = "#facc15";
  L.fillRect(x, wy(17) - 14, 2, 14);
  for (let i = 0; i <= yb - ya; i++) L.fillRect(x - 3 + Math.round((i / (yb - ya)) * 6), ya + i, 2, 1);
  L.fillRect(x - 3, ya - 20, 2, 20); L.fillRect(x + 3, yb - 20, 2, 20);
  L.fillStyle = "#fef08a"; L.fillRect(x - 3, ya - 20, 2, 1); L.fillRect(x + 3, yb - 20, 2, 1);
}
