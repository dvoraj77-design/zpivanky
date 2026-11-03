// Nástroje: vzorkovač (klavír, kytara, basa – přibalené vzorky), vodicí hlas, bourdon, metronom, bicí (syntéza).

const SAMPLE_SETS = {
  piano: { dir: 'piano', notes: ['A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7'], release: 0.35, gain: 1.0 },
  guitar: { dir: 'guitar', notes: ['E2', 'G2', 'As2', 'Cs3', 'E3', 'G3', 'As3', 'Cs4', 'E4', 'G4'], release: 0.25, gain: 0.85 },
  bass: { dir: 'bass', notes: ['E1', 'G1', 'As1', 'Cs2', 'E2', 'G2', 'As2', 'Cs3', 'E3', 'G3', 'As3'], release: 0.12, gain: 0.9 },
};
const LET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nameToMidi(n) {
  const m = /^([A-G])(s)?(\d)$/.exec(n);
  return (parseInt(m[3], 10) + 1) * 12 + LET[m[1]] + (m[2] ? 1 : 0);
}
export function sampleUrls() {
  const out = [];
  for (const set of Object.values(SAMPLE_SETS)) for (const n of set.notes) out.push(`samples/${set.dir}/${n}.ogg`);
  return out;
}

export class Sampler {
  constructor(ctx, name, base = './') {
    this.ctx = ctx; this.name = name; this.set = SAMPLE_SETS[name]; this.base = base;
    this.buffers = []; // {midi, buf}
    this.loaded = false; this.loading = null;
  }
  load() {
    if (this.loading) return this.loading;
    this.loading = Promise.all(this.set.notes.map(async (n) => {
      const res = await fetch(`${this.base}samples/${this.set.dir}/${n}.ogg`);
      if (!res.ok) throw new Error('Nelze načíst zvuk ' + n);
      const ab = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(ab);
      return { midi: nameToMidi(n), buf };
    })).then((arr) => { this.buffers = arr.sort((a, b) => a.midi - b.midi); this.loaded = true; });
    return this.loading;
  }
  /** Zahraje tón; vrací {stop(when)} */
  play(midi, when, dur, vel = 0.7, dest) {
    if (!this.loaded || !this.buffers.length) return null;
    let best = this.buffers[0];
    for (const b of this.buffers) if (Math.abs(b.midi - midi) < Math.abs(best.midi - midi)) best = b;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = best.buf;
    src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
    const g = ctx.createGain();
    const amp = vel * this.set.gain;
    const t0 = Math.max(when, ctx.currentTime);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(amp, t0 + 0.004);
    const rel = this.set.release;
    const end = t0 + Math.max(0.05, dur);
    g.gain.setValueAtTime(amp, end);
    g.gain.exponentialRampToValueAtTime(0.0008, end + rel);
    src.connect(g); g.connect(dest);
    src.start(t0);
    src.stop(end + rel + 0.05);
    return { src, gain: g, stop: (t) => { try { const tt = Math.max(t ?? ctx.currentTime, ctx.currentTime); g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value, tt); g.gain.linearRampToValueAtTime(0, tt + 0.06); src.stop(tt + 0.08); } catch { /* už zastaveno */ } } };
  }
}

/** Vodicí hlas: měkký syntetický „ú/á“ tón s vibratem; umí glissando. */
export class GuideVoice {
  constructor(ctx) {
    this.ctx = ctx;
    const real = new Float32Array([0, 1, 0.42, 0.22, 0.12, 0.07, 0.04, 0.02]);
    this.wave = ctx.createPeriodicWave(real, new Float32Array(real.length));
  }
  play(midi, when, dur, vel = 0.7, dest, toMidi = null) {
    const ctx = this.ctx;
    const t0 = Math.max(when, ctx.currentTime);
    const f0 = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.wave);
    osc.frequency.setValueAtTime(f0, t0);
    if (toMidi != null) osc.frequency.exponentialRampToValueAtTime(440 * Math.pow(2, (toMidi - 69) / 12), t0 + dur);
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = 5.3;
    vibG.gain.setValueAtTime(0, t0);
    if (dur > 0.5 && toMidi == null) vibG.gain.linearRampToValueAtTime(f0 * 0.006, t0 + Math.min(0.6, dur));
    vib.connect(vibG); vibG.connect(osc.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(4000, f0 * 6); lp.Q.value = 0.5;
    const g = ctx.createGain();
    const amp = 0.32 * vel;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(amp, t0 + 0.04);
    g.gain.setValueAtTime(amp, t0 + Math.max(0.05, dur - 0.06));
    g.gain.linearRampToValueAtTime(0, t0 + dur + 0.02);
    osc.connect(lp); lp.connect(g); g.connect(dest);
    osc.start(t0); vib.start(t0);
    osc.stop(t0 + dur + 0.1); vib.stop(t0 + dur + 0.1);
    return { stop: (t) => { try { const tt = Math.max(t ?? ctx.currentTime, ctx.currentTime); g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value, tt); g.gain.linearRampToValueAtTime(0, tt + 0.04); osc.stop(tt + 0.06); vib.stop(tt + 0.06); } catch { /* */ } } };
  }
}

/** Metronom a bicí (syntéza). */
export class Percussion {
  constructor(ctx) {
    this.ctx = ctx;
    const len = Math.round(ctx.sampleRate * 0.3);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
  }
  click(when, accent, dest, vel = 0.8) {
    const ctx = this.ctx, t = Math.max(when, ctx.currentTime);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.06);
  }
  drum(midi, when, dest, vel = 0.5) {
    const ctx = this.ctx, t = Math.max(when, ctx.currentTime);
    if (midi === 36) { // kopák
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.9 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3);
      return;
    }
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (midi === 38) { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8; g.gain.setValueAtTime(0.5 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); }
    else { f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.35 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); }
    src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + 0.2);
  }
}

/** Bourdon (držený tón tóniky + kvinty) – opora pro intonaci. */
export class Drone {
  constructor(ctx, dest) { this.ctx = ctx; this.dest = dest; this.nodes = null; }
  start(midi, { fifth = true, level = 0.5 } = {}) {
    this.stop();
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.16 * level, t + 0.6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.3;
    lp.connect(out); out.connect(this.dest);
    const oscs = [];
    const notes = fifth ? [midi - 12, midi, midi + 7] : [midi - 12, midi];
    for (const m of notes) for (const det of [-4, 4]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = 440 * Math.pow(2, (m - 69) / 12); o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = m === midi ? 0.5 : 0.3;
      o.connect(g); g.connect(lp); o.start(t); oscs.push(o);
    }
    this.nodes = { out, oscs, midi };
  }
  stop() {
    if (!this.nodes) return;
    const { out, oscs } = this.nodes, t = this.ctx.currentTime;
    out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + 0.3);
    for (const o of oscs) o.stop(t + 0.35);
    this.nodes = null;
  }
  get playing() { return !!this.nodes; }
}
