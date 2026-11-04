// Písně: knihovna, detail (tónina, tempo, režim), přehrávač, vlastní píseň (editor, nazpívání).
import { html, useState, useEffect, useRef, useMemo, useAppState, navigate, TopBar, Seg, Sheet, toast, fmtNote, Stars, scoreClass, MicGate, useWakeLock, useInterval, Empty, Toggle, plural } from '../ui/common.js';
import { Hint, HelpBtn } from '../ui/hints.js';
import { LEVELS, CATEGORIES, USER_STYLES } from '../data/songs.js';
import { state, allSongs, findSong, saveSettings, saveCustomSong, deleteCustomSong, hpProfile } from '../state.js';
import { recommendShifts } from '../core/voice.js';
import { keyName, chordSymbol, parseChord, noteName } from '../core/music.js';
import { keyPc, songRange, transposeSong, validateSong, checkHarmony, phraseLoop } from '../core/song.js';
import { songSessionOpts, noHeadphones, GUIDE_INSTRUMENTS } from '../app/builders.js';
import { applyMix } from '../app/mix.js';
import { playAttempt } from '../app/playback.js';
import { RunScreen, MixSheet } from './run.js';
import { saveAttempt } from '../app/record.js';
import { STYLES } from '../core/accomp.js';
import { engine } from '../audio/engine.js';
import { Transport } from '../audio/transport.js';
import { transcribe, harmonize, buildCustomSong, parseNoteInput } from '../core/transcribe.js';
import { metronomeEvents } from '../core/accomp.js';
import { PitchRoll, viewRange } from '../ui/pitchroll.js';
import { db } from '../store/db.js';
import { stemClips, stemShift, forgetClips, lookupLyrics, lyricsLines, plainLines } from '../app/importer.js';
import { MIDI_INSTRUMENTS } from '../core/midi.js';
import { relyricSong, lyricsText } from '../core/analysis.js';

