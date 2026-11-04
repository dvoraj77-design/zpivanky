// Já: rozcestník, pokrok, nahrávky, nastavení, záloha, diagnostika, o aplikaci.
import { html, useState, useEffect, useRef, useAppState, useFrames, useInterval, navigate, TopBar, Toggle, Seg, Sheet, toast, fmtDate, fmtTime, fmtNote, scoreClass, Empty, MicGate } from '../ui/common.js';
import { LineChart, RangeChart } from '../ui/charts.js';
import { state, saveSettings, saveProgress, loadState, allSongs } from '../state.js';
import { streak, bestStreak, totalMinutes, minutesOn, weakest, accuracyByWeek, BADGES, dayKey } from '../core/progress.js';
import { profileSummary, typeInfo } from '../core/voice.js';
import { NOTATIONS } from '../core/music.js';
import { STRICTNESS } from '../core/scoring.js';
import { STYLES } from '../core/accomp.js';
import { db } from '../store/db.js';
import { createBackup, restoreBackup, validateBackup } from '../core/backup.js';
import { engine } from '../audio/engine.js';
import { workerInfo, modelReady } from '../app/importer.js';
import { playAttempt, renderMixWav, voiceWav } from '../app/playback.js';
import { downloadBlob } from '../audio/wav.js';
import { setupCanvas } from '../ui/pitchroll.js';
import { APP_VERSION } from '../version.js';

export function MeScreen() {
  const st = useAppState();
  const s = profileSummary(st.profile, st.settings.notation);
  const items = [
    ['/help', '❓', 'Jak to funguje', 'Nápověda a vysvětlení od úplného začátku'],
    ['/voice', '🎙️', 'Můj hlas', `${typeInfo(st.profile.type).name} · ${s.range} · ${s.key}`],
    ['/progress', '📈', 'Pokrok', `Série ${streak(st.progress)} dní · ${totalMinutes(st.progress)} min celkem`],
    ['/recordings', '🎧', 'Nahrávky', 'Archiv, přehrání, porovnání, uložení WAV'],
    ['/audio', '🎧', 'Zvuk a sluchátka', 'Mikrofon, sluchátka, kalibrace zpoždění'],
    ['/tools', '🧰', 'Nástroje', 'Metronom, referenční tón, bourdon, klavír, stupnice'],
    ['/ear', '👂', 'Sluchový trénink', 'Intervaly a melodie'],
    ['/settings', '⚙️', 'Nastavení', 'Značení not, přísnost, doprovod, připomínky'],
    ['/backup', '💾', 'Záloha a obnova', 'Vše v jednom souboru'],
    ['/diag', '🩺', 'Diagnostika', 'Když něco nefunguje'],
    ['/about', 'ℹ️', 'O aplikaci', 'Verze, licence, soukromí'],
  ];
  return html`<div class="screen"><h1 class="mb16">Já</h1>
    <div class="list">${items.map(([h, i, t, sub]) => html`<a class="item" href=${'#' + h}><div class="ic">${i}</div><div class="grow"><div class="t">${t}</div><div class="s ellipsis">${sub}</div></div><div class="chev">›</div></a>`)}</div>
  </div>`;
}

