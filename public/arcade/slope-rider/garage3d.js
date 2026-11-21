// Slope Rider garage: the buggy on a turntable under spotlights. Try anything on, equip what you have unlocked.
import { THREE, M, BOX, CYL, parts, bake, buildCar, restPose, poseCar, disposeCar, Particles, BODIES, PAINTS, WHEELS, HATS, TRAILS, DECALS, SPEC, byId, decalCanvas } from "./car3d.js";
import { VEH } from "./sim.js";
import { sfx } from "../kit/kit.js";

const TAU = Math.PI * 2;
const TABS = [["body", "Body", BODIES], ["paint", "Paint", PAINTS], ["wheel", "Wheels", WHEELS], ["hat", "Hat", HATS], ["trail", "Trail", TRAILS], ["decal", "Decal", DECALS]];
const LOCK = `<svg class="sr-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10"/><rect x="5" y="10" width="14" height="10" rx="2.5" fill="currentColor"/></svg>`;
const CSS = `
.ak-overlay.sr-garov{background:none;pointer-events:none;place-items:stretch;padding:0}
.ak-card.sr-gar{pointer-events:auto;position:absolute;right:1.6cqw;top:1.6cqw;bottom:1.6cqw;width:42cqw;max-height:none;padding:1.4cqw 1.6cqw;text-align:left;display:flex;flex-direction:column;gap:.9cqw;background:rgb(255 255 255 / .97);overflow:hidden;animation:none}
.sr-gh{display:flex;align-items:baseline;justify-content:space-between;gap:1cqw}
.sr-gh h2{margin:0;font-size:clamp(14px,3cqw,34px)}
.sr-gh span{font-weight:800;color:#64748b;font-size:clamp(9px,1.5cqw,16px);white-space:nowrap}
.sr-tabs{display:grid;grid-template-columns:repeat(6,1fr);gap:.5cqw}
.sr-tab{font:inherit;font-weight:900;font-size:clamp(8px,1.42cqw,16px);color:#1e3a8a;background:#e2e8f0;border:0;border-radius:.9cqw;padding:.55em 0;cursor:pointer}
.sr-tab.on{background:#2563eb;color:#fff}
.sr-items{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:.7cqw;align-content:start;padding:.2cqw}
.sr-it{position:relative;font:inherit;font-weight:800;font-size:clamp(8px,1.32cqw,15px);color:#1e3a8a;background:#fff;border:.22cqw solid #cbd5e1;border-radius:1cqw;padding:.6cqw .4cqw .5cqw;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:.3cqw;line-height:1.1}
.sr-it i{width:4.6cqw;height:3cqw;border-radius:.7cqw;border:.2cqw solid #1e3a8a;display:block;background-size:cover;background-position:center}
.sr-it i svg{width:100%;height:100%;display:block}
.sr-it small{font-size:.82em;color:#64748b;display:flex;align-items:center;gap:.25em;min-height:1.1em}
.sr-it.try{border-color:#f59e0b;background:#fffbeb}
.sr-it.eq{border-color:#2563eb;background:#dbeafe}
.sr-it.eq small{color:#2563eb}
.sr-it.locked i{filter:saturate(.55)}
.sr-lock{width:1.05em;height:1.05em;flex:none}
.sr-foot{display:flex;align-items:center;gap:.8cqw;flex-wrap:wrap}
.sr-msg{flex:0 0 100%;margin:0;font-weight:800;color:#475569;font-size:clamp(8px,1.3cqw,15px);line-height:1.2}
.ak-stage.sr-g .ak-hud{visibility:hidden}
.sr-foot .ak-btn{flex:1;width:auto;min-width:0;margin:0;white-space:nowrap;font-size:clamp(9px,1.6cqw,18px);padding:.5em 1em}
.sr-foot .ak-btn:disabled{background:#cbd5e1;border-bottom-color:#94a3b8;color:#64748b;cursor:default;box-shadow:none}
.sr-spin{position:absolute;left:1.6cqw;bottom:1.6cqw;width:52cqw;text-align:center;font-weight:900;color:#fff;font-size:clamp(9px,1.5cqw,17px);text-shadow:0 .15em 0 rgb(15 23 42 / .5);pointer-events:none}`;

