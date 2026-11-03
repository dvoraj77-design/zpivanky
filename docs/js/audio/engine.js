// Zvukový engine: AudioContext, mikrofon → worklet → worker (detekce), nástroje, sběrnice, nahrávání, diagnostika.
import { Sampler, GuideVoice, Percussion, Drone } from './instruments.js';

const BASE = new URL('../../', import.meta.url).href;

export const MIC_ERRORS = {
  NotAllowedError: 'Mikrofon je zakázaný. V Chromu klepni na ikonu zámku vedle adresy → Oprávnění → Mikrofon → Povolit. U nainstalované aplikace: Nastavení Androidu → Aplikace → Zpívánky (nebo Chrome) → Oprávnění → Mikrofon.',
  SecurityError: 'Prohlížeč nepovolil mikrofon. Aplikace musí běžet přes zabezpečenou adresu https://.',
  NotFoundError: 'Nenašel jsem žádný mikrofon. Připoj sluchátka s mikrofonem nebo zkontroluj, že telefon mikrofon nepoužívá jiná aplikace.',
  NotReadableError: 'Mikrofon právě používá jiná aplikace (hovor, diktafon…). Zavři ji a zkus to znovu.',
  OverconstrainedError: 'Vybraný mikrofon už není dostupný. Vyber jiný v Já → Zvuk a sluchátka.',
  AbortError: 'Spuštění mikrofonu bylo přerušeno. Zkus to znovu.',
  NoSupport: 'Tento prohlížeč neumí pracovat s mikrofonem. Použij aktuální Chrome.',
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.listeners = new Set();
    this.history = []; // poslední snímky (cca 15 s)
    this.mic = { status: 'off', error: null, label: '', deviceId: null, settings: null };
    this.worker = null;
    this.node = null;
    this.stream = null;
    this.source = null;
    this.testSource = null;
    this.testBuffer = null;
    this.latencyMs = 0; // kalibrované zpoždění (vstup + výstup)
    this.inst = {};
    this.instLoading = null;
    this.stats = { frames: 0, lastFrameAt: 0, peak: 0, fps: 0 };
    this.lastPeak = 0;
    this._fpsCount = 0; this._fpsT = 0;
    this.recWaiters = new Map();
  }

  get running() { return this.ctx && this.ctx.state === 'running'; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  /** Plynulý čas pro animace: currentTime se na Androidu posouvá po skocích (po blocích zvuku), dopočítáme ho podle hodin prohlížeče. */
  smoothNow() {
    const c = this.ctx; if (!c) return 0;
    const t = c.currentTime, p = performance.now();
    if (t !== this._lt) { this._lt = t; this._lp = p; }
    let est = this._lt + (p - this._lp) / 1000;
    est = Math.min(est, t + 0.08);
    if (this._sm == null || est > this._sm || this._sm - est > 0.25) this._sm = est;
    return this._sm;
  }

  async ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error(MIC_ERRORS.NoSupport);
      this.ctx = new AC({ latencyHint: 'interactive' });
      const ctx = this.ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.bus = {};
      for (const k of ['accomp', 'guide', 'metro', 'monitor', 'preview', 'playback']) {
        const g = ctx.createGain(); g.gain.value = 1; g.connect(this.master); this.bus[k] = g;
      }
      this.bus.monitor.gain.value = 0;
      this.guide = new GuideVoice(ctx);
      this.perc = new Percussion(ctx);
      this.drone = new Drone(ctx, this.bus.preview);
      this.inst.piano = new Sampler(ctx, 'piano', BASE);
      this.inst.guitar = new Sampler(ctx, 'guitar', BASE);
      this.inst.bass = new Sampler(ctx, 'bass', BASE);
      await ctx.audioWorklet.addModule(BASE + 'js/audio/capture-worklet.js');
      this.node = new AudioWorkletNode(ctx, 'zp-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
      const sink = ctx.createGain(); sink.gain.value = 0; this.node.connect(sink); sink.connect(ctx.destination);
      this.worker = new Worker(BASE + 'js/audio/analyzer-worker.js', { type: 'module' });
      const ch = new MessageChannel();
      this.node.port.postMessage({ type: 'port', port: ch.port1 }, [ch.port1]);
      await new Promise((resolve) => {
        this.worker.onmessage = (e) => this._onWorker(e.data, resolve);
        this.worker.postMessage({ type: 'init', sampleRate: ctx.sampleRate, port: ch.port2 }, [ch.port2]);
      });
    }
    if (this.ctx.state !== 'running') {
      try { await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 400))]); } catch { /* bez gesta */ }
    }
    return this.ctx;
  }

  _onWorker(d, resolve) {
    if (d.type === 'ready') { this.analyzerInfo = d; resolve && resolve(); return; }
    if (d.type === 'frames') {
      this.lastPeak = d.peak;
      if (d.peak > this.stats.peak) this.stats.peak = d.peak;
      for (const f of d.frames) {
        this.history.push(f);
        this.stats.frames++;
      }
      const cut = this.now - 16;
      while (this.history.length && this.history[0].t < cut) this.history.shift();
      this.stats.lastFrameAt = performance.now();
      this._fpsCount += d.frames.length;
      const pn = performance.now();
      if (pn - this._fpsT > 1000) { this.stats.fps = Math.round((this._fpsCount * 1000) / (pn - this._fpsT)); this._fpsCount = 0; this._fpsT = pn; }
      for (const l of this.listeners) { try { l(d.frames, d.peak); } catch (e) { console.error(e); } }
    } else if (d.type === 'rec') {
      const w = this.recWaiters.get(d.id);
      if (w) { this.recWaiters.delete(d.id); w(d); }
    }
  }

  onFrames(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Spustí mikrofon. deviceId: null = výchozí. */
  async startMic(deviceId = null) {
    await this.ensureContext();
    if (!navigator.mediaDevices?.getUserMedia) { this.mic = { ...this.mic, status: 'error', error: MIC_ERRORS.NoSupport }; throw new Error(MIC_ERRORS.NoSupport); }
    this.stopMic();
    this.mic = { ...this.mic, status: 'starting', error: null };
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
    if (deviceId) audio.deviceId = { exact: deviceId };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (e) {
      if (deviceId && e.name === 'OverconstrainedError') return this.startMic(null);
      const msg = MIC_ERRORS[e.name] || ('Mikrofon se nepodařilo spustit: ' + (e.message || e.name));
      this.mic = { ...this.mic, status: e.name === 'NotAllowedError' ? 'denied' : 'error', error: msg };
      throw Object.assign(new Error(msg), { code: e.name });
    }
    const track = this.stream.getAudioTracks()[0];
    this.source = this.ctx.createMediaStreamSource(this.stream);
    if (!this.testSource) this.source.connect(this.node);
    this.monitorSrc = this.source;
    this.source.connect(this.bus.monitor);
    const settings = track.getSettings ? track.getSettings() : {};
    this.mic = { status: 'on', error: null, label: track.label || 'Mikrofon', deviceId: settings.deviceId || deviceId, settings };
    track.onended = () => { this.mic = { ...this.mic, status: 'off', error: 'Mikrofon byl odpojen.' }; };
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
    return this.mic;
  }

  stopMic() {
    if (this.source) { try { this.source.disconnect(); } catch { /* */ } this.source = null; }
    if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); this.stream = null; }
    if (this.mic.status === 'on') this.mic = { ...this.mic, status: 'off' };
  }

  async listInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter((d) => d.kind === 'audioinput').map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Mikrofon ${i + 1}`, groupId: d.groupId }));
  }
  async listOutputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter((d) => d.kind === 'audiooutput').map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Výstup ${i + 1}` }));
  }
  /** Odhad, zda jsou připojená sluchátka (podle názvů zařízení). */
  async headphonesGuess() {
    const ins = await this.listInputs();
    const outs = await this.listOutputs();
    const all = [...ins, ...outs].map((d) => d.label.toLowerCase());
    const bt = all.some((l) => /bluetooth|buds|ear \(|airpods|nothing|bt /.test(l));
    const wired = all.some((l) => /wired|headset|sluch|usb|jack|headphone/.test(l));
    return { bt, wired, any: bt || wired, labels: [...ins, ...outs].map((d) => d.label) };
  }

  setMonitor(on, level = 0.8) { if (this.bus) this.bus.monitor.gain.setTargetAtTime(on ? level : 0, this.now, 0.05); }

  // ---------- Testovací vstup (simulovaný zpěvák) ----------
  async loadTestInput(url) {
    await this.ensureContext();
    const ab = await (await fetch(url)).arrayBuffer();
    this.testBuffer = await this.ctx.decodeAudioData(ab);
    return this.testBuffer.duration;
  }
  setTestBuffer(buf) { this.testBuffer = buf; }
  /** Pustí testovací nahrávku do detektoru místo mikrofonu (v čase when). */
  startTestInput(when = this.now, loop = false) {
    if (!this.testBuffer) return;
    this.stopTestInput();
    if (this.source) try { this.source.disconnect(this.node); } catch { /* */ }
    const s = this.ctx.createBufferSource();
    s.buffer = this.testBuffer; s.loop = loop;
    s.connect(this.node);
    s.start(Math.max(when, this.now));
    this.testSource = s;
    s.onended = () => { if (this.testSource === s) this.stopTestInput(); };
  }
  stopTestInput() {
    if (this.testSource) { try { this.testSource.stop(); this.testSource.disconnect(); } catch { /* */ } this.testSource = null; }
    if (this.source) try { this.source.connect(this.node); } catch { /* */ }
  }

  // ---------- Nástroje ----------
  loadInstruments() {
    if (!this.instLoading) this.instLoading = Promise.all(Object.values(this.inst).map((s) => s.load())).catch((e) => { this.instLoading = null; throw e; });
    return this.instLoading;
  }
  get instrumentsReady() { return Object.values(this.inst).every((s) => s.loaded); }

  /** Zahraje událost {midi, inst, vel, toMidi} v čase when po dobu dur (s). */
  playEvent(e, when, dur, bus) {
    const dest = bus || (e.inst === 'guide' ? this.bus.guide : e.inst === 'click' ? this.bus.metro : this.bus.accomp);
    switch (e.inst) {
      case 'guide': return this.guide.play(e.midi, when, dur, e.vel ?? 0.7, dest, e.toMidi ?? null);
      case 'click': this.perc.click(when, e.midi >= 84, dest, e.vel ?? 0.8); return null;
      case 'drum': this.perc.drum(e.midi, when, dest, e.vel ?? 0.5); return null;
      case 'guidePiano': return this.inst.piano.play(e.midi, when, dur, e.vel ?? 0.7, dest);
      default: return this.inst[e.inst]?.play(e.midi, when, dur, e.vel ?? 0.6, dest);
    }
  }
  /** Rychlé přehrání noty (klepnutí na notu). */
  async previewNote(midi, dur = 1.2, inst = 'piano') {
    await this.ensureContext();
    if (inst !== 'guide') await this.loadInstruments().catch(() => {});
    return this.playEvent({ midi, inst: inst === 'piano' && !this.inst.piano.loaded ? 'guide' : inst, vel: 0.8 }, this.now + 0.02, dur, this.bus.preview);
  }
  async previewSequence(notes, spb = 0.6, inst = 'piano') {
    await this.ensureContext();
    await this.loadInstruments().catch(() => {});
    const t0 = this.now + 0.05;
    for (const n of notes) this.playEvent({ midi: n.midi, inst, vel: 0.8, toMidi: n.toMidi }, t0 + n.t * spb, n.d * spb, this.bus.preview);
    return t0;
  }

  // ---------- Nahrávání ----------
  startRecording() { this.worker?.postMessage({ type: 'recStart' }); }
  stopRecording() {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      this.recWaiters.set(id, resolve);
      this.worker.postMessage({ type: 'recStop', id });
      setTimeout(() => { if (this.recWaiters.has(id)) { this.recWaiters.delete(id); resolve({ pcm: new Int16Array(0), rate: 24000, start: 0 }); } }, 3000);
    });
  }
  resetTracker() { this.worker?.postMessage({ type: 'reset' }); }

  /** Přehraje PCM nahrávku (Int16) v čase when. */
  playPcm(pcm, rate, when, bus, offset = 0) {
    const buf = this.ctx.createBuffer(1, pcm.length, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) d[i] = pcm[i] / 32768;
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.connect(bus || this.bus.playback);
    s.start(Math.max(when, this.now), Math.max(0, offset));
    return s;
  }

  diagnostics() {
    const c = this.ctx;
    return {
      sampleRate: c?.sampleRate, state: c?.state, baseLatency: c?.baseLatency, outputLatency: c?.outputLatency,
      mic: this.mic, analyzer: this.analyzerInfo, fps: this.stats.fps, frames: this.stats.frames, peak: this.lastPeak,
      latencyMs: this.latencyMs, testInput: !!this.testSource,
    };
  }
  estimatedOutputMs() { const c = this.ctx; if (!c) return 0; return Math.round(((c.baseLatency || 0) + (c.outputLatency || 0)) * 1000); }
}

export const engine = new AudioEngine();
