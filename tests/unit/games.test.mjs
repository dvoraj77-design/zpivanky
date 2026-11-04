// Hry: katalog, generátory otázek pro všechny úrovně, opakování podle chyb, metriky zpívacích her.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, makeQuestion, rng, pickItem, updateBox, czNote, rhythmMetrics, tempoMetrics, reactionTimes, stability, singGameScore, randomMotif, levelUnlocked, gameStars } from '../../docs/js/core/games.js';
import { buildExercise } from '../../docs/js/core/exercises.js';
import { defaultProfile } from '../../docs/js/core/voice.js';

test('katalog: 3 skupiny, každá hra má 5 úrovní', () => {
  for (const g of ['nauka', 'poslech', 'zpev']) assert.ok(GAMES.filter((x) => x.group === g).length >= 5, g);
  for (const g of GAMES) assert.equal(g.levels.length, 5, g.id);
});

test('kvízy: každá úroveň dává platné otázky (odpověď je mezi možnostmi, bez opakování po sobě)', () => {
  const r = rng(7);
  for (const g of GAMES.filter((x) => x.kind === 'quiz')) {
    for (let lv = 0; lv < 5; lv++) {
      let prev = null;
      for (let i = 0; i < 40; i++) {
        const q = makeQuestion(g.id, lv, r, {}, prev);
        assert.ok(q.key && q.view, `${g.id} ${lv}`);
        if (q.view.tap) assert.ok(q.answer >= 0 && q.answer < 12);
        else assert.ok(q.options.some((o) => o.id === q.answer), `${g.id} úroveň ${lv + 1}: odpověď ${q.answer} mezi ${q.options.map((o) => o.id)}`);
        assert.equal(new Set(q.options.map((o) => String(o.id))).size, q.options.length, `${g.id}: duplicitní možnosti`);
        if (g.audio) assert.ok(q.audio?.notes?.length, g.id + ' zvuk');
        prev = q.key;
      }
    }
  }
});

test('noty a intervaly odpovídají notám na osnově; české názvy tónů', () => {
  assert.deepEqual([[0, 1], [1, -1], [2, -1], [5, -1], [6, -1], [6, 0]].map(([l, a]) => czNote(l, a)), ['Cis', 'Des', 'Es', 'As', 'B', 'H']);
  const r = rng(3);
  for (let i = 0; i < 30; i++) {
    const q = makeQuestion('intervaly-noty', 2, r);
    const [a, b] = q.view.notes;
    const steps = (b.oct - a.oct) * 7 + b.l - a.l;
    assert.equal(q.answer, ['prima', 'sekunda', 'tercie', 'kvarta', 'kvinta', 'sexta', 'septima', 'oktáva'][steps]);
  }
});

test('Leitner: chybné položky se vrací častěji', () => {
  const boxes = {};
  for (const k of ['a', 'b', 'c', 'd']) updateBox(boxes, k, true), updateBox(boxes, k, true), updateBox(boxes, k, true);
  updateBox(boxes, 'c', false);
  const r = rng(11); const cnt = { a: 0, b: 0, c: 0, d: 0 };
  for (let i = 0; i < 2000; i++) cnt[pickItem(['a', 'b', 'c', 'd'], boxes, r)]++;
  assert.ok(cnt.c > cnt.a * 2.5, JSON.stringify(cnt));
});

test('zpívací hry: zadání se dá sestavit pro všechny úrovně; motivy pro hru na paměť', () => {
  const P = defaultProfile();
  for (const g of GAMES.filter((x) => x.kind === 'sing')) {
    g.levels.forEach((lv, i) => {
      const spec = { ...lv.spec, ...(lv.spec.randomMotif ? { motifs: [0, 1, 2].map(() => randomMotif(lv.spec.randomMotif, rng(i + 1))) } : {}) };
      const plan = buildExercise(spec, P, { seed: 1 });
      assert.ok(plan.items.filter((x) => !x.listen).length >= 2, `${g.id} ${i + 1}`);
    });
  }
  const m = randomMotif({ n: 5 }, rng(5));
  assert.equal(m.degrees.length, 5); assert.ok(m.degrees.every((d) => d >= 1 && d <= 6));
  assert.equal(m.durs.reduce((a, b) => a + b, 0) % 1, 0);
});

test('metriky: přesnost a pravidelnost rytmu, držení tempa, rychlost trefy, stabilita tónu', () => {
  const notes = [0.02, -0.01, 0.03, 0.0, 0.01].map((d, i) => ({ start: i * 0.5, delay: d }));
  const m = rhythmMetrics(notes);
  assert.equal(m.mean, 10); assert.ok(m.sd > 10 && m.sd < 20);
  // po zmlknutí metronomu zpomaluje o 10 %
  const tn = []; for (let i = 0; i < 16; i++) { const t = i * 0.5; const a = i < 8 ? t : 4 + (t - 4) * 1.1; tn.push({ start: t, delay: a - t }); }
  const tm = tempoMetrics(tn, 4);
  assert.ok(tm.drift < -8 && tm.drift > -11, 'zpomalení ' + tm.drift);
  const frames = []; for (let t = 0; t < 2; t += 0.02) frames.push({ t, m: t < 0.4 ? 57 : 60.05 });
  assert.equal(reactionTimes([{ start: 0, end: 2, midi: 60 }], frames, 50)[0], 400);
  const fr2 = []; for (let t = 0; t < 3; t += 0.02) fr2.push({ t, m: 60 + 0.1 * Math.sin(t * 20) });
  const st = stability([{ start: 0, end: 3, midi: 60 }], fr2)[0];
  assert.ok(st >= 6 && st <= 8, 'stabilita ' + st);
  const g = GAMES.find((x) => x.id === 'pa-pa-pa');
  const res = singGameScore(g, 0, { overall: 80, notes });
  assert.ok(res.metrics.some(([k]) => k === 'Pravidelnost'));
  assert.equal(gameStars(86), 3); assert.equal(gameStars(49), 0);
  assert.ok(levelUnlocked({}, 0) && !levelUnlocked({}, 1) && levelUnlocked({ levels: { 0: { stars: 1 } } }, 1));
});