export function ProgressScreen() {
  const st = useAppState();
  const p = st.progress;
  const w = weakest(p, st.settings.notation);
  const weeks = accuracyByWeek(p);
  const days = [];
  for (let i = 27; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: dayKey(d), m: minutesOn(p, d), d }); }
  const goal = st.settings.dailyGoal;
  return html`<div class="screen">
    <${TopBar} title="Pokrok" backTo="/me" />
    <div class="grid2">
      <div class="stat"><div class="k">Série dní</div><div class="v">🔥 ${streak(p)}</div><div class="tiny dim">nejdelší ${bestStreak(p)}</div></div>
      <div class="stat"><div class="k">Dnes</div><div class="v">${minutesOn(p)} / ${goal} min</div><div class="bar mt8"><i style=${`width:${Math.min(100, (minutesOn(p) / goal) * 100)}%`}></i></div></div>
      <div class="stat"><div class="k">Celkem</div><div class="v">${totalMinutes(p)} min</div></div>
      <div class="stat"><div class="k">Hotové lekce</div><div class="v">${Object.values(p.lessons).filter((l) => l.stars >= 1).length} / 50</div></div>
    </div>
    <div class="section-title">Posledních 28 dní</div>
    <div class="card tight"><div style="display:grid;grid-template-columns:repeat(14,1fr);gap:4px">${days.map((d) => html`<div title=${d.k} style=${`aspect-ratio:1;border-radius:5px;background:${d.m === 0 ? '#ebe8e1' : d.m >= goal ? '#7fcbad' : '#f6d9ad'}`}></div>`)}</div>
      <div class="tiny dim mt8">Zelená = splněný denní cíl ${goal} min.</div></div>
    <div class="section-title">Přesnost v čase (týdny)</div>
    <div class="card tight"><${LineChart} series=${[{ color: '#6fa8dc', points: weeks.map((x, i) => ({ x: i, y: x.avg })) }]} yMin=${0} yMax=${100} xLabels=${weeks.length ? [{ x: 0, text: fmtDate(weeks[0].week) }, { x: weeks.length - 1, text: fmtDate(weeks[weeks.length - 1].week) }] : []} /></div>
    <div class="section-title">Vývoj rozsahu</div>
    <div class="card tight"><${RangeChart} history=${st.profileHistory} height=${160} /></div>
    <div class="section-title">Nejslabší noty</div>
    <div class="card tight">${w.notes.length ? w.notes.map((n) => html`<div class="phr"><b style="width:60px">${n.name}</b><span class="grow small muted">${n.bias < 0 ? 'spíš níž ▼' : 'spíš výš ▲'} · ${n.n}×</span><span class=${n.avg > 40 ? 'c-bad' : n.avg > 20 ? 'c-warn' : 'c-good'} style="font-weight:800">±${Math.round(n.avg)} c</span></div>`) : html`<p class="small muted">Zatím málo dat – zazpívej pár cvičení.</p>`}</div>
    <div class="section-title">Nejslabší intervaly</div>
    <div class="card tight">${w.intervals.length ? w.intervals.map((n) => html`<div class="phr"><b class="grow">${n.name}</b><span class="small muted">${n.n}×</span><span class=${n.avg > 40 ? 'c-bad' : n.avg > 20 ? 'c-warn' : 'c-good'} style="font-weight:800;width:64px;text-align:right">±${Math.round(n.avg)} c</span></div>`) : html`<p class="small muted">Zatím málo dat.</p>`}</div>
    <div class="section-title">Odznaky</div>
    <div class="grid2">${BADGES.map((b) => html`<div class="stat" style=${p.badges[b.id] ? '' : 'opacity:.45'}><div style="font-size:26px">${p.badges[b.id] ? '🏅' : '🔒'}</div><div style="font-weight:800">${b.title}</div><div class="tiny dim">${b.desc}</div>${p.badges[b.id] ? html`<div class="tiny c-acc">${fmtDate(p.badges[b.id])}</div>` : null}</div>`)}</div>
  </div>`;
}

