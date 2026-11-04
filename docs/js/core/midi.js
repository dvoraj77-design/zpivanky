// Import MIDI / KAR: čtení souboru (formát 0/1), tempo, takt, tónina, text (karaoke), rozbor stop,
// výběr melodie, převod doprovodu na nástroje aplikace, akordy z harmonie, sestavení písně.
import { recognizeChords, chordsToSegments, lineSyllables } from './analysis.js';
import { detectKey, SONG_FORMAT, SONG_VERSION } from './song.js';
import { harmonize } from './transcribe.js';

// ---------- čtení souboru ----------
/** Text v MIDI: UTF-8, jinak Windows-1250 (české karaoke soubory). */
export function decodeText(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { /* není UTF-8 */ }
  try { return new TextDecoder('windows-1250').decode(bytes); } catch { return String.fromCharCode(...bytes); }
}

/** Přečte Standard MIDI File. Vrací {format, ppq, tracks:[{name, events:[{tick, kind, …}]}]}. */
export function parseMidi(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  let p = 0;
  const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[p + i]); return s; };
  const u32 = () => { const v = (b[p] << 24 >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3]; p += 4; return v; };
  const u16 = () => { const v = (b[p] << 8) | b[p + 1]; p += 2; return v; };
  const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80 && p < b.length); return v; };
  // RIFF RMID obal
  if (str(4) === 'RIFF') { const i = indexOf(b, [0x4d, 0x54, 0x68, 0x64]); if (i < 0) throw new Error('Soubor neobsahuje MIDI.'); p = i; }
  if (str(4) !== 'MThd') throw new Error('Tohle není MIDI soubor (.mid / .kar).');
  p += 4;
  const hlen = u32();
  const format = u16(), ntr = u16(), div = u16();
  p = 8 + hlen + (b[0] === 0x52 ? 0 : 0);
  if (div & 0x8000) throw new Error('MIDI s časováním SMPTE není podporované.');
  const tracks = [];
  for (let t = 0; t < ntr && p + 8 <= b.length; t++) {
    while (p + 8 <= b.length && str(4) !== 'MTrk') { p += 4; const l = u32(); p += l; } // neznámé bloky přeskočit
    if (p + 8 > b.length) break;
    p += 4;
    const len = u32(), end = Math.min(b.length, p + len);
    const events = [];
    let tick = 0, status = 0, name = '';
    while (p < end) {
      tick += vlq();
      let st = b[p];
      if (st & 0x80) { p++; if (st < 0xf0) status = st; } else st = status; // běžící status
      if (st === 0xff) {
        const type = b[p++], l = vlq(), data = b.subarray(p, p + l); p += l;
        if (type === 0x2f) break;
        if (type === 0x51 && l >= 3) events.push({ tick, kind: 'tempo', uspq: (data[0] << 16) | (data[1] << 8) | data[2] });
        else if (type === 0x58 && l >= 2) events.push({ tick, kind: 'meter', num: data[0], den: Math.pow(2, data[1]) });
        else if (type === 0x59 && l >= 2) events.push({ tick, kind: 'key', sf: (data[0] << 24) >> 24, minor: data[1] === 1 });
        else if (type >= 0x01 && type <= 0x07) {
          const text = decodeText(data);
          if (type === 0x03 && !name) name = text.trim();
          events.push({ tick, kind: 'text', type, text });
        }
      } else if (st === 0xf0 || st === 0xf7) { const l = vlq(); p += l; }
      else {
        const hi = st & 0xf0, ch = st & 0x0f;
        if (hi === 0xc0 || hi === 0xd0) { const d1 = b[p++]; if (hi === 0xc0) events.push({ tick, kind: 'program', ch, program: d1 }); }
        else {
          const d1 = b[p++], d2 = b[p++];
          if (hi === 0x90 && d2 > 0) events.push({ tick, kind: 'on', ch, note: d1, vel: d2 });
          else if (hi === 0x80 || hi === 0x90) events.push({ tick, kind: 'off', ch, note: d1 });
          else if (hi === 0xb0 && (d1 === 7 || d1 === 11)) events.push({ tick, kind: 'cc', ch, cc: d1, value: d2 });
        }
      }
    }
    p = end;
    tracks.push({ name, events });
  }
  if (!tracks.length) throw new Error('MIDI soubor neobsahuje žádné stopy.');
  return { format, ppq: div, tracks };
}
function indexOf(b, pat) { outer: for (let i = 0; i + pat.length <= b.length; i++) { for (let k = 0; k < pat.length; k++) if (b[i + k] !== pat[k]) continue outer; return i; } return -1; }

