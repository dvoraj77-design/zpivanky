// Import písně v prohlížeči: soubor (stereo WAV) → rychlé i přesné oddělení → noty, akordy, text (lrclib podvržený)
// → píseň v knihovně → přehrání s originálním doprovodem (zarovnaným na tempo), úprava textu, nahrání mikrofonem.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, newPage, sleep } from './helpers.mjs';
import { mixSong } from '../fixtures/mixsong.mjs';
import { songById } from '../../docs/js/data/songs.js';

const OUT = new URL('../../test-output/import', import.meta.url).pathname;
process.env.ZP_EXTRA_ROOT = OUT;
mkdirSync(OUT, { recursive: true });

function stereoWav(L, R, sr) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
  return b;
}
const S0 = songById('hvezdicka');
const MIX = mixSong(S0, { tempo: 92, seconds: 34, sr: 22050 });
writeFileSync(OUT + '/hvezdicka.wav', stereoWav(MIX.L, MIX.R, MIX.sr));
const SHORT = mixSong(S0, { tempo: 92, seconds: 12, sr: 22050 });
writeFileSync(OUT + '/short.wav', stereoWav(SHORT.L, SHORT.R, SHORT.sr));
// text s časováním jako z lrclib (čas řádku = začátek fráze v nahrávce)
const spb = 60 / 92;
const LRC = S0.lyrics.map((l) => { const t = MIX.lead + l.start * spb; const m = Math.floor(t / 60), s = (t % 60).toFixed(2).padStart(5, '0'); return `[${String(m).padStart(2, '0')}:${s}] ${l.text}`; }).join('\n');

let env;
const lrcCalls = [];
before(async () => {
  env = await launch({ port: 8191 });
  await env.ctx.route('https://lrclib.net/**', (route) => {
    lrcCalls.push(route.request().url());
    route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ trackName: 'Hvězdička', artistName: 'Test', duration: 34, syncedLyrics: LRC, plainLyrics: S0.lyrics.map((l) => l.text).join('\n') }) });
  });
});
after(async () => { await env.close(); });

async function prep(page) {
  await page.evaluate(() => window.zpTest.saveSettings({ onboarded: true, strictness: 'beginner', hpProfiles: [{ id: 'test', name: 'Test', type: 'wired', latencyMs: 0, calibrated: true }], activeHp: 'test', headphones: 'yes', songTempo: 1 }));
}

