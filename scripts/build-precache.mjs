// Vygeneruje docs/precache.js (seznam souborů pro offline režim) a docs/js/version.js.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root = new URL('../docs/', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const skip = new Set(['sw.js', 'precache.js', '.nojekyll', 'js/version.js']);
function walk(d) { return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
// model a ONNX Runtime (~56 MB) se stahují až na vyžádání (Import → Přesně), ne při instalaci
const onDemand = (f) => f.startsWith('models/') || f.startsWith('vendor/ort/');
const files = walk(root).map((p) => relative(root, p).split('\\').join('/')).filter((f) => !skip.has(f) && !onDemand(f)).sort();
const h = createHash('sha1');
for (const f of files) { h.update(f); h.update(readFileSync(join(root, f))); }
const hash = h.digest('hex').slice(0, 10);
writeFileSync(join(root, 'js/version.js'), `export const APP_VERSION = '${pkg.version} (${hash})';\n`);
const all = ['./', ...files, 'js/version.js'];
writeFileSync(join(root, 'precache.js'), `// Vygenerováno: npm run build\nself.PRECACHE = ${JSON.stringify({ version: hash, files: all }, null, 0)};\n`);
console.log(`precache: ${all.length} souborů, verze ${hash}`);
