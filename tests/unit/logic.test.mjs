import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteName, keyName, parseNote, foldCents, parseChord, chordSymbol, intervalName } from '../../docs/js/core/music.js';
import { computeProfile, defaultProfile, recommendShifts, extremeHeld, speakingPitch, profileSummary } from '../../docs/js/core/voice.js';
import { scorePitchTargets, summarize, scoreRhythm, scoreBreath, scoreDynamics, centsText } from '../../docs/js/core/scoring.js';
import { buildExercise, planTargets, tonicSequence, dynamicsCurve } from '../../docs/js/core/exercises.js';
import { CHAPTERS, ALL_LESSONS } from '../../docs/js/data/course.js';
import { SONGS } from '../../docs/js/data/songs.js';
import { emptyProgress, isUnlocked, skipTo, recordAttempt, streak, nextLesson, dailyPlan, weakest, dayKey } from '../../docs/js/core/progress.js';
import { createBackup, restoreBackup, memoryStore, validateBackup } from '../../docs/js/core/backup.js';
import { transcribe, harmonize, buildCustomSong, parseNoteInput } from '../../docs/js/core/transcribe.js';
import { validateSong, checkHarmony } from '../../docs/js/core/song.js';

test('české značení not: H a B = B♭', () => {
  assert.equal(noteName(71, { style: 'cz' }), 'H4');
  assert.equal(noteName(70, { style: 'cz' }), 'B4');
  assert.equal(noteName(61, { style: 'cz' }), 'Cis4');
  assert.equal(noteName(63, { style: 'cz' }), 'Es4');
  assert.equal(noteName(66, { style: 'cz' }), 'Fis4');
  assert.equal(noteName(68, { style: 'cz' }), 'As4');
  assert.equal(noteName(71, { style: 'intl' }), 'B4');
  assert.equal(noteName(70, { style: 'intl' }), 'B♭4');
  assert.equal(noteName(69, { style: 'intl' }), 'A4');
  assert.equal(noteName(60, { style: 'solf', keyPc: 0 }), 'do');
  assert.equal(noteName(67, { style: 'solf', keyPc: 0 }), 'sol');
  assert.equal(noteName(62, { style: 'solf', keyPc: 10 }), 'mi');
  assert.equal(keyName(10, 'cz'), 'B dur');
  assert.equal(keyName(11, 'cz'), 'H dur');
  assert.equal(keyName(3, 'cz'), 'Es dur');
  assert.equal(keyName(10, 'intl'), 'B♭ dur');
  assert.equal(noteName(70, { style: 'cz', keyPc: 3 }), 'B4');
  assert.equal(parseNote('A4'), 69);
  assert.equal(parseNote('Bb2'), 46);
  assert.equal(parseNote('F#3'), 54);
  assert.equal(foldCents(-1230), -30);
  assert.equal(foldCents(1200), 0);
  assert.deepEqual(parseChord('G7').pcs, [7, 11, 2, 5]);
  assert.equal(chordSymbol(parseChord('Bb'), 'cz'), 'B');
  assert.equal(chordSymbol(parseChord('B'), 'cz'), 'H');
  assert.equal(intervalName(7), 'čistá kvinta');
});

