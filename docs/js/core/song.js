// Formát písně (viz SONG_FORMAT.md): kompilace kompaktního zápisu → kanonický JSON, kontrola, pomocné funkce.
import { parseNote, parseChord, transposeChordSym, pc, SCALES } from './music.js';

export const SONG_FORMAT = 'zpivanky-song';
export const SONG_VERSION = 1;

const SECTION_NAMES = { intro: 'Předehra', verse: 'Sloka', chorus: 'Refrén', bridge: 'Mezihra', outro: 'Dohra', part: 'Část' };

/** Rozdělí text na slabiky: mezery a pomlčky dělí, „_“ = melisma (prodloužení předchozí slabiky), „/“ = konec řádku. */
export function splitSyllables(text) {
  const out = [];
  const lines = String(text).split('/');
  lines.forEach((line, li) => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (w === '_') { out.push({ syl: '_', line: li, wordEnd: true }); continue; }
      const parts = w.split('-');
      parts.forEach((p, i) => {
        if (p === '' && i > 0) return;
        const s = p.replace(/~/g, ' ');
        out.push({ syl: i < parts.length - 1 ? s + '-' : s, line: li, wordEnd: i === parts.length - 1 });
      });
    }
  });
  return out;
}

/** Parsuje melodii: "E4/1 D C/2 | r/1 G3/0.5 …" (oktáva i délka se pamatují). */
export function parseMelody(str, beatsPerBar, pickup = 0) {
  const notes = [];
  let t = 0, oct = 4, dur = 1, bar = 0, barStart = 0;
  const errors = [];
  const tokens = String(str).trim().split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok === '|' || tok === '||') {
      const expected = bar === 0 && pickup ? pickup : beatsPerBar;
      const got = t - barStart;
      if (Math.abs(got - expected) > 1e-6) errors.push(`takt ${bar + 1}: ${got} dob místo ${expected}`);
      bar++; barStart = t;
      continue;
    }
    const m = /^([A-Ga-gr])(#|b)?(-?\d)?(?:\/([\d.]+))?(~)?$/.exec(tok);
    if (!m) { errors.push('neznámý token ' + tok); continue; }
    if (m[4]) dur = parseFloat(m[4]);
    if (m[1] === 'r') { notes.push({ rest: true, t, d: dur }); t += dur; continue; }
    if (m[3] != null) oct = parseInt(m[3], 10);
    const p = parseNote(m[1].toUpperCase() + (m[2] || '') + oct);
    notes.push({ t, d: dur, p, tie: !!m[5] });
    t += dur;
  }
  return { notes, length: t, bars: bar + (t - barStart > 1e-6 ? 1 : 0), errors, lastBarBeats: t - barStart };
}

/** Akordy po taktech: "C | G | C F | G:3 C:1" */
export function parseChordBars(str, beatsPerBar, pickup = 0) {
  const bars = String(str).split('|').map((b) => b.trim()).filter((b) => b.length);
  const out = [];
  let t = 0;
  bars.forEach((b, bi) => {
    const len = bi === 0 && pickup ? pickup : beatsPerBar;
    const toks = b.split(/\s+/);
    const explicit = toks.some((x) => x.includes(':'));
    if (explicit) {
      let tt = t;
      for (const x of toks) { const [s, d] = x.split(':'); const dd = parseFloat(d || '1'); out.push({ t: tt, d: dd, sym: s }); tt += dd; }
    } else {
      const each = len / toks.length;
      toks.forEach((s, i) => out.push({ t: t + i * each, d: each, sym: s }));
    }
    t += len;
  });
  return { chords: out.filter((c) => c.sym !== '-' && c.sym !== 'N' ? true : (c.rest = true)), length: t };
}

/**
 * Zkompiluje kompaktní definici písně do kanonického formátu.
 * def: { id, title, level, tempo, meter:'4/4', key:'C', mode?, practices, chapter, credits, sections:[{type, name?, melody?, lyrics?: string|string[], chords, pickup?, bars?}] }
 */
