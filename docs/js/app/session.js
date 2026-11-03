// Běh cvičení / písně: transport + mikrofon → mapování na doby → živý stav → hodnocení → uložení.
import { engine } from '../audio/engine.js';
import { Transport } from '../audio/transport.js';
import { metronomeEvents } from '../core/accomp.js';
import { scorePitchTargets, summarize, scoreRhythm, scoreDynamics, scoreBreath, starsFor, gradeLabel } from '../core/scoring.js';
import { foldCents, median } from '../core/music.js';
import { dynamicsCurve } from '../core/exercises.js';
import { statusOf } from '../ui/pitchroll.js';

/**
 * opts: {
 *  kind: 'pitch'|'rhythm'|'dynamics'|'breath',
 *  items: [{t,d,midi,toMidi,kind,syl,phrase,listen}] (doby, bez odpočtu),
 *  audio: [{t,d,midi,inst,vel,bus?}] (doby, bez odpočtu),
 *  tempo, factor, bpb, countIn (doby), metronome(bool), tol, latencyMs, waitMode, loop:{from,to} (doby bez odpočtu),
 *  record(bool), dyn:{curve, range}, breath:{targetSec}, octaveFree
 * }
 */
export class Session {
  constructor(o) {
    this.o = { factor: 1, bpb: 4, countIn: 4, tol: 50, latencyMs: 0, octaveFree: true, ...o };
    this.transport = new Transport(engine);
    this.frames = [];
    this.curve = [];
    this.pass = 0;
    this.live = { midi: null, dev: null, status: 'none', idx: -1 };
    this.state = 'idle';
    this.unsub = null;
    this.hitRun = 0;
    this.waitIdx = -1;
    this.listeners = new Set();
    const ci = this.o.countIn;
    // všechny položky posunuté o odpočet
    this.items = this.o.items.map((it, i) => ({ ...it, t: it.t + ci }));
    let ri = 0;
    for (const it of this.items) if (!it.listen) it.ri = ri++;
    this.targets = this.items.filter((it) => !it.listen);
    this.results = {};
  }
  get spb() { return 60 / (this.o.tempo * this.o.factor); }
  get lat() { return (this.o.latencyMs || 0) / 1000; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const l of this.listeners) l(this); }

  /** Doba, kterou uživatel právě slyší (výstup zpožděn). */
  displayBeat() {
    if (this.state === 'idle') return 0;
    const outLat = Math.max(0, this.lat - 0.03);
    return this.transport.timeToBeat(engine.smoothNow() - outLat);
  }

  async start() {
    const o = this.o;
    await engine.ensureContext();
    await engine.loadInstruments().catch(() => {});
    const ci = o.countIn;
    const ev = o.audio.map((e) => ({ ...e, t: e.t + ci }));
    const len = Math.max(...this.items.map((i) => i.t + i.d), ...ev.map((e) => e.t + e.d), ci) + 0.5;
    if (ci > 0) ev.push(...metronomeEvents(0, ci, o.bpb).map((e) => ({ ...e, vel: 1 })));
    if (o.metronome) ev.push(...metronomeEvents(ci, len, o.bpb));
    this.length = len;
    const loop = o.loop ? { from: o.loop.from + ci, to: o.loop.to + ci } : null;
    this.transport.load({ events: ev, tempo: o.tempo, factor: o.factor, length: len, loop });
    this.transport.onLoop = () => { this.pass++; this._emit(); };
    this.transport.onEnd = () => this.finish();
    this.frames = []; this.curve = []; this.results = {};
    engine.resetTracker();
    this.unsub = engine.onFrames((fr) => this._onFrames(fr));
    if (o.record) engine.startRecording();
    this.startTime = this.transport.start(loop ? Math.max(0, loop.from - o.bpb) : 0, 0.25);
    if (engine.testBuffer && o.testInput !== false) engine.startTestInput(this.startTime + (o.testOffset || 0));
    this.state = 'running';
    this.t0 = performance.now();
    this._raf = setInterval(() => this._tick(), 30);
    this._emit();
  }

  _onFrames(fr) {
    for (const f of fr) {
      const tp = f.t - this.lat;
      const beat = this.transport.timeToBeat(tp);
      const rec = { beat, t: tp, midi: f.midi, voiced: f.voiced, db: f.db, onset: f.onset, hiss: f.hiss, pass: this.pass };
      this.frames.push(rec);
      // živý stav vůči aktuálnímu cíli
      const tg = this._targetAt(beat);
      let dev = null;
      if (f.voiced && f.midi != null && tg && tg.kind !== 'rhythm') {
        const target = tg.kind === 'glide' ? tg.midi + (tg.toMidi - tg.midi) * Math.min(1, Math.max(0, (beat - tg.t) / tg.d)) : tg.midi;
        dev = (f.midi - target) * 100;
        if (this.o.octaveFree) dev = foldCents(dev);
      }
      const st = dev == null ? 'none' : statusOf(dev, this.o.tol * (tg?.kind === 'glide' ? 2 : 1));
      // zobrazovaná výška: při zpěvu o oktávu jinak ukaž v oktávě cíle
      let showMidi = f.midi;
      if (f.midi != null && tg && this.o.octaveFree && tg.kind !== 'rhythm') {
        const tm = tg.kind === 'glide' ? tg.midi : tg.midi;
        showMidi = f.midi - Math.round((f.midi - tm) / 12) * 12;
      }
      this.curve.push({ b: beat, m: f.voiced ? showMidi : null, s: st });
      this.live = { midi: f.voiced ? showMidi : null, dev, status: st, idx: tg ? tg.ri : -1, db: f.db, hiss: f.hiss, rawMidi: f.midi };
      if (this.o.waitMode) this._waitCheck(tg, st);
    }
    if (this.curve.length > 4000) this.curve.splice(0, this.curve.length - 3000);
  }

  _targetAt(beat) {
    for (const t of this.targets) if (beat >= t.t && beat < t.t + t.d) return t;
    return null;
  }

  _waitCheck(tg, st) {
    // čekej na mě: drží čas na začátku noty, dokud ji netrefíš (~150 ms)
    if (this.transport.frozen) {
      if (st === 'ok' || st === 'near') this.hitRun++; else this.hitRun = 0;
      if (this.hitRun >= 12) { this.hitRun = 0; this._held?.stop?.(); this._held = null; this.transport.unfreeze(); this.waitIdx = this._waitTarget?.ri ?? -1; }
    }
  }
  _tick() {
    if (this.state !== 'running') return;
    if (this.o.waitMode && !this.transport.frozen) {
      const b = this.transport.currentBeat();
      const next = this.targets.find((t) => t.ri > this.waitIdx && t.kind !== 'rhythm');
      if (next && b >= next.t + 0.05 && b < next.t + next.d) {
        const recent = this.frames.slice(-10);
        const hit = recent.filter((f) => f.voiced && f.midi != null && Math.abs(foldCents((f.midi - next.midi) * 100)) <= this.o.tol * 2).length >= 6;
        if (hit) this.waitIdx = next.ri;
        else {
          this._waitTarget = next;
          this.transport.freeze();
          this._held = engine.playEvent({ midi: next.midi, inst: 'guide', vel: 0.5 }, engine.now + 0.02, 30);
          this.hitRun = 0;
        }
      }
    }
    // živé barvení výsledků
    this._emit();
  }

  /** Rychlé skóre jedné fráze (průběžně během zpěvu). */
  phraseScore(phrase) {
    const spb = this.spb;
    const tg = this.targets.filter((t) => t.phrase === phrase && t.kind !== 'rhythm');
    if (!tg.length) return null;
    const pass = this.pass;
    const fs = this.frames.filter((f) => (!this.o.loop || f.pass === pass) && f.beat >= tg[0].t - 1 && f.beat <= tg[tg.length - 1].t + tg[tg.length - 1].d + 0.5)
      .map((f) => ({ t: f.beat * spb, midi: f.midi, voiced: f.voiced }));
    const notes = scorePitchTargets(tg.map((t) => ({ start: t.t * spb, end: (t.t + t.d) * spb, midi: t.midi, toMidi: t.toMidi, kind: t.kind, phrase: t.phrase, syl: t.syl, checkOnset: !this.o.waitMode })), fs, { tol: this.o.tol, octaveFree: this.o.octaveFree });
    return summarize(notes, { tol: this.o.tol }).overall;
  }

  stop() { return this.finish(true); }

  async finish(aborted = false) {
    if (this.state === 'done' || this.state === 'finishing') return this.result;
    this.state = 'finishing';
    clearInterval(this._raf);
    this._held?.stop?.();
    // počkej na poslední snímky (zpoždění)
    await new Promise((r) => setTimeout(r, Math.min(600, 150 + this.o.latencyMs)));
    this.transport.stop();
    engine.stopTestInput();
    this.unsub && this.unsub();
    let rec = null;
    if (this.o.record) rec = await engine.stopRecording();
    this.state = 'done';
    this.aborted = aborted;
    this.result = this.computeResult();
    if (rec && rec.pcm.length) {
      this.result.recording = { pcm: rec.pcm, rate: rec.rate, offset: rec.start - this.startTime, latency: this.lat };
    }
    this.result.seconds = (performance.now() - this.t0) / 1000;
    this._emit();
    return this.result;
  }

  computeResult() {
    const o = this.o, spb = this.spb;
    let frames = this.frames;
    if (o.loop) {
      const lastPass = Math.max(0, ...frames.map((f) => f.pass));
      const pick = frames.filter((f) => f.pass === lastPass).length > 50 ? lastPass : Math.max(0, lastPass - 1);
      frames = frames.filter((f) => f.pass === pick);
    }
    const fs = frames.map((f) => ({ t: f.beat * spb, midi: f.midi, voiced: f.voiced, db: f.db, onset: f.onset, hiss: f.hiss }));
    const inLoop = (t) => !o.loop || (t.t >= o.loop.from + o.countIn - 1e-6 && t.t + t.d <= o.loop.to + o.countIn + 1e-6);
    const targets = this.targets.filter(inLoop);
    const tsec = targets.map((t) => ({ start: t.t * spb, end: (t.t + t.d) * spb, midi: t.midi, toMidi: t.toMidi, kind: t.kind, phrase: t.phrase, syl: t.syl, ri: t.ri, checkOnset: !o.waitMode }));
    const curve = this.curve.map((c) => ({ ...c }));
    if (o.kind === 'rhythm') {
      const onsets = [];
      let prevVoiced = false, last = -1;
      for (const f of fs) {
        const on = f.onset || (f.voiced && !prevVoiced);
        if (on && f.t - last > 0.12) { onsets.push(f.t); last = f.t; }
        prevVoiced = f.voiced || f.db > -45;
      }
      const first = tsec.length ? tsec[0].start - 0.4 : 0;
      const r = scoreRhythm(tsec, onsets.filter((t) => t >= first));
      r.notes.forEach((n, i) => { this.results[targets[i].ri] = n.status === 'ok' ? 'ok' : n.status === 'missed' ? 'missed' : 'near'; });
      return { kind: 'rhythm', overall: r.overall, label: r.label, stars: r.stars, tip: r.tip, rhythm: r.overall, notes: r.notes, phrases: groupPhrases(r.notes), curve, frames: decimate(fs) };
    }
    if (o.kind === 'dynamics') {
      const curveFn = dynamicsCurve(o.dyn?.curve || 'cresc', o.dyn?.range ?? 12);
      const scores = [];
      let allCurve = [];
      const pitchNotes = scorePitchTargets(tsec, fs, { tol: o.tol, octaveFree: o.octaveFree });
      for (const t of tsec) {
        const seg = fs.filter((f) => f.t >= t.start && f.t <= t.end && f.voiced);
        const ref = seg.length ? median(seg.map((f) => f.db)) : -40;
        const d = scoreDynamics((tt) => curveFn((tt - t.start) / (t.end - t.start)), fs, t.start + 0.1, t.end, ref);
        scores.push(d); allCurve = allCurve.concat(d.curve);
      }
      const dynScore = Math.round(scores.reduce((a, s) => a + s.overall, 0) / Math.max(1, scores.length));
      const pitchScore = summarize(pitchNotes, { tol: o.tol }).pitch;
      const overall = Math.round(0.7 * dynScore + 0.3 * pitchScore);
      pitchNotes.forEach((n, i) => { this.results[targets[i].ri] = n.status === 'ok' ? 'ok' : n.status; });
      const worst = scores.slice().sort((a, b) => a.overall - b.overall)[0];
      return { kind: 'dynamics', overall, label: gradeLabel(overall), stars: starsFor(overall), tip: worst?.tip || '', dynamics: dynScore, pitch: pitchScore, notes: pitchNotes, phrases: scores.map((s, i) => ({ index: i, score: s.overall, label: `Pokus ${i + 1}`, notes: [pitchNotes[i]].filter(Boolean) })), dynCurve: allCurve, curve, frames: decimate(fs) };
    }
    const notes = scorePitchTargets(tsec, fs, { tol: o.tol, octaveFree: o.octaveFree });
    notes.forEach((n, i) => { n.ri = tsec[i].ri; this.results[tsec[i].ri] = n.status; });
    const sum = summarize(notes, { tol: o.tol });
    return { kind: 'pitch', ...sum, notes, curve, frames: decimate(fs) };
  }
}

