// Každá obrazovka na screenshotu v rozlišení telefonu: nic se nepřekrývá, diakritika, žádné chyby v konzoli.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launch, newPage, sleep } from './helpers.mjs';

const OUT = new URL('../../test-output/screens/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const ROUTES = ['/', '/welcome', '/course', '/course/c1', '/course/c6', '/lesson/c1l1', '/lesson/c2l1', '/lesson/c10l1', '/songs', '/song/tri-tony', '/song/cesta-domu', '/editor', '/tuner', '/me', '/voice', '/voicetest', '/progress', '/recordings', '/audio', '/calibrate', '/settings', '/backup', '/diag', '/about', '/tools', '/tools/metronome', '/tools/drone', '/tools/piano', '/tools/scales', '/ear', '/plan/5', '/plan/20'];

let env;
before(async () => { env = await launch({ port: 8141 }); });
after(async () => { await env?.close(); });

async function check(page, name, vw = 390) {
  await sleep(500);
  const r = await page.evaluate((vw) => {
    const doc = document.documentElement;
    const nav = document.querySelector('.nav');
    const navTop = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight;
    // tlačítka dole nesmí zajíždět pod lištu (po doskrolování na konec)
    window.scrollTo(0, doc.scrollHeight);
    const ba = document.querySelector('.bottom-actions');
    const baRect = ba ? ba.getBoundingClientRect() : null;
    const overflowX = doc.scrollWidth > vw + 1;
    // prvky, které přesahují šířku obrazovky
    const wide = [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > vw + 1 || b.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('.chips'); }).slice(0, 3).map((e) => e.className || e.tagName);
    const fontsOk = document.fonts.check('700 16px Nunito', 'ěščřžýáíéůúťďň ĚŠČŘŽÝÁÍÉŮÚŤĎŇ');
    window.scrollTo(0, 0);
    return { overflowX, wide, fontsOk, baBottom: baRect ? baRect.bottom : null, navTop, text: document.body.innerText.length };
  }, vw);
  assert.ok(!r.overflowX, `${name}: vodorovné přetečení ${JSON.stringify(r.wide)}`);
  assert.ok(r.fontsOk, `${name}: písmo s diakritikou není načtené`);
  if (r.baBottom != null) assert.ok(r.baBottom <= r.navTop + 1, `${name}: tlačítko zajíždí pod lištu (${r.baBottom} > ${r.navTop})`);
  assert.ok(r.text > 20, `${name}: prázdná obrazovka`);
}

for (const vp of [{ width: 390, height: 844, tag: '390' }, { width: 412, height: 915, tag: '412' }]) {
  test(`všechny obrazovky ${vp.width}×${vp.height}`, async () => {
    const page = await newPage(env, '/');
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.evaluate(() => window.zpTest.saveSettings({ onboarded: true }));
    for (const r of ROUTES) {
      const before = env.errors.length;
      await page.evaluate((r) => { location.hash = '#' + r; }, r);
      await check(page, r, vp.width);
      await page.screenshot({ path: `${OUT}${vp.tag}${r.replace(/\//g, '_') || '_home'}.png` });
      assert.deepEqual(env.errors.slice(before), [], `${r}: chyby v konzoli`);
    }
    // přehrávač, cvičení a listy (sheets)
    await page.evaluate(() => { location.hash = '#/play/kukacka?shift=-7&f=1&mode=guided&loop=all'; });
    await check(page, 'přehrávač', vp.width); await page.screenshot({ path: `${OUT}${vp.tag}_play.png` });
    await page.getByRole('button', { name: 'Mixážní pult' }).click(); await sleep(300);
    await page.screenshot({ path: `${OUT}${vp.tag}_mix.png` });
    await page.evaluate(() => { location.hash = '#/lesson/c8l1'; }); await sleep(300);
    await page.getByText('Začít cvičení').click(); await check(page, 'cvičení', vp.width);
    await page.screenshot({ path: `${OUT}${vp.tag}_exercise.png` });
    await page.evaluate(() => { location.hash = '#/course'; }); await sleep(200);
    await page.evaluate(() => { location.hash = '#/lesson/c10l1'; }); await sleep(300);
    await page.getByText('Začít cvičení').click(); await sleep(500);
    await page.screenshot({ path: `${OUT}${vp.tag}_ear.png` });
    await page.evaluate(() => { location.hash = '#/song/vecerni'; }); await sleep(300);
    await page.getByText('Text a akordy').click(); await sleep(300);
    await page.screenshot({ path: `${OUT}${vp.tag}_lyrics.png` });
    assert.deepEqual(env.errors, [], 'chyby v konzoli');
    await page.close();
  });
}