test('profil hlasu a typ hlasu (bez předpokladu pohlaví)', () => {
  const cases = [
    { m: { low: 40, highChest: 62, highFalsetto: 69, speakingHz: 95 }, type: 'bass' },
    { m: { low: 43, highChest: 67, highFalsetto: 72, speakingHz: 110 }, type: 'baritone' },
    { m: { low: 48, highChest: 71, highFalsetto: 77, speakingHz: 135 }, type: 'tenor' },
    { m: { low: 53, highChest: 76, speakingHz: 180 }, type: 'alto' },
    { m: { low: 57, highChest: 80, speakingHz: 200 }, type: 'mezzo' },
    { m: { low: 60, highChest: 84, speakingHz: 240 }, type: 'soprano' },
    // stejný rozsah bez mluvené výšky – klasifikace jen z rozsahu
    { m: { low: 43, highChest: 67 }, type: 'baritone' },
  ];
  for (const c of cases) {
    const p = computeProfile(c.m);
    assert.equal(p.type, c.type, JSON.stringify(c.m));
    assert.ok(p.comfortLow >= p.low && p.comfortHigh <= p.highChest);
    assert.ok(p.tessLow >= p.comfortLow && p.tessHigh <= p.comfortHigh);
    assert.ok(p.workingTonic >= p.comfortLow && p.workingTonic + 7 <= p.comfortHigh, 'pracovní tónina: do–sol v pohodlném rozsahu');
  }
  const d = defaultProfile();
  assert.equal(d.type, 'baritone');
  const s = profileSummary(d, 'cz');
  assert.equal(s.range, 'G2–A4');
  assert.match(s.key, /^H · baryton$/);
  // ruční úprava hranic
  const m = computeProfile({ low: 43, highChest: 64, manual: { comfortLow: 46, comfortHigh: 60 } });
  assert.equal(m.comfortLow, 46);
  assert.equal(m.comfortHigh, 60);
});

test('doporučení tóniny: každá píseň se posune do rozsahu (2–3 návrhy)', () => {
  const profiles = [defaultProfile(), computeProfile({ low: 53, highChest: 76 }), computeProfile({ low: 60, highChest: 84 }), computeProfile({ low: 48, highChest: 70 })];
  for (const p of profiles) {
    for (const s of SONGS) {
      const rec = recommendShifts(s.notes, p);
      assert.ok(rec.length >= 2 && rec.length <= 3, s.id);
      const best = rec[0];
      const lo = Math.min(...s.notes.map((n) => n.p)) + best.shift, hi = Math.max(...s.notes.map((n) => n.p)) + best.shift;
      assert.ok(lo >= p.low && hi <= p.highChest, `${s.id} mimo změřený rozsah pro ${p.typeName}`);
      if (hi - lo <= p.comfortHigh - p.comfortLow) assert.ok(best.fits, `${s.id}: nejlepší návrh má sedět do pohodlného rozsahu`);
    }
  }
});

test('vyhodnocení testu hlasu: nejnižší/nejvyšší držený tón, mluvená výška', () => {
  const frames = [];
  let t = 0;
  // klouzání dolů a držení G2 (43) 1 s
  for (let m = 55; m > 43; m -= 0.1) { frames.push({ t, midi: m, voiced: true }); t += 0.01; }
  for (let i = 0; i < 100; i++) { frames.push({ t, midi: 43 + Math.sin(i / 5) * 0.1, voiced: true }); t += 0.01; }
  assert.equal(extremeHeld(frames, 'low'), 43);
  const up = [];
  t = 0;
  for (let i = 0; i < 80; i++) { up.push({ t, midi: 62, voiced: true }); t += 0.01; }
  for (let i = 0; i < 70; i++) { up.push({ t, midi: 65.1, voiced: true }); t += 0.01; }
  for (let i = 0; i < 20; i++) { up.push({ t, midi: 68, voiced: true }); t += 0.01; } // krátce, nepočítá se
  assert.equal(extremeHeld(up, 'high'), 65);
  const sp = speakingPitch(Array.from({ length: 200 }, (_, i) => ({ t: i * 0.01, midi: 45 + Math.sin(i) * 2, voiced: true })));
  assert.ok(Math.abs(sp - 110) < 3);
});

function framesFor(targets, fn, hop = 0.01) {
  const end = Math.max(...targets.map((t) => t.end)) + 0.5;
  const out = [];
  for (let t = 0; t < end; t += hop) {
    const tg = targets.find((x) => t >= x.start && t < x.end);
    const m = tg ? fn(tg, t) : null;
    out.push({ t, midi: m, voiced: m != null, db: m != null ? -20 : -70 });
  }
  return out;
}
const TARGETS = [0, 1, 2, 3, 4].map((i) => ({ start: 1 + i, end: 1.9 + i, midi: [48, 50, 52, 50, 48][i], phrase: i < 3 ? 0 : 1, syl: ['do', 're', 'mi', 're', 'do'][i] }));

