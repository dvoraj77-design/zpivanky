// Sdílené UI komponenty a háčky.
import { html, render, useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from '../../vendor/htm-preact.js';
import { scoreHex } from './theme.js';
import { state, subscribe, saveSettings } from '../state.js';
import { engine } from '../audio/engine.js';
import { noteName } from '../core/music.js';

export { html, render, useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect };

export function navigate(path, replace = false) {
  const h = '#' + path;
  if (replace) location.replace(h); else location.hash = h;
}
export function back(fallback = '/') {
  if (history.length > 1 && sessionStorage.getItem('zp-nav') === '1') history.back();
  else navigate(fallback, true);
}

export function useAppState() {
  const [, set] = useState(0);
  useEffect(() => subscribe(() => set((x) => x + 1)), []);
  return state;
}

/** Odběr snímků z detektoru. cb(frames, peak) */
export function useFrames(cb, deps = []) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => engine.onFrames((f, p) => ref.current(f, p)), deps);
}

export function useInterval(fn, ms) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { if (ms == null) return; const id = setInterval(() => ref.current(), ms); return () => clearInterval(id); }, [ms]);
}

export function useRaf(fn, active = true) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    if (!active) return;
    let id;
    const loop = (t) => { ref.current(t); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

/** Obrazovka nezhasne během zpěvu. */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !state.settings.wakeLock || !('wakeLock' in navigator)) return;
    let lock = null, dead = false;
    const req = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch { /* nepovoleno */ } };
    req();
    const vis = () => { if (document.visibilityState === 'visible' && !dead) req(); };
    document.addEventListener('visibilitychange', vis);
    return () => { dead = true; document.removeEventListener('visibilitychange', vis); lock?.release?.().catch(() => {}); };
  }, [active]);
}

/** Celoobrazovkový režim (skryje spodní lištu). */
export function useImmersive() {
  useEffect(() => { document.body.classList.add('immersive'); return () => document.body.classList.remove('immersive'); }, []);
}

// ---------- toast ----------
let toastSet = null;
export function toast(msg, ms = 2600) { toastSet && toastSet({ msg, until: Date.now() + ms }); }
export function ToastHost() {
  const [t, set] = useState(null);
  toastSet = set;
  useEffect(() => { if (!t) return; const id = setTimeout(() => set(null), t.until - Date.now()); return () => clearTimeout(id); }, [t]);
  return t ? html`<div class="toast" role="status">${t.msg}</div>` : null;
}

export function TopBar({ title, sub, onBack, backTo = '/', right }) {
  return html`<div class="topbar">
    <button class="back" aria-label="Zpět" onClick=${() => (onBack ? onBack() : back(backTo))}>←</button>
    <div class="grow"><h2 class="ellipsis">${title}</h2>${sub ? html`<div class="small muted ellipsis">${sub}</div>` : null}</div>
    ${right || null}
  </div>`;
}

export function Stars({ n = 0, max = 3 }) {
  return html`<span class="stars" aria-label=${`${n} z ${max} hvězdiček`}>${Array.from({ length: max }, (_, i) => html`<span class=${i < n ? '' : 'off'}>★</span>`)}</span>`;
}

export function Toggle({ label, sub, on, onChange }) {
  return html`<div class="toggle" role="switch" aria-checked=${on ? 'true' : 'false'} tabindex="0" onClick=${() => onChange(!on)}>
    <div class="grow"><div style="font-weight:700">${label}</div>${sub ? html`<div class="small muted">${sub}</div>` : null}</div>
    <div class=${'switch' + (on ? ' on' : '')}></div>
  </div>`;
}

export function Seg({ options, value, onChange }) {
  return html`<div class="seg" role="tablist">${options.map(([v, l]) => html`<button role="tab" aria-selected=${v === value} class=${v === value ? 'on' : ''} onClick=${() => onChange(v)}>${l}</button>`)}</div>`;
}

export function Sheet({ onClose, children }) {
  return html`<div class="overlay" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="sheet" role="dialog"><div class="grip"></div>${children}</div>
  </div>`;
}

export function scoreColor(s) { return scoreHex(s); }
export function scoreClass(s) { return s >= 85 ? 'c-good' : s >= 65 ? 'c-acc' : s >= 45 ? 'c-warn' : 'c-bad'; }

