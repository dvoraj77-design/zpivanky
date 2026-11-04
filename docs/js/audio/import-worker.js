// Worker importu písně: oddělení zpěvu (rychlé / MDX-Net přes ONNX Runtime), rozbor rytmu a harmonie, výška zpěvu,
// a vykreslení originální stopy pro přehrávač (zarovnání na stálé tempo, tempo, posun výšky).
import { fastSeparate, mdxSeparate, MDX_KIM_VOCAL_2 } from '../core/separate.js';
import { decimate2, toInt16, fromInt16, stemPlan, renderPlannedStem } from '../core/dsp.js';
import { analyzeRhythmAndHarmony, melodyFrames } from '../core/analysis.js';
import { StreamAnalyzer } from '../core/pitch.js';

const BASE = new URL('../../', import.meta.url).href;
export const MODEL_CACHE = 'zp-models-v1';
let cancelled = false;
let ortSession = null, ortBackend = null, ort = null;

class Cancelled extends Error { constructor() { super('Zrušeno'); this.cancelled = true; } }
const check = () => { if (cancelled) throw new Cancelled(); };
const tick = () => new Promise((r) => setTimeout(r, 0));

async function cachedBytes(path) {
  const url = BASE + path;
  try { const c = await caches.open(MODEL_CACHE); const hit = await c.match(url); if (hit) return await hit.arrayBuffer(); } catch { /* bez Cache Storage */ }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Soubor ${path} se nepodařilo načíst (${res.status}).`);
  return await res.arrayBuffer();
}

/** Skutečný grafický čip (ne softwarová náhrada, ta by byla pomalejší než procesor). */
async function realGpu() {
  try {
    const gpu = self.navigator?.gpu; if (!gpu) return false;
    const a = await gpu.requestAdapter(); if (!a) return false;
    const info = a.info || (a.requestAdapterInfo ? await a.requestAdapterInfo() : {});
    if (a.isFallbackAdapter || /swiftshader|llvmpipe|software/i.test(`${info.architecture} ${info.description} ${info.device}`)) return false;
    return true;
  } catch { return false; }
}

async function getSession(prefer, post) {
  if (ortSession && (prefer === 'auto' || prefer === ortBackend)) return ortSession;
  post({ stage: 'model', p: 0 });
  if (!ort) {
    ort = await import(BASE + 'vendor/ort/ort.all.bundle.min.mjs');
    ort.env.wasm.wasmPaths = BASE + 'vendor/ort/';
    ort.env.wasm.wasmBinary = await cachedBytes('vendor/ort/ort-wasm-simd-threaded.jsep.wasm');
    if (self.crossOriginIsolated) ort.env.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  }
  const model = new Uint8Array(await cachedBytes('models/kim-vocal-2.onnx'));
  const tries = prefer !== 'wasm' && (await realGpu()) ? ['webgpu', 'wasm'] : ['wasm'];
  let lastErr;
  for (const ep of tries) {
    try {
      ortSession = await ort.InferenceSession.create(model, { executionProviders: [ep], graphOptimizationLevel: 'all' });
      ortBackend = ep;
      return ortSession;
    } catch (e) { lastErr = e; }
  }
  throw new Error('Model se nepodařilo spustit: ' + (lastErr?.message || lastErr));
}

function finiteAndSane(out, inp) {
  let so = 0, si = 0;
  for (let i = 0; i < out.length; i += 61) { const v = out[i]; if (!Number.isFinite(v)) return false; so += v * v; si += inp[i] * inp[i]; }
  return so <= si * 16 + 1e-6;
}

async function separatePrecise(L, R, prefer, post) {
  let sess = await getSession(prefer, post);
  const t0 = performance.now();
  let first = true;
  const run = async (input, dims) => {
    check();
    let out = (await sess.run({ input: new ort.Tensor('float32', input, dims) })).output.data;
    if (first) {
      first = false;
      if (ortBackend !== 'wasm' && !finiteAndSane(out, input)) { // grafický čip dal nesmysl → procesor
        ortSession = null; sess = await getSession('wasm', post);
        out = (await sess.run({ input: new ort.Tensor('float32', input, dims) })).output.data;
      }
    }
    return out;
  };
  return mdxSeparate(L, R, run, {
    onProgress: (p) => { const el = (performance.now() - t0) / 1000; post({ stage: 'separate', p, eta: p > 0 ? (el / p) * (1 - p) : null, backend: ortBackend }); },
  });
}

function pitchFrames(x, sr, post) {
  const a = new StreamAnalyzer(sr); const out = [];
  const step = 256;
  for (let i = 0; i < x.length; i += step) {
    const c = x.subarray(i, i + step);
    a.process(c, (i + c.length) / sr, (r) => out.push({ t: Math.round(r.t * 1000) / 1000, midi: r.midi == null ? null : Math.round(r.midi * 100) / 100, voiced: r.voiced, db: Math.round(r.db * 10) / 10 }));
    if (i % (step * 2000) === 0) post({ stage: 'melody', p: i / x.length });
  }
  return out;
}

async function analyze(d, post) {
  const { L, R, sr, mode, prefer = 'auto' } = d;
  const t0 = performance.now();
  let sep;
  if (mode === 'precise') sep = await separatePrecise(L, R, prefer, post);
  else { sep = fastSeparate(L, R, sr, { onProgress: (p) => post({ stage: 'separate', p }) }); }
  check(); await tick();
  const tSep = performance.now();
  post({ stage: 'rhythm', p: 0 });
  const half = (a, b) => { const m = new Float32Array(a.length); for (let i = 0; i < a.length; i++) m[i] = 0.5 * (a[i] + b[i]); return m; };
  const mixMono = decimate2(half(L, R));
  const instMono = decimate2(half(sep.instrumental.L, sep.instrumental.R));
  const vocMono = decimate2(half(sep.vocals.L, sep.vocals.R));
  const sr2 = sr / 2;
  const an = analyzeRhythmAndHarmony(mixMono, instMono, sr2);
  check(); await tick();
  post({ stage: 'melody', p: 0 });
  // čistý zpěv (model) → detektor výšky (přesná oktáva); zbytky doprovodu (rychlé oddělení) → salience melodie
  const vocalFrames = mode === 'precise' ? pitchFrames(vocMono, sr2, post) : melodyFrames(vocMono, sr2, { onProgress: (p) => post({ stage: 'melody', p }) })
    .map((f) => ({ t: Math.round(f.t * 1000) / 1000, midi: f.midi == null ? null : Math.round(f.midi * 100) / 100, voiced: f.voiced, db: Math.round(f.db * 10) / 10 }));
  check();
  const instL = toInt16(sep.instrumental.L), instR = toInt16(sep.instrumental.R), voc = toInt16(vocMono);
  return {
    result: {
      bpm: an.bpm, beats: an.beats, meter: an.meter, downbeat: an.downbeat, chordsPerBeat: an.chordsPerBeat, vocalFrames,
      stems: { sr, inst: [instL, instR], vocSr: sr2, voc }, backend: mode === 'precise' ? ortBackend : 'fast',
      timing: { separate: (tSep - t0) / 1000, total: (performance.now() - t0) / 1000 },
    },
    transfer: [instL.buffer, instR.buffer, voc.buffer],
  };
}

function render(d) {
  const { chans, sr, plan: p } = d;
  const plan = stemPlan(p.beatTimes, p.zero, p.duration, { spb: p.spb, semis: p.semis, fromBeat: p.fromBeat, toBeat: p.toBeat });
  const f = chans.map((c) => (c instanceof Int16Array ? fromInt16(c) : c));
  const out = renderPlannedStem(f, sr, plan);
  return { result: { chans: out, sr, fromBeat: plan.fromBeat, rate: plan.rate, outSpb: plan.outSpb }, transfer: out.map((x) => x.buffer) };
}

self.onmessage = async (e) => {
  const d = e.data;
  if (d.type === 'cancel') { cancelled = true; return; }
  const post = (m) => self.postMessage({ type: 'progress', id: d.id, ...m });
  try {
    cancelled = false;
    let r;
    if (d.type === 'analyze') r = await analyze(d, post);
    else if (d.type === 'render') r = render(d);
    else if (d.type === 'ping') r = { result: { coi: self.crossOriginIsolated, gpu: await realGpu(), threads: navigator.hardwareConcurrency } };
    else throw new Error('Neznámý požadavek ' + d.type);
    self.postMessage({ type: 'done', id: d.id, result: r.result }, r.transfer || []);
  } catch (err) {
    self.postMessage({ type: 'error', id: d.id, cancelled: !!err?.cancelled, message: String(err?.message || err) });
  }
};
export { MDX_KIM_VOCAL_2 };
