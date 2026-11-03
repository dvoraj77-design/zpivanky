// Písně: knihovna, detail (tónina, tempo, režim), přehrávač, vlastní píseň (editor, nazpívání).
import { html, useState, useEffect, useRef, useMemo, useAppState, navigate, TopBar, Seg, Sheet, toast, fmtNote, Stars, scoreClass, MicGate, useWakeLock, useInterval, Empty } from '../ui/common.js';
import { LEVELS } from '../data/songs.js';
import { state, allSongs, findSong, saveSettings, saveCustomSong, deleteCustomSong, hpProfile } from '../state.js';
import { recommendShifts } from '../core/voice.js';
import { keyName, chordSymbol, parseChord, noteName } from '../core/music.js';
import { keyPc, songRange, transposeSong, validateSong, checkHarmony } from '../core/song.js';
import { songSessionOpts, noHeadphones } from '../app/builders.js';
import { RunScreen } from './run.js';
import { saveAttempt } from '../app/record.js';
import { STYLES } from '../core/accomp.js';
import { engine } from '../audio/engine.js';
import { Transport } from '../audio/transport.js';
import { transcribe, harmonize, buildCustomSong, parseNoteInput } from '../core/transcribe.js';
import { metronomeEvents } from '../core/accomp.js';
import { PitchRoll, viewRange } from '../ui/pitchroll.js';
import { db } from '../store/db.js';

export function SongsScreen() {
  const st = useAppState();
  const [lvl, setLvl] = useState(0);
  const songs = allSongs().filter((s) => lvl === 0 || (lvl === 5 ? s.source === 'custom' : s.level === lvl));
  return html`<div class="screen">
    <div class="row between mb8"><h1>Písně</h1><a class="btn sm" href="#/editor">＋ Vlastní</a></div>
    <div class="chips mb16">${[[0, 'Vše'], [1, 'Úroveň 1'], [2, 'Úroveň 2'], [3, 'Úroveň 3'], [4, 'Úroveň 4'], [5, 'Moje']].map(([v, l]) => html`<button class=${'chip' + (lvl === v ? ' on' : '')} onClick=${() => setLvl(v)}>${l}</button>`)}</div>
    ${lvl >= 1 && lvl <= 4 ? html`<p class="small muted">${LEVELS[lvl].desc}</p>` : null}
    ${!songs.length ? html`<${Empty} icon="✍️" title="Zatím žádná vlastní píseň" text="Napiš noty a text, nebo melodii nazpívej." action=${html`<a class="btn primary" href="#/editor">Vytvořit píseň</a>`} />` : null}
    <div class="list">${songs.map((s) => {
      const sp = st.progress.songs[s.id];
      return html`<a class="item" href=${'#/song/' + s.id}>
        <div class="ic">${s.source === 'custom' ? '✍️' : ['', '🌱', '🌿', '🌳', '🏔️'][s.level] || '🎵'}</div>
        <div class="grow"><div class="t ellipsis">${s.title}</div><div class="s ellipsis">${s.source === 'custom' ? 'Vlastní' : `Úroveň ${s.level}`} · ${s.practices.slice(0, 2).join(', ')}</div></div>
        ${sp?.best ? html`<span class=${'badge ' + (sp.best >= 85 ? 'g' : '')}>${sp.best}</span>` : html`<div class="chev">›</div>`}
      </a>`;
    })}</div>
  </div>`;
}

const MODES = [
  ['listen', '👂 Poslech', 'Jen poslouchej – melodie i doprovod.'],
  ['guided', '🎤 S vodicí melodií', 'Zpíváš spolu s vodicí melodií.'],
  ['solo', '🎙️ Sám', 'Jen doprovod, melodie mlčí.'],
  ['perform', '⭐ Vystoupení', 'Celá píseň s hodnocením, bez vodicí melodie.'],
  ['wait', '⏳ Čekej na mě', 'Píseň počká, až tón trefíš.'],
  ['alternate', '🔁 Poslechni → zazpívej', 'Fráze zazní, pak ji zazpíváš sám (i bez sluchátek).'],
];