test('hodnocení: přesně / o 30 centů níž / o oktávu níž / pozdě / ticho', () => {
  const exact = summarize(scorePitchTargets(TARGETS, framesFor(TARGETS, (tg) => tg.midi), { tol: 25 }), { tol: 25 });
  assert.ok(exact.overall >= 90, 'přesně ' + exact.overall);
  assert.equal(exact.stars, 3);
  const flatNotes = scorePitchTargets(TARGETS, framesFor(TARGETS, (tg) => tg.midi - 0.3), { tol: 25 });
  const flat = summarize(flatNotes, { tol: 25 });
  assert.ok(flatNotes.every((n) => n.status === 'low' && Math.abs(n.medDev + 30) < 1));
  assert.ok(flat.overall < 70, 'o 30 centů níž ' + flat.overall);
  assert.match(flat.tip, /o 30 centů níž/);
  // začátečník (±50) toleruje 30 centů
  const flatBeg = summarize(scorePitchTargets(TARGETS, framesFor(TARGETS, (tg) => tg.midi - 0.3), { tol: 50 }), { tol: 50 });
  assert.ok(flatBeg.overall >= 75, 'začátečník ' + flatBeg.overall);
  const oct = summarize(scorePitchTargets(TARGETS, framesFor(TARGETS, (tg) => tg.midi - 12), { tol: 25 }), { tol: 25 });
  assert.ok(oct.overall >= 90, 'o oktávu níž = správně ' + oct.overall);
  const lateNotes = scorePitchTargets(TARGETS, framesFor(TARGETS, (tg, t) => (t >= tg.start + 0.3 ? tg.midi : null)), { tol: 25 });
  assert.ok(lateNotes.every((n) => n.onsetDelay > 0.25 && n.onsetDelay < 0.35));
  assert.match(summarize(lateNotes, { tol: 25 }).tip, /pozdě/);
  const silent = summarize(scorePitchTargets(TARGETS, framesFor(TARGETS, () => null), { tol: 25 }), { tol: 25 });
  assert.ok(silent.overall <= 20);
  assert.equal(silent.stars, 0);
  assert.equal(exact.phrases.length, 2);
  assert.equal(centsText(-30), 'o 30 centů níž');
});

test('hodnocení rytmu, dechu a dynamiky', () => {
  const tg = [0, 1, 2, 3].map((i) => ({ start: 1 + i * 0.5, end: 1.4 + i * 0.5 }));
  const ok = scoreRhythm(tg, tg.map((x) => x.start + 0.02));
  assert.ok(ok.overall >= 95);
  const late = scoreRhythm(tg, tg.map((x) => x.start + 0.18));
  assert.ok(late.overall < 50);
  assert.match(late.tip, /pozdě/);
  const frames = [];
  for (let t = 0; t < 12; t += 0.01) frames.push({ t, hiss: t > 1 && t < 9, voiced: false, db: -30 });
  const b = scoreBreath(frames, 0, 12, 8);
  assert.ok(Math.abs(b.duration - 8) < 0.1 && b.overall >= 90);
  const cres = dynamicsCurve('cresc', 12);
  const dframes = [];
  for (let t = 0; t <= 4; t += 0.01) dframes.push({ t, voiced: true, db: -30 + 12 * (t / 4) });
  const d = scoreDynamics((t) => cres(t / 4), dframes, 0, 4, -24);
  assert.ok(d.overall >= 85, 'crescendo ' + d.overall);
  const flatD = scoreDynamics((t) => cres(t / 4), dframes.map((f) => ({ ...f, db: -24 })), 0, 4, -24);
  assert.ok(flatD.overall < 50);
});

