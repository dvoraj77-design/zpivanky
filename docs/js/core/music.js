// Hudební teorie: frekvence, značení not (české / mezinárodní / solmizace), intervaly, stupnice, akordy.
// Čistá logika bez závislosti na prohlížeči (testuje se v Node).

export const A4 = 440;

export const midiToFreq = (m, a4 = A4) => a4 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f, a4 = A4) => 69 + 12 * Math.log2(f / a4);
export const centsBetween = (fA, fB) => 1200 * Math.log2(fA / fB);
export const pc = (m) => ((Math.round(m) % 12) + 12) % 12;
export const octaveOf = (m) => Math.floor(Math.round(m) / 12) - 1;

// Odchylka v centech přeložená do jedné oktávy (zpěv o oktávu níž/výš = správně).
export function foldCents(c) {
  let x = ((c % 1200) + 1200) % 1200;
  if (x > 600) x -= 1200;
  return x;
}

const CZ_SHARP = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'B', 'H'];
const CZ_FLAT = ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H'];
const INTL_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const INTL_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const INTL_DEFAULT = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const CZ_DEFAULT = ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];
export const SOLF = ['do', 'di', 're', 'me', 'mi', 'fa', 'fi', 'sol', 'si', 'la', 'te', 'ti'];

// Tóniny, které se píší s béčky (pc tóniky dur).
const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]);

export const NOTATIONS = {
  cz: 'České (C D E F G A H, B = B♭)',
  intl: 'Mezinárodní (C D E F G A B)',
  solf: 'Solmizace (do re mi)',
};

/**
 * Název noty.
 * @param {number} midi
 * @param {{style?:'cz'|'intl'|'solf', octave?:boolean, keyPc?:number}} o
 */
export function noteName(midi, o = {}) {
  const style = o.style || 'cz';
  const m = Math.round(midi);
  const p = pc(m);
  const oct = o.octave === false ? '' : String(octaveOf(m));
  if (style === 'solf') {
    const k = o.keyPc ?? 0;
    return SOLF[(p - k + 12) % 12];
  }
  let table;
  if (o.keyPc != null) {
    const flat = FLAT_KEYS.has(o.keyPc);
    table = style === 'cz' ? (flat ? CZ_FLAT : CZ_SHARP) : flat ? INTL_FLAT : INTL_SHARP;
  } else {
    table = style === 'cz' ? CZ_DEFAULT : INTL_DEFAULT;
  }
  return table[p] + oct;
}

// Název tóniny (dur) – české „B dur“, „Es dur“, mezinárodní „B♭ dur“.
export function keyName(tonicPc, style = 'cz', mode = 'major') {
  const p = ((tonicPc % 12) + 12) % 12;
  const flat = FLAT_KEYS.has(p) && p !== 6;
  const t = style === 'intl' ? (flat ? INTL_FLAT : INTL_SHARP)[p] : (flat ? CZ_FLAT : CZ_SHARP)[p];
  if (style === 'solf') return (flat ? CZ_FLAT : CZ_SHARP)[p] + (mode === 'minor' ? ' moll' : ' dur');
  return t + (mode === 'minor' ? ' moll' : ' dur');
}

// Parsování názvu noty v mezinárodním zápisu: "C4", "F#3", "Bb2", "Eb5".
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
export function parseNote(s) {
  const m = /^([A-Ha-h])(#|b|♯|♭|s)?(-?\d)$/.exec(String(s).trim());
  if (!m) throw new Error('Neplatná nota: ' + s);
  let p = LETTER[m[1].toUpperCase()];
  if (m[2] === '#' || m[2] === '♯' || m[2] === 's') p += 1;
  if (m[2] === 'b' || m[2] === '♭') p -= 1;
  return (parseInt(m[3], 10) + 1) * 12 + p;
}

export const INTERVAL_NAMES = [
  'prima', 'malá sekunda', 'velká sekunda', 'malá tercie', 'velká tercie', 'čistá kvarta',
  'tritón', 'čistá kvinta', 'malá sexta', 'velká sexta', 'malá septima', 'velká septima', 'oktáva',
];
export const INTERVAL_SHORT = ['1', 'm2', 'v2', 'm3', 'v3', '4', 'tt', '5', 'm6', 'v6', 'm7', 'v7', '8'];
export function intervalName(semi) {
  const a = Math.abs(Math.round(semi));
  if (a <= 12) return INTERVAL_NAMES[a];
  return INTERVAL_NAMES[a % 12 || 12] + ' + oktáva';
}

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
export const SCALE_NAMES = { major: 'Durová', minor: 'Mollová (přirozená)', pentatonic: 'Pentatonika', chromatic: 'Chromatická' };

// Stupeň stupnice (1 = tónika, 8 = oktáva, může být i 0 / záporné) → půltóny od tóniky.
export function degreeToSemis(deg, scale = SCALES.major) {
  const n = scale.length;
  const d = deg - 1;
  const oct = Math.floor(d / n);
  const idx = ((d % n) + n) % n;
  return oct * 12 + scale[idx];
}

// ---------- Akordy ----------
const QUALITIES = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
};
const ROOT_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };

/** Parsuje akordovou značku (mezinárodní kořen: C, F#, Bb, Am, G7, D/F#). */
export function parseChord(sym) {
  const s = String(sym).trim();
  if (s === 'N' || s === '-' || s === '') return null;
  const m = /^([A-H])(#|b)?(maj7|m7|m6|m|7|dim|aug|sus4|sus2|6|add9)?(?:\/([A-H])(#|b)?)?$/.exec(s);
  if (!m) throw new Error('Neznámý akord: ' + sym);
  let root = ROOT_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  root = (root + 12) % 12;
  const quality = m[3] || '';
  let bass = root;
  if (m[4]) bass = (ROOT_PC[m[4]] + (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0) + 12) % 12;
  const intervals = QUALITIES[quality];
  return { root, quality, bass, pcs: intervals.map((i) => (root + i) % 12), intervals };
}

export function chordSymbol(ch, style = 'intl', keyPc) {
  if (!ch) return '–';
  const flat = keyPc != null ? FLAT_KEYS.has(keyPc) : [1, 3, 8, 10].includes(ch.root);
  const tab = style === 'cz' ? (flat ? ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H'] : ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'B', 'H'])
    : (flat ? INTL_FLAT : INTL_SHARP);
  let s = tab[ch.root] + ch.quality;
  if (ch.bass !== ch.root) s += '/' + tab[ch.bass];
  return s;
}

const ROOT_OUT = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const ROOT_OUT_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function transposeChordSym(sym, semis) {
  const ch = parseChord(sym);
  if (!ch) return sym;
  const r = (ch.root + semis + 120) % 12;
  const b = (ch.bass + semis + 120) % 12;
  const tab = ROOT_OUT;
  return tab[r] + ch.quality + (ch.bass !== ch.root ? '/' + tab[b] : '');
}
export const pcToRootSym = (p, sharp = false) => (sharp ? ROOT_OUT_SHARP : ROOT_OUT)[((p % 12) + 12) % 12];

// Diatonické akordy v dur (stupně I..VII).
export function diatonicChord(tonicPc, degree) {
  const qual = ['', 'm', 'm', '', '', 'm', 'dim'][degree - 1];
  const root = (tonicPc + SCALES.major[degree - 1]) % 12;
  return ROOT_OUT[root] + qual;
}

export function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
export function median(arr) {
  if (!arr.length) return NaN;
  const s = Float64Array.from(arr).sort();
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN; }
export function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1));
}
