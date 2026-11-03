// Generátor cvičení: ze zadání lekce a hlasového profilu vytvoří časový plán (v dobách) s cíli k hodnocení.
import { degreeToSemis, SCALES, SOLF, pc, diatonicChord, transposeChordSym } from './music.js';

export const EXERCISE_TYPES = {
  hold: 'Držený tón', match: 'Trefení tónu', scale: 'Stupnicový vzorec', arpeggio: 'Arpeggio', interval: 'Zazpívej interval',
  earInterval: 'Poznej interval sluchem', siren: 'Siréna', rhythm: 'Opakuj rytmus', callResponse: 'Zavolání → odpověď',
  breath: 'Výdrž dechu', dynamics: 'Dynamika', voicetest: 'Test hlasu', free: 'Volný tón',
};

const LA = { la: 'la', nu: 'nu', mi: 'mi', u: 'u', a: 'a', brr: 'brr', mm: 'mmm', pa: 'pa' };

function sylFor(deg, mode, keyPc, midi) {
  if (mode === 'solf') return SOLF[((pc(midi) - keyPc) % 12 + 12) % 12];
  if (LA[mode]) return LA[mode];
  return String(deg);
}

/** Najde řadu tónik pro opakování po půltónech v bezpečném rozsahu. */
export function tonicSequence(offsets, base, lo, hi, reps, direction = 'up') {
  const minO = Math.min(...offsets), maxO = Math.max(...offsets);
  const fits = (t) => t + minO >= lo && t + maxO <= hi;
  let start = base;
  if (!fits(start)) {
    // posuň do rozsahu
    start = Math.min(Math.max(start, lo - minO), hi - maxO);
    if (!fits(start)) return [Math.round(lo - minO)]; // vzor se nevejde – nejnižší možná poloha (zkrácení řeší volající)
  }
  const seq = [start];
  if (direction === 'down') {
    for (let t = start - 1; seq.length < reps && fits(t); t--) seq.push(t);
  } else {
    let t = start + 1;
    while (seq.length < reps && fits(t)) { seq.push(t); t++; }
    if (direction === 'updown' || seq.length < reps) {
      for (let t2 = seq[seq.length - 1] - 1; seq.length < reps && t2 >= start - 6 && fits(t2); t2--) seq.push(t2);
    }
  }
  return seq;
}

/**
 * Vytvoří plán cvičení.
 * @param {object} spec zadání (viz course.js)
 * @param {object} profile hlasový profil
 * @param {{seed?:number, sylMode?:string}} o
 */
