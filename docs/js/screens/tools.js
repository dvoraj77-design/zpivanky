// Nástroje: metronom, referenční tón + bourdon, klavír na obrazovce, volné stupnice v libovolné tónině, sluchový trénink.
import { html, useState, useEffect, useRef, useAppState, navigate, TopBar, Seg, fmtNote, Toggle, toast } from '../ui/common.js';
import { engine } from '../audio/engine.js';
import { Transport } from '../audio/transport.js';
import { metronomeEvents } from '../core/accomp.js';
import { state } from '../state.js';
import { keyName, SCALES, SCALE_NAMES, intervalName, noteName, degreeToSemis } from '../core/music.js';
import { RunScreen } from './run.js';
import { EarQuiz } from './ear.js';
import { exerciseSessionOpts } from '../app/builders.js';
import { buildExercise } from '../core/exercises.js';
import { saveAttempt } from '../app/record.js';
import { recordAttempt } from '../core/progress.js';
import { saveProgress } from '../state.js';

export function ToolsScreen() {
  const items = [['/tools/metronome', '⏱️', 'Metronom', 'Tempo 40–200, zvýrazněná první doba'], ['/tools/drone', '🎵', 'Referenční tón a bourdon', 'Držený tón jako opora'], ['/tools/piano', '🎹', 'Klavír', 'Zahraj si tón nebo interval'], ['/tools/scales', '🪜', 'Stupnice', 'Volné cvičení v libovolné tónině'], ['/ear', '👂', 'Sluchový trénink', 'Intervaly a melodie'], ['/tuner', '🎯', 'Ladička', 'Živá výška hlasu']];
  return html`<div class="screen"><${TopBar} title="Nástroje" backTo="/me" />
    <div class="list">${items.map(([h, i, t, s]) => html`<a class="item" href=${'#' + h}><div class="ic">${i}</div><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><div class="chev">›</div></a>`)}</div></div>`;
}

