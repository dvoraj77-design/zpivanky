// Obrazovka zpěvu (cvičení i písně) a výsledky.
import { html, useState, useEffect, useRef, useWakeLock, useInterval, ScoreRing, Stars, Sheet, toast, fmtNote, fmtTime, scoreClass, MicGate, Seg, useImmersive } from '../ui/common.js';
import { C, scoreHex } from '../ui/theme.js';
import { PitchRoll, viewRange } from '../ui/pitchroll.js';
import { DeviationChart, DynChart } from '../ui/charts.js';
import { Session, BreathSession } from '../app/session.js';
import { playAttempt, renderMixWav, voiceWav } from '../app/playback.js';
import { downloadBlob } from '../audio/wav.js';
import { engine } from '../audio/engine.js';
import { state, saveSettings, hpProfile } from '../state.js';
import { centsText } from '../core/scoring.js';
import { noHeadphones } from '../app/builders.js';

/**
 * props: { opts (Session), title, sub, onExit, onResult(result, session) → Promise<{stars?, badges?}>, next?: {label, go}, karaoke?: lyrics[], allowMix, autoStart }
 */
export function RunScreen(props) {
  const { opts, title, sub, onExit } = props;
  const [phase, setPhase] = useState('ready');
  const [result, setResult] = useState(null);
  const [extra, setExtra] = useState(null);
  const [, force] = useState(0);
  const [showMix, setShowMix] = useState(false);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState(props.karaoke && state.settings.view === 'karaoke' ? 'karaoke' : 'roll');
  const sessRef = useRef(null);
  const model = useRef(null);
  useWakeLock(phase === 'running');
  useImmersive();

  const range = viewRange(opts.items, 12);
  const build = () => {
    const s = new Session({ ...opts });
    sessRef.current = s;
    model.current = {
      beat: () => (s.state === 'idle' ? Math.max(0, (s.targets[0]?.t ?? opts.countIn) - 1.2) : s.displayBeat()),
      items: s.items, curve: s.curve, lo: range.lo, hi: range.hi, keyPc: opts.keyPc, notation: state.settings.notation,
      pxPerBeat: Math.max(46, Math.min(90, 3200 / (opts.tempo || 80))), hideCurve: !!opts.hideCurve, tol: opts.tol, live: s.live, bpb: opts.bpb, results: s.results,
    };
    s.onChange(() => { model.current.curve = s.curve; model.current.live = s.live; model.current.results = s.results; });
    return s;
  };
  if (!sessRef.current) build();

  const start = async () => {
    const s = sessRef.current.state === 'idle' ? sessRef.current : build();
    applyMix();
    setPhase('running');
    try { await s.start(); } catch (e) { toast('Spuštění se nepovedlo: ' + e.message); setPhase('ready'); return; }
    s.onChange(async (ss) => {
      if (ss.state === 'done' && ss.result && !ss._handled) {
        ss._handled = true;
        if (ss.aborted) return;
        if (window.zpTest) window.zpTest.lastResult = ss.result;
        setResult(ss.result);
        setPhase('result');
        if (props.onResult) { try { setExtra(await props.onResult(ss.result, ss)); } catch (e) { console.error(e); } }
      }
    });
  };
  useEffect(() => { if (props.autoStart) start(); return () => { const s = sessRef.current; if (s && s.state === 'running') s.stop(); }; }, []);
  useInterval(() => force((x) => x + 1), phase === 'running' ? 120 : null);

  const applyMix = () => {
    const m = state.settings.mix;
    if (!engine.bus) return;
    engine.bus.accomp.gain.value = m.accomp; engine.bus.guide.gain.value = m.guide; engine.bus.metro.gain.value = m.metro;
    engine.setMonitor(m.monitor > 0, m.monitor);
  };
  const stopNow = async () => {
    const s = sessRef.current;
    if (s.state === 'running') {
      const r = await s.finish(false);
      if (window.zpTest) window.zpTest.lastResult = r;
      setResult(r); setPhase('result');
      if (props.onResult && !s._handled) { s._handled = true; try { setExtra(await props.onResult(r, s)); } catch (e) { console.error(e); } }
    }
  };
  const abort = () => { const s = sessRef.current; if (s?.state === 'running') s.stop(); engine.setMonitor(false); onExit && onExit(); };
  const togglePause = () => {
    const s = sessRef.current; if (!s || s.state !== 'running') return;
    if (paused) { s.transport.resume(); setPaused(false); } else { s.transport.pause(); setPaused(true); }
  };

  if (phase === 'result' && result) {
    return html`<${ResultView} result=${result} opts=${opts} title=${title} extra=${extra} next=${props.next} onExit=${onExit}
      onRetry=${() => { sessRef.current = null; build(); setResult(null); setExtra(null); setPhase('ready'); }} />`;
  }

  const s = sessRef.current;
  const beat = s.state === 'idle' ? 0 : s.displayBeat();
  const firstTarget = s.targets[0];
  const countStart = props.countFrom ?? (firstTarget ? Math.max(0, firstTarget.t - opts.bpb) : 0);
  let countdown = null;
  if (phase === 'running' && firstTarget && beat >= countStart - 0.01 && beat < firstTarget.t) countdown = Math.max(1, Math.ceil(firstTarget.t - beat));
  if (phase === 'running' && beat < 0) countdown = opts.countIn;
  const curT = s.targets.find((t) => beat >= t.t && beat < t.t + t.d) || s.targets.find((t) => t.t > beat);
  const phrases = [...new Set(s.targets.map((t) => t.phrase))];
  const curPhrase = curT ? phrases.indexOf(curT.phrase) + 1 : phrases.length;
  const spb = 60 / (opts.tempo * (opts.factor || 1));
  const total = (Math.max(...s.items.map((i) => i.t + i.d)) + 0.5) * spb;
  const live = s.live;

  return html`<div class="player">
    <div class="row">
      <button class="back" aria-label="Zavřít" onClick=${abort}>✕</button>
      <div class="grow"><div class="small muted ellipsis">${sub || ''}</div><div style="font-weight:900;font-size:19px" class="ellipsis">${title}</div></div>
      ${props.karaoke ? html`<button class="iconbtn" aria-label="Přepnout zobrazení" onClick=${() => { const v = view === 'roll' ? 'karaoke' : 'roll'; setView(v); saveSettings({ view: v }); }}>${view === 'roll' ? '🎤' : '🎼'}</button>` : null}
      ${props.allowMix ? html`<button class="iconbtn" aria-label="Mixážní pult" onClick=${() => setShowMix(true)}>🎚️</button>` : null}
    </div>
    ${noHeadphones() && phase === 'ready' ? html`<div class="card warnc small">🔈 Hraješ z reproduktoru – použiju režim „poslechni → zazpívej“: nejdřív zazní, pak zpíváš sám.</div>` : null}
    <div class="stage">
      ${view === 'karaoke' && props.karaoke ? html`<${Karaoke} lines=${props.karaoke} beat=${beat} items=${s.items} offset=${opts.countIn} />` : html`<${PitchRoll} model=${model} />`}
      ${countdown ? html`<div class="countdown">${countdown}</div>` : null}
      ${opts.hideCurve && phase === 'running' ? html`<div class="small muted" style="position:absolute;top:8px;right:12px">🙈 Naslepo – křivku uvidíš až ve výsledku</div>` : null}
    </div>
    <div class="row between">
      <div class="small">${curT ? html`Cíl: <b>${fmtNote(curT.midi, opts.keyPc)}</b>` : ' '}</div>
      <div class=${'small ' + (live.status === 'ok' ? 'c-good' : live.status === 'near' ? 'c-warn' : live.status === 'off' ? 'c-bad' : 'dim')} style="font-weight:800">
        ${opts.hideCurve ? '' : live.dev != null ? `${live.status === 'ok' ? '● ' : live.dev > 0 ? '▲ ' : '▼ '}${centsText(live.dev)}` : live.midi == null && phase === 'running' ? 'neslyším tě' : ''}
      </div>
    </div>
    <div class="progress-seg">${phrases.map((p, i) => {
      const ns = s.targets.filter((t) => t.phrase === p);
      const st = ns.map((t) => s.results[t.ri]).filter(Boolean);
      const col = i + 1 < curPhrase ? C.goodFill : i + 1 === curPhrase && phase === 'running' ? C.curve : '#e9e6df';
      return html`<i style=${`background:${col}`}></i>`;
    })}</div>
    <div class="row between small muted"><span>${fmtTime(Math.max(0, beat * spb))}</span><span style="font-weight:800;color:var(--text)">${phrases.length > 1 ? `Fráze ${Math.min(curPhrase, phrases.length)} / ${phrases.length}` : ''}</span><span>${fmtTime(total)}</span></div>
    ${phase === 'ready' ? html`<${MicGate} compact=${true}><button class="btn primary big block" onClick=${start}>▶ Začít</button></${MicGate}>
      <div class="tiny dim center">${hpProfile()?.name || ''} · zpoždění ${hpProfile()?.latencyMs ?? 0} ms</div>`
      : html`<div class="row"><button class="btn" style="flex:1" onClick=${togglePause}>${paused ? '▶ Pokračovat' : '⏸ Pauza'}</button><button class="btn primary" style="flex:1" onClick=${stopNow}>■ Hotovo</button></div>`}
    ${showMix ? html`<${MixSheet} onClose=${() => { setShowMix(false); applyMix(); }} onChange=${applyMix} />` : null}
  </div>`;
}