export function SongsScreen() {
  const st = useAppState();
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem('zp-songs-filter') || 'null'); } catch { return null; } })();
  const [cat, setCat] = useState(saved?.cat ?? 'all');
  const [lvl, setLvl] = useState(saved?.lvl ?? 0);
  const [sty, setSty] = useState(saved?.sty ?? 'all');
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  useEffect(() => { try { sessionStorage.setItem('zp-songs-filter', JSON.stringify({ cat, lvl, sty })); } catch { /* */ } }, [cat, lvl, sty]);
  const mine = (s) => s.source === 'custom' || s.source === 'import' || s.source === 'midi';
  const catOf = (s) => (mine(s) ? 'moje' : s.category || 'cvicne');
  const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const all = allSongs();
  const styles = USER_STYLES.filter(([k]) => all.some((s) => mine(s) && (s.style || 'jine') === k));
  const songs = all.filter((s) => (cat === 'all' || catOf(s) === cat) && (lvl === 0 || s.level === lvl) && (cat !== 'moje' || sty === 'all' || (s.style || 'jine') === sty)
    && (!q || norm(s.title + ' ' + (s.subtitle || '')).includes(norm(q))))
    .sort((x, y) => (cat === 'all' ? CATEGORIES.findIndex((c) => c[0] === catOf(x)) - CATEGORIES.findIndex((c) => c[0] === catOf(y)) : 0) || x.level - y.level || x.title.localeCompare(y.title, 'cs'));
  const count = (c) => all.filter((s) => catOf(s) === c).length;
  return html`<div class="screen">
    <div class="row between mb8"><h1>Písně</h1><button class="btn sm" onClick=${() => setAdd(true)} data-testid="song-add">＋ Přidat</button></div>
    ${add ? html`<${Sheet} onClose=${() => setAdd(false)}><h2 class="mb8">Přidat píseň</h2><div class="list">
      <a class="item" href="#/midi"><div class="ic">🎼</div><div class="grow"><div class="t">Z MIDI nebo karaoke</div><div class="s">Soubory .mid / .kar (i víc najednou) → melodie, text a původní aranžmá</div></div><div class="chev">›</div></a>
      <a class="item" href="#/editor"><div class="ic">✍️</div><div class="grow"><div class="t">Napsat vlastní</div><div class="s">Noty a text ručně, nebo melodii nazpívej</div></div><div class="chev">›</div></a>
    </div>
    <div class="section-title">Experimentální</div>
    <div class="list"><a class="item" href="#/import"><div class="ic">🧪</div><div class="grow"><div class="t">Z nahrávky MP3 (pokus)</div><div class="s">Umělá inteligence odhadne melodii ze zvuku – výsledky zatím bývají nepřesné</div></div><div class="chev">›</div></a></div>
    </${Sheet}>` : null}
    <input type="search" class="mb8" placeholder="🔎 Hledat píseň" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Hledat píseň" style="width:100%" />
    <div class="chips mb8">${[['all', `Vše ${all.length}`], ...CATEGORIES.map(([k, l]) => [k, `${l} ${count(k)}`])].map(([v, l]) => html`<button class=${'chip' + (cat === v ? ' on' : '')} onClick=${() => setCat(v)}>${l}</button>`)}</div>
    ${cat === 'moje' && styles.length > 1 ? html`<div class="chips mb8">${[['all', 'Všechny styly'], ...styles].map(([v, l]) => html`<button class=${'chip' + (sty === v ? ' on' : '')} onClick=${() => setSty(v)}>${l}</button>`)}</div>` : null}
    <div class="chips mb16">${[[0, 'Každá obtížnost'], [1, '🌱 1'], [2, '🌿 2'], [3, '🌳 3'], [4, '🏔️ 4']].map(([v, l]) => html`<button class=${'chip' + (lvl === v ? ' on' : '')} onClick=${() => setLvl(v)}>${l}</button>`)}</div>
    ${lvl >= 1 && lvl <= 4 ? html`<p class="small muted">${LEVELS[lvl].desc}</p>` : null}
    ${!songs.length ? (cat === 'moje' && !q ? html`<${Empty} icon="🎼" title="Zatím žádná vlastní píseň" text="Přidej písně z MIDI nebo karaoke souborů (i víc najednou), nebo napiš vlastní." action=${html`<div class="row"><a class="btn primary" href="#/midi">Z MIDI</a><a class="btn" href="#/editor">Napsat</a></div>`} />`
      : html`<${Empty} icon="🔎" title="Nic nenalezeno" text="Zkus jiný filtr nebo hledání." />`) : null}
    <div class="list">${songs.map((s) => {
      const sp = st.progress.songs[s.id];
      const c = catOf(s);
      const sub = s.source === 'custom' ? 'Vlastní · ' + s.practices.slice(0, 2).join(', ') : s.source === 'import' ? `Z nahrávky${s.subtitle ? ' · ' + s.subtitle : ''}` : s.source === 'midi' ? `${USER_STYLES.find((x) => x[0] === (s.style || 'jine'))?.[1] || 'Moje'}${s.subtitle ? ' · ' + s.subtitle : ''}`
        : `${CATEGORIES.find((x) => x[0] === c)?.[1] || ''} · úroveň ${s.level}${s.subtitle ? ' · ' + s.subtitle : ''}`;
      return html`<a class="item" href=${'#/song/' + s.id}>
        <div class="ic">${s.source === 'custom' ? '✍️' : s.source === 'import' ? '🎧' : s.source === 'midi' ? '🎼' : { detske: '🧸', lidove: '🌾', koledy: '🎄', svet: '🌍' }[c] || ['', '🌱', '🌿', '🌳', '🏔️'][s.level] || '🎵'}</div>
        <div class="grow"><div class="t ellipsis">${s.title}</div><div class="s ellipsis">${sub}</div></div>
        ${sp?.best ? html`<span class=${'badge ' + (sp.best >= 85 ? 'g' : '')}>${sp.best}</span>` : html`<div class="chev">›</div>`}
      </a>`;
    })}</div>
  </div>`;
}

export const MODES = [
  ['sing', '🎤 Zpívat', 'Doprovod hraje celou píseň bez zastavování. Vodicí melodii zapneš a vypneš tlačítkem při zpěvu.'],
  ['phrase', '🔁 Nacvičit frázi', 'Fráze hraje dokola v rytmu po celých taktech, před ní je vždy jeden volný takt na nádech. Šipkami přejdeš na další.'],
  ['listen', '👂 Poslech', 'Jen poslouchej melodii s doprovodem, nic se nehodnotí.'],
];
export const normalizeMode = (m) => (m === 'listen' || m === 'phrase' ? m : 'sing');

