// Grafy: odchylky po notách (Níž / Přesně / Výš), čárové grafy (rozsah, přesnost), křivka dynamiky.
import { html, useRef, useEffect } from './common.js';
import { setupCanvas } from './pitchroll.js';
import { noteName } from '../core/music.js';
import { state } from '../state.js';

/** Graf odchylek: každá nota (nebo výška) jako štítek posunutý podle centů. */
export function DeviationChart({ notes, tol = 50, keyPc }) {
  const valid = notes.filter((n) => n.medDev != null);
  if (!valid.length) return html`<p class="muted small">Žádné tóny k zobrazení.</p>`;
  let rows;
  if (valid.length > 10) {
    const m = new Map();
    for (const n of valid) {
      const k = Math.round(n.midi);
      const e = m.get(k) || { midi: k, sum: 0, n: 0 };
      e.sum += n.medDev; e.n++; m.set(k, e);
    }
    rows = [...m.values()].sort((a, b) => b.midi - a.midi).map((e) => ({ label: noteName(e.midi, { style: state.settings.notation, keyPc, octave: state.settings.notation !== 'solf' }), dev: e.sum / e.n, count: e.n }));
  } else rows = valid.map((n) => ({ label: n.syl && n.syl.length <= 5 ? n.syl.replace(/-$/, '') : noteName(n.midi, { style: state.settings.notation, keyPc, octave: false }), dev: n.medDev }));
  const span = Math.max(100, tol * 2.5);
  return html`<div class="devchart" style="position:relative;padding:22px 0 6px">
    <div class="row between tiny dim" style="position:absolute;top:0;left:0;right:0"><span>▼ Níž</span><span>Přesně</span><span>Výš ▲</span></div>
    <div style="position:absolute;top:20px;bottom:0;left:50%;width:2px;background:#5b4fb0"></div>
    <div style=${`position:absolute;top:20px;bottom:0;left:${50 - (tol / span) * 50}%;width:${(tol / span) * 100}%;background:#5fd38d14;border-radius:6px`}></div>
    ${rows.map((r) => {
      const ok = Math.abs(r.dev) <= tol;
      const x = 50 + Math.max(-1, Math.min(1, r.dev / span)) * 44;
      const col = ok ? 'var(--good)' : Math.abs(r.dev) <= tol * 2 ? 'var(--warn)' : 'var(--bad)';
      const sym = ok ? '●' : r.dev > 0 ? '▲' : '▼';
      return html`<div style="position:relative;height:34px">
        <div style=${`position:absolute;left:${x}%;transform:translateX(-50%);top:3px;display:flex;align-items:center;gap:6px;white-space:nowrap`}>
          <span style=${`background:${col};color:#14102e;border-radius:999px;padding:2px 10px;font-weight:900;font-size:14px`}>${sym} ${r.label}</span>
          <span class="tiny" style=${`color:${col};font-weight:800`}>${r.dev > 0 ? '+' : ''}${Math.round(r.dev)} c</span>
        </div></div>`;
    })}
  </div>`;
}

/** Čárový graf: series [{label, color, points:[{x (index/čas), y}]}], yLabel fn */
export function LineChart({ series, height = 180, yMin, yMax, yFmt = (v) => v, xLabels = [] }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const { ctx, w, h } = setupCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const all = series.flatMap((s) => s.points);
    if (!all.length) { ctx.fillStyle = '#9a90c8'; ctx.font = '700 14px Nunito'; ctx.fillText('Zatím žádná data', 12, h / 2); return; }
    const xs = all.map((p) => p.x);
    const x0 = Math.min(...xs), x1 = Math.max(...xs) || 1;
    const lo = yMin ?? Math.min(...all.map((p) => p.y)) - 1, hi = yMax ?? Math.max(...all.map((p) => p.y)) + 1;
    const L = 44, R = 10, T = 10, B = 22;
    const X = (x) => L + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (w - L - R);
    const Y = (y) => T + (1 - (y - lo) / (hi - lo || 1)) * (h - T - B);
    ctx.font = '700 11px Nunito'; ctx.fillStyle = '#9a90c8'; ctx.strokeStyle = '#2a2160';
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * i) / 4; const y = Y(v);
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke();
      ctx.fillText(String(yFmt(Math.round(v))), 4, y + 4);
    }
    xLabels.forEach((xl) => { ctx.fillText(xl.text, Math.min(w - 40, Math.max(L, X(xl.x) - 14)), h - 6); });
    for (const s of series) {
      ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = 2.5;
      ctx.beginPath();
      s.points.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
      ctx.stroke();
      for (const p of s.points) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
  });
  return html`<canvas ref=${ref} class="fill" style=${`height:${height}px`}></canvas>`;
}

