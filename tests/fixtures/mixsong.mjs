// Syntetická „nahrávka“ písně se známou odpovědí: bicí, klavír, basa, zpěv (stereo), pro testy importu.
import { rng, render, HARM } from './synth.mjs';
import { realSinger, notesFromTargets } from './realistic.mjs';
import { generateAccompaniment } from '../../docs/js/core/accomp.js';

export function mixSong(song, { sr = 22050, tempo = song.tempo, lead = 0.8, seconds = Infinity, drums = true, swingMs = 0 } = {}) {
  const spb = 60 / tempo;
  const total = Math.min(seconds, lead + song.length * spb + 1);
  const n = Math.round(total * sr);
  const L = new Float32Array(n), R = new Float32Array(n), voc = new Float32Array(n);
  const R0 = rng(5);
  const add = (buf, s, off, gain) => { for (let i = 0; i < s.length && off + i < buf.length; i++) if (off + i >= 0) buf[off + i] += s[i] * gain; };
  // bicí
  if (drums) for (let b = 0; b * spb + lead < total; b++) {
    const t = lead + b * spb + ((R0() - 0.5) * swingMs) / 1000, o = Math.round(t * sr);
    const accent = b % song.meter[0] === 0;
    const kick = new Float32Array(Math.round(0.18 * sr));
    for (let i = 0; i < kick.length; i++) { const tt = i / sr; kick[i] = Math.sin(2 * Math.PI * (50 + 70 * Math.exp(-tt * 30)) * tt) * Math.exp(-tt * 18) * (accent ? 0.9 : 0.55); }
    add(L, kick, o, 0.5); add(R, kick, o, 0.5);
    const hat = new Float32Array(Math.round(0.04 * sr)); let p = 0;
    for (let i = 0; i < hat.length; i++) { const w = R0() * 2 - 1; hat[i] = (w - p) * Math.exp(-i / sr * 90) * 0.25; p = w; }
    add(L, hat, o, 0.3); add(R, hat, o, 0.5);
  }
  // klavír + basa z akordů
  for (const e of generateAccompaniment(song, { style: 'piano', bass: true })) {
    const t = lead + e.t * spb; if (t > total) continue;
    const d = Math.min(e.d * spb, 2.5);
    const s = render([{ t: 0, d, midi: e.midi, harmonics: e.inst === 'bass' ? [1, 0.6, 0.3, 0.15] : [1, 0.55, 0.3, 0.18, 0.1, 0.06], amp: e.inst === 'bass' ? 0.3 : 0.11 }], { sr, dur: d + 0.05 });
    for (let i = 0; i < s.length; i++) s[i] *= Math.exp(-(i / sr) * (e.inst === 'bass' ? 1 : 2));
    const o = Math.round(t * sr), pan = e.inst === 'bass' ? 0.5 : 0.3;
    add(L, s, o, (1 - pan) * 1.6); add(R, s, o, pan * 1.6);
  }
  // zpěv
  const tg = song.notes.map((x) => ({ start: lead + x.t * spb, end: lead + (x.t + x.d) * spb, midi: x.p, phrase: x.phrase })).filter((x) => x.end < total);
  const v = realSinger(notesFromTargets(tg), { sr, bgNoiseDb: null, reverb: 0.4 });
  for (let i = 0; i < n && i < v.length; i++) { voc[i] = v[i] * 0.8; L[i] += voc[i]; R[i] += voc[i]; }
  const beats = []; for (let b = 0; lead + b * spb < total; b++) beats.push(lead + b * spb);
  return { L, R, vocals: voc, sr, beats, spb, lead, truth: { tempo, notes: song.notes, chords: song.chords, meter: song.meter[0] } };
}
