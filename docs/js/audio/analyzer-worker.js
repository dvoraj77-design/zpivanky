// Analyzační worker: detekce výšky (core/pitch.js), tracker, nahrávání.
import { StreamAnalyzer } from '../core/pitch.js';

let analyzer = null, port = null, sr = 48000;
let rec = null; // {chunks:[], rate, factor, start}
let batch = [];
let peak = 0;
let lastPost = 0;

function handleChunk(samples, t) {
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
  analyzer.process(samples, t, (r, raw) => {
    batch.push({ t: r.t, midi: r.midi, voiced: r.voiced, db: r.db, floorDb: r.floorDb, onset: r.onset, hiss: r.hiss, zcr: raw.zcr, clarity: raw.clarity, freq: raw.freq, rawMidi: r.rawMidi });
  });
  if (rec) {
    if (rec.start == null) rec.start = t - samples.length / sr;
    const f = rec.factor;
    const out = new Int16Array(Math.floor((samples.length + rec.phase) / f));
    let o = 0, acc = 0, cnt = 0;
    for (let i = 0; i < samples.length; i++) {
      acc += samples[i]; cnt++;
      if (cnt === f) { const v = Math.max(-1, Math.min(1, acc / f)); out[o++] = v * 32767; acc = 0; cnt = 0; }
    }
    rec.chunks.push(out.subarray(0, o));
    rec.phase = 0;
  }
  const now = t;
  if (batch.length && now - lastPost > 0.015) {
    self.postMessage({ type: 'frames', frames: batch, peak });
    batch = []; peak = 0; lastPost = now;
  }
}

self.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'init') {
    sr = d.sampleRate;
    analyzer = new StreamAnalyzer(sr);
    port = d.port;
    port.onmessage = (m) => { if (m.data.type === 'chunk' && analyzer) handleChunk(m.data.samples, m.data.t); };
    self.postMessage({ type: 'ready', frameSize: analyzer.n, hop: analyzer.hop, rate: analyzer.sr });
  } else if (d.type === 'recStart') {
    const factor = sr >= 44100 ? 2 : 1;
    rec = { chunks: [], factor, rate: sr / factor, start: null, phase: 0 };
  } else if (d.type === 'recStop') {
    if (!rec) { self.postMessage({ type: 'rec', pcm: new Int16Array(0), rate: sr, start: 0, id: d.id }); return; }
    const len = rec.chunks.reduce((a, c) => a + c.length, 0);
    const pcm = new Int16Array(len);
    let o = 0;
    for (const c of rec.chunks) { pcm.set(c, o); o += c.length; }
    self.postMessage({ type: 'rec', pcm, rate: rec.rate, start: rec.start ?? 0, id: d.id }, [pcm.buffer]);
    rec = null;
  } else if (d.type === 'reset') {
    if (analyzer) analyzer.tracker.reset();
  }
};