// ---------- nástroje ----------
const GM_GROUPS = [
  [0, 'Klavír', 'piano'], [8, 'Zvonkohra / xylofon', 'piano'], [16, 'Varhany', 'organ'], [21, 'Akordeon', 'organ'], [22, 'Foukací harmonika', 'clarinet'],
  [24, 'Klasická kytara', 'nylon'], [25, 'Kytara', 'guitar'], [32, 'Basa', 'bass'], [40, 'Housle', 'violin'], [41, 'Viola', 'violin'], [42, 'Violoncello', 'cello'],
  [43, 'Kontrabas', 'bass'], [44, 'Smyčce', 'violin'], [46, 'Harfa', 'nylon'], [47, 'Tympány', 'cello'], [48, 'Smyčce', 'violin'], [52, 'Sbor', 'organ'],
  [55, 'Orchestrální úder', 'piano'], [56, 'Trubka', 'sax'], [57, 'Trombon', 'sax'], [58, 'Tuba', 'cello'], [59, 'Trubka s dusítkem', 'sax'], [60, 'Lesní roh', 'clarinet'],
  [61, 'Žestě', 'sax'], [64, 'Saxofon', 'sax'], [68, 'Hoboj', 'clarinet'], [70, 'Fagot', 'cello'], [71, 'Klarinet', 'clarinet'], [72, 'Flétna', 'flute'],
  [80, 'Syntezátor – melodie', 'clarinet'], [88, 'Syntezátor – plocha', 'organ'], [96, 'Efekty', 'organ'], [104, 'Lidové nástroje', 'guitar'], [110, 'Housle (fiddle)', 'violin'],
  [111, 'Šalmaj', 'clarinet'], [112, 'Perkuse', null], [120, 'Zvukové efekty', null],
];
export function gmInfo(program) {
  let g = GM_GROUPS[0];
  for (const x of GM_GROUPS) if (program >= x[0]) g = x;
  return { name: g[1], inst: g[2] };
}
export const MIDI_INSTRUMENTS = [['piano', 'Klavír'], ['guitar', 'Kytara'], ['nylon', 'Klasická kytara'], ['bass', 'Basa'], ['violin', 'Housle'], ['cello', 'Violoncello'], ['flute', 'Flétna'], ['clarinet', 'Klarinet'], ['sax', 'Saxofon'], ['organ', 'Varhany'], ['drum', 'Bicí'], ['off', 'Vypnuto']];
/** GM bicí (kanál 10) → zvuky aplikace. */
export function drumNote(n) {
  if (n === 35 || n === 36) return 36;
  if (n === 37 || n === 38 || n === 39 || n === 40) return 38;
  if (n === 46) return 46;
  if (n === 49 || n === 52 || n === 55 || n === 57) return 49;
  if (n === 51 || n === 53 || n === 59) return 51;
  if (n === 41 || n === 43 || n === 45 || n === 47 || n === 48 || n === 50) return 45;
  return 42;
}

// ---------- rozbor ----------
/**
 * Rozbor MIDI: tempo, takt, tónina, části (stopa × kanál) se statistikou a odhadem, která je melodie, text.
 */