export function buildExercise(spec, profile, o = {}) {
  const rand = mulberry(o.seed ?? Date.now());
  const tempo = spec.tempo || 80;
  const bpb = spec.bpb || 4;
  const lo = spec.falsetto ? profile.comfortLow : profile.comfortLow;
  const hi = spec.falsetto ? profile.highAll : spec.extended ? profile.highChest : profile.comfortHigh;
  const base = profile.workingTonic + (spec.baseShift || 0);
  const sylMode = spec.syl || o.sylMode || 'solf';
  const plan = { spec, kind: 'pitch', tempo, bpb, countIn: spec.countIn ?? bpb, items: [], chords: [], keyPc: pc(base), totalBeats: 0, guide: spec.guide !== false, hideCurve: !!spec.hideCurve, title: EXERCISE_TYPES[spec.type] };
  let t = 0;
  const push = (it) => { plan.items.push(it); };
  const chordAt = (tonic, at, d) => plan.chords.push({ t: at, d, sym: transposeChordSym(diatonicChord(0, 1), ((tonic % 12) + 12) % 12) });

  switch (spec.type) {
    case 'scale': case 'arpeggio': case 'interval': case 'hold': case 'callResponse': case 'free': {
      let degrees = spec.degrees || [1];
      let durs = spec.durs || degrees.map(() => 1);
      if (spec.type === 'hold') { degrees = spec.degrees || [1]; durs = degrees.map(() => spec.holdBeats || 4); }
      const offsets = degrees.map((d) => degreeToSemis(d, SCALES[spec.scale || 'major']));
      const tonics = tonicSequence(offsets, base, lo, hi, spec.reps || 3, spec.direction || 'up');
      let phrase = 0;
      for (const tonic of tonics) {
        const repKey = pc(tonic);
        // nápověda: akord tóniky + první tón
        const cue = spec.cueBeats ?? 2;
        if (cue > 0) {
          chordAt(tonic, t, cue);
          push({ t, d: cue * 0.9, midi: tonic + offsets[0], listen: true, cue: true, phrase });
          t += cue;
        }
        if (spec.type === 'callResponse' || spec.listenFirst) {
          let tt = t;
          offsets.forEach((off, i) => { push({ t: tt, d: durs[i] * 0.95, midi: tonic + off, listen: true, syl: sylFor(degrees[i], sylMode, repKey, tonic + off), phrase }); tt += durs[i]; });
          t = tt + 1;
        }
        let tt = t;
        offsets.forEach((off, i) => {
          push({ t: tt, d: durs[i], midi: tonic + off, syl: sylFor(degrees[i], sylMode, repKey, tonic + off), phrase, kind: 'note' });
          tt += durs[i];
        });
        chordAt(tonic, t, tt - t);
        t = tt + (spec.gapBeats ?? 1);
        phrase++;
      }
      break;
    }
    case 'match': {
      // náhodné nebo dané tóny; každý: poslech 2 doby, zpěv 3 doby
      const count = spec.count || 5;
      const pool = [];
      const degs = spec.degrees || [1, 2, 3, 4, 5];
      for (const d of degs) {
        const m = base + degreeToSemis(d);
        if (m >= lo && m <= hi) pool.push({ d, m });
      }
      if (spec.random) {
        pool.length = 0;
        for (let m = lo; m <= hi; m++) pool.push({ d: null, m });
      }
      if (!pool.length) pool.push({ d: 1, m: Math.max(lo, Math.min(hi, base)) });
      const seq = [];
      for (let i = 0; i < count; i++) {
        if (spec.random) {
          let pick;
          do { pick = pool[Math.floor(rand() * pool.length)]; } while (seq.length && pick.m === seq[seq.length - 1].m && pool.length > 1);
          seq.push(pick);
        } else seq.push(pool[i % pool.length]);
      }
      seq.forEach((s, i) => {
        push({ t, d: 1.8, midi: s.m, listen: true, phrase: i });
        t += 2;
        push({ t, d: spec.holdBeats || 3, midi: s.m, syl: s.d ? sylFor(s.d, sylMode, pc(base), s.m) : sylMode === 'solf' ? 'u' : LA[sylMode] || 'u', phrase: i, kind: 'note' });
        t += (spec.holdBeats || 3) + 1;
      });
      plan.guide = false;
      break;
    }
    case 'siren': {
      // glissando mezi stupni (nebo přes celý pohodlný rozsah)
      const reps = spec.reps || 3;
      const from = spec.fromDeg ?? 1, to = spec.toDeg ?? 5;
      const offs = [degreeToSemis(from), degreeToSemis(to)];
      if (spec.backDeg != null) offs.push(degreeToSemis(spec.backDeg));
      let tonics = tonicSequence(offs, base, lo, hi, reps, 'up');
      if (spec.fullRange) tonics = [null];
      let phrase = 0;
      for (const tonic of tonics) {
        const a = tonic == null ? lo + 1 : tonic + offs[0];
        const b = tonic == null ? hi - 1 : tonic + offs[1];
        const seg = spec.glideBeats || 4;
        chordAt(tonic ?? lo, t, 1);
        push({ t, d: 0.9, midi: a, listen: true, cue: true, phrase });
        t += 1;
        push({ t, d: seg, midi: a, toMidi: b, kind: 'glide', syl: spec.sylText || 'u', phrase });
        t += seg;
        if (offs.length > 2) {
          const c = tonic == null ? lo + 1 : tonic + offs[2];
          push({ t, d: seg, midi: b, toMidi: c, kind: 'glide', syl: spec.sylText || 'u', phrase });
          t += seg;
        }
        t += 1;
        phrase++;
      }
      plan.guide = true;
      break;
    }
    case 'rhythm': {
      // rytmický vzor: poslech (klávesy) → zopakuj na „pa“ (výška se nehodnotí)
      plan.kind = 'rhythm';
      const pattern = spec.pattern || [[0, 1], [1, 1], [2, 1], [3, 1]];
      const len = spec.patternBeats || bpb;
      const reps = spec.reps || 3;
      const m = Math.max(lo, Math.min(hi, base + 4));
      for (let r = 0; r < reps; r++) {
        if (!spec.noListen) {
          for (const [pt, pd] of pattern) push({ t: t + pt, d: pd * 0.8, midi: m, listen: true, phrase: r });
          t += len;
        }
        for (const [pt, pd] of pattern) push({ t: t + pt, d: pd, midi: m, syl: 'pa', phrase: r, kind: 'rhythm' });
        t += len;
      }
      plan.metronome = true;
      plan.guide = false;
      break;
    }
    case 'breath': {
      plan.kind = 'breath';
      plan.targetSec = spec.target || 10;
      plan.steady = !!spec.steady;
      plan.countIn = 4;
      t = Math.ceil((plan.targetSec + 6) / (60 / tempo));
      break;
    }
    case 'dynamics': {
      plan.kind = 'dynamics';
      const m = Math.max(lo, Math.min(hi, base + degreeToSemis(spec.degree || 3)));
      const beats = spec.holdBeats || 8;
      const reps = spec.reps || 2;
      plan.curve = spec.curve || 'cresc';
      plan.range = spec.rangeDb || 12;
      for (let r = 0; r < reps; r++) {
        chordAt(m - degreeToSemis(spec.degree || 3), t, 1);
        push({ t, d: 0.9, midi: m, listen: true, cue: true, phrase: r });
        t += 1;
        push({ t, d: beats, midi: m, syl: spec.sylText || 'a', phrase: r, kind: 'note', dyn: plan.curve });
        t += beats + 1;
      }
      plan.guide = false;
      break;
    }
    case 'earInterval': {
      plan.kind = 'ear';
      const ints = spec.intervals || [2, 4];
      const count = spec.count || 8;
      plan.questions = [];
      for (let i = 0; i < count; i++) {
        const semi = ints[Math.floor(rand() * ints.length)];
        const quality = spec.quality ? spec.quality : null;
        const root = Math.round(Math.max(lo, Math.min(hi - semi, base + Math.floor(rand() * 5))));
        const harmonic = spec.harmonic && rand() < 0.5;
        plan.questions.push({ root, semi, options: ints, harmonic, quality });
      }
      break;
    }
    case 'melodyEar': {
      plan.kind = 'ear';
      plan.melodic = true;
      break;
    }
    case 'voicetest':
      plan.kind = 'voicetest';
      break;
    default:
      throw new Error('Neznámý typ cvičení ' + spec.type);
  }
  plan.totalBeats = t;
  // bezpečnost: nic nad změřený rozsah
  const maxAllowed = spec.falsetto ? profile.highAll : profile.highChest;
  for (const it of plan.items) {
    if (it.midi > maxAllowed) it.midi = maxAllowed;
    if (it.toMidi != null && it.toMidi > maxAllowed) it.toMidi = maxAllowed;
  }
  return plan;
}

/** Převede položky plánu na sekundy (s ohledem na odpočet) a vrátí cíle k hodnocení. */
export function planTargets(plan, tempoFactor = 1) {
  const spb = 60 / (plan.tempo * tempoFactor);
  const off = plan.countIn * spb;
  return plan.items.filter((i) => !i.listen).map((i) => ({
    start: off + i.t * spb, end: off + (i.t + i.d) * spb, midi: i.midi, toMidi: i.toMidi, kind: i.kind || 'note', phrase: i.phrase, syl: i.syl, dyn: i.dyn,
  }));
}

/** Křivka dynamiky: relativní dB v čase (0..1 průběhu). */
export function dynamicsCurve(kind, range = 12) {
  switch (kind) {
    case 'cresc': return (x) => -range / 2 + range * x;
    case 'decresc': return (x) => range / 2 - range * x;
    case 'messa': return (x) => (x < 0.5 ? -range / 2 + range * 2 * x : range / 2 - range * 2 * (x - 0.5));
    default: return () => 0;
  }
}

export function mulberry(a) {
  a = a >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