export function SongDetail({ id }) {
  const song = findSong(id);
  if (!song) return html`<div class="screen"><${TopBar} title="Píseň nenalezena" backTo="/songs" /></div>`;
  return html`<${SongDetailInner} key=${id} song=${song} />`;
}
function SongDetailInner({ song }) {
  const st = useAppState();
  const [sheet, setSheet] = useState(null);
  const recs = useMemo(() => recommendShifts(song.notes, st.profile), [song.id, st.profile]);
  const sp = st.progress.songs[song.id];
  const cfgKey = 'zp-song-' + song.id;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(cfgKey) || 'null'); } catch { return null; } })();
  const [shift, setShift] = useState(saved?.shift ?? sp?.lastShift ?? recs[0].shift);
  const [factor, setFactor] = useState(saved?.factor ?? 1);
  const [mode, setMode] = useState(saved?.mode ?? 'guided');
  const [loopSel, setLoopSel] = useState('all');
  useEffect(() => { try { localStorage.setItem(cfgKey, JSON.stringify({ shift, factor, mode })); } catch { /* */ } }, [shift, factor, mode]);
  const base = recs[0].shift;
  const tr = transposeSong(song, shift);
  const rng = songRange(tr);
  const kp = keyPc(tr.key.tonic);
  const style = st.settings.notation === 'solf' ? 'cz' : st.settings.notation;
  const fits = rng.lo >= st.profile.comfortLow && rng.hi <= st.profile.comfortHigh;
  const outOfRange = rng.lo < st.profile.low || rng.hi > st.profile.highChest;
  const go = () => navigate(`/play/${song.id}?shift=${shift}&f=${factor}&mode=${mode}&loop=${loopSel}`);
  const loops = [['all', 'Celá píseň'], ...song.sections.filter((s) => s.type !== 'intro' && s.type !== 'outro').map((s, i) => ['s' + song.sections.indexOf(s), s.name]), ...song.phrases.map((p) => ['p' + p.index, `Fráze ${p.index + 1}: ${song.lyrics[p.index]?.text?.slice(0, 24) || ''}`])];
  const preview = async () => {
    await engine.ensureContext(); await engine.loadInstruments().catch(() => {});
    const notes = tr.notes.slice(0, 10);
    const t0 = notes[0].t;
    engine.previewSequence(notes.map((n) => ({ midi: n.p, t: n.t - t0, d: n.d * 0.95 })), 60 / tr.tempo, 'guide');
  };
  return html`<div class="screen">
    <${TopBar} title=${song.title} sub=${song.source === 'custom' ? 'Vlastní píseň' : `Úroveň ${song.level} · ${song.meter.join('/')} · ${song.tempo} BPM`} backTo="/songs"
      right=${song.source === 'custom' ? html`<a class="iconbtn" href=${'#/editor/' + song.id} aria-label="Upravit">✏️</a>` : null} />
    <div class="card">
      <div class="small muted">${song.description}</div>
      <div class="row wrap mt8">${song.practices.map((p) => html`<span class="badge">${p}</span>`)}</div>
      <div class="kv mt16"><span>Stavba</span><span>${song.sections.map((s) => s.name).join(' · ')}</span>
        <span>Rozsah</span><span>${fmtNote(rng.lo)}–${fmtNote(rng.hi)} (${rng.hi - rng.lo} půltónů)</span>
        <span>Melodie</span><span>${song.credits?.melody || '—'}</span><span>Text</span><span>${song.credits?.lyrics || '—'}</span>
        ${sp?.best ? html`<span>Nejlepší</span><span class=${scoreClass(sp.best)} style="font-weight:800">${sp.best} bodů (${sp.attempts}× zpíváno)</span>` : null}</div>
    </div>
    <div class="section-title">Tónina pro tvůj hlas</div>
    <div class="card">
      <div class="chips">${recs.map((r, i) => html`<button class=${'chip' + (shift === r.shift ? ' on' : '')} onClick=${() => setShift(r.shift)}>${i === 0 ? '★ ' : ''}${keyName(keyPc(transposeSong(song, r.shift).key.tonic) + (song.key.mode === 'minor' ? 0 : 0), style, song.key.mode)}</button>`)}</div>
      <div class="row between mt16">
        <button class="iconbtn" aria-label="O půltón níž" onClick=${() => setShift(Math.max(base - 12, shift - 1))}>−</button>
        <div class="center"><div style="font-weight:900;font-size:20px">${keyName(kp, style, song.key.mode)}</div><div class="small muted">Posun ${shift - base > 0 ? '+' : ''}${shift - base} od doporučené · ${fits ? '✓ v pohodlném rozsahu' : outOfRange ? '⚠ mimo tvůj rozsah' : 'mírně mimo pohodlí'}</div></div>
        <button class="iconbtn" aria-label="O půltón výš" onClick=${() => setShift(Math.min(base + 12, shift + 1))}>＋</button>
      </div>
      ${outOfRange ? html`<p class="small c-warn mt8">Tato tónina jde mimo tvůj změřený rozsah. Pro bezpečí hlasu zvol jinou.</p>` : null}
      <button class="btn sm block mt8" onClick=${preview}>🔊 Poslechnout začátek</button>
    </div>
    <div class="section-title">Tempo ${Math.round(factor * 100)} %</div>
    <div class="card tight"><input type="range" min="0.5" max="1.2" step="0.05" value=${factor} onInput=${(e) => setFactor(parseFloat(e.target.value))} aria-label="Tempo" />
      <div class="row between tiny dim"><span>50 %</span><span>${Math.round(song.tempo * factor)} BPM</span><span>120 %</span></div></div>
    <div class="section-title">Režim</div>
    <div class="list">${MODES.map(([v, l, d]) => html`<button class="item" style=${mode === v ? 'outline:2px solid var(--accent)' : ''} onClick=${() => setMode(v)}><div class="grow"><div class="t">${l}</div><div class="s">${d}</div></div>${mode === v ? html`<span class="c-acc">●</span>` : null}</button>`)}</div>
    <div class="section-title">Smyčka a nastavení</div>
    <div class="card col">
      <label class="field">Co zpívat<select value=${loopSel} onChange=${(e) => setLoopSel(e.target.value)}>${loops.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select></label>
      <label class="field">Doprovod<select value=${st.settings.accStyle} onChange=${(e) => saveSettings({ accStyle: e.target.value })}>${Object.entries(STYLES).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></label>
      <label class="field">Text<${Seg} options=${[['text', 'Text'], ['la', 'la'], ['nu', 'nu'], ['solf', 'do re mi']]} value=${st.settings.lyricsMode} onChange=${(v) => saveSettings({ lyricsMode: v })} /></label>
      <div class="row between"><span style="font-weight:700">Jemný rytmus (bicí)</span><${Seg} options=${[[true, 'Ano'], [false, 'Ne']]} value=${st.settings.drums} onChange=${(v) => saveSettings({ drums: v })} /></div>
    </div>
    <button class="btn block mt16" onClick=${() => setSheet('text')}>📄 Text a akordy</button>
    ${sheet === 'text' ? html`<${Sheet} onClose=${() => setSheet(null)}><h2 class="mb8">${song.title}</h2><${LyricsChords} song=${tr} /></${Sheet}>` : null}
    <div class="bottom-actions"><button class="btn primary big block" onClick=${go}>▶ Zpívat</button></div>
  </div>`;
}

