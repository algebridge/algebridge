// Archie, the AlgeBridge mascot (the arch of a bridge with a face), for games.
// Same shapes and colors as src/components/archie/Archie.tsx.
//   drawArchie(ctx, cx, cy, size, opts)   2D canvas, centered on (cx, cy)
//   archieSVG(pose, size)                 an <svg> string for DOM
//   buildArchie3D(THREE, opts)            a THREE.Group, about 1 unit tall, feet at y = 0

export const ARCHIE = {
  body: "#2563eb",
  shine: "#60a5fa",
  line: "#1e3a8a",
  ink: "#0f172a",
  white: "#ffffff",
  cheek: "#f9a8d4",
};
const C = ARCHIE;
const BODY =
  "M22 60 C22 32 39 15 60 15 C81 15 98 32 98 60 L98 97 Q98 104 91 104 L81 104 Q74 104 74 97 " +
  "L74 95 C74 88.5 67.7 84 60 84 C52.3 84 46 88.5 46 95 L46 97 Q46 104 39 104 L29 104 Q22 104 22 97 Z";
let bodyPath = null;

/**
 * opts: pose "idle" | "happy" | "sad" | "run" | "jump" | "wave"
 *       look {x,y} each -1..1, blink bool, squashX/squashY (1 = none), rotation (radians),
 *       t (seconds, drives the run cycle and wave), color (body color), flip (face left), arms (default true)
 */
