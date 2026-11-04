// Import písně: soubor z telefonu nebo nahrávka mikrofonem → oddělení zpěvu → noty, akordy, text → nová píseň.
import { html, useState, useEffect, useRef, navigate, TopBar, Seg, toast, fmtTime, MicGate, useWakeLock, LevelMeter, plural } from '../ui/common.js';
import { Hint } from '../ui/hints.js';
import { state, saveSettings } from '../state.js';
import { engine } from '../audio/engine.js';
import {
  decodeFile, decodePcm, cut, isMonoAudio, parseFileName, readTags, importSong, cancelWork, modelReady, downloadModel,
  MODEL_MB, MAX_SECONDS, STAGES,
} from '../app/importer.js';

const MODE_INFO = {
  fast: ['⚡ Rychle', 'Oddělí zpěv podle stereo obrazu. Hotovo za chvilku, ale u některých nahrávek zůstane ve zpěvu kus doprovodu.'],
  precise: ['🎯 Přesně', `Umělá inteligence přímo v telefonu (model MDX-Net). Mnohem čistší oddělení, ale trvá déle. Model (${MODEL_MB} MB) se stáhne jen poprvé.`],
};

export function ImportScreen() {
  const [step, setStep] = useState('source'); // source | rec | prep | run
  const [audio, setAudio] = useState(null);
  const [meta, setMeta] = useState({ title: '', artist: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setErr(null); setBusy('Načítám soubor…');
    try {
      const [a, tags] = await Promise.all([decodeFile(f), readTags(f)]);
      if (a.duration < 8) throw new Error('Nahrávka je moc krátká (aspoň 8 sekund).');
      const fromName = parseFileName(f.name);
      setMeta({ title: tags.title || fromName.title, artist: tags.artist || fromName.artist });
      setAudio({ ...a, source: 'file', name: f.name });
      setStep('prep');
    } catch (x) { setErr(x.message); } finally { setBusy(null); e.target.value = ''; }
  };

  if (step === 'rec') return html`<${RecordSource} onCancel=${() => setStep('source')} onDone=${(a) => { setAudio({ ...a, source: 'mic' }); setMeta({ title: '', artist: '' }); setStep('prep'); }} />`;
  if (step === 'prep' && audio) return html`<${Prepare} audio=${audio} meta=${meta} setMeta=${setMeta} onBack=${() => { setAudio(null); setStep('source'); }} />`;

  return html`<div class="screen">
    <${TopBar} title="Importovat píseň" backTo="/songs" />
    <${Hint} id="import" title="Jak import funguje">Aplikace v nahrávce najde zpěv, převede ho na noty, pozná tempo, takt a akordy a připraví doprovod bez zpěvu. Vše se počítá <b>přímo v telefonu</b>, nahrávka se nikam neposílá. Výsledek je odhad – text a noty můžeš potom upravit.</${Hint}>
    <div class="list">
      <label class="item" style="cursor:pointer">
        <div class="ic">📁</div><div class="grow"><div class="t">Soubor z telefonu</div><div class="s">MP3, M4A, WAV, OGG, FLAC · nejvýš ${MAX_SECONDS / 60} minut</div></div><div class="chev">›</div>
        <input ref=${fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac,.opus" style="display:none" onChange=${onFile} data-testid="import-file" />
      </label>
      <button class="item" onClick=${() => setStep('rec')}>
        <div class="ic">🎙️</div><div class="grow"><div class="t">Nahrát mikrofonem</div><div class="s">Pusť píseň z jiného zařízení a nahraj ji</div></div><div class="chev">›</div>
      </button>
    </div>
    ${busy ? html`<div class="card infoc mt16 small">${busy}</div>` : null}
    ${err ? html`<div class="card warnc mt16 small">${err}</div>` : null}
    <div class="section-title">A co Spotify nebo YouTube?</div>
    <div class="card small muted">Zvuk ze Spotify (a jiných streamovacích služeb) je chráněný – aplikace ho nemůže stáhnout ani nahrát přímo z telefonu.
      Můžeš ale píseň pustit nahlas z <b>jiného zařízení</b> (počítač, reproduktor, druhý telefon) a nahrát ji tady mikrofonem, nebo použít vlastní soubor MP3.
      Importované písně slouží jen pro tvoje vlastní cvičení.</div>
  </div>`;
}

/** Nahrání písně mikrofonem. */
function RecordSource({ onCancel, onDone }) {
  const [phase, setPhase] = useState('ready');
  const [t, setT] = useState(0);
  const [err, setErr] = useState(null);
  const t0 = useRef(0);
  useWakeLock(phase === 'rec');
  useEffect(() => {
    if (phase !== 'rec') return;
    const iv = setInterval(() => { const s = (performance.now() - t0.current) / 1000; setT(s); if (s >= MAX_SECONDS) stop(); }, 250);
    return () => clearInterval(iv);
  }, [phase]);
  const start = async () => {
    setErr(null);
    await engine.ensureContext();
    engine.startRecording({ full: true });
    if (engine.testBuffer) engine.startTestInput(engine.now + 0.05);
    t0.current = performance.now(); setT(0); setPhase('rec');
  };
  const stop = async () => {
    setPhase('proc');
    const r = await engine.stopRecording();
    engine.stopTestInput();
    try {
      if (!r.pcm.length || r.pcm.length / r.rate < 8) throw new Error('Nahrávka je moc krátká (aspoň 8 sekund).');
      const a = await decodePcm(r.pcm, r.rate);
      onDone(a);
    } catch (e) { setErr(e.message); setPhase('ready'); }
  };
  return html`<div class="screen">
    <${TopBar} title="Nahrát píseň" onBack=${() => { if (phase === 'rec') engine.stopRecording().then(() => engine.stopTestInput()); onCancel(); }} />
    <div class="card small">
      <ol style="margin:0;padding-left:18px;line-height:1.6">
        <li>Pusť píseň na <b>jiném zařízení</b> pořádně nahlas (ne ze sluchátek).</li>
        <li>Polož telefon blízko reproduktoru, v tiché místnosti.</li>
        <li>Klepni na <b>Nahrávat</b>, pusť píseň a na konci klepni na <b>Hotovo</b>.</li>
      </ol>
      <p class="tiny dim mt8">Nahrávka z mikrofonu je mono – pro oddělení zpěvu proto zvol režim <b>Přesně</b>.</p>
    </div>
    <${MicGate}>
      <div class="card center mt16">
        <div style="font-size:42px;font-weight:900" class=${phase === 'rec' ? 'c-bad' : ''}>${phase === 'rec' ? '● ' : ''}${fmtTime(t)}</div>
        <div class="mt8"><${LevelMeter} /></div>
      </div>
    </${MicGate}>
    ${err ? html`<div class="card warnc mt16 small">${err}</div>` : null}
    <div class="bottom-actions">
      ${phase === 'ready' ? html`<button class="btn primary big block" onClick=${start}>🎙️ Nahrávat</button>` : null}
      ${phase === 'rec' ? html`<button class="btn primary big block" onClick=${stop}>■ Hotovo</button>` : null}
      ${phase === 'proc' ? html`<button class="btn big block" disabled>Zpracovávám…</button>` : null}
    </div>
  </div>`;
}

function estimate(mode, sec, modelOk) {
  const sp = state.settings.importSpeed || {};
  if (mode === 'fast') return Math.max(5, sec * (sp.fast ?? 0.15));
  return sec * (sp.precise ?? 5) + (modelOk ? 0 : 60);
}
const fmtMin = (s) => (s < 90 ? `asi ${Math.max(5, Math.round(s / 5) * 5)} s` : `asi ${Math.round(s / 60)} min`);

function Prepare({ audio, meta, setMeta, onBack }) {
  const mono = audio.source === 'mic' || isMonoAudio(audio);
  const [mode, setMode] = useState(state.settings.importMode || (mono ? 'precise' : 'fast'));
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(Math.min(audio.duration, MAX_SECONDS));
  const [lyrMode, setLyrMode] = useState(audio.source === 'mic' ? 'manual' : 'auto');
  const [lyrText, setLyrText] = useState('');
  const [modelOk, setModelOk] = useState(null);
  const [run, setRun] = useState(null); // {stage, p, eta}
  const [err, setErr] = useState(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => { modelReady().then(setModelOk); }, []);
  useEffect(() => () => { try { preview?.stop(); } catch { /* */ } }, [preview]);
  useWakeLock(!!run);
  const len = Math.max(0, to - from);
  const togglePreview = async () => {
    if (preview) { try { preview.stop(); } catch { /* */ } setPreview(null); return; }
    await engine.ensureContext();
    const c = cut(audio, from, Math.min(to, from + 30));
    const b = engine.ctx.createBuffer(2, c.L.length, 44100); b.copyToChannel(c.L, 0); b.copyToChannel(c.R, 1);
    const s = engine.ctx.createBufferSource(); s.buffer = b; s.connect(engine.bus.preview); s.start();
    s.onended = () => setPreview((p) => (p === s ? null : p));
    setPreview(s);
  };
  const go = async () => {
    setErr(null);
    if (preview) { try { preview.stop(); } catch { /* */ } setPreview(null); }
    if (len < 8) { setErr('Vyber aspoň 8 sekund.'); return; }
    if (lyrMode === 'manual' && !lyrText.trim()) { setErr('Vlož text písně, nebo zvol Dohledat / Bez textu.'); return; }
    saveSettings({ importMode: mode });
    const t0 = performance.now();
    try {
      if (mode === 'precise' && !(await modelReady())) {
        setRun({ stage: 'download', p: 0 });
        await downloadModel((p) => setRun({ stage: 'download', p }));
        setModelOk(true);
      }
      const tA = performance.now();
      setRun({ stage: mode === 'precise' ? 'model' : 'separate', p: 0 });
      const part = cut(audio, from, to);
      const r = await importSong({
        audio: part, meta, mode, lyrics: { mode: lyrMode, text: lyrText, fullDuration: audio.duration },
        onProgress: (p) => setRun((old) => ({ ...old, ...p, eta: p.eta ?? (p.stage === old?.stage ? old?.eta : null) })),
      });
      const secs = (performance.now() - tA) / 1000;
      saveSettings({ importSpeed: { ...(state.settings.importSpeed || {}), [mode]: Math.round((secs / part.duration) * 100) / 100 } });
      const found = r.found ? (r.song.analysis.lyricsTimed ? 'text i s časováním' : 'text') : lyrMode === 'auto' ? 'text se nenašel' : '';
      toast(`Hotovo za ${fmtTime((performance.now() - t0) / 1000)} – ${plural(r.song.notes.length, 'nota', 'noty', 'not')}${found ? ', ' + found : ''}.`, 4000);
      navigate('/song/' + r.song.id + '?imported=1', true);
    } catch (e) {
      setRun(null);
      if (!e.cancelled) setErr(e.message || String(e));
    }
  };
  const cancel = () => { cancelWork(); setRun(null); };

  if (run) {
    const label = run.stage === 'download' ? `Stahuji model (${MODEL_MB} MB, jen poprvé)` : STAGES[run.stage] || 'Pracuji';
    const order = ['download', 'model', 'separate', 'rhythm', 'melody', 'lyrics', 'save'];
    return html`<div class="screen">
      <${TopBar} title="Importuji…" sub=${meta.title} onBack=${cancel} />
      <div class="card center mt16" data-testid="import-progress">
        <div style="font-size:44px">${run.stage === 'download' ? '⬇️' : run.stage === 'separate' ? '🎚️' : run.stage === 'melody' ? '🎼' : '🔍'}</div>
        <div class="mt8" style="font-weight:800">${label}</div>
        <div class="bar mt16"><i style=${`width:${Math.round((run.p || 0) * 100)}%`}></i></div>
        <div class="small muted mt8">${Math.round((run.p || 0) * 100)} %${run.eta != null && run.p > 0.02 ? ` · zbývá ${fmtMin(run.eta)}` : ''}${run.backend ? ` · ${run.backend === 'webgpu' ? 'grafický čip' : 'procesor'}` : ''}</div>
      </div>
      <div class="list mt16">${order.filter((s) => s !== 'download' || mode === 'precise').filter((s) => s !== 'model' || mode === 'precise').map((s) => {
        const i = order.indexOf(s), cur = order.indexOf(run.stage);
        return html`<div class="item"><div class="ic">${i < cur ? '✅' : i === cur ? '⏳' : '◻️'}</div><div class="grow small">${s === 'download' ? 'Stažení modelu' : STAGES[s]}</div></div>`;
      })}</div>
      <p class="small muted mt16 center">Nech obrazovku zapnutou a aplikaci v popředí.</p>
      <div class="bottom-actions"><button class="btn block" onClick=${cancel}>Zrušit</button></div>
    </div>`;
  }

  return html`<div class="screen">
    <${TopBar} title="Nová píseň z nahrávky" onBack=${onBack} />
    <div class="card col">
      <label class="field">Název písně<input type="text" value=${meta.title} onInput=${(e) => setMeta({ ...meta, title: e.target.value })} placeholder="Název" data-testid="import-title" /></label>
      <label class="field">Interpret<input type="text" value=${meta.artist} onInput=${(e) => setMeta({ ...meta, artist: e.target.value })} placeholder="Kdo ji zpívá (pro dohledání textu)" data-testid="import-artist" /></label>
      <div class="small muted">${audio.source === 'mic' ? 'Nahrávka z mikrofonu' : audio.name} · ${fmtTime(audio.duration)}${mono ? ' · mono' : ' · stereo'}</div>
    </div>

    <div class="section-title">Úsek ${fmtTime(from)} – ${fmtTime(to)} (${fmtTime(len)})</div>
    <div class="card col">
      <label class="field">Začátek<input type="range" min="0" max=${Math.max(0, audio.duration - 8)} step="1" value=${from} onInput=${(e) => { const v = parseFloat(e.target.value); setFrom(v); if (to < v + 8) setTo(Math.min(audio.duration, v + 8)); }} aria-label="Začátek úseku" /></label>
      <label class="field">Konec<input type="range" min="8" max=${audio.duration} step="1" value=${to} onInput=${(e) => { const v = parseFloat(e.target.value); setTo(v); if (from > v - 8) setFrom(Math.max(0, v - 8)); }} aria-label="Konec úseku" /></label>
      ${len > MAX_SECONDS ? html`<p class="small c-warn">Nejvýš ${MAX_SECONDS / 60} minut – zkrať úsek.</p>` : null}
      <button class="btn sm" onClick=${togglePreview}>${preview ? '■ Zastavit' : '▶ Poslechnout začátek úseku'}</button>
      <p class="tiny dim">Kratší úsek (třeba jen refrén) se zpracuje rychleji.</p>
    </div>

    <div class="section-title">Oddělení zpěvu</div>
    <div class="list">${['fast', 'precise'].map((m) => html`<button class="item" style=${mode === m ? 'outline:2px solid var(--accent)' : ''} onClick=${() => setMode(m)} data-testid=${'mode-' + m}>
      <div class="grow"><div class="t">${MODE_INFO[m][0]} <span class="tiny dim">· ${fmtMin(estimate(m, len, modelOk))}</span></div><div class="s">${MODE_INFO[m][1]}</div>
      ${m === 'precise' ? html`<div class="tiny mt8 ${modelOk ? 'c-good' : 'dim'}">${modelOk ? '✓ Model je v telefonu' : `Model se stáhne při prvním použití (${MODEL_MB} MB, doporučujeme Wi-Fi)`}</div>` : null}</div>
      ${mode === m ? html`<span class="c-acc">●</span>` : null}</button>`)}</div>
    ${mono && mode === 'fast' ? html`<div class="card warnc small mt8">Tahle nahrávka je mono – rychlé oddělení v ní zpěv neoddělí (jen zdůrazní hlasové pásmo). Pro lepší výsledek zvol <b>Přesně</b>.</div>` : null}

    <div class="section-title">Text písně</div>
    <div class="card col">
      <${Seg} options=${[['auto', 'Dohledat'], ['manual', 'Vložit vlastní'], ['none', 'Bez textu']]} value=${lyrMode} onChange=${setLyrMode} />
      ${lyrMode === 'auto' ? html`<p class="small muted">Text se dohledá na <b>lrclib.net</b> (volná databáze textů). Odešle se jen název, interpret a délka písně – nic jiného. Bez internetu nebo když se nenajde, můžeš ho vložit později.</p>` : null}
      ${lyrMode === 'manual' ? html`<textarea value=${lyrText} onInput=${(e) => setLyrText(e.target.value)} placeholder="Každý řádek textu na nový řádek" data-testid="import-lyrics"></textarea>` : null}
      ${lyrMode === 'none' ? html`<p class="small muted">Noty dostanou slabiku „la“. Text můžeš doplnit později.</p>` : null}
    </div>
    ${err ? html`<div class="card warnc small mt16">${err}</div>` : null}
    <div class="bottom-actions"><button class="btn primary big block" onClick=${go} disabled=${len < 8 || len > MAX_SECONDS} data-testid="import-go">✨ Vytvořit píseň</button></div>
  </div>`;
}
