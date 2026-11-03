// Všechny typy cvičení, test hlasu, kalibrace, režimy písní, editor, záloha a archiv – v prohlížeči se simulovaným zpěvákem.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launch, newPage, sleep } from './helpers.mjs';
import { writeSinger, rhythmSinger, dynamicsSinger, hissWav, writeWav, render, HARM } from '../fixtures/gen-audio.mjs';
import { buildExercise, planTargets } from '../../docs/js/core/exercises.js';
import { defaultProfile } from '../../docs/js/core/voice.js';
import { lessonById } from '../../docs/js/data/course.js';

const OUT = new URL('../../test-output/audio2', import.meta.url).pathname;
process.env.ZP_EXTRA_ROOT = OUT;
mkdirSync(OUT, { recursive: true });
const P = defaultProfile();

const LESSONS = {
  hold: 'c4l1', match: 'c3l2', scale: 'c5l4', arpeggio: 'c6l3', interval: 'c6l2', siren: 'c8l3', callResponse: 'c10l3', rhythm: 'c7l4', dynamics: 'c9l3', free: 'c1l1', falsetto: 'c8l4',
};
for (const [k, id] of Object.entries(LESSONS)) {
  const l = lessonById(id);
  const plan = buildExercise(l.ex, P, { seed: 1 });
  const tg = planTargets(plan);
  if (plan.kind === 'rhythm') writeWav(`${OUT}/${id}.wav`, rhythmSinger(tg));
  else if (plan.kind === 'dynamics') writeWav(`${OUT}/${id}.wav`, dynamicsSinger(tg, plan.curve, plan.range));
  else writeSinger(OUT, id, tg, 'exact');
}
hissWav(`${OUT}/breath12.wav`, 12, { lead: 3.3 });
// test hlasu: mluvení ~110 Hz, klouzání dolů na G2, nahoru na E4, falzet A4
const speak = render(Array.from({ length: 16 }, (_, i) => ({ t: 0.3 + i * 0.5, d: 0.42, midi: 45 + Math.sin(i) * 1.5, harmonics: HARM.bassA, amp: 0.3 })), { dur: 10 });
writeWav(`${OUT}/vt-speak.wav`, speak);
writeWav(`${OUT}/vt-low.wav`, render([{ t: 0.3, d: 2.5, midi: 52, glideTo: 43, harmonics: HARM.bassA }, { t: 2.8, d: 1.8, midi: 43, harmonics: HARM.bassA }], { dur: 6 }));
writeWav(`${OUT}/vt-high.wav`, render([{ t: 0.3, d: 2.5, midi: 52, glideTo: 64, harmonics: HARM.vowelA }, { t: 2.8, d: 1.8, midi: 64, harmonics: HARM.vowelA }], { dur: 6 }));
writeWav(`${OUT}/vt-fals.wav`, render([{ t: 0.3, d: 2.5, midi: 60, glideTo: 69, harmonics: HARM.vowelU }, { t: 2.8, d: 1.8, midi: 69, harmonics: HARM.vowelU }], { dur: 6 }));
hissWav(`${OUT}/vt-breath.wav`, 15, { lead: 0.6 });
hissWav(`${OUT}/vt-control.wav`, 8, { lead: 0.6 });
// kalibrace: kliky v 0.4 + i*spb (i ≥ 4), „pa“ o 150 ms později
{ const spb = 60 / 90; const notes = []; for (let i = 4; i < 12; i++) notes.push({ t: i * spb + 0.15, d: 0.15, midi: 50, harmonics: HARM.vowelA, amp: 0.4 }); writeWav(`${OUT}/calib.wav`, render(notes, { dur: 10 })); }

let env;
before(async () => { env = await launch({ port: 8181 }); });
after(async () => { await env?.close(); });

async function prep(page) {
  await page.evaluate(() => window.zpTest.saveSettings({ onboarded: true, strictness: 'beginner', hpProfiles: [{ id: 'test', name: 'Test', type: 'wired', latencyMs: 0, calibrated: true }], activeHp: 'test', headphones: 'yes' }));
}
async function go(page, h) { await page.evaluate(() => { location.hash = '#/about'; }); await sleep(150); await page.evaluate((h) => { location.hash = '#' + h; }, h); await sleep(400); }