function groupPhrases(notes) {
  const m = new Map();
  for (const n of notes) { const p = m.get(n.phrase) || { index: n.phrase, notes: [], score: 0 }; p.notes.push(n); m.set(n.phrase, p); }
  return [...m.values()].map((p) => ({ ...p, score: Math.round(p.notes.reduce((a, n) => a + n.score, 0) / p.notes.length), label: `Vzor ${p.index + 1}` }));
}
export function decimate(fs, step = 2) {
  const out = [];
  for (let i = 0; i < fs.length; i += step) { const f = fs[i]; out.push({ t: Math.round(f.t * 1000) / 1000, m: f.midi == null ? null : Math.round(f.midi * 100) / 100 }); }
  return out;
}

/** Jednoduchý běh dechového cvičení (bez transportu). */
export class BreathSession {
  constructor({ targetSec = 10, steady = false }) { this.targetSec = targetSec; this.steady = steady; this.frames = []; this.state = 'idle'; this.listeners = new Set(); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const l of this.listeners) l(this); }
  async start(prepSec = 3) {
    await engine.ensureContext();
    this.t0 = engine.now + prepSec;
    this.frames = [];
    this.unsub = engine.onFrames((fr) => { for (const f of fr) this.frames.push({ t: f.t - this.t0, db: f.db, hiss: f.hiss, voiced: f.voiced, zcr: f.zcr, floorDb: f.floorDb }); this._emit(); });
    if (engine.testBuffer) engine.startTestInput(this.t0);
    this.state = 'running';
    this.started = performance.now();
    this._emit();
  }
  elapsed() { return engine.now - this.t0; }
  async finish() {
    if (this.state === 'done') return this.result;
    this.unsub && this.unsub();
    engine.stopTestInput();
    this.state = 'done';
    const r = scoreBreath(this.frames, 0, this.targetSec + 8, this.targetSec);
    let overall = r.overall;
    if (this.steady) overall = Math.round(0.5 * r.overall + 0.5 * r.stability * (r.duration > 2 ? 1 : 0));
    this.result = { kind: 'breath', ...r, overall, label: gradeLabel(overall), stars: starsFor(overall), seconds: (performance.now() - this.started) / 1000, frames: this.frames.filter((_, i) => i % 3 === 0) };
    this._emit();
    return this.result;
  }
}
