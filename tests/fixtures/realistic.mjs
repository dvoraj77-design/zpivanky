// Realističtější syntetický zpěvák: formanty, jitter/shimmer, nepravidelné vibrato, drift, nasazení zespodu,
// souhlásky, dech, ozvěna místnosti, šum pozadí, prosakující doprovod.
import { rng } from './synth.mjs';

const VOWELS = {
  a: [[730, 90], [1090, 110], [2440, 160]],
  e: [[530, 80], [1840, 120], [2480, 160]],
  i: [[300, 60], [2200, 140], [3000, 200]],
  o: [[570, 80], [840, 100], [2410, 160]],
  u: [[320, 60], [800, 90], [2240, 160]],
};
function formantGain(f, vowel) {
  let g = 0.02;
  for (const [fc, bw] of VOWELS[vowel]) g += 1 / (1 + ((f - fc) / bw) ** 2);
  return g;
}

/**
 * notes: [{start, end, midi, vowel?, consonant?: 's'|'t'|'m'|null}]
 * o: {sr, scoopCents, vibCents, drift, jitter, breathNoise, reverb, bgNoiseDb, gainDb, leak:[{start,end,midis}], leakDb, seed, detuneCents}
 */
export function realSinger(notes, o = {}) {
  const sr = o.sr ?? 48000;
  const R = rng(o.seed ?? 11);
  const dur = Math.max(...notes.map((n) => n.end)) + 1.5;
  const out = new Float32Array(Math.round(dur * sr));
  const scoop = o.scoopCents ?? 80, vibC = o.vibCents ?? 30, jit = o.jitter ?? 0.004;
  for (const n of notes) {
    const vowel = n.vowel || 'a';
    let t0 = n.start;
    // souhláska před samohláskou (kousek před dobou, jak se zpívá)
    if (n.consonant === 's' || n.consonant === 't') {
      const cl = n.consonant === 's' ? 0.09 : 0.03;
      const s0 = Math.round((t0 - cl) * sr);
      let p = 0;
      for (let i = 0; i < cl * sr; i++) { const w = R() * 2 - 1; const v = n.consonant === 's' ? (w - p) * 0.08 : w * 0.15 * Math.exp(-i / (0.01 * sr)); p = w; if (s0 + i >= 0) out[s0 + i] += v; }
    }
    const len = Math.round((n.end - t0 - 0.03) * sr);
    const start = Math.round(t0 * sr);
    let phase = R() * 6.28, vibPhase = R() * 6.28, vibRate = 5 + R() * 1.2, drift = 0, amp = 1;
    const f0base = 440 * Math.pow(2, (n.midi + (o.detuneCents ?? 0) / 100 - 69) / 12);
    const maxH = Math.floor(Math.min(8000, sr / 2 - 500) / f0base);
    for (let i = 0; i < len && start + i < out.length; i++) {
      const tt = i / sr;
      // nasazení zespodu: -scoop centů → 0 během 120 ms
      const sc = tt < 0.12 ? -scoop * (1 - tt / 0.12) ** 2 : 0;
      // nepravidelné vibrato po 0,35 s
      if (i % 480 === 0) { vibRate += (R() - 0.5) * 0.2; vibRate = Math.max(4.5, Math.min(6.5, vibRate)); drift += (R() - 0.5) * (o.drift ?? 2); drift = Math.max(-12, Math.min(12, drift)); amp += (R() - 0.5) * 0.06; amp = Math.max(0.85, Math.min(1.15, amp)); }
      vibPhase += (2 * Math.PI * vibRate) / sr;
      const vib = tt > 0.35 ? vibC * Math.min(1, (tt - 0.35) / 0.3) * Math.sin(vibPhase) : 0;
      const f = f0base * Math.pow(2, (sc + vib + drift) / 1200) * (1 + (R() - 0.5) * jit);
      phase += (2 * Math.PI * f) / sr;
      let v = 0;
      for (let k = 1; k <= maxH; k++) v += (Math.sin(k * phase) / k) * formantGain(k * f, vowel);
      const att = Math.min(1, tt / 0.04), rel = Math.min(1, (len - i) / sr / 0.06);
      const breath = (R() * 2 - 1) * (o.breathNoise ?? 0.05);
      out[start + i] += (v * 0.12 + breath * 0.3) * amp * att * rel;
    }
    // nádech po frázi
    if (n.breathAfter) {
      const b0 = Math.round((n.end + 0.05) * sr);
      for (let i = 0; i < 0.25 * sr && b0 + i < out.length; i++) out[b0 + i] += (R() * 2 - 1) * 0.015 * Math.sin((Math.PI * i) / (0.25 * sr));
    }
  }
  // prosakující doprovod (reproduktor): klavírní tóny s útlumem
  if (o.leak) {
    const lg = Math.pow(10, (o.leakDb ?? -20) / 20);
    for (const c of o.leak) for (const m of c.midis) {
      const f = 440 * Math.pow(2, (m - 69) / 12), s0 = Math.round(c.start * sr), L = Math.round((c.end - c.start) * sr);
      for (let i = 0; i < L && s0 + i < out.length; i++) { const tt = i / sr; out[s0 + i] += lg * 0.3 * Math.exp(-tt * 2.5) * (Math.sin(2 * Math.PI * f * tt) + 0.4 * Math.sin(4 * Math.PI * f * tt) + 0.2 * Math.sin(6 * Math.PI * f * tt)); }
    }
  }
  // ozvěna místnosti (několik časných odrazů + dozvuk)
  if (o.reverb !== false) {
    const taps = [[0.011, 0.35], [0.023, 0.25], [0.037, 0.2], [0.051, 0.14], [0.083, 0.09]];
    const dry = out.slice();
    for (const [d, g] of taps) { const D = Math.round(d * sr); for (let i = D; i < out.length; i++) out[i] += dry[i - D] * g * (o.reverb ?? 1); }
  }
  // šum pozadí (růžový šum ventilátoru)
  if (o.bgNoiseDb != null) {
    const g = Math.pow(10, o.bgNoiseDb / 20);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < out.length; i++) { const w = R() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; out[i] += (b0 + b1 + b2 + w * 0.05) * g * 2; }
  }
  const gain = Math.pow(10, (o.gainDb ?? 0) / 20);
  for (let i = 0; i < out.length; i++) { let v = out[i] * gain; if (o.clip) v = Math.max(-0.99, Math.min(0.99, v * 3)); out[i] = v; }
  return out;
}

/** Cíle (sekundy) → noty realistického zpěváka s náhodnými samohláskami a souhláskami. */
export function notesFromTargets(targets, seed = 3) {
  const R = rng(seed);
  const vs = ['a', 'e', 'o', 'u', 'i'];
  return targets.map((t, i) => ({ start: t.start, end: t.end, midi: t.midi, vowel: vs[Math.floor(R() * vs.length)], consonant: R() < 0.4 ? (R() < 0.5 ? 's' : 't') : null, breathAfter: targets[i + 1] && targets[i + 1].start - t.end > 0.4 }));
}
