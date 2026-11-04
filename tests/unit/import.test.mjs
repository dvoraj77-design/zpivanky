// Import písní: tempo, doby, takt, akordy, noty melodie, slabiky, text s časováním, sestavení písně, DSP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRhythmAndHarmony, notesFromPitch, timeToBeatFn, parseLrc, syllabify, lineSyllables, alignLyrics, buildImportedSong } from '../../docs/js/core/analysis.js';
import { FFTAny, stftStereo, istftStereo, timeStretch, renderStem } from '../../docs/js/core/dsp.js';
import { fastSeparate } from '../../docs/js/core/separate.js';
import { StreamAnalyzer } from '../../docs/js/core/pitch.js';
import { validateSong, transposeSong } from '../../docs/js/core/song.js';
import { parseChord } from '../../docs/js/core/music.js';
import { songById } from '../../docs/js/data/songs.js';
import { mixSong } from '../fixtures/mixsong.mjs';

function frames(x, sr) { const a = new StreamAnalyzer(sr); const out = []; for (let i = 0; i < x.length; i += 256) { const c = x.subarray(i, i + 256); a.process(c, (i + c.length) / sr, (r) => out.push({ t: r.t, midi: r.midi, voiced: r.voiced, db: r.db })); } return out; }

test('DSP: FFT libovolné délky, STFT↔ISTFT, změna tempa', () => {
  const n = 7680, f = new FFTAny(n), re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.sin(i * 0.05) + 0.3 * Math.cos(i * 0.9);
  const r0 = re.slice(); f.transform(re, im); f.transform(re, im, true);
  assert.ok(r0.every((v, i) => Math.abs(v - re[i]) < 1e-9));
  const len = 1024 * 63, L = new Float32Array(len).map((_, i) => Math.sin(i * 0.01)), R = new Float32Array(len).map((_, i) => Math.cos(i * 0.03));
  const back = istftStereo(stftStereo(L, R, 7680, 1024, 64, 3841), 7680, 1024);
  assert.ok(L.every((v, i) => Math.abs(v - back.L[i]) < 1e-5) && R.every((v, i) => Math.abs(v - back.R[i]) < 1e-5));
  const sr = 22050, x = new Float32Array(sr * 3).map((_, i) => Math.sin((2 * Math.PI * 220 * i) / sr));
  assert.ok(Math.abs(timeStretch(x, sr, 0.7).length / (x.length / 0.7) - 1) < 0.05);
  // posun výšky o +3 půltóny: frekvence ×1,19
  const y = renderStem(x, sr, { semis: 3 });
  const fr = frames(y, sr).filter((q) => q.voiced);
  const m = fr.map((q) => q.midi).sort((a, b) => a - b)[fr.length >> 1];
  assert.ok(Math.abs(m - (57 + 3)) < 0.1, 'posun výšky ' + m);
});