export function RecordingsScreen() {
  const [list, setList] = useState(null);
  const [sel, setSel] = useState([]);
  const [playing, setPlaying] = useState(null);
  const stopRef = useRef(null);
  const load = async () => setList((await db.listRecordings()).sort((a, b) => b.date.localeCompare(a.date)));
  useEffect(() => { load(); return () => stopRef.current?.stop(); }, []);
  const stop = () => { stopRef.current?.stop(); stopRef.current = null; setPlaying(null); };
  const play = async (meta, withTarget) => {
    stop();
    const r = await db.getRecording(meta.id);
    if (!r) return toast('Nahrávka nenalezena.');
    await engine.ensureContext();
    if (withTarget && r.opts) { stopRef.current = await playAttempt(r.opts, r, { fromBeat: 0 }); }
    else { const src = engine.playPcm(r.pcm, r.rate, engine.now + 0.05, engine.bus.playback); stopRef.current = { stop: () => { try { src.stop(); } catch { /* */ } } }; }
    setPlaying(meta.id);
    setTimeout(() => setPlaying((p) => (p === meta.id ? null : p)), (meta.duration || 10) * 1000 + 500);
  };
  const [exp, setExp] = useState(null);
  const exportOne = async (meta, kind) => {
    const r = await db.getRecording(meta.id);
    const base = `zpivanky-${meta.itemId}-${meta.date.slice(0, 16).replace(/[:T]/g, '-')}`;
    try {
      if (kind === 'debug') {
        const blob = new Blob([JSON.stringify(debugPackage(r))], { type: 'application/json' });
        downloadBlob(blob, base + '-ladeni.json');
      } else {
        const blob = kind === 'mix' && r.opts ? await renderMixWav(r.opts, r) : voiceWav(r);
        downloadBlob(blob, base + (kind === 'mix' ? '-s-doprovodem' : '-hlas') + '.wav');
      }
      toast('Uloženo do Stažených souborů.');
    } catch (e) { toast('Export selhal: ' + e.message); }
    setExp(null);
  };
  const del = async (meta) => { if (!confirm('Smazat nahrávku?')) return; await db.deleteRecording(meta.id); load(); };
  const star = async (meta) => { await db.updateRecordingMeta(meta.id, { starred: !meta.starred }); load(); };
  const toggleSel = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id].slice(-2));
  if (!list) return html`<div class="screen"><${TopBar} title="Nahrávky" backTo="/me" /><p class="muted">Načítám…</p></div>`;
  return html`<div class="screen">
    <${TopBar} title="Nahrávky" sub=${`${list.length} uložených · ★ označené se nemažou`} backTo="/me" />
    ${sel.length === 2 ? html`<${Compare} ids=${sel} onClose=${() => setSel([])} />` : html`<p class="small muted">Pro porovnání označ dvě nahrávky (☐).</p>`}
    ${!list.length ? html`<${Empty} icon="🎧" title="Zatím žádné nahrávky" text="Nahrávky se ukládají automaticky po každém cvičení a písni." />` : null}
    <div class="list">${list.map((m) => html`<div class="item" style="flex-wrap:wrap">
      <button class="iconbtn" aria-label="Vybrat pro porovnání" onClick=${() => toggleSel(m.id)}>${sel.includes(m.id) ? '☑' : '☐'}</button>
      <div class="grow"><div class="t ellipsis">${m.title}</div><div class="s">${fmtDate(m.date)} · ${fmtTime(m.duration || 0)} · <span class=${scoreClass(m.score)}>${m.score} b.</span></div></div>
      <button class="iconbtn" aria-label="Označit" onClick=${() => star(m)}>${m.starred ? '★' : '☆'}</button>
      <div class="row" style="width:100%;gap:6px">
        <button class="btn sm grow" onClick=${() => (playing === m.id ? stop() : play(m, false))}>${playing === m.id ? '■' : '▶ Hlas'}</button>
        <button class="btn sm grow" onClick=${() => play(m, true)}>▶ S cílem</button>
        <button class="btn sm" onClick=${() => setExp(m)} aria-label="Uložit WAV">💾</button>
        <button class="btn sm danger" onClick=${() => del(m)} aria-label="Smazat">🗑</button>
      </div></div>`)}</div>
    ${exp ? html`<${Sheet} onClose=${() => setExp(null)}><h2>Uložit nahrávku</h2><p class="small muted mt8">${exp.title} · ${fmtDate(exp.date)}</p>
      <div class="col mt16">
        <button class="btn block" onClick=${() => exportOne(exp, 'voice')}>🎙️ Jen hlas (WAV)</button>
        <button class="btn block" onClick=${() => exportOne(exp, 'mix')}>🎵 Hlas s doprovodem (WAV)</button>
        <button class="btn block" onClick=${() => exportOne(exp, 'debug')}>🩺 Balíček pro ladění (hlas + data)</button>
        <p class="tiny dim">Balíček pro ladění obsahuje tvůj hlas, křivku, kterou aplikace slyšela, cíle a nastavení (tónina, tempo, zpoždění). Pošli ho, když hodnocení nesedí.</p>
      </div></${Sheet}>` : null}
  </div>`;
}

