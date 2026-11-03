// Simulovaný zpěvák jako mikrofon: ladička, cvičení a píseň ukážou očekávané hodnocení.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launch, newPage, sleep } from './helpers.mjs';
import { writeSinger, steadyTone } from '../fixtures/gen-audio.mjs';
import { buildExercise, planTargets } from '../../docs/js/core/exercises.js';
import { defaultProfile, recommendShifts } from '../../docs/js/core/voice.js';
import { lessonById } from '../../docs/js/data/course.js';
import { songById } from '../../docs/js/data/songs.js';
import { transposeSong } from '../../docs/js/core/song.js';

const OUT = new URL('../../test-output/audio', import.meta.url).pathname;
process.env.ZP_EXTRA_ROOT = OUT;
mkdirSync(OUT, { recursive: true });

// cíle cvičení c5l2 (1-2-3-2-1) pro výchozí profil
const lesson = lessonById('c5l2');
const plan = buildExercise(lesson.ex, defaultProfile(), { seed: 1 });
const exTargets = planTargets(plan);
// píseň Tři tóny v doporučené tónině
const song0 = songById('tri-tony');
const shift = recommendShifts(song0.notes, defaultProfile())[0].shift;
const song = transposeSong(song0, shift);
const spb = 60 / song.tempo;
const songTargets = song.notes.map((n) => ({ start: (n.t + song.meter[0]) * spb, end: (n.t + n.d + song.meter[0]) * spb, midi: n.p }));
for (const v of ['exact', 'flat30', 'octaveDown', 'late', 'silence', 'noise']) writeSinger(OUT, 'ex-' + v, exTargets, v);
for (const v of ['exact', 'flat30']) writeSinger(OUT, 'song-' + v, songTargets, v);
steadyTone(OUT + '/tuner-a3.wav', 57.0 + 0.12, 20); // A3 + 12 centů

let env;
before(async () => { env = await launch({ port: 8121, fakeWav: OUT + '/tuner-a3.wav' }); });
after(async () => { await env?.close(); });

async function prep(page, strictness = 'beginner') {
  await page.evaluate(async (strictness) => {
    const z = window.zpTest;
    await z.saveSettings({ onboarded: true, strictness, saveRecordings: true, hpProfiles: [{ id: 'test', name: 'Test (bez zpoždění)', type: 'wired', latencyMs: 0, calibrated: true }], activeHp: 'test', headphones: 'yes' });
  }, strictness);
}

async function runExercise(page, wav, strictness) {
  await page.evaluate(() => { location.hash = '#/course'; });
  await sleep(200);
  await page.evaluate(() => { location.hash = '#/lesson/c5l2'; });
  await prep(page, strictness);
  await page.getByText('Začít cvičení').click();
  await page.evaluate(async (u) => { window.zpTest.lastResult = null; await window.zpTest.loadInput(u); }, '/test-assets/' + wav);
  await page.getByRole('button', { name: '▶ Začít' }).click();
  await page.waitForFunction(() => window.zpTest.lastResult, null, { timeout: 60000 });
  const r = await page.evaluate(() => { const r = window.zpTest.lastResult; return { overall: r.overall, pitch: r.pitch, rhythm: r.rhythm, tip: r.tip, stars: r.stars, statuses: r.notes.map((n) => n.status), devs: r.notes.map((n) => n.medDev), delays: r.notes.map((n) => n.onsetDelay) }; });
  await page.waitForSelector('.ring .num');
  return r;
}

test('ladička: falešný mikrofon A3 +12 c → nota A, oktáva 3, ručička do 2 s', async () => {
  const page = await newPage(env, '/');
  await prep(page);
  const t0 = Date.now();
  await page.evaluate(() => { location.hash = '#/tuner'; });
  await page.waitForFunction(() => document.querySelector('.tuner-note .n')?.textContent === 'A', null, { timeout: 4000 });
  const ready = Date.now() - t0;
  await sleep(1200);
  const txt = await page.evaluate(() => ({ n: document.querySelector('.tuner-note .n').textContent, o: document.querySelector('.tuner-note .o')?.textContent, c: document.querySelector('.tuner-note .c').textContent }));
  assert.equal(txt.n, 'A');
  assert.equal(txt.o, '3');
  const cents = parseInt(txt.c.replace('−', '-').replace(/[^\d-]/g, '') || '0', 10);
  assert.ok(txt.c.includes('přesně') || Math.abs(cents - 12) <= 5, 'odchylka ' + txt.c);
  assert.ok(ready < 2500, 'ladička připravená za ' + ready + ' ms');
  await page.screenshot({ path: OUT + '/../tuner-live.png' });
  await page.close();
});