function LyricsChords({ song }) {
  const style = state.settings.notation === 'solf' ? 'cz' : state.settings.notation;
  const kp = keyPc(song.key.tonic);
  return html`<div class="col">${song.sections.map((sec) => {
    const lines = song.lyrics.filter((l) => l.start >= sec.start - 1e-6 && l.start < sec.end - 1e-6);
    const chords = song.chords.filter((c) => c.t >= sec.start - 1e-6 && c.t < sec.end - 1e-6);
    return html`<div><div class="small c-acc" style="font-weight:800">${sec.name}</div>
      ${lines.length ? lines.map((l) => html`<div class="mt8"><div class="tiny c-teal" style="font-weight:800">${chords.filter((c) => c.t >= l.start - 0.01 && c.t < l.end).map((c) => chordSymbol(parseChord(c.sym), style, kp)).join('  ')}</div><div>${l.text}</div></div>`)
        : html`<div class="tiny c-teal" style="font-weight:800">${chords.map((c) => chordSymbol(parseChord(c.sym), style, kp)).join('  ')}</div>`}
    </div>`;
  })}</div>`;
}

export function SongPlay({ id, query }) {
  const song = findSong(id);
  if (!song) return html`<div class="screen"><${TopBar} title="Píseň nenalezena" backTo="/songs" /></div>`;
  return html`<${SongPlayInner} key=${id + query.toString()} song=${song} query=${query} />`;
}
function SongPlayInner({ song, query }) {
  const id = song.id;
  const shift = parseInt(query.get('shift') || '0', 10);
  const factor = parseFloat(query.get('f') || '1');
  const mode = query.get('mode') || 'guided';
  const loopSel = query.get('loop') || 'all';
  const opts = useMemo(() => {
    let loop = null;
    if (loopSel.startsWith('s')) { const s = song.sections[parseInt(loopSel.slice(1), 10)]; if (s) loop = { from: s.start, to: s.end }; }
    if (loopSel.startsWith('p')) { const p = song.phrases[parseInt(loopSel.slice(1), 10)]; if (p) loop = { from: Math.floor(p.start), to: Math.ceil(p.end + 0.5) }; }
    const o = songSessionOpts(song, { shift, factor, mode: mode === 'perform' ? 'solo' : mode, loop });
    if (loop) o.items = o.items.filter((i) => i.t >= loop.from - 1e-6 && i.t < loop.to);
    return o;
  }, [id, shift, factor, mode, loopSel]);
  const tr = opts.song;
  const lines = opts.alternate ? null : tr.lyrics;
  const onResult = (r) => (mode === 'listen' ? null : saveAttempt(r, { type: 'song', id: song.id, title: song.title, opts, mode, shift, factor }));
  return html`<${RunScreen} opts=${opts} title=${song.title} sub=${`${keyName(keyPc(tr.key.tonic), state.settings.notation === 'solf' ? 'cz' : state.settings.notation, tr.key.mode)} · ${MODES.find((m) => m[0] === mode)?.[1] || ''} · ${Math.round(factor * 100)} %`}
    onExit=${() => navigate('/song/' + song.id, true)} onResult=${onResult} karaoke=${lines && state.settings.lyricsMode === 'text' ? lines : null} allowMix=${true} />`;
}

