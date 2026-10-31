/**
 * Every sound is synthesised in Web Audio: no files. One-shots for weapons
 * and hits, a continuous engine for the player's kart, and a small chiptune
 * loop. Nothing plays until unlock() runs inside a user gesture.
 */
export type SoundName =
  | "rocket"
  | "mg"
  | "throw"
  | "mine"
  | "shield"
  | "boost"
  | "explosion"
  | "bigexplosion"
  | "hit"
  | "pickup"
  | "kill"
  | "death"
  | "bounce"
  | "spark"
  | "countdown"
  | "go"
  | "over"
  | "bump"
  | "land"
  | "streak"
  | "deny";

const BPM = 126;
const ROOTS = [45, 41, 48, 43];
const CHORDS = [
  [0, 3, 7],
  [0, 4, 7],
  [0, 4, 7],
  [0, 4, 7],
];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private engineOsc: OscillatorNode[] = [];
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNote = 0;
  private step = 0;
  private lx = 0;
  private ly = 0;
  private lz = 0;
  muted: boolean;
  musicOn = true;

  constructor(enabled: boolean) {
    this.muted = !enabled;
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Create the context inside a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.28;
    this.musicBus.connect(this.master);

    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 400;
    this.engineFilter.Q.value = 1.5;
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfx);
    for (const [type, mul] of [
      ["sawtooth", 1],
      ["square", 2.02],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 60 * mul;
      const g = ctx.createGain();
      g.gain.value = type === "square" ? 0.35 : 1;
      o.connect(g);
      g.connect(this.engineFilter);
      o.start();
      this.engineOsc.push(o);
    }
    if (this.musicOn) this.startMusic();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.03);
  }

  setListener(x: number, y: number, z: number): void {
    this.lx = x;
    this.ly = y;
    this.lz = z;
  }

  /** The player's engine: pitch and loudness from speed. active false fades it out. */
  engine(speedFrac: number, boosting: boolean, active: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 55 + speedFrac * 120 + (boosting ? 40 : 0);
    this.engineOsc[0].frequency.setTargetAtTime(f, t, 0.08);
    this.engineOsc[1].frequency.setTargetAtTime(f * 2.02, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + speedFrac * 1400 + (boosting ? 800 : 0), t, 0.1);
    this.engineGain.gain.setTargetAtTime(active ? 0.035 + speedFrac * 0.045 : 0, t, 0.12);
  }

  play(name: SoundName, x?: number, y?: number, z?: number): void {
    if (!this.ctx) return;
    let vol = 1;
    if (x !== undefined && y !== undefined && z !== undefined) {
      const d = Math.hypot(x - this.lx, y - this.ly, z - this.lz);
      vol = Math.max(0.04, 1 / (1 + (d / 22) * (d / 22)));
    }
    switch (name) {
      case "rocket":
        this.noise(0.35, 0.45 * vol, "lowpass", 2600, 300, 0.7);
        this.tone("sawtooth", 340, 90, 0.35, 0.22 * vol);
        break;
      case "mg":
        this.noise(0.06, 0.3 * vol, "bandpass", 1900, 1400, 1.2);
        this.tone("square", 950, 480, 0.05, 0.1 * vol);
        break;
      case "throw":
        this.noise(0.32, 0.3 * vol, "bandpass", 500, 2400, 1.5);
        break;
      case "mine":
        this.tone("square", 640, 640, 0.05, 0.14 * vol);
        this.tone("square", 1280, 1280, 0.05, 0.1 * vol, 0.06);
        break;
      case "shield":
        this.tone("sine", 300, 1150, 0.42, 0.26 * vol);
        this.tone("triangle", 450, 1600, 0.42, 0.16 * vol);
        break;
      case "boost":
        this.noise(0.6, 0.32 * vol, "bandpass", 300, 3200, 1.2);
        this.tone("sawtooth", 120, 520, 0.6, 0.16 * vol);
        break;
      case "explosion":
        this.noise(0.9, 0.85 * vol, "lowpass", 1800, 80, 0.6);
        this.tone("sine", 110, 28, 0.6, 0.55 * vol);
        break;
      case "bigexplosion":
        this.noise(1.3, 1.0 * vol, "lowpass", 2200, 60, 0.6);
        this.tone("sine", 90, 22, 0.9, 0.7 * vol);
        break;
      case "hit":
        this.noise(0.08, 0.35 * vol, "lowpass", 1400, 600, 0.8);
        this.tone("sine", 210, 90, 0.12, 0.3 * vol);
        break;
      case "pickup":
        this.tone("square", 523, 523, 0.09, 0.14);
        this.tone("square", 659, 659, 0.09, 0.14, 0.08);
        this.tone("square", 784, 784, 0.14, 0.14, 0.16);
        break;
      case "kill":
        this.tone("triangle", 880, 880, 0.12, 0.28);
        this.tone("triangle", 1320, 1320, 0.2, 0.26, 0.1);
        break;
      case "streak":
        this.tone("square", 660, 660, 0.1, 0.2);
        this.tone("square", 880, 880, 0.1, 0.2, 0.1);
        this.tone("square", 1320, 1320, 0.22, 0.22, 0.2);
        break;
      case "death":
        this.noise(0.8, 0.8, "lowpass", 1600, 80, 0.6);
        this.tone("sawtooth", 420, 60, 0.75, 0.3);
        break;
      case "bounce":
        this.tone("sine", 240, 160, 0.1, 0.2 * vol);
        break;
      case "spark":
        this.tone("square", 2400, 1700, 0.03, 0.07 * vol);
        break;
      case "bump":
        this.noise(0.1, 0.3 * vol, "lowpass", 700, 300, 0.8);
        this.tone("sine", 130, 70, 0.12, 0.25 * vol);
        break;
      case "land":
        this.noise(0.12, 0.22 * vol, "lowpass", 600, 200, 0.8);
        break;
      case "countdown":
        this.tone("square", 660, 660, 0.12, 0.22);
        break;
      case "go":
        this.tone("square", 990, 990, 0.3, 0.25);
        this.tone("square", 1320, 1320, 0.3, 0.2, 0.05);
        break;
      case "over":
        for (let i = 0; i < 5; i++) this.tone("triangle", midi([69, 72, 76, 79, 81][i]), midi([69, 72, 76, 79, 81][i]), 0.25, 0.22, i * 0.13);
        break;
      case "deny":
        this.tone("square", 220, 160, 0.18, 0.2);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, type: BiquadFilterType, f0: number, f1: number, q: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 70);
  }

  private stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx!;
    const eighth = 60 / BPM / 2;
    while (this.nextNote < ctx.currentTime + 0.3) {
      this.playStep(this.step, this.nextNote);
      this.step++;
      this.nextNote += eighth;
    }
  }

  private playStep(step: number, t: number): void {
    const ctx = this.ctx!;
    const bar = Math.floor(step / 8) % 4;
    const inBar = step % 8;
    const root = ROOTS[bar];
    const chord = CHORDS[bar];
    const note = (type: OscillatorType, f: number, dur: number, gain: number, dest: AudioNode = this.musicBus) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    if (inBar === 0 || inBar === 3 || inBar === 4 || inBar === 6) note("square", midi(root), 0.2, 0.16);
    if (inBar === 0 || inBar === 4) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.2);
    }
    if (inBar % 2 === 1) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      src.start(t);
      src.stop(t + 0.05);
    }
    const arpNote = root + 12 + chord[[0, 1, 2, 1, 0, 2, 1, 2][inBar]] + (Math.floor(step / 32) % 2 === 1 ? 12 : 0);
    note("triangle", midi(arpNote), 0.14, 0.11);
  }

  dispose(): void {
    this.stopMusic();
    for (const o of this.engineOsc) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
    void this.ctx?.close();
    this.ctx = null;
  }
}