function Karaoke({ lines, beat, items, offset }) {
  const b = beat - offset;
  let idx = lines.findIndex((l) => b < l.end);
  if (idx < 0) idx = lines.length - 1;
  const cur = lines[idx], nxt = lines[idx + 1];
  const notes = items.filter((i) => !i.listen && i.note && i.t - offset >= cur.start - 1e-6 && i.t - offset < cur.end + 1e-6);
  return html`<div class="karaoke">
    <div class="cur">${notes.length ? notes.map((n) => {
      const t = n.t - offset;
      const cls = b >= t + n.d ? 'sung' : b >= t ? 'now' : '';
      const syl = n.syl || '';
      return html`<span class=${cls}>${syl.endsWith('-') ? syl.slice(0, -1) : syl + ' '}</span>`;
    }) : cur?.text}</div>
    ${nxt ? html`<div class="nxt">${nxt.text}</div>` : null}
  </div>`;
}

export function MixSheet({ onClose, onChange }) {
  const [m, setM] = useState({ ...state.settings.mix });
  const set = (k, v) => { const n = { ...m, [k]: v }; setM(n); saveSettings({ mix: n }).then(() => onChange && onChange()); };
  const row = (k, label, sub) => html`<div class="mt16"><div class="row between"><b>${label}</b><span class="small muted">${Math.round(m[k] * 100)} %</span></div>${sub ? html`<div class="tiny dim">${sub}</div>` : null}
    <input type="range" min="0" max="1" step="0.05" value=${m[k]} onInput=${(e) => set(k, parseFloat(e.target.value))} aria-label=${label} /></div>`;
  return html`<${Sheet} onClose=${onClose}>
    <h2>Mixážní pult</h2>
    ${row('accomp', 'Doprovod')}
    <div class="mt16 row between"><b>Vodicí melodie (Singer)</b>
      <${Seg} options=${[['on', 'ON'], ['off', 'OFF']]} value=${m.guide > 0 ? 'on' : 'off'} onChange=${(v) => set('guide', v === 'on' ? 0.7 : 0)} /></div>
    ${row('guide', 'Hlasitost vodicí melodie')}
    ${row('metro', 'Metronom')}
    ${row('monitor', 'Příposlech vlastního hlasu', 'Jen se sluchátky! Na Androidu má příposlech zpoždění, u Bluetooth velké.')}
    <button class="btn block mt16" onClick=${onClose}>Hotovo</button>
  </${Sheet}>`;
}