export function compileSong(def) {
  const [bpb, unit] = (def.meter || '4/4').split('/').map(Number);
  const song = {
    format: SONG_FORMAT, version: SONG_VERSION, id: def.id, title: def.title, subtitle: def.subtitle || '',
    source: def.source || 'builtin', level: def.level || 1, chapter: def.chapter ?? null,
    practices: def.practices || [], description: def.description || '', credits: def.credits || {},
    tempo: def.tempo || 90, meter: [bpb, unit], key: { tonic: def.key || 'C', mode: def.mode || 'major' },
    sections: [], notes: [], chords: [], lyrics: [], phrases: [], timing: null, audio: null,
  };
  const errors = [];
  let t = 0, phraseIdx = 0, lineIdx = 0;
  const counts = {};
  for (const sec of def.sections) {
    const stanzas = Array.isArray(sec.lyrics) ? sec.lyrics : [sec.lyrics ?? null];
    stanzas.forEach((lyr, si) => {
      counts[sec.type] = (counts[sec.type] || 0) + 1;
      const baseName = sec.name || SECTION_NAMES[sec.type] || 'Část';
      const name = stanzas.length > 1 || (sec.type === 'verse' && def.sections.filter((s) => s.type === 'verse').length > 1) ? `${baseName} ${counts[sec.type]}` : baseName;
      const secStart = t;
      let secLen = 0;
      if (sec.melody) {
        const mel = parseMelody(sec.melody, bpb, sec.pickup || 0);
        mel.errors.forEach((e) => errors.push(`${def.id} ${name}: ${e}`));
        secLen = mel.length;
        const syls = lyr ? splitSyllables(lyr) : null;
        let si2 = 0, lastNote = null, lastLine = -1;
        let lineStartT = null, lineText = [];
        const flushLine = (endT) => {
          if (lineStartT == null) return;
          song.lyrics.push({ text: lineText.join('').trim(), start: lineStartT, end: endT, line: lineIdx });
          song.phrases.push({ start: lineStartT, end: endT, index: phraseIdx, section: song.sections.length });
          lineIdx++; phraseIdx++;
          lineStartT = null; lineText = [];
        };
        for (const n of mel.notes) {
          if (n.rest) continue;
          if (lastNote && lastNote.tie && lastNote.p === n.p) { lastNote.d += n.d; lastNote.tie = n.tie; continue; }
          let syl = null, line = lastLine;
          if (syls) {
            const s = syls[si2++];
            if (!s) errors.push(`${def.id} ${name}: chybí slabika pro notu v čase ${n.t}`);
            else { syl = s.syl; line = s.line; }
          }
          if (syl === '_' && lastNote) {
            const gapEnd = secStart + n.t;
            if (Math.abs(lastNote.t + lastNote.d - gapEnd) < 1e-6) {
              song.notes.push({ t: secStart + n.t, d: n.d, p: n.p, syl: '', melisma: true, phrase: phraseIdx });
              lastNote = song.notes[song.notes.length - 1];
              continue;
            }
          }
          if (line !== lastLine && lastLine !== -1) flushLine(secStart + n.t);
          if (lineStartT == null) lineStartT = secStart + n.t;
          if (syl) lineText.push(syl.endsWith('-') ? syl.slice(0, -1) : syl + ' ');
          lastLine = line;
          const note = { t: secStart + n.t, d: n.d, p: n.p, syl: syl ?? '', phrase: phraseIdx, tie: n.tie };
          song.notes.push(note);
          lastNote = note;
        }
        if (syls && si2 < syls.length) errors.push(`${def.id} ${name}: přebývá ${syls.length - si2} slabik`);
        const lastEnd = song.notes.length ? song.notes[song.notes.length - 1].t + song.notes[song.notes.length - 1].d : secStart;
        flushLine(lastEnd);
      }
      if (sec.chords) {
        const ch = parseChordBars(sec.chords, bpb, sec.pickup || 0);
        if (sec.melody && Math.abs(ch.length - secLen) > 1e-6) errors.push(`${def.id} ${name}: akordy ${ch.length} dob, melodie ${secLen}`);
        if (!sec.melody) secLen = ch.length;
        for (const c of ch.chords) if (!c.rest) song.chords.push({ t: secStart + c.t, d: c.d, sym: c.sym });
      } else if (!sec.melody && sec.bars) secLen = sec.bars * bpb;
      song.sections.push({ type: sec.type, name, start: secStart, end: secStart + secLen });
      t += secLen;
    });
  }
  for (const n of song.notes) delete n.tie;
  song.length = t;
  song.errors = errors;
  return song;
}

