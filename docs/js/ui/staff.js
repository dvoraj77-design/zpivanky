// Notová osnova, rytmické hodnoty a klaviatura jako SVG (hry z hudební nauky).
import { html } from './common.js';

const G = 12; // vzdálenost linek
const TOP = 34, BOTTOM = TOP + 4 * G;
const REF = { G: 2, F: -10 }; // krok spodní linky (E4 v houslovém, G2 v basovém klíči)
const INK = '#2b2d42';

/** Houslový klíč (ručně kreslená křivka – spirála kolem linky g1). */
const G_CLEF = 'M21 70 C17 70,16 64,21 62 C28 60,31 68,28 74 C25 80,13 80,11 70 C9 60,18 52,24 44 C29 37,30 28,27 20 C25 14,20 16,19 24 C18 34,22 64,23 96 C24 104,16 106,14 100 C13 96,18 94,19 98';
const F_CLEF = 'M10 50 C10 40,30 36,31 52 C32 66,20 76,9 82';

const stepY = (step, clef) => BOTTOM - (step - REF[clef]) * (G / 2);

/**
 * notes: [{l, oct, acc}] (krok = (oct-4)*7 + l), keySig: {type:'#'|'b', n}
 */
export function Staff({ clef = 'G', notes = [], keySig = null, width = 280 }) {
  const lines = [0, 1, 2, 3, 4].map((i) => TOP + i * G);
  const ksPos = { '#': [10, 7, 11, 8, 5, 9, 6], b: [6, 9, 5, 8, 4, 7, 3] };
  const ks = keySig?.n ? ksPos[keySig.type].slice(0, keySig.n).map((s, i) => ({ s: clef === 'G' ? s : s - 14, x: 50 + i * 11 })) : [];
  const x0 = 60 + ks.length * 11 + 30;
  const gap = notes.length > 1 ? Math.min(70, (width - x0 - 30) / (notes.length - 1)) : 0;
  const parts = [];
  notes.forEach((n, i) => {
    const step = (n.oct - 4) * 7 + n.l;
    const off = step - REF[clef];
    const x = x0 + i * gap, y = stepY(step, clef);
    // pomocné linky
    for (let o = -2; o >= off; o -= 2) parts.push(html`<line x1=${x - 12} x2=${x + 12} y1=${BOTTOM - o * (G / 2)} y2=${BOTTOM - o * (G / 2)} stroke=${INK} stroke-width="1.4" />`);
    for (let o = 10; o <= off; o += 2) parts.push(html`<line x1=${x - 12} x2=${x + 12} y1=${BOTTOM - o * (G / 2)} y2=${BOTTOM - o * (G / 2)} stroke=${INK} stroke-width="1.4" />`);
    if (n.acc) parts.push(html`<text x=${x - 22} y=${y + (n.acc > 0 ? 6 : 4)} font-size="20" fill=${INK} text-anchor="middle" font-family="serif">${n.acc > 0 ? '♯' : '♭'}</text>`);
    parts.push(html`<ellipse cx=${x} cy=${y} rx="7.4" ry="5.4" transform=${`rotate(-20 ${x} ${y})`} fill=${INK} />`);
    const up = off < 4;
    parts.push(html`<line x1=${up ? x + 6.6 : x - 6.6} x2=${up ? x + 6.6 : x - 6.6} y1=${y + (up ? -1 : 1)} y2=${y + (up ? -38 : 38)} stroke=${INK} stroke-width="1.6" />`);
  });
  return html`<svg viewBox=${`0 0 ${width} 120`} width="100%" style="max-width:${width * 1.4}px" role="img" aria-label="Notová osnova">
    ${lines.map((y) => html`<line x1="6" x2=${width - 6} y1=${y} y2=${y} stroke="#9a9cad" stroke-width="1.2" />`)}
    ${clef === 'G' ? html`<path d=${G_CLEF} fill="none" stroke=${INK} stroke-width="2.6" stroke-linecap="round" transform="translate(4,-4)" />`
      : html`<g transform="translate(6,-4)"><path d=${F_CLEF} fill="none" stroke=${INK} stroke-width="3" stroke-linecap="round" /><circle cx="37" cy="45" r="2.4" fill=${INK} /><circle cx="37" cy="57" r="2.4" fill=${INK} /></g>`}
    ${ks.map((k) => html`<text x=${k.x} y=${stepY(k.s, clef) + (keySig.type === '#' ? 6 : 4)} font-size="20" fill=${INK} text-anchor="middle" font-family="serif">${keySig.type === '#' ? '♯' : '♭'}</text>`)}
    ${parts}
  </svg>`;
}

