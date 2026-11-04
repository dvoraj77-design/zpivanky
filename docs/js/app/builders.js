// Sestavení parametrů běhu (Session) pro cvičení a písně podle nastavení.
import { generateAccompaniment, guideEvents, metronomeEvents, roleOf } from '../core/accomp.js';

const BUS = { chords: 'accomp', bass: 'bass', drums: 'drums' };
import { buildExercise } from '../core/exercises.js';
import { state, tol, hpProfile } from '../state.js';
import { transposeSong, keyPc } from '../core/song.js';

/** Nástroj vodicí melodie: syntetický hlas, klavír nebo vzorkovaný nástroj (flétna, klarinet, housle…). */
export const GUIDE_INSTRUMENTS = [['guide', 'Hlas (ú)'], ['piano', 'Klavír'], ['flute', 'Flétna'], ['clarinet', 'Klarinet'], ['violin', 'Housle'], ['cello', 'Violoncello'], ['sax', 'Saxofon'], ['organ', 'Varhany']];
const guideInst = () => { const g = state.settings.guideInst || 'guide'; return g === 'piano' ? 'guidePiano' : GUIDE_INSTRUMENTS.some(([k]) => k === g) ? g : 'guide'; };
export const noHeadphones = () => state.settings.headphones === 'no' || hpProfile()?.type === 'speaker';

/** Akordy cvičení → tichý klavír + basa. */
function chordEvents(chords, bpb) {
  if (!chords.length) return [];
  const length = Math.max(...chords.map((c) => c.t + c.d));
  const ev = generateAccompaniment({ chords, meter: [bpb, 4], length, notes: [] }, { style: 'piano', bass: true });
  return ev.map((e) => ({ ...e, vel: e.vel * 0.7 }));
}

export function exercisePlan(spec, seed) {
  const s = { ...spec };
  return buildExercise(s, state.profile, { seed, sylMode: s.syl || (state.settings.notation === 'solf' ? 'solf' : 'solf') });
}

export function exerciseSessionOpts(plan, { guide = true } = {}) {
  const bpb = plan.bpb || 4;
  const audio = [];
  audio.push(...chordEvents(plan.chords, bpb));
  for (const it of plan.items) {
    if (it.listen) {
      if (plan.kind === 'rhythm') audio.push({ t: it.t, d: 0.05, midi: 84, inst: 'click', vel: 0.9, bus: 'accomp' });
      else audio.push({ t: it.t, d: it.d, midi: it.midi, toMidi: it.toMidi, inst: guideInst(), vel: 0.75, bus: 'accomp' });
    } else if (guide && plan.guide && it.kind !== 'rhythm') {
      audio.push({ t: it.t, d: it.d * 0.97, midi: it.midi, toMidi: it.toMidi, inst: guideInst(), vel: 0.6, bus: 'guide' });
    }
  }
  return {
    kind: plan.kind === 'ear' || plan.kind === 'voicetest' ? 'pitch' : plan.kind,
    items: plan.items, audio, tempo: plan.tempo, factor: state.settings.exTempo ?? 0.7, bpb, countIn: plan.countIn ?? bpb,
    metronome: !!plan.metronome, tol: tol(), latencyMs: hpProfile()?.latencyMs ?? 0,
    record: state.settings.saveRecordings, dyn: { curve: plan.curve, range: plan.range }, keyPc: plan.keyPc, hideCurve: plan.hideCurve,
  };
}

/**
 * mode: 'sing' (doprovod + vodicí melodie na přepínač) | 'phrase' (smyčka fráze, volitelně čekání na tón) | 'listen'
 */
export function songSessionOpts(song0, { shift = 0, factor = 1, mode = 'sing', loop = null, wait = false, style, drums, bass, metronome = false, clips = null, phrase = null, prep = null } = {}) {
  const song = transposeSong(song0, shift);
  const bpb = song.meter[0];
  // originální doprovod (importovaná píseň): syntetický doprovod se nehraje
  const orig = !!clips?.length;
  const st = orig ? 'none' : style || state.settings.accStyle;
  const acc = st === 'none' ? [] : generateAccompaniment(song, { style: st, bass: bass ?? state.settings.bass, drums: drums ?? state.settings.drums });
  // nácvik fráze: vodicí melodie jen pro nacvičovanou frázi (v přípravném taktu nic nezpívá)
  const guide = guideEvents(song, guideInst()).map((e, i) => ({ ...e, bus: 'guide', phrase: song.notes[i].phrase })).filter((e) => phrase == null || e.phrase === phrase);
  let items = song.notes.map((n) => ({ t: n.t, d: n.d, midi: n.p, syl: lyricSyl(n, song), phrase: n.phrase, kind: 'note', note: n }));
  const audio = [...acc.map((e) => ({ ...e, bus: BUS[roleOf(e)] }))];
  // přípravný takt: tiché kliky, aby smyčka držela rytmus
  if (prep && prep.from >= 0) audio.push(...metronomeEvents(prep.from, prep.to, bpb).map((e) => ({ ...e, vel: e.vel * 0.6 })));
  const origVoc = orig && clips.some((c) => c.which === 'voc');
  if (mode === 'listen') { items = items.map((i) => ({ ...i, listen: true })); if (!origVoc) audio.push(...guide.map((e) => ({ ...e, bus: 'accomp' }))); }
  else audio.push(...guide);
  return {
    song, kind: 'pitch', items, audio, tempo: song.tempo, factor, bpb, countIn: bpb, metronome,
    tol: tol(), latencyMs: hpProfile()?.latencyMs ?? 0, waitMode: mode === 'phrase' && wait, loop, loopLead: prep ? 0 : undefined,
    record: mode !== 'listen' && state.settings.saveRecordings, keyPc: keyPc(song.key.tonic) + (song.key.mode === 'minor' ? 3 : 0), length: song.length,
    clips: orig ? clips.map((c) => (mode === 'listen' && c.which === 'voc' ? { ...c, bus: 'accomp' } : c)) : [],
  };
}

function lyricSyl(n, song) {
  const m = state.settings.lyricsMode;
  if (m === 'la') return n.melisma ? '' : 'la';
  if (m === 'nu') return n.melisma ? '' : 'nu';
  if (m === 'solf') {
    const k = (keyPc(song.key.tonic) + (song.key.mode === 'minor' ? 3 : 0)) % 12;
    const SOLF = ['do', 'di', 're', 'me', 'mi', 'fa', 'fi', 'sol', 'si', 'la', 'te', 'ti'];
    return SOLF[(((n.p - k) % 12) + 12) % 12];
  }
  return n.syl;
}
