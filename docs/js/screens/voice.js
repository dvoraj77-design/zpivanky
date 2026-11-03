// Hlasový profil a test hlasu s průvodcem (~3 min).
import { html, useState, useEffect, useRef, useFrames, useInterval, useAppState, navigate, TopBar, Sheet, MicGate, fmtNote, toast, useWakeLock, LevelMeter } from '../ui/common.js';
import { RangeChart } from '../ui/charts.js';
import { state, saveProfile, updateProfileManual, saveProgress } from '../state.js';
import { profileSummary, typeInfo, speakingPitch, extremeHeld, computeProfile, VOICE_TYPES } from '../core/voice.js';
import { breathDuration, breathOn, breathRef } from '../core/scoring.js';
import { stdev, median, noteName } from '../core/music.js';
import { engine } from '../audio/engine.js';
import { recordAttempt } from '../core/progress.js';

export function VoiceScreen() {
  const st = useAppState();
  const p = st.profile;
  const s = profileSummary(p, st.settings.notation);
  const t = typeInfo(p.type);
  const [edit, setEdit] = useState(false);
  const pos = (m) => `${Math.max(0, Math.min(100, ((m - 36) / 48) * 100))}%`;
  return html`<div class="screen">
    <${TopBar} title="Můj hlas" sub=${p.measured ? 'Změřeno testem' : 'Výchozí odhad – udělej test hlasu'} backTo="/me" />
    <div class="card outline">
      <div class="tiny dim" style="letter-spacing:.1em;font-weight:800">PRACOVNÍ TÓNINA</div>
      <div class="row mt8"><div style="width:44px;height:44px;border-radius:14px;background:var(--sky);display:grid;place-items:center">🎚️</div><div style="font-size:26px;font-weight:900">${s.key}</div></div>
      <div class="small muted mt8">Cvičení začínají na „do“ = ${fmtNote(p.workingTonic)} a posouvají se jen v pohodlném rozsahu.</div>
    </div>
    <div class="card mt16">
      <div class="tiny dim" style="letter-spacing:.1em;font-weight:800">ROZSAH</div>
      <div style="position:relative;height:26px;margin-top:10px"><div style="position:absolute;top:10px;left:0;right:0;height:6px;border-radius:3px;background:#eeece7"></div>
        <div style=${`position:absolute;top:10px;height:6px;border-radius:3px;background:#e4e0fa;left:${pos(p.low)};width:calc(${pos(p.highAll)} - ${pos(p.low)})`}></div>
        <div style=${`position:absolute;top:8px;height:10px;border-radius:5px;background:#f4a7b3;left:${pos(p.comfortLow)};width:calc(${pos(p.comfortHigh)} - ${pos(p.comfortLow)})`}></div>
        ${p.speakMidi ? html`<div style=${`position:absolute;top:0;left:${pos(p.speakMidi)};width:12px;height:12px;border-radius:6px;background:#e06a7c;transform:translateX(-6px)`}></div>` : null}</div>
      <div class="row between tiny dim"><span>C2</span><span>C6</span></div>
      <div class="kv mt16" style="font-size:16px"><span>Celý rozsah</span><b>${s.range}</b><span>Hrudní hlas</span><b>${s.chest}</b><span>Pohodlný rozsah</span><b>${s.comfort}</b><span>Tessitura</span><b>${s.tess}</b><span>Mluvená výška</span><b>${s.speaking}</b></div>
    </div>
    <div class="card mt16">
      <div class="tiny dim" style="letter-spacing:.1em;font-weight:800">DECH</div>
      <div class="kv mt8" style="font-size:16px"><span>Výdrž „sss“</span><b>${p.breathHold != null ? p.breathHold.toFixed(1) + ' s' : '–'}</b><span>Řízení výdechu</span><b>${p.breathControl != null ? p.breathControl + ' %' : '–'}</b></div>
    </div>
    <div class="card hero mt16"><div class="small muted">Typ hlasu</div><h2>${t.name}</h2><p class="mt8">${t.desc}</p>
      <p class="tiny muted">Typ určuji jen podle změřeného rozsahu, tessitury a mluvené výšky. Je to orientační popis – trénovaný hlas se rozšiřuje.</p></div>
    <div class="section-title">Vývoj rozsahu</div>
    <div class="card tight"><${RangeChart} history=${st.profileHistory} /><div class="tiny dim mt8">Červeně hrudní hlas, fialově falzet.</div></div>
    <div class="col mt16">
      <a class="btn primary block" href="#/voicetest">🎙️ ${p.measured ? 'Zopakovat test hlasu' : 'Udělat test hlasu'}</a>
      <button class="btn block" onClick=${() => setEdit(true)}>✏️ Upravit hranice ručně</button>
    </div>
    ${edit ? html`<${ManualEdit} onClose=${() => setEdit(false)} />` : null}
  </div>`;
}

function ManualEdit({ onClose }) {
  const p = state.profile;
  const [v, setV] = useState({ low: p.low, highChest: p.highChest, highFalsetto: p.highFalsetto ?? p.highAll, comfortLow: p.comfortLow, comfortHigh: p.comfortHigh });
  const row = (k, label) => html`<div class="row between mt8"><span style="font-weight:700">${label}</span><div class="row"><button class="iconbtn" onClick=${() => setV({ ...v, [k]: v[k] - 1 })}>−</button><b style="width:56px;text-align:center">${fmtNote(v[k])}</b><button class="iconbtn" onClick=${() => setV({ ...v, [k]: v[k] + 1 })}>＋</button></div></div>`;
  const save = async () => {
    if (v.low >= v.highChest - 4) return toast('Rozsah je příliš malý.');
    const cl = Math.max(v.low, Math.min(v.comfortLow, v.highChest - 4)), ch = Math.min(v.highChest, Math.max(v.comfortHigh, cl + 4));
    await updateProfileManual({ low: v.low, highChest: v.highChest, highFalsetto: Math.max(v.highChest, v.highFalsetto), manual: { comfortLow: cl, comfortHigh: ch } });
    toast('Profil upraven.'); onClose();
  };
  return html`<${Sheet} onClose=${onClose}><h2>Ruční úprava</h2>
    ${row('low', 'Nejnižší tón')}${row('highChest', 'Nejvyšší hrudní')}${row('highFalsetto', 'Nejvyšší falzet')}${row('comfortLow', 'Pohodlí od')}${row('comfortHigh', 'Pohodlí do')}
    <p class="tiny dim mt8">Cvičení nikdy nepůjdou nad nejvyšší hrudní tón (falzetová cvičení nad falzet).</p>
    <button class="btn primary block mt16" onClick=${save}>Uložit</button></${Sheet}>`;
}

const STEPS = [
  { id: 'speak', title: 'Mluvená výška', text: 'Přečti nahlas svým běžným hlasem: „Dobrý den, dnes je krásný den a já se učím zpívat. Jedna, dva, tři, čtyři, pět.“', sec: 9, icon: '🗣️' },
  { id: 'low', title: 'Nejnižší tón', text: 'Zazpívej pohodlný tón na „ó“ a pomalu klouzej dolů až k nejnižšímu tónu, který ještě zní (ne chrčí). Tam ho vydrž aspoň 1 sekundu.', sec: 14, icon: '⬇️' },
  { id: 'high', title: 'Nejvyšší hrudní tón', text: 'Plným (hrudním) hlasem na „á“ klouzej nahoru, ale jen kam to jde bez tlaku a bez křiku. Nejvyšší pohodlný tón vydrž 1 sekundu.', sec: 14, icon: '⬆️' },
  { id: 'falsetto', title: 'Nejvyšší falzet', text: 'Lehkým, vzdušným hlasem („ú“ jako sova) klouzej co nejvýš to jde bez námahy. Nejvyšší tón vydrž 1 sekundu. Pokud falzet neumíš, krok přeskoč.', sec: 14, icon: '🦉' },
  { id: 'breath', title: 'Výdrž dechu', text: 'Nadechni se do břicha a vydechuj na tiché, rovné „sss“ co nejdéle.', sec: 30, icon: '🌬️' },
  { id: 'control', title: 'Řízení výdechu', text: 'Vydechuj na „fff“ 8 sekund se stále stejnou silou – co nejrovnoměrněji.', sec: 10, icon: '📏' },
];

export function VoiceTestScreen({ query }) {
  const lessonId = query?.get('lesson');
  const [step, setStep] = useState(-1);
  const [res, setRes] = useState({});
  const [rec, setRec] = useState(null); // {t0, frames}
  const [, force] = useState(0);
  const framesRef = useRef([]);
  useWakeLock(step >= 0);
  useFrames((fr) => { if (rec) for (const f of fr) framesRef.current.push({ ...f, t: f.t - rec.t0 }); });
  useInterval(() => force((x) => x + 1), rec ? 120 : null);
  const S = STEPS[step];
  const startRec = async () => { await engine.ensureContext(); framesRef.current = []; const t0 = engine.now + 0.3; if (engine.testBuffer) engine.startTestInput(t0); setRec({ t0, started: performance.now() }); };
  const finishRec = () => {
    const all = framesRef.current;
    const ref = breathRef(all, 0);
    const fr = all.filter((f) => f.t >= 0);
    engine.stopTestInput();
    setRec(null);
    let val = null;
    if (S.id === 'speak') val = speakingPitch(fr);
    if (S.id === 'low') val = extremeHeld(fr, 'low', 0.5);
    if (S.id === 'high' || S.id === 'falsetto') val = extremeHeld(fr, 'high', 0.5);
    if (S.id === 'breath') val = breathDuration(fr, 0, 60, { ref });
    if (S.id === 'control') {
      const on = fr.filter((f) => breathOn(f, ref)).map((f) => f.db);
      const dur = breathDuration(fr, 0, 60, { ref });
      val = on.length > 50 ? Math.round(Math.max(0, Math.min(100, 100 - (stdev(on) - 1.5) * 12)) * Math.min(1, dur / 6)) : null;
    }
    setRes({ ...res, [S.id]: val, ['_' + S.id]: true });
  };
  useEffect(() => {
    if (!rec) return;
    const el = (performance.now() - rec.started) / 1000;
    if (el > S.sec + 1) finishRec();
  });
  const live = (() => {
    const fr = framesRef.current;
    const v = fr.filter((f) => f.voiced && f.midi != null);
    const cur = v.length ? v[v.length - 1].midi : null;
    if (!S) return null;
    if (S.id === 'low') { const x = extremeHeld(fr, 'low', 0.5); return { cur, best: x, label: 'Nejnižší držený' }; }
    if (S.id === 'high' || S.id === 'falsetto') { const x = extremeHeld(fr, 'high', 0.5); return { cur, best: x, label: 'Nejvyšší držený' }; }
    if (S.id === 'breath' || S.id === 'control') return { secs: breathDuration(fr.filter((f) => f.t >= 0), 0, 60, { ref: breathRef(fr, 0) }) };
    return { cur };
  })();
  const finishAll = async () => {
    const p0 = state.profile;
    const low = res.low ?? p0.low, highChest = Math.max(res.high ?? p0.highChest, low + 5);
    const p = await saveProfile({ low, highChest, highFalsetto: res.falsetto != null ? Math.max(res.falsetto, highChest) : Math.max(highChest, p0.highFalsetto ?? highChest), speakingHz: res.speak ?? p0.speakingHz, breathHold: res.breath ?? p0.breathHold, breathControl: res.control ?? p0.breathControl, measured: true });
    if (lessonId) { recordAttempt(state.progress, { type: 'lesson', id: lessonId, score: 100, stars: 3, seconds: 180 }); await saveProgress(); }
    else { recordAttempt(state.progress, { type: 'tool', id: 'voicetest', seconds: 180 }); await saveProgress(); }
    setStep(STEPS.length);
    return p;
  };
  if (step === -1) {
    return html`<div class="screen">
      <${TopBar} title="Test hlasu" sub="asi 3 minuty" backTo="/me" />
      <div class="card"><p>Změříme tvou mluvenou výšku, nejnižší a nejvyšší tón (zvlášť hrudní hlas a falzet) a dech. Podle toho nastavím pracovní tóninu a posunu cvičení i písně.</p>
        <ul class="small muted"><li>Najdi tiché místo, sluchátka nejsou potřeba.</li><li>Nic netlač – měříme pohodlný hlas, ne rekord.</li><li>Každý krok můžeš zopakovat nebo přeskočit.</li></ul></div>
      <${MicGate}><div class="card mt16"><${LevelMeter} /></div></${MicGate}>
      <div class="bottom-actions"><button class="btn primary big block" onClick=${() => setStep(0)}>Začít test</button></div>
    </div>`;
  }
  if (step >= STEPS.length) {
    const p = state.profile, s = profileSummary(p, state.settings.notation), t = typeInfo(p.type);
    return html`<div class="screen">
      <${TopBar} title="Výsledek testu" backTo="/me" />
      <div class="card hero center"><div class="small muted">Tvůj hlas</div><h1 style="font-size:40px">${t.name}</h1><p class="mt8">${t.desc}</p></div>
      <div class="card mt16"><div class="kv" style="font-size:16px"><span>Celý rozsah</span><b>${s.range}</b><span>Hrudní hlas</span><b>${s.chest}</b><span>Pohodlný rozsah</span><b>${s.comfort}</b><span>Tessitura</span><b>${s.tess}</b><span>Mluvená výška</span><b>${s.speaking}</b><span>Pracovní tónina</span><b>${s.key}</b>
        <span>Výdrž dechu</span><b>${p.breathHold != null ? p.breathHold.toFixed(1) + ' s' : '–'}</b><span>Řízení výdechu</span><b>${p.breathControl != null ? p.breathControl + ' %' : '–'}</b></div></div>
      <p class="tiny dim mt8">Typ hlasu vychází jen z měření. Rozsah se tréninkem mění – test zopakuj třeba za měsíc.</p>
      <div class="col mt16"><button class="btn primary big block" onClick=${() => navigate(lessonId ? '/lesson/' + lessonId : '/', true)}>Hotovo</button><a class="btn block" href="#/voice">Zobrazit profil</a></div>
    </div>`;
  }
  const done = res['_' + S.id];
  const fmtVal = () => {
    const v = res[S.id];
    if (v == null) return 'nenaměřeno';
    if (S.id === 'speak') return `${v.toFixed(0)} Hz (${noteName(Math.round(69 + 12 * Math.log2(v / 440)), { style: state.settings.notation === 'solf' ? 'cz' : state.settings.notation })})`;
    if (S.id === 'breath') return `${v.toFixed(1)} s`;
    if (S.id === 'control') return `${v} %`;
    return fmtNote(v);
  };
  const el = rec ? (performance.now() - rec.started) / 1000 : 0;
  return html`<div class="screen">
    <${TopBar} title=${`${step + 1}/${STEPS.length} · ${S.title}`} onBack=${() => (rec ? null : setStep(step - 1))} />
    <div class="progress-seg mb16">${STEPS.map((_, i) => html`<i style=${`background:${i < step ? '#a8dcc9' : i === step ? '#f0a35e' : '#e9e6df'}`}></i>`)}</div>
    <div class="card"><div style="font-size:40px">${S.icon}</div><p class="lesson-text mt8">${S.text}</p></div>
    <${MicGate}>
      <div class="card mt16 center">
        ${rec ? html`<div class="small muted">Nahrávám… ${Math.max(0, Math.ceil(S.sec - el))} s</div>` : null}
        ${live && live.secs != null ? html`<div style="font-size:56px;font-weight:900">${live.secs.toFixed(1)} s</div>`
          : html`<div style="font-size:56px;font-weight:900">${live?.cur != null ? fmtNote(Math.round(live.cur)) : '–'}</div>
            ${live?.label ? html`<div class="small muted">${live.label}: <b class="c-acc">${live.best != null ? fmtNote(live.best) : '–'}</b></div>` : null}`}
        <div class="mt8"><${LevelMeter} showText=${false} /></div>
        ${done && !rec ? html`<div class="mt16 pill-tip">Naměřeno: <b>${fmtVal()}</b></div>` : null}
      </div>
    </${MicGate}>
    <div class="bottom-actions">
      ${rec ? html`<button class="btn primary big block" onClick=${finishRec}>■ Hotovo</button>`
        : done ? html`<button class="btn grow" onClick=${startRec}>↻ Znovu</button><button class="btn primary grow" onClick=${() => (step + 1 >= STEPS.length ? finishAll() : setStep(step + 1))}>${step + 1 >= STEPS.length ? 'Výsledek' : 'Další →'}</button>`
          : html`<button class="btn grow" onClick=${() => { setRes({ ...res, ['_' + S.id]: true }); step + 1 >= STEPS.length ? finishAll() : setStep(step + 1); }}>Přeskočit</button><button class="btn primary grow" onClick=${startRec}>🎙️ Start</button>`}
    </div>
  </div>`;
}