export function ScoreRing({ score, label, size = 180 }) {
  const r = 52, c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf, t0;
    const step = (t) => { t0 = t0 || t; const p = Math.min(1, (t - t0) / 900); setShown(Math.round(score * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  return html`<div class="ring" style=${`width:${size}px;height:${size}px`}>
    <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r=${r} fill="none" stroke="#eeece7" stroke-width="9"/>
      <circle cx="60" cy="60" r=${r} fill="none" stroke=${scoreColor(score)} stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${(c * shown) / 100} ${c}`}/></svg>
    <div class="v"><div class="num">${shown}</div><div class="lab" style=${`color:${scoreColor(score)}`}>${label}</div></div>
  </div>`;
}

/** Úroveň mikrofonu s varováním (tichý / přebuzený / hlučno). */
export function LevelMeter({ showText = true }) {
  const [lv, setLv] = useState({ db: -90, floor: -90, peak: 0 });
  const acc = useRef({ db: -90, floor: -90, peak: 0, n: 0 });
  useFrames((frames, peak) => {
    const f = frames[frames.length - 1];
    acc.current = { db: f.db, floor: f.floorDb, peak: Math.max(acc.current.peak * 0.9, peak) };
  });
  useInterval(() => setLv({ ...acc.current }), 80);
  const pct = Math.max(0, Math.min(100, ((lv.db + 70) / 70) * 100));
  let msg = '', cls = 'muted';
  if (engine.mic.status !== 'on' && !engine.testSource) { msg = 'Mikrofon není zapnutý.'; cls = 'c-warn'; }
  else if (lv.peak > 0.98) { msg = 'Přebuzeno! Oddal mikrofon nebo zpívej tišeji.'; cls = 'c-bad'; }
  else if (lv.floor > -42) { msg = 'Hlučné prostředí – detekce může chybovat.'; cls = 'c-warn'; }
  else if (lv.db < -55) { msg = 'Ticho… zazpívej něco.'; cls = 'muted'; }
  else if (lv.db < -42) { msg = 'Signál je slabý – přibliž mikrofon k ústům.'; cls = 'c-warn'; }
  else { msg = 'Úroveň je v pořádku.'; cls = 'c-good'; }
  return html`<div>
    <div class="meter" aria-label="Úroveň mikrofonu"><i style=${`width:${pct}%`}></i><b style=${`left:${Math.max(0, Math.min(100, ((lv.floor + 70) / 70) * 100))}%`}></b></div>
    ${showText ? html`<div class=${'small mt8 ' + cls}>${msg}</div>` : null}
  </div>`;
}

export function fmtNote(midi, keyPc) {
  const st = state.settings.notation;
  if (midi == null) return '–';
  return noteName(midi, { style: st, keyPc: st === 'solf' ? keyPc ?? 0 : undefined, octave: st !== 'solf' });
}
export function fmtTime(sec) { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
export function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch { return iso; } }

/** Hlídá mikrofon: pokud není zapnutý, nabídne zapnutí (gesto). */
export function MicGate({ children, compact = false }) {
  const [st, setSt] = useState(engine.mic.status);
  const [err, setErr] = useState(engine.mic.error);
  const start = async () => {
    try { setSt('starting'); await engine.startMic(state.settings.micDeviceId); setSt('on'); setErr(null); }
    catch (e) { setSt(engine.mic.status); setErr(e.message); }
  };
  const [ctxState, setCtxState] = useState(engine.ctx?.state);
  useEffect(() => {
    if (engine.mic.status !== 'on' && !engine.testSource) start();
    const iv = setInterval(() => setCtxState(engine.ctx?.state), 500);
    return () => clearInterval(iv);
  }, []);
  if ((st === 'on' || engine.testSource) && ctxState === 'suspended') {
    return html`<div class="card infoc center"><p class="small">Prohlížeč čeká na klepnutí, než pustí zvuk.</p>
      <button class="btn primary block" onClick=${async () => { await engine.ctx.resume().catch(() => {}); setCtxState(engine.ctx.state); }}>▶ Spustit zvuk</button></div>`;
  }
  if (st === 'on' || engine.testSource) return children;
  return html`<div class=${compact ? 'card tight' : 'card'}>
    <div style="font-weight:800" class="mb8">${st === 'starting' ? 'Spouštím mikrofon…' : 'Potřebuji mikrofon'}</div>
    ${err ? html`<p class="small c-warn">${err}</p>` : html`<p class="small muted">Zvuk zůstává jen v telefonu, nic se nikam neposílá.</p>`}
    <button class="btn primary block" onClick=${start}>🎙️ Zapnout mikrofon</button>
  </div>`;
}

export function Empty({ icon = '🎵', title, text, action }) {
  return html`<div class="card center col" style="align-items:center;padding:28px 16px"><div style="font-size:44px">${icon}</div><h3>${title}</h3>${text ? html`<p class="muted small">${text}</p>` : null}${action || null}</div>`;
}

/** Výběr mikrofonu (s doporučením pro Bluetooth sluchátka). */
export function MicSelect({ onChange }) {
  const [inputs, setInputs] = useState([]);
  const [cur, setCur] = useState(state.settings.micDeviceId || '');
  useEffect(() => { engine.listInputs().then(setInputs).catch(() => {}); }, [engine.mic.status]);
  const pick = async (id) => {
    setCur(id);
    await saveSettings({ micDeviceId: id || null });
    try { await engine.startMic(id || null); } catch (e) { toast(e.message); }
    onChange && onChange();
  };
  return html`<label class="field">Mikrofon<select value=${cur} onChange=${(e) => pick(e.target.value)}>
    <option value="">Výchozí (systém)</option>${inputs.map((d) => html`<option value=${d.deviceId}>${d.label}</option>`)}</select></label>`;
}

/** Název právě používaného mikrofonu (obnovuje se). */
export function MicLabel() {
  const [, f] = useState(0);
  useInterval(() => f((x) => x + 1), 1000);
  return html`<b>${engine.mic.label || '–'}</b>`;
}
