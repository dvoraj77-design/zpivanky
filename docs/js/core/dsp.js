// Zpracování signálu pro import písní: FFT libovolné délky (Bluestein), STFT/ISTFT, převzorkování, WSOLA (tempo), posun výšky.
// Čisté funkce bez prohlížeče – běží ve workeru i v Node testech.
import { FFT } from './pitch.js';

/** Komplexní FFT libovolné délky n (pro mocninu dvou přímo radix-2, jinak Bluestein). */
export class FFTAny {
  constructor(n) {
    this.n = n;
    this.pow2 = (n & (n - 1)) === 0;
    if (this.pow2) { this.fft = new FFT(n); return; }
    let m = 1; while (m < 2 * n - 1) m <<= 1;
    this.m = m; this.fft = new FFT(m);
    // chirp w_k = exp(-iπk²/n)
    this.wr = new Float64Array(n); this.wi = new Float64Array(n);
    for (let k = 0; k < n; k++) { const a = (Math.PI * ((k * k) % (2 * n))) / n; this.wr[k] = Math.cos(a); this.wi[k] = -Math.sin(a); }
    // FFT konjugovaného chirpu (b)
    this.br = new Float64Array(m); this.bi = new Float64Array(m);
    this.br[0] = this.wr[0]; this.bi[0] = -this.wi[0];
    for (let k = 1; k < n; k++) { this.br[k] = this.br[m - k] = this.wr[k]; this.bi[k] = this.bi[m - k] = -this.wi[k]; }
    this.fft.transform(this.br, this.bi, false);
    this.ar = new Float64Array(m); this.ai = new Float64Array(m);
  }
  /** in-place; inverse = bez normalizace dělením n? → s normalizací (jako numpy.ifft) */
  transform(re, im, inverse = false) {
    const n = this.n;
    if (this.pow2) { this.fft.transform(re, im, inverse); return; }
    if (inverse) { for (let k = 0; k < n; k++) im[k] = -im[k]; }
    const m = this.m, ar = this.ar, ai = this.ai, wr = this.wr, wi = this.wi;
    ar.fill(0); ai.fill(0);
    for (let k = 0; k < n; k++) { ar[k] = re[k] * wr[k] - im[k] * wi[k]; ai[k] = re[k] * wi[k] + im[k] * wr[k]; }
    this.fft.transform(ar, ai, false);
    for (let k = 0; k < m; k++) { const xr = ar[k] * this.br[k] - ai[k] * this.bi[k]; const xi = ar[k] * this.bi[k] + ai[k] * this.br[k]; ar[k] = xr; ai[k] = xi; }
    this.fft.transform(ar, ai, true);
    for (let k = 0; k < n; k++) { const xr = ar[k] * wr[k] - ai[k] * wi[k]; const xi = ar[k] * wi[k] + ai[k] * wr[k]; re[k] = xr; im[k] = xi; }
    if (inverse) { for (let k = 0; k < n; k++) { re[k] /= n; im[k] = -im[k] / n; } }
  }
}

export function hann(n, periodic = true) {
  const w = new Float64Array(n); const d = periodic ? n : n - 1;
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / d);
  return w;
}

/**
 * STFT dvou reálných kanálů najednou (L+iR v jedné komplexní FFT), jako torch.stft(center=True, pad_mode='reflect').
 * Vrací pole snímků: {lr, li, rr, ri} (Float32Array o délce bins) – jen prvních `bins` frekvencí.
 */
