// Oddělení zpěvu od doprovodu.
//  - mdxSeparate: model MDX-Net (Kim_Vocal_2, UVR) přes ONNX – přesné, pomalejší. Spuštění modelu dodá volající (ORT web/node).
//  - fastSeparate: bez modelu – maska středu/stran ve spektru (rychlé, orientační).
import { FFTAny, hann, stftStereo, istftStereo } from './dsp.js';

export const MDX_KIM_VOCAL_2 = { nFft: 7680, hop: 1024, dimF: 3072, dimT: 256, compensate: 1.009, sampleRate: 44100, primary: 'vocals' };

/**
 * @param {Float32Array} L levý kanál 44,1 kHz
 * @param {Float32Array} R pravý kanál
 * @param {(input: Float32Array, dims: number[]) => Promise<Float32Array>} run spustí model: vstup [1,4,dimF,dimT] → výstup stejného tvaru
 * @param {{onProgress?: (p:number)=>void, cfg?: object}} o
 * @returns {{vocals:{L,R}, instrumental:{L,R}}}
 */
export async function mdxSeparate(L, R, run, o = {}) {
  const cfg = o.cfg || MDX_KIM_VOCAL_2;
  const { nFft, hop, dimF, dimT } = cfg;
  const n = L.length;
  const trim = nFft >> 1;
  const chunk = hop * (dimT - 1);
  const gen = chunk - 2 * trim;
  const pad = gen - (n % gen);
  const total = trim + n + pad + trim;
  const PL = new Float32Array(total), PR = new Float32Array(total);
  PL.set(L, trim); PR.set(R, trim);
  const VL = new Float32Array(n + pad), VR = new Float32Array(n + pad);
  const fft = new FFTAny(nFft), win = hann(nFft);
  const nChunks = Math.ceil((n + pad) / gen);
  const input = new Float32Array(4 * dimF * dimT);
  for (let c = 0, i = 0; i < n + pad; i += gen, c++) {
    const cl = PL.subarray(i, i + chunk), cr = PR.subarray(i, i + chunk);
    const frames = stftStereo(cl, cr, nFft, hop, dimT, dimF, fft, win);
    for (let f = 0; f < dimF; f++) {
      const b0 = (0 * dimF + f) * dimT, b1 = (1 * dimF + f) * dimT, b2 = (2 * dimF + f) * dimT, b3 = (3 * dimF + f) * dimT;
      for (let t = 0; t < dimT; t++) { const fr = frames[t]; input[b0 + t] = fr.lr[f]; input[b1 + t] = fr.li[f]; input[b2 + t] = fr.rr[f]; input[b3 + t] = fr.ri[f]; }
    }
    const out = await run(input, [1, 4, dimF, dimT]);
    const oframes = [];
    for (let t = 0; t < dimT; t++) {
      const lr = new Float32Array(dimF), li = new Float32Array(dimF), rr = new Float32Array(dimF), ri = new Float32Array(dimF);
      for (let f = 0; f < dimF; f++) { lr[f] = out[(0 * dimF + f) * dimT + t]; li[f] = out[(1 * dimF + f) * dimT + t]; rr[f] = out[(2 * dimF + f) * dimT + t]; ri[f] = out[(3 * dimF + f) * dimT + t]; }
      oframes.push({ lr, li, rr, ri });
    }
    const w = istftStereo(oframes, nFft, hop, fft, win); // délka = chunk
    const seg = Math.min(gen, n + pad - i);
    VL.set(w.L.subarray(trim, trim + seg), i); VR.set(w.R.subarray(trim, trim + seg), i);
    o.onProgress && o.onProgress((c + 1) / nChunks);
    await new Promise((r) => setTimeout(r, 0));
  }
  const vL = VL.subarray(0, n), vR = VR.subarray(0, n);
  const k = cfg.compensate || 1;
  const vocals = { L: new Float32Array(n), R: new Float32Array(n) }, instrumental = { L: new Float32Array(n), R: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    vocals.L[i] = vL[i] * k; vocals.R[i] = vR[i] * k;
    instrumental.L[i] = L[i] - vocals.L[i]; instrumental.R[i] = R[i] - vocals.R[i];
  }
  return { vocals, instrumental };
}

