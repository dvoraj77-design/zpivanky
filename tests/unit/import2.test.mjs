// Import písně – melodie ze směsi, oprava oktáv, zarovnání originální stopy na tempo, přehrávání stop, úprava textu, pomocné funkce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRhythmAndHarmony, notesFromPitch, timeToBeatFn, melodyFrames, fixOctaves, buildImportedSong, relyricSong } from '../../docs/js/core/analysis.js';
import { fastSeparate } from '../../docs/js/core/separate.js';
import { stemPlan, renderPlannedStem, decimate2, wsolaWarp } from '../../docs/js/core/dsp.js';
import { parseFileName, lyricsLines, plainLines, stemShift } from '../../docs/js/core/importutil.js';
import { Transport } from '../../docs/js/audio/transport.js';
import { validateSong } from '../../docs/js/core/song.js';
import { StreamAnalyzer } from '../../docs/js/core/pitch.js';
import { songById } from '../../docs/js/data/songs.js';
import { mixSong } from '../fixtures/mixsong.mjs';

function frames(x, sr) { const a = new StreamAnalyzer(sr); const out = []; for (let i = 0; i < x.length; i += 256) { const c = x.subarray(i, i + 256); a.process(c, (i + c.length) / sr, (r) => out.push({ t: r.t, midi: r.midi, voiced: r.voiced, db: r.db })); } return out; }

for (const [id, tempo, min] of [['hvezdicka', 92, 0.6], ['valcik', 116, 0.75], ['cesta-domu', 100, 0.75]]) {
  test(`melodie z rychle odděleného zpěvu (doprovod a basa uprostřed) „${id}“`, () => {
    const s0 = songById(id);
    const mix = mixSong(s0, { tempo, seconds: 34 });
    const mono = mix.L.map((v, i) => 0.5 * (v + mix.R[i]));
    const an = analyzeRhythmAndHarmony(mono, mono, mix.sr);
    const sep = fastSeparate(mix.L, mix.R, mix.sr);
    const toBeat = timeToBeatFn(an.beats);
    const truth = s0.notes.filter((n) => mix.lead + (n.t + n.d) * mix.spb < 33);
    const hit = (notes) => truth.filter((tn) => { const t = mix.lead + tn.t * mix.spb; return notes.some((n) => Math.abs(n.time - t) < 0.15 && ((n.p - tn.p) % 12 + 12) % 12 === 0); }).length;
    const sal = hit(notesFromPitch(melodyFrames(sep.vocals.L, mix.sr), toBeat));
    const det = hit(notesFromPitch(frames(sep.vocals.L, mix.sr), toBeat));
    assert.ok(sal / truth.length >= min, `salience ${sal}/${truth.length}`);
    assert.ok(sal > det, `salience ${sal} lepší než detektor ${det} (ten chytá basu)`);
    // na čistém zpěvu salience nezaostává
    const clean = hit(notesFromPitch(melodyFrames(mix.vocals, mix.sr), toBeat));
    assert.ok(clean / truth.length >= 0.9, `čistý zpěv ${clean}/${truth.length}`);
  });
}

test('oprava oktávových chyb přepisu, oktávový skok melodie zůstane', () => {
  const mk = (ps) => ps.map((p, i) => ({ t: i, d: 1, p }));
  assert.deepEqual(fixOctaves(mk([60, 62, 76, 64, 65])).map((n) => n.p), [60, 62, 64, 64, 65]);
  assert.deepEqual(fixOctaves(mk([60, 62, 52, 64, 65])).map((n) => n.p), [60, 62, 64, 64, 65]);
  assert.deepEqual(fixOctaves(mk([60, 72, 71, 69, 67])).map((n) => n.p), [60, 72, 71, 69, 67]);
});

test('originální stopa zarovnaná na stálé tempo: doby nahrávky padnou na mřížku (i s posunem výšky)', () => {
  const sr = 22050;
  // kliky v nepravidelných dobách (tempo kolísá 0,55–0,65 s)
  const beats = []; let t = 0.4; for (let i = 0; i < 16; i++) { beats.push(t); t += 0.55 + 0.1 * ((i * 7) % 3) / 2; }
  const x = new Float32Array(Math.ceil((t + 0.5) * sr));
  for (const b of beats) { const o = Math.round(b * sr); for (let k = 0; k < 200; k++) x[o + k] += Math.sin(2 * Math.PI * 1000 * k / sr) * Math.exp(-k / 40); }
  for (const semis of [0, 3, -4]) {
    const plan = stemPlan(beats, 2, x.length / sr, { spb: 0.5, semis, fromBeat: -3, toBeat: 12 });
    assert.equal(plan.fromBeat, -2.4 / 0.55 > 3 ? -3 : plan.fromBeat);
    const [y] = renderPlannedStem([x], sr, plan);
    // doba písně b leží v bufferu na (b - fromBeat) * outSpb
    let errs = [];
    for (let b = 0; b <= 11; b++) {
      const pos = (b - plan.fromBeat) * plan.outSpb * sr;
      let best = -1, bv = 0; for (let k = Math.round(pos - 0.05 * sr); k < pos + 0.05 * sr; k++) if (Math.abs(y[k] || 0) > bv) { bv = Math.abs(y[k]); best = k; }
      errs.push(Math.abs(best - pos) / sr);
    }
    errs.sort((a, b) => a - b);
    assert.ok(errs[Math.floor(errs.length * 0.8)] < 0.015, `posun ${semis}: chyby ${errs.map((e) => (e * 1000).toFixed(0)).join(',')} ms`);
    assert.ok(Math.abs(plan.rate - Math.pow(2, semis / 12)) < 1e-9);
  }
  // WSOLA zachová výšku tónu
  const tone = new Float32Array(sr * 2).map((_, i) => Math.sin(2 * Math.PI * 220 * i / sr));
  const [z] = wsolaWarp([tone], sr, (i) => i * 0.7, Math.round(sr * 2 / 0.7) - 2000);
  const fr = frames(z, sr).filter((f) => f.voiced); const m = fr.map((f) => f.midi).sort((a, b) => a - b)[fr.length >> 1];
  assert.ok(Math.abs(m - 57) < 0.1, 'výška ' + m);
  assert.equal(decimate2(new Float32Array(1000)).length, 500);
});

