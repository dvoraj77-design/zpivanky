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