export function ResultView({ result, opts, title, extra, next, onRetry, onExit }) {
  const [playing, setPlaying] = useState(null);
  const stopRef = useRef(null);
  const stop = () => { stopRef.current?.stop(); stopRef.current = null; setPlaying(null); };
  useEffect(() => () => stopRef.current?.stop(), []);
  const play = async (key, o) => {
    stop();
    const h = await playAttempt(opts, result.recording, o);
    stopRef.current = h; setPlaying(key);
    const spb = 60 / (opts.tempo * (opts.factor || 1));
    const end = o.toBeat ?? (Math.max(...opts.items.map((i) => i.t + i.d)) + opts.countIn + 1);
    setTimeout(() => { if (stopRef.current === h) setPlaying(null); }, (end - (o.fromBeat || 0)) * spb * 1000 + 400);
  };
  const playPhrase = (p) => {
    const notes = p.notes || [];
    if (!notes.length) return;
    const spb = 60 / (opts.tempo * (opts.factor || 1));
    const from = Math.max(0, notes[0].start / spb - 0.5), to = notes[notes.length - 1].end / spb + 0.3;
    play('p' + p.index, { fromBeat: from, toBeat: to, voice: !!result.recording });
  };
  const exportWav = async (withAccomp) => {
    try {
      toast('Připravuji soubor…');
      const blob = withAccomp ? await renderMixWav(opts, result.recording) : voiceWav(result.recording);
      const name = `zpivanky-${(title || 'nahravka').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.wav`;
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: 'audio/wav' })] }) && withAccomp === 'share') {
        await navigator.share({ files: [new File([blob], name, { type: 'audio/wav' })], title });
      } else { downloadBlob(blob, name); toast('Uloženo do Stažených souborů.'); }
    } catch (e) { toast('Export se nepovedl: ' + e.message); }
  };
  const r = result;
  return html`<div class="screen full">
    <div class="topbar"><button class="back" aria-label="Zavřít" onClick=${() => { stop(); onExit && onExit(); }}>✕</button><h2 class="ellipsis">${title}</h2></div>
    <div class="center"><div class="small muted mb8">Celkem</div><${ScoreRing} score=${r.overall} label=${r.label} />
      <div class="mt8"><${Stars} n=${r.stars} /></div>
      <div class="small muted mt8">${r.kind === 'breath' ? `Výdrž ${r.duration.toFixed(1)} s · stabilita ${r.stability} %` : 'jak přesně jsi zasáhl cíl'}</div>
    </div>
    ${extra?.badges?.length ? html`<div class="card hero mt16 center"><div style="font-size:30px">🏅</div><b>Nový odznak: ${extra.badges.map((b) => b.title).join(', ')}</b></div>` : null}
    ${extra?.unlocked ? html`<div class="card infoc mt16 small">🔓 Odemkla se další lekce: <b>${extra.unlocked}</b></div>` : null}
    <div class="pill-tip mt16">💡 ${r.tip}</div>
    ${r.pitch != null || r.rhythm != null ? html`<div class="grid2 mt16">
      ${r.pitch != null ? html`<div class="stat"><div class="k">Přesnost výšky</div><div class=${'v ' + scoreClass(r.pitch)}>${r.pitch}</div></div>` : null}
      ${r.rhythm != null ? html`<div class="stat"><div class="k">Rytmus a nástupy</div><div class=${'v ' + scoreClass(r.rhythm)}>${r.rhythm}</div></div>` : null}
      ${r.dynamics != null ? html`<div class="stat"><div class="k">Dynamika</div><div class=${'v ' + scoreClass(r.dynamics)}>${r.dynamics}</div></div>` : null}
    </div>` : null}
    ${r.phrases?.length ? html`<div class="section-title">Kde se zaměřit</div><div class="card tight">
      <div class="row" style="gap:4px;height:10px;margin:4px 0 6px">${r.phrases.map((p) => html`<i style=${`flex:1;height:10px;border-radius:5px;background:${scoreHex(p.score)}`}></i>`)}</div>
      ${r.phrases.map((p) => html`<div class="phr"><div class=${'sc ' + scoreClass(p.score)}>${p.score}</div><div class="grow ellipsis">${p.label || `Fráze ${p.index + 1}`}</div>
        ${r.recording || opts.audio?.length ? html`<button class="iconbtn" aria-label="Přehrát frázi" onClick=${() => (playing === 'p' + p.index ? stop() : playPhrase(p))}>${playing === 'p' + p.index ? '■' : '▶'}</button>` : null}</div>`)}
    </div>` : null}
    ${r.kind !== 'rhythm' && r.kind !== 'breath' && r.notes?.length ? html`<div class="section-title">Přesnost po notách</div><div class="card tight"><${DeviationChart} notes=${r.notes} tol=${opts.tol} keyPc=${opts.keyPc} /></div>` : null}
    ${r.kind === 'rhythm' ? html`<div class="section-title">Nástupy</div><div class="card tight small">${r.notes.map((n) => html`<div class="phr"><span class=${n.status === 'ok' ? 'c-good' : n.status === 'missed' ? 'c-bad' : 'c-warn'}>${n.status === 'ok' ? '●' : n.status === 'missed' ? '✕' : n.status === 'late' ? '▶' : '◀'}</span><span class="grow">Nástup ${n.i + 1}</span><span>${n.delay == null ? 'chybí' : n.status === 'ok' ? 'včas' : `${n.delay > 0 ? 'pozdě' : 'brzy'} o ${Math.round(Math.abs(n.delay) * 1000)} ms`}</span></div>`)}</div>` : null}
    ${r.dynCurve?.length ? html`<div class="section-title">Hlasitost proti cíli</div><div class="card tight"><${DynChart} curve=${r.dynCurve} /><div class="tiny dim mt8">Žlutý pás = cíl, zelená = tvá hlasitost.</div></div>` : null}
    ${r.recording ? html`<div class="section-title">Moje nahrávka</div><div class="col">
      <button class="btn block" onClick=${() => (playing === 'all' ? stop() : play('all', { fromBeat: 0 }))}>${playing === 'all' ? '■ Zastavit' : '▶ Přehrát mě proti cíli'}</button>
      <div class="row"><button class="btn sm grow" onClick=${() => exportWav(true)}>💾 WAV s doprovodem</button><button class="btn sm grow" onClick=${() => exportWav(false)}>💾 Jen hlas</button>
        ${navigator.share ? html`<button class="btn sm" aria-label="Sdílet nahrávku" onClick=${() => exportWav('share')}>📤</button>` : null}</div>
    </div>` : null}
    <div class="col mt24">
      ${next ? html`<button class="btn primary big block" onClick=${() => { stop(); next.go(); }}>${next.label}</button>` : null}
      <button class="btn block" onClick=${() => { stop(); onRetry(); }}>↻ Zkusit znovu</button>
    </div>
  </div>`;
}

