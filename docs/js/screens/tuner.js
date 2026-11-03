// Živá ladička: nota, oktáva, centy (ručička + barva + symbol), křivka posledních 10 s na mřížce not, bourdon.
import { html, useState, useEffect, useRef, useFrames, useInterval, useAppState, MicGate, fmtNote, useWakeLock, Seg } from '../ui/common.js';
import { Hint, HelpBtn } from '../ui/hints.js';
import { C } from '../ui/theme.js';
import { setupCanvas } from '../ui/pitchroll.js';
import { engine } from '../audio/engine.js';
import { state, tol, saveSettings } from '../state.js';
import { noteName, pc, octaveOf, median } from '../core/music.js';
import { STRICTNESS } from '../core/scoring.js';

const COL = { ok: C.good, near: C.warn, off: C.bad };

export function TunerScreen() {
  const st = useAppState();
  const [disp, setDisp] = useState({ midi: null, cents: 0, status: 'none', freq: 0 });
  const recent = useRef([]);
  const lastVoiced = useRef(0);
  const smoothCents = useRef(0);
  const viewCenter = useRef(null);
  const canvasRef = useRef(null);
  const [drone, setDrone] = useState(false);
  const [droneNote, setDroneNote] = useState(state.profile.workingTonic);
  useWakeLock(true);
  useFrames((frames) => {
    for (const f of frames) {
      if (f.voiced && f.midi != null) { recent.current.push(f.midi); lastVoiced.current = performance.now(); }
    }
    if (recent.current.length > 6) recent.current.splice(0, recent.current.length - 6);
  });
  // klidné zobrazení: medián posledních snímků, plynulá ručička, nota drží chvíli po dozpívání
  useInterval(() => {
    const now = performance.now();
    const r = recent.current;
    if (now - lastVoiced.current > 700) { if (disp.midi != null) setDisp((d) => ({ ...d, status: 'none', fading: true })); if (now - lastVoiced.current > 2500) { recent.current = []; setDisp({ midi: null, cents: 0, status: 'none', freq: 0 }); } return; }
    if (!r.length) return;
    const m = median(r);
    const nearest = Math.round(m);
    const c = (m - nearest) * 100;
    smoothCents.current = smoothCents.current * 0.6 + c * 0.4;
    const a = Math.abs(smoothCents.current), t = tol();
    setDisp({ midi: nearest, cents: smoothCents.current, status: a <= t / 2 ? 'ok' : a <= t ? 'near' : 'off', freq: 440 * Math.pow(2, (m - 69) / 12) });
  }, 50);
  // kreslení historie
  useEffect(() => {
    let raf;
    const draw = () => {
      const cv = canvasRef.current;
      if (cv) drawHistory(cv, viewCenter);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => () => engine.drone?.stop(), []);
  const toggleDrone = async () => {
    await engine.ensureContext();
    if (drone) { engine.drone.stop(); setDrone(false); } else { engine.drone.start(droneNote); setDrone(true); }
  };
  const tapNote = (midi) => engine.previewNote(midi, 1.4);
  const style = st.settings.notation;
  const name = disp.midi != null ? noteName(disp.midi, { style, octave: false, keyPc: style === 'solf' ? 0 : undefined }) : '–';
  const col = disp.status === 'none' ? C.dim : COL[disp.status];
  const sym = disp.midi == null ? '' : disp.status === 'ok' ? '●' : disp.cents > 0 ? '▲' : '▼';
  return html`<div class="screen">
    <div class="row between mb8"><h1>Ladička</h1><span class="small muted">±${tol()} centů</span></div>
    <${Hint} id="tuner" help="tuner" title="Jak na ladičku">Zazpívej libovolný tón. Velké písmeno je tón, číslo vedle je oktáva. Ručička uprostřed a zelená = přesně, ▼ = trochu níž, ▲ = trochu výš. Klepnutím na tón ho uslyšíš.</${Hint}>
    <${MicGate}>
      <div class="card center" style="padding:14px 12px">
        <button class="tuner-note" style="background:none;border:0;cursor:pointer;width:100%" onClick=${() => disp.midi != null && tapNote(disp.midi)} aria-label="Přehrát notu">
          <span class="n" style=${`color:${disp.fading ? C.dim : C.text}`}>${name}</span>${disp.midi != null && style !== 'solf' ? html`<span class="o">${octaveOf(disp.midi)}</span>` : null}
          <div class="c" style=${`color:${col}`}>${disp.midi == null ? 'Zazpívej tón' : `${sym} ${disp.status === 'ok' ? 'přesně' : (disp.cents > 0 ? '+' : '−') + Math.abs(Math.round(disp.cents)) + ' centů'}`}</div>
        </button>
        <${Needle} cents=${disp.midi == null ? 0 : disp.cents} color=${col} active=${disp.midi != null} />
        <div class="row between tiny dim mt8"><span>▼ níž</span><span>${disp.freq ? disp.freq.toFixed(1) + ' Hz' : ''}</span><span>výš ▲</span></div>
      </div>
      <div class="mt16" style="height:240px"><canvas ref=${canvasRef} class="fill" style="height:240px" onClick=${(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const vc = viewCenter.current; if (vc == null) return;
        const rows = 15, y = e.clientY - r.top;
        const midi = Math.round(vc + 7 - (y / r.height) * rows + 0.5);
        tapNote(midi);
      }}></canvas></div>
      <div class="tiny dim mt8">Klepnutím na mřížku nebo notu ji uslyšíš. Křivka ukazuje posledních 10 sekund.</div>
    </${MicGate}>
    <div class="section-title">Bourdon (držený tón)</div>
    <div class="card row">
      <button class="iconbtn" aria-label="Níž" onClick=${() => { const n = droneNote - 1; setDroneNote(n); if (drone) engine.drone.start(n); }}>−</button>
      <div class="grow center"><div style="font-weight:900;font-size:22px">${fmtNote(droneNote)}</div><div class="tiny dim">tónika + kvinta</div></div>
      <button class="iconbtn" aria-label="Výš" onClick=${() => { const n = droneNote + 1; setDroneNote(n); if (drone) engine.drone.start(n); }}>＋</button>
      <button class=${'btn ' + (drone ? 'primary' : '')} onClick=${toggleDrone}>${drone ? '■ Stop' : '▶ Hrát'}</button>
    </div>
    <div class="section-title">Přísnost</div>
    <${Seg} options=${Object.entries(STRICTNESS).map(([k, v]) => [k, v.label.split(' ')[0]])} value=${st.settings.strictness} onChange=${(v) => saveSettings({ strictness: v })} />
  </div>`;
}

function Needle({ cents, color, active }) {
  const ref = useRef(null);
  const cur = useRef(0);
  useEffect(() => {
    let raf;
    const draw = () => {
      const cv = ref.current;
      if (cv) {
        cur.current += (Math.max(-50, Math.min(50, cents)) - cur.current) * 0.25;
        const { ctx, w, h } = setupCanvas(cv);
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2, cy = h - 6, R = Math.min(w / 2 - 10, h - 14);
        const t = tol();
        const ang = (c) => Math.PI + ((c + 50) / 100) * Math.PI;
        // pásma
        const band = (a, b, col) => { ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx, cy, R, ang(a), ang(b)); ctx.stroke(); };
        band(-50, 50, C.track);
        band(-Math.min(50, t), Math.min(50, t), C.warnFill);
        band(-Math.min(50, t / 2), Math.min(50, t / 2), C.goodFill);
        ctx.fillStyle = C.label; ctx.font = '700 11px Nunito'; ctx.textAlign = 'center';
        for (const c of [-50, -25, 0, 25, 50]) { const a = ang(c); ctx.fillText(c > 0 ? '+' + c : String(c), cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22) + 4); }
        if (active) {
          const a = ang(cur.current);
          ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4)); ctx.stroke();
        }
        ctx.fillStyle = active ? color : C.dim; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  });
  return html`<canvas ref=${ref} style="width:100%;height:120px;display:block" aria-hidden="true"></canvas>`;
}