export function SongDetail({ id, query }) {
  const song = findSong(id);
  if (!song) return html`<div class="screen"><${TopBar} title="Píseň nenalezena" backTo="/songs" /></div>`;
  return html`<${SongDetailInner} key=${id} song=${song} justImported=${query?.get?.('imported') === '1'} />`;
}
function SongDetailInner({ song, justImported }) {
  const st = useAppState();
  const [sheet, setSheet] = useState(null);
  const recs = useMemo(() => recommendShifts(song.notes, st.profile), [song.id, st.profile]);
  const sp = st.progress.songs[song.id];
  const cfgKey = 'zp-song-' + song.id;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(cfgKey) || 'null'); } catch { return null; } })();
  const [shift, setShift] = useState(saved?.shift ?? sp?.lastShift ?? recs[0].shift);
  const [factor, setFactor] = useState(saved?.factor ?? st.settings.songTempo ?? 0.7);
  const [mode, setMode] = useState(normalizeMode(saved?.mode));
  const [loopSel, setLoopSel] = useState('all');
  const [phraseSel, setPhraseSel] = useState(0);
  const [waitOn, setWaitOn] = useState(false);
  const imported = song.source === 'import' || song.source === 'midi';
  const hasOrig = song.source === 'import' && !!song.audio?.stems;
  const hasMidi = !!song.backing?.events?.length;
  const [acc, setAcc] = useState(hasOrig ? saved?.acc ?? 'orig' : hasMidi ? saved?.acc ?? 'midi' : 'synth');
  const accOrig = hasOrig && acc === 'orig';
  const accMidi = hasMidi && acc === 'midi';
  useEffect(() => { try { localStorage.setItem(cfgKey, JSON.stringify({ shift, factor, mode, acc })); } catch { /* */ } }, [shift, factor, mode, acc]);
  const base = recs[0].shift;
  // původní tónina (případně o oktávu): originální doprovod se nemusí převádět
  const origShift = [-24, -12, 0, 12, 24].sort((a, b) => Math.abs(a - base) - Math.abs(b - base))[0];
  const tr = transposeSong(song, shift);
  const rng = songRange(tr);
  const kp = keyPc(tr.key.tonic);
  const style = st.settings.notation === 'solf' ? 'cz' : st.settings.notation;
  const fits = rng.lo >= st.profile.comfortLow && rng.hi <= st.profile.comfortHigh;
  const outOfRange = rng.lo < st.profile.low || rng.hi > st.profile.highChest;
  const go = () => navigate(`/play/${song.id}?shift=${shift}&f=${factor}&mode=${mode}&part=${loopSel}&ph=${phraseSel}&wait=${waitOn ? 1 : 0}&acc=${accOrig ? 'orig' : accMidi ? 'midi' : 'synth'}`);
  const loops = [['all', 'Celá píseň'], ...song.sections.filter((s) => s.type !== 'intro' && s.type !== 'outro').map((s) => ['s' + song.sections.indexOf(s), s.name + ' (dokola)'])];
  // ukázka: první fráze s doprovodem a vodicí melodií v aktuálním nastavení
  const [previewing, setPreviewing] = useState(false);
  const prevRef = useRef(null);
  useEffect(() => () => prevRef.current?.stop(), []);
  const soundPreview = async () => {
    if (prevRef.current) { prevRef.current.stop(); prevRef.current = null; setPreviewing(false); return; }
    applyMix();
    const o = songSessionOpts(song, { shift, factor, mode: 'sing', style: accMidi ? 'midi' : undefined });
    const bpb = song.meter[0];
    const first = song.phrases[0]?.start ?? 0;
    const to = o.countIn + Math.min(song.length, Math.ceil((first + 4 * bpb) / bpb) * bpb);
    const h = await playAttempt(o, null, { fromBeat: o.countIn + Math.max(0, Math.floor(first / bpb) * bpb - bpb), toBeat: to, voice: false, guideGain: 1, accompGain: 1 });
    prevRef.current = h; setPreviewing(true);
    const spb = 60 / (o.tempo * o.factor);
    setTimeout(() => { if (prevRef.current === h) { prevRef.current = null; setPreviewing(false); } }, (to - o.countIn) * spb * 1000 + 800);
  };
  const preview = async () => {
    await engine.ensureContext(); await engine.loadInstruments().catch(() => {});
    const notes = tr.notes.slice(0, 10);
    const t0 = notes[0].t;
    engine.previewSequence(notes.map((n) => ({ midi: n.p, t: n.t - t0, d: n.d * 0.95 })), 60 / tr.tempo, 'guide');
  };
  return html`<div class="screen">
    <${TopBar} title=${song.title} sub=${song.source === 'custom' ? 'Vlastní píseň' : imported ? `${song.source === 'midi' ? 'Z MIDI' : 'Z nahrávky'} · ${song.meter.join('/')} · ${Math.round(song.tempo)} BPM` : `Úroveň ${song.level} · ${song.meter.join('/')} · ${song.tempo} BPM`} backTo="/songs"
      right=${song.source === 'custom' ? html`<a class="iconbtn" href=${'#/editor/' + song.id} aria-label="Upravit">✏️</a>` : imported ? html`<button class="iconbtn" aria-label="Upravit" onClick=${() => setSheet('edit')} data-testid="import-edit">✏️</button>` : null} />
    ${justImported ? html`<div class="card goodc mb16" data-testid="import-done"><div style="font-weight:800">✅ Píseň je připravená</div>
      <p class="small mt8">Rozpoznal jsem ${plural(song.notes.length, 'notu', 'noty', 'not')}, ${plural(new Set(song.chords.map((c) => c.sym)).size, 'akord', 'různé akordy', 'různých akordů')}, tempo ${Math.round(song.tempo)} BPM a takt ${song.meter.join('/')}.
      ${song.source === 'midi' ? (song.analysis?.lyricsFromMidi ? ' Text je z MIDI souboru.' : song.credits?.lyrics ? '' : ' Text můžeš doplnit přes ✏️.') + (hasMidi ? ` Doprovod hraje ${plural(song.backing.tracks.filter((t) => t.inst !== 'off').length, 'nástroj', 'nástroje', 'nástrojů')} z MIDI.` : '')
        : song.analysis?.lyricsFound ? (song.analysis.lyricsTimed ? ' Text se našel i s časováním.' : ' Text se našel (bez časování – rozdělil jsem ho podle pauz).') : ' Text se nenašel – doplň ho přes ✏️.'}</p>
      <p class="small muted">Je to odhad: nejdřív si dej <b>Poslech</b> a když něco nesedí, uprav text přes ✏️.</p></div>` : null}
    <div class="card">
      <div class="small muted">${song.description}</div>
      <div class="row wrap mt8">${song.practices.map((p) => html`<span class="badge">${p}</span>`)}</div>
      <div class="kv mt16"><span>Stavba</span><span>${song.sections.map((s) => s.name).join(' · ')}</span>
        <span>Rozsah</span><span>${fmtNote(rng.lo)}–${fmtNote(rng.hi)} (${rng.hi - rng.lo} půltónů)</span>
        ${imported ? html`<span>Interpret</span><span>${song.subtitle || '—'}</span>${song.source === 'midi' ? html`<span>Melodie</span><span>stopa „${song.analysis?.melodyTrack || '?'}“</span>` : html`<span>Oddělení</span><span>${song.analysis?.mode === 'precise' ? 'Přesně (MDX-Net)' : 'Rychle'}${hasOrig ? '' : ' · originál smazán'}</span>`}<span>Text</span><span>${song.analysis?.lyricsEdited ? 'upravený' : song.credits?.lyrics || 'bez textu'}</span>`
          : html`<span>Melodie</span><span>${song.credits?.melody || '—'}</span><span>Text</span><span>${song.credits?.lyrics || '—'}</span>`}
        ${sp?.best ? html`<span>Nejlepší</span><span class=${scoreClass(sp.best)} style="font-weight:800">${sp.best} bodů (${sp.attempts}× zpíváno)</span>` : null}</div>
    </div>
    <div class="section-title">Tónina pro tvůj hlas</div>
    <div class="card">
      <div class="chips">${recs.map((r, i) => html`<button class=${'chip' + (shift === r.shift ? ' on' : '')} onClick=${() => setShift(r.shift)}>${i === 0 ? '★ ' : ''}${keyName(keyPc(transposeSong(song, r.shift).key.tonic) + (song.key.mode === 'minor' ? 0 : 0), style, song.key.mode)}</button>`)}
        ${hasOrig && !recs.some((r) => r.shift === origShift) ? html`<button class=${'chip' + (shift === origShift ? ' on' : '')} onClick=${() => setShift(origShift)}>🎧 ${keyName(keyPc(transposeSong(song, origShift).key.tonic), style, song.key.mode)} originál</button>` : null}</div>
      ${accOrig && stemShift(shift) !== 0 ? html`<p class="tiny dim mt8">Originální doprovod se převede o ${stemShift(shift) > 0 ? '+' : ''}${stemShift(shift)} půltónů – zní přirozeněji, když zůstaneš blízko originálu (🎧).</p>` : null}
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
    <${Hint} id="song" help="modes" title="Jak zpívat píseň">Nejdřív si dej <b>Poslech</b>, pak <b>Zpívat</b> s vodicí melodií. Těžké místo procvič v <b>Nacvičit frázi</b>. Tónina se nastavila podle tvého hlasu (★), tempo začíná na 70 %.</${Hint}>
    <div class="list">${MODES.map(([v, l, d]) => html`<button class="item" style=${mode === v ? 'outline:2px solid var(--accent)' : ''} onClick=${() => setMode(v)}><div class="grow"><div class="t">${l}</div><div class="s">${d}</div></div>${mode === v ? html`<span class="c-acc">●</span>` : null}</button>`)}</div>
    <div class="section-title">Nastavení</div>
    <div class="card col">
      ${mode === 'sing' ? html`<label class="field">Co zpívat<select value=${loopSel} onChange=${(e) => setLoopSel(e.target.value)}>${loops.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select></label>` : null}
      ${mode === 'phrase' ? html`<label class="field">Začít frází<select value=${phraseSel} onChange=${(e) => setPhraseSel(parseInt(e.target.value, 10))}>${song.phrases.map((p) => html`<option value=${p.index}>${p.index + 1}. ${song.lyrics[p.index]?.text || ''}</option>`)}</select></label>
        <${Toggle} label="Čekat, až tón trefím" sub="Fráze se zastaví na každém tónu, dokud ho nezazpíváš" on=${waitOn} onChange=${setWaitOn} />` : null}
      <label class="field">Doprovod<select value=${accOrig ? 'orig' : accMidi ? 'midi' : st.settings.accStyle} onChange=${(e) => { const v = e.target.value; if (v === 'orig' || v === 'midi') setAcc(v); else { setAcc('synth'); saveSettings({ accStyle: v }); } }} data-testid="acc-select">
        ${hasOrig ? html`<option value="orig">🎧 Originál (bez zpěvu)</option>` : null}${hasMidi ? html`<option value="midi">🎼 Původní aranžmá z MIDI</option>` : null}${Object.entries(STYLES).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></label>
      <label class="field">Text<${Seg} options=${[['text', 'Text'], ['la', 'la'], ['nu', 'nu'], ['solf', 'do re mi']]} value=${st.settings.lyricsMode} onChange=${(v) => saveSettings({ lyricsMode: v })} /></label>
      ${accOrig || accMidi || st.settings.accStyle === 'band' || st.settings.accStyle === 'none' ? null : html`<div class="row between"><span style="font-weight:700">Jemný rytmus (bicí)</span><${Seg} options=${[[true, 'Ano'], [false, 'Ne']]} value=${st.settings.drums} onChange=${(v) => saveSettings({ drums: v })} /></div>`}
      <label class="field">Vodicí melodie hraje<select value=${st.settings.guideInst || 'guide'} onChange=${(e) => { saveSettings({ guideInst: e.target.value }); engine.previewNote(tr.notes[0]?.p ?? 60, 0.9, e.target.value); }} data-testid="detail-guide-inst">
        ${GUIDE_INSTRUMENTS.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></label>
      <div class="row"><button class="btn sm grow" onClick=${soundPreview} data-testid="sound-preview">${previewing ? '■ Zastavit ukázku' : '🔊 Ukázka zvuku'}</button>
        <button class="btn sm grow" onClick=${() => setSheet('mix')} data-testid="open-mix">🎚️ Hlasitosti</button></div>
    </div>
    <button class="btn block mt16" onClick=${() => setSheet('text')}>📄 Text a akordy</button>
    ${sheet === 'text' ? html`<${Sheet} onClose=${() => setSheet(null)}><h2 class="mb8">${song.title}</h2><${LyricsChords} song=${tr} /></${Sheet}>` : null}
    ${sheet === 'edit' ? html`<${ImportEdit} song=${song} onClose=${() => setSheet(null)} />` : null}
    ${sheet === 'mix' ? html`<${MixSheet} onClose=${() => setSheet(null)} />` : null}
    <div class="bottom-actions"><button class="btn primary big block" onClick=${go}>▶ Zpívat</button></div>
  </div>`;
}

