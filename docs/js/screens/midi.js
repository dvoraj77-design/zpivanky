// Import písně z MIDI / karaoke (.mid, .kar): výběr stopy s melodií, nástroje doprovodu, text, tempo.
import { html, useState, useEffect, useRef, navigate, TopBar, toast, fmtNote, fmtTime, plural } from '../ui/common.js';
import { Hint } from '../ui/hints.js';
import { saveCustomSong, state, saveSettings } from '../state.js';
import { USER_STYLES } from '../data/songs.js';
import { engine } from '../audio/engine.js';
import { Transport } from '../audio/transport.js';
import { parseMidi, analyzeMidi, buildMidiSong, melodyNotes, MIDI_INSTRUMENTS } from '../core/midi.js';
import { validateSong } from '../core/song.js';
import { plainLines } from '../core/importutil.js';

export function MidiImportScreen() {
  const [an, setAn] = useState(null);
  const [file, setFile] = useState(null);
  const [batch, setBatch] = useState(null);
  const [err, setErr] = useState(null);
  const onFile = async (e) => {
    const files = [...(e.target.files || [])];
    if (files.length > 1) { setBatch(files); e.target.value = ''; return; }
    const f = files[0]; if (!f) return;
    setErr(null);
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const a = analyzeMidi(parseMidi(buf), { fileName: f.name });
      if (!a.parts.some((p) => !p.drums)) throw new Error('V souboru nejsou žádné noty.');
      setFile(f.name); setAn(a);
    } catch (x) { setErr(x.message || String(x)); } finally { e.target.value = ''; }
  };
  if (batch) return html`<${BatchImport} files=${batch} onBack=${() => setBatch(null)} />`;
  if (an) return html`<${MidiSetup} an=${an} fileName=${file} onBack=${() => setAn(null)} />`;
  return html`<div class="screen">
    <${TopBar} title="Píseň z MIDI" backTo="/songs" />
    <${Hint} id="midi" title="Co je MIDI a karaoke soubor">MIDI (.mid) a karaoke (.kar) soubory obsahují přesné noty všech nástrojů – i melodii zpěvu, často i s textem. Aplikace z nich udělá píseň s <b>původním aranžmá</b> (zahrají ho nástroje v telefonu), vodicí melodií a textem. Vše zůstává v telefonu.</${Hint}>
    <label class="item card" style="cursor:pointer;display:flex;align-items:center;gap:12px">
      <div class="ic">🎼</div><div class="grow"><div class="t" style="font-weight:800">Vybrat soubory .mid nebo .kar</div><div class="s small muted">Jeden soubor = nastavíš si ho; víc najednou = hromadný import do knihovny</div></div><div class="chev">›</div>
      <input type="file" multiple style="display:none" onChange=${onFile} data-testid="midi-file" />
    </label>
    ${err ? html`<div class="card warnc mt16 small">${err}</div>` : null}
    <div class="section-title">Kde MIDI sehnat</div>
    <div class="card small muted">Karaoke a MIDI verze písní najdeš na internetu – hledej „<b>název písně midi</b>“ nebo „<b>název písně kar</b>“. Nejlepší jsou soubory, kde je melodie zpěvu ve zvláštní stopě (karaoke .kar mají i text). Stažený soubor pak vyber tady. Importované písně jsou jen pro tvoje cvičení.</div>
  </div>`;
}