for (const [id, tempo] of [['hvezdicka', 92], ['valcik', 116], ['cesta-domu', 100]]) {
  test(`rozbor syntetické nahrávky „${id}“: tempo, doby, takt, akordy, melodie`, () => {
    const s0 = songById(id);
    const mix = mixSong(s0, { tempo, seconds: 40 });
    const mono = new Float32Array(mix.L.length).map((_, i) => 0.5 * (mix.L[i] + mix.R[i]));
    const sep = fastSeparate(mix.L, mix.R, mix.sr);
    const inst = new Float32Array(mono.length).map((_, i) => 0.5 * (sep.instrumental.L[i] + sep.instrumental.R[i]));
    const an = analyzeRhythmAndHarmony(mono, inst, mix.sr);
    assert.ok(Math.abs(an.bpm / tempo - 1) < 0.03, `tempo ${an.bpm.toFixed(1)} místo ${tempo}`);
    // doby: ≥ 85 % skutečných dob trefeno do ±70 ms
    const hit = mix.beats.filter((b) => b > 2 && b < 38 && an.beats.some((x) => Math.abs(x - b) < 0.07)).length;
    const tot = mix.beats.filter((b) => b > 2 && b < 38).length;
    assert.ok(hit / tot >= 0.85, `doby ${hit}/${tot}`);
    assert.equal(an.meter, s0.meter[0], 'takt');
    // akordy: shoda kořene po dobách ≥ 70 %
    const toBeatTrue = (t) => (t - mix.lead) / mix.spb;
    let ok = 0, cnt = 0;
    an.beats.forEach((bt, i) => {
      if (bt > 38 || i >= an.chordsPerBeat.length) return;
      const b = toBeatTrue(bt); if (b < 0) return;
      const truth = s0.chords.find((c) => b + 0.25 >= c.t && b + 0.25 < c.t + c.d); if (!truth) return;
      cnt++;
      const est = parseChord(an.chordsPerBeat[i]), tr = parseChord(truth.sym);
      if (est && est.root === tr.root) ok++;
    });
    assert.ok(ok / cnt >= 0.7, `akordy ${ok}/${cnt}`);
    // melodie z (ideálně) odděleného zpěvu
    const notes = notesFromPitch(frames(mix.vocals, mix.sr), timeToBeatFn(an.beats));
    const truthNotes = s0.notes.filter((n) => mix.lead + (n.t + n.d) * mix.spb < 39);
    const matched = truthNotes.filter((tn) => {
      const t = mix.lead + tn.t * mix.spb;
      return notes.some((n) => Math.abs(n.time - t) < 0.15 && ((n.p - tn.p) % 12 + 12) % 12 === 0);
    }).length;
    assert.ok(matched / truthNotes.length >= 0.8, `noty ${matched}/${truthNotes.length}`);
  });
}

test('české dělení slabik a text s časováním (LRC)', () => {
  assert.deepEqual(syllabify('maminka'), ['ma', 'min', 'ka']);
  assert.deepEqual(syllabify('zpívání'), ['zpí', 'vá', 'ní']);
  assert.deepEqual(syllabify('vlk'), ['vlk']);
  assert.deepEqual(syllabify('pouto'), ['pou', 'to']);
  assert.deepEqual(syllabify('krtek'), ['kr', 'tek']);
  assert.deepEqual(lineSyllables('Hvězdičko, ty maličká'), ['Hvěz-', 'dič-', 'ko,', 'ty', 'ma-', 'lič-', 'ká']);
  const lrc = parseLrc('[ti:Test]\n[00:01.00] Jedna dva\n[00:03.50]Tři čtyři pět\n');
  assert.equal(lrc.length, 2);
  assert.equal(lrc[1].time, 3.5);
  const notes = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ t: i, d: 1, p: 60 + i, time: 1 + i * 0.5 }));
  const al = alignLyrics(notes, lrc, { bpb: 4 });
  assert.equal(al.phrases.length, 2);
  assert.deepEqual(al.notes.map((n) => n.syl), ['Jed-', 'na', '', 'dva', '', 'Tři čty-', 'ři pět']);
});

test('sestavení importované písně je platná píseň a jde transponovat', () => {
  const s0 = songById('hvezdicka');
  const mix = mixSong(s0, { tempo: 92, seconds: 30, drums: true });
  const mono = new Float32Array(mix.L.length).map((_, i) => 0.5 * (mix.L[i] + mix.R[i]));
  const an = analyzeRhythmAndHarmony(mono, mono, mix.sr);
  const song = buildImportedSong({ id: 'import-x', title: 'Hvězdička (test)', artist: 'Test', beats: an.beats, meter: an.meter, downbeat: an.downbeat, chordsPerBeat: an.chordsPerBeat, vocalFrames: frames(mix.vocals, mix.sr), lyricsLines: [], duration: 30 });
  assert.deepEqual(validateSong(song), []);
  assert.ok(song.notes.length >= 20 && song.chords.length >= 4 && song.phrases.length >= 2);
  assert.ok(Math.abs(song.tempo - 92) < 3);
  assert.equal(song.source, 'import');
  assert.ok(transposeSong(song, -5).notes.length === song.notes.length);
});