/** Úprava importované písně: název, interpret, text (znovu zarovnaný na noty), smazání originálu / písně. */
function ImportEdit({ song, onClose }) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.subtitle || '');
  const [text, setText] = useState(lyricsText(song));
  const [timed, setTimed] = useState(null); // dohledaný text s časy
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [fix, setFix] = useState(false);
  const [style, setStyle] = useState(song.style || 'jine');
  const [tracks, setTracks] = useState(song.backing?.tracks || null);
  const lookup = async () => {
    setBusy('Hledám text…'); setMsg(null);
    const f = await lookupLyrics({ title, artist, duration: song.audio?.duration || song.analysis?.duration });
    setBusy(null);
    if (!f) { setMsg('Text se nenašel (nebo nejsi online). Můžeš ho vložit ručně.'); return; }
    const lines = lyricsLines(f, song.analysis?.offset || 0);
    setText(lines.map((l) => l.text).join('\n')); setTimed(lines[0]?.time != null ? lines : null);
    setMsg(`Nalezeno: ${f.match?.artist || ''} – ${f.match?.title || ''}${lines[0]?.time != null ? ' (s časováním)' : ''}. Zkontroluj a ulož.`);
  };
  const save = async () => {
    const lines = timed && timed.map((l) => l.text).join('\n') === text ? timed : plainLines(text);
    const s2 = lines.length ? relyricSong(song, lines) : song;
    await saveCustomSong({ ...s2, ...(song.source === 'midi' ? { style, backing: tracks ? { ...song.backing, tracks } : song.backing } : {}), title: title || song.title, subtitle: artist, description: artist ? `${artist} – importovaná píseň` : 'Importovaná píseň', credits: { ...(s2.credits || {}), melody: artist || 'originál', lyrics: lines === timed ? 'lrclib.net' : lines.length ? 'upravený text' : s2.credits?.lyrics || '' } });
    toast('Uloženo.'); onClose();
  };
  const dropAudio = async () => {
    if (!confirm('Smazat originální zvuk? Noty, akordy a text zůstanou, doprovod bude jen syntetický.')) return;
    await db.deleteStems(song.id); forgetClips(song.id);
    await saveCustomSong({ ...song, audio: { ...(song.audio || {}), stems: false } });
    toast('Originální zvuk smazán.'); onClose();
  };
  const mb = song.audio?.bytes ? Math.round(song.audio.bytes / 1e6) : null;
  const octave = async (d) => { await saveCustomSong({ ...song, notes: song.notes.map((n) => ({ ...n, p: n.p + 12 * d })) }); toast(d > 0 ? 'Melodie o oktávu výš.' : 'Melodie o oktávu níž.'); };
  if (fix) return html`<${NoteFix} song=${song} onClose=${() => setFix(false)} />`;
  return html`<${Sheet} onClose=${onClose}>
    <h2 class="mb8">Upravit píseň</h2>
    <div class="col">
      <div class="row"><button class="btn sm grow" onClick=${() => setFix(true)} data-testid="note-fix">🎼 Opravit noty</button>
        <button class="btn sm" onClick=${() => octave(-1)} aria-label="Melodie o oktávu níž">8va ▼</button><button class="btn sm" onClick=${() => octave(1)} aria-label="Melodie o oktávu výš">8va ▲</button></div>
      <label class="field">Název<input type="text" value=${title} onInput=${(e) => setTitle(e.target.value)} /></label>
      <label class="field">Interpret<input type="text" value=${artist} onInput=${(e) => setArtist(e.target.value)} /></label>
      ${song.source === 'midi' ? html`<label class="field">Styl<select value=${style} onChange=${(e) => setStyle(e.target.value)}>${USER_STYLES.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></label>` : null}
      ${tracks?.length ? html`<div class="field">Nástroje doprovodu z MIDI${tracks.map((t, i) => html`<div class="row between" style="gap:10px;align-items:center;margin-top:6px"><span class="grow small ellipsis">${t.name}</span>
        <select style="width:50%;flex:none" value=${t.inst} onChange=${(e) => setTracks(tracks.map((x, k) => (k === i ? { ...x, inst: e.target.value } : x)))} aria-label=${'Nástroj pro ' + t.name}>${MIDI_INSTRUMENTS.filter(([k]) => (t.inst === 'drum' || t.role === 'drums' ? k === 'drum' || k === 'off' : k !== 'drum')).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></div>`)}</div>` : null}
      <label class="field">Text <span class="tiny dim">jeden řádek = jedna fráze</span><textarea value=${text} onInput=${(e) => setText(e.target.value)} style="min-height:160px" data-testid="edit-lyrics"></textarea></label>
      <button class="btn sm" onClick=${lookup} disabled=${!!busy}>${busy || '🔎 Dohledat text na lrclib.net'}</button>
      ${msg ? html`<p class="small muted">${msg}</p>` : null}
      <button class="btn primary block" onClick=${save} data-testid="edit-save">💾 Uložit</button>
      ${song.audio?.stems ? html`<button class="btn block" onClick=${dropAudio}>🗑️ Smazat originální zvuk${mb ? ` (${mb} MB)` : ''}</button>` : null}
      <button class="btn danger block" onClick=${async () => { if (confirm('Smazat celou píseň?')) { forgetClips(song.id); await deleteCustomSong(song.id); onClose(); navigate('/songs', true); } }}>Smazat píseň</button>
    </div>
  </${Sheet}>`;
}

