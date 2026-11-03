// Detekce výšky tónu: McLeod Pitch Method (NSDF) počítaná přes FFT + tracker pro klidné zobrazení.
// Běží v AudioWorkletu i v Node testech – nesmí používat nic z prohlížeče.

// ---------- FFT (radix-2, in-place, komplexní) ----------
export class FFT {
  constructor(n) {
    if (n & (n - 1)) throw new Error('FFT size must be power of 2');
    this.n = n;
    this.rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
  }
  transform(re, im, inverse = false) {
    const n = this.n, rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    const sgn = inverse ? 1 : -1;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = this.cos[k], wi = sgn * this.sin[k];
          const a = i + j, b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

/**
 * Detektor výšky (MPM). detect(frame) → {freq, clarity, rms, zcr}
 * freq = 0, pokud není nalezena periodicita.
 */
export class PitchDetector {
  constructor(sampleRate, opts = {}) {
    this.sr = sampleRate;
    this.n = opts.frameSize || PitchDetector.frameSizeFor(sampleRate);
    this.minFreq = opts.minFreq || 50;
    this.maxFreq = opts.maxFreq || 1500;
    this.k = opts.k || 0.9;
    this.fft = new FFT(this.n * 2);
    this.re = new Float64Array(this.n * 2);
    this.im = new Float64Array(this.n * 2);
    this.nsdf = new Float64Array(this.n);
    this.x = new Float64Array(this.n);
  }
  static frameSizeFor(sr) {
    // ~40 ms a víc; mocnina dvou
    let n = 512;
    while (n < sr * 0.04) n <<= 1;
    return n;
  }
  detect(frame) {
    const n = this.n, x = this.x, re = this.re, im = this.im, nsdf = this.nsdf;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += frame[i];
    mean /= n;
    let energy = 0, zc = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const v = frame[i] - mean;
      x[i] = v;
      energy += v * v;
      if (i > 0 && ((v >= 0 && prev < 0) || (v < 0 && prev >= 0))) zc++;
      prev = v;
    }
    const rms = Math.sqrt(energy / n);
    const zcr = (zc * this.sr) / n / 2; // přechody nulou za sekundu / 2 ~ "frekvence"
    const res = { freq: 0, clarity: 0, rms, zcr };
    if (rms < 1e-5) return res;
    // autokorelace přes FFT
    re.fill(0); im.fill(0);
    for (let i = 0; i < n; i++) re[i] = x[i];
    this.fft.transform(re, im, false);
    for (let i = 0; i < re.length; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; }
    this.fft.transform(re, im, true);
    // m(τ) = Σ x_j² + x_{j+τ}²
    let m = 2 * energy;
    const tauMin = Math.max(2, Math.floor(this.sr / this.maxFreq));
    const tauMax = Math.min(Math.floor(n / 2), Math.ceil(this.sr / this.minFreq));
    nsdf[0] = 1;
    for (let tau = 1; tau <= tauMax + 1 && tau < n; tau++) {
      m -= x[tau - 1] * x[tau - 1] + x[n - tau] * x[n - tau];
      nsdf[tau] = m > 1e-12 ? (2 * re[tau]) / m : 0;
    }
    // hledání klíčových maxim mezi kladnými průchody nulou
    let tau = 1;
    while (tau < tauMax && nsdf[tau] > 0) tau++; // přeskočit hlavní lalok
    const peaks = [];
    let best = 0;
    while (tau < tauMax) {
      while (tau < tauMax && nsdf[tau] <= 0) tau++;
      let pmax = -1, pidx = -1;
      while (tau < tauMax && nsdf[tau] > 0) {
        if (nsdf[tau] > pmax) { pmax = nsdf[tau]; pidx = tau; }
        tau++;
      }
      if (pidx >= tauMin) {
        peaks.push(pidx);
        if (pmax > best) best = pmax;
      }
    }
    if (!peaks.length || best < 0.3) return res;
    const thr = this.k * best;
    let chosen = peaks[0];
    for (const p of peaks) if (nsdf[p] >= thr) { chosen = p; break; }
    // parabolická interpolace
    const a = nsdf[chosen - 1], b = nsdf[chosen], c = nsdf[chosen + 1];
    const denom = a - 2 * b + c;
    let shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    if (shift > 1 || shift < -1) shift = 0;
    const clarity = b - 0.25 * (a - c) * shift;
    const t = chosen + shift;
    res.freq = this.sr / t;
    res.clarity = Math.min(1, clarity);
    if (res.freq < this.minFreq || res.freq > this.maxFreq) res.freq = 0;
    return res;
  }
}

/**
 * Tracker: z jednotlivých detekcí dělá klidný průběh – hystereze hlasu, medián, potlačení oktávových skoků,
 * odhad šumového pozadí, detekce nástupů (energie) a sykavek („sss“).
 */
export class PitchTracker {
  constructor(opts = {}) {
    this.minClarity = opts.minClarity ?? 0.8;
    this.minDbAboveFloor = opts.minDbAboveFloor ?? 9;
    this.absMinDb = opts.absMinDb ?? -62;
    this.hop = opts.hopSec || 0.01;
    this.floorDb = -70;
    this.voicedRun = 0;
    this.unvoicedRun = 0;
    this.voiced = false;
    this.hist = []; // poslední midi (pro medián)
    this.ref = null; // referenční výška pro korekci oktávy
    this.refHist = [];
    this.octaveRun = 0;
    this.dbHist = [];
    this.lastOnset = -1;
    this.t = 0;
  }
  reset() { this.voiced = false; this.voicedRun = 0; this.unvoicedRun = 0; this.hist = []; this.ref = null; this.refHist = []; this.dbHist = []; }
  /** @param {{freq:number,clarity:number,rms:number,zcr:number}} d @param {number} t čas středu okna */
  push(d, t) {
    const db = d.rms > 0 ? 20 * Math.log10(d.rms) : -120;
    // šumové pozadí: rychle dolů, pomalu nahoru
    if (db < this.floorDb) this.floorDb = this.floorDb * 0.7 + db * 0.3;
    else this.floorDb += Math.min(0.05, (db - this.floorDb) * 0.002);
    if (this.floorDb < -90) this.floorDb = -90;
    const loud = db > this.absMinDb && db > this.floorDb + this.minDbAboveFloor;
    let candidate = loud && d.freq > 0 && d.clarity >= this.minClarity;
    let midi = candidate ? 69 + 12 * Math.log2(d.freq / 440) : null;
    // hystereze
    if (candidate) { this.voicedRun++; this.unvoicedRun = 0; } else { this.unvoicedRun++; this.voicedRun = 0; }
    if (!this.voiced && this.voicedRun >= 2) this.voiced = true;
    if (this.voiced && this.unvoicedRun >= 3) { this.voiced = false; this.hist = []; this.octaveRun = 0; }
    let out = null;
    if (this.voiced && midi != null) {
      // korekce oktávy vůči nedávné referenci
      if (this.ref != null) {
        const diff = midi - this.ref;
        const oct = Math.round(diff / 12);
        if (oct !== 0 && Math.abs(diff - oct * 12) < 1.0) {
          this.octaveRun++;
          if (this.octaveRun < 6) midi -= oct * 12; // krátké skoky přesně o oktávu ignorujeme
          else this.octaveRun = 0; // skutečný skok
        } else this.octaveRun = 0;
      }
      this.hist.push(midi);
      if (this.hist.length > 3) this.hist.shift();
      out = this.hist.length === 3 ? med3(this.hist[0], this.hist[1], this.hist[2]) : midi;
      this.refHist.push(out);
      if (this.refHist.length > 8) this.refHist.shift();
      this.ref = med(this.refHist);
    } else if (!this.voiced) {
      if (this.unvoicedRun > 25) { this.ref = null; this.refHist = []; }
    }
    // nástup podle energie
    this.dbHist.push(db);
    if (this.dbHist.length > 10) this.dbHist.shift();
    let onset = false;
    if (this.dbHist.length >= 6) {
      const prevMin = Math.min(...this.dbHist.slice(0, -2));
      if (db - prevMin > 9 && db > this.floorDb + 12 && t - this.lastOnset > 0.1) { onset = true; this.lastOnset = t; }
    }
    // sykavka / šum (např. „sss“): hlasité, nízká periodicita, vysoká hustota průchodů nulou
    const hiss = loud && !candidate && d.zcr > 1500;
    return { t, midi: out, rawMidi: d.freq > 0 ? 69 + 12 * Math.log2(d.freq / 440) : null, freq: d.freq, clarity: d.clarity, db, floorDb: this.floorDb, voiced: out != null, onset, hiss };
  }
}
function med3(a, b, c) { return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c)); }
function med(arr) { const s = arr.slice().sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }

/**
 * Analyzátor proudu vzorků: bufferuje, každých hop vzorků spustí detekci a tracker.
 * Volitelná decimace pro vysoké vzorkovací frekvence.
 */
export class StreamAnalyzer {
  constructor(sampleRate, opts = {}) {
    this.inRate = sampleRate;
    this.dec = sampleRate > 50000 ? 2 : 1;
    this.sr = sampleRate / this.dec;
    this.detector = new PitchDetector(this.sr, opts);
    this.tracker = new PitchTracker({ ...opts, hopSec: 0 });
    this.n = this.detector.n;
    this.hop = opts.hop || Math.round(this.sr * 0.01);
    this.buf = new Float32Array(this.n);
    this.filled = 0;
    this.sinceHop = 0;
    this.frame = new Float32Array(this.n);
    this.decPhase = 0;
    this.decPrev = 0;
  }
  /**
   * @param {Float32Array} input
   * @param {number} endTime čas (s) konce tohoto bloku
   * @param {(r:object)=>void} onResult
   */
  process(input, endTime, onResult) {
    const len = input.length;
    for (let i = 0; i < len; i++) {
      let v = input[i];
      if (this.dec === 2) {
        // jednoduchý dolní propust + decimace 2:1
        const s = 0.5 * (v + this.decPrev);
        this.decPrev = v;
        this.decPhase ^= 1;
        if (this.decPhase) continue;
        v = s;
      }
      // posuvný buffer (kruhový)
      this.buf[this.filled % this.n] = v;
      this.filled++;
      this.sinceHop++;
      if (this.sinceHop >= this.hop && this.filled >= this.n) {
        this.sinceHop = 0;
        const start = this.filled % this.n;
        for (let j = 0; j < this.n; j++) this.frame[j] = this.buf[(start + j) % this.n];
        const d = this.detector.detect(this.frame);
        const tEnd = endTime - (len - 1 - i) / this.inRate;
        const tCenter = tEnd - this.n / 2 / this.sr;
        onResult(this.tracker.push(d, tCenter), d);
      }
    }
  }
}