export function stftStereo(L, R, nFft, hop, nFrames, bins, fft = new FFTAny(nFft), win = hann(nFft)) {
  const half = nFft >> 1, len = L.length;
  const re = new Float64Array(nFft), im = new Float64Array(nFft);
  const frames = [];
  const at = (x, i) => { // reflect padding
    if (i < 0) i = -i; if (i >= len) i = 2 * len - 2 - i; if (i < 0) i = 0; if (i >= len) i = len - 1;
    return x[i];
  };
  for (let t = 0; t < nFrames; t++) {
    const s = t * hop - half;
    for (let k = 0; k < nFft; k++) { const idx = s + k; const w = win[k]; re[k] = at(L, idx) * w; im[k] = at(R, idx) * w; }
    fft.transform(re, im, false);
    const lr = new Float32Array(bins), li = new Float32Array(bins), rr = new Float32Array(bins), ri = new Float32Array(bins);
    for (let k = 0; k < bins; k++) {
      const j = k === 0 ? 0 : nFft - k;
      // rozdělení: X = FFT(L + iR) → L_k = (X_k + conj(X_{N-k}))/2, R_k = (X_k - conj(X_{N-k}))/(2i)
      const xr = re[k], xi = im[k], yr = re[j], yi = -im[j];
      lr[k] = 0.5 * (xr + yr); li[k] = 0.5 * (xi + yi);
      rr[k] = 0.5 * (xi - yi); ri[k] = -0.5 * (xr - yr);
    }
    frames.push({ lr, li, rr, ri });
  }
  return frames;
}

/** ISTFT dvou kanálů (jako torch.istft(center=True)), délka výstupu hop*(nFrames-1). Chybějící vysoké frekvence = 0. */
export function istftStereo(frames, nFft, hop, fft = new FFTAny(nFft), win = hann(nFft)) {
  const half = nFft >> 1, T = frames.length, outLen = hop * (T - 1);
  const L = new Float32Array(outLen), R = new Float32Array(outLen), env = new Float64Array(outLen);
  const re = new Float64Array(nFft), im = new Float64Array(nFft);
  const nb = (nFft >> 1) + 1;
  for (let t = 0; t < T; t++) {
    const f = frames[t]; const bins = f.lr.length;
    re.fill(0); im.fill(0);
    // Z = L + iR v časové oblasti → spektrum Z_k = L_k + i R_k ; pro k > N/2 Hermitovsky
    for (let k = 0; k < Math.min(bins, nb); k++) {
      const Lr = f.lr[k], Li = f.li[k], Rr = f.rr[k], Ri = f.ri[k];
      re[k] = Lr - Ri; im[k] = Li + Rr; // Z_k = L_k + i R_k
      if (k > 0 && k < nFft - k) { re[nFft - k] = Lr + Ri; im[nFft - k] = -Li + Rr; } // Z_{N-k} = conj(L_k) + i conj(R_k)
    }
    fft.transform(re, im, true);
    const s = t * hop - half;
    for (let k = 0; k < nFft; k++) {
      const idx = s + k; if (idx < 0 || idx >= outLen) continue;
      const w = win[k];
      L[idx] += re[k] * w; R[idx] += im[k] * w; env[idx] += w * w;
    }
  }
  for (let i = 0; i < outLen; i++) if (env[i] > 1e-8) { L[i] /= env[i]; R[i] /= env[i]; }
  return { L, R };
}

/** Převzorkování (lineární interpolace s jednoduchým dolním propustem při podvzorkování). */
export function resample(x, fromRate, toRate) {
  if (fromRate === toRate) return x;
  const ratio = fromRate / toRate;
  let src = x;
  if (ratio > 1.01) { // dolní propust (klouzavý průměr) proti aliasu
    const k = Math.max(1, Math.round(ratio));
    src = new Float32Array(x.length);
    let acc = 0;
    for (let i = 0; i < x.length; i++) { acc += x[i]; if (i >= k) acc -= x[i - k]; src[i] = acc / Math.min(k, i + 1); }
  }
  const n = Math.floor(x.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * ratio, j = Math.floor(p), f = p - j;
    out[i] = (src[j] ?? 0) * (1 - f) + (src[j + 1] ?? src[j] ?? 0) * f;
  }
  return out;
}

/**
 * WSOLA: změna tempa beze změny výšky. factor > 1 = rychleji (kratší), < 1 = pomaleji.
 */