test('všechna cvičení kurzu se vygenerují v bezpečném rozsahu pro různé hlasy', () => {
  assert.ok(CHAPTERS.length >= 8 && ALL_LESSONS.length >= 40);
  const types = new Set(ALL_LESSONS.map((l) => l.ex.type));
  for (const t of ['hold', 'match', 'scale', 'arpeggio', 'interval', 'earInterval', 'siren', 'rhythm', 'callResponse', 'breath', 'dynamics']) assert.ok(types.has(t), 'chybí typ ' + t);
  const profiles = [defaultProfile(), computeProfile({ low: 53, highChest: 76, highFalsetto: 81 }), computeProfile({ low: 45, highChest: 57 }), computeProfile({ low: 60, highChest: 84 })];
  for (const p of profiles) {
    for (const l of ALL_LESSONS) {
      assert.ok(l.text.split(/[.!?]\s/).length >= 2 && l.text.length < 420, `${l.id}: vysvětlení 2–4 věty`);
      const plan = buildExercise(l.ex, p, { seed: 1 });
      const max = l.ex.falsetto ? p.highAll : p.highChest;
      for (const it of plan.items) {
        assert.ok(it.midi >= p.low - 0.01 && it.midi <= max, `${l.id}: tón ${it.midi} mimo rozsah ${p.low}–${max}`);
        if (it.toMidi != null) assert.ok(it.toMidi <= max && it.toMidi >= p.low);
      }
      if (['pitch', 'rhythm', 'dynamics'].includes(plan.kind)) assert.ok(planTargets(plan).length > 0, l.id + ' bez cílů');
      if (plan.kind === 'ear') assert.ok(plan.questions.length >= 5);
    }
  }
  // posun po půltónech
  assert.deepEqual(tonicSequence([0, 2, 4, 2, 0], 47, 45, 62, 4, 'up'), [47, 48, 49, 50]);
  const seq = tonicSequence([0, 7], 47, 45, 57, 5, 'updown');
  assert.ok(seq.every((t) => t >= 45 && t + 7 <= 57));
});

test('odemykání lekcí, přeskočení, hvězdičky, série dní, plán', () => {
  const p = emptyProgress();
  assert.ok(isUnlocked(p, ALL_LESSONS[0].id));
  assert.ok(!isUnlocked(p, ALL_LESSONS[1].id));
  recordAttempt(p, { type: 'lesson', id: ALL_LESSONS[0].id, score: 40, stars: 0, seconds: 60 });
  assert.ok(!isUnlocked(p, ALL_LESSONS[1].id), '0★ neodemyká');
  recordAttempt(p, { type: 'lesson', id: ALL_LESSONS[0].id, score: 72, stars: 2, seconds: 60 });
  assert.ok(isUnlocked(p, ALL_LESSONS[1].id), '≥1★ odemyká');
  assert.equal(p.lessons[ALL_LESSONS[0].id].stars, 2);
  recordAttempt(p, { type: 'lesson', id: ALL_LESSONS[0].id, score: 55, stars: 1 });
  assert.equal(p.lessons[ALL_LESSONS[0].id].stars, 2, 'nejlepší hvězdy zůstávají');
  assert.ok(!isUnlocked(p, ALL_LESSONS[10].id));
  skipTo(p, ALL_LESSONS[10].id);
  assert.ok(isUnlocked(p, ALL_LESSONS[10].id));
  assert.equal(nextLesson(p).id, ALL_LESSONS[10].id);
  assert.ok(p.badges.first);
  // série
  const q = emptyProgress();
  const d = new Date('2026-11-03T10:00:00');
  for (let i = 3; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); recordAttempt(q, { type: 'tool', id: 'x', seconds: 120, date: x }); }
  assert.equal(streak(q, d), 4);
  assert.ok(q.badges.streak3);
  const plan5 = dailyPlan(p, 5, SONGS, defaultProfile());
  const plan20 = dailyPlan(p, 20, SONGS, defaultProfile());
  assert.ok(plan5.length >= 3 && plan20.length > plan5.length);
  assert.ok(plan5.some((x) => x.kind === 'lesson') && plan5.some((x) => x.kind === 'song') && plan5.some((x) => x.kind === 'warmup'));
  // slabá místa
  recordAttempt(p, { type: 'lesson', id: 'c5l2', score: 60, stars: 1, notes: [{ midi: 48, medDev: -5 }, { midi: 52, medDev: -45 }, { midi: 48, medDev: 0 }, { midi: 52, medDev: -40 }, { midi: 48, medDev: 2 }, { midi: 52, medDev: -50 }] });
  const w = weakest(p);
  assert.equal(w.notes[0].midi, 52);
  assert.equal(w.intervals[0].semi, 4);
  assert.ok(dailyPlan(p, 10, SONGS, defaultProfile()).some((x) => x.kind === 'drill'));
  assert.match(dayKey(new Date('2026-01-05T12:00:00')), /^2026-01-05$/);
});