// ---------------- Vlastní píseň ----------------
export function SongEditor({ id }) {
  const existing = id ? findSong(id) : null;
  const [title, setTitle] = useState(existing?.title || '');
  const [tempo, setTempo] = useState(existing?.tempo || 90);
  const [bpb, setBpb] = useState(existing?.meter?.[0] || 4);
  const [notesText, setNotesText] = useState(() => existing ? notesToText(existing.notes.map((n) => ({ ...n, t: n.t - (existing.sections[0]?.type === 'intro' ? existing.sections[0].end : 0) }))) : 'C4/1 D E F | G/2 G/2 | A/1 A G/2 | F/1 F E/2');
  const [lyrics, setLyrics] = useState(existing ? existing.notes.map((n) => n.syl).join(' ').replace(/- /g, '-') : 'Moje pís-nič-ka je krás-ná, zpí-vám si ji rád');
  const [chordsText, setChordsText] = useState('');
  const [err, setErr] = useState(null);
  const [sing, setSing] = useState(false);
  const parse = () => {
    const notes = parseNoteInput(notesText);
    if (!notes.length) throw new Error('Zadej aspoň jednu notu.');
    let chords;
    const tonicGuess = harmonize(notes, { bpb });
    if (chordsText.trim()) {
      const bars = chordsText.split('|').map((x) => x.trim()).filter(Boolean);
      chords = expandBarChords(bars.map((b, i) => ({ t: i * bpb, d: bpb, sym: b })), bpb);
      for (const c of chords) { try { parseChord(c.sym); } catch { throw new Error(`Nerozumím akordu „${c.sym}“. Piš např. C, Am, G7, F#m, Bb.`); } }
    } else chords = tonicGuess.chords;
    return { notes, chords, key: tonicGuess.key };
  };
  const autoChords = () => { try { const { notes } = { notes: parseNoteInput(notesText) }; const h = harmonize(notes, { bpb }); setChordsText(h.chords.reduce((a, c) => { const bar = Math.floor(c.t / bpb); (a[bar] = a[bar] || []).push(c.sym); return a; }, []).map((x) => x.join(' ')).join(' | ')); setErr(null); } catch (e) { setErr(e.message); } };
  const save = async () => {
    try {
      const { notes, chords, key } = parse();
      const fixed = chords;
      const song = buildCustomSong({ id: existing?.id || 'custom-' + Date.now(), title: title || 'Moje píseň', tempo, meter: [bpb, 4], notes, chords: fixed, lyricsText: lyrics, keyTonic: key.tonic, keyMode: key.mode });
      const errs = validateSong(song);
      if (errs.length) throw new Error(errs.join(', '));
      await saveCustomSong(song);
      toast('Píseň uložena do knihovny.');
      navigate('/song/' + song.id, true);
    } catch (e) { setErr(e.message); }
  };
  if (sing) return html`<${SingToNotes} tempo=${tempo} bpb=${bpb} onCancel=${() => setSing(false)} onDone=${(notes) => { setNotesText(notesToText(notes)); setChordsText(''); setSing(false); toast('Melodie převedena na noty – zkontroluj je.'); }} />`;
  return html`<div class="screen">
    <${TopBar} title=${existing ? 'Upravit píseň' : 'Vlastní píseň'} backTo="/songs" />
    <div class="col">
      <label class="field">Název<input type="text" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="Moje píseň" /></label>
      <div class="grid2"><label class="field">Tempo (BPM)<input type="number" min="40" max="200" value=${tempo} onInput=${(e) => setTempo(parseInt(e.target.value || '90', 10))} /></label>
        <label class="field">Takt<select value=${bpb} onChange=${(e) => setBpb(parseInt(e.target.value, 10))}><option value="4">4/4</option><option value="3">3/4</option><option value="2">2/4</option></select></label></div>
      <button class="btn block" onClick=${() => setSing(true)}>🎙️ Nazpívat melodii</button>
      <label class="field">Noty <span class="tiny dim">např. C4/1 D E/2 r/1 (nota+oktáva/doby, r = pauza, | = takt; B = B♭, H = H)</span>
        <textarea value=${notesText} onInput=${(e) => setNotesText(e.target.value)} spellcheck="false"></textarea></label>
      <label class="field">Text <span class="tiny dim">slabiky odděl pomlčkou: pís-nič-ka</span><textarea value=${lyrics} onInput=${(e) => setLyrics(e.target.value)}></textarea></label>
      <label class="field">Akordy po taktech <span class="tiny dim">např. C | G | Am F | C — nebo nech prázdné a doplní se samy</span>
        <input type="text" value=${chordsText} onInput=${(e) => setChordsText(e.target.value)} placeholder="doplní se automaticky" /></label>
      <button class="btn sm" onClick=${autoChords}>✨ Navrhnout akordy</button>
      ${err ? html`<div class="card warnc small">${err}</div>` : null}
      <div class="row"><button class="btn primary big grow" onClick=${save}>💾 Uložit</button>
        ${existing ? html`<button class="btn danger" onClick=${async () => { if (confirm('Smazat píseň?')) { await deleteCustomSong(existing.id); navigate('/songs', true); } }}>Smazat</button>` : null}</div>
    </div>
  </div>`;
}
function expandBarChords(chords, bpb) {
  const out = [];
  for (const c of chords) {
    const parts = String(c.sym).split(/\s+/).filter(Boolean);
    parts.forEach((p, i) => out.push({ t: c.t + (i * c.d) / parts.length, d: c.d / parts.length, sym: p }));
  }
  return out;
}
const NOTE_OUT = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'H'];
function notesToText(notes) {
  let out = [], lastOct = null, lastD = null, t = 0;
  for (const n of notes) {
    if (n.t > t + 1e-6) { out.push(`r/${+(n.t - t).toFixed(2)}`); lastD = null; }
    const oct = Math.floor(n.p / 12) - 1;
    let name = NOTE_OUT[((n.p % 12) + 12) % 12];
    if (name === 'Bb') name = 'B';
    let tok = name + (oct !== lastOct ? oct : '') + (n.d !== lastD ? '/' + +n.d.toFixed(2) : '');
    out.push(tok); lastOct = oct; lastD = n.d; t = n.t + n.d;
  }
  return out.join(' ');
}