export function timeStretch(x, sr, factor) {
  if (Math.abs(factor - 1) < 1e-3) return x;
  const N = Math.round(sr * 0.046) & ~1; // ~46 ms okno
  const Hs = N >> 1; // výstupní krok
  const Ha = Hs * factor; // vstupní krok
  const tol = Math.round(sr * 0.012);
  const outLen = Math.floor(x.length / factor) + N;
  const out = new Float32Array(outLen), norm = new Float32Array(outLen);
  const win = hann(N, false);
  let prevStart = 0, outPos = 0, inPos = 0;
  while (inPos + N + tol < x.length && outPos + N < outLen) {
    // najdi posun s nejlepší podobností s přirozeným pokračováním předchozího úseku
    let best = 0;
    if (outPos > 0) {
      const ref = prevStart + Hs;
      let bestC = -Infinity;
      for (let d = -tol; d <= tol; d += 2) {
        const s = Math.round(inPos) + d;
        if (s < 0 || s + N >= x.length) continue;
        let c = 0;
        for (let k = 0; k < N; k += 4) c += x[s + k] * x[ref + k];
        if (c > bestC) { bestC = c; best = d; }
      }
    }
    const start = Math.max(0, Math.round(inPos) + best);
    for (let k = 0; k < N; k++) { out[outPos + k] += x[start + k] * win[k]; norm[outPos + k] += win[k]; }
    prevStart = start; outPos += Hs; inPos += Ha;
  }
  const n = Math.min(outLen, outPos + Hs);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  return y;
}

/** Posun výšky o `semis` půltónů beze změny délky (WSOLA + převzorkování). */
export function pitchShift(x, sr, semis) {
  if (!semis) return x;
  const r = Math.pow(2, semis / 12);
  const stretched = timeStretch(x, sr, 1 / r); // delší o r
  return resample(stretched, sr * r, sr);
}

/** Změna tempa i výšky najednou (pro originální podklad). */
export function renderStem(x, sr, { factor = 1, semis = 0 } = {}) {
  const r = Math.pow(2, semis / 12);
  // nejdřív natáhnout v čase o r/factor, pak převzorkovat o r → výška ×r, délka ×1/factor
  const st = timeStretch(x, sr, factor / r);
  return Math.abs(r - 1) < 1e-4 ? st : resample(st, sr * r, sr);
}

export function mixToMono(L, R) { const n = Math.min(L.length, R ? R.length : L.length); const m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = R ? 0.5 * (L[i] + R[i]) : L[i]; return m; }

/** Podvzorkování na polovinu (FIR dolní propust, Blackmanovo okno, 47 koeficientů). */
export function decimate2(x) {
  const taps = 47, h = new Float32Array(taps), c = (taps - 1) / 2;
  let s = 0;
  for (let i = 0; i < taps; i++) {
    const k = i - c, sinc = k === 0 ? 0.5 : Math.sin(Math.PI * 0.5 * k) / (Math.PI * k);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1));
    h[i] = sinc * w; s += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= s;
  const n = x.length >> 1, y = new Float32Array(n);
  for (let o = 0; o < n; o++) {
    const j0 = 2 * o - c; let acc = 0;
    for (let i = 0; i < taps; i++) { const j = j0 + i; if (j >= 0 && j < x.length) acc += x[j] * h[i]; }
    y[o] = acc;
  }
  return y;
}

/**
 * WSOLA s proměnným mapováním času (zarovnání nahrávky na stálé tempo, změna tempa i délky).
 * chans: kanály (Float32Array), map(i) → pozice ve vstupu (vzorky) pro výstupní vzorek i, outLen: délka výstupu.
 */
