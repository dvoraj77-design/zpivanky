// Válec not: noty jako pruhy na mřížce výšek, text pod nimi, živá křivka hlasu obarvená podle přesnosti.
import { html, useRef, useEffect } from './common.js';
import { C } from './theme.js';
import { noteName, pc, foldCents } from '../core/music.js';

const COL = { grid: C.grid, gridStrong: C.gridKey, label: C.label, labelKey: C.labelKey, note: C.note, noteNow: C.noteNow, listen: C.noteListen, good: C.good, warn: C.warn, bad: C.bad, curve: C.curve, text: '#5a5c6e' };

export function statusOf(dev, tol) {
  if (dev == null) return 'none';
  const a = Math.abs(dev);
  return a <= tol ? 'ok' : a <= tol * 2 ? 'near' : 'off';
}
const stColor = (s) => (s === 'ok' ? COL.good : s === 'near' ? COL.warn : s === 'off' ? COL.bad : COL.curve);

// úsporné vykreslování pro slabší telefony (nastaví se samo podle rychlosti kreslení)
export const perf = { low: (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3 };
export function setupCanvas(cv) {
  const dpr = Math.min(perf.low ? 1.5 : 2, window.devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  const w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
}

/**
 * model: { beat(), items, curve:[{b,m,s}], lo, hi, keyPc, notation, pxPerBeat, hideCurve, tol, live:{midi,dev,status}, bpb, results? }
 */
export function drawRoll(ctx, w, h, m) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.canvas; ctx.fillRect(0, 0, w, h);
  const gutter = 46;
  const beat = m.beat();
  const ppb = m.pxPerBeat || 60;
  const playX = gutter + (w - gutter) * 0.3;
  const lo = m.lo, hi = m.hi;
  const topPad = 10, botPad = 26;
  const rowH = (h - topPad - botPad) / (hi - lo + 1);
  const yOf = (midi) => topPad + (hi - midi + 0.5) * rowH;
  const xOf = (b) => playX + (b - beat) * ppb;
  // řádky výšek
  ctx.font = '700 11px Nunito, sans-serif';
  ctx.textBaseline = 'middle';
  for (let n = lo; n <= hi; n++) {
    const y = yOf(n);
    const isKey = m.keyPc != null && pc(n) === m.keyPc;
    const natural = [0, 2, 4, 5, 7, 9, 11].includes(pc(n));
    ctx.strokeStyle = isKey ? COL.gridStrong : COL.grid;
    ctx.lineWidth = isKey ? 1.5 : 1;
    ctx.beginPath(); ctx.moveTo(gutter, y); ctx.lineTo(w, y); ctx.stroke();
    if (rowH >= 11 || natural || isKey) {
      if (rowH < 11 && !natural && !isKey) continue;
      ctx.fillStyle = isKey ? COL.labelKey : COL.label;
      const name = m.notation === 'solf' ? noteName(n, { style: 'solf', keyPc: m.keyPc ?? 0 }) : noteName(n, { style: m.notation || 'cz', keyPc: m.keyPc });
      if (rowH >= 9 || n % 2 === 0) ctx.fillText(name, 6, y);
    }
  }
  // doby a takty
  const bpb = m.bpb || 4;
  const firstB = Math.floor(beat - (playX - gutter) / ppb);
  const lastB = Math.ceil(beat + (w - playX) / ppb);
  for (let b = firstB; b <= lastB; b++) {
    const x = xOf(b);
    if (x < gutter) continue;
    ctx.strokeStyle = b % bpb === 0 ? 'rgba(47,49,64,0.09)' : 'rgba(47,49,64,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, topPad); ctx.lineTo(x, h - botPad); ctx.stroke();
  }
  // cíle
  const res = m.results || {};
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < m.items.length; i++) {
    const it = m.items[i];
    const x0 = xOf(it.t), x1 = xOf(it.t + it.d);
    if (x1 < gutter || x0 > w) continue;
    const now = beat >= it.t && beat < it.t + it.d;
    const r = it.ri != null ? res[it.ri] : null;
    let fill = it.listen ? COL.listen : now ? COL.noteNow : COL.note;
    if (r && beat > it.t + it.d) fill = r === 'ok' ? C.goodFill : r === 'missed' ? C.badFill : C.warnFill;
    const bh = Math.max(8, Math.min(18, rowH * 0.8));
    if (it.kind === 'glide') {
      ctx.strokeStyle = fill; ctx.lineWidth = bh; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(x0, yOf(it.midi)); ctx.lineTo(x1, yOf(it.toMidi)); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (it.kind === 'rhythm') {
      ctx.fillStyle = fill;
      rr(ctx, x0, yOf(it.midi) - bh / 2, Math.max(6, (x1 - x0) * 0.35), bh, 5); ctx.fill();
    } else {
      ctx.fillStyle = fill;
      if (it.listen) { ctx.setLineDash([5, 4]); ctx.strokeStyle = fill; ctx.lineWidth = 2; rr(ctx, x0 + 1, yOf(it.midi) - bh / 2, Math.max(4, x1 - x0 - 3), bh, 6); ctx.stroke(); ctx.setLineDash([]); }
      else { rr(ctx, x0 + 1, yOf(it.midi) - bh / 2, Math.max(4, x1 - x0 - 3), bh, 6); ctx.fill(); }
    }
    if (it.syl && !it.listen && m.showLyrics !== false) {
      ctx.font = now ? '900 14px Nunito, sans-serif' : '700 13px Nunito, sans-serif';
      ctx.fillStyle = now ? C.text : COL.text;
      const ty = it.kind === 'glide' ? Math.max(yOf(it.midi), yOf(it.toMidi)) + bh / 2 + 15 : yOf(it.midi) + bh / 2 + 15;
      ctx.fillText(it.syl, x0 + 3, Math.min(h - 6, ty));
    }
  }
  // křivka hlasu
  if (!m.hideCurve && m.curve.length) {
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let prev = null;
    for (const p of m.curve) {
      const x = xOf(p.b);
      if (x < gutter - 5) { prev = null; continue; }
      if (x > playX + 2) break;
      if (p.m == null || p.m < lo - 2 || p.m > hi + 2) { prev = null; continue; }
      if (prev && x - prev.x < 30) {
        ctx.strokeStyle = stColor(p.s);
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, yOf(p.m)); ctx.stroke();
      }
      prev = { x, y: yOf(p.m) };
    }
  }
  // hrací čára
  ctx.strokeStyle = 'rgba(47,49,64,0.06)'; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(playX, topPad); ctx.lineTo(playX, h - botPad); ctx.stroke();
  const live = m.live;
  if (!m.hideCurve && live && live.midi != null) {
    const y = Math.max(topPad, Math.min(h - botPad, yOf(live.midi)));
    const col = live.status && live.status !== 'none' ? stColor(live.status) : COL.curve;
    const g = ctx.createRadialGradient(playX, y, 2, playX, y, 26);
    g.addColorStop(0, col + 'cc'); g.addColorStop(1, col + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(playX, y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(playX, y, 10, 0, Math.PI * 2); ctx.fill();
    // tvar podle přesnosti: ▲ vysoko, ▼ nízko, ● přesně
    ctx.fillStyle = '#ffffff'; ctx.font = '900 12px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(live.dev == null ? '' : live.status === 'ok' ? '●' : live.dev > 0 ? '▲' : '▼', playX, y + 1);
    ctx.textAlign = 'left';
    if (live.dev != null && live.status !== 'ok') {
      ctx.font = '800 13px Nunito, sans-serif'; ctx.fillStyle = col;
      ctx.fillText(live.dev > 0 ? 'Příliš vysoko ▲' : 'Příliš nízko ▼', playX + 18, live.dev > 0 ? y - 18 : y + 20);
    }
    ctx.textBaseline = 'alphabetic';
  }
}

export function PitchRoll({ model, height = '100%' }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf, n = 0, slow = 0;
    const loop = () => {
      const cv = ref.current;
      n++;
      // při pomalém kreslení kresli jen každý druhý snímek (30 fps je pořád plynulé)
      if (cv && (!perf.low || n % 2 === 0)) {
        const t0 = performance.now();
        const { ctx, w, h } = setupCanvas(cv);
        try { drawRoll(ctx, w, h, model.current || model); } catch (e) { console.error(e); }
        const dt = performance.now() - t0;
        slow = dt > 9 ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 20 && !perf.low) perf.low = true;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return html`<canvas ref=${ref} class="fill" style=${`height:${height}`} aria-label="Válec not s křivkou hlasu"></canvas>`;
}

/** Spočítá zobrazovaný rozsah výšek pro sadu cílů. */
export function viewRange(items, minSpan = 12) {
  const ms = items.flatMap((i) => [i.midi, i.toMidi]).filter((x) => x != null);
  if (!ms.length) return { lo: 45, hi: 60 };
  let lo = Math.floor(Math.min(...ms)) - 3, hi = Math.ceil(Math.max(...ms)) + 3;
  while (hi - lo < minSpan) { lo--; hi++; }
  return { lo, hi };
}

export { foldCents };