// ---------- rytmické hodnoty ----------
function noteGlyph(v, x, base = 70) {
  const open = v === 'w' || v.startsWith('h');
  const stem = v !== 'w';
  const flags = v === 'e' ? 1 : v === 's' ? 2 : 0;
  const dot = v.endsWith('.');
  const y = base;
  return html`<g>
    <ellipse cx=${x} cy=${y} rx="8" ry="5.8" transform=${`rotate(-20 ${x} ${y})`} fill=${open ? 'none' : INK} stroke=${INK} stroke-width="2" />
    ${stem ? html`<line x1=${x + 7} x2=${x + 7} y1=${y - 1} y2=${y - 42} stroke=${INK} stroke-width="2" />` : null}
    ${[...Array(flags)].map((_, k) => html`<path d=${`M${x + 7} ${y - 42 + k * 9} q 12 8 6 22`} fill="none" stroke=${INK} stroke-width="2.4" />`)}
    ${dot ? html`<circle cx=${x + 16} cy=${y + 1} r="2.6" fill=${INK} />` : null}
  </g>`;
}
function restGlyph(v, x, base = 70) {
  if (v === 'wr') return html`<g><line x1=${x - 14} x2=${x + 14} y1=${base - 24} y2=${base - 24} stroke="#9a9cad" /><rect x=${x - 8} y=${base - 24} width="16" height="7" fill=${INK} /></g>`;
  if (v === 'hr') return html`<g><line x1=${x - 14} x2=${x + 14} y1=${base - 16} y2=${base - 16} stroke="#9a9cad" /><rect x=${x - 8} y=${base - 23} width="16" height="7" fill=${INK} /></g>`;
  if (v === 'qr') return html`<path d=${`M${x - 3} ${base - 40} l 8 10 l -7 9 l 8 10 q -10 -4 -6 8`} fill="none" stroke=${INK} stroke-width="3" stroke-linejoin="round" />`;
  return html`<g><circle cx=${x - 3} cy=${base - 30} r="3.5" fill=${INK} /><path d=${`M${x - 3} ${base - 28} q 8 2 10 -4 l -8 26`} fill="none" stroke=${INK} stroke-width="2.4" /></g>`;
}
/** Jednotlivé hodnoty (bez osnovy) vedle sebe. */
export function RhythmValues({ items }) {
  const w = Math.max(120, items.length * 56 + 30);
  return html`<svg viewBox=${`0 0 ${w} 90`} width="100%" style=${`max-width:${w * 1.5}px`} role="img" aria-label="Rytmické hodnoty">
    ${items.map((v, i) => { const x = 36 + i * 56; return v.endsWith('r') ? restGlyph(v, x) : noteGlyph(v, x); })}
  </svg>`;
}
/** Takt z rytmických buněk (q, h, ee, qr, q.e, eqe, ssss) s trámci. */
export function RhythmBar({ cells, height = 70 }) {
  const LEN = { q: 1, h: 2, ee: 1, qr: 1, 'q.e': 2, eqe: 2, ssss: 1 };
  const bw = 62; let x = 18; const out = [];
  for (const c of cells) {
    const y = 52, top = 18;
    const head = (hx, open = false) => html`<ellipse cx=${hx} cy=${y} rx="7" ry="5" transform=${`rotate(-20 ${hx} ${y})`} fill=${open ? 'none' : INK} stroke=${INK} stroke-width="1.8" />`;
    const stem = (hx) => html`<line x1=${hx + 6.2} x2=${hx + 6.2} y1=${y} y2=${top} stroke=${INK} stroke-width="1.8" />`;
    if (c === 'q') out.push(html`<g>${head(x + 10)}${stem(x + 10)}</g>`);
    else if (c === 'h') out.push(html`<g>${head(x + 10, true)}${stem(x + 10)}</g>`);
    else if (c === 'qr') out.push(restGlyph('qr', x + 12, 78));
    else if (c === 'ee' || c === 'ssss') {
      const n = c === 'ee' ? 2 : 4, sp = c === 'ee' ? 26 : 13;
      const xs = [...Array(n)].map((_, k) => x + 6 + k * sp);
      out.push(html`<g>${xs.map((hx) => head(hx))}${xs.map((hx) => stem(hx))}
        <line x1=${xs[0] + 6.2} x2=${xs[n - 1] + 6.2} y1=${top} y2=${top} stroke=${INK} stroke-width="4" />
        ${c === 'ssss' ? html`<line x1=${xs[0] + 6.2} x2=${xs[n - 1] + 6.2} y1=${top + 7} y2=${top + 7} stroke=${INK} stroke-width="4" />` : null}</g>`);
    } else if (c === 'q.e') {
      const a = x + 8, b = x + 8 + bw;
      out.push(html`<g>${head(a)}${stem(a)}<circle cx=${a + 15} cy=${y + 1} r="2.4" fill=${INK} />${head(b)}${stem(b)}<path d=${`M${b + 6.2} ${top} q 11 8 5 20`} fill="none" stroke=${INK} stroke-width="2.2" /></g>`);
    } else if (c === 'eqe') {
      const a = x + 6, b = x + 30, d = x + 6 + bw + 20;
      out.push(html`<g>${head(a)}${stem(a)}<path d=${`M${a + 6.2} ${top} q 11 8 5 20`} fill="none" stroke=${INK} stroke-width="2.2" />${head(b)}${stem(b)}${head(d)}${stem(d)}<path d=${`M${d + 6.2} ${top} q 11 8 5 20`} fill="none" stroke=${INK} stroke-width="2.2" /></g>`);
    }
    x += LEN[c] * bw;
  }
  const w = x + 10;
  return html`<svg viewBox=${`0 0 ${w} ${height}`} width="100%" style=${`max-width:${w * 1.3}px`} role="img" aria-label="Rytmus">
    <line x1="4" x2=${w - 4} y1="52" y2="52" stroke="#d7d4cc" stroke-width="1" />
    <line x1=${w - 4} x2=${w - 4} y1="30" y2="60" stroke="#9a9cad" stroke-width="1.5" />${out}</svg>`;
}

