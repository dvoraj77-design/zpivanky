// Offline: po prvním načtení funguje bez internetu; aplikace nikdy nekontaktuje cizí servery.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launch, sleep } from './helpers.mjs';

let env;
before(async () => { env = await launch({ port: 8151 }); });
after(async () => { await env?.close(); });

test('po prvním načtení běží offline a neposílá nic ven', async () => {
  const page = await env.ctx.newPage();
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('pageerror', (e) => env.errors.push(e.message));
  await page.goto(env.base + '?test=1&sw=1#/');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(async () => { await page.reload(); });
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
  // počkej, až je vše v cache
  const pre = readFileSync(new URL('../../docs/precache.js', import.meta.url), 'utf8');
  const files = JSON.parse(pre.slice(pre.indexOf('{'), pre.lastIndexOf('}') + 1)).files;
  await page.waitForFunction(async (n) => { const ks = await caches.keys(); if (!ks.length) return false; const c = await caches.open(ks[0]); return (await c.keys()).length >= n; }, files.length, { timeout: 30000, polling: 500 });
  await env.ctx.setOffline(true);
  const offlineReqs = [];
  page.on('request', (r) => offlineReqs.push(r));
  await page.reload();
  await page.waitForFunction(() => window.zpTest && window.zpTest.state.ready, null, { timeout: 15000 });
  await page.evaluate(() => window.zpTest.saveSettings({ onboarded: true }));
  for (const r of ['/', '/course', '/lesson/c1l1', '/songs', '/song/hvezdicka', '/tuner', '/me', '/progress', '/tools/piano']) {
    await page.evaluate((r) => { location.hash = '#' + r; }, r);
    await sleep(300);
    const t = await page.evaluate(() => document.body.innerText.length);
    assert.ok(t > 30, r + ' se offline nenačetla');
  }
  // nástroje (vzorky) se načtou z cache
  await page.evaluate(async () => { await window.zpTest.engine.ensureContext(); await window.zpTest.engine.loadInstruments(); });
  assert.ok(await page.evaluate(() => window.zpTest.engine.instrumentsReady), 'vzorky nástrojů offline');
  // ladička běží offline
  await page.evaluate(() => { location.hash = '#/tuner'; });
  await sleep(1500);
  assert.ok(await page.evaluate(() => window.zpTest.engine.stats.frames > 20), 'detektor offline neběží');
  assert.deepEqual(failed, [], 'selhané požadavky');
  // všechny požadavky (online i offline) šly jen na vlastní adresu
  const foreign = env.requests.filter((u) => !u.startsWith(env.base) && !u.startsWith('data:') && !u.startsWith('blob:'));
  assert.deepEqual(foreign, [], 'požadavky na cizí servery');
  // offline: žádný požadavek neodešel na síť (vše obslouží service worker)
  const network = offlineReqs.filter((r) => !r.serviceWorker() && !r.url().startsWith('data:') && !r.url().startsWith('blob:'));
  const notFromSw = [];
  for (const r of network) { const res = await r.response(); if (res && !res.fromServiceWorker()) notFromSw.push(r.url()); }
  assert.deepEqual(notFromSw, [], 'offline požadavky mimo service worker');
  assert.deepEqual(env.errors, []);
  await env.ctx.setOffline(false);
});