function debugPackage(r) {
  const pcm = r.pcm instanceof Int16Array ? r.pcm : new Int16Array(r.pcm);
  const u8 = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  const hp = state.settings.hpProfiles.find((h) => h.id === state.settings.activeHp);
  const { pcm: _p, ...meta } = r;
  return {
    format: 'zpivanky-debug', version: 1, app: APP_VERSION, exportedAt: new Date().toISOString(), userAgent: navigator.userAgent,
    recording: { ...meta, pcmB64: btoa(bin) },
    settings: { strictness: state.settings.strictness, notation: state.settings.notation, guideInst: state.settings.guideInst, accStyle: state.settings.accStyle, headphones: state.settings.headphones, mix: state.settings.mix, micDeviceId: state.settings.micDeviceId ? 'vlastní' : 'výchozí' },
    headphones: hp, profile: state.profile, engine: engine.diagnostics(),
  };
}

function Compare({ ids, onClose }) {
  const [recs, setRecs] = useState(null);
  const ref = useRef(null);
  useEffect(() => { Promise.all(ids.map((id) => db.getRecording(id))).then(setRecs); }, [ids.join()]);
  useEffect(() => {
    if (!recs || !ref.current) return;
    const { ctx, w, h } = setupCanvas(ref.current);
    ctx.fillStyle = '#fcfbf9'; ctx.fillRect(0, 0, w, h);
    const all = recs.flatMap((r) => (r.frames || []).filter((f) => f.m != null));
    if (!all.length) return;
    const lo = Math.min(...all.map((f) => f.m)) - 1, hi = Math.max(...all.map((f) => f.m)) + 1;
    const T = Math.max(...recs.map((r) => Math.max(...(r.frames || [{ t: 1 }]).map((f) => f.t))));
    const cols = ['#f0a35e', '#6fa8dc'];
    recs.forEach((r, k) => {
      ctx.strokeStyle = cols[k]; ctx.lineWidth = 2.5; let prev = null;
      for (const f of r.frames || []) {
        if (f.m == null) { prev = null; continue; }
        const x = (f.t / T) * w, y = h - ((f.m - lo) / (hi - lo)) * h;
        if (prev && x - prev[0] < 15) { ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(x, y); ctx.stroke(); }
        prev = [x, y];
      }
    });
  }, [recs]);
  if (!recs) return null;
  return html`<div class="card mb16"><div class="row between"><b>Porovnání</b><button class="btn sm" onClick=${onClose}>Zavřít</button></div>
    <canvas ref=${ref} class="fill mt8" style="height:180px"></canvas>
    <div class="small mt8"><span class="c-acc">━ ${fmtDate(recs[0].date)} (${recs[0].score} b.)</span> · <span class="c-teal">━ ${fmtDate(recs[1].date)} (${recs[1].score} b.)</span></div>
    <div class="small muted mt8">${recs[0].itemId === recs[1].itemId ? (recs[1].score > recs[0].score ? `Zlepšení o ${recs[1].score - recs[0].score} bodů.` : recs[1].score < recs[0].score ? `Rozdíl ${recs[1].score - recs[0].score} bodů.` : 'Stejné skóre.') : 'Pozor: jde o různá cvičení.'}</div></div>`;
}