function drawHistory(cv, viewCenter) {
  const { ctx, w, h } = setupCanvas(cv);
  ctx.fillStyle = C.canvas; ctx.fillRect(0, 0, w, h);
  const now = engine.smoothNow();
  const hist = engine.history;
  const span = 10;
  const voiced = hist.filter((f) => f.voiced && f.midi != null && f.t > now - 3);
  if (voiced.length > 5) {
    const m = median(voiced.map((f) => f.midi));
    if (viewCenter.current == null) viewCenter.current = m;
    else if (Math.abs(m - viewCenter.current) > 4) viewCenter.current += (m - viewCenter.current) * 0.08;
  }
  const c = viewCenter.current ?? state.profile.workingTonic + 4;
  const rows = 15;
  const lo = Math.round(c) - 7;
  const rowH = h / rows;
  const yOf = (midi) => h - (midi - lo + 0.5) * rowH;
  const L = 44;
  ctx.font = '700 11px Nunito'; ctx.textBaseline = 'middle';
  for (let n = lo; n < lo + rows; n++) {
    const y = yOf(n);
    ctx.strokeStyle = [0, 2, 4, 5, 7, 9, 11].includes(pc(n)) ? C.gridStrong : C.grid;
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillStyle = pc(n) === pc(state.profile.workingTonic) ? C.labelKey : C.label;
    ctx.fillText(noteName(n, { style: state.settings.notation, keyPc: state.settings.notation === 'solf' ? 0 : undefined }), 6, y);
  }
  const X = (t) => L + (1 - (now - t) / span) * (w - L - 8);
  const t = tol();
  let prev = null;
  ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const f of hist) {
    if (f.t < now - span) continue;
    if (!f.voiced || f.midi == null) { prev = null; continue; }
    const x = X(f.t), y = yOf(f.midi);
    if (prev && x - prev.x < 20) {
      const dev = Math.abs((f.midi - Math.round(f.midi)) * 100);
      ctx.strokeStyle = dev <= t / 2 ? COL.ok : dev <= t ? COL.near : COL.off;
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, y); ctx.stroke();
    }
    prev = { x, y };
  }
  if (prev) { ctx.fillStyle = C.curve; ctx.beginPath(); ctx.arc(prev.x, prev.y, 6, 0, Math.PI * 2); ctx.fill(); }
}