/** Dechové cvičení („sss“) s časomírou. */
export function BreathRun({ target = 10, steady = false, title, onExit, onResult, next }) {
  const [sess, setSess] = useState(null);
  const [res, setRes] = useState(null);
  const [extra, setExtra] = useState(null);
  const [, force] = useState(0);
  useWakeLock(!!sess && !res);
  useImmersive();
  useInterval(() => force((x) => x + 1), sess && !res ? 100 : null);
  useEffect(() => () => sess?.state === 'running' && sess.finish(), [sess]);
  const doneRef = useRef(false);
  const start = async () => { doneRef.current = false; const s = new BreathSession({ targetSec: target, steady }); await s.start(3); setSess(s); };
  const done = async () => { if (doneRef.current) return; doneRef.current = true; const r = await sess.finish(); if (window.zpTest) window.zpTest.lastResult = r; setRes(r); if (onResult) setExtra(await onResult(r)); };
  useEffect(() => {
    if (!sess || res) return;
    const el = sess.elapsed();
    if (el > target + 7) done();
    // automatický konec po 1,5 s ticha po výdechu
    const recent = sess.frames.filter((f) => f.t > el - 1.5 && f.t <= el);
    const before = sess.frames.some((f) => f.t > 0.5 && (f.hiss || f.voiced));
    if (el > 2 && before && recent.length > 20 && recent.every((f) => !f.hiss && !f.voiced)) done();
  });
  if (res) return html`<${ResultView} result=${res} opts=${{ tol: 50, items: [], audio: [], tempo: 60, countIn: 0 }} title=${title} extra=${extra} next=${next} onExit=${onExit} onRetry=${() => { setSess(null); setRes(null); setExtra(null); }} />`;
  const el = sess ? sess.elapsed() : -3;
  const frames = sess?.frames || [];
  const last = frames[frames.length - 1];
  const on = last && (last.hiss || last.voiced);
  const dur = sess ? (() => { let best = 0, s0 = null, lastOn = null; for (const f of frames) { if (f.t < 0) continue; if (f.hiss || f.voiced) { if (s0 == null || f.t - lastOn > 0.35) s0 = f.t; lastOn = f.t; best = Math.max(best, lastOn - s0); } } return best; })() : 0;
  const pct = Math.min(100, (dur / target) * 100);
  return html`<div class="screen full">
    <div class="topbar"><button class="back" aria-label="Zavřít" onClick=${() => { sess?.finish(); onExit(); }}>✕</button><h2>${title}</h2></div>
    <div class="card center col" style="align-items:center">
      <div class="small muted">Cíl: ${target} s ${steady ? '· rovnoměrně' : ''}</div>
      <div style="font-size:72px;font-weight:900" class=${dur >= target ? 'c-good' : ''}>${dur.toFixed(1)} s</div>
      <div class="bar" style="width:100%;height:16px"><i style=${`width:${pct}%;background:${dur >= target ? 'var(--good)' : 'var(--accent)'}`}></i></div>
      <div class="mt8" style="font-weight:800;min-height:28px">${!sess ? 'Nadechni se a připrav se' : el < 0 ? `Nádech… ${Math.ceil(-el)}` : on ? '🌬️ sss… výborně, pokračuj' : dur > 0.5 ? 'Konec? Dokončím za chvilku.' : 'Teď vydechuj na „sss“'}</div>
      ${steady && last ? html`<div class="meter" style="width:100%"><i style=${`width:${Math.max(0, Math.min(100, ((last.db + 70) / 60) * 100))}%`}></i></div>` : null}
    </div>
    <p class="small muted mt16">Stůj rovně, nadechni se do břicha a boků. „Sss“ drž tiché a rovnoměrné – nejde o sílu, ale o délku a klid.</p>
    <div class="bottom-actions">${!sess ? html`<${MicGate} compact=${true}><button class="btn primary big block" onClick=${start}>▶ Začít</button></${MicGate}>` : html`<button class="btn primary big block" onClick=${done}>■ Hotovo</button>`}</div>
  </div>`;
}