/** Pásmový graf rozsahu v čase: [{x, low, high, chest}] */
export function RangeChart({ history, height = 200 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const { ctx, w, h } = setupCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    if (!history.length) { ctx.fillStyle = '#9a90c8'; ctx.font = '700 14px Nunito'; ctx.fillText('Udělej test hlasu – tady uvidíš vývoj rozsahu.', 12, h / 2); return; }
    const lo = Math.min(...history.map((p) => p.low)) - 2, hi = Math.max(...history.map((p) => p.highAll ?? p.highChest)) + 2;
    const L = 44, R = 10, T = 8, B = 20;
    const n = history.length;
    const X = (i) => L + (n === 1 ? 0.5 : i / (n - 1)) * (w - L - R);
    const Y = (m) => T + (1 - (m - lo) / (hi - lo)) * (h - T - B);
    ctx.font = '700 11px Nunito'; ctx.fillStyle = '#9a90c8'; ctx.strokeStyle = '#2a2160';
    for (let m = Math.ceil(lo); m <= hi; m++) if (m % 12 === 0 || m % 12 === 7) {
      ctx.beginPath(); ctx.moveTo(L, Y(m)); ctx.lineTo(w - R, Y(m)); ctx.stroke();
      ctx.fillText(noteName(m, { style: state.settings.notation === 'solf' ? 'cz' : state.settings.notation }), 4, Y(m) + 4);
    }
    const bw = Math.max(6, Math.min(26, (w - L - R) / n - 6));
    history.forEach((p, i) => {
      const x = X(i);
      ctx.fillStyle = '#8f80ff55'; ctx.fillRect(x - bw / 2, Y(p.highAll ?? p.highChest), bw, Y(p.highChest) - Y(p.highAll ?? p.highChest));
      ctx.fillStyle = '#ff6b81'; ctx.fillRect(x - bw / 2, Y(p.highChest), bw, Y(p.low) - Y(p.highChest));
    });
    ctx.fillStyle = '#9a90c8';
    if (n) { ctx.fillText(new Date(history[0].date).toLocaleDateString('cs-CZ'), L, h - 4); if (n > 1) ctx.fillText(new Date(history[n - 1].date).toLocaleDateString('cs-CZ'), w - 80, h - 4); }
  });
  return html`<canvas ref=${ref} class="fill" style=${`height:${height}px`}></canvas>`;
}

/** Hlasitost vs. cíl (dynamika). curve: [{t, rel, target}] */
export function DynChart({ curve, height = 140 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const { ctx, w, h } = setupCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    if (!curve?.length) return;
    const t0 = curve[0].t, t1 = curve[curve.length - 1].t;
    const vals = curve.flatMap((c) => [c.rel, c.target]);
    const lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2;
    const X = (t) => 8 + ((t - t0) / (t1 - t0 || 1)) * (w - 16);
    const Y = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (h - 16);
    ctx.strokeStyle = '#ffc92866'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); curve.forEach((c, i) => (i ? ctx.lineTo(X(c.t), Y(c.target)) : ctx.moveTo(X(c.t), Y(c.target)))); ctx.stroke();
    ctx.strokeStyle = '#5fd38d'; ctx.lineWidth = 2.5;
    ctx.beginPath(); curve.forEach((c, i) => (i ? ctx.lineTo(X(c.t), Y(c.rel)) : ctx.moveTo(X(c.t), Y(c.rel)))); ctx.stroke();
  });
  return html`<canvas ref=${ref} class="fill" style=${`height:${height}px`}></canvas>`;
}
