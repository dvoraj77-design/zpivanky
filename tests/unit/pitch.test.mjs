import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StreamAnalyzer } from '../../docs/js/core/pitch.js';
import { render, HARM, hiss, concat, silence, rng } from '../fixtures/synth.mjs';

function analyze(samples, sr) {
  const a = new StreamAnalyzer(sr);
  const res = [];
  const block = 128;
  for (let i = 0; i < samples.length; i += block) {
    const chunk = samples.subarray(i, Math.min(samples.length, i + block));
    a.process(chunk, (i + chunk.length) / sr, (r) => res.push(r));
  }
  return res;
}

function steadyErrors(res, midi, from, to) {
  const errs = [];
  let unvoiced = 0, total = 0;
  for (const r of res) {
    if (r.t < from || r.t > to) continue;
    total++;
    if (!r.voiced) { unvoiced++; continue; }
    errs.push((r.midi - midi) * 100);
  }
  return { errs, unvoiced, total };
}

const RANGE = [];
for (let m = 36; m <= 84; m += 1) RANGE.push(m); // C2 (65 Hz) … C6 (1047 Hz)

for (const sr of [48000, 44100]) {
  for (const [name, harm] of Object.entries({ pure: HARM.pure, vowelA: HARM.vowelA, vowelU: HARM.vowelU, bassA: HARM.bassA })) {
    test(`přesnost ±5 centů, ${name}, ${sr} Hz, C2–C6`, () => {
      let worst = 0, worstMidi = 0;
      for (const m of RANGE) {
        if (name === 'bassA' && m > 64) continue;
        const detune = ((m * 37) % 41) - 20; // různé mikroodchylky -20..+20 centů
        const target = m + detune / 100;
        const s = render([{ t: 0.05, d: 0.8, midi: target, harmonics: harm, amp: 0.3 }], { sr, dur: 0.9 });
        const res = analyze(s, sr);
        const { errs, unvoiced, total } = steadyErrors(res, target, 0.2, 0.75);
        assert.ok(total > 30, 'málo rámců');
        assert.ok(unvoiced / total < 0.05, `${m}: příliš mnoho nehlasových rámců (${unvoiced}/${total})`);
        for (const e of errs) {
          if (Math.abs(e) > Math.abs(worst)) { worst = e; worstMidi = m; }
        }
      }
      assert.ok(Math.abs(worst) <= 5, `nejhorší chyba ${worst.toFixed(2)} centů u midi ${worstMidi}`);
    });
  }
}

test('vibrato: medián přesně, žádné oktávové chyby', () => {
  const sr = 48000;
  for (const m of [40, 45, 52, 57, 64, 69, 76]) {
    const s = render([{ t: 0.05, d: 1.5, midi: m, harmonics: HARM.vowelA, vibrato: { rate: 5.5, cents: 40 } }], { sr, dur: 1.6 });
    const res = analyze(s, sr);
    const { errs } = steadyErrors(res, m, 0.4, 1.45);
    const sorted = errs.slice().sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    assert.ok(Math.abs(med) < 5, `${m}: medián ${med}`);
    assert.ok(errs.every((e) => Math.abs(e) < 70), `${m}: vibrato mimo rozsah / oktávová chyba`);
  }
});

test('různá hlasitost (-40 dB až -6 dB) a šum v pozadí', () => {
  const sr = 48000;
  for (const amp of [0.01, 0.05, 0.3, 0.5]) {
    for (const m of [43, 55, 67]) {
      const s = render([{ t: 0.05, d: 0.8, midi: m, harmonics: HARM.vowelA, amp }], { sr, dur: 0.9, noise: amp * 0.05 });
      const res = analyze(s, sr);
      const { errs, unvoiced, total } = steadyErrors(res, m, 0.2, 0.75);
      assert.ok(unvoiced / total < 0.1, `amp ${amp} midi ${m}: nehlasové ${unvoiced}/${total}`);
      assert.ok(errs.every((e) => Math.abs(e) <= 5), `amp ${amp} midi ${m}: chyba ${Math.max(...errs.map(Math.abs))}`);
    }
  }
});

test('šum, ticho a „sss“ se nezobrazí jako tón', () => {
  const sr = 48000;
  const r = rng(5);
  const white = new Float32Array(sr); for (let i = 0; i < sr; i++) white[i] = (r() * 2 - 1) * 0.1;
  const s = concat(silence(0.5), white, silence(0.3), hiss(1.0, { amp: 0.15 }));
  const res = analyze(s, sr);
  const voiced = res.filter((x) => x.voiced).length;
  assert.ok(voiced / res.length < 0.02, `šum označen jako hlas: ${voiced}/${res.length}`);
  const hissFrames = res.filter((x) => x.t > 1.9 && x.t < 2.7 && x.hiss).length;
  assert.ok(hissFrames > 50, 'sykavka „sss“ nerozpoznána: ' + hissFrames);
});

test('stabilní tóny bez oktávových chyb (sled not, bas až soprán)', () => {
  const sr = 48000;
  const seq = [38, 45, 50, 57, 62, 69, 74, 81, 41, 48];
  const notes = seq.map((m, i) => ({ t: 0.1 + i * 0.6, d: 0.5, midi: m, harmonics: m < 55 ? HARM.bassA : HARM.vowelA }));
  const s = render(notes, { sr });
  const res = analyze(s, sr);
  for (const n of notes) {
    const { errs } = steadyErrors(res, n.midi, n.t + 0.12, n.t + n.d - 0.06);
    assert.ok(errs.length > 10, `${n.midi}: málo rámců`);
    assert.ok(errs.every((e) => Math.abs(e) < 50), `${n.midi}: oktávová/velká chyba ${errs.map((e) => e.toFixed(0)).join(',')}`);
  }
});

test('reakce: od začátku tónu do prvního hlasového rámce < 80 ms', () => {
  const sr = 48000;
  const s = render([{ t: 0.5, d: 0.6, midi: 50, harmonics: HARM.vowelA }], { sr, dur: 1.2 });
  const a = new StreamAnalyzer(sr);
  let firstEmit = null;
  for (let i = 0; i < s.length; i += 128) {
    const chunk = s.subarray(i, i + 128);
    const tEnd = (i + chunk.length) / sr;
    a.process(chunk, tEnd, (r) => { if (r.voiced && firstEmit == null && tEnd > 0.5) firstEmit = tEnd; });
  }
  assert.ok(firstEmit != null);
  const lat = (firstEmit - 0.5) * 1000;
  assert.ok(lat < 80, 'zpoždění detekce ' + lat.toFixed(0) + ' ms');
});
