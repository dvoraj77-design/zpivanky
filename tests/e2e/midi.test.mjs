// Import MIDI / karaoke v prohlížeči: jeden soubor (výběr stopy, nástroje, text z MIDI) → přehrání s aranžmá z MIDI;
// hromadný import více souborů → knihovna „Moje“ podle stylu; nová knihovna písní s kategoriemi.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { launch, newPage, sleep } from './helpers.mjs';
import { karaokeSong } from '../fixtures/midiwriter.mjs';

const OUT = new URL('../../test-output/midi', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + '/hvezdicka.kar', karaokeSong());
copyFileSync(new URL('../fixtures/midi/skakal_pes_cc0.midi', import.meta.url), OUT + '/skakal_pes.midi');

let env;
before(async () => { env = await launch({ port: 8193 }); });
after(async () => { await env.close(); });
const prep = (page) => page.evaluate(() => window.zpTest.saveSettings({ onboarded: true, hpProfiles: [{ id: 'test', name: 'Test', type: 'wired', latencyMs: 0, calibrated: true }], activeHp: 'test', headphones: 'yes', songTempo: 1 }));

test('import karaoke souboru: melodie, text z MIDI, nástroje doprovodu, přehrání s původním aranžmá', async () => {
  const page = await newPage(env, '/songs');
  await prep(page);
  await page.getByTestId('song-add').click();
  await page.getByText('Z MIDI nebo karaoke').click();
  await page.getByTestId('midi-file').setInputFiles(OUT + '/hvezdicka.kar');
  await page.getByTestId('midi-title').waitFor();
  assert.equal(await page.getByTestId('midi-tempo').inputValue(), '96');
  const parts = await page.getByTestId('midi-parts').innerText();
  assert.match(parts, /🎤 Melody/, 'odhad melodie');
  await page.getByTestId('midi-title').fill('Hvězdička z MIDI');
  await page.screenshot({ path: OUT + '/setup.png', fullPage: true });
  await page.getByTestId('midi-create').click();
  await page.getByTestId('import-done').waitFor({ timeout: 20000 });
  const song = await page.evaluate(() => window.zpTest.state.customSongs.find((s) => s.source === 'midi'));
  assert.equal(song.title, 'Hvězdička z MIDI');
  assert.equal(song.notes.length, 14);
  assert.equal(song.notes[0].syl, 'Hvěz-');
  assert.ok(song.backing.tracks.length === 3);
  assert.equal(await page.getByTestId('acc-select').inputValue(), 'midi');
  await page.screenshot({ path: OUT + '/detail.png', fullPage: true });
  await page.getByRole('button', { name: '▶ Zpívat' }).click();
  await page.getByRole('button', { name: '▶ Začít' }).click();
  await sleep(3000);
  const tr = await page.evaluate(() => { const t = window.zpTest.transport; return { insts: [...new Set(t.events.map((e) => e.inst))], beat: t.currentBeat() }; });
  for (const i of ['piano', 'bass', 'drum']) assert.ok(tr.insts.includes(i), 'nástroj ' + i + ' v ' + tr.insts);
  assert.ok(tr.beat > 2);
  await page.getByRole('button', { name: '■ Hotovo' }).click();
  await page.waitForSelector('.ring', { timeout: 15000 });
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('hromadný import dvou souborů → Moje / Dětské; knihovna má kategorie a hledání', async () => {
  const page = await newPage(env, '/midi');
  await prep(page);
  await page.getByTestId('midi-file').setInputFiles([OUT + '/hvezdicka.kar', OUT + '/skakal_pes.midi']);
  await page.locator('select').first().selectOption('detske');
  await page.getByTestId('batch-go').click();
  await page.getByTestId('batch-done').waitFor({ timeout: 30000 });
  const rows = await page.getByTestId('batch-rows').innerText();
  assert.equal((rows.match(/✓/g) || []).length, 2, rows);
  await page.getByTestId('batch-done').click();
  await sleep(500);
  const list = await page.locator('.list').innerText();
  assert.match(list, /Skákal pes/); assert.match(list, /Dětské/);
  // vestavěná knihovna: koledy a hledání bez diakritiky
  await page.getByRole('button', { name: /^Koledy \d+/ }).click();
  await sleep(200);
  assert.match(await page.locator('.list').innerText(), /Nesem vám noviny/);
  await page.getByRole('button', { name: /^Vše \d+/ }).click();
  await page.getByPlaceholder('🔎 Hledat píseň').fill('ticha noc');
  await sleep(200);
  assert.match(await page.locator('.list').innerText(), /Tichá noc/);
  await page.screenshot({ path: OUT + '/library.png' });
  assert.deepEqual(env.errors, []);
  await page.close();
});
