// Zvuk a sluchátka: mikrofon, výstup, profily sluchátek, kalibrace zpoždění, kontrola úrovně, test reproduktoru.
import { html, useState, useEffect, useRef, useFrames, useInterval, useAppState, navigate, TopBar, Sheet, MicGate, LevelMeter, toast, Seg } from '../ui/common.js';
import { engine } from '../audio/engine.js';
import { state, saveSettings, hpProfile } from '../state.js';
import { median, foldCents } from '../core/music.js';

export function AudioScreen() {
  const st = useAppState();
  const [inputs, setInputs] = useState([]);
  const [guess, setGuess] = useState(null);
  const [leak, setLeak] = useState(null);
  const [add, setAdd] = useState(false);
  const [, force] = useState(0);
  const refresh = async () => { setInputs(await engine.listInputs()); setGuess(await engine.headphonesGuess()); force((x) => x + 1); };
  useEffect(() => { refresh(); const h = () => refresh(); navigator.mediaDevices?.addEventListener?.('devicechange', h); return () => navigator.mediaDevices?.removeEventListener?.('devicechange', h); }, []);
  const pick = async (id) => {
    await saveSettings({ micDeviceId: id || null });
    try { await engine.startMic(id || null); toast('Mikrofon: ' + engine.mic.label); } catch (e) { toast(e.message); }
    refresh();
  };
  const hp = hpProfile();
  const setActive = (id) => saveSettings({ activeHp: id, headphones: st.settings.hpProfiles.find((h) => h.id === id)?.type === 'speaker' ? 'no' : 'yes' });
  const leakTest = async () => {
    setLeak({ running: true });
    await engine.ensureContext();
    const target = 69; const seen = [];
    const off = engine.onFrames((fr) => { for (const f of fr) if (f.voiced && f.midi != null) seen.push(f.midi); });
    engine.playEvent({ midi: target, inst: 'guide', vel: 1 }, engine.now + 0.05, 1.5, engine.bus.preview);
    await new Promise((r) => setTimeout(r, 1900));
    off();
    const hits = seen.filter((m) => Math.abs(foldCents((m - target) * 100)) < 60).length;
    setLeak({ running: false, heard: hits > 15 });
  };
  const mic = engine.mic;
  const isBt = hp?.type === 'bt';
  return html`<div class="screen">
    <${TopBar} title="Zvuk a sluchátka" backTo="/me" />
    <div class="card infoc small"><b>Proč sluchátka s mikrofonem?</b> Mikrofon u pusy dá čistší signál a doprovod ze sluchátek se nedostane do mikrofonu, takže hodnocení je přesné. Nejlepší je drátový headset; Bluetooth má zpoždění a horší mikrofon.</div>
    ${isBt ? html`<div class="card warnc small mt16"><b>Bluetooth sluchátka (${hp.name}):</b> když web použije mikrofon ze sluchátek, Android je přepne do „hovorového“ režimu – zvuk je pak mono a horší. Doporučuji: <b>poslouchat přes sluchátka a zpívat do mikrofonu telefonu</b> (vyber níže „telefon“ / výchozí mikrofon, telefon drž 20–30 cm od úst). V aplikaci Nothing X zapni <b>Low Lag Mode</b> a pak udělej kalibraci zpoždění.</div>` : null}
    <div class="section-title">Mikrofon</div>
    <${MicGate}>
      <div class="card">
        <div class="kv"><span>Používám</span><b class="ellipsis">${mic.label || '–'}</b><span>Vzorkování</span><span>${engine.ctx?.sampleRate || '–'} Hz</span>
          <span>Úpravy</span><span>${mic.settings ? `potlačení ozvěny ${mic.settings.echoCancellation ? 'zap' : 'vyp'}, šumu ${mic.settings.noiseSuppression ? 'zap' : 'vyp'}, AGC ${mic.settings.autoGainControl ? 'zap' : 'vyp'}` : '–'}</span></div>
        <label class="field mt16">Vybrat mikrofon<select value=${st.settings.micDeviceId || ''} onChange=${(e) => pick(e.target.value)}>
          <option value="">Výchozí (systém)</option>${inputs.map((d) => html`<option value=${d.deviceId}>${d.label}</option>`)}</select></label>
        <div class="mt16"><${LevelMeter} /></div>
      </div>
    </${MicGate}>
    <div class="section-title">Výstup a sluchátka</div>
    <div class="card small">
      <div>Zvuk hraje: <b>${hp?.type === 'speaker' ? 'reproduktor telefonu' : hp?.name}</b>${guess ? html` · <span class="muted">${guess.any ? `zjištěno: ${guess.bt ? 'Bluetooth' : 'sluchátka'}` : 'sluchátka jsem nezjistil'}</span>` : null}</div>
      <div class="tiny dim mt8">Android výstup z prohlížeče přepnout nedovolí – řídí ho systém (připojená sluchátka mají přednost). Vyber, co právě používáš:</div>
    </div>
    <div class="list mt8">${st.settings.hpProfiles.map((h) => html`<button class="item" style=${h.id === st.settings.activeHp ? 'outline:2px solid var(--accent)' : ''} onClick=${() => setActive(h.id)}>
      <div class="ic">${h.type === 'bt' ? '🎧' : h.type === 'wired' ? '🔌' : '🔈'}</div>
      <div class="grow"><div class="t">${h.name}</div><div class="s">zpoždění ${h.latencyMs} ms ${h.calibrated ? '· kalibrováno' : '· odhad'}</div></div>
      ${h.id === st.settings.activeHp ? html`<span class="c-acc">●</span>` : null}</button>`)}
      <button class="btn sm" onClick=${() => setAdd(true)}>＋ Přidat sluchátka</button></div>
    <div class="col mt16">
      <a class="btn primary block" href="#/calibrate">⏱️ Kalibrovat zpoždění (${hp?.name})</a>
      <button class="btn block" onClick=${leakTest} disabled=${leak?.running}>${leak?.running ? 'Poslouchám…' : '🔊 Slyší mikrofon doprovod?'}</button>
      ${leak && !leak.running ? html`<div class=${'card small ' + (leak.heard ? 'warnc' : 'infoc')}>${leak.heard ? 'Mikrofon slyší, co hraje – pravděpodobně hraješ z reproduktoru. Doprovod by rušil hodnocení: použiju režim „poslechni → zazpívej“.' : 'Výborně, mikrofon doprovod neslyší – můžeš zpívat s doprovodem.'}
        ${leak.heard && hp?.type !== 'speaker' ? html`<button class="btn sm block mt8" onClick=${() => setActive('speaker')}>Přepnout na „Reproduktor“</button>` : null}</div>` : null}
    </div>
    ${add ? html`<${AddHp} onClose=${() => setAdd(false)} />` : null}
  </div>`;
}