test('záloha a obnova jedním souborem (včetně nahrávek)', async () => {
  const a = memoryStore();
  const prog = emptyProgress();
  recordAttempt(prog, { type: 'lesson', id: 'c1l1', score: 80, stars: 2, seconds: 30 });
  await a.setKV('progress', prog);
  await a.setKV('profile', defaultProfile());
  await a.putSong({ format: 'zpivanky-song', id: 'moje', title: 'Moje' });
  await a.putAttempt({ itemId: 'c1l1', score: 80 });
  await a.putRecording({ id: 'r1', sampleRate: 24000, pcm: new Int16Array([1, -2, 3, 32767, -32768]) });
  const data = JSON.parse(JSON.stringify(await createBackup(a, { includeRecordings: true, settings: { notation: 'cz' } })));
  assert.deepEqual(validateBackup(data), []);
  const b = memoryStore();
  const res = await restoreBackup(b, data);
  assert.equal(res.settings.notation, 'cz');
  assert.deepEqual(await b.getKV('progress'), prog);
  assert.equal((await b.listSongs())[0].title, 'Moje');
  assert.deepEqual(Array.from((await b.getRecording('r1')).pcm), [1, -2, 3, 32767, -32768]);
  const noRec = await createBackup(a, { includeRecordings: false });
  assert.equal(noRec.recordings.length, 0);
  await assert.rejects(() => restoreBackup(b, { format: 'neco' }));
});

test('nazpívaná melodie → noty → akordy → píseň', () => {
  const tempo = 90, spb = 60 / tempo;
  const melody = [{ t: 0, d: 1, p: 48 }, { t: 1, d: 1, p: 50 }, { t: 2, d: 2, p: 52 }, { t: 4, d: 1, p: 53 }, { t: 5, d: 1, p: 52 }, { t: 6, d: 2, p: 48 }];
  const frames = [];
  for (let t = 0; t < 8 * spb + 0.5; t += 0.01) {
    const n = melody.find((m) => t >= m.t * spb + 0.03 && t < (m.t + m.d) * spb - 0.04);
    frames.push({ t: t + 0.5, midi: n ? n.p - 0.2 + Math.sin(t * 30) * 0.05 : null, voiced: !!n });
  }
  const notes = transcribe(frames, { tempo });
  assert.deepEqual(notes.map((n) => n.p), melody.map((m) => m.p));
  assert.deepEqual(notes.map((n) => [n.t, n.d]), melody.map((m) => [m.t, m.d]));
  const h = harmonize(notes, { bpb: 4 });
  assert.equal(h.key.tonic, 0);
  assert.equal(h.chords.at(-1).sym, 'C');
  const song = buildCustomSong({ id: 'x', title: 'X', tempo, notes, chords: h.chords, lyricsText: 'Do re mi fa mi do' });
  assert.deepEqual(validateSong(song), []);
  assert.deepEqual(checkHarmony(song), []);
  assert.deepEqual(parseNoteInput('C4/1 D E/2 r/1 H3/1 B').map((n) => n.p), [60, 62, 64, 59, 58]);
});