export function createGarage(g, view, api) {
  const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 120);
  scene.background = new THREE.Color("#141b2e"); scene.fog = new THREE.Fog("#141b2e", 16, 44);
  const fit = () => { const [w, h] = view.size; cam.aspect = w / h; cam.setViewOffset(w, h, w * 0.215, -h * 0.03, w, h); cam.updateProjectionMatrix(); };
  view.onResize(fit);
  const fx = new Particles(120);
  let built = false, table = null, car = null, open = false, raf = 0, ang = 0.7, vel = 0, drag = null, idle = 9, tab = "body", tryLook = null, last = 0, card = null, t = 0, pop = 0, emitT = 0;

  function build() {
    built = true;
    const r = new THREE.Group(), P = parts(r);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(22, 48), new THREE.MeshStandardMaterial({ color: "#3b475c", roughness: 0.92 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    // walls
    P.box(34, 10, 0.4, M("#24304a"), 0, 5, -7.2); P.box(34, 0.55, 0.46, M("#f59e0b"), 0, 1.5, -7.2); P.box(34, 0.3, 0.5, M("#1b2438"), 0, 0.15, -7.1);
    P.box(0.4, 10, 20, M("#1f2a42"), -11.5, 5, 0); P.box(0.46, 0.55, 20, M("#f59e0b"), -11.5, 1.5, 0);
    // roll-up door
    P.box(6.4, 5.4, 0.2, M("#334155"), 5.6, 2.7, -6.95); for (let i = 0; i < 9; i++) P.box(6, 0.42, 0.1, M(i % 2 ? "#64748b" : "#56637a"), 5.6, 0.45 + i * 0.56, -6.82); P.box(6.8, 0.4, 0.3, M("#fbbf24"), 5.6, 5.55, -6.9);
    // shelf with paint cans
    P.box(5.2, 0.14, 0.9, M("#8a6a3b"), -4.6, 3.5, -6.6); for (const x of [-6.9, -2.3]) P.box(0.12, 0.5, 0.7, M("#475569"), x, 3.2, -6.7);
    PAINTS.slice(0, 8).forEach((p, i) => { P.cyl(0.24, 0.5, M(p.c), -6.7 + i * 0.6, 3.82, -6.55, "y"); P.cyl(0.25, 0.05, M("#cbd5e1"), -6.7 + i * 0.6, 4.08, -6.55, "y"); });
    // pegboard and tools
    P.box(4.4, 2.3, 0.1, M("#b08a52"), -4.6, 2.2 + 3.6, -6.95);
    P.box(0.14, 1.1, 0.08, M("#cbd5e1"), -6.0, 5.8, -6.85, 0.3); P.box(0.4, 0.22, 0.08, M("#cbd5e1"), -6.17, 6.36, -6.85, 0.3);
    P.box(0.12, 1.0, 0.08, M("#b45309"), -5.0, 5.7, -6.85); P.box(0.5, 0.26, 0.14, M("#64748b"), -5.0, 6.24, -6.85);
    P.box(0.1, 1.2, 0.08, M("#ef4444"), -4.1, 5.8, -6.85, -0.2); P.box(1.0, 0.1, 0.08, M("#94a3b8"), -3.1, 5.4, -6.85); P.box(0.1, 0.5, 0.08, M("#94a3b8"), -3.55, 5.62, -6.85); P.box(0.1, 0.5, 0.08, M("#94a3b8"), -2.65, 5.62, -6.85);
    // tyre stack, toolbox, cone, jack
    for (let i = 0; i < 4; i++) { const tm = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.3, 10, 20), M("#1f2937")); tm.rotation.x = Math.PI / 2; tm.position.set(-8.2 + (i % 2) * 0.12, 0.3 + i * 0.58, -4.6); r.add(tm); }
    { const tm = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.3, 10, 20), M("#1f2937")); tm.position.set(-9.6, 0.92, -5.6); tm.rotation.y = 0.5; r.add(tm); }
    P.box(2.2, 1.5, 1.1, M("#dc2626"), 8.2, 0.85, -4.6); for (let i = 0; i < 3; i++) { P.box(2.0, 0.34, 0.06, M("#b91c1c"), 8.2, 0.42 + i * 0.44, -4.02); P.box(0.7, 0.07, 0.1, M("#e2e8f0"), 8.2, 0.42 + i * 0.44, -3.97); } for (const x of [7.4, 9.0]) P.cyl(0.14, 0.12, M("#1f2937"), x, 0.07, -4.2, "y");
    P.cone(0.36, 1.0, M("#fb923c"), 4.4, 0.55, -3.6); P.cyl(0.26, 0.14, M("#ffffff"), 4.4, 0.55, -3.6, "y"); P.box(0.9, 0.08, 0.9, M("#ea580c"), 4.4, 0.04, -3.6);
    P.cone(0.36, 1.0, M("#fb923c"), -6.4, 0.55, 1.6); P.cyl(0.26, 0.14, M("#ffffff"), -6.4, 0.55, 1.6, "y"); P.box(0.9, 0.08, 0.9, M("#ea580c"), -6.4, 0.04, 1.6);
    P.cyl(0.5, 1.2, M("#2563eb"), -9.3, 0.6, -2.2, "y"); P.cyl(0.52, 0.08, M("#1e3a8a"), -9.3, 1.0, -2.2, "y"); P.cyl(0.52, 0.08, M("#1e3a8a"), -9.3, 0.3, -2.2, "y");
    // floor markings and lamp housings
    for (let i = 0; i < 12; i++) P.box(1.3, 0.02, 0.36, M(i % 2 ? "#fbbf24" : "#1f2937"), -7.2 + i * 1.3, 0.011, 5.4);
    for (const [x, z] of [[-4.2, 3.2], [4.4, 2.6]]) { P.cyl(0.05, 2.2, M("#0f172a"), x, 9.4, z, "y"); P.cone(0.8, 0.7, M("#0f172a"), x, 8.2, z); P.cyl(0.42, 0.06, M("#fef9c3", { emissive: "#fef08a", emissiveIntensity: 2 }), x, 7.86, z, "y"); }
    const room = bake(r, { receive: true }); scene.add(room);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.5), new THREE.MeshBasicMaterial({ transparent: true, fog: false, map: (() => { const cv = document.createElement("canvas"); cv.width = 512; cv.height = 120; const x = cv.getContext("2d"); x.font = "900 86px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.shadowColor = "#22d3ee"; x.shadowBlur = 22; x.strokeStyle = "#22d3ee"; x.lineWidth = 7; x.lineJoin = "round"; x.strokeText("GARAGE", 256, 64); x.shadowBlur = 8; x.strokeStyle = "#ecfeff"; x.lineWidth = 2.5; x.strokeText("GARAGE", 256, 64); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx; })() }));
    sign.position.set(0.6, 7.6, -6.9); scene.add(sign);
    // the turntable
    table = new THREE.Group(); scene.add(table);
    const tr = new THREE.Group(), T = parts(tr);
    T.cyl(3.5, 0.3, M("#64748b"), 0, 0.15, 0, "y"); T.cyl(3.62, 0.12, M("#334155"), 0, 0.06, 0, "y");
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; T.box(0.5, 0.03, 0.26, M(i % 2 ? "#fbbf24" : "#1f2937"), Math.cos(a) * 3.2, 0.305, Math.sin(a) * 3.2).rotation.y = -a + Math.PI / 2; }
    T.cyl(2.9, 0.02, M("#7b8799"), 0, 0.305, 0, "y");
    table.add(bake(tr, { receive: true }));
    // light: two spots with visible beams, a dim fill
    scene.add(new THREE.HemisphereLight("#b9c8ff", "#27324a", 0.75));
    const fill = new THREE.DirectionalLight("#ffffff", 0.7); fill.position.set(2, 4, 10); scene.add(fill);
    [[-4.2, 3.2, "#fff4d6", true], [4.4, 2.6, "#dbeafe", false]].forEach(([x, z, col, sh]) => {
      const s = new THREE.SpotLight(col, sh ? 2.4 : 1.5, 0, 0.5, 0.55, 0); s.position.set(x, 7.9, z); s.target.position.set(0, 0.6, 0); scene.add(s, s.target);
      if (sh) { s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.bias = -0.0005; s.shadow.normalBias = 0.03; s.shadow.camera.near = 2; s.shadow.camera.far = 20; }
      const beam = new THREE.Mesh(new THREE.ConeGeometry(4.3, 8.4, 28, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
      beam.position.set(x * 0.5, 3.95, z * 0.5); beam.lookAt(x, 7.9, z); beam.rotateX(Math.PI / 2); scene.add(beam);
    });
    scene.add(fx.mesh);
    fit();
  }

  const ok = (k, it) => (k === "body" ? api.stars() >= it.stars : g.xp >= it.need);
  const needTxt = (k, it) => (k === "body" ? `${it.stars} stars` : `${it.need} xp`);
  const listOf = (k) => TABS.find((q) => q[0] === k)[2];
  function swatch(k, it) {
    if (k === "body") { const v = VEH[it.id], h = v.hull.map((p) => `${p[0].toFixed(2)},${(-p[1]).toFixed(2)}`).join(" "); return `<i style="background:#e0f2fe"><svg viewBox="-3 -1.5 6 2.6"><polygon points="${h}" fill="${byId(PAINTS, tryLook.paint).c}" stroke="#1e3a8a" stroke-width=".12" stroke-linejoin="round"/>${v.wheels.map((w) => `<circle cx="${w.x}" cy="${-w.y}" r="${w.r}" fill="#1f2937"/><circle cx="${w.x}" cy="${-w.y}" r="${w.r * 0.45}" fill="#e2e8f0"/>`).join("")}</svg></i>`; }
    if (k === "trail") return `<i style="background:${it.colors ? `linear-gradient(90deg,${it.colors.join(",")})` : "linear-gradient(90deg,#e7c79a,#f6e3c5)"}"></i>`;
    if (k === "decal") return `<i style="background-color:${byId(PAINTS, tryLook.paint).c};${it.id === "none" ? "" : `background-image:url(${decalCanvas(it.id).toDataURL()})`}"></i>`;
    return `<i style="background:${it.c}"></i>`;
  }
  function html() {
    const k = tab, list = listOf(k), saved = api.look(), sel = byId(list, tryLook[k]), can = ok(k, sel), isEq = saved[k] === sel.id;
    const msg = !can ? `Trying on ${sel.name}. Needs ${needTxt(k, sel)}.` : isEq ? `${sel.name} is on your ride.` : `${sel.name} is yours. Equip it to keep it.`;
    return `<div class="sr-gh"><h2>Garage</h2><span>${api.stars()} stars, ${g.xp} xp</span></div>
<div class="sr-tabs">${TABS.map(([id, label]) => `<button class="sr-tab${id === k ? " on" : ""}" data-tab="${id}">${label}</button>`).join("")}</div>
<div class="sr-items">${list.map((it) => { const o = ok(k, it); return `<button class="sr-it${tryLook[k] === it.id ? " try" : ""}${saved[k] === it.id ? " eq" : ""}${o ? "" : " locked"}" data-id="${it.id}">${swatch(k, it)}<b>${it.name}</b><small>${saved[k] === it.id ? "Equipped" : o ? "" : LOCK + needTxt(k, it)}</small></button>`; }).join("")}</div>
<div class="sr-foot"><p class="sr-msg">${msg}${k === "body" ? " Some levels bring their own car." : ""}</p><button class="ak-btn sr-eq" data-eq="1" ${can && !isEq ? "" : "disabled"}>${!can ? "Locked" : isEq ? "Equipped" : "Equip"}</button><button class="ak-btn ak-ghost" data-x="1">Back</button></div>`;
  }
  function rebuild() {
    if (car) { car.hull.removeFromParent(); disposeCar(car); }
    car = buildCar(tryLook.body, tryLook);
    const inner = restPose(car), sp = VEH[tryLook.body];
    let lowY = 1e9, cx = 0; for (const w of sp.wheels) { lowY = Math.min(lowY, w.y - w.r); cx += w.x / sp.wheels.length; }
    inner.position.set(-cx, 0.31 - lowY, 0);
    table.add(inner);
    cam.position.set(0, 4.2, 12.5 + SPEC[tryLook.body].len * 1.1); cam.lookAt(0, 1.1, 0);
    pop = 1;
  }
  function paintUI() { const sc = card.querySelector(".sr-items")?.scrollTop || 0; card.innerHTML = html(); card.querySelector(".sr-items").scrollTop = sc; }
  function step(dt) {
    t += dt;
    if (drag) idle = 0; else { idle += dt; ang += vel * dt; vel *= Math.exp(-3 * dt); if (idle > 1.2) vel += (0.55 - vel) * Math.min(1, dt * 2); }
    table.rotation.y = ang;
    if (pop > 0) pop = Math.max(0, pop - dt * 4);
    const s = 1 + Math.sin(pop * Math.PI) * 0.12; table.scale.set(s, 2 - s, s);
    if (car) { poseCar(car, Math.sin(t * 1.3) > 0.86 ? "jump" : "idle", t); for (const w of car.wheels) w.rotation.z = -t * 1.6; }
    // a taste of the trail, puffing out behind the car
    const tr = byId(TRAILS, tryLook.trail); emitT -= dt;
    if (emitT <= 0 && tr.colors) { emitT = 0.07; const lx = -SPEC[tryLook.body].len / 2 - 0.2, c = Math.cos(ang), sn = Math.sin(ang); fx.puff(lx * c, 0.75, -lx * sn, { colors: tr.colors || ["#e7c79a", "#f3dfc0"], size: tr.size * 1.25, life: tr.life * 1.4, g: tr.g * 0.5, sq: tr.sq, grow: tr.grow, speed: 1.1, spread: 2.2, vx: -c * 1.4, zs: 0.9 }); }
    fx.update(dt); fx.sync();
  }
  function render() { view.renderer.render(scene, cam); }
  const tick = (now) => {
    raf = 0;
    if (!open) return;
    if (!card.isConnected) { close(); return; }
    step(Math.min(0.05, (now - last) / 1000)); last = now; render();
    raf = requestAnimationFrame(tick);
  };
  const el = view.canvas.parentElement;
  const onDown = (e) => { if (!open) return; drag = { x: e.clientX }; vel = 0; };
  const onMove = (e) => { if (!open || !drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; ang += dx * 0.011; vel = dx * 0.011 * 40; };
  const onUp = () => { drag = null; };
  el.addEventListener("pointerdown", onDown); addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("pointercancel", onUp);

  function close() {
    if (!open) return;
    open = false; drag = null; g.stage.classList.remove("sr-g"); if (raf) cancelAnimationFrame(raf); raf = 0;
    api.onClose();
  }
  const gar = {
    get open() { return open; }, render, step,
    show() {
      if (!built) build();
      tryLook = { ...api.look() }; tab = "body"; open = true; ang = 0.7; vel = 0.55; idle = 9; t = 0; fx.clear();
      rebuild();
      g.stage.classList.add("sr-g"); card = g.panel("", "sr-gar"); card.parentElement.classList.add("sr-garov");
      const hint = document.createElement("div"); hint.className = "sr-spin"; hint.textContent = "Drag to spin"; card.parentElement.appendChild(hint);
      paintUI();
      card.onclick = (e) => {
        e.stopPropagation();
        const tb = e.target.closest("[data-tab]"), it = e.target.closest("[data-id]");
        if (tb) { tab = tb.dataset.tab; sfx.play("click"); card.querySelector(".sr-items").scrollTop = 0; paintUI(); card.querySelector(".sr-items").scrollTop = 0; }
        else if (it) { if (tryLook[tab] !== it.dataset.id) { tryLook[tab] = it.dataset.id; rebuild(); sfx.play("pop"); } paintUI(); }
        else if (e.target.closest("[data-eq]")) { const sel = byId(listOf(tab), tryLook[tab]); if (ok(tab, sel)) { api.equip(tab, sel.id); sfx.play("power"); pop = 1; paintUI(); } }
        else if (e.target.closest("[data-x]")) { close(); }
      };
      step(0.016); render();
      last = performance.now(); raf = requestAnimationFrame(tick);
    },
    close,
    /** Test hooks. */
    pick(k, id) { tab = k; tryLook[k] = id; rebuild(); paintUI(); }, equip() { card.querySelector("[data-eq]").click(); }, get tryLook() { return tryLook; }, spin(a) { ang = a; vel = 0; idle = -99; },
  };
  return gar;
}