function AddHp({ onClose }) {
  const [name, setName] = useState(engine.mic.label && !/default|výchozí/i.test(engine.mic.label) ? engine.mic.label : '');
  const [type, setType] = useState('bt');
  const save = async () => {
    const id = 'hp' + Date.now();
    const lat = type === 'bt' ? 220 : type === 'wired' ? 40 : 60;
    await saveSettings({ hpProfiles: [...state.settings.hpProfiles, { id, name: name || 'Moje sluchátka', type, latencyMs: lat, calibrated: false }], activeHp: id, headphones: type === 'speaker' ? 'no' : 'yes' });
    onClose(); navigate('/calibrate');
  };
  return html`<${Sheet} onClose=${onClose}><h2>Nová sluchátka</h2>
    <label class="field mt16">Název<input type="text" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="např. Nothing Ear (a)" /></label>
    <div class="mt16"><${Seg} options=${[['wired', 'Drátová'], ['bt', 'Bluetooth'], ['speaker', 'Reproduktor']]} value=${type} onChange=${setType} /></div>
    <button class="btn primary block mt16" onClick=${save}>Uložit a kalibrovat</button></${Sheet}>`;
}

/** Kalibrace zpoždění: 4 kliky odpočet + 8 kliků, zpíváš „pa“ s každým. */
export function CalibrateScreen() {
  const [phase, setPhase] = useState('intro');
  const [result, setResult] = useState(null);
  const [beat, setBeat] = useState(-1);
  const clicks = useRef([]);
  const onsets = useRef([]);
  const hp = hpProfile();
  useFrames((fr) => {
    if (phase !== 'run') return;
    let prevLoud = onsets.current._prev ?? false;
    for (const f of fr) {
      const loud = f.db > f.floorDb + 15;
      if ((f.onset || (loud && !prevLoud)) && (!onsets.current.length || f.t - onsets.current[onsets.current.length - 1] > 0.2)) onsets.current.push(f.t);
      prevLoud = loud;
    }
    onsets.current._prev = prevLoud;
  });
  const run = async () => {
    await engine.ensureContext();
    clicks.current = []; onsets.current = [];
    const spb = 60 / 90, t0 = engine.now + 0.4;
    for (let i = 0; i < 12; i++) { const t = t0 + i * spb; engine.perc.click(t, i % 4 === 0, engine.bus.preview, 1); if (i >= 4) clicks.current.push(t); }
    if (engine.testBuffer) engine.startTestInput(t0);
    setPhase('run');
    const iv = setInterval(() => setBeat(Math.floor((engine.now - t0) / spb)), 50);
    await new Promise((r) => setTimeout(r, (12 * spb + 1.0 + 0.4) * 1000));
    clearInterval(iv);
    engine.stopTestInput();
    const offs = [];
    for (const c of clicks.current) {
      const cand = onsets.current.map((o) => o - c).filter((d) => d > -0.15 && d < 0.6);
      if (cand.length) offs.push(cand.reduce((a, b) => (Math.abs(b - 0.15) < Math.abs(a - 0.15) ? b : a)));
    }
    if (offs.length < 4) { setResult({ ok: false, n: offs.length }); setPhase('done'); return; }
    const med = median(offs);
    const spread = median(offs.map((o) => Math.abs(o - med)));
    const ms = Math.max(0, Math.round(med * 1000));
    setResult({ ok: true, ms, n: offs.length, spread: Math.round(spread * 1000) });
    setPhase('done');
  };
  const save = async () => {
    const list = state.settings.hpProfiles.map((h) => (h.id === hp.id ? { ...h, latencyMs: result.ms, calibrated: true, calibratedAt: new Date().toISOString() } : h));
    await saveSettings({ hpProfiles: list });
    engine.latencyMs = result.ms;
    toast(`Uloženo: ${result.ms} ms pro ${hp.name}`);
    navigate('/audio', true);
  };
  return html`<div class="screen">
    <${TopBar} title="Kalibrace zpoždění" sub=${hp?.name} backTo="/audio" />
    <div class="card"><p>Uslyšíš 4 kliknutí na odpočet a pak 8 dalších. <b>S každým z těch 8 kliků řekni krátce „pa“</b> – přesně do rytmu. Trvá to asi 10 sekund.</p>
      <p class="small muted">Změřím, o kolik se zvuk zpozdí cestou do sluchátek a zpět z mikrofonu, a podle toho budu hodnotit nástupy. Bez sluchátek stačí být potichu – změřím to z kliknutí.</p></div>
    <${MicGate}>
      ${phase === 'run' ? html`<div class="card mt16 center"><div style="font-size:80px;font-weight:900" class=${beat >= 4 ? 'c-acc' : 'dim'}>${beat < 0 ? '…' : beat < 4 ? 4 - beat : beat < 12 ? 'pa!' : '✓'}</div><div class="small muted">${beat < 4 ? 'odpočet' : `klik ${Math.min(8, beat - 3)} z 8`}</div></div>` : null}
      ${phase === 'done' && result ? html`<div class=${'card mt16 ' + (result.ok ? 'infoc' : 'warnc')}>
        ${result.ok ? html`<div class="center"><div class="small muted">Naměřené zpoždění</div><div style="font-size:48px;font-weight:900">${result.ms} ms</div><div class="small muted">z ${result.n} nástupů, rozptyl ±${result.spread} ms</div></div>`
          : html`<p>Zachytil jsem jen ${result.n} nástupů z 8. Řekni „pa“ hlasitěji a krátce, přesně s kliknutím.</p>`}</div>` : null}
    </${MicGate}>
    <div class="bottom-actions">
      ${phase === 'done' && result?.ok ? html`<button class="btn grow" onClick=${run}>↻ Znovu</button><button class="btn primary grow" onClick=${save}>Uložit</button>`
        : html`<button class="btn primary big block" disabled=${phase === 'run'} onClick=${run}>${phase === 'run' ? 'Měřím…' : '▶ Spustit'}</button>`}
    </div>
  </div>`;
}
