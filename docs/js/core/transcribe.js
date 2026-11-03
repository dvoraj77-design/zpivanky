// Převod nazpívané melodie na noty (segmentace + kvantizace) a automatické doplnění akordů.
import { median, pc, SCALES, diatonicChord, parseChord } from './music.js';
import { detectKey, SONG_FORMAT, SONG_VERSION } from './song.js';

/**
 * frames: [{t, midi|null, voiced}] (t v s od začátku nahrávky, už bez zpoždění)
 * @returns {Array<{t:number,d:number,p:number}>} t,d v dobách
 */
export function transcribe(frames, { tempo = 90, grid = 0.5, minNoteBeats = 0.5, startTime = 0 } = {}) {
  const spb = 60 / tempo;
  const v = frames.filter((f) => f.t >= startTime);
  // 1) segmenty souvislého hlasu se stabilní výškou
  const segs = [];
  let cur = null;
  for (const f of v) {
    if (!f.voiced || f.midi == null) {
      if (cur && f.t - cur.end > 0.06) { segs.push(cur); cur = null; }
      continue;
    }
    if (cur) {
      const ref = median(cur.vals.slice(-8));
      if (Math.abs(f.midi - ref) > 0.75) {
        // změna tónu: rozděl jen pokud nová výška vydrží
        cur.pending = cur.pending || [];
        cur.pending.push(f);
        if (cur.pending.length >= 6) {
          const nseg = { start: cur.pending[0].t, end: f.t, vals: cur.pending.map((x) => x.midi) };
          segs.push(cur);
          cur = nseg;
        }
        continue;
      }
      if (cur.pending) { cur.vals.push(...cur.pending.map((x) => x.midi)); cur.pending = null; }
      cur.vals.push(f.midi); cur.end = f.t;
    } else cur = { start: f.t, end: f.t, vals: [f.midi] };
  }
  if (cur) segs.push(cur);
  const good = segs.filter((s) => s.end - s.start >= 0.12 && s.vals.length >= 6);
  if (!good.length) return [];
  // 2) globální odchylka ladění (zpěvák může být celkově o kus níž)
  const fracs = good.map((s) => { const m = median(s.vals); return m - Math.round(m); });
  const tune = median(fracs);
  // 3) kvantizace
  const t0 = good[0].start;
  let notes = good.map((s) => {
    const p = Math.round(median(s.vals) - tune);
    let t = Math.round((s.start - t0) / spb / grid) * grid;
    let e = Math.round((s.end - t0) / spb / grid) * grid;
    if (e <= t) e = t + grid;
    return { t, d: e - t, p };
  });
  // 4) sloučit stejné sousední tóny s malou mezerou, vyřešit překryvy, odstranit krátké
  const out = [];
  for (const n of notes) {
    const last = out[out.length - 1];
    if (last && n.t < last.t + last.d) n.t = last.t + last.d;
    if (n.d < minNoteBeats - 1e-9) { if (last && last.p === n.p) last.d = n.t + n.d - last.t; continue; }
    if (last && last.p === n.p && n.t - (last.t + last.d) <= grid) { last.d = n.t + n.d - last.t; continue; }
    if (n.d > 0) out.push(n);
  }
  return out;
}

/** Automatické akordy: pro každý takt vyber diatonický akord, který nejlépe pokryje melodii. */
export function harmonize(notes, { bpb = 4, tonic = null, mode = 'major' } = {}) {
  if (!notes.length) return { chords: [], key: { tonic: 0, mode: 'major' } };
  const key = tonic != null ? { tonic, mode } : detectKey(notes.map((n) => ({ p: n.p, d: n.d })));
  const end = Math.max(...notes.map((n) => n.t + n.d));
  const seg = bpb === 4 ? 2 : bpb;
  const nseg = Math.ceil(end / seg - 1e-9);
  const cands = key.mode === 'minor'
    ? [[1, 'm', 0], [4, 'm', 5], [5, '', 7], [6, '', 8], [3, '', 3], [7, '', 10]]
    : [[1, '', 0], [4, '', 5], [5, '', 7], [6, 'm', 9], [2, 'm', 2], [3, 'm', 4]];
  const ROOT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const chords = [];
  let prev = null;
  for (let b = 0; b < nseg; b++) {
    const bs = b * seg, be = bs + seg;
    const inSeg = notes.filter((n) => n.t < be && n.t + n.d > bs);
    const strongNote = notes.find((n) => n.t <= bs + 1e-9 && n.t + n.d > bs + 1e-9);
    let best = null, bestScore = -1e9;
    for (const [deg, q, semi] of cands) {
      const sym = ROOT[(key.tonic + semi) % 12] + q;
      const ch = parseChord(sym);
      let s = 0;
      for (const n of inSeg) {
        const dur = Math.min(be, n.t + n.d) - Math.max(bs, n.t);
        s += (ch.pcs.includes(pc(n.p)) ? 1 : -0.6) * dur;
      }
      if (strongNote && !ch.pcs.includes(pc(strongNote.p))) s -= 10; // těžká doba musí sedět
      s += deg === 1 ? 0.4 : deg === 5 || deg === 4 ? 0.25 : 0;
      if (b === nseg - 1 && deg === 1) s += 3; // konec na tónice
      if (prev === sym) s += 0.3; // méně zbytečných změn
      if (s > bestScore) { bestScore = s; best = sym; }
    }
    const last = chords[chords.length - 1];
    if (last && last.sym === best && (bs % bpb) !== 0) last.d += seg;
    else chords.push({ t: bs, d: seg, sym: best });
    prev = best;
  }
  return { chords, key };
}