test('všechny typy cvičení s přesným zpěvákem dají dobré hodnocení', async () => {
  const page = await newPage(env, '/');
  await prep(page);
  for (const [k, id] of Object.entries(LESSONS)) {
    await go(page, '/lesson/' + id);
    await page.getByText('Začít cvičení').click();
    await page.evaluate(async (u) => { window.zpTest.lastResult = null; await window.zpTest.loadInput(u); }, `/test-assets/${id}.wav`);
    await page.getByRole('button', { name: '▶ Začít' }).click();
    await page.waitForFunction(() => window.zpTest.lastResult, null, { timeout: 120000 });
    const r = await page.evaluate(() => ({ overall: window.zpTest.lastResult.overall, kind: window.zpTest.lastResult.kind, tip: window.zpTest.lastResult.tip }));
    assert.ok(r.overall >= 70, `${k} (${id}): ${JSON.stringify(r)}`);
    await page.waitForSelector('.ring');
  }
  // dech
  await go(page, '/lesson/c2l2');
  await page.getByText('Začít cvičení').click();
  await page.evaluate(async (u) => { window.zpTest.lastResult = null; await window.zpTest.loadInput(u); }, '/test-assets/breath12.wav');
  await page.getByRole('button', { name: '▶ Začít' }).click();
  await page.waitForFunction(() => window.zpTest.lastResult, null, { timeout: 60000 });
  const b = await page.evaluate(() => window.zpTest.lastResult);
  assert.ok(b.duration > 10.5 && b.overall >= 80, 'dech: ' + JSON.stringify({ d: b.duration, o: b.overall }));
  // sluch: odpovídej správně podle otázky
  await go(page, '/lesson/c10l2');
  await page.getByText('Začít cvičení').click();
  for (let i = 0; i < 9; i++) {
    const semi = await page.evaluate(() => null);
    const btns = page.locator('.col.mt16 .btn');
    await btns.first().click();
    await page.getByRole('button', { name: /Další|Výsledek/ }).click();
  }
  await page.waitForFunction(() => window.zpTest.lastResult && window.zpTest.lastResult.kind === 'ear');
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('test hlasu se simulovaným hlasem → baryton, rozsah G2–E4', async () => {
  const page = await newPage(env, '/');
  await prep(page);
  await go(page, '/voicetest');
  await page.getByRole('button', { name: 'Začít test' }).click();
  for (const w of ['vt-speak', 'vt-low', 'vt-high', 'vt-fals', 'vt-breath', 'vt-control']) {
    await page.evaluate(async (u) => window.zpTest.loadInput(u), `/test-assets/${w}.wav`);
    await page.getByRole('button', { name: '🎙️ Start' }).click();
    await sleep(w === 'vt-speak' ? 9000 : w === 'vt-breath' ? 16500 : w === 'vt-control' ? 9500 : 5500);
    await page.getByRole('button', { name: '■ Hotovo' }).click();
    await sleep(300);
    await page.getByRole('button', { name: /Další|Výsledek/ }).click();
    await sleep(300);
  }
  await page.waitForSelector('text=Výsledek testu');
  const p = await page.evaluate(() => window.zpTest.state.profile);
  assert.equal(p.low, 43, 'nejnižší');
  assert.equal(p.highChest, 64, 'nejvyšší hrudní');
  assert.equal(p.highAll, 69, 'falzet');
  assert.ok(Math.abs(p.speakingHz - 110) < 8, 'mluvená ' + p.speakingHz);
  assert.ok(p.breathHold > 13 && p.breathHold < 16.5, 'dech ' + p.breathHold);
  assert.ok(p.breathControl >= 60, 'řízení ' + p.breathControl);
  assert.equal(p.type, 'baritone');
  assert.ok(p.measured);
  await page.screenshot({ path: OUT + '/../voicetest-result.png', fullPage: true });
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('kalibrace zpoždění: „pa“ 150 ms po kliku → ~150 ms', async () => {
  const page = await newPage(env, '/');
  await prep(page);
  await go(page, '/calibrate');
  await page.evaluate(async () => window.zpTest.loadInput('/test-assets/calib.wav'));
  await page.getByRole('button', { name: '▶ Spustit' }).click();
  await page.waitForSelector('text=Naměřené zpoždění', { timeout: 20000 });
  const ms = parseInt(await page.locator('[data-test=latency]').innerText(), 10);
  assert.ok(Math.abs(ms - 150) <= 30, 'zpoždění ' + ms);
  await page.getByRole('button', { name: 'Uložit' }).click();
  const lat = await page.evaluate(() => window.zpTest.state.settings.hpProfiles.find((h) => h.id === 'test').latencyMs);
  assert.equal(lat, ms);
  await page.close();
});

test('režimy písně se spustí bez chyb (poslech, čekej na mě, poslechni→zazpívej, smyčka fráze)', async () => {
  const page = await newPage(env, '/');
  await prep(page);
  for (const q of ['mode=listen&loop=all', 'mode=wait&loop=all', 'mode=alternate&loop=all', 'mode=guided&loop=p1', 'mode=solo&loop=s1&f=0.6']) {
    await go(page, `/play/ukolebavka?shift=-10&f=1&${q}`);
    await page.getByRole('button', { name: '▶ Začít' }).click();
    await sleep(3500);
    const st = await page.evaluate(() => document.querySelector('.player') != null);
    assert.ok(st, q);
    await page.getByRole('button', { name: '■ Hotovo' }).click();
    await page.waitForSelector('.ring', { timeout: 10000 });
  }
  // karaoke pohled
  await go(page, '/play/ukolebavka?shift=-10&f=1&mode=guided&loop=all');
  await page.getByRole('button', { name: 'Přepnout zobrazení' }).click();
  await page.getByRole('button', { name: '▶ Začít' }).click();
  await sleep(4000);
  await page.screenshot({ path: OUT + '/../karaoke.png' });
  await page.getByRole('button', { name: '■ Hotovo' }).click();
  await page.waitForSelector('.ring');
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('vlastní píseň: editor → uložit → knihovna → přehrát', async () => {
  const page = await newPage(env, '/');
  await prep(page);
  await go(page, '/editor');
  await page.locator('input[type=text]').first().fill('Moje testovací');
  await page.getByRole('button', { name: '✨ Navrhnout akordy' }).click();
  await page.getByRole('button', { name: '💾 Uložit' }).click();
  await page.waitForSelector('text=Moje testovací');
  const custom = await page.evaluate(() => window.zpTest.state.customSongs.map((s) => ({ id: s.id, n: s.notes.length, c: s.chords.length })));
  assert.equal(custom.length, 1);
  assert.ok(custom[0].n >= 10 && custom[0].c >= 3);
  await page.getByRole('button', { name: '▶ Zpívat' }).click();
  await page.getByRole('button', { name: '▶ Začít' }).click();
  await sleep(2500);
  await page.getByRole('button', { name: '■ Hotovo' }).click();
  await page.waitForSelector('.ring');
  await go(page, '/songs');
  await page.getByRole('button', { name: 'Moje' }).click();
  await page.waitForSelector('text=Moje testovací');
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('archiv nahrávek; záloha (s nahrávkami) → smazání → obnova', async () => {
  const page = await newPage(env, '/');
  await prep(page);
  // jedno krátké cvičení, ať je v archivu aspoň jedna nahrávka
  for (let k = 0; k < 2; k++) {
    await go(page, '/lesson/c4l1');
    await page.getByText('Začít cvičení').click();
    await page.evaluate(async (u) => { window.zpTest.lastResult = null; await window.zpTest.loadInput(u); }, '/test-assets/c4l1.wav');
    await page.getByRole('button', { name: '▶ Začít' }).click();
    await page.waitForFunction(() => window.zpTest.lastResult, null, { timeout: 60000 });
    await page.waitForSelector('.ring');
  }
  await go(page, '/recordings');
  const n = await page.locator('.list .item').count();
  assert.ok(n >= 2, 'nahrávek ' + n);
  await page.locator('[aria-label="Vybrat pro porovnání"]').nth(0).click();
  await page.locator('[aria-label="Vybrat pro porovnání"]').nth(1).click();
  await page.waitForSelector('text=Porovnání');
  await page.getByRole('button', { name: '▶ S cílem' }).first().click();
  await sleep(800);
  await page.screenshot({ path: OUT + '/../recordings.png', fullPage: true });
  await page.locator('[aria-label="Uložit WAV"]').first().click();
  const [dbg] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Balíček pro ladění/ }).click()]);
  const dp = OUT + '/debug.json';
  await dbg.saveAs(dp);
  const dj = JSON.parse(readFileSync(dp, 'utf8'));
  assert.equal(dj.format, 'zpivanky-debug');
  assert.ok(dj.recording.pcmB64.length > 10000 && dj.recording.frames.length > 100 && dj.recording.opts.items.length > 3, 'balíček pro ladění');
  await page.locator('[aria-label="Uložit WAV"]').first().click();
  const [wav] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Hlas s doprovodem/ }).click()]);
  const wp = OUT + '/export.wav';
  await wav.saveAs(wp);
  const head = readFileSync(wp).subarray(0, 12).toString('latin1');
  assert.ok(head.startsWith('RIFF') && head.includes('WAVE'), 'WAV export');
  assert.ok(readFileSync(wp).length > 50000, 'WAV má obsah');
  // záloha
  const before = await page.evaluate(async () => { const { db } = await import('./js/store/db.js'); return { songs: window.zpTest.state.customSongs.length, lessons: Object.keys(window.zpTest.state.progress.lessons).length, recs: (await db.listRecordings()).length }; });
  await go(page, '/backup');
  await page.getByText('Včetně nahrávek').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '💾 Vytvořit zálohu' }).click()]);
  const path = OUT + '/backup.json';
  await dl.saveAs(path);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(data.format, 'zpivanky-backup');
  assert.equal(data.recordings.length, before.recs);
  await page.evaluate(async () => { const { db } = await import('./js/store/db.js'); await db.clearAll(); });
  page.on('dialog', (d) => d.accept());
  await page.locator('input[type=file]').setInputFiles(path);
  await page.waitForSelector('text=Obnoveno', { timeout: 15000 });
  const after = await page.evaluate(async () => { const { db } = await import('./js/store/db.js'); return { songs: window.zpTest.state.customSongs.length, lessons: Object.keys(window.zpTest.state.progress.lessons).length, recs: (await db.listRecordings()).length }; });
  assert.deepEqual(after, before);
  assert.deepEqual(env.errors, []);
  await page.close();
});
