// Obsah Hudební nauky a kapitoly pro začátečníky.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEORY, ALL_THEORY } from '../../docs/js/data/theory.js';
import { CHAPTERS } from '../../docs/js/data/course.js';
import { buildExercise } from '../../docs/js/core/exercises.js';
import { defaultProfile } from '../../docs/js/core/voice.js';
import { HELP } from '../../docs/js/screens/help.js';

test('Hudební nauka: kapitoly, lekce, kvízy s platnými odpověďmi', () => {
  assert.ok(THEORY.length >= 8, 'kapitol ' + THEORY.length);
  const ids = new Set();
  for (const l of ALL_THEORY) {
    assert.ok(!ids.has(l.id)); ids.add(l.id);
    assert.ok(l.blocks.some((b) => b.t === 'p'), l.id + ' bez textu');
    assert.ok(l.blocks.some((b) => b.t === 'quiz'), l.id + ' bez kvízu');
    assert.ok(l.blocks.some((b) => ['play', 'rhythm', 'keys', 'roll'].includes(b.t)), l.id + ' bez ukázky');
    for (const b of l.blocks) {
      if (b.t === 'quiz') { assert.ok(b.answer >= 0 && b.answer < b.options.length, l.id + ' špatná odpověď'); assert.ok(b.q.length > 5); }
      if (b.t === 'play') for (const n of b.notes) assert.ok(n[0] >= 36 && n[0] <= 96 && n[2] > 0, l.id + ' nota');
      if (b.t === 'rhythm') assert.ok(b.pattern.length && b.bpm >= 40);
    }
  }
});

test('kapitola 0 „Ovládni svůj hlas“ je první a jde vygenerovat', () => {
  assert.equal(CHAPTERS[0].id, 'c0');
  const p = defaultProfile();
  for (const l of CHAPTERS[0].lessons) {
    const plan = buildExercise(l.ex, p, { seed: 3 });
    if (l.ex.type === 'earCompare') {
      assert.ok(plan.questions.length >= 8);
      for (const q of plan.questions) { assert.ok(q.root + Math.min(0, q.semi) >= p.comfortLow - 0.5 && q.root + Math.max(0, q.semi) <= p.comfortHigh + 0.5); }
    } else assert.ok(plan.items.length > 0);
  }
});

test('nápověda pokrývá režimy, válec not, noty, hlas, sluchátka, více lidí', () => {
  for (const id of ['start', 'voice', 'roll', 'modes', 'tuner', 'score', 'notes', 'key', 'headphones', 'people', 'safety']) assert.ok(HELP.some((h) => h.id === id && h.body.length >= 2), id);
});
