// Instalace: manifest, ikony, celá obrazovka, Chrome hlásí instalovatelnost bez chyb.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launch } from './helpers.mjs';

let env;
before(async () => { env = await launch({ port: 8161 }); });
after(async () => { await env?.close(); });

function pngSize(path) { const b = readFileSync(path); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

test('manifest a ikony', () => {
  const m = JSON.parse(readFileSync(new URL('../../docs/manifest.webmanifest', import.meta.url)));
  assert.equal(m.name, 'Zpívánky');
  assert.equal(m.short_name, 'Zpívánky');
  assert.equal(m.display, 'standalone');
  assert.equal(m.lang, 'cs');
  assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512') && m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) {
    const [w, h] = pngSize(new URL('../../docs/' + i.src, import.meta.url).pathname);
    assert.equal(`${w}x${h}`, i.sizes, i.src);
  }
});

test('Chrome: stránka je instalovatelná (žádné chyby instalovatelnosti)', async () => {
  const page = await env.ctx.newPage();
  await page.goto(env.base + '?test=1&sw=1#/');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => page.reload());
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
  const cdp = await env.ctx.newCDPSession(page);
  const r = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(r.installabilityErrors, [], JSON.stringify(r.installabilityErrors));
  const man = await cdp.send('Page.getAppManifest');
  assert.ok(man.url.endsWith('manifest.webmanifest'));
  assert.deepEqual(man.errors, []);
});
