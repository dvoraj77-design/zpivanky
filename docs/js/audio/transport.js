// Plánovač (transport): přehrává události v dobách s tempem, smyčkou, pauzou a režimem „čekej na mě“.
// Mapování doba ↔ čas je po segmentech (každý start/pokračování = nový segment).
export class Transport {
  constructor(engine) {
    this.engine = engine;
    this.events = [];
    this.tempo = 90; this.factor = 1;
    this.segments = [];
    this.playing = false;
    this.frozen = false;
    this.loop = null; // {from, to}
    this.active = new Set();
    this.timer = null;
    this.lookahead = 0.3;
    this.onLoop = null; this.onEnd = null;
    this.length = 0;
    this.mute = {}; // inst/bus → bool
    this.clips = []; // originální stopy: {buffer, beat0 (doba začátku bufferu), spb (s bufferu na dobu), rate, bus, gain}
    this.clipSrc = [];
    Transport.last = this; // pro testy
  }
  get spb() { return 60 / (this.tempo * this.factor); }
  load({ events, tempo, factor = 1, length, loop = null, clips = [] }) {
    this.stop();
    this.clips = clips;
    this.events = events.slice().sort((a, b) => a.t - b.t);
    this.tempo = tempo; this.factor = factor; this.length = length ?? Math.max(0, ...events.map((e) => e.t + e.d));
    this.loop = loop;
  }
  setFactor(f) {
    if (!this.playing) { this.factor = f; return; }
    const b = this.currentBeat();
    this.factor = f;
    this._newSegment(this.engine.now + 0.05, b + 0.05 / this.spb);
  }
  _newSegment(time, beat) {
    this.segments.push({ time, beat, spb: this.spb });
    this.idx = this.events.findIndex((e) => e.t >= beat - 1e-6);
    if (this.idx < 0) this.idx = this.events.length;
    this.schedBeat = beat;
    this._startClips(time, beat);
  }
  /** Spustí originální stopy od doby beat v čase time (předchozí utne ve stejný okamžik – smyčka bez mezery). */
  _startClips(time, beat) {
    const ctx = this.engine.ctx;
    for (const s of this.clipSrc) { try { s.stop(Math.max(time, this.engine.now)); } catch { /* */ } }
    this.clipSrc = [];
    if (!ctx || !this.clips.length || !Number.isFinite(this.spb)) return;
    for (const c of this.clips) {
      if (this.mute[c.bus]) continue;
      const p = c.spb / this.spb; // rychlost přehrání bufferu
      let off = (beat - c.beat0) * c.spb, when = time;
      if (off < 0) { when = time - off / p; off = 0; }
      if (off >= c.buffer.duration) continue;
      const src = ctx.createBufferSource(); src.buffer = c.buffer; src.playbackRate.value = p;
      const g = ctx.createGain(); g.gain.value = c.gain ?? 1;
      src.connect(g); g.connect(this.engine.bus?.[c.bus] || ctx.destination);
      src.start(Math.max(when, this.engine.now), off);
      this.clipSrc.push(src);
    }
  }
  _stopClips() { for (const s of this.clipSrc) { try { s.stop(); } catch { /* */ } } this.clipSrc = []; }
  segAtTime(t) {
    let s = this.segments[0];
    for (const x of this.segments) if (x.time <= t + 1e-9) s = x;
    return s;
  }
  timeToBeat(t) {
    if (!this.segments.length) return 0;
    const s = this.segAtTime(t);
    if (!Number.isFinite(s.spb)) return s.beat;
    return s.beat + (t - s.time) / s.spb;
  }
  beatToTime(b) {
    const s = this.segments[this.segments.length - 1];
    return s.time + (b - s.beat) * s.spb;
  }
  currentBeat() { return this.timeToBeat(this.engine.now); }

  start(fromBeat = 0, delay = 0.15) {
    this.stop();
    this.segments = [];
    this.playing = true; this.frozen = false;
    this._newSegment(this.engine.now + delay, fromBeat);
    this.startTime = this.engine.now + delay;
    this._tick();
    this.timer = setInterval(() => this._tick(), 25);
    return this.startTime;
  }
  _tick() {
    if (!this.playing || this.frozen) return;
    const now = this.engine.now;
    const seg = this.segments[this.segments.length - 1];
    const horizonBeat = seg.beat + (now + this.lookahead - seg.time) / seg.spb;
    let endBeat = horizonBeat;
    if (this.loop && horizonBeat >= this.loop.to) endBeat = this.loop.to;
    while (this.idx < this.events.length && this.events[this.idx].t < endBeat) {
      const e = this.events[this.idx++];
      if (this.mute[e.inst] || (e.bus && this.mute[e.bus])) continue;
      const when = seg.time + (e.t - seg.beat) * seg.spb;
      if (when < now - 0.12) continue; // výrazně opožděné (zaseknutý telefon) vynech
      const v = this.engine.playEvent(e, when, e.d * seg.spb, e.bus ? this.engine.bus[e.bus] : undefined);
      if (v) { this.active.add(v); setTimeout(() => this.active.delete(v), (when - now + e.d * seg.spb + 1) * 1000); }
    }
    if (this.loop && horizonBeat >= this.loop.to) {
      const t = seg.time + (this.loop.to - seg.beat) * seg.spb;
      this._newSegment(t, this.loop.from);
      if (this.onLoop) setTimeout(() => this.onLoop && this.onLoop(), Math.max(0, (t - now) * 1000));
      return;
    }
    if (!this.loop && horizonBeat > this.length + 0.5 && this.idx >= this.events.length) {
      const endT = seg.time + (this.length - seg.beat) * seg.spb;
      if (!this._endScheduled) {
        this._endScheduled = true;
        setTimeout(() => { this._endScheduled = false; if (this.playing) { this.playing = false; clearInterval(this.timer); this.onEnd && this.onEnd(); } }, Math.max(0, (endT - now) * 1000 + 300));
      }
    }
  }
  /** Zastaví čas na aktuální době (čekej na mě). */
  freeze() {
    if (!this.playing || this.frozen) return;
    this.frozenAt = this.currentBeat();
    this.frozenTime = this.engine.now;
    this.frozen = true;
    this.segments.push({ time: this.frozenTime, beat: this.frozenAt, spb: Infinity });
    this._silence();
  }
  unfreeze() {
    if (!this.frozen) return;
    this.frozen = false;
    this._newSegment(this.engine.now + 0.03, this.frozenAt);
    this.frozenAt = null;
    this._tick();
  }
  pause() { if (!this.playing) return; this.pausedAt = this.currentBeat(); this.playing = false; clearInterval(this.timer); this.segments.push({ time: this.engine.now, beat: this.pausedAt, spb: Infinity }); this._silence(); }
  resume() { if (this.pausedAt == null) return; const b = this.pausedAt; this.pausedAt = null; this.playing = true; this._newSegment(this.engine.now + 0.1, b); this.timer = setInterval(() => this._tick(), 25); }
  _silence() { for (const v of this.active) v.stop && v.stop(); this.active.clear(); this._stopClips(); }
  stop() { this.playing = false; this.frozen = false; clearInterval(this.timer); this.timer = null; this._silence(); this._endScheduled = false; }
}