export function SettingsScreen() {
  const st = useAppState();
  const s = st.settings;
  return html`<div class="screen">
    <${TopBar} title="Nastavení" backTo="/me" />
    <div class="section-title">Značení not</div>
    <div class="list">${Object.entries(NOTATIONS).map(([k, v]) => html`<button class="item" style=${s.notation === k ? 'outline:2px solid var(--accent)' : ''} onClick=${() => saveSettings({ notation: k })}><div class="grow t">${v}</div>${s.notation === k ? html`<span class="c-acc">●</span>` : null}</button>`)}</div>
    <div class="section-title">Přísnost hodnocení</div>
    <div class="list">${Object.entries(STRICTNESS).map(([k, v]) => html`<button class="item" style=${s.strictness === k ? 'outline:2px solid var(--accent)' : ''} onClick=${() => saveSettings({ strictness: k })}><div class="grow t">${v.label}</div>${s.strictness === k ? html`<span class="c-acc">●</span>` : null}</button>`)}</div>
    <div class="section-title">Zvuk</div>
    <div class="card">
      <label class="field">Vodicí melodie<${Seg} options=${[['guide', 'Hlas (ú)'], ['piano', 'Klavír']]} value=${s.guideInst} onChange=${(v) => saveSettings({ guideInst: v })} /></label>
      <label class="field mt16">Styl doprovodu<select value=${s.accStyle} onChange=${(e) => saveSettings({ accStyle: e.target.value })}>${Object.entries(STYLES).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></label>
      <${Toggle} label="Basa v doprovodu" on=${s.bass} onChange=${(v) => saveSettings({ bass: v })} />
      <${Toggle} label="Jemný rytmus (bicí)" on=${s.drums} onChange=${(v) => saveSettings({ drums: v })} />
      <${Toggle} label="Ukládat nahrávky" sub="Posledních 60 pokusů; označené ★ zůstávají" on=${s.saveRecordings} onChange=${(v) => saveSettings({ saveRecordings: v })} />
    </div>
    <div class="section-title">Pro začátečníky</div>
    <div class="card"><${Toggle} label="Režim pro začátečníky" sub="Vysvětlivky a tipy na obrazovkách" on=${s.beginner !== false} onChange=${(v) => saveSettings({ beginner: v })} />
      ${(s.hiddenHints || []).length ? html`<button class="btn sm block" onClick=${() => saveSettings({ hiddenHints: [] })}>Znovu ukázat skryté tipy</button>` : null}
      <a class="btn sm block mt8" href="#/help">❓ Jak to funguje</a></div>
    <div class="section-title">Návyky a zdraví hlasu</div>
    <div class="card">
      <label class="field">Denní cíl: ${s.dailyGoal} minut<input type="range" min="5" max="60" step="5" value=${s.dailyGoal} onInput=${(e) => { const v = parseInt(e.target.value, 10); saveSettings({ dailyGoal: v }); state.progress.dailyGoal = v; saveProgress(); }} /></label>
      <${Toggle} label="Připomínat pití a pauzy" sub="Každých 15 minut zpěvu" on=${s.reminders} onChange=${(v) => saveSettings({ reminders: v })} />
      <${Toggle} label="Nezhasínat obrazovku při zpěvu" on=${s.wakeLock} onChange=${(v) => saveSettings({ wakeLock: v })} />
    </div>
    <div class="card warnc small mt16">🩺 Bolí tě v krku, chraptíš nebo hlas „škrábe“? <b>Přestaň zpívat</b>, napij se vody a dej hlasu odpočinout. Když potíže trvají déle než dva týdny, navštiv foniatra.</div>
    <div class="section-title">Úvodní průvodce</div>
    <button class="btn block" onClick=${() => { saveSettings({ onboarded: false }); navigate('/welcome'); }}>Spustit znovu</button>
  </div>`;
}

