// Bridge Run theme, "Sunrise Sprint": an original 8-bar loop in C major made with Web Audio only.
// Lead (square with a short echo), a bouncing octave bass, kick, snare and hats. No files, no timers:
// tick() is called from the game update and schedules a short way ahead on the AudioContext clock.
const BPM = 124, VOL = 1, AHEAD = 0.18, STEPS = 128;
// MIDI notes on a 16th-note grid, 16 steps a bar. 0 is a rest.
const LEAD = [
  76, 0, 79, 0, 84, 0, 79, 76, 0, 0, 79, 0, 81, 79, 0, 0, // C
  81, 0, 84, 0, 88, 0, 84, 81, 0, 0, 84, 0, 86, 84, 0, 0, // Am
  77, 0, 81, 0, 84, 0, 81, 77, 0, 84, 0, 81, 0, 77, 0, 0, // F
  79, 0, 83, 0, 86, 0, 83, 0, 86, 0, 88, 0, 86, 83, 79, 0, // G
  84, 0, 0, 79, 0, 0, 76, 0, 79, 0, 84, 0, 88, 0, 84, 0, // C
  81, 0, 0, 76, 0, 0, 72, 0, 76, 0, 81, 0, 84, 0, 81, 0, // Am
  86, 0, 84, 0, 81, 0, 77, 0, 74, 0, 77, 0, 81, 0, 84, 0, // Dm
  83, 0, 86, 0, 91, 0, 0, 86, 0, 83, 0, 79, 0, 0, 0, 0, // G
];
const ROOT = [48, 45, 41, 43, 48, 45, 50, 43];
const BASS = [0, -1, 12, -1, 0, -1, 12, -1, 0, -1, 12, -1, 7, -1, 12, -1];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

let ac = null, master = null, bus = null, noise = null;
let on = false, nextT = 0, step = 0, count = 0, bpm = BPM, level = -1;

function ensure() {
  if (ac) return true;
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return false;
  ac = new A();
  master = ac.createGain();
  master.gain.value = 0;
  const soft = ac.createBiquadFilter();
  soft.type = "lowpass"; soft.frequency.value = 6000;
  master.connect(soft).connect(ac.destination);
  noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.3), ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
function voice(type, f, t, dur, vol, slide) {
  const o = ac.createOscillator(), e = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  e.gain.exponentialRampToValueAtTime(vol * 0.5, t + dur * 0.5);
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(e).connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
  count++;
}
function hit(t, dur, vol, freq, kind) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), e = ac.createGain();
  s.buffer = noise;
  f.type = kind; f.frequency.value = freq;
  e.gain.setValueAtTime(vol, t);
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(e).connect(bus);
  s.start(t); s.stop(t + dur + 0.02);
  count++;
}
function play(i, t, d) {
  const bar = i >> 4, k = i & 15;
  const n = LEAD[i];
  if (n) {
    const len = LEAD[(i + 1) % STEPS] ? d * 0.95 : d * 1.9;
    voice("square", hz(n), t, len, 0.02);
    voice("square", hz(n), t + d * 3, d * 0.9, 0.006); // echo, a dotted eighth later
    if (bar >= 4) voice("triangle", hz(n - 12), t, len, 0.016); // the second half is doubled an octave down
  }
  if (BASS[k] >= 0) voice("triangle", hz(ROOT[bar] + BASS[k]), t, d * (BASS[k] ? 1.1 : 1.7), BASS[k] ? 0.04 : 0.055);
  if (k === 0 || k === 8 || (k === 11 && bar % 2 === 1)) voice("sine", 150, t, 0.13, 0.085, 46);
  if (k === 4 || k === 12 || (bar === 7 && k > 12)) hit(t, 0.11, 0.022, 1900, "bandpass");
  if (k % 2 === 0) hit(t, 0.035, k % 4 === 2 ? 0.011 : 0.006, 7500, "highpass");
}

/** Start or carry on. fresh: begin the tune from bar 1. Call from a key press or tap (browsers need the gesture). */
export function start(fresh = true) {
  if (!ensure()) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  if (bus) bus.disconnect();
  bus = ac.createGain();
  bus.connect(master);
  if (fresh) step = 0;
  on = true; nextT = 0; level = -1;
}
/** Cut the tune at once (game over, pause). Notes already scheduled are dropped with their bus. */
export function stop() {
  if (!ac || !on) return;
  on = false;
  if (bus) { bus.disconnect(); bus = null; }
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setValueAtTime(0, ac.currentTime);
  ac.suspend().catch(() => {});
}
/** Call every game update. k: 0..1 run speed (the tempo rises up to 10%). muted: the kit sound toggle. */
export function tick(k, muted) {
  if (!on || !ac) return;
  const now = ac.currentTime;
  const want = muted ? 0 : VOL;
  if (want !== level) { level = want; master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(want, now, 0.04); }
  if (nextT < now) nextT = now + 0.03; // first call, or after a hitch
  bpm = BPM * (1 + 0.1 * Math.min(1, Math.max(0, k)));
  const d = 60 / bpm / 4;
  while (nextT < now + AHEAD) {
    if (!muted) play(step, nextT, d);
    nextT += d;
    step = (step + 1) % STEPS;
  }
}
export const info = () => ({ on, step, bar: (step >> 4) + 1, bpm: +bpm.toFixed(1), notes: count, ctx: ac ? ac.state : "none", gain: level });