// ---------- Pomocné funkce nad kanonickým formátem ----------
export function songRange(song) {
  const ps = song.notes.map((n) => n.p);
  return ps.length ? { lo: Math.min(...ps), hi: Math.max(...ps) } : { lo: 60, hi: 60 };
}
export const secPerBeat = (song, tempoFactor = 1) => 60 / (song.tempo * tempoFactor);

export function chordAt(song, beat) {
  for (const c of song.chords) if (beat >= c.t - 1e-9 && beat < c.t + c.d - 1e-9) return c;
  return null;
}

/** Těžké doby: 4/4 → 1 a 3, 3/4 → 1, 2/4 → 1, 6/8 → 1 a 4 */
export function strongBeats(meter) {
  const [b] = meter;
  if (b === 4) return [0, 2];
  if (b === 6) return [0, 3];
  return [0];
}

/** Kontrola: melodie na těžkých dobách patří do akordu. */
export function checkHarmony(song) {
  const problems = [];
  const bpb = song.meter[0];
  const strong = strongBeats(song.meter);
  for (let bar = 0; bar * bpb < song.length; bar++) {
    for (const sb of strong) {
      const beat = bar * bpb + sb;
      const note = song.notes.find((n) => beat >= n.t - 1e-9 && beat < n.t + n.d - 1e-9);
      if (!note) continue;
      const c = chordAt(song, beat);
      if (!c) { problems.push({ beat, note: note.p, chord: null, msg: 'bez akordu' }); continue; }
      const ch = parseChord(c.sym);
      if (!ch.pcs.includes(pc(note.p))) problems.push({ beat, note: note.p, chord: c.sym, msg: `nota ${pc(note.p)} není v akordu ${c.sym}` });
    }
  }
  return problems;
}

export function transposeSong(song, semis) {
  if (!semis) return song;
  return {
    ...song,
    notes: song.notes.map((n) => ({ ...n, p: n.p + semis })),
    chords: song.chords.map((c) => ({ ...c, sym: transposeChordSym(c.sym, semis) })),
    key: { ...song.key, tonic: transposeKey(song.key.tonic, semis) },
    transposed: (song.transposed || 0) + semis,
  };
}
const KEY_PCS = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, 'D#': 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, 'G#': 8, A: 9, Bb: 10, 'A#': 10, B: 11 };
const KEY_OUT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export function keyPc(tonic) { return KEY_PCS[tonic] ?? 0; }
export function transposeKey(tonic, semis) { return KEY_OUT[(keyPc(tonic) + semis + 120) % 12]; }

/** Validace kanonické písně (i vlastní a importované). Vrací seznam chyb. */
export function validateSong(song) {
  const e = [];
  if (song.format !== SONG_FORMAT) e.push('neplatný formát');
  if (!song.id) e.push('chybí id');
  if (!song.title) e.push('chybí název');
  if (!(song.tempo > 20 && song.tempo < 300)) e.push('neplatné tempo');
  if (!Array.isArray(song.meter) || song.meter.length !== 2) e.push('neplatný takt');
  if (!Array.isArray(song.notes) || !song.notes.length) e.push('chybí noty');
  let last = -1;
  for (const n of song.notes || []) {
    if (!(n.d > 0)) e.push('nota s nulovou délkou v ' + n.t);
    if (n.t < last - 1e-6) e.push('noty nejsou seřazené v ' + n.t);
    if (n.p < 24 || n.p > 108) e.push('nota mimo rozsah ' + n.p);
    last = n.t + n.d;
  }
  for (const c of song.chords || []) { try { parseChord(c.sym); } catch { e.push('neznámý akord ' + c.sym); } }
  return e;
}

/** Odhad tóniny melodie (Krumhansl–Schmuckler, jen dur/moll). */
const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
export function detectKey(notes) {
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[pc(n.p)] += n.d;
  let best = { tonic: 0, mode: 'major', r: -2 };
  for (let k = 0; k < 12; k++) {
    for (const [mode, prof] of [['major', KK_MAJ], ['minor', KK_MIN]]) {
      const x = hist, y = prof.map((_, i) => prof[(i - k + 12) % 12]);
      const mx = x.reduce((a, b) => a + b, 0) / 12, my = y.reduce((a, b) => a + b, 0) / 12;
      let num = 0, dx = 0, dy = 0;
      for (let i = 0; i < 12; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
      const r = num / Math.sqrt(dx * dy || 1);
      if (r > best.r) best = { tonic: k, mode, r };
    }
  }
  return best;
}

export { SCALES };