export function BackupScreen() {
  const [withRec, setWithRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const [est, setEst] = useState(null);
  const [persist, setPersist] = useState(null);
  useEffect(() => { db.estimate().then(setEst); navigator.storage?.persisted?.().then(setPersist).catch(() => {}); }, []);
  const exp = async () => {
    setBusy(true);
    try {
      const data = await createBackup(db, { includeRecordings: withRec, settings: state.settings });
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      downloadBlob(blob, `zpivanky-zaloha-${new Date().toISOString().slice(0, 10)}.json`);
      toast('Záloha uložena do Stažených souborů.');
    } catch (e) { toast('Záloha selhala: ' + e.message); }
    setBusy(false);
  };
  const imp = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setBusy(true);
    try {
      const data = JSON.parse(await f.text());
      const errs = validateBackup(data);
      if (errs.length) throw new Error(errs.join(' '));
      if (!confirm(`Obnovit zálohu z ${fmtDate(data.exportedAt)}? Současná data se nahradí.`)) { setBusy(false); return; }
      const r = await restoreBackup(db, data);
      await loadState();
      toast(`Obnoveno: ${r.counts.songs} písní, ${r.counts.attempts} pokusů, ${r.counts.recordings} nahrávek.`);
    } catch (err) { toast('Obnova selhala: ' + err.message); }
    setBusy(false); e.target.value = '';
  };
  return html`<div class="screen">
    <${TopBar} title="Záloha a obnova" backTo="/me" />
    <div class="card"><p>Všechna data jsou jen v tomto telefonu. Záloha je jeden soubor (profil, pokrok, vlastní písně, nastavení, volitelně nahrávky), který si můžeš uložit třeba na Disk.</p>
      <${Toggle} label="Včetně nahrávek" sub="Soubor bude větší" on=${withRec} onChange=${setWithRec} />
      <p class="tiny dim">Importované písně se zálohují s notami, akordy a textem; jejich originální zvuk (desítky MB) ne – po obnovení hrají se syntetickým doprovodem, nebo je naimportuj znovu.</p>
      <button class="btn primary block mt8" disabled=${busy} onClick=${exp}>💾 Vytvořit zálohu</button></div>
    <div class="card mt16"><p>Obnova nahradí současná data obsahem zálohy.</p>
      <label class="btn block" style="cursor:pointer">📂 Obnovit ze souboru<input type="file" accept="application/json,.json" style="display:none" onChange=${imp} /></label></div>
    <div class="card mt16 small"><div class="kv"><span>Využito místa</span><span>${est ? `${(est.usage / 1e6).toFixed(1)} MB z ${(est.quota / 1e9).toFixed(1)} GB` : '–'}</span><span>Trvalé úložiště</span><span>${persist == null ? '–' : persist ? 'ano (data se nesmažou samy)' : 'ne – prohlížeč může data smazat při nedostatku místa'}</span></div>
      ${persist === false ? html`<button class="btn sm block mt8" onClick=${async () => setPersist(await navigator.storage.persist())}>Požádat o trvalé úložiště</button>` : null}</div>
  </div>`;
}

export function DiagScreen() {
  const [d, setD] = useState(engine.diagnostics());
  const [last, setLast] = useState(null);
  const wave = useRef(null);
  const [inputs, setInputs] = useState([]);
  const [imp, setImp] = useState(null);
  useEffect(() => { engine.listInputs().then(setInputs); }, []);
  useEffect(() => { Promise.all([workerInfo().catch(() => null), modelReady()]).then(([w, m]) => setImp({ ...(w || {}), model: m })); }, []);
  useFrames((fr) => setLast(fr[fr.length - 1]));
  useInterval(() => setD(engine.diagnostics()), 500);
  const ua = navigator.userAgent;
  return html`<div class="screen">
    <${TopBar} title="Diagnostika" backTo="/me" />
    <${MicGate} compact=${true}>
    <div class="card"><div class="kv">
      <span>Verze aplikace</span><span>${APP_VERSION}</span>
      <span>Prohlížeč</span><span class="mono">${ua}</span>
      <span>AudioContext</span><span>${d.state || '–'}, ${d.sampleRate || '–'} Hz</span>
      <span>Zpoždění výstupu</span><span>base ${d.baseLatency != null ? Math.round(d.baseLatency * 1000) : '–'} ms, output ${d.outputLatency != null ? Math.round(d.outputLatency * 1000) : '–'} ms</span>
      <span>Kalibrace</span><span>${state.settings.hpProfiles.find((h) => h.id === state.settings.activeHp)?.latencyMs ?? '–'} ms (${state.settings.hpProfiles.find((h) => h.id === state.settings.activeHp)?.name})</span>
      <span>Mikrofon</span><span>${d.mic.status} · ${d.mic.label || '–'}</span>
      <span>Nastavení stopy</span><span class="mono">${JSON.stringify(d.mic.settings || {})}</span>
      <span>Detektor</span><span>okno ${d.analyzer?.frameSize ?? '–'} vz., krok ${d.analyzer?.hop ?? '–'} vz. @ ${d.analyzer?.rate ?? '–'} Hz, ${d.fps} snímků/s</span>
      <span>Špička signálu</span><span>${(d.peak * 100).toFixed(1)} % ${d.peak > 0.98 ? '⚠ přebuzeno' : ''}</span>
      <span>Úroveň / šum</span><span>${last ? `${last.db.toFixed(1)} dBFS / ${last.floorDb.toFixed(1)} dBFS` : '–'}</span>
      <span>Frekvence (surová)</span><span>${last && last.freq ? `${last.freq.toFixed(2)} Hz, jasnost ${last.clarity.toFixed(2)}` : '–'}</span>
      <span>Výška (tracker)</span><span>${last?.midi != null ? `${fmtNote(Math.round(last.midi))} ${((last.midi - Math.round(last.midi)) * 100).toFixed(1)} c (MIDI ${last.midi.toFixed(2)})` : 'ticho / šum'}</span>
      <span>Sykavka „sss“</span><span>${last?.hiss ? 'ano' : 'ne'}</span>
      <span>Vstupní zařízení</span><span>${inputs.map((i) => i.label).join(' · ') || '–'}</span>
      <span>Úložiště</span><span>${'indexedDB' in window ? 'IndexedDB ok' : 'chybí'}, SW ${navigator.serviceWorker?.controller ? 'aktivní' : 'neaktivní'}</span>
      <span>Wake Lock</span><span>${'wakeLock' in navigator ? 'podporováno' : 'ne'}</span>
      <span>Import (Přesně)</span><span>${imp ? `${imp.gpu ? 'grafický čip (WebGPU)' : 'procesor (WASM)'}, ${imp.coi ? `více vláken (${imp.threads} jader)` : '1 vlákno – otevři aplikaci znovu'}, model ${imp.model ? 'stažený' : 'nestažený'}` : '…'}</span>
    </div></div>
    <div class="card mt16"><b>Surový signál</b><${Scope} /></div>
    </${MicGate}>
  </div>`;
}