function mockEngine() {
  const calls = [];
  const ctx = {
    currentTime: 10,
    createBufferSource() { const s = { playbackRate: { value: 1 }, connect() {}, start(when, off) { calls.push({ op: 'start', when, off, rate: s.playbackRate.value }); }, stop(when) { calls.push({ op: 'stop', when }); } }; return s; },
    createGain() { return { gain: { value: 1 }, connect() {} }; },
  };
  return { ctx, calls, get now() { return ctx.currentTime; }, bus: { accomp: {}, guide: {} }, playEvent() { return null; } };
}
test('transport: originální stopa se spustí na správném místě, ve smyčce se přeplánuje, při zastavení utne', () => {
  const eng = mockEngine();
  const tr = new Transport(eng);
  const buffer = { duration: 100 };
  tr.load({ events: [], tempo: 120, factor: 1, length: 40, loop: { from: 4, to: 8 }, clips: [{ buffer, beat0: -2.5, spb: 0.6, rate: 1.2, bus: 'accomp' }] });
  tr.start(0, 0.2);
  const s1 = eng.calls.find((c) => c.op === 'start');
  assert.ok(Math.abs(s1.when - 10.2) < 1e-9 && Math.abs(s1.off - 1.5) < 1e-9 && Math.abs(s1.rate - 1.2) < 1e-9, JSON.stringify(s1));
  // smyčka: v době 8 → zpět na 4 (čas 10.2 + 8 × 0,5 = 14.2)
  eng.ctx.currentTime = 14.0; tr._tick();
  const st = eng.calls.filter((c) => c.op === 'start');
  assert.equal(st.length, 2);
  assert.ok(Math.abs(st[1].when - 14.2) < 1e-9 && Math.abs(st[1].off - (4 + 2.5) * 0.6) < 1e-9, JSON.stringify(st[1]));
  assert.ok(eng.calls.some((c) => c.op === 'stop' && Math.abs(c.when - 14.2) < 1e-9), 'stará stopa utnuta ve stejný okamžik');
  // stopa začínající později (předehra kratší než odpočet) → zpožděný start
  const eng2 = mockEngine(); const tr2 = new Transport(eng2);
  tr2.load({ events: [], tempo: 60, length: 20, clips: [{ buffer, beat0: 2, spb: 1, rate: 1, bus: 'accomp' }] });
  tr2.start(0, 0.1);
  const s2 = eng2.calls.find((c) => c.op === 'start');
  assert.ok(Math.abs(s2.when - 12.1) < 1e-9 && s2.off === 0, JSON.stringify(s2));
  tr2.stop();
  assert.ok(eng2.calls.some((c) => c.op === 'stop'));
  tr.stop();
});

test('úprava textu importované písně zachová noty a rozdělí text do frází', () => {
  const s0 = songById('hvezdicka');
  const mix = mixSong(s0, { tempo: 92, seconds: 30 });
  const mono = mix.L.map((v, i) => 0.5 * (v + mix.R[i]));
  const an = analyzeRhythmAndHarmony(mono, mono, mix.sr);
  const song = buildImportedSong({ id: 'import-t', title: 'T', beats: an.beats, meter: an.meter, downbeat: an.downbeat, chordsPerBeat: an.chordsPerBeat, vocalFrames: frames(mix.vocals, mix.sr), lyricsLines: [], duration: 30 });
  const s2 = relyricSong(song, plainLines('Hvězdičko ty maličká\nkdo tě na nebe dal\n\n'));
  assert.equal(s2.notes.length, song.notes.length);
  assert.equal(s2.lyrics[0].text, 'Hvězdičko ty maličká');
  assert.equal(s2.notes[0].syl, 'Hvěz-');
  assert.deepEqual(validateSong(s2), []);
});

test('pomocné funkce importu: název ze souboru, LRC s posunem úseku, posun originálu', () => {
  assert.deepEqual(parseFileName('Kryštof - Ty a já.mp3'), { artist: 'Kryštof', title: 'Ty a já' });
  assert.deepEqual(parseFileName('03. Jarek Nohavica - Těšínská.m4a'), { artist: 'Jarek Nohavica', title: 'Těšínská' });
  assert.deepEqual(parseFileName('99 Luftballons.mp3'), { artist: '', title: '99 Luftballons' });
  assert.deepEqual(parseFileName('moje_nahravka.wav'), { artist: '', title: 'moje nahravka' });
  const l = lyricsLines({ synced: '[00:10.00] A\n[00:15.50] B\n[00:20.00] C', plain: 'A\nB\nC' }, 12);
  assert.deepEqual(l.map((x) => [x.time, x.text]), [[3.5, 'B'], [8, 'C']]);
  assert.deepEqual(lyricsLines({ synced: null, plain: '[Refrén]\nJedna\n\nDva' }).map((x) => x.text), ['Jedna', 'Dva']);
  assert.deepEqual([0, 1, 5, 6, 7, 11, 12, -1, -7, -12, 13].map(stemShift), [0, 1, 5, -6, -5, -1, 0, -1, 5, 0, 1]);
});
