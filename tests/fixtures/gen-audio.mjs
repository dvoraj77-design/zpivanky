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