export function analyzeMidi(midi, { fileName = '' } = {}) {
  const { ppq } = midi;
  const all = midi.tracks.flatMap((t, ti) => t.events.map((e) => ({ ...e, track: ti })));
  const first = (k) => all.filter((e) => e.kind === k).sort((a, b) => a.tick - b.tick);
  const tempos = first('tempo'), meters = first('meter'), keys = first('key');
  const meter0 = meters.find((m) => m.tick === 0) || meters[0] || { num: 4, den: 4 };
  let bpb = meter0.num, unit = meter0.den;
  if (!(bpb >= 1 && bpb <= 12)) bpb = 4;
  if (![2, 4, 8, 16].includes(unit)) unit = 4;
  // složené takty 6/8, 9/8, 12/8: doba = osmina
  const beatTicks = ppq * (4 / unit);
  // tempo: převažující (vážené délkou), v dobách taktu
  const lastTick = Math.max(1, ...all.map((e) => e.tick));
  const tw = new Map();
  (tempos.length ? tempos : [{ tick: 0, uspq: 500000 }]).forEach((t, i, arr) => {
    const len = (arr[i + 1]?.tick ?? lastTick) - t.tick;
    tw.set(t.uspq, (tw.get(t.uspq) || 0) + Math.max(1, len));
  });
  const uspq = [...tw.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const qbpm = 60e6 / uspq;
  const tempo = Math.round(qbpm * (unit / 4) * 10) / 10;
  // délka v sekundách podle mapy tempa
  const secAt = (tick) => { let s = 0, last = 0, u = 500000; for (const t of tempos) { if (t.tick >= tick) break; s += ((t.tick - last) / ppq) * (u / 1e6); last = t.tick; u = t.uspq; } return s + ((tick - last) / ppq) * (u / 1e6); };
  // části: stopa × kanál
  const parts = new Map();
  const programs = new Map(); // kanál → poslední program
  const sorted = all.slice().sort((a, b) => a.tick - b.tick || (a.kind === 'off' ? -1 : 1));
  const open = new Map();
  for (const e of sorted) {
    if (e.kind === 'program') { programs.set(e.ch, e.program); continue; }
    if (e.kind !== 'on' && e.kind !== 'off') continue;
    const key = e.track + ':' + e.ch;
    if (!parts.has(key)) parts.set(key, { id: key, track: e.track, ch: e.ch, notes: [], program: programs.get(e.ch) ?? 0 });
    const part = parts.get(key);
    const nk = key + ':' + e.note;
    if (e.kind === 'on') {
      if (open.has(nk)) { const o = open.get(nk); o.dur = Math.max(1, e.tick - o.tick); open.delete(nk); }
      const n = { tick: e.tick, dur: 0, pitch: e.note, vel: e.vel, program: programs.get(e.ch) ?? part.program };
      part.notes.push(n); open.set(nk, n);
    } else if (open.has(nk)) { const o = open.get(nk); o.dur = Math.max(1, e.tick - o.tick); open.delete(nk); }
  }
  for (const n of open.values()) n.dur = Math.max(1, ppq / 2);
  // text: karaoke (@ hlavičky, / \ nové řádky) nebo lyric události
  const lyricEv = all.filter((e) => e.kind === 'text' && e.type === 0x05 && e.text.trim() !== '');
  const kar = all.filter((e) => e.kind === 'text' && e.type === 0x01 && !e.text.startsWith('@') && e.tick > 0);
  const karTags = all.filter((e) => e.kind === 'text' && e.type === 0x01 && e.text.startsWith('@'));
  const textTrackCounts = new Map();
  for (const e of kar) textTrackCounts.set(e.track, (textTrackCounts.get(e.track) || 0) + 1);
  const karTrack = [...textTrackCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  let lyrics = [];
  if (karTrack && karTrack[1] >= 8 && karTrack[1] >= lyricEv.length) lyrics = kar.filter((e) => e.track === karTrack[0]).map((e) => ({ tick: e.tick, text: e.text }));
  else if (lyricEv.length >= 4) lyrics = lyricEv.map((e) => ({ tick: e.tick, text: e.text }));
  lyrics.sort((a, b) => a.tick - b.tick);
  // více slok na stejných notách (stejný čas) → první sloka
  lyrics = lyrics.filter((l, i) => i === 0 || l.tick !== lyrics[i - 1].tick || /^[\\/]/.test(l.text));
  // statistika částí
  const out = [];
  for (const part of parts.values()) {
    const ns = part.notes.filter((n) => n.dur > 0).sort((a, b) => a.tick - b.tick || b.pitch - a.pitch);
    if (!ns.length) continue;
    const drums = part.ch === 9;
    const ps = ns.map((n) => n.pitch);
    const lo = Math.min(...ps), hi = Math.max(...ps);
    const mean = ps.reduce((a, c) => a + c, 0) / ps.length;
    // polyfonie: podíl not, které začínají, když jiná ještě zní
    let overl = 0, maxEnd = -1;
    for (const n of ns) { if (n.tick < maxEnd - ppq / 16) overl++; maxEnd = Math.max(maxEnd, n.tick + n.dur); }
    const poly = overl / ns.length;
    const program = ns[0].program ?? part.program;
    const gm = drums ? { name: 'Bicí', inst: 'drum' } : gmInfo(program);
    const tname = midi.tracks[part.track].name || '';
    // shoda nástupů s textem
    let lyricHits = 0;
    if (lyrics.length && !drums) {
      const onsets = ns.map((n) => n.tick);
      let j = 0;
      for (const l of lyrics) { while (j + 1 < onsets.length && onsets[j + 1] <= l.tick + ppq / 8) j++; if (Math.abs(onsets[j] - l.tick) <= ppq / 8 || Math.abs((onsets[j + 1] ?? 1e12) - l.tick) <= ppq / 8) lyricHits++; }
    }
    const lyricFit = lyrics.length ? lyricHits / lyrics.length : 0;
    let score = 0;
    if (drums) score = -100;
    else {
      if (/melod|vocal|voice|zp[eě]v|lead|sing|hlas|solo|melodie|tune/i.test(tname)) score += 3;
      if (/bass|basa|drum|bic|chord|akord|pad|string|accomp|doprov|piano|guitar/i.test(tname) && !/lead|melod/i.test(tname)) score -= 1;
      score += lyricFit * 6;
      score += (1 - Math.min(1, poly * 2.5)) * 2.5;
      if (mean >= 55 && mean <= 80) score += 1.5; else if (mean < 48) score -= 3;
      if (gm.inst === 'bass') score -= 3;
      if ([52, 53, 54, 64, 65, 66, 67, 68, 71, 72, 73, 74, 75, 40, 56, 80, 81].includes(program)) score += 0.7;
      if (program >= 88 && program <= 95) score -= 1;
      score += Math.min(1, ns.length / 80) * 0.5;
    }
    out.push({
      id: part.id, track: part.track, ch: part.ch, trackName: tname, program, gmName: gm.name, inst: gm.inst, drums,
      notes: ns, count: ns.length, lo, hi, mean, poly, lyricFit, score,
      role: drums ? 'drums' : gm.inst === 'bass' || mean < 48 ? 'bass' : 'chords',
    });
  }
  out.sort((a, b) => a.track - b.track || a.ch - b.ch);
  const melody = out.filter((p) => !p.drums).sort((a, b) => b.score - a.score)[0] || null;
  // název: karaoke @T, jméno první stopy, jméno souboru
  const tagT = karTags.filter((e) => /^@T/.test(e.text)).map((e) => e.text.slice(2).trim()).filter(Boolean);
  const fname = String(fileName).replace(/\.(mid|midi|kar|rmi)$/i, '').replace(/[_]+/g, ' ').trim();
  const t0name = midi.tracks[0]?.name || '';
  const title = tagT[0] || (t0name && !/^(track|untitled|sequence|stopa)\s*\d*$/i.test(t0name) && t0name.length < 60 ? t0name : '') || fname || 'Píseň z MIDI';
  const artist = tagT[1] || '';
  const nice = (x) => (x && x === x.toUpperCase() && /[A-ZÁ-Ž]{3}/.test(x) ? x.toLowerCase().replace(/(^|[\s(\-])(\p{L})/gu, (m, a, c) => a + c.toUpperCase()) : x);
  const k0 = keys[0];
  const SHARP = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'], FLAT = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
  const MINOR_SHARP = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'], MINOR_FLAT = ['A', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'];
  const keySig = k0 ? { tonic: k0.minor ? (k0.sf >= 0 ? MINOR_SHARP[k0.sf] : MINOR_FLAT[-k0.sf]) : (k0.sf >= 0 ? SHARP[k0.sf] : FLAT[-k0.sf]), mode: k0.minor ? 'minor' : 'major' } : null;
  return {
    ppq, beatTicks, bpb, unit, tempo, title: nice(title), artist: nice(artist), keySig, parts: out, melodyId: melody?.id ?? null, lyrics,
    duration: secAt(lastTick), lastTick, hasLyrics: lyrics.length > 0,
  };
}

// ---------- melodie ----------
/** Melodie z části: nejvyšší tón v každém okamžiku, bez překryvů (doby). */
export function melodyNotes(part, beatTicks) {
  const ns = part.notes.slice().sort((a, b) => a.tick - b.tick || b.pitch - a.pitch);
  const out = [];
  for (const n of ns) {
    const prev = out[out.length - 1];
    if (prev && n.tick < prev.tick + beatTicks / 32) { if (n.pitch > prev.pitch) { prev.pitch = n.pitch; prev.dur = Math.max(prev.dur, n.dur); } continue; }
    if (prev && n.tick < prev.tick + prev.dur) prev.dur = n.tick - prev.tick;
    out.push({ tick: n.tick, dur: n.dur, pitch: n.pitch, vel: n.vel });
  }
  return out.filter((n) => n.dur >= beatTicks / 16);
}

/** Karaoke text → slabiky s časy a začátky řádků/odstavců. */
export function lyricSyllables(lyrics) {
  const out = [];
  // bez mezer a pomlček (např. MIDI z LilyPondu) nejde poznat hranice slov → každá slabika zvlášť
  const marked = lyrics.some((l) => /^\s|\s$|-\s*$|^[\\/]/.test(l.text));
  let newLine = true, newPara = true;
  for (const l of lyrics) {
    let t = l.text.replace(/\r\n?/g, '\n');
    if (t.startsWith('\\')) { newPara = true; newLine = true; t = t.slice(1); } else if (t.startsWith('/')) { newLine = true; t = t.slice(1); }
    const endsLine = /\n$/.test(t);
    const leadingSpace = /^\s/.test(t);
    const s = t.replace(/\n/g, ' ').trim();
    if (s) {
      const hy = /-$/.test(s) && s.length > 1;
      out.push({ tick: l.tick, text: hy ? s.slice(0, -1) : s, hy, wordStart: !marked || leadingSpace || newLine || !out.length || !!out[out.length - 1]?.hyEnd, newLine, newPara });
      if (hy) out[out.length - 1].hyEnd = false;
      newLine = false; newPara = false;
    }
    if (endsLine) newLine = true;
  }
  // slabika, za kterou nenásleduje začátek slova, pokračuje dalším slovem → pomlčka
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    out[i].cont = out[i].hy || (!!next && !next.wordStart && !/[\s,.;:!?…"“”)]$/.test(out[i].text));
  }
  return out;
}

// ---------- doprovod a akordy ----------
const TEMPL = (() => {
  const t = [];
  const Q = [['', [0, 4, 7]], ['m', [0, 3, 7]], ['7', [0, 4, 7, 10]], ['dim', [0, 3, 6]]];
  const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  for (let r = 0; r < 12; r++) for (const [q, iv] of Q) t.push({ sym: NAMES[r] + q, pcs: iv.map((x) => (x + r) % 12), root: r });
  return t;
})();
/** Akordy po dobách z harmonie doprovodu (chroma z not + basa) → stejné rozpoznávání jako u nahrávek. */
export function chordsFromParts(parts, beatTicks, nBeats, bpb) {
  const chroma = [], bass = [], energy = [];
  for (let i = 0; i < nBeats; i++) { chroma.push(new Float64Array(12)); bass.push(new Float64Array(12)); energy.push(0); }
  for (const p of parts) {
    if (p.drums) continue;
    for (const n of p.notes) {
      const a = n.tick / beatTicks, b = (n.tick + n.dur) / beatTicks;
      for (let i = Math.max(0, Math.floor(a)); i < Math.min(nBeats, Math.ceil(b)); i++) {
        const ov = Math.min(b, i + 1) - Math.max(a, i);
        if (ov <= 0) continue;
        const w = ov * (n.vel / 100);
        chroma[i][n.pitch % 12] += w; energy[i] += w;
        if (n.pitch < 55) bass[i][n.pitch % 12] += w * (n.pitch < 48 ? 1.5 : 0.7);
      }
    }
  }
  for (let i = 0; i < nBeats; i++) { const s = chroma[i].reduce((x, y) => x + y, 0) || 1; for (let k = 0; k < 12; k++) chroma[i][k] /= s; const sb = bass[i].reduce((x, y) => x + y, 0) || 1; for (let k = 0; k < 12; k++) bass[i][k] /= sb; }
  return recognizeChords(chroma, bass, energy, { meter: bpb, downbeat: 0 });
}

/**
 * Sestaví píseň z rozboru MIDI.
 * o: {id, melodyId, partInst: {id: inst|'off'}, title, artist, lyricsLines?: string[] (vlastní text místo MIDI)}
 */
export function buildMidiSong(an, o = {}) {
  const { beatTicks, bpb, unit } = an;
  const mel = an.parts.find((p) => p.id === (o.melodyId ?? an.melodyId));
  if (!mel) throw new Error('Vyber stopu s melodií.');
  const mnotes = melodyNotes(mel, beatTicks);
  if (mnotes.length < 4) throw new Error('Ve vybrané stopě je moc málo tónů na melodii.');
  // začátek písně: celý takt před prvním tónem melodie (dlouhou předehru zkrátit na 2 takty)
  const barT = beatTicks * bpb;
  const firstBar = Math.floor(mnotes[0].tick / barT);
  const zeroBar = Math.max(0, firstBar - 2);
  const zeroTick = zeroBar * barT;
  const toBeat = (tick) => Math.round(((tick - zeroTick) / beatTicks) * 1000) / 1000;
  // text
  const syls = o.lyricsLines ? null : lyricSyllables(an.lyrics);
  const notes = mnotes.filter((n) => n.tick >= zeroTick).map((n) => ({ t: toBeat(n.tick), d: Math.max(0.1, Math.round((n.dur / beatTicks) * 1000) / 1000), p: n.pitch, syl: '', phrase: 0, _tick: n.tick }));
  const lineStarts = new Set(), paraStarts = new Set();
  if (syls && syls.length) {
    // slabika → nota s nejbližším nástupem (tolerance šestnáctina), zbytek = melisma
    let j = 0;
    for (const s of syls) {
      while (j + 1 < notes.length && notes[j + 1]._tick <= s.tick + beatTicks / 8) j++;
      // nejbližší nástup (karaoke text bývá o kousek napřed); nepřeskočit notu, která ještě nemá slabiku
      let k = j;
      const dj = Math.abs(notes[j]._tick - s.tick), dn = notes[j + 1] ? Math.abs(notes[j + 1]._tick - s.tick) : Infinity;
      if (dn < dj || (notes[j].syl && dn < beatTicks / 2 && notes[j]._tick < s.tick - beatTicks / 16 && dn < dj + beatTicks / 4)) k = j + 1;
      j = k;
      const n = notes[k]; if (!n) continue;
      const piece = s.text + (s.cont ? '-' : '');
      n.syl = n.syl ? (n.syl.endsWith('-') ? n.syl.slice(0, -1) : n.syl + ' ') + piece : piece;
      if (s.newLine) lineStarts.add(k);
      if (s.newPara) paraStarts.add(k);
    }
    notes.forEach((n, i) => { if (!n.syl) { n.melisma = i > 0; n.syl = ''; } });
  }
  // fráze: řádky textu, jinak pauzy ≥ 1 doba nebo 4 takty (vždy od celých not)
  let phrase = 0;
  notes.forEach((n, i) => {
    if (i > 0) {
      const prev = notes[i - 1];
      const brk = lineStarts.size >= 2 ? lineStarts.has(i) : (n.t - (prev.t + prev.d) >= 1 - 1e-6 || n.t - notes.find((x) => x.phrase === phrase).t >= bpb * 4);
      if (brk) phrase++;
    }
    n.phrase = phrase;
  });
  if (!syls?.length) notes.forEach((n) => { n.syl = 'la'; });
  else {
    // instrumentální místa ve stopě melodie (předehra, sólo) – fráze bez jediné slabiky se nezpívají
    const sung = new Set(notes.filter((n) => n.syl).map((n) => n.phrase));
    for (let i = notes.length - 1; i >= 0; i--) if (!sung.has(notes[i].phrase)) notes.splice(i, 1);
    const map = new Map(); let k = 0;
    for (const n of notes) { if (!map.has(n.phrase)) map.set(n.phrase, k++); n.phrase = map.get(n.phrase); }
    if (notes[0]) notes[0].melisma = false;
  }
  // zaokrouhlení nesmí vytvořit překryv
  for (let i = 0; i + 1 < notes.length; i++) if (notes[i].t + notes[i].d > notes[i + 1].t) notes[i].d = Math.max(0.05, Math.floor((notes[i + 1].t - notes[i].t) * 1000) / 1000);
  if (!notes.length) throw new Error('Ve vybrané stopě nejsou noty se slovy – zkus jinou stopu.');
  const byPhrase = new Map();
  for (const n of notes) { if (!byPhrase.has(n.phrase)) byPhrase.set(n.phrase, []); byPhrase.get(n.phrase).push(n); }
  let phrases = [...byPhrase.entries()].map(([i, ns]) => ({ start: ns[0].t, end: ns[ns.length - 1].t + ns[ns.length - 1].d, index: i, section: 0 }));
  let lyrics = phrases.map((p, i) => ({ text: byPhrase.get(p.index).map((n) => n.syl).reduce((a, x) => (x ? (a.endsWith('-') ? a.slice(0, -1) + x : (a ? a + ' ' : '') + x) : a), '').replace(/-$/, ''), start: p.start, end: p.end, line: i }));
  const lastEnd = Math.max(...notes.map((n) => n.t + n.d));
  const length = Math.ceil((lastEnd + 1e-6) / bpb) * bpb + bpb;
  // doprovod z ostatních částí
  const backingParts = an.parts.filter((p) => p.id !== mel.id);
  const tracks = backingParts.map((p) => ({ id: p.id, name: p.trackName || p.gmName, gm: p.gmName, inst: o.partInst?.[p.id] ?? p.inst ?? 'off', role: p.role }));
  const events = [];
  for (const p of backingParts) {
    for (const n of p.notes) {
      const t = toBeat(n.tick);
      if (t < -bpb * 2 || t > length + 2) continue;
      events.push({ t, d: Math.max(0.05, Math.round((n.dur / beatTicks) * 1000) / 1000), midi: p.drums ? drumNote(n.pitch) : n.pitch, vel: Math.round((n.vel / 127) * 0.9 * 100) / 100, tr: p.id });
    }
  }
  events.sort((a, b) => a.t - b.t);
  // akordy (pro styly doprovodu a zobrazení), bez doprovodu z melodie
  const nBeats = Math.ceil(length) + Math.ceil(zeroTick / beatTicks);
  let chords;
  if (backingParts.some((p) => !p.drums && p.count >= 8)) chords = chordsToSegments(chordsFromParts(backingParts, beatTicks, nBeats, bpb), Math.round(zeroTick / beatTicks), bpb, length);
  else chords = harmonize(notes.map((n) => ({ t: n.t, d: n.d, p: n.p })), { bpb }).chords; // jen melodie → harmonizace melodie
  const keyInfo = an.keySig ? null : detectKey(notes.map((n) => ({ p: n.p, d: n.d })));
  const ROOT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const key = an.keySig ? { tonic: an.keySig.tonic === 'Cb' ? 'B' : an.keySig.tonic, mode: an.keySig.mode } : { tonic: ROOT[keyInfo.tonic], mode: keyInfo.mode };
  if (!chords.length) chords = [{ t: 0, d: length, sym: key.tonic + (key.mode === 'minor' ? 'm' : '') }];
  const span = Math.max(...notes.map((n) => n.p)) - Math.min(...notes.map((n) => n.p));
  const firstNote = notes[0].t;
  const introEnd = Math.floor(firstNote / bpb) * bpb;
  const sections = [
    ...(introEnd > 0 ? [{ type: 'intro', name: 'Předehra', start: 0, end: introEnd }] : []),
    { type: 'verse', name: 'Píseň', start: introEnd, end: length - bpb },
    { type: 'outro', name: 'Dohra', start: length - bpb, end: length },
  ];
  phrases = phrases.map((p) => ({ ...p, section: introEnd > 0 ? 1 : 0 }));
  if (o.lyricsLines?.length) {
    // vlastní text: řádky na fráze, slabiky rovnoměrně
    return finish(applyText(notes, phrases, o.lyricsLines));
  }
  return finish({ notes, phrases, lyrics });

  function finish(x) {
    const bars = []; for (let b = 0; b < length - 1e-6; b += bpb) bars.push(b);
    return {
      format: SONG_FORMAT, version: SONG_VERSION, id: o.id || 'midi-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: o.title || an.title, style: o.style || 'jine', subtitle: o.artist ?? an.artist ?? '', source: 'midi',
      level: span <= 7 ? 1 : span <= 9 ? 2 : span <= 12 ? 3 : 4, chapter: null, practices: ['píseň z MIDI'],
      description: (o.artist || an.artist ? (o.artist || an.artist) + ' – ' : '') + 'píseň z MIDI', credits: { melody: o.artist || an.artist || 'MIDI', lyrics: o.lyricsLines?.length ? 'vlastní text' : syls?.length ? 'z MIDI' : '' },
      tempo: an.tempo, meter: [bpb, unit], key, sections, bars,
      notes: x.notes.map(({ _tick, ...n }) => n), chords, lyrics: x.lyrics, phrases: x.phrases, length, timing: null, audio: null,
      backing: { tracks, events },
      analysis: { midi: true, melodyTrack: mel.trackName || mel.gmName, lyricsFromMidi: !!syls?.length, parts: an.parts.length },
    };
  }
}

/** Vlastní text: řádek = fráze (podle pauz), slabiky rovnoměrně na noty fráze. */
function applyText(notes, phrases, lines) {
  const out = notes.map((n) => ({ ...n, syl: '', melisma: false }));
  const lyrics = [];
  phrases.forEach((p, i) => {
    const ns = out.filter((n) => n.phrase === p.index);
    const syl = lines[i] ? lineSyllables(lines[i]) : [];
    if (!syl.length) ns.forEach((n) => { n.syl = 'la'; });
    else {
      const K = ns.length, S = syl.length;
      if (K >= S) { let j = 0; for (let k = 0; k < K; k++) { if (j < S && k >= Math.floor((j * K) / S)) ns[k].syl = syl[j++]; else ns[k].melisma = true; } }
      else for (let k = 0; k < K; k++) { const a = Math.floor((k * S) / K), b = Math.floor(((k + 1) * S) / K); ns[k].syl = syl.slice(a, Math.max(b, a + 1)).reduce((acc, x) => (acc ? (acc.endsWith('-') ? acc.slice(0, -1) + x : acc + ' ' + x) : x), ''); }
    }
    lyrics.push({ text: lines[i] || ns.map((n) => n.syl).join(' '), start: p.start, end: p.end, line: i });
  });
  return { notes: out, phrases, lyrics };
}

/** Události doprovodu z MIDI pro přehrávač (transpozice kromě bicích, vypnuté stopy pryč). */
export function backingEvents(song, shift = 0) {
  const b = song.backing; if (!b) return [];
  const tr = new Map(b.tracks.map((t) => [t.id, t]));
  const out = [];
  for (const e of b.events) {
    const t = tr.get(e.tr); if (!t || t.inst === 'off') continue;
    const drum = t.inst === 'drum';
    out.push({ t: e.t, d: e.d, midi: drum ? e.midi : e.midi + shift, inst: t.inst, vel: e.vel, role: drum ? 'drums' : t.role === 'bass' ? 'bass' : 'chords' });
  }
  return out;
}