export function MetronomeScreen() {
  const [bpm, setBpm] = useState(80);
  const [bpb, setBpb] = useState(4);
  const [on, setOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const tr = useRef(null);
  const taps = useRef([]);
  useEffect(() => () => tr.current?.stop(), []);
  const start = async (b = bpm, m = bpb) => {
    await engine.ensureContext();
    tr.current?.stop();
    const t = new Transport(engine);
    t.load({ events: metronomeEvents(0, 4000, m), tempo: b, length: 4000 });
    t.start(0, 0.1);
    tr.current = t; setOn(true);
  };
  useEffect(() => { if (!on) return; const id = setInterval(() => setBeat(Math.floor(tr.current?.currentBeat() ?? -1)), 40); return () => clearInterval(id); }, [on]);
  const stop = () => { tr.current?.stop(); setOn(false); setBeat(-1); };
  const change = (b) => { const v = Math.max(40, Math.min(200, b)); setBpm(v); if (on) start(v); };
  const tap = () => {
    const now = performance.now(); taps.current = taps.current.filter((t) => now - t < 3000); taps.current.push(now);
    if (taps.current.length >= 3) { const d = (taps.current[taps.current.length - 1] - taps.current[0]) / (taps.current.length - 1); change(Math.round(60000 / d)); }
  };
  return html`<div class="screen"><${TopBar} title="Metronom" backTo="/tools" />
    <div class="card center"><div style="font-size:72px;font-weight:900">${bpm}</div><div class="muted">BPM</div>
      <div class="row mt16" style="justify-content:center;gap:8px">${Array.from({ length: bpb }, (_, i) => html`<div style=${`width:28px;height:28px;border-radius:14px;background:${on && beat >= 0 && beat % bpb === i ? (i === 0 ? '#f0a35e' : '#a8dcc9') : '#eeece7'}`}></div>`)}</div>
      <input class="mt16" type="range" min="40" max="200" value=${bpm} onInput=${(e) => change(parseInt(e.target.value, 10))} aria-label="Tempo" />
      <div class="row" style="justify-content:center"><button class="btn" onClick=${() => change(bpm - 5)}>−5</button><button class="btn" onClick=${() => change(bpm - 1)}>−1</button><button class="btn" onClick=${() => change(bpm + 1)}>+1</button><button class="btn" onClick=${() => change(bpm + 5)}>+5</button></div>
    </div>
    <div class="mt16"><${Seg} options=${[[2, '2/4'], [3, '3/4'], [4, '4/4'], [6, '6/8']]} value=${bpb} onChange=${(v) => { setBpb(v); if (on) start(bpm, v); }} /></div>
    <button class="btn block mt16" onClick=${tap}>👆 Ťukej do rytmu (tap tempo)</button>
    <div class="bottom-actions"><button class=${'btn big block ' + (on ? '' : 'primary')} onClick=${() => (on ? stop() : start())}>${on ? '■ Stop' : '▶ Start'}</button></div>
  </div>`;
}

export function DroneScreen() {
  const [note, setNote] = useState(state.profile.workingTonic);
  const [on, setOn] = useState(false);
  const [fifth, setFifth] = useState(true);
  useEffect(() => () => engine.drone?.stop(), []);
  const apply = async (n = note, f = fifth, o = on) => { await engine.ensureContext(); if (o) engine.drone.start(n, { fifth: f }); else engine.drone.stop(); };
  return html`<div class="screen"><${TopBar} title="Referenční tón a bourdon" backTo="/tools" />
    <div class="card center"><div class="small muted">Tón</div><div style="font-size:64px;font-weight:900">${fmtNote(note)}</div><div class="small muted">${(440 * Math.pow(2, (note - 69) / 12)).toFixed(1)} Hz</div>
      <div class="row mt16" style="justify-content:center"><button class="btn" onClick=${() => { setNote(note - 12); apply(note - 12); }}>−8va</button><button class="btn" onClick=${() => { setNote(note - 1); apply(note - 1); }}>−</button><button class="btn" onClick=${() => { setNote(note + 1); apply(note + 1); }}>＋</button><button class="btn" onClick=${() => { setNote(note + 12); apply(note + 12); }}>+8va</button></div></div>
    <div class="card mt16"><${Toggle} label="Přidat kvintu" on=${fifth} onChange=${(v) => { setFifth(v); apply(note, v); }} /></div>
    <div class="col mt16"><button class="btn block" onClick=${() => engine.previewNote(note, 2)}>🔊 Krátký referenční tón (klavír)</button>
      <button class="btn block" onClick=${() => engine.previewNote(note, 2.5, 'guide')}>🔊 Referenční tón (hlas)</button>
      <button class="btn block" onClick=${() => setNote(state.profile.workingTonic)}>Pracovní tónika (${fmtNote(state.profile.workingTonic)})</button></div>
    <div class="bottom-actions"><button class=${'btn big block ' + (on ? '' : 'primary')} onClick=${() => { const o = !on; setOn(o); apply(note, fifth, o); }}>${on ? '■ Zastavit bourdon' : '▶ Hrát bourdon'}</button></div>
  </div>`;
}

export function PianoScreen() {
  const [base, setBase] = useState(Math.floor((state.profile.workingTonic - 2) / 12) * 12);
  const [last, setLast] = useState([]);
  const press = (m) => { engine.previewNote(m, 1.5); setLast((l) => [...l.slice(-1), m]); };
  const whites = [];
  for (let m = base; m < base + 24; m++) if ([0, 2, 4, 5, 7, 9, 11].includes(m % 12)) whites.push(m);
  whites.push(base + 24);
  const wW = 100 / whites.length;
  const blacks = [];
  whites.forEach((w, i) => { if ([0, 2, 5, 7, 9].includes(w % 12) && w + 1 < base + 24) blacks.push({ m: w + 1, left: (i + 1) * wW - wW * 0.3 }); });
  const iv = last.length === 2 ? last[1] - last[0] : null;
  return html`<div class="screen"><${TopBar} title="Klavír" backTo="/tools" />
    <div class="row between mb8"><button class="btn sm" onClick=${() => setBase(base - 12)}>◀ oktáva</button><b>${fmtNote(base)}–${fmtNote(base + 24)}</b><button class="btn sm" onClick=${() => setBase(base + 12)}>oktáva ▶</button></div>
    <div class="kbd">${whites.map((m) => html`<div class=${'w' + (last[last.length - 1] === m ? ' on' : '')} onPointerDown=${(e) => { e.preventDefault(); press(m); }}>${noteName(m, { style: state.settings.notation === 'solf' ? 'cz' : state.settings.notation, octave: m % 12 === 0 })}</div>`)}
      ${blacks.map((b) => html`<div class=${'b' + (last[last.length - 1] === b.m ? ' on' : '')} style=${`left:${b.left}%;width:${wW * 0.6}%`} onPointerDown=${(e) => { e.preventDefault(); press(b.m); }}></div>`)}</div>
    <div class="card mt16 center">${last.length ? html`<div>Poslední: <b>${last.map((m) => fmtNote(m)).join(' → ')}</b></div>${iv != null ? html`<div class="c-acc mt8" style="font-weight:800">${iv === 0 ? 'prima' : intervalName(iv) + (iv > 0 ? ' nahoru' : ' dolů')}</div>` : null}` : html`<span class="muted">Klepni na klávesu. Dva tóny po sobě ukážou interval.</span>`}</div>
    <div class="tiny dim mt8">Tvůj pohodlný rozsah: ${fmtNote(state.profile.comfortLow)}–${fmtNote(state.profile.comfortHigh)}</div>
  </div>`;
}

export function ScalesScreen() {
  const [tonic, setTonic] = useState(state.profile.workingTonic);
  const [scale, setScale] = useState('major');
  const [pattern, setPattern] = useState('5');
  const [tempo, setTempo] = useState(88);
  const [run, setRun] = useState(null);
  const pats = { '3': [1, 2, 3, 2, 1], '5': [1, 2, 3, 4, 5, 4, 3, 2, 1], '8': [1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1], arp: [1, 3, 5, 8, 5, 3, 1] };
  if (run) return html`<${RunScreen} key=${run} opts=${run} title="Stupnice" sub=${`${keyName(tonic % 12, state.settings.notation === 'solf' ? 'cz' : state.settings.notation)} · ${SCALE_NAMES[scale]}`} onExit=${() => setRun(null)}
    onResult=${(r) => saveAttempt(r, { type: 'tool', id: 'scales', title: 'Stupnice', opts: run })} />`;
  const startRun = () => {
    const degs = pats[pattern].filter((d) => scale !== 'pentatonic' || true);
    const offsets = degs.map((d) => degreeToSemis(d, SCALES[scale]));
    const top = tonic + Math.max(...offsets);
    if (top > state.profile.highChest || tonic < state.profile.low) { toast('Tahle poloha je mimo tvůj změřený rozsah – zvol nižší tóniku.'); return; }
    const plan = buildExercise({ type: 'scale', degrees: degs, durs: degs.map((_, i) => (i === degs.length - 1 ? 2 : 1)), reps: 3, tempo, scale, extended: true }, { ...state.profile, workingTonic: tonic, comfortLow: Math.min(state.profile.comfortLow, tonic), comfortHigh: Math.max(state.profile.comfortHigh, Math.min(state.profile.highChest, top + 2)) });
    setRun(exerciseSessionOpts(plan));
  };
  return html`<div class="screen"><${TopBar} title="Stupnice" backTo="/tools" />
    <div class="card center"><div class="small muted">Tónika</div><div style="font-size:44px;font-weight:900">${fmtNote(tonic)}</div>
      <div class="row" style="justify-content:center"><button class="btn" onClick=${() => setTonic(tonic - 1)}>−</button><button class="btn" onClick=${() => setTonic(tonic + 1)}>＋</button></div></div>
    <label class="field mt16">Stupnice<select value=${scale} onChange=${(e) => setScale(e.target.value)}>${Object.entries(SCALE_NAMES).filter(([k]) => k !== 'chromatic').map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></label>
    <div class="mt16"><${Seg} options=${[['3', '1–3'], ['5', '1–5'], ['8', '1–8'], ['arp', 'Arpeggio']]} value=${pattern} onChange=${setPattern} /></div>
    <label class="field mt16">Tempo ${tempo} BPM<input type="range" min="50" max="160" value=${tempo} onInput=${(e) => setTempo(parseInt(e.target.value, 10))} /></label>
    <button class="btn block mt16" onClick=${() => { const degs = pats[pattern]; engine.previewSequence(degs.map((d, i) => ({ midi: tonic + degreeToSemis(d, SCALES[scale]), t: i, d: 0.9 })), 60 / tempo, 'piano'); }}>🔊 Poslechnout</button>
    <div class="bottom-actions"><button class="btn primary big block" onClick=${startRun}>▶ Zpívat (3× po půltónech)</button></div>
  </div>`;
}

export function EarHub() {
  const [quiz, setQuiz] = useState(null);
  const sets = [
    ['Sekunda nebo tercie', { type: 'earInterval', intervals: [2, 4], count: 8 }],
    ['Malá nebo velká tercie (moll/dur)', { type: 'earInterval', intervals: [3, 4], count: 8 }],
    ['Kvarta, kvinta, oktáva', { type: 'earInterval', intervals: [5, 7, 12], count: 9 }],
    ['Všechny základní intervaly', { type: 'earInterval', intervals: [2, 3, 4, 5, 7, 9, 12], count: 10 }],
    ['Souzvuky (harmonicky)', { type: 'earInterval', intervals: [3, 4, 7, 12], count: 8, harmonic: true }],
  ];
  const melody = [['Krátké melodie – zazpívej zpět', { type: 'callResponse', degrees: [1, 3, 2], durs: [1, 1, 2], reps: 4, tempo: 80, syl: 'la', direction: 'updown' }], ['Delší melodie se skoky', { type: 'callResponse', degrees: [1, 5, 3, 4, 2, 1], durs: [1, 1, 1, 1, 1, 2], reps: 3, tempo: 80, syl: 'la' }]];
  if (quiz?.kind === 'ear') return html`<${EarQuiz} spec=${quiz.spec} title=${quiz.title} onExit=${() => setQuiz(null)} onResult=${async (r) => { const b = recordAttempt(state.progress, { type: 'ear', id: 'ear', score: r.overall, seconds: r.seconds }); await saveProgress(); return { badges: b }; }} />`;
  if (quiz?.kind === 'sing') return html`<${RunScreen} opts=${quiz.opts} title=${quiz.title} sub="Sluchový trénink" onExit=${() => setQuiz(null)} onResult=${(r) => saveAttempt(r, { type: 'tool', id: 'ear-sing', title: quiz.title, opts: quiz.opts })} />`;
  return html`<div class="screen"><${TopBar} title="Sluchový trénink" backTo="/me" />
    <div class="section-title">Poznej interval</div>
    <div class="list">${sets.map(([t, spec]) => html`<button class="item" onClick=${() => setQuiz({ kind: 'ear', spec, title: t })}><div class="ic">👂</div><div class="grow t">${t}</div><div class="chev">›</div></button>`)}</div>
    <div class="section-title">Slyš a zazpívej</div>
    <div class="list">${melody.map(([t, spec]) => html`<button class="item" onClick=${() => setQuiz({ kind: 'sing', title: t, opts: exerciseSessionOpts(buildExercise(spec, state.profile, { seed: Date.now() })) })}><div class="ic">🎤</div><div class="grow t">${t}</div><div class="chev">›</div></button>`)}</div>
  </div>`;
}