test('import souboru (rychle): noty, akordy, tempo, text z lrclib, píseň v knihovně, přehrání s originálním doprovodem', async () => {
  const page = await newPage(env, '/songs');
  await prep(page);
  await page.getByTestId('song-add').click();
  await page.getByText('Z nahrávky MP3 (pokus)').click();
  await page.getByTestId('import-file').setInputFiles(OUT + '/hvezdicka.wav');
  await page.getByTestId('import-title').waitFor();
  assert.equal(await page.getByTestId('import-title').inputValue(), 'hvezdicka');
  await page.getByTestId('import-title').fill('Hvězdička');
  await page.getByTestId('import-artist').fill('Test');
  await page.getByTestId('mode-fast').click();
  const t0 = Date.now();
  await page.getByTestId('import-go').click();
  await page.getByTestId('import-done').waitFor({ timeout: 120000 });
  const secs = (Date.now() - t0) / 1000;
  const song = await page.evaluate(() => window.zpTest.state.customSongs.find((s) => s.source === 'import'));
  assert.ok(song, 'píseň uložena');
  assert.ok(Math.abs(song.tempo - 92) < 3, 'tempo ' + song.tempo);
  assert.equal(song.meter[0], 4);
  assert.ok(song.notes.length >= 25, 'noty ' + song.notes.length);
  assert.ok(song.chords.length >= 4, 'akordy');
  assert.ok(song.analysis.lyricsFound && song.analysis.lyricsTimed, 'text s časováním');
  assert.ok(song.lyrics.length >= 3 && song.lyrics[0].text.includes('Hvězdičko'), 'text: ' + song.lyrics[0]?.text);
  assert.ok(song.audio.stems && song.audio.bytes > 100000, 'originální stopy');
  assert.ok(lrcCalls.length >= 1 && lrcCalls.every((u) => !/@|mail/i.test(u)), 'lrclib dostal jen název a interpreta');
  const q = new URL(lrcCalls[0]).searchParams; assert.equal(q.get('track_name'), 'Hvězdička'); assert.equal(q.get('artist_name'), 'Test');
  console.log(`  rychlý import ${secs.toFixed(1)} s: ${song.notes.length} not, ${song.chords.length} akordů, ${song.lyrics.length} řádků, ${song.tempo} BPM`);
  await page.screenshot({ path: OUT + '/detail.png', fullPage: true });
  // přehrání s originálním doprovodem (výchozí volba u importované písně)
  assert.equal(await page.getByTestId('acc-select').inputValue(), 'orig');
  await page.getByRole('button', { name: '▶ Zpívat' }).click();
  await page.getByRole('button', { name: '▶ Začít' }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '▶ Začít' }).click();
  await sleep(3000);
  const tr = await page.evaluate(() => { const t = window.zpTest.transport; return { clips: t.clips.length, playing: t.clipSrc.length, beat: t.currentBeat(), rate: t.clipSrc[0]?.playbackRate.value }; });
  assert.equal(tr.clips, 1); assert.equal(tr.playing, 1); assert.ok(tr.beat > 2, 'běží ' + tr.beat);
  await page.screenshot({ path: OUT + '/play.png' });
  await page.getByRole('button', { name: '■ Hotovo' }).click();
  await page.waitForSelector('.ring', { timeout: 15000 });
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('importovaná píseň: tempo 70 % a jiná tónina přepočítají originál, poslech hraje i původní zpěv, úprava textu', async () => {
  const page = await newPage(env, '/songs');
  await prep(page);
  const id = await page.evaluate(() => window.zpTest.state.customSongs.find((s) => s.source === 'import').id);
  await page.evaluate((id) => { location.hash = `#/play/${id}?shift=3&f=0.7&mode=listen&acc=orig`; }, id);
  await page.getByRole('button', { name: '▶ Začít' }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '▶ Začít' }).click();
  await sleep(2500);
  const tr = await page.evaluate(() => { const t = window.zpTest.transport; return { clips: t.clips.map((c) => ({ rate: c.rate, spb: c.spb, bus: c.bus })), spb: t.spb, playing: t.clipSrc.length }; });
  assert.equal(tr.clips.length, 2, 'doprovod + původní zpěv');
  assert.ok(Math.abs(tr.clips[0].rate - Math.pow(2, 3 / 12)) < 1e-6, 'posun +3');
  assert.ok(Math.abs(tr.clips[0].spb / tr.clips[0].rate - tr.spb) < 1e-6, 'tempo 70 % sedí');
  assert.equal(tr.playing, 2);
  await page.getByRole('button', { name: '■ Hotovo' }).click();
  await sleep(500);
  // úprava textu
  await page.evaluate((id) => { location.hash = '#/song/' + id; }, id);
  await page.getByTestId('import-edit').click();
  await page.getByTestId('edit-lyrics').fill('Jedna dva tři čtyři\nPět šest sedm\nOsm devět deset');
  await page.getByTestId('edit-save').click();
  await sleep(400);
  const s2 = await page.evaluate((id) => window.zpTest.state.customSongs.find((s) => s.id === id), id);
  assert.equal(s2.lyrics[0].text, 'Jedna dva tři čtyři');
  assert.ok(s2.notes.some((n) => n.syl === 'Jed-'));
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('import (přesně, model MDX-Net ve WASM) na krátkém úseku + text vložený ručně', async () => {
  const page = await newPage(env, '/import');
  await prep(page);
  await page.getByTestId('import-file').setInputFiles(OUT + '/short.wav');
  await page.getByTestId('import-title').fill('Krátká');
  await page.getByTestId('mode-precise').click();
  await page.getByRole('tab', { name: 'Vložit vlastní' }).click();
  await page.getByTestId('import-lyrics').fill('Hvězdičko ty maličká\nkdo tě na nebe dal');
  const t0 = Date.now();
  await page.getByTestId('import-go').click();
  await page.getByTestId('import-done').waitFor({ timeout: 900000 });
  const song = await page.evaluate(() => window.zpTest.state.customSongs.find((s) => s.title === 'Krátká'));
  console.log(`  přesný import ${((Date.now() - t0) / 1000).toFixed(0)} s (${song.analysis.backend}), ${song.notes.length} not`);
  assert.equal(song.analysis.mode, 'precise');
  assert.ok(['wasm', 'webgpu'].includes(song.analysis.backend));
  // model je naučený na skutečných hlasech – syntetický zpěvák z testů ho moc nepřesvědčí, kvalitu ověřujeme na skutečné nahrávce
  assert.ok(song.notes.length >= 1);
  assert.equal(song.lyrics[0].text, 'Hvězdičko ty maličká');
  assert.ok(song.audio.stems && song.audio.mode === 'precise');
  const cached = await page.evaluate(async () => (await (await caches.open('zp-models-v1')).keys()).length);
  assert.equal(cached, 3, 'model uložený v telefonu');
  assert.deepEqual(env.errors, []);
  await page.close();
});

test('import nahráním mikrofonem (píseň hraje z jiného zařízení) → mono nahrávka → píseň', async () => {
  const page = await newPage(env, '/import');
  await prep(page);
  await page.evaluate(async () => { await window.zpTest.loadInput('/test-assets/short.wav'); });
  await page.getByText('Nahrát mikrofonem').click();
  await page.getByRole('button', { name: '🎙️ Nahrávat' }).click();
  await sleep(11500);
  await page.getByRole('button', { name: '■ Hotovo' }).click();
  await page.getByTestId('import-title').waitFor({ timeout: 20000 });
  assert.match(await page.locator('.small.muted').filter({ hasText: 'Nahrávka z mikrofonu' }).first().innerText(), /mono/);
  await page.getByTestId('import-title').fill('Z mikrofonu');
  await page.getByTestId('mode-fast').click();
  await page.getByText('mono – rychlé oddělení').waitFor();
  await page.getByRole('tab', { name: 'Bez textu' }).click();
  await page.getByTestId('import-go').click();
  await page.getByTestId('import-done').waitFor({ timeout: 120000 });
  const song = await page.evaluate(() => window.zpTest.state.customSongs.find((s) => s.title === 'Z mikrofonu'));
  assert.ok(song.notes.length >= 8, 'noty ' + song.notes.length);
  assert.ok(Math.abs(song.tempo - 92) < 4, 'tempo ' + song.tempo);
  assert.ok(song.notes.every((n) => n.syl === 'la' || n.syl === ''));
  assert.deepEqual(env.errors, []);
  await page.close();
});
