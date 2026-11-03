// Sestavení parametrů běhu (Session) pro cvičení a písně podle nastavení.
import { generateAccompaniment, guideEvents } from '../core/accomp.js';
import { buildExercise } from '../core/exercises.js';
import { state, tol, hpProfile } from '../state.js';
import { transposeSong, keyPc } from '../core/song.js';

const guideInst = () => (state.settings.guideInst === 'piano' ? 'guidePiano' : 'guide');
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
  if (noHeadphones() && ['scale', 'arpeggio', 'interval', 'hold'].includes(s.type)) s.listenFirst = true;
  return buildExercise(s, state.profile, { seed, sylMode: s.syl || (state.settings.notation === 'solf' ? 'solf' : 'solf') });
}

export function exerciseSessionOpts(plan, { guide = true } = {}) {
  const bpb = plan.bpb || 4;
  const nohp = noHeadphones();
  const audio = [];
  if (!nohp || true) audio.push(...chordEvents(plan.chords, bpb).filter((e) => !nohp || plan.items.some((i) => i.listen && Math.abs(i.t - e.t) < 0.01)));
  for (const it of plan.items) {
    if (it.listen) {
      if (plan.kind === 'rhythm') audio.push({ t: it.t, d: 0.05, midi: 84, inst: 'click', vel: 0.9, bus: 'accomp' });
      else audio.push({ t: it.t, d: it.d, midi: it.midi, toMidi: it.toMidi, inst: guideInst(), vel: 0.75, bus: 'accomp' });
    } else if (guide && plan.guide && !nohp && it.kind !== 'rhythm') {
      audio.push({ t: it.t, d: it.d * 0.97, midi: it.midi, toMidi: it.toMidi, inst: guideInst(), vel: 0.6, bus: 'guide' });
    }
  }
  return {
    kind: plan.kind === 'ear' || plan.kind === 'voicetest' ? 'pitch' : plan.kind,
    items: plan.items, audio, tempo: plan.tempo, bpb, countIn: plan.countIn ?? bpb,
    metronome: !!plan.metronome, tol: tol(), latencyMs: hpProfile()?.latencyMs ?? 0,
    record: state.settings.saveRecordings, dyn: { curve: plan.curve, range: plan.range }, keyPc: plan.keyPc, hideCurve: plan.hideCurve,
  };
}

/**
 * mode: 'listen' | 'guided' | 'solo' | 'perform' | 'alternate' | 'wait' | 'phrase'
 */
export function songSessionOpts(song0, { shift = 0, factor = 1, mode = 'guided', loop = null, style, drums, bass, metronome = false } = {}) {
  const song = transposeSong(song0, shift);
  const bpb = song.meter[0];
  const st = style || state.settings.accStyle;
  const acc = st === 'none' ? [] : generateAccompaniment(song, { style: st, bass: bass ?? state.settings.bass, drums: drums ?? state.settings.drums });
  const guide = guideEvents(song, guideInst()).map((e) => ({ ...e, bus: 'guide' }));
  let items = song.notes.map((n) => ({ t: n.t, d: n.d, midi: n.p, syl: lyricSyl(n, song), phrase: n.phrase, kind: 'note', note: n }));
  let audio = [...acc.map((e) => ({ ...e, bus: 'accomp' }))];
  const nohp = noHeadphones();
  if (mode === 'listen') { items = items.map((i) => ({ ...i, listen: true })); audio.push(...guide.map((e) => ({ ...e, bus: 'accomp' }))); }
  else if (mode === 'guided' || mode === 'wait' || mode === 'phrase') audio.push(...guide);
  let length = song.length;
  if (mode === 'alternate' || (nohp && mode !== 'listen')) {
    const alt = alternateTimeline(song, acc, guide, items);
    items = alt.items; audio = alt.audio; length = alt.length;
  }
  return {
    song, kind: 'pitch', items, audio, tempo: song.tempo, factor, bpb, countIn: bpb, metronome,
    tol: tol(), latencyMs: hpProfile()?.latencyMs ?? 0, waitMode: mode === 'wait', loop,
    record: mode !== 'listen' && state.settings.saveRecordings, keyPc: keyPc(song.key.tonic) + (song.key.mode === 'minor' ? 3 : 0), length,
    alternate: mode === 'alternate' || (nohp && mode !== 'listen'),
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

/** Režim „poslechni → zazpívej“: každá fráze nejdřív zazní, pak ji zpíváš sám (bez doprovodu). */
export function alternateTimeline(song, acc, guide, items) {
  const outItems = [], outAudio = [];
  const firstNote = song.notes[0]?.t ?? 0;
  // předehra beze změny
  for (const e of acc) if (e.t < firstNote) outAudio.push({ ...e, bus: 'accomp' });
  let cursor = firstNote;
  const phrases = song.phrases.length ? song.phrases : [{ start: firstNote, end: song.length, index: 0 }];
  for (const ph of phrases) {
    const s = ph.start, e = Math.ceil((ph.end + 0.01) / 1) * 1;
    const len = e - s;
    for (const ev of acc) if (ev.t >= s && ev.t < e) outAudio.push({ ...ev, t: ev.t - s + cursor, d: Math.min(ev.d, e - ev.t), bus: 'accomp' });
    for (const ev of guide) if (ev.t >= s && ev.t < e) outAudio.push({ ...ev, t: ev.t - s + cursor, bus: 'accomp' });
    for (const it of items) if (it.t >= s && it.t < e) outItems.push({ ...it, t: it.t - s + cursor, listen: true });
    cursor += len + 1;
    // nápověda: první tón fráze krátce
    for (const it of items) if (it.t >= s && it.t < e) outItems.push({ ...it, t: it.t - s + cursor, listen: false });
    cursor += len + 1;
  }
  const tonic = acc.filter((e) => e.t >= song.length - song.meter[0] * 1.5);
  for (const ev of tonic) outAudio.push({ ...ev, t: cursor + (ev.t - (song.length - song.meter[0])), bus: 'accomp' });
  return { items: outItems, audio: outAudio.filter((e) => e.t >= 0), length: cursor + song.meter[0] };
}