function MidiSetup({ an, fileName, onBack }) {
  const voices = an.parts.filter((p) => !p.drums).sort((a, b) => b.score - a.score);
  const [melId, setMelId] = useState(an.melodyId);
  const [inst, setInst] = useState(() => Object.fromEntries(an.parts.map((p) => [p.id, p.inst || 'off'])));
  const [title, setTitle] = useState(an.title);
  const [artist, setArtist] = useState(an.artist || '');
  const [tempo, setTempo] = useState(Math.round(an.tempo));
  const [lyrMode, setLyrMode] = useState(an.hasLyrics ? 'midi' : 'none');
  const [style, setStyle] = useState(state.settings.midiStyle || 'pop');
  const [text, setText] = useState('');
  const [err, setErr] = useState(null);
  const [playing, setPlaying] = useState(null);
  const stopRef = useRef(null);
  useEffect(() => () => stopRef.current?.(), []);
  const preview = async (p) => {
    stopRef.current?.(); stopRef.current = null;
    if (playing === p.id) { setPlaying(null); return; }
    await engine.ensureContext();
    const ns = melodyNotes(p, an.beatTicks);
    const t0 = ns[0]?.tick ?? 0;
    const seq = ns.filter((n) => (n.tick - t0) / an.beatTicks < 16).map((n) => ({ midi: n.pitch, t: (n.tick - t0) / an.beatTicks, d: Math.min(2, n.dur / an.beatTicks) }));
    await engine.loadInstruments(['piano']).catch(() => {});
    const len = Math.max(...seq.map((x) => x.t + x.d));
    const tr = new Transport(engine);
    tr.load({ events: seq.map((x) => ({ ...x, inst: 'piano', vel: 0.75, bus: 'preview' })), tempo, length: len });
    tr.onEnd = () => setPlaying((x) => (x === p.id ? null : x));
    tr.start(0, 0.1);
    setPlaying(p.id);
    stopRef.current = () => tr.stop();
  };
  const create = async () => {
    setErr(null);
    try {
      const lines = lyrMode === 'own' ? plainLines(text).map((l) => l.text) : null;
      if (lyrMode === 'own' && !lines.length) throw new Error('Vlož text, nebo zvol jinou možnost.');
      const a2 = { ...an, tempo: Math.max(30, Math.min(240, tempo || an.tempo)), lyrics: lyrMode === 'midi' ? an.lyrics : [] };
      const song = buildMidiSong(a2, { melodyId: melId, partInst: inst, title: title || an.title, artist, lyricsLines: lines, style });
      saveSettings({ midiStyle: style });
      const errs = validateSong(song);
      if (errs.length) throw new Error('Píseň se nepodařilo sestavit: ' + errs.slice(0, 3).join(', '));
      await saveCustomSong(song);
      toast(`Píseň vytvořena – ${plural(song.notes.length, 'nota', 'noty', 'not')}, ${plural(song.backing.tracks.filter((t) => t.inst !== 'off').length, 'nástroj', 'nástroje', 'nástrojů')} doprovodu.`, 3500);
      navigate('/song/' + song.id + '?imported=1', true);
    } catch (e) { setErr(e.message || String(e)); }
  };
  const mel = an.parts.find((p) => p.id === melId);
  return html`<div class="screen">
    <${TopBar} title="Nová píseň z MIDI" sub=${fileName} onBack=${onBack} />
    <div class="card col">
      <label class="field">Název<input type="text" value=${title} onInput=${(e) => setTitle(e.target.value)} data-testid="midi-title" /></label>
      <label class="field">Interpret<input type="text" value=${artist} onInput=${(e) => setArtist(e.target.value)} placeholder="nepovinné" /></label>
      <label class="field">Styl (třídění v knihovně)<select value=${style} onChange=${(e) => setStyle(e.target.value)}>${USER_STYLES.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></label>
      <div class="grid2"><label class="field">Tempo (BPM)<input type="number" min="30" max="240" value=${tempo} onInput=${(e) => setTempo(parseInt(e.target.value || '0', 10))} data-testid="midi-tempo" /></label>
        <div class="field">Takt a délka<div class="small" style="padding:10px 0">${an.bpb}/${an.unit} · ${fmtTime(an.duration)}${an.keySig ? ' · ' + an.keySig.tonic + (an.keySig.mode === 'minor' ? ' moll' : ' dur') : ''}</div></div></div>
    </div>

    <div class="section-title">Která stopa je melodie zpěvu?</div>
    <div class="list" data-testid="midi-parts">${voices.map((p) => html`<div class=${'item' + (melId === p.id ? ' sel' : '')} style=${melId === p.id ? 'outline:2px solid var(--accent)' : ''}>
      <button class="grow" style="text-align:left;background:none;border:0;padding:0;color:inherit" onClick=${() => setMelId(p.id)} aria-pressed=${melId === p.id}>
        <div class="t">${melId === p.id ? '🎤 ' : ''}${p.trackName || p.gmName}</div>
        <div class="s">${p.gmName} · ${plural(p.count, 'nota', 'noty', 'not')} · ${fmtNote(p.lo)}–${fmtNote(p.hi)}${p.poly > 0.3 ? ' · akordy' : ''}${p.lyricFit > 0.5 ? ' · s textem' : ''}${p.id === an.melodyId ? ' · ★ odhad' : ''}</div></button>
      <button class="iconbtn" aria-label="Poslechnout stopu" onClick=${() => preview(p)}>${playing === p.id ? '■' : '▶'}</button>
    </div>`)}</div>

    <div class="section-title">Doprovod (ostatní stopy)</div>
    <div class="card col">${an.parts.filter((p) => p.id !== melId).map((p) => html`<div class="row between" style="gap:10px;align-items:center">
      <div class="grow small" style="min-width:0"><b class="ellipsis" style="display:block">${p.trackName || p.gmName}</b><span class="tiny dim">${p.gmName} · ${plural(p.count, 'nota', 'noty', 'not')}</span></div>
      <select value=${inst[p.id]} onChange=${(e) => setInst({ ...inst, [p.id]: e.target.value })} style="width:46%;flex:none" aria-label=${'Nástroj pro ' + (p.trackName || p.gmName)}>
        ${MIDI_INSTRUMENTS.filter(([k]) => (p.drums ? k === 'drum' || k === 'off' : k !== 'drum')).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></div>`)}
      ${an.parts.length <= 1 ? html`<p class="small muted">Soubor má jen melodii – doprovod se vytvoří z akordů (styly doprovodu jako u ostatních písní).</p>` : null}
    </div>

    <div class="section-title">Text</div>
    <div class="card col">
      <div class="seg" role="tablist">${[...(an.hasLyrics ? [['midi', 'Z MIDI']] : []), ['own', 'Vložit vlastní'], ['none', 'Bez textu']].map(([v, l]) => html`<button role="tab" aria-selected=${lyrMode === v} class=${lyrMode === v ? 'on' : ''} onClick=${() => setLyrMode(v)}>${l}</button>`)}</div>
      ${lyrMode === 'midi' ? html`<p class="small muted">V souboru je text (${plural(an.lyrics.length, 'slabika', 'slabiky', 'slabik')}). ${mel && mel.lyricFit < 0.6 ? html`<span class="c-warn">Text k vybrané stopě moc nesedí – zkus jinou stopu.</span>` : 'Slabiky se přiřadí k notám melodie.'}</p>` : null}
      ${lyrMode === 'own' ? html`<textarea value=${text} onInput=${(e) => setText(e.target.value)} placeholder="Každý řádek textu na nový řádek" data-testid="midi-lyrics"></textarea>` : null}
      ${lyrMode === 'none' ? html`<p class="small muted">Noty dostanou slabiku „la“. Text můžeš doplnit později přes ✏️.</p>` : null}
    </div>
    ${err ? html`<div class="card warnc small mt16">${err}</div>` : null}
    <div class="bottom-actions"><button class="btn primary big block" onClick=${create} data-testid="midi-create">✨ Vytvořit píseň</button></div>
  </div>`;
}

/** Hromadný import: každý soubor → píseň s odhadnutou melodií, textem z MIDI a výchozími nástroji. */
function BatchImport({ files, onBack }) {
  const [style, setStyle] = useState(state.settings.midiStyle || 'pop');
  const [rows, setRows] = useState(files.map((f) => ({ name: f.name, status: 'čeká' })));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const run = async () => {
    setRunning(true); saveSettings({ midiStyle: style });
    const out = rows.slice();
    for (let i = 0; i < files.length; i++) {
      out[i] = { ...out[i], status: '…' }; setRows(out.slice());
      try {
        const an = analyzeMidi(parseMidi(new Uint8Array(await files[i].arrayBuffer())), { fileName: files[i].name });
        const song = buildMidiSong(an, { style });
        const errs = validateSong(song);
        if (errs.length) throw new Error(errs[0]);
        await saveCustomSong(song);
        out[i] = { ...out[i], ok: true, status: `✓ ${song.title} · ${plural(song.notes.length, 'nota', 'noty', 'not')}${song.analysis.lyricsFromMidi ? ' · s textem' : ''}` };
      } catch (e) { out[i] = { ...out[i], ok: false, status: '✕ ' + (e.message || e) }; }
      setRows(out.slice());
      await new Promise((r) => setTimeout(r, 0));
    }
    setRunning(false); setDone(true);
  };
  const ok = rows.filter((r) => r.ok).length;
  return html`<div class="screen">
    <${TopBar} title="Hromadný import" sub=${plural(files.length, 'soubor', 'soubory', 'souborů')} onBack=${running ? null : onBack} />
    <div class="card col">
      <label class="field">Styl pro všechny (třídění v knihovně)<select value=${style} disabled=${running || done} onChange=${(e) => setStyle(e.target.value)}>${USER_STYLES.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></label>
      <p class="small muted">Melodii, text i nástroje aplikace odhadne sama. Když u některé písně melodie nesedí, otevři ji a v úpravách (✏️) nebo novým importem jednoho souboru vyber jinou stopu.</p>
    </div>
    <div class="list mt16" data-testid="batch-rows">${rows.map((r) => html`<div class="item"><div class="grow"><div class="t ellipsis">${r.name}</div><div class=${'s ' + (r.ok === false ? 'c-warn' : r.ok ? 'c-good' : '')}>${r.status}</div></div></div>`)}</div>
    <div class="bottom-actions">${done ? html`<button class="btn primary big block" onClick=${() => { try { sessionStorage.setItem('zp-songs-filter', JSON.stringify({ cat: 'moje', lvl: 0, sty: style })); } catch { /* */ } navigate('/songs', true); }} data-testid="batch-done">Hotovo – ${plural(ok, 'píseň', 'písně', 'písní')} v knihovně</button>`
      : html`<button class="btn primary big block" disabled=${running} onClick=${run} data-testid="batch-go">${running ? 'Importuji…' : `✨ Importovat ${plural(files.length, 'soubor', 'soubory', 'souborů')}`}</button>`}</div>
  </div>`;
}
