// Vyrenderuje ikony aplikace (PNG) z SVG pomocí Playwright/Chromium.
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const out = new URL('../docs/icons/', import.meta.url).pathname;
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9ecdf"/><stop offset="1" stop-color="#cfe0f7"/></linearGradient></defs>
<rect width="512" height="512" rx="${pad ? 0 : 112}" fill="url(#g)"/>
<g transform="translate(256 256) scale(${pad ? 0.72 : 1}) translate(-256 -256)">
<path d="M84 330 C 150 250, 200 380, 262 300 S 380 230, 430 290" fill="none" stroke="#f2a96a" stroke-width="22" stroke-linecap="round" opacity=".95"/>
<rect x="196" y="96" width="120" height="196" rx="60" fill="#2f5d56"/>
<path d="M160 236 a96 96 0 0 0 192 0" fill="none" stroke="#2f5d56" stroke-width="22" stroke-linecap="round"/>
<rect x="244" y="330" width="24" height="56" rx="10" fill="#2f5d56"/><rect x="196" y="378" width="120" height="22" rx="11" fill="#2f5d56"/>
<circle cx="430" cy="290" r="26" fill="#f2a96a"/></g></svg>`;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, size, pad] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out + name, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('ikony hotové');