/** Sestaví kanonickou vlastní píseň z not, akordů a textu. */
export function buildCustomSong({ id, title, tempo, meter = [4, 4], notes, chords, lyricsText = '', keyTonic = 0, keyMode = 'major', intro = true }) {
  const bpb = meter[0];
  const sylls = lyricsText.trim() ? lyricsText.trim().split(/\s+/).flatMap((w) => { const p = w.split('-'); return p.map((x, i) => (i < p.length - 1 ? x + '-' : x)); }) : [];
  const shift = intro ? bpb * 2 : 0;
  const ROOT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const tonicSym = ROOT[keyTonic] + (keyMode === 'minor' ? 'm' : '');
  const domSym = ROOT[(keyTonic + 7) % 12];
  const len = Math.ceil(Math.max(...notes.map((n) => n.t + n.d)) / bpb - 1e-9) * bpb;
  const song = {
    format: SONG_FORMAT, version: SONG_VERSION, id, title: title || 'Moje píseň', subtitle: '', source: 'custom', level: 0, chapter: null,
    practices: ['vlastní píseň'], description: 'Vlastní píseň', credits: { melody: 'vlastní', lyrics: 'vlastní' },
    tempo, meter, key: { tonic: ROOT[keyTonic], mode: keyMode },
    sections: [], notes: [], chords: [], lyrics: [], phrases: [], timing: null, audio: null,
  };
  if (intro) {
    song.sections.push({ type: 'intro', name: 'Předehra', start: 0, end: shift });
    song.chords.push({ t: 0, d: bpb, sym: tonicSym }, { t: bpb, d: bpb, sym: domSym });
  }
  song.sections.push({ type: 'verse', name: 'Sloka', start: shift, end: shift + len });
  // fráze: rozdělit podle pauz ≥ 1 doba nebo po 4 taktech
  let phrase = 0, lastEnd = null, phraseStart = null;
  notes.forEach((n, i) => {
    const t = n.t + shift;
    if (lastEnd != null && (t - lastEnd >= 1 || t - phraseStart >= bpb * 4)) phrase++;
    if (lastEnd == null || song.notes.length === 0 || song.notes[song.notes.length - 1].phrase !== phrase) phraseStart = t;
    song.notes.push({ t, d: n.d, p: n.p, syl: sylls[i] ?? (sylls.length ? '' : 'la'), phrase });
    lastEnd = t + n.d;
  });
  for (let ph = 0; ph <= phrase; ph++) {
    const ns = song.notes.filter((n) => n.phrase === ph);
    if (!ns.length) continue;
    const start = ns[0].t, end = ns[ns.length - 1].t + ns[ns.length - 1].d;
    song.phrases.push({ start, end, index: ph, section: intro ? 1 : 0 });
    song.lyrics.push({ text: ns.map((n) => (n.syl.endsWith('-') ? n.syl.slice(0, -1) : n.syl + ' ')).join('').trim(), start, end, line: ph });
  }
  for (const c of chords) song.chords.push({ t: c.t + shift, d: c.d, sym: c.sym });
  const endT = shift + len;
  song.sections.push({ type: 'outro', name: 'Dohra', start: endT, end: endT + bpb });
  song.chords.push({ t: endT, d: bpb, sym: tonicSym });
  song.length = endT + bpb;
  return song;
}

/** Parsuje ručně zadané noty: "C4/1 D E/2 r/1 …" (relativní, bez taktových čar). */
export function parseNoteInput(str) {
  const out = [];
  let t = 0, oct = 4, dur = 1;
  const LET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
  for (const tok of String(str).trim().split(/[\s|]+/).filter(Boolean)) {
    const m = /^([A-Ha-hr])(#|b|is|es|s)?(-?\d)?(?:\/([\d.]+))?$/.exec(tok);
    if (!m) throw new Error('Nerozumím notě „' + tok + '“. Příklad: C4/1 D E/2 r/1');
    if (m[4]) dur = parseFloat(m[4]);
    if (m[1].toLowerCase() === 'r') { t += dur; continue; }
    if (m[3] != null) oct = parseInt(m[3], 10);
    let letter = m[1].toUpperCase();
    let p = LET[letter];
    // české B = B♭
    if (letter === 'B' && !m[2]) p = 10;
    if (m[2] === '#' || m[2] === 'is') p += 1;
    if (m[2] === 'b' || m[2] === 'es' || m[2] === 's') p -= 1;
    out.push({ t, d: dur, p: (oct + 1) * 12 + p });
    t += dur;
  }
  return out;
}

export { SCALES, diatonicChord };
