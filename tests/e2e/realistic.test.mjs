// Realistický zpěvák v prohlížeči na zpomaleném procesoru (simulace slabšího telefonu).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launch, newPage, sleep } from './helpers.mjs';
import { writeWav } from '../fixtures/gen-audio.mjs';
import { realSinger, notesFromTargets } from '../fixtures/realistic.mjs';
import { buildExercise, planTargets } from '../../docs/js/core/exercises.js';
import { defaultProfile, recommendShifts } from '../../docs/js/core/voice.js';
import { lessonById } from '../../docs/js/data/course.js';
import { songById } from '../../docs/js/data/songs.js';
import { transposeSong } from '../../docs/js/core/song.js';

const OUT = new URL('../../test-output/audio3', import.meta.url).pathname;
process.env.ZP_EXTRA_ROOT = OUT;
mkdirSync(OUT, { recursive: true });
const P = defaultProfile();
const exT = planTargets(buildExercise(lessonById('c5l4').ex, P, { seed: 1 }));
writeWav(OUT + '/ex.wav', realSinger(notesFromTargets(exT), { bgNoiseDb: -40, gainDb: -6 }));
const s0 = songById('hvezdicka');
const shift = recommendShifts(s0.notes, P)[0].shift;
const song = transposeSong(s0, shift);
const spb = 60 / song.tempo;
writeWav(OUT + '/song.wav', realSinger(notesFromTargets(song.notes.map((n) => ({ start: (n.t + 4) * spb, end: (n.t + n.d + 4) * spb, midi: n.p }))), { bgNoiseDb: -40, vibCents: 40 }));

let env;
before(async () => { env = await launch({ port: 8211 }); });
after(async () => { await env?.close(); });

test('realistický zpěvák + 4× pomalejší procesor: cvičení i píseň dobře hodnocené, plynulé zobrazení', async () => {
  const page = await newPage(env, '/');
  await page.evaluate(() => window.zpTest.saveSettings({ onboarded: true, strictness: 'beginner', hpProfiles: [{ id: 'test', name: 'Test', type: 'wired', latencyMs: 0 }], activeHp: 'test', headphones: 'yes', exTempo: 1, songTempo: 1 }));
  const cdp = await env.ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const runAndMeasure = async (hash, wav, clickLesson) => {
    await page.evaluate(() => { location.hash = '#/about'; }); await sleep(200);
    await page.evaluate((h) => { location.hash = h; }, hash); await sleep(600);
    if (clickLesson) await page.getByText('Začít cvičení').click();
    await page.evaluate(async (u) => { window.zpTest.lastResult = null; await window.zpTest.loadInput(u); }, '/test-assets/' + wav);
    await page.getByRole('button', { name: '▶ Začít' }).click();
    // plynulost: snímky animace za 3 s
    const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); }; requestAnimationFrame(f); }));
    const det = await page.evaluate(() => window.zpTest.engine.stats.fps);
    await page.waitForFunction(() => window.zpTest.lastResult, null, { timeout: 120000 });
    const r = await page.evaluate(() => ({ overall: window.zpTest.lastResult.overall, missed: window.zpTest.lastResult.notes.filter((n) => n.status === 'missed').length, n: window.zpTest.lastResult.notes.length }));
    return { ...r, fps, det };
  };
  const ex = await runAndMeasure('#/lesson/c5l4', 'ex.wav', true);
  assert.ok(ex.overall >= 80, 'cvičení ' + JSON.stringify(ex));
  assert.ok(ex.fps >= 25, 'animace ' + ex.fps + ' snímků/s');
  assert.ok(ex.det >= 80, 'detektor ' + ex.det + ' snímků/s');
  const so = await runAndMeasure(`#/play/hvezdicka?shift=${shift}&f=1&mode=perform&loop=all`, 'song.wav', false);
  assert.ok(so.overall >= 80, 'píseň ' + JSON.stringify(so));
  assert.ok(so.missed <= 2, 'chybějící tóny ' + so.missed);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  assert.deepEqual(env.errors, []);
  console.log('výsledky', JSON.stringify({ ex, so }));
  await page.close();
});