/** Nazpívej melodii na metronom → převod na noty. */
function SingToNotes({ tempo, bpb, onCancel, onDone }) {
  const [phase, setPhase] = useState('ready');
  const [notes, setNotes] = useState(null);
  const framesRef = useRef([]);
  const trRef = useRef(null);
  const model = useRef({ beat: () => (trRef.current ? trRef.current.currentBeat() : 0), items: [], curve: [], lo: 40, hi: 72, notation: state.settings.notation, pxPerBeat: 50, live: {}, bpb });
  useWakeLock(phase === 'rec');
  useEffect(() => engine.onFrames((fr) => {
    if (phase !== 'rec' || !trRef.current) return;
    const lat = (hpProfile()?.latencyMs || 0) / 1000;
    for (const f of fr) {
      const b = trRef.current.timeToBeat(f.t - lat);
      framesRef.current.push({ t: (b - bpb) * 60 / tempo, midi: f.midi, voiced: f.voiced });
      model.current.curve.push({ b, m: f.midi, s: 'none' });
      model.current.live = { midi: f.midi, dev: null, status: 'none' };
    }
  }), [phase]);
  const start = async () => {
    await engine.ensureContext();
    framesRef.current = []; model.current.curve = [];
    const tr = new Transport(engine);
    tr.load({ events: metronomeEvents(0, 400, bpb), tempo, length: 400 });
    trRef.current = tr;
    tr.start(0, 0.2);
    if (engine.testBuffer) engine.startTestInput(tr.startTime);
    setPhase('rec');
  };
  const stop = () => {
    trRef.current?.stop(); engine.stopTestInput();
    const n = transcribe(framesRef.current.filter((f) => f.t >= 0), { tempo, grid: 0.5 });
    setNotes(n); setPhase('done');
    if (n.length) { const r = viewRange(n.map((x) => ({ midi: x.p }))); model.current.lo = r.lo; model.current.hi = r.hi; }
  };
  return html`<div class="screen full">
    <${TopBar} title="Nazpívat melodii" onBack=${onCancel} />
    <p class="small muted">Po odpočtu jednoho taktu zpívej melodii na „la“ v rytmu metronomu (${tempo} BPM). Každý tón zazpívej zřetelně a drž ho celou délku.</p>
    <div style="height:260px" class="mt8"><${PitchRoll} model=${model} /></div>
    ${phase === 'done' ? html`<div class="card mt16">${notes.length ? html`<div><b>Rozpoznáno ${notes.length} not:</b><div class="mono mt8">${notesToText(notes)}</div></div>` : html`<p class="c-warn">Nerozpoznal jsem žádné tóny. Zpívej hlasitěji a delší tóny.</p>`}</div>` : null}
    <div class="bottom-actions">
      ${phase === 'ready' ? html`<${MicGate} compact=${true}><button class="btn primary big block" onClick=${start}>🎙️ Nahrávat</button></${MicGate}>` : null}
      ${phase === 'rec' ? html`<button class="btn primary big block" onClick=${stop}>■ Hotovo</button>` : null}
      ${phase === 'done' ? html`<button class="btn grow" onClick=${() => setPhase('ready')}>↻ Znovu</button><button class="btn primary grow" disabled=${!notes.length} onClick=${() => onDone(notes)}>Použít</button>` : null}
    </div>
  </div>`;
}
