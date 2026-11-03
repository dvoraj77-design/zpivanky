// Simulovaný zpěvák: vyrobí WAV podle cílů (sekundy) v různých variantách.
import { render, HARM, rng, wavBuffer } from './synth.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

/** targets: [{start, end, midi, toMidi?, kind}] → Float32Array */
export function singer(targets, variant = 'exact', { sr = 48000, tail = 1.5 } = {}) {
  const dur = Math.max(...targets.map((t) => t.end)) + tail;
  if (variant === 'silence') return new Float32Array(Math.round(dur * sr));
  if (variant === 'noise') {
    const r = rng(9); const out = new Float32Array(Math.round(dur * sr));
    for (let i = 0; i < out.length; i++) out[i] = (r() * 2 - 1) * 0.08;
    return out;
  }
  const notes = targets.map((t) => {
    let midi = t.midi, start = t.start;
    if (variant === 'flat30') midi -= 0.3;
    if (variant === 'octaveDown') midi -= 12;
    if (variant === 'late') start += 0.3;
    const d = Math.max(0.1, t.end - start - 0.02);
    return { t: start + 0.01, d, midi, glideTo: t.toMidi != null ? t.toMidi + (midi - t.midi) : undefined, harmonics: midi < 52 ? HARM.bassA : HARM.vowelA, amp: 0.35, vibrato: d > 0.8 ? { rate: 5.2, cents: 15 } : undefined };
  });
  return render(notes, { sr, dur, noise: 0.002 });
}

export function writeSinger(dir, name, targets, variant, sr = 48000) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.wav`, wavBuffer(singer(targets, variant, { sr }), sr));
  return `${name}.wav`;
}

/** Stálý tón pro ladičku (Chromium falešný mikrofon). */
export function steadyTone(path, midi, sec = 20, sr = 48000) {
  const s = render([{ t: 0, d: sec, midi, harmonics: HARM.vowelA, amp: 0.3 }], { sr, dur: sec });
  writeFileSync(path, wavBuffer(s, sr));
}

/** Rytmus: krátké „pa“ na každý nástup. */
export function rhythmSinger(targets, { sr = 48000, midi = 52, offset = 0 } = {}) {
  const notes = targets.map((t) => ({ t: t.start + offset, d: 0.16, midi, harmonics: HARM.vowelA, amp: 0.4 }));
  return render(notes, { sr, dur: Math.max(...targets.map((t) => t.end)) + 1.5, noise: 0.002 });
}
/** Dynamika: tón s hlasitostí podle křivky (cresc/decresc/messa/steady), rozsah v dB. */
export function dynamicsSinger(targets, curve, rangeDb = 12, { sr = 48000 } = {}) {
  const dur = Math.max(...targets.map((t) => t.end)) + 1.5;
  const out = new Float32Array(Math.round(dur * sr));
  for (const t of targets) {
    const seg = render([{ t: 0, d: t.end - t.start - 0.02, midi: t.midi, harmonics: HARM.vowelA, amp: 0.25 }], { sr, dur: t.end - t.start });
    const n = seg.length;
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const rel = curve === 'cresc' ? -rangeDb / 2 + rangeDb * x : curve === 'decresc' ? rangeDb / 2 - rangeDb * x : curve === 'messa' ? (x < 0.5 ? -rangeDb / 2 + rangeDb * 2 * x : rangeDb / 2 - rangeDb * 2 * (x - 0.5)) : 0;
      const k = Math.round(t.start * sr) + i;
      if (k < out.length) out[k] += seg[i] * Math.pow(10, (rel - rangeDb / 2) / 20);
    }
  }
  return out;
}
export function hissWav(path, sec, { sr = 48000, lead = 0.5, amp = 0.12 } = {}) {
  const r = rng(4); const out = new Float32Array(Math.round((sec + lead + 2) * sr)); let p = 0;
  for (let i = Math.round(lead * sr); i < Math.round((lead + sec) * sr); i++) { const w = r() * 2 - 1; out[i] = (w - p) * amp; p = w; }
  writeFileSync(path, wavBuffer(out, sr));
}
export function writeWav(path, samples, sr = 48000) { writeFileSync(path, wavBuffer(samples, sr)); }
export { render, HARM };
