// Import MIDI / KAR: čtení souboru, rozbor stop, výběr melodie, text (karaoke, cp1250), doprovod, akordy, sestavení písně.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMidi, analyzeMidi, buildMidiSong, melodyNotes, lyricSyllables, backingEvents, drumNote, gmInfo } from '../../docs/js/core/midi.js';
import { validateSong, transposeSong } from '../../docs/js/core/song.js';
import { writeMidi, karaokeSong } from '../fixtures/midiwriter.mjs';

test('karaoke soubor: tempo, takt, melodie ve 3. stopě, český text v cp1250, doprovod a akordy', () => {
  const an = analyzeMidi(parseMidi(karaokeSong()), { fileName: 'hvezdicka.kar' });
  assert.equal(an.tempo, 96); assert.equal(an.bpb, 4);
  const mel = an.parts.find((p) => p.id === an.melodyId);
  assert.equal(mel.trackName, 'Melody', 'melodie podle textu a jednohlasu');
  assert.ok(mel.lyricFit > 0.9);
  assert.equal(an.parts.find((p) => p.drums).role, 'drums');
  assert.equal(an.parts.find((p) => p.trackName === 'Bass').role, 'bass');
  const song = buildMidiSong(an, { style: 'detske' });
  assert.deepEqual(validateSong(song), []);
  assert.equal(song.notes.length, 14);
  assert.deepEqual(song.notes.slice(0, 7).map((n) => n.syl), ['Hvěz-', 'dič-', 'ko,', 'ty', 'ma-', 'lič-', 'ká,']);
  assert.equal(song.lyrics.length, 2, 'dva řádky = dvě fráze');
  assert.equal(song.lyrics[1].text, 'kdo tě na nebe dal?');
  assert.equal(song.style, 'detske');
  // doprovod: klavír, basa, bicí – bicí bez transpozice
  const ev = backingEvents(song, 3);
  assert.ok(ev.some((e) => e.inst === 'piano') && ev.some((e) => e.inst === 'bass' && e.role === 'bass') && ev.some((e) => e.inst === 'drum' && e.role === 'drums'));
  assert.ok(ev.filter((e) => e.inst === 'drum').every((e) => [36, 38, 42].includes(e.midi)));
  // akordy z doprovodu: C … F … C … G … C
  const syms = song.chords.map((c) => c.sym);
  assert.ok(syms.includes('F') && syms.includes('G') && syms.at(-1) === 'C', syms.join(' '));
  assert.ok(transposeSong(song, -2).notes.length === 14);
});

test('MIDI z LilyPondu (CC0): slabiky bez mezer jsou samostatná slova, fráze podle pauz', () => {
  const an = analyzeMidi(parseMidi(readFileSync(new URL('../fixtures/midi/skakal_pes_cc0.midi', import.meta.url))), { fileName: 'skakal_pes.midi' });
  assert.equal(an.title, 'Skákal pes');
  const s = buildMidiSong(an, {});
  assert.deepEqual(validateSong(s), []);
  assert.equal(s.notes.length, 24);
  assert.equal(s.notes[0].syl, 'Ská');
  assert.ok(s.phrases.length >= 2);
  assert.ok(s.chords.length >= 4, 'akordy z harmonizace melodie');
});

test('melodie ze stopy s akordy: nejvyšší hlas bez překryvů; vlastní text místo MIDI', () => {
  const notes = [];
  for (let i = 0; i < 8; i++) for (const p of [60 + i, 64 + i, 67 + i]) notes.push({ t: i, d: 1.2, p });
  const an = analyzeMidi(parseMidi(writeMidi({ tracks: [{ name: 'Piano', ch: 0, program: 0, notes }] })));
  const m = melodyNotes(an.parts[0], an.beatTicks);
  assert.deepEqual(m.map((n) => n.pitch), [67, 68, 69, 70, 71, 72, 73, 74]);
  assert.ok(m.every((n, i) => !m[i + 1] || n.tick + n.dur <= m[i + 1].tick));
  const s = buildMidiSong(an, { lyricsLines: ['Ra-ní ptá-če dál do-sko-čí'] });
  assert.deepEqual(validateSong(s), []);
  assert.equal(s.notes[0].syl, 'Ra-');
});

test('text karaoke: lomítka = řádky, zpětné lomítko = odstavec, mezera = nové slovo; nástroje GM', () => {
  const syl = lyricSyllables([{ tick: 0, text: '\\Dob' }, { tick: 10, text: 'ré' }, { tick: 20, text: ' rá' }, { tick: 30, text: 'no' }, { tick: 40, text: '/Jak' }, { tick: 50, text: ' se' }, { tick: 60, text: ' máš' }]);
  assert.deepEqual(syl.map((s) => s.text + (s.cont ? '-' : '')), ['Dob-', 'ré', 'rá-', 'no', 'Jak', 'se', 'máš']);
  assert.ok(syl[0].newPara && syl[4].newLine && !syl[5].newLine);
  assert.equal(drumNote(35), 36); assert.equal(drumNote(40), 38); assert.equal(drumNote(49), 49);
  assert.equal(gmInfo(33).inst, 'bass'); assert.equal(gmInfo(73).inst, 'flute'); assert.equal(gmInfo(24).inst, 'nylon'); assert.equal(gmInfo(48).inst, 'violin');
});

test('poškozený nebo jiný soubor dá srozumitelnou chybu', () => {
  assert.throws(() => parseMidi(Buffer.from('ID3 tohle je mp3')), /není MIDI/);
});
