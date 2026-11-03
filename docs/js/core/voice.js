// Hlasový profil: rozsah, pohodlný rozsah, tessitura, typ hlasu, pracovní tónina, doporučení tóniny písně.
import { noteName, keyName, pc, median, clamp, freqToMidi } from './music.js';

// Typické rozsahy (MIDI) a mluvené výšky. Názvy popisují rozsah, nikoli pohlaví.
export const VOICE_TYPES = [
  { id: 'bass', name: 'Bas', low: 40, high: 64, speak: 44, desc: 'Nejhlubší hlas. Pohodlně zní v hloubce kolem velké oktávy, výšky nad E4 bývají náročné. Hodí se pro klidné, nízko položené melodie.' },
  { id: 'baritone', name: 'Baryton', low: 43, high: 67, speak: 46, desc: 'Střední hluboký hlas – nejčastější typ. Pohodlná je oblast A2–D4, s tréninkem jde výš i níž. Většina lidových a populárních písní se dá posunout do tvého rozsahu.' },
  { id: 'tenor', name: 'Tenor', low: 48, high: 72, speak: 50, desc: 'Vyšší hlas hlubší polohy. Jasně zní kolem C4–G4, hloubky pod C3 jsou slabší.' },
  { id: 'alto', name: 'Alt', low: 53, high: 77, speak: 55, desc: 'Nejhlubší z vyšších hlasů. Plný, tmavší zvuk v oblasti F3–C5.' },
  { id: 'mezzo', name: 'Mezzosoprán', low: 57, high: 81, speak: 57, desc: 'Střední z vyšších hlasů. Pohodlná oblast A3–F5, barva mezi altem a sopránem.' },
  { id: 'soprano', name: 'Soprán', low: 60, high: 84, speak: 59, desc: 'Nejvyšší hlas. Lehce zní v oblasti C4–A5 a výš.' },
];

/** Výchozí profil (před testem): hluboký mužský hlas G2–E4 (dle zadání uživatele). */
export function defaultProfile() {
  return computeProfile({ low: 43, highChest: 64, highFalsetto: 69, speakingHz: 110, measured: false });
}

/**
 * @param {{low:number, highChest:number, highFalsetto?:number, speakingHz?:number, breathHold?:number, breathControl?:number, measured?:boolean, manual?:object}} m
 */
export function computeProfile(m) {
  const low = Math.round(m.low);
  const highChest = Math.round(Math.max(m.highChest, low + 5));
  const highAll = Math.round(Math.max(highChest, m.highFalsetto ?? highChest));
  const span = highChest - low;
  // pohodlný rozsah: krajní tóny bývají namáhavé
  const trimLow = span >= 14 ? 2 : span >= 9 ? 1 : 0;
  const trimHigh = span >= 14 ? 2 : span >= 9 ? 1 : 0;
  let comfortLow = low + trimLow;
  let comfortHigh = highChest - trimHigh;
  if (m.manual?.comfortLow != null) comfortLow = m.manual.comfortLow;
  if (m.manual?.comfortHigh != null) comfortHigh = m.manual.comfortHigh;
  // tessitura: střední část pohodlného rozsahu (kde hlas zní nejpříjemněji)
  const cSpan = comfortHigh - comfortLow;
  const tessLow = Math.round(comfortLow + cSpan * 0.25);
  const tessHigh = Math.round(comfortLow + cSpan * 0.75);
  const speakMidi = m.speakingHz ? freqToMidi(m.speakingHz) : null;
  const typeRes = classifyVoice({ low, highChest, comfortLow, comfortHigh, speakMidi });
  const workingTonic = computeWorkingTonic(comfortLow, comfortHigh);
  return {
    measured: !!m.measured,
    low, highChest, highAll, highFalsetto: m.highFalsetto != null ? Math.round(m.highFalsetto) : null,
    comfortLow, comfortHigh, tessLow, tessHigh,
    speakingHz: m.speakingHz ?? null, speakMidi,
    breathHold: m.breathHold ?? null, breathControl: m.breathControl ?? null,
    type: typeRes.best.id, typeName: typeRes.best.name, typeScores: typeRes.scores,
    workingTonic, manual: m.manual || null,
    raw: { low: m.low, highChest: m.highChest, highFalsetto: m.highFalsetto ?? null },
  };
}

export function classifyVoice({ low, highChest, comfortLow, comfortHigh, speakMidi }) {
  const center = (comfortLow + comfortHigh) / 2;
  const scores = VOICE_TYPES.map((t) => {
    const tc = (t.low + t.high) / 2;
    let d = Math.abs(center - tc) * 1.0 + Math.abs(low - t.low) * 0.7 + Math.max(0, highChest - t.high) * 0.3;
    if (speakMidi != null) d += Math.abs(speakMidi - t.speak) * 0.6;
    return { id: t.id, name: t.name, d };
  }).sort((a, b) => a.d - b.d);
  const best = VOICE_TYPES.find((t) => t.id === scores[0].id);
  return { best, scores };
}

