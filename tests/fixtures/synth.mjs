// Generátor syntetických signálů pro testy: čistý tón, hlasu podobný tón s alikvotami, vibrato, šum, ticho.
import { writeFileSync } from 'node:fs';

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const VOWEL_A = [1, 0.8, 0.55, 0.5, 0.35, 0.25, 0.2, 0.14, 0.1, 0.07, 0.05, 0.04];
const VOWEL_U = [1, 0.35, 0.12, 0.05, 0.03, 0.02];
const BASS_A = [0.5, 1, 0.8, 0.6, 0.5, 0.35, 0.25, 0.2, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03];

/**
 * Vyrenderuje sled not do Float32Array.
 * notes: [{t, d, f? | midi?, amp?, harmonics?, vibrato?:{rate, cents}, glideTo?: midi}]
 */
export function render(notes, { sr = 48000, dur, noise = 0, seed = 7 } = {}) {
  const total = dur ?? Math.max(...notes.map((n) => n.t + n.d)) + 0.2;
  const out = new Float32Array(Math.ceil(total * sr));
  const rand = rng(seed);
  for (const n of notes) {
    const h = n.harmonics || [1];
    const amp = n.amp ?? 0.3;
    const start = Math.round(n.t * sr), len = Math.round(n.d * sr);
    const f0 = n.f ?? 440 * Math.pow(2, ((n.midi ?? 69) - 69) / 12);
    const f1 = n.glideTo != null ? 440 * Math.pow(2, (n.glideTo - 69) / 12) : f0;
    let phase = rand() * 2 * Math.PI;
    const att = Math.min(0.03 * sr, len / 4), rel = Math.min(0.04 * sr, len / 4);
    const norm = h.reduce((a, b) => a + Math.abs(b), 0);
    for (let i = 0; i < len && start + i < out.length; i++) {
      const tt = i / sr;
      let f = n.glideTo != null ? f0 * Math.pow(f1 / f0, i / len) : f0;
      if (n.vibrato && tt > 0.25) f *= Math.pow(2, (n.vibrato.cents * Math.sin(2 * Math.PI * n.vibrato.rate * tt)) / 1200);
      if (n.jitterCents) f *= Math.pow(2, ((rand() - 0.5) * n.jitterCents) / 1200);
      phase += (2 * Math.PI * f) / sr;
      let v = 0;
      for (let k = 0; k < h.length; k++) if (h[k]) v += h[k] * Math.sin((k + 1) * phase);
      let env = 1;
      if (i < att) env = i / att;
      else if (i > len - rel) env = (len - i) / rel;
      out[start + i] += (amp * env * v) / norm * 1.6;
    }
  }
  if (noise > 0) for (let i = 0; i < out.length; i++) out[i] += (rand() * 2 - 1) * noise;
  return out;
}

export const HARM = { pure: [1], vowelA: VOWEL_A, vowelU: VOWEL_U, bassA: BASS_A };

/** Šum typu „sss“ – vysokofrekvenční šum. */
export function hiss(dur, { sr = 48000, amp = 0.1, seed = 3 } = {}) {
  const r = rng(seed); const out = new Float32Array(Math.round(dur * sr));
  let p = 0;
  for (let i = 0; i < out.length; i++) { const w = r() * 2 - 1; out[i] = (w - p) * amp; p = w; }
  return out;
}

export function concat(...arrs) {
  const len = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Float32Array(len); let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
export function silence(dur, sr = 48000) { return new Float32Array(Math.round(dur * sr)); }

export function wavBuffer(samples, sr = 48000) {
  const n = samples.length; const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buf;
}
export function writeWav(path, samples, sr = 48000) { writeFileSync(path, wavBuffer(samples, sr)); }