export function drawArchie(ctx, cx, cy, size, opts = {}) {
  const { pose = "idle", look = null, blink = false, squashX = 1, squashY = 1, rotation = 0, t = 0, color = C.body, flip = false, arms = true, alpha = 1 } = opts;
  if (!bodyPath) bodyPath = new Path2D(BODY);
  const s = size / 120;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(s * squashX * (flip ? -1 : 1), s * squashY);
  ctx.translate(-60, -60);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const limb = (pts, hand) => {
    const d = new Path2D(pts);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 12.8;
    ctx.stroke(d);
    ctx.strokeStyle = color;
    ctx.lineWidth = 7.6;
    ctx.stroke(d);
    if (hand) {
      ctx.beginPath();
      ctx.arc(hand[0], hand[1], 5.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = C.line;
      ctx.stroke();
    }
  };
  if (arms) {
    if (pose === "happy" || pose === "jump") {
      limb("M26 64 Q15 56 12 41", [11.5, 39.5]);
      limb("M94 64 Q105 56 108 41", [108.5, 39.5]);
    } else if (pose === "run") {
      const k = Math.sin(t * 14) * 9;
      limb(`M25 70 Q16 ${74 + k} 14 ${82 + k}`, [14, 83 + k]);
      limb(`M95 70 Q104 ${74 - k} 106 ${82 - k}`, [106, 83 - k]);
    } else if (pose === "wave") {
      const k = Math.sin(t * 8) * 5;
      limb("M25 70 Q17 76 15 85", [15, 86]);
      limb(`M95 66 Q105 60 ${109 + k} 48`, [109.5 + k, 46.5]);
    } else {
      limb("M25 70 Q17 76 15 85", [15, 86]);
      limb("M95 70 Q103 76 105 85", [105, 86]);
    }
  }
  ctx.fillStyle = color;
  ctx.fill(bodyPath);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2.6;
  ctx.stroke(bodyPath);
  // shine
  ctx.strokeStyle = C.shine;
  ctx.lineWidth = 4.2;
  ctx.stroke(new Path2D("M31.5 47 C33 35 40.5 26 50 23"));
  // cheeks
  ctx.fillStyle = C.cheek;
  for (const x of [36, 84]) {
    ctx.beginPath();
    ctx.ellipse(x, 59.5, 4.6, 2.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // eyes
  ctx.strokeStyle = C.ink;
  if (pose === "happy") {
    ctx.lineWidth = 3.4;
    for (const x of [47, 73]) ctx.stroke(new Path2D(`M${x - 6} 50 Q${x} 42.5 ${x + 6} 50`));
  } else if (blink) {
    ctx.lineWidth = 3;
    for (const x of [47, 73]) ctx.stroke(new Path2D(`M${x - 6} 48.5 Q${x} 52.5 ${x + 6} 48.5`));
  } else if (pose === "sad") {
    ctx.lineWidth = 3.2;
    for (const x of [47, 73]) {
      ctx.stroke(new Path2D(`M${x - 4.5} 44 L${x + 4.5} 52`));
      ctx.stroke(new Path2D(`M${x + 4.5} 44 L${x - 4.5} 52`));
    }
  } else {
    const lx = look ? Math.max(-1, Math.min(1, look.x)) * 2 : 0.6;
    const ly = look ? Math.max(-1, Math.min(1, look.y)) * 2.5 : 0.8;
    for (const x of [47, 73]) {
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.ellipse(x, 48, 6.4, 7.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(x + lx, 48 + ly, 4.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(x + lx + 1.5, 46.4 + ly, 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // mouth
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.ink;
  if (pose === "happy" || pose === "jump") {
    ctx.fill(new Path2D("M51 59.5 Q60 61.5 69 59.5 Q68 71 60 71 Q52 71 51 59.5 Z"));
    ctx.fillStyle = "#fb7185";
    ctx.fill(new Path2D("M55 67.6 Q60 64.6 65 67.6 Q63 70.6 60 70.6 Q57 70.6 55 67.6 Z"));
  } else if (pose === "sad") {
    ctx.lineWidth = 3.2;
    ctx.stroke(new Path2D("M53.5 66 Q60 60 66.5 66"));
  } else {
    ctx.lineWidth = 3.2;
    ctx.stroke(new Path2D("M53.5 60.5 Q60 66.5 66.5 60.5"));
  }
  ctx.restore();
}

export function archieSVG(pose = "idle", size = 96) {
  const happy = pose === "happy";
  const eyes = happy
    ? [47, 73].map((x) => `<path d="M${x - 6} 50 Q${x} 42.5 ${x + 6} 50" fill="none" stroke="${C.ink}" stroke-width="3.4" stroke-linecap="round"/>`).join("")
    : [47, 73]
        .map(
          (x) =>
            `<ellipse cx="${x}" cy="48" rx="6.4" ry="7.2" fill="#fff"/><circle cx="${x + 0.6}" cy="48.8" r="4.3" fill="${C.ink}"/><circle cx="${x + 2.1}" cy="47.2" r="1.35" fill="#fff"/>`
        )
        .join("");
  const mouth = happy
    ? `<path d="M51 59.5 Q60 61.5 69 59.5 Q68 71 60 71 Q52 71 51 59.5 Z" fill="${C.ink}"/><path d="M55 67.6 Q60 64.6 65 67.6 Q63 70.6 60 70.6 Q57 70.6 55 67.6 Z" fill="#fb7185"/>`
    : pose === "sad"
      ? `<path d="M53.5 66 Q60 60 66.5 66" fill="none" stroke="${C.ink}" stroke-width="3.2" stroke-linecap="round"/>`
      : `<path d="M53.5 60.5 Q60 66.5 66.5 60.5" fill="none" stroke="${C.ink}" stroke-width="3.2" stroke-linecap="round"/>`;
  const limb = (d, hx, hy) =>
    `<g fill="none" stroke-linecap="round"><path d="${d}" stroke="${C.line}" stroke-width="12.8"/><path d="${d}" stroke="${C.body}" stroke-width="7.6"/><circle cx="${hx}" cy="${hy}" r="5.6" fill="${C.body}" stroke="${C.line}" stroke-width="2.6"/></g>`;
  const arms =
    happy || pose === "wave"
      ? (happy ? limb("M26 64 Q15 56 12 41", 11.5, 39.5) : limb("M25 70 Q17 76 15 85", 15, 86)) + limb("M94 64 Q105 56 108 41", 108.5, 39.5)
      : limb("M25 70 Q17 76 15 85", 15, 86) + limb("M95 70 Q103 76 105 85", 105, 86);
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" overflow="visible" aria-hidden="true">${arms}<path d="${BODY}" fill="${C.body}" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round"/><path d="M31.5 47 C33 35 40.5 26 50 23" fill="none" stroke="${C.shine}" stroke-width="4.2" stroke-linecap="round"/><ellipse cx="36" cy="59.5" rx="4.6" ry="2.9" fill="${C.cheek}"/><ellipse cx="84" cy="59.5" rx="4.6" ry="2.9" fill="${C.cheek}"/>${eyes}${mouth}</svg>`;
}

/**
 * Archie in 3D. Returns a Group about 1 unit tall and 0.85 wide, feet on y = 0, facing +Z.
 * group.userData = { body, eyes: [l, r], pupils: [l, r], arms: [l, r], legs: null }
 * Animate by scaling/rotating the group; swing arms with arms[i].rotation.x.
 * opts: { color, toon: true (MeshToonMaterial) }
 */
export function buildArchie3D(THREE, opts = {}) {
  const color = opts.color ?? C.body;
  const Mat = opts.toon === false ? THREE.MeshStandardMaterial : THREE.MeshToonMaterial;
  const g = new THREE.Group();
  // The arch outline as a shape, in units where the figure is 1 tall.
  const sh = new THREE.Shape();
  const k = 1 / 89; // source figure is 89 tall (15..104) and 76 wide (22..98)
  const P = (x, y) => [(x - 60) * k, (104 - y) * k];
  sh.moveTo(...P(22, 60));
  sh.bezierCurveTo(...P(22, 32), ...P(39, 15), ...P(60, 15));
  sh.bezierCurveTo(...P(81, 15), ...P(98, 32), ...P(98, 60));
  sh.lineTo(...P(98, 97));
  sh.quadraticCurveTo(...P(98, 104), ...P(91, 104));
  sh.lineTo(...P(81, 104));
  sh.quadraticCurveTo(...P(74, 104), ...P(74, 97));
  sh.lineTo(...P(74, 95));
  sh.bezierCurveTo(...P(74, 88.5), ...P(67.7, 84), ...P(60, 84));
  sh.bezierCurveTo(...P(52.3, 84), ...P(46, 88.5), ...P(46, 95));
  sh.lineTo(...P(46, 97));
  sh.quadraticCurveTo(...P(46, 104), ...P(39, 104));
  sh.lineTo(...P(29, 104));
  sh.quadraticCurveTo(...P(22, 104), ...P(22, 97));
  sh.closePath();
  const depth = 0.34;
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 5, curveSegments: 20 });
  geo.translate(0, 0, -depth / 2);
  const body = new THREE.Mesh(geo, new Mat({ color }));
  body.castShadow = true;
  g.add(body);
  const front = depth / 2 + 0.071;
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ink = new THREE.MeshBasicMaterial({ color: C.ink });
  const eyes = [];
  const pupils = [];
  for (const x of [47, 73]) {
    const [ex, ey] = P(x, 48);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.078, 20, 14), white);
    eye.scale.set(1, 1.12, 0.35);
    eye.position.set(ex, ey, front);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), ink);
    pupil.scale.set(1, 1, 0.4);
    pupil.position.set(ex + 0.006, ey - 0.008, front + 0.022);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), white);
    glint.position.set(0.018, 0.02, 0.03);
    pupil.add(glint);
    g.add(eye, pupil);
    eyes.push(eye);
    pupils.push(pupil);
  }
  const cheekMat = new THREE.MeshBasicMaterial({ color: C.cheek });
  for (const x of [36, 84]) {
    const [cx, cy] = P(x, 59.5);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), cheekMat);
    cheek.scale.set(1, 0.62, 0.2);
    cheek.position.set(cx, cy, front - 0.012);
    g.add(cheek);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.017, 8, 20, Math.PI), ink);
  const [mx, my] = P(60, 59);
  smile.position.set(mx, my, front + 0.004);
  smile.rotation.z = Math.PI;
  g.add(smile);
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.43, 0.4, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 6, 10), new Mat({ color }));
    arm.position.y = -0.11;
    arm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), new Mat({ color }));
    hand.position.y = -0.24;
    pivot.add(arm, hand);
    pivot.rotation.z = side * 0.35;
    g.add(pivot);
    arms.push(pivot);
  }
  g.userData = { body, eyes, pupils, arms };
  return g;
}