/** Pracovní tónina: do = nejnižší pohodlný tón + 2, aby se vešla stupnice do–sol (a ideálně oktáva). */
export function computeWorkingTonic(comfortLow, comfortHigh) {
  let t = comfortLow + 2;
  if (t + 7 > comfortHigh) t = Math.max(comfortLow, comfortHigh - 7);
  return t;
}

export function profileSummary(p, style = 'cz') {
  const n = (m) => noteName(m, { style: style === 'solf' ? 'cz' : style });
  return {
    range: `${n(p.low)}–${n(p.highAll)}`,
    chest: `${n(p.low)}–${n(p.highChest)}`,
    comfort: `${n(p.comfortLow)}–${n(p.comfortHigh)}`,
    tess: `${n(p.tessLow)}–${n(p.tessHigh)}`,
    key: `${keyName(pc(p.workingTonic), style === 'solf' ? 'cz' : style).replace(' dur', '')} · ${p.typeName.toLowerCase()}`,
    speaking: p.speakMidi != null ? n(Math.round(p.speakMidi)) : '–',
  };
}

export function typeInfo(id) { return VOICE_TYPES.find((t) => t.id === id); }

/**
 * Doporučení posunu tóniny písně. Vrací 2–3 návrhy {shift, score, fits, label}.
 * notes: [{p, d}] (MIDI, délka v dobách)
 */
export function recommendShifts(notes, profile, { count = 3 } = {}) {
  if (!notes.length) return [{ shift: 0, score: 0, fits: true }];
  const lo = Math.min(...notes.map((n) => n.p)), hi = Math.max(...notes.map((n) => n.p));
  let wsum = 0, wmean = 0;
  for (const n of notes) { wsum += n.d; wmean += n.p * n.d; }
  wmean /= wsum;
  const tessC = (profile.tessLow + profile.tessHigh) / 2;
  const opts = [];
  for (let s = -12; s <= 12; s++) {
    const l = lo + s, h = hi + s;
    let pen = 0;
    if (l < profile.low || h > profile.highChest) pen += 1000; // mimo změřený rozsah – nepřípustné
    pen += Math.max(0, profile.comfortLow - l) * 12 + Math.max(0, h - profile.comfortHigh) * 15;
    pen += Math.abs(wmean + s - tessC) * 2;
    pen += Math.abs(s) * 0.15; // mírně preferuj původní tóninu
    opts.push({ shift: s, pen, fits: l >= profile.comfortLow && h <= profile.comfortHigh, inRange: l >= profile.low && h <= profile.highChest });
  }
  opts.sort((a, b) => a.pen - b.pen);
  const out = [];
  for (const o of opts) {
    if (out.length >= count) break;
    if (out.some((x) => Math.abs(x.shift - o.shift) < 2)) continue;
    out.push(o);
  }
  // vždy aspoň jeden návrh; když nic nesedí do rozsahu, vrať nejlepší dostupné
  return out.map((o, i) => ({ ...o, best: i === 0 }));
}

// ---------- Vyhodnocení kroků testu hlasu ----------
/** Mluvená výška: medián hlasových rámců. */
export function speakingPitch(frames) {
  const v = frames.filter((f) => f.voiced && f.midi != null).map((f) => f.midi);
  if (v.length < 20) return null;
  return 440 * Math.pow(2, (median(v) - 69) / 12);
}

/**
 * Nejnižší / nejvyšší tón, který udržíš aspoň minHold sekund stabilně (±40 centů).
 * @returns {number|null} MIDI (zaokrouhleno)
 */
export function extremeHeld(frames, which = 'low', minHold = 0.5) {
  const v = frames.filter((f) => f.voiced && f.midi != null);
  if (v.length < 10) return null;
  const segs = [];
  let cur = [];
  for (let i = 0; i < v.length; i++) {
    const f = v[i];
    if (cur.length && (f.t - cur[cur.length - 1].t > 0.06 || Math.abs(f.midi - median(cur.map((x) => x.midi))) > 0.45)) {
      segs.push(cur); cur = [];
    }
    cur.push(f);
  }
  if (cur.length) segs.push(cur);
  const held = segs.filter((s) => s[s.length - 1].t - s[0].t >= minHold).map((s) => median(s.map((x) => x.midi)));
  if (!held.length) return null;
  const val = which === 'low' ? Math.min(...held) : Math.max(...held);
  return Math.round(val);
}

/** Bezpečný rozsah pro cvičení: nikdy nad změřený rozsah. */
export function safeRange(profile, { allowFalsetto = false } = {}) {
  return { lo: profile.low, hi: allowFalsetto ? profile.highAll : profile.highChest, comfortLo: profile.comfortLow, comfortHi: profile.comfortHigh };
}

export { clamp };