test('cvičení 1-2-3-2-1: přesně / o 30 c níž / o oktávu níž / pozdě / ticho / šum', async (t) => {
  const page = await newPage(env, '/');
  t.after(() => page.close().catch(() => {}));
  await prep(page);
  const exact = await runExercise(page, 'ex-exact.wav', 'advanced');
  assert.ok(exact.overall >= 85, 'přesně: ' + JSON.stringify(exact));
  assert.ok(exact.statuses.every((s) => s === 'ok'));
  await page.screenshot({ path: OUT + '/../result-exact.png', fullPage: true });
  const flat = await runExercise(page, 'ex-flat30.wav', 'advanced');
  assert.ok(flat.statuses.filter((s) => s === 'low').length >= flat.statuses.length * 0.8, 'o 30 c níž: ' + JSON.stringify(flat.statuses));
  assert.ok(flat.devs.every((d) => d < -20 && d > -40), 'odchylky ' + flat.devs.map(Math.round));
  assert.match(flat.tip, /o (2\d|3\d) centů níž/);
  assert.ok(flat.overall < exact.overall - 25, `flat ${flat.overall} vs exact ${exact.overall}`);
  await page.screenshot({ path: OUT + '/../result-flat.png', fullPage: true });
  const oct = await runExercise(page, 'ex-octaveDown.wav', 'advanced');
  assert.ok(oct.overall >= 80, 'o oktávu níž = správně: ' + oct.overall);
  const late = await runExercise(page, 'ex-late.wav', 'advanced');
  const lateDelays = late.delays.filter((d) => d != null);
  assert.ok(lateDelays.length >= 3 && lateDelays.every((d) => d > 0.2 && d < 0.42), 'nástupy ' + lateDelays);
  assert.match(late.tip, /pozdě/);
  assert.ok(late.rhythm != null && late.rhythm < 60, 'rytmus ' + late.rhythm);
  const sil = await runExercise(page, 'ex-silence.wav', 'beginner');
  assert.ok(sil.overall <= 20 && sil.stars === 0, 'ticho: ' + sil.overall);
  assert.match(sil.tip, /neslyšel/);
  const noise = await runExercise(page, 'ex-noise.wav', 'beginner');
  assert.ok(noise.overall <= 25, 'šum: ' + noise.overall);
  await page.close();
});

test('píseň „Tři tóny“ (vystoupení): přesně vs. o 30 c níž', async (t) => {
  const page = await newPage(env, '/');
  t.after(() => page.close().catch(() => {}));
  await prep(page, 'advanced');
  const run = async (wav) => {
    await page.evaluate(() => { location.hash = '#/songs'; });
    await sleep(200);
    await page.evaluate((s) => { location.hash = `#/play/tri-tony?shift=${s}&f=1&mode=perform&loop=all`; }, shift);
    await page.evaluate(async (u) => { window.zpTest.lastResult = null; await window.zpTest.loadInput(u); }, '/test-assets/' + wav);
    await page.getByRole('button', { name: '▶ Začít' }).click();
    await page.waitForFunction(() => window.zpTest.lastResult, null, { timeout: 90000 });
    return page.evaluate(() => { const r = window.zpTest.lastResult; return { overall: r.overall, phrases: r.phrases.map((p) => p.score), tip: r.tip, low: r.notes.filter((n) => n.status === 'low').length, n: r.notes.length }; });
  };
  const ex = await run('song-exact.wav');
  assert.ok(ex.overall >= 85, 'píseň přesně: ' + JSON.stringify(ex));
  assert.equal(ex.phrases.length, 4);
  await page.screenshot({ path: OUT + '/../song-result.png', fullPage: true });
  await page.evaluate(() => { location.hash = '#/songs'; });
  await sleep(300);
  const fl = await run('song-flat30.wav');
  assert.ok(fl.low >= fl.n * 0.8, 'píseň o 30 c níž: ' + JSON.stringify(fl));
  assert.ok(fl.overall < ex.overall - 25);
  // nahrávka uložena do archivu
  const recs = await page.evaluate(async () => (await (await import('./js/store/db.js')).db.listRecordings()).length);
  assert.ok(recs >= 2, 'nahrávky v archivu: ' + recs);
  await page.close();
});
