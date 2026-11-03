// Pomocné funkce pro e2e testy (Playwright Chromium, telefon 390×844).
import { createRequire } from 'node:module';
import { start } from '../../scripts/serve.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
export const { chromium } = require('playwright');

export async function launch({ fakeWav = null, port = 8099, offline = false } = {}) {
  const srv = await start(port);
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
  if (fakeWav) args.push('--use-file-for-fake-audio-capture=' + fakeWav);
  const browser = await chromium.launch({ args });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ['microphone'], locale: 'cs-CZ' });
  const errors = [];
  const requests = [];
  ctx.on('request', (r) => requests.push(r.url()));
  const close = async () => { await browser.close(); await new Promise((r) => srv.close(r)); };
  return { browser, ctx, errors, requests, close, base: `http://localhost:${port}/` };
}

export async function newPage(env, path = '', { test = true } = {}) {
  const page = await env.ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') env.errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', (e) => env.errors.push(`[pageerror] ${e.message}`));
  await page.goto(env.base + (test ? '?test=1' : '') + '#' + path);
  await page.waitForFunction(() => window.zpTest && window.zpTest.state.ready, null, { timeout: 15000 });
  return page;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