export function wsolaWarp(chans, sr, map, outLen, { winSec = 0.046, tolSec = 0.012 } = {}) {
  const N = Math.round(sr * winSec) & ~1, Hs = N >> 1, T = Math.round(sr * tolSec);
  const x0 = chans[0], n = x0.length;
  let ref = x0;
  if (chans.length > 1) { ref = new Float32Array(n); for (let i = 0; i < n; i++) ref[i] = 0.5 * (chans[0][i] + chans[1][i]); }
  const out = chans.map(() => new Float32Array(outLen + N)), norm = new Float32Array(outLen + N);
  const w = hann(N, false);
  let prev = -1;
  const corr = (s, nat, step) => { let c = 0; for (let k = 0; k < N; k += step) c += ref[s + k] * ref[nat + k]; return c; };
  for (let op = 0; op < outLen; op += Hs) {
    const target = Math.round(map(op + Hs) - Hs);
    let best = target;
    const nat = prev + Hs;
    if (prev >= 0 && nat >= 0 && nat + N < n && target - T >= 0 && target + T + N < n) {
      let bc = 0, bd = 0;
      for (let d = -T; d <= T; d += 4) { const c = corr(target + d, nat, 8); if (c > bc) { bc = c; bd = d; } }
      if (bc > 0) { const d0 = bd; for (let d = d0 - 3; d <= d0 + 3; d++) { const c = corr(target + d, nat, 4); if (c > bc) { bc = c; bd = d; } } }
      best = target + bd;
    }
    for (let ch = 0; ch < chans.length; ch++) {
      const src = chans[ch], o = out[ch];
      for (let k = 0; k < N; k++) { const i = best + k; if (i >= 0 && i < n) o[op + k] += src[i] * w[k]; }
    }
    for (let k = 0; k < N; k++) norm[op + k] += w[k];
    prev = best;
  }
  return out.map((o) => { const y = new Float32Array(outLen); for (let i = 0; i < outLen; i++) y[i] = norm[i] > 1e-3 ? o[i] / norm[i] : 0; return y; });
}

export function toInt16(x) { const y = new Int16Array(x.length); for (let i = 0; i < x.length; i++) { const v = Math.max(-1, Math.min(1, x[i])); y[i] = Math.round(v * 32767); } return y; }
export function fromInt16(x) { const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] / 32767; return y; }

/**
 * Plán vykreslení originální stopy pro písničku s mapou dob: výstup má stálé tempo (spb = s/dobu), posun výšky semis.
 * beatTimes: časy dob v nahrávce (s), zero: index doby = doba 0 písně. Vrací {fromBeat, toBeat, rate, outSpb} a mapovací funkci.
 */
export function stemPlan(beatTimes, zero, duration, { spb, semis = 0, fromBeat = -Infinity, toBeat: endBeat = Infinity }) {
  const n = beatTimes.length;
  const med = n > 1 ? (beatTimes[n - 1] - beatTimes[0]) / (n - 1) : 0.5;
  const sp0 = n > 1 ? beatTimes[1] - beatTimes[0] : med, sp1 = n > 1 ? beatTimes[n - 1] - beatTimes[n - 2] : med;
  const inTime = (b) => { // b = doba písně
    const i = b + zero;
    if (i <= 0) return beatTimes[0] + i * sp0;
    if (i >= n - 1) return beatTimes[n - 1] + (i - (n - 1)) * sp1;
    const k = Math.floor(i), f = i - k; return beatTimes[k] + f * (beatTimes[k + 1] - beatTimes[k]);
  };
  const beatOf = (t) => { // inverzní: čas nahrávky → doba písně
    if (t <= beatTimes[0]) return (t - beatTimes[0]) / sp0 - zero;
    if (t >= beatTimes[n - 1]) return n - 1 + (t - beatTimes[n - 1]) / sp1 - zero;
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beatTimes[m] <= t) lo = m; else hi = m; }
    return lo + (t - beatTimes[lo]) / (beatTimes[lo + 1] - beatTimes[lo]) - zero;
  };
  const b0 = Math.max(fromBeat, beatOf(0)), b1 = Math.min(endBeat, beatOf(duration));
  const rate = Math.pow(2, semis / 12);
  const outSpb = spb * rate; // sekundy bufferu na dobu (přehrává se rychlostí rate)
  return { fromBeat: b0, toBeat: b1, rate, outSpb, inTime, beatOf };
}

/** Vykreslí stopu podle plánu: kanály se vzorkovací frekvencí sr → kanály (sr), začátek = plan.fromBeat. */
export function renderPlannedStem(chans, sr, plan) {
  const outLen = Math.max(0, Math.round((plan.toBeat - plan.fromBeat) * plan.outSpb * sr));
  const map = (i) => sr * plan.inTime(plan.fromBeat + i / sr / plan.outSpb);
  return wsolaWarp(chans, sr, map, outLen);
}