function Scope() {
  const ref = useRef(null);
  const buf = useRef([]);
  useFrames((fr) => { for (const f of fr) buf.current.push(f); if (buf.current.length > 300) buf.current.splice(0, buf.current.length - 300); });
  useEffect(() => {
    let raf;
    const draw = () => {
      const cv = ref.current;
      if (cv) {
        const { ctx, w, h } = setupCanvas(cv);
        ctx.fillStyle = '#fcfbf9'; ctx.fillRect(0, 0, w, h);
        const b = buf.current; const n = b.length;
        ctx.strokeStyle = '#3fae84'; ctx.lineWidth = 1.5; ctx.beginPath();
        b.forEach((f, i) => { const x = (i / 300) * w, y = h - ((f.db + 90) / 90) * h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        ctx.strokeStyle = '#e06a7c'; ctx.beginPath();
        b.forEach((f, i) => { const x = (i / 300) * w, y = h - ((f.floorDb + 90) / 90) * h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        ctx.fillStyle = '#f0a35e';
        b.forEach((f, i) => { if (f.freq) { const x = (i / 300) * w, y = h - (Math.log2(f.freq / 50) / Math.log2(30)) * h; ctx.fillRect(x, y, 2, 2); } });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return html`<canvas ref=${ref} class="fill mt8" style="height:160px"></canvas><div class="tiny dim mt8">Zeleně hlasitost, červeně šumové pozadí, žlutě surová frekvence (50–1500 Hz, log).</div>`;
}

export function AboutScreen() {
  return html`<div class="screen">
    <${TopBar} title="O aplikaci" backTo="/me" />
    <div class="card"><h2>Zpívánky ${APP_VERSION}</h2><p class="mt8">Osobní aplikace na učení čistého zpěvu. Bez účtu, bez reklam, bez sledování. Všechna data i zvuk zůstávají jen v tomto telefonu a nic se neodesílá.</p></div>
    <div class="card mt16 small"><b>Licence a poděkování</b>
      <ul><li>Klavír: Salamander Grand Piano V3 – Alexander Holm, CC-BY 3.0.</li><li>Kytara a basa: tonejs-instruments (Nicholaus Brosowsky), CC-BY 3.0.</li>
        <li>Písmo Nunito – Vernon Adams, SIL Open Font License 1.1.</li><li>Preact + htm – MIT.</li>
        <li>Melodie „Óda na radost“ (L. van Beethoven) a „Ah! vous dirai-je, maman“ (francouzská lidová) jsou volné dílo; texty i ostatní písně jsou původní.</li></ul></div>
    <div class="card mt16 small"><b>Aktualizace</b><p>Aplikace se aktualizuje sama: při otevření s internetem stáhne novou verzi a nabídne „Aktualizovat“. Data se při aktualizaci nemažou.</p></div>
  </div>`;
}
