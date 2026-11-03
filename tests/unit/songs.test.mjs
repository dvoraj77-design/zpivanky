import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../../docs/js/data/songs.js';
import { checkHarmony, validateSong, songRange, transposeSong, compileSong, splitSyllables, parseMelody } from '../../docs/js/core/song.js';
import { generateAccompaniment, guideEvents, INSTRUMENT_RANGES, STYLES } from '../../docs/js/core/accomp.js';
import { parseChord, pc } from '../../docs/js/core/music.js';

test('knihovna má aspoň 20 písní ve 4 úrovních', () => {
  assert.ok(SONGS.length >= 20);
  for (const l of [1, 2, 3, 4]) assert.ok(SONGS.filter((s) => s.level === l).length >= 5, 'úroveň ' + l);
  const ids = new Set(SONGS.map((s) => s.id));
  assert.equal(ids.size, SONGS.length, 'unikátní id');
});

for (const s of SONGS) {
  test(`píseň „${s.title}“`, () => {
    assert.deepEqual(s.errors, [], 'chyby kompilace (takty/slabiky)');
    assert.deepEqual(validateSong(s), [], 'validace formátu');
    // povinná metadata
    assert.ok(s.title && s.tempo && s.meter && s.key && s.practices.length && s.level, 'metadata');
    assert.ok(s.sections.some((x) => x.type === 'intro'), 'předehra');
    assert.ok(s.sections.some((x) => x.type === 'outro'), 'dohra');
    assert.ok(s.sections.some((x) => x.type === 'verse'), 'sloka');
    // každá nota (kromě melismatu) má slabiku
    for (const n of s.notes) if (!n.melisma) assert.ok(n.syl && n.syl.trim(), `nota v ${n.t} bez slabiky`);
    assert.ok(s.lyrics.length >= 2 && s.phrases.length === s.lyrics.length, 'řádky textu = fráze');
    // rozsah dle úrovně
    const { lo, hi } = songRange(s);
    const span = hi - lo;
    const distinct = new Set(s.notes.map((n) => n.p)).size;
    if (s.level === 1) {
      assert.ok(distinct >= 3 && distinct <= 5, `úroveň 1: ${distinct} různých tónů`);
      assert.ok(span <= 7, 'úroveň 1: rozsah ' + span);
      const v = s.sections.find((x) => x.type === 'verse');
      const melodyBars = (v.end - v.start) / s.meter[0];
      assert.ok(melodyBars >= 4 && melodyBars <= 8.01, 'úroveň 1: taktů ' + melodyBars);
      assert.ok(s.tempo <= 100, 'úroveň 1: pomalé tempo');
      for (let i = 1; i < s.notes.length; i++) if (s.notes[i].phrase === s.notes[i - 1].phrase) assert.ok(Math.abs(s.notes[i].p - s.notes[i - 1].p) <= 4, 'úroveň 1: krokově/malé skoky');
    }
    if (s.level === 2) assert.ok(span <= 9 && span >= 5, 'úroveň 2: rozsah do sexty, je ' + span);
    if (s.level === 3) assert.ok(span <= 12 && span >= 10, 'úroveň 3: rozsah oktávy, je ' + span);
    if (s.level === 4) {
      assert.ok(span >= 13 && span <= 16, 'úroveň 4: přes oktávu, je ' + span);
      assert.ok(s.sections.some((x) => x.type === 'chorus'), 'úroveň 4: refrén');
      const syncopated = s.notes.some((n) => (n.t % 1) > 0.25 && n.d >= 1);
      assert.ok(syncopated, 'úroveň 4: synkopy');
    }
    // akordy na těžkých dobách
    assert.deepEqual(checkHarmony(s), [], 'disonance na těžkých dobách');
    // konec na tónice: poslední akord i poslední nota
    const tonicPc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[s.key.tonic[0]] + (s.key.tonic[1] === 'b' ? -1 : s.key.tonic[1] === '#' ? 1 : 0);
    const lastChord = parseChord(s.chords.at(-1).sym);
    assert.equal(lastChord.root, (tonicPc + 12) % 12, 'poslední akord = tónika');
    assert.equal(pc(s.notes.at(-1).p), (tonicPc + 12) % 12, 'poslední nota = tónika');
    // předehra začíná na tónice nebo dominantě (nastaví tóninu)
    const firstChord = parseChord(s.chords[0].sym);
    assert.ok([tonicPc % 12, (tonicPc + 7) % 12, (tonicPc + 5) % 12].includes(firstChord.root), 'předehra v tónině');
  });
}

test('doprovod se vygeneruje bez chyb pro všechny písně, styly a transpozice', () => {
  for (const s0 of SONGS) {
    for (const shift of [-12, -7, 0, 5]) {
      const s = transposeSong(s0, shift);
      for (const style of Object.keys(STYLES)) {
        for (const drums of [false, true]) {
          const ev = generateAccompaniment(s, { style, bass: true, drums });
          for (const e of ev) {
            assert.ok(Number.isFinite(e.t) && Number.isFinite(e.d) && e.d > 0, `${s.id} ${style}: neplatná událost`);
            assert.ok(e.t >= 0 && e.t <= s.length + 0.1, `${s.id}: událost mimo píseň ${e.t}`);
            const r = INSTRUMENT_RANGES[e.inst];
            assert.ok(r && e.midi >= r[0] && e.midi <= r[1], `${s.id} ${style}: ${e.inst} ${e.midi} mimo rozsah`);
          }
          if (style !== 'none') assert.ok(ev.length > 10, `${s.id} ${style}: málo událostí`);
          // akordové tóny doprovodu patří do akordu
          for (const e of ev.filter((x) => x.inst === 'piano' || x.inst === 'guitar')) {
            const c = s.chords.filter((c) => c.t <= e.t + 1e-6).at(-1);
            if (!c) continue;
            const ch = parseChord(c.sym);
            assert.ok(ch.pcs.includes(pc(e.midi)) || ch.bass === pc(e.midi), `${s.id} ${style}: tón ${e.midi} mimo akord ${c.sym} v ${e.t}`);
          }
        }
      }
      assert.equal(guideEvents(s).length, s.notes.length);
    }
  }
});

test('parser: slabiky, melisma, spojená slova, kontrola taktu', () => {
  const syl = splitSyllables('Spin-kej k~nám / dál');
  assert.deepEqual(syl.map((x) => x.syl), ['Spin-', 'kej', 'k nám', 'dál']);
  assert.equal(syl[3].line, 1);
  const bad = parseMelody('C4/1 D E | F/2', 4);
  assert.ok(bad.errors.length === 1);
  const s = compileSong({ id: 't', title: 'T', tempo: 90, meter: '4/4', sections: [{ type: 'verse', melody: 'C4/1 D E F', lyrics: 'a b c', chords: 'C' }] });
  assert.ok(s.errors.some((e) => e.includes('chybí slabika')));
});
