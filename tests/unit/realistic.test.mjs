// Realistický syntetický zpěvák (formanty, vibrato, drift, nasazení zespodu, souhlásky, dech, ozvěna, šum, průsak doprovodu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StreamAnalyzer } from '../../docs/js/core/pitch.js';
import { scorePitchTargets, summarize } from '../../docs/js/core/scoring.js';
import { buildExercise, planTargets } from '../../docs/js/core/exercises.js';
import { defaultProfile, recommendShifts } from '../../docs/js/core/voice.js';
import { lessonById } from '../../docs/js/data/course.js';
import { songById } from '../../docs/js/data/songs.js';
import { transposeSong } from '../../docs/js/core/song.js';
import { realSinger, notesFromTargets } from '../fixtures/realistic.mjs';

const P = defaultProfile();
function frames(s, sr) { const a = new StreamAnalyzer(sr); const out = []; for (let i = 0; i < s.length; i += 128) { const c = s.subarray(i, i + 128); a.process(c, (i + c.length) / sr, (r) => out.push({ t: r.t, midi: r.midi, voiced: r.voiced })); } return out; }
const exT = planTargets(buildExercise(lessonById('c5l2').ex, P, { seed: 1 }));
const s0 = songById('hvezdicka');
const song = transposeSong(s0, recommendShifts(s0.notes, P)[0].shift);
const spb = 60 / song.tempo;
const songT = song.notes.map((n) => ({ start: (n.t + 4) * spb, end: (n.t + n.d + 4) * spb, midi: n.p, phrase: n.phrase }));

const GOOD = { 'základ': {}, 'tichý mikrofon (−28 dB)': { gainDb: -28 }, 'přebuzený mikrofon': { clip: true }, 'šum ventilátoru (−38 dBFS)': { bgNoiseDb: -38 }, 'velké vibrato ±60 c': { vibCents: 60 }, 'nasazení zespodu 150 c': { scoopCents: 150 }, 'Bluetooth 16 kHz': { sr: 16000 }, 'průsak doprovodu −28 dB': 'leak' };

for (const [what, tg] of [['cvičení 1-2-3-2-1', exT], ['píseň Hvězdička', songT]]) {
  for (const [name, v0] of Object.entries(GOOD)) {
    test(`${what}: ${name} → dobré hodnocení, bez chybějících tónů`, () => {
      const v = v0 === 'leak' ? { leak: tg.map((t) => ({ start: t.start, end: t.end, midis: [t.midi - 8, t.midi - 5, t.midi] })), leakDb: -28 } : v0;
      const sr = v.sr || 48000;
      const fr = frames(realSinger(notesFromTargets(tg), { bgNoiseDb: -55, ...v, sr }), sr);
      const notes = scorePitchTargets(tg, fr, { tol: 50 });
      const sum = summarize(notes, { tol: 50 });
      const missed = notes.filter((n) => n.status === 'missed').length;
      assert.ok(sum.overall >= 85, `skóre ${sum.overall}`);
      assert.ok(missed <= Math.ceil(notes.length * 0.05), `chybí ${missed} tónů`);
    });
  }
  test(`${what}: o 35 c níž / o 30 c výš rozpoznáno (±25 c)`, () => {
    for (const [d, re] of [[-35, /níž/], [30, /výš/]]) {
      const fr = frames(realSinger(notesFromTargets(tg), { bgNoiseDb: -55, detuneCents: d }), 48000);
      const notes = scorePitchTargets(tg, fr, { tol: 25 });
      const sum = summarize(notes, { tol: 25 });
      const wrong = notes.filter((n) => n.status === (d < 0 ? 'low' : 'high')).length;
      assert.ok(wrong >= notes.length * 0.8, `${d} c: ${wrong}/${notes.length}`);
      assert.match(sum.tip, re);
      assert.ok(sum.overall < 60);
    }
  });
}