/** Oprava jednotlivých not importované písně: fráze po frázi, klepni na notu → výš / níž / smazat / poslechnout. */
function NoteFix({ song, onClose }) {
  const [notes, setNotes] = useState(song.notes);
  const [sel, setSel] = useState(null);
  const [ph, setPh] = useState(0);
  const phrases = song.phrases.length ? song.phrases : [{ index: 0 }];
  const list = notes.map((n, i) => ({ ...n, i })).filter((n) => (n.phrase ?? 0) === phrases[ph].index);
  const play = (n) => engine.previewNote(n.p, 0.6, 'piano');
  const playPhrase = async () => { await engine.ensureContext(); const t0 = list[0]?.t ?? 0; engine.previewSequence(list.map((n) => ({ midi: n.p, t: n.t - t0, d: n.d * 0.95 })), 60 / song.tempo, 'piano'); };
  const change = (i, d) => { const nn = notes.slice(); nn[i] = { ...nn[i], p: Math.max(28, Math.min(100, nn[i].p + d)) }; setNotes(nn); play(nn[i]); };
  const remove = (i) => { const nn = notes.filter((_, k) => k !== i); setNotes(nn); setSel(null); };
  const save = async () => { if (!notes.length) return; await saveCustomSong({ ...song, notes, analysis: { ...(song.analysis || {}), notesEdited: true } }); toast('Noty uloženy.'); onClose(); };
  const lyr = song.lyrics[ph]?.text || '';
  return html`<${Sheet} onClose=${onClose}>
    <h2 class="mb8">Opravit noty</h2>
    <div class="row between"><button class="iconbtn" aria-label="Předchozí fráze" disabled=${ph === 0} onClick=${() => { setPh(ph - 1); setSel(null); }}>‹</button>
      <div class="center grow"><div style="font-weight:800">Fráze ${ph + 1} / ${phrases.length}</div><div class="small muted ellipsis">${lyr}</div></div>
      <button class="iconbtn" aria-label="Další fráze" disabled=${ph >= phrases.length - 1} onClick=${() => { setPh(ph + 1); setSel(null); }}>›</button></div>
    <div class="chips mt16" data-testid="fix-notes">${list.map((n) => html`<button class=${'chip' + (sel === n.i ? ' on' : '')} onClick=${() => { setSel(n.i); play(n); }}>
      <b>${fmtNote(n.p)}</b>${n.syl ? html` <span class="tiny">${n.syl}</span>` : null}</button>`)}</div>
    ${sel != null && notes[sel] ? html`<div class="row mt16">
      <button class="btn grow" onClick=${() => change(sel, -1)} aria-label="O půltón níž">▼ níž</button>
      <button class="btn grow" onClick=${() => change(sel, 1)} aria-label="O půltón výš">▲ výš</button>
      <button class="btn" onClick=${() => change(sel, -12)} aria-label="O oktávu níž">8▼</button>
      <button class="btn" onClick=${() => change(sel, 12)} aria-label="O oktávu výš">8▲</button>
      <button class="btn danger" onClick=${() => remove(sel)} aria-label="Smazat notu">✕</button></div>` : html`<p class="small muted mt16">Klepni na notu – zazní a můžeš ji posunout výš nebo níž.</p>`}
    <div class="row mt16"><button class="btn grow" onClick=${playPhrase}>🔊 Přehrát frázi</button><button class="btn primary grow" onClick=${save} data-testid="fix-save">💾 Uložit</button></div>
  </${Sheet}>`;
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
  const mode = normalizeMode(query.get('mode'));
  const part = query.get('part') || 'all';
  const ph = Math.max(0, Math.min(song.phrases.length - 1, parseInt(query.get('ph') || '0', 10)));
  const wait = query.get('wait') === '1';
  const orig = query.get('acc') === 'orig' && !!song.audio?.stems;
  const midiAcc = query.get('acc') === 'midi' && !!song.backing?.events?.length;
  const [clips, setClips] = useState(orig ? null : []);
  const [prepErr, setPrepErr] = useState(null);
  useEffect(() => {
    if (!orig) return undefined;
    let on = true;
    stemClips(song, { factor, shift, which: mode === 'listen' ? ['inst', 'voc'] : ['inst'] })
      .then((c) => { if (on) setClips(c); }).catch((e) => { if (on) { setPrepErr(e.message || String(e)); setClips([]); } });
    return () => { on = false; };
  }, []);
  const opts = useMemo(() => {
    if (!clips) return null;
    let loop = null;
    if (mode === 'sing' && part.startsWith('s')) { const s = song.sections[parseInt(part.slice(1), 10)]; if (s) loop = { from: s.start, to: s.end }; }
    let prep = null;
    if (mode === 'phrase') { const p = song.phrases[ph]; if (p) { const L = phraseLoop(song, p); loop = { from: L.from, to: L.to }; prep = { from: L.from, to: L.phraseFrom }; } }
    const o = songSessionOpts(song, { shift, factor, mode, loop, wait: mode === 'phrase' && wait, clips, phrase: mode === 'phrase' ? song.phrases[ph]?.index : null, prep, style: midiAcc ? 'midi' : undefined });
    if (mode === 'phrase') o.items = o.items.filter((i) => i.phrase === song.phrases[ph]?.index);
    else if (loop) o.items = o.items.filter((i) => i.t >= loop.from - 1e-6 && i.t < loop.to);
    return o;
  }, [id, shift, factor, mode, part, ph, wait, clips]);
  if (!opts) return html`<div class="screen"><${TopBar} title=${song.title} onBack=${() => navigate('/song/' + song.id, true)} />
    <div class="card center mt16" data-testid="stem-prep"><div style="font-size:40px">🎧</div><div style="font-weight:800" class="mt8">Připravuji originální doprovod…</div>
    <p class="small muted mt8">Přizpůsobuji ho tempu ${Math.round(factor * 100)} %${stemShift(shift) ? ` a tónině (${stemShift(shift) > 0 ? '+' : ''}${stemShift(shift)})` : ''}. Chvilku to trvá jen poprvé.</p></div></div>`;
  const tr = opts.song;
  const onResult = (r) => (mode === 'listen' ? null : saveAttempt(r, { type: 'song', id: song.id, title: song.title, opts, mode, shift, factor }));
  const goPhrase = (d) => navigate(`/play/${song.id}?shift=${shift}&f=${factor}&mode=phrase&ph=${ph + d}&wait=${wait ? 1 : 0}&acc=${orig ? 'orig' : midiAcc ? 'midi' : 'synth'}&auto=1`, true);
  if (prepErr) console.warn('Originální doprovod:', prepErr);
  const phraseNav = mode === 'phrase' ? { i: ph, n: song.phrases.length, text: song.lyrics[ph]?.text || '', go: goPhrase } : null;
  return html`<${RunScreen} opts=${opts} title=${song.title} sub=${`${keyName(keyPc(tr.key.tonic), state.settings.notation === 'solf' ? 'cz' : state.settings.notation, tr.key.mode)} · ${MODES.find((m) => m[0] === mode)?.[1] || ''} · ${Math.round(factor * 100)} %`}
    onExit=${() => navigate('/song/' + song.id, true)} onResult=${onResult} karaoke=${state.settings.lyricsMode === 'text' ? tr.lyrics : null} allowMix=${true}
    guideToggle=${mode !== 'listen'} phraseNav=${phraseNav} autoStart=${query.get('auto') === '1'} />`;
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
