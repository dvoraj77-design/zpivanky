// Jednoduchý statický server pro vývoj a testy (http://localhost:8099/).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const root = new URL('../docs/', import.meta.url).pathname;

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8' };
export function start(port = 8099) {
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let base = root;
      const extra = process.env.ZP_EXTRA_ROOT; // testovací soubory (vygenerované nahrávky) na /test-assets/
      if (extra && p.startsWith('/test-assets/')) { base = extra; p = p.slice('/test-assets'.length); }
      let f = join(base, p);
      if (!f.startsWith(base)) throw new Error('bad');
      if ((await stat(f).catch(() => null))?.isDirectory()) f = join(f, 'index.html');
      const data = await readFile(f);
      res.writeHead(200, { 'Content-Type': types[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
if (import.meta.url === `file://${process.argv[1]}`) start(+process.env.PORT || 8099).then(() => console.log('http://localhost:' + (process.env.PORT || 8099) + '/'));