// ---------- klaviatura ----------
const WHITE_PC = [0, 2, 4, 5, 7, 9, 11], BLACK = [[1, 0.7], [3, 1.7], [6, 3.7], [8, 4.7], [10, 5.7]];
/** Jedna oktáva od C4; marks = MIDI tóny k označení; onTap(pc) = ťukání na klávesy. */
export function Keyboard({ marks = [], onTap = null, octaves = 1, good = null, bad = null }) {
  const ww = 40, wh = 130, bw = 24, bh = 82;
  const n = 7 * octaves;
  const markPc = new Set(marks.map((m) => m - 60));
  const fill = (k, white) => (good === k ? '#a8dcc9' : bad === k ? '#f5c2ca' : markPc.has(k) ? '#f6d9ad' : white ? '#fff' : '#2b2d42');
  const keys = [];
  for (let i = 0; i < n; i++) { const k = Math.floor(i / 7) * 12 + WHITE_PC[i % 7]; keys.push(html`<rect x=${i * ww + 1} y="1" width=${ww - 2} height=${wh} rx="5" fill=${fill(k, true)} stroke="#9a9cad" style=${onTap ? 'cursor:pointer' : ''} onClick=${onTap ? () => onTap(k % 12) : null} data-key=${k} />`); }
  for (let o = 0; o < octaves; o++) for (const [pc, pos] of BLACK) { const k = o * 12 + pc; keys.push(html`<rect x=${(o * 7 + pos) * ww + ww / 2 - bw / 2 + 8} y="1" width=${bw} height=${bh} rx="3" fill=${fill(k, false)} stroke="#2b2d42" style=${onTap ? 'cursor:pointer' : ''} onClick=${onTap ? () => onTap(k % 12) : null} data-key=${k} />`); }
  return html`<svg viewBox=${`0 0 ${n * ww + 2} ${wh + 2}`} width="100%" style="max-width:420px" role="img" aria-label="Klaviatura">${keys}</svg>`;
}
