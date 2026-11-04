// Hry v prohlížeči: nauka (noty na osnově, klaviatura ťukáním), poslech (vyšší/nižší), zpěv (pa-pa-pa a napodob tón se simulovaným zpěvákem).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launch, newPage, sleep } from './helpers.mjs';
import { writeSinger, rhythmSinger, writeWav } from '../fixtures/gen-audio.mjs';
import { buildExercise, planTargets } from '../../docs/js/core/exercises.js';
import { defaultProfile } from '../../docs/js/core/voice.js';
import { gameById } from '../../docs/js/core/games.js';

const OUT = new URL('../../test-output/games', import.meta.url).pathname;
process.env.ZP_EXTRA_ROOT = OUT;
mkdirSync(OUT, { recursive: true });
const P = defaultProfile();
const rhythmPlan = buildExercise(gameById('pa-pa-pa').levels[0].spec, P, { seed: 1 });
writeWav(OUT + '/papapa.wav', rhythmSinger(planTargets(rhythmPlan)));
const matchPlan = buildExercise(gameById('napodob').levels[0].spec, P, { seed: 1 });
writeSinger(OUT, 'napodob', planTargets(matchPlan), 'exact');

let env;
before(async () => { env = await launch({ port: 8187 }); });
after(async () => { await env.close(); });
const prep = (page) => page.evaluate(() => window.zpTest.saveSettings({ onboarded: true, strictness: 'beginner', hpProfiles: [{ id: 'test', name: 'Test', type: 'wired', latencyMs: 0, calibrated: true }], activeHp: 'test', headphones: 'yes', exTempo: 1 }));

async function playQuiz(page, wrongAt = []) {
  for (let i = 0; i < 10; i++) {
    await page.getByTestId('quiz-view').waitFor();
    const q = await page.evaluate(() => ({ answer: window.zpTest.quiz.answer, tap: !!window.zpTest.quiz.view.tap, labels: window.zpTest.quiz.options.map((o) => [String(o.id), o.label]) }));
    if (q.tap) await page.locator(`svg rect[data-key="${wrongAt.includes(i) ? (q.answer + 1) % 12 : q.answer}"]`).first().click();
    else {
      const want = wrongAt.includes(i) ? q.labels.find(([id]) => id !== String(q.answer)) : q.labels.find(([id]) => id === String(q.answer));
      await page.getByTestId('quiz-options').getByRole('button', { name: want[1] }).first().click();
    }
    await page.getByTestId('quiz-next').click();
  }
  await page.getByTestId('quiz-done').waitFor();
}

test('Hry: záložka, nauka „Noty na osnově“ – 10 otázek, hvězdičky, odemčení další úrovně', async () => {
  const page = await newPage(env, '/');
  await prep(page);
  await page.getByRole('link', { name: /Hry/ }).click();
  await page.getByTestId('game-noty').waitFor();
  await page.screenshot({ path: OUT + '/hub.png' });
  await page.getByTestId('game-noty').click();
  await page.getByTestId('level-0').click();
  await page.screenshot({ path: OUT + '/noty.png' });
  await playQuiz(page, [3]);
  const g = await page.evaluate(() => window.zpTest.state.progress.games.noty);
  assert.equal(g.levels[0].best, 90); assert.equal(g.levels[0].stars, 3);
  assert.ok(Object.keys(g.boxes).length >= 3, 'krabičky opakování');
  assert.ok(await page.getByText('Další úroveň →').isVisible());
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('Hry: poslech „Vyšší, nebo nižší?“ a klaviatura ťukáním', async () => {
  const page = await newPage(env, '/play-game/vyssi-nizsi/0');
  await prep(page);
  await playQuiz(page);
  assert.equal(await page.evaluate(() => window.zpTest.lastResult.overall), 100);
  await page.evaluate(() => { window.zpTest.state.progress.games.klavesy = { levels: { 0: { best: 80, stars: 2, plays: 1 } }, boxes: {} }; location.hash = '#/play-game/klavesy/1'; });
  await sleep(300);
  await page.screenshot({ path: OUT + '/klavesy.png' });
  await playQuiz(page, [0, 1]);
  assert.equal(await page.evaluate(() => window.zpTest.lastResult.overall), 80);
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('Hry: zpěv – „Pa-pa-pa“ (přesnost a pravidelnost) a „Napodob tón“ se simulovaným zpěvákem', async () => {
  const page = await newPage(env, '/play-game/pa-pa-pa/0');
  await prep(page);
  await page.evaluate(async () => { window.zpTest.lastResult = null; await window.zpTest.loadInput('/test-assets/papapa.wav'); });
  await page.getByRole('button', { name: '▶ Začít' }).click();
  await page.waitForFunction(() => window.zpTest.lastResult, null, { timeout: 90000 });
  await page.getByTestId('game-result').waitFor();
  const txt = await page.getByTestId('game-result').innerText();
  assert.match(txt, /Pravidelnost/); assert.match(txt, /Přesnost/);
  const pr = await page.evaluate(() => window.zpTest.state.progress.games['pa-pa-pa'].levels[0]);
  assert.ok(pr.best >= 75, 'rytmus ' + pr.best);
  await page.screenshot({ path: OUT + '/papapa-result.png', fullPage: true });
  await page.evaluate(async () => { window.zpTest.lastResult = null; await window.zpTest.loadInput('/test-assets/napodob.wav'); location.hash = '#/play-game/napodob/0'; });
  await sleep(500);
  await page.getByRole('button', { name: '▶ Začít' }).click();
  await page.waitForFunction(() => window.zpTest.lastResult, null, { timeout: 90000 });
  await page.getByTestId('game-result').waitFor();
  const n = await page.evaluate(() => window.zpTest.state.progress.games.napodob.levels[0]);
  assert.ok(n.best >= 80, 'napodob ' + n.best);
  assert.deepEqual(env.errors, []);
  await page.close();
});