/**
 * Rychlé oddělení bez modelu: zpěv bývá uprostřed stereo obrazu – v každém pásmu ponecháme tu část středu,
 * která převyšuje strany. Pro mono nahrávky (mikrofon) zesílí jen hlasové pásmo.
 */
export function fastSeparate(L, R, sr, { strength = 1.3, onProgress } = {}) {
  const nFft = 2048, hop = 512, half = nFft >> 1;
  const n = L.length;
  const mono = !R || isMono(L, R);
  const M = new Float32Array(n), S = new Float32Array(n);
  for (let i = 0; i < n; i++) { const l = L[i], r = R ? R[i] : l; M[i] = 0.5 * (l + r); S[i] = 0.5 * (l - r); }
  const T = Math.floor(n / hop) + 1;
  const fft = new FFTAny(nFft), win = hann(nFft);
  const re = new Float64Array(nFft), im = new Float64Array(nFft), re2 = new Float64Array(nFft), im2 = new Float64Array(nFft);
  const outV = new Float64Array(n), env = new Float64Array(n);
  const binHz = sr / nFft;
  const at = (x, i) => { if (i < 0) i = -i; if (i >= n) i = 2 * n - 2 - i; return x[Math.max(0, Math.min(n - 1, i))]; };
  for (let t = 0; t < T; t++) {
    const s0 = t * hop - half;
    for (let k = 0; k < nFft; k++) { const w = win[k]; re[k] = at(M, s0 + k) * w; im[k] = at(S, s0 + k) * w; }
    fft.transform(re, im, false);
    re2.fill(0); im2.fill(0);
    for (let k = 0; k <= half; k++) {
      const j = k === 0 ? 0 : nFft - k;
      const xr = re[k], xi = im[k], yr = re[j], yi = -im[j];
      const mr = 0.5 * (xr + yr), mi = 0.5 * (xi + yi), sr2 = 0.5 * (xi - yi), si = -0.5 * (xr - yr);
      const hz = k * binHz;
      const mm = Math.hypot(mr, mi), ss = Math.hypot(sr2, si);
      let g;
      if (mono) g = hz < 90 ? 0 : hz < 150 ? 0.4 : hz < 4000 ? 1 : 0.6;
      else { g = mm > 1e-9 ? Math.max(0, (mm - strength * ss) / mm) : 0; g *= g; if (hz < 110) g *= 0.15; else if (hz > 6000) g *= 0.5; }
      re2[k] = mr * g; im2[k] = mi * g;
      if (k > 0 && k < half) { re2[nFft - k] = mr * g; im2[nFft - k] = -mi * g; }
    }
    fft.transform(re2, im2, true);
    for (let k = 0; k < nFft; k++) { const idx = s0 + k; if (idx < 0 || idx >= n) continue; outV[idx] += re2[k] * win[k]; env[idx] += win[k] * win[k]; }
    if (onProgress && t % 200 === 0) onProgress(t / T);
  }
  const vocals = new Float32Array(n);
  for (let i = 0; i < n; i++) vocals[i] = env[i] > 1e-8 ? outV[i] / env[i] : 0;
  const instrumental = { L: new Float32Array(n), R: new Float32Array(n) };
  for (let i = 0; i < n; i++) { instrumental.L[i] = L[i] - vocals[i]; instrumental.R[i] = (R ? R[i] : L[i]) - vocals[i]; }
  onProgress && onProgress(1);
  return { vocals: { L: vocals, R: vocals }, instrumental };
}

function isMono(L, R) {
  let d = 0, s = 0;
  for (let i = 0; i < L.length; i += 97) { d += Math.abs(L[i] - R[i]); s += Math.abs(L[i]) + Math.abs(R[i]); }
  return d < s * 0.01;
}
