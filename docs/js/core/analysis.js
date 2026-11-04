// Rozbor importované písně: nástupy → tempo a doby → takt; chroma → akordy a tónina; výška zpěvu → noty po dobách;
// text (LRC) → slabiky zarovnané na noty; sestavení písně ve formátu zpivanky-song.
import { FFTAny, hann } from './dsp.js';
import { median, pc, parseChord } from './music.js';
import { detectKey, SONG_FORMAT, SONG_VERSION } from './song.js';

// ---------- spektrum po snímcích (mono) ----------
function* spectra(x, nFft, hop) {
  const fft = new FFTAny(nFft), win = hann(nFft);
  const re = new Float64Array(nFft), im = new Float64Array(nFft), mag = new Float32Array((nFft >> 1) + 1);
  for (let s = 0; s + nFft <= x.length; s += hop) {
    for (let k = 0; k < nFft; k++) { re[k] = x[s + k] * win[k]; im[k] = 0; }
    fft.transform(re, im, false);
    for (let k = 0; k < mag.length; k++) mag[k] = Math.hypot(re[k], im[k]);
    yield { s, mag };
  }
}

/** Obálka nástupů (spektrální tok v log. měřítku), fps = sr/hop. */
export function onsetEnvelope(x, sr, { nFft = 2048, hop = 512 } = {}) {
  let prev = null;
  const env = [];
  const lo = Math.floor(30 / (sr / nFft)), hi = Math.min((nFft >> 1), Math.floor(8000 / (sr / nFft)));
  for (const { mag } of spectra(x, nFft, hop)) {
    const cur = new Float32Array(hi - lo);
    for (let k = lo; k < hi; k++) cur[k - lo] = Math.log1p(1000 * mag[k]);
    let flux = 0;
    if (prev) for (let k = 0; k < cur.length; k++) { const d = cur[k] - prev[k]; if (d > 0) flux += d; }
    env.push(flux); prev = cur;
  }
  // odečtení klouzavého průměru a normalizace
  const out = new Float32Array(env.length), w = 16;
  let mx = 1e-9;
  for (let i = 0; i < env.length; i++) {
    let s = 0, c = 0; for (let j = Math.max(0, i - w); j <= Math.min(env.length - 1, i + w); j++) { s += env[j]; c++; }
    out[i] = Math.max(0, env[i] - s / c); mx = Math.max(mx, out[i]);
  }
  for (let i = 0; i < out.length; i++) out[i] /= mx;
  return { env: out, fps: sr / hop, hop, nFft };
}

/** Odhad tempa (BPM) z autokorelace obálky s mírnou preferencí kolem 100 BPM. */
export function estimateTempo(env, fps, { min = 50, max = 190 } = {}) {
  const lagMin = Math.floor((60 / max) * fps), lagMax = Math.ceil((60 / min) * fps);
  const ac = new Float64Array(lagMax + 2);
  for (let lag = lagMin; lag <= lagMax + 1; lag++) { let s = 0; for (let i = lag; i < env.length; i++) s += env[i] * env[i - lag]; ac[lag] = s / (env.length - lag); }
  let best = lagMin, bestS = -1;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const bpm = (60 * fps) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 100) / 0.9) ** 2);
    // podpora dvojnásobku (takty)
    const s = (ac[lag] + 0.5 * (ac[2 * lag] || 0)) * prior;
    if (s > bestS) { bestS = s; best = lag; }
  }
  // parabolické zpřesnění
  const a = ac[best - 1] || 0, b = ac[best], c = ac[best + 1] || 0, d = a - 2 * b + c;
  const lag = best + (d !== 0 ? (0.5 * (a - c)) / d : 0);
  return (60 * fps) / lag;
}

/** Sledování dob (Ellis 2007, dynamické programování). Vrací časy dob v sekundách. */
export function trackBeats(env, fps, bpm, { tightness = 120 } = {}) {
  const P = (60 / bpm) * fps;
  const n = env.length;
  const score = new Float64Array(n), back = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) {
    let best = 0, bi = -1;
    const from = Math.max(0, Math.round(t - 2 * P)), to = Math.round(t - P / 2);
    for (let tau = from; tau <= to; tau++) {
      const v = score[tau] - tightness * Math.log((t - tau) / P) ** 2;
      if (v > best || bi < 0) { best = v; bi = tau; }
    }
    score[t] = env[t] + (bi >= 0 ? best : 0);
    back[t] = bi;
  }
  // konec: nejlepší skóre v posledních P snímcích
  let t = n - 1, bs = -Infinity;
  for (let i = Math.max(0, Math.floor(n - P)); i < n; i++) if (score[i] > bs) { bs = score[i]; t = i; }
  const beats = [];
  while (t >= 0) { beats.push(t / fps); t = back[t]; if (beats.length > 100000) break; }
  beats.reverse();
  return beats;
}

// ---------- chroma ----------
/**
 * Chroma po dobách se součtem harmonických (zvýhodní základní tóny před alikvotami): pro tóny MIDI 33–84 sečte
 * amplitudy na 1.–5. harmonické, výsledek složí do 12 tříd. Zvlášť basová chroma (MIDI 28–52).
 */
export function beatChroma(x, sr, beats, { nFft = 4096, hop = 1024 } = {}) {
  const binHz = sr / nFft;
  const bins = (nFft >> 1) + 1;
  const cand = [];
  for (let m = 28; m <= 84; m++) {
    const f0 = 440 * Math.pow(2, (m - 69) / 12);
    const hs = [];
    for (let h = 1; h <= 5; h++) { const b = (f0 * h) / binHz; if (b < bins - 1) hs.push([Math.round(b), Math.pow(0.7, h - 1)]); }
    cand.push({ m, pc: ((m % 12) + 12) % 12, hs });
  }
  const nb = beats.length - 1;
  const ch = Array.from({ length: Math.max(0, nb) }, () => new Float64Array(12));
  const bass = Array.from({ length: Math.max(0, nb) }, () => new Float64Array(12));
  const energy = new Float64Array(Math.max(0, nb));
  let bi = 0;
  for (const { s, mag } of spectra(x, nFft, hop)) {
    const t = (s + nFft / 2) / sr;
    while (bi < nb && t >= beats[bi + 1]) bi++;
    if (bi >= nb) break;
    if (t < beats[0]) continue;
    const pk = (b) => Math.max(mag[b - 1] || 0, mag[b], mag[b + 1] || 0);
    for (const c of cand) {
      let sal = 0;
      for (const [b, w] of c.hs) sal += w * pk(b);
      // potlačení alikvot: kandidát o oktávu/kvintu níž vysvětluje tento tón lépe
      const v = Math.sqrt(sal);
      if (c.m <= 52) bass[bi][c.pc] += v;
      if (c.m >= 40) ch[bi][c.pc] += v;
      energy[bi] += v;
    }
  }
  for (let i = 0; i < nb; i++) { suppressFifths(ch[i]); normalize(ch[i]); normalize(bass[i]); }
  return { chroma: ch, bass, energy };
}
/** Harmonické tóny (kvinta = 3. harmonická) zvednou chroma o kvintu výš – mírně je odečteme. */
function suppressFifths(v) {
  const o = Float64Array.from(v);
  for (let k = 0; k < 12; k++) v[k] = Math.max(0, o[k] - 0.25 * o[(k + 5) % 12]);
}
function normalize(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; for (let i = 0; i < v.length; i++) v[i] /= s; }

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const CHORD_TYPES = [['', [0, 4, 7]], ['m', [0, 3, 7]], ['7', [0, 4, 7, 10]]];

/** Rozpoznání akordů po dobách (šablony + Viterbi). Vrací pole značek po dobách (null = bez akordu). */
export function recognizeChords(chroma, bass, energy, { meter = 4, downbeat = 0, changeCost = 1.0 } = {}) {
  const labels = [];
  for (let r = 0; r < 12; r++) for (const [q, iv] of CHORD_TYPES) {
    const t = new Float64Array(12);
    iv.forEach((s, i) => { t[(r + s) % 12] = i === 0 ? 1 : i === 3 ? 0.6 : 0.85; });
    normalize(t);
    labels.push({ sym: ROOTS[r] + q, t, root: r, q });
  }
  const n = chroma.length, L = labels.length;
  const emaxE = Math.max(1e-9, ...energy);
  const em = Array.from({ length: n }, (_, i) => labels.map((lb) => {
    let s = 0; for (let k = 0; k < 12; k++) s += chroma[i][k] * lb.t[k];
    s += 0.7 * bass[i][lb.root];
    if (lb.q === '7') s -= 0.06; // mírná preference trojzvuků
    if (lb.q === 'm') s -= 0.02;
    return energy[i] < emaxE * 0.05 ? 0 : s * 4;
  }));
  // Viterbi
  const dp = new Float64Array(L), bp = Array.from({ length: n }, () => new Int16Array(L));
  for (let j = 0; j < L; j++) dp[j] = em[0][j];
  for (let i = 1; i < n; i++) {
    const onBar = ((i - downbeat) % meter + meter) % meter === 0;
    const onHalf = meter === 4 && ((i - downbeat) % 2 + 2) % 2 === 0;
    const cost = onBar ? changeCost * 0.5 : onHalf ? changeCost : changeCost * 2.2;
    let bestPrev = 0, bestV = -Infinity;
    for (let j = 0; j < L; j++) if (dp[j] > bestV) { bestV = dp[j]; bestPrev = j; }
    const nd = new Float64Array(L);
    for (let j = 0; j < L; j++) {
      const stay = dp[j], change = bestV - cost;
      if (stay >= change) { nd[j] = stay + em[i][j]; bp[i][j] = j; } else { nd[j] = change + em[i][j]; bp[i][j] = bestPrev; }
    }
    dp.set(nd);
  }
  let j = 0; for (let k = 1; k < L; k++) if (dp[k] > dp[j]) j = k;
  const out = new Array(n);
  for (let i = n - 1; i >= 0; i--) { out[i] = labels[j].sym; j = bp[i][j]; }
  return out;
}

/** Nárůst energie basového pásma (< 200 Hz) na každé době – basa a kopák hrají hlavně na první dobu. */
export function bassAccent(x, sr, beats) {
  const out = new Float64Array(beats.length);
  const w = Math.round(0.06 * sr);
  // jednoduchý dolní propust (2× klouzavý průměr ~ 5 ms) a energie v okně po době vs. před ní
  const k = Math.max(1, Math.round(sr / 400));
  const lp = new Float32Array(x.length); let acc = 0;
  for (let i = 0; i < x.length; i++) { acc += x[i]; if (i >= k) acc -= x[i - k]; lp[i] = acc / k; }
  for (let b = 0; b < beats.length; b++) {
    const c = Math.round(beats[b] * sr);
    let after = 0, before = 0;
    for (let i = c; i < c + w && i < lp.length; i++) after += lp[i] * lp[i];
    for (let i = c - w; i < c; i++) if (i >= 0) before += lp[i] * lp[i];
    out[b] = Math.max(0, Math.sqrt(after) - Math.sqrt(before));
  }
  const mx = Math.max(1e-9, ...out); for (let i = 0; i < out.length; i++) out[i] /= mx;
  return out;
}

/**
 * Takt (3 nebo 4) a fáze první doby: kombinace akcentů (nástupy, basa) a změn harmonie (rozdíl chroma mezi dobami).
 * Pro každý takt a fázi měříme, o kolik jsou „první doby“ výraznější než ostatní.
 */
export function detectMeter(accent, chroma, bass, lowAcc) {
  const n = accent.length;
  const change = new Float64Array(n);
  for (let i = 1; i < n && i < chroma.length; i++) {
    let d = 0; for (let k = 0; k < 12; k++) d += Math.abs(chroma[i][k] - chroma[i - 1][k]) + 0.7 * Math.abs(bass[i][k] - bass[i - 1][k]);
    change[i] = d;
  }
  const z = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; return v.map((x) => (x - m) / sd); };
  const feat = [z(Array.from(accent)), z(Array.from(change)), z(Array.from(lowAcc || accent))];
  const wts = [0.6, 1.2, 1.0];
  let best = { meter: 4, phase: 0, s: -Infinity };
  for (const meter of [4, 3]) for (let ph = 0; ph < meter; ph++) {
    let s = 0;
    feat.forEach((f, fi) => {
      let on = 0, nOn = 0, off = 0, nOff = 0;
      for (let i = 0; i < n; i++) { if (((i - ph) % meter + meter) % meter === 0) { on += f[i]; nOn++; } else { off += f[i]; nOff++; } }
      s += wts[fi] * (on / Math.max(1, nOn) - off / Math.max(1, nOff));
    });
    if (meter === 4) {
      // ve 4/4 je i třetí doba silná – odliš od 2/4 + posunu
      s += 0.05;
    }
    if (s > best.s) best = { meter, phase: ph, s };
  }
  return best;
}

// ---------- melodie ze směsi (harmonická salience) ----------
/**
 * Výška hlavní melodie ze zvuku, kde může zůstat doprovod (rychlé oddělení, mikrofon).
 * Spektrální vrcholy → součet harmonických pro kandidáty f0 (MIDI minMidi–maxMidi), basové pásmo potlačené,
 * výběr s ohledem na plynulost, rozhodnutí o znělosti podle relativní salience a hlasitosti.
 * Vrací snímky {t, midi|null, voiced, db} jako detektor výšky.
 */
export function melodyFrames(x, sr, { nFft = 2048, hop = 256, minMidi = 43, maxMidi = 86, harmonics = 10, theta = 0.12, lowPrior = 0.06, onProgress } = {}) {
  const fft = new FFTAny(nFft), win = hann(nFft), half = nFft >> 1;
  const re = new Float64Array(nFft), im = new Float64Array(nFft), mag = new Float64Array(half + 1);
  const binHz = sr / nFft, step = 0.1, nb = Math.round((maxMidi - minMidi) / step) + 1;
  const sal = new Float64Array(nb);
  const kLo = Math.max(2, Math.floor(100 / binHz)), kHi = Math.min(half - 1, Math.ceil(5000 / binHz));
  const raw = [];
  const n = x.length;
  for (let c = 0; c < n; c += hop) {
    const s0 = c - half;
    let e = 0;
    for (let k = 0; k < nFft; k++) { const i = s0 + k; const v = i >= 0 && i < n ? x[i] : 0; re[k] = v * win[k]; im[k] = 0; e += v * v; }
    const db = 10 * Math.log10(e / nFft + 1e-12);
    fft.transform(re, im, false);
    let mx = 0;
    for (let k = 0; k <= half; k++) { mag[k] = Math.hypot(re[k], im[k]); if (k >= kLo && k <= kHi && mag[k] > mx) mx = mag[k]; }
    sal.fill(0);
    if (mx > 1e-6) {
      const thr = mx * 0.01;
      for (let k = kLo; k <= kHi; k++) {
        const a = mag[k];
        if (a < thr || a < mag[k - 1] || a < mag[k + 1]) continue;
        const l1 = Math.log(mag[k - 1] + 1e-12), l2 = Math.log(a + 1e-12), l3 = Math.log(mag[k + 1] + 1e-12);
        const den = l1 - 2 * l2 + l3, off = den < 0 ? (0.5 * (l1 - l3)) / den : 0;
        const fp = (k + off) * binHz;
        const wf = fp < 150 ? 0 : fp < 320 ? (fp - 150) / 170 : 1; // basa a kopák bez váhy
        if (!wf) continue;
        const amp = Math.sqrt(a / mx) * wf;
        for (let h = 1; h <= harmonics; h++) {
          const m = 69 + 12 * Math.log2(fp / h / 440);
          if (m < minMidi - 1) break;
          if (m > maxMidi + 1) continue;
          const w0 = amp * Math.pow(0.8, h - 1);
          const cb = (m - minMidi) / step;
          for (let b = Math.max(0, Math.ceil(cb - 10)); b <= Math.min(nb - 1, Math.floor(cb + 10)); b++) {
            const d = Math.abs(b - cb) * step; // půltóny
            const w = Math.cos((Math.PI / 2) * d); sal[b] += w0 * w * w;
          }
        }
      }
    }
    // tři nejsilnější kandidáti (lokální maxima)
    const cands = [];
    for (let b = 1; b < nb - 1; b++) {
      if (sal[b] <= 0 || sal[b] < sal[b - 1] || sal[b] < sal[b + 1]) continue;
      const a = sal[b - 1], v = sal[b], z = sal[b + 1], d2 = a - 2 * v + z, o = d2 < 0 ? (0.5 * (a - z)) / d2 : 0;
      cands.push({ m: minMidi + (b + o) * step, s: v });
    }
    cands.sort((p, q) => q.s - p.s);
    raw.push({ t: c / sr, db, c: cands.slice(0, 3) });
    if (onProgress && raw.length % 2000 === 0) onProgress(c / n);
  }
  // reference salience: horní kvantil
  const tops = raw.map((r) => r.c[0]?.s || 0).filter((v) => v > 0).sort((a, b) => a - b);
  const ref = tops.length ? tops[Math.floor(tops.length * 0.9)] : 1;
  const dbs = raw.map((r) => r.db).sort((a, b) => a - b);
  const loud = dbs.length ? dbs[Math.floor(dbs.length * 0.95)] : 0;
  // výběr: Viterbi přes kandidáty + „ticho“
  const T = raw.length, NS = 4; // 0..2 kandidáti, 3 = nezněl
  const cost = new Float64Array(T * NS).fill(Infinity), from = new Int8Array(T * NS);
  const lnTh = -Math.log(theta);
  const emit = (r, j) => {
    const quiet = r.db < loud - 30 ? 2 : r.db < loud - 20 ? 0.7 : 0;
    if (j === 3) return lnTh - quiet;
    const c = r.c[j]; if (!c) return Infinity;
    // mírná přednost vyšším tónům: melodie bývá nad basou a levou rukou doprovodu
    return -Math.log(Math.max(1e-3, Math.min(1, c.s / ref))) + quiet + (c.m < 57 ? (57 - c.m) * lowPrior : 0);
  };
  const trans = (a, b) => { // a, b: {m}|null
    if (!a && !b) return 0;
    if (!a || !b) return 0.6;
    const d = Math.abs(a.m - b.m);
    return d < 0.6 ? d * 0.3 : 0.25 + Math.min(2.5, d * 0.12) + (Math.abs(d - 12) < 0.7 ? 0.8 : 0);
  };
  for (let j = 0; j < NS; j++) cost[j] = emit(raw[0], j);
  for (let t = 1; t < T; t++) {
    for (let j = 0; j < NS; j++) {
      const e = emit(raw[t], j); if (!Number.isFinite(e)) continue;
      const bj = j === 3 ? null : raw[t].c[j];
      let best = Infinity, arg = 3;
      for (let i = 0; i < NS; i++) {
        const p = cost[(t - 1) * NS + i]; if (!Number.isFinite(p)) continue;
        const v = p + trans(i === 3 ? null : raw[t - 1].c[i], bj);
        if (v < best) { best = v; arg = i; }
      }
      cost[t * NS + j] = best + e; from[t * NS + j] = arg;
    }
  }
  let j = 0, bc = Infinity;
  for (let k = 0; k < NS; k++) if (cost[(T - 1) * NS + k] < bc) { bc = cost[(T - 1) * NS + k]; j = k; }
  const path = new Int8Array(T);
  for (let t = T - 1; t >= 0; t--) { path[t] = j; j = from[t * NS + j]; }
  return raw.map((r, t) => {
    const c = path[t] === 3 ? null : r.c[path[t]];
    // hlasitost podle salience zvolené výšky: mezi opakovanými slabikami klesne, i když doprovod hraje dál
    return { t: r.t, midi: c ? c.m : null, voiced: !!c, db: c ? Math.min(r.db, loud + 20 * Math.log10(Math.max(1e-4, c.s / ref))) : r.db };
  });
}

/** Oprava oktávových chyb přepisu: osamocený tón o víc než 9 půltónů od obou sousedů se posune o oktávu k nim. */
export function fixOctaves(notes) {
  const out = notes.map((n) => ({ ...n }));
  for (let i = 0; i < out.length; i++) {
    if (!out[i - 1] || !out[i + 1]) continue; // jen tóny uvnitř melodie (na kraji nejde poznat, co je chyba)
    const nb = [out[i - 2], out[i - 1], out[i + 1], out[i + 2]].filter(Boolean).map((n) => n.p);
    const med = nb.sort((x, y) => x - y)[nb.length >> 1];
    const p = out[i].p, prev = out[i - 1]?.p ?? med, next = out[i + 1]?.p ?? med;
    if (Math.abs(p - med) > 9 && Math.abs(p - prev) > 7 && Math.abs(p - next) > 7) {
      const q = p + 12 * Math.round((med - p) / 12);
      if (Math.abs(q - med) < Math.abs(p - med)) out[i].p = q;
    }
  }
  return out;
}

// ---------- melodie ----------
/** Čas (s) → pozice v dobách podle detekovaných dob (lineárně mezi dobami, mimo extrapolace). */
export function timeToBeatFn(beats) {
  const n = beats.length;
  const p0 = beats[1] - beats[0], p1 = beats[n - 1] - beats[n - 2];
  return (t) => {
    if (t <= beats[0]) return (t - beats[0]) / p0;
    if (t >= beats[n - 1]) return n - 1 + (t - beats[n - 1]) / p1;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beats[m] <= t) lo = m; else hi = m; }
    return lo + (t - beats[lo]) / (beats[lo + 1] - beats[lo]);
  };
}
export function beatToTimeFn(beats) {
  const n = beats.length;
  const p0 = beats[1] - beats[0], p1 = beats[n - 1] - beats[n - 2];
  return (b) => {
    if (b <= 0) return beats[0] + b * p0;
    if (b >= n - 1) return beats[n - 1] + (b - n + 1) * p1;
    const i = Math.floor(b); return beats[i] + (b - i) * (beats[i + 1] - beats[i]);
  };
}

/**
 * Noty z výšky zpěvu. frames: [{t, midi|null, voiced}] (s). Vrací [{t (doby), d, p, time, endTime}].
 */
export function notesFromPitch(frames, toBeat, { grid = 0.5, minBeats = 0.5 } = {}) {
  const segs = [];
  let cur = null;
  for (const f of frames) {
    if (!f.voiced || f.midi == null) {
      if (cur && f.t - cur.end > 0.07) { segs.push(cur); cur = null; }
      continue;
    }
    if (cur) {
      const ref = median(cur.vals.slice(-8));
      // nové nasazení stejného tónu (slabika): krátký pokles hlasitosti a nárůst
      if (f.db != null) {
        cur.minDb = Math.min(cur.minDb ?? f.db, f.db);
        const peak = cur.peakDb ?? f.db;
        if (f.db < peak - 6) cur.dip = true;
        if (cur.dip && f.db > (cur.minDb + 5) && f.t - cur.start > 0.15 && Math.abs(f.midi - ref) <= 0.75) {
          segs.push(cur); cur = { start: f.t, end: f.t, vals: [f.midi], peakDb: f.db }; continue;
        }
        cur.peakDb = Math.max(peak * 0.98 + f.db * 0.02, f.db > peak ? f.db : peak);
      }
      if (Math.abs(f.midi - ref) > 0.75) {
        cur.pending = cur.pending || [];
        cur.pending.push(f);
        if (cur.pending.length >= 6) { segs.push(cur); cur = { start: cur.pending[0].t, end: f.t, vals: cur.pending.map((x) => x.midi), peakDb: f.db }; }
        continue;
      }
      if (cur.pending) { cur.vals.push(...cur.pending.map((x) => x.midi)); cur.pending = null; }
      cur.vals.push(f.midi); cur.end = f.t;
    } else cur = { start: f.t, end: f.t, vals: [f.midi], peakDb: f.db };
  }
  if (cur) segs.push(cur);
  const good = segs.filter((s) => s.end - s.start >= 0.1 && s.vals.length >= 6);
  if (!good.length) return [];
  const tune = median(good.map((s) => { const m = median(s.vals); return m - Math.round(m); }));
  const out = [];
  for (const s of good) {
    const p = Math.round(median(s.vals) - tune);
    let t = Math.round(toBeat(s.start) / grid) * grid;
    let e = Math.round(toBeat(s.end + 0.03) / grid) * grid;
    if (e <= t) e = t + grid;
    const last = out[out.length - 1];
    if (last && t < last.t + last.d) t = last.t + last.d;
    if (e - t < minBeats - 1e-9) {
      if (last && last.p === p && t - (last.t + last.d) < 1e-9) { last.d = e - last.t; last.endTime = s.end; }
      continue;
    }
    out.push({ t, d: e - t, p, time: s.start, endTime: s.end });
  }
  return out;
}

// ---------- text ----------
/** LRC → [{time, text}] */
export function parseLrc(lrc) {
  const out = [];
  for (const line of String(lrc || '').split(/\r?\n/)) {
    const tags = [...line.matchAll(/\[(\d+):(\d+(?:[.,]\d+)?)\]/g)];
    if (!tags.length) continue;
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of tags) out.push({ time: parseInt(m[1], 10) * 60 + parseFloat(m[2].replace(',', '.')), text });
  }
  return out.sort((a, b) => a.time - b.time);
}

const VOWELS = 'aáäeéěiíoóöuúůüyý';
const isV = (ch) => VOWELS.includes(ch.toLowerCase());
/** Dělení slova na slabiky (čeština; přibližně i angličtina). Vrací pole slabik, poslední bez pomlčky. */
export function syllabify(word) {
  const w = word;
  const letters = [...w];
  const lower = letters.map((c) => c.toLowerCase());
  // jádra slabik: samohlásky (dvojhlásky ou/au/eu jako jedno) a slabičné r/l mezi souhláskami
  const nuclei = [];
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    if (isV(c)) {
      const pair = c + (lower[i + 1] || '');
      if (['ou', 'au', 'eu'].includes(pair)) { nuclei.push([i, i + 1]); i++; continue; }
      nuclei.push([i, i]);
    } else if ((c === 'r' || c === 'l') && /[a-zá-ž]/i.test(c)) {
      const prevC = i > 0 && !isV(lower[i - 1]) && /\p{L}/u.test(lower[i - 1]);
      const nextC = i === lower.length - 1 || (!isV(lower[i + 1]) && /\p{L}/u.test(lower[i + 1]));
      if (prevC && nextC) nuclei.push([i, i]);
    }
  }
  if (nuclei.length <= 1) return [w];
  const cuts = [];
  for (let k = 0; k < nuclei.length - 1; k++) {
    const a = nuclei[k][1] + 1, b = nuclei[k + 1][0]; // souhlásky mezi jádry: [a, b)
    const cons = b - a;
    cuts.push(cons <= 1 ? a : a + 1);
  }
  const parts = [];
  let s = 0;
  for (const c of cuts) { parts.push(letters.slice(s, c).join('')); s = c; }
  parts.push(letters.slice(s).join(''));
  return parts.filter((p) => p.length);
}
export function lineSyllables(text) {
  const out = [];
  for (const word of String(text).trim().split(/\s+/).filter(Boolean)) {
    // slabiky oddělené pomlčkou (pís-nič-ka) mají přednost před automatickým dělením
    const sy = /\p{L}-\p{L}/u.test(word) ? word.split('-').filter(Boolean) : syllabify(word);
    sy.forEach((s, i) => out.push(i < sy.length - 1 ? s + '-' : s));
  }
  return out;
}

/**
 * Přiřadí slabiky textu k notám. lines: [{time?, text}] (s časem = LRC). Vrací {notes (se syl, phrase), lyrics, phrases}.
 */
export function alignLyrics(notes, lines, { bpb = 4 } = {}) {
  const ns = notes.map((n) => ({ ...n, syl: '', phrase: 0 }));
  let timed = lines.length && lines.every((l) => l.time != null) && ns.every((n) => n.time != null);
  let groups = [];
  if (timed) {
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].text) continue;
      const t0 = lines[i].time - 0.35, t1 = (lines[i + 1]?.time ?? Infinity) - 0.35;
      const g = ns.filter((n) => n.time >= t0 && n.time < t1 && !n._used);
      g.forEach((n) => { n._used = true; });
      if (g.length) groups.push({ notes: g, text: lines[i].text });
    }
    // časy textu nesedí k nahrávce (jiná verze, posun) → rozdělit podle pauz
    const used = groups.reduce((a, g) => a + g.notes.length, 0);
    if (used < ns.length * 0.6) { timed = false; groups = []; ns.forEach((n) => { delete n._used; }); }
  }
  if (!timed) {
    // fráze podle pauz (≥ 1 doba) nebo nejvýše 4 takty
    let g = [];
    ns.forEach((n, i) => {
      const prev = ns[i - 1];
      if (prev && (n.t - (prev.t + prev.d) >= 1 || (g.length && n.t - g[0].t >= bpb * 4))) { groups.push({ notes: g }); g = []; }
      g.push(n);
    });
    if (g.length) groups.push({ notes: g });
    const texts = lines.map((l) => l.text).filter(Boolean);
    groups.forEach((gr, i) => { gr.text = texts[i] ?? null; });
  }
  const lyrics = [], phrases = [];
  groups.forEach((gr, pi) => {
    const syl = gr.text ? lineSyllables(gr.text) : [];
    const K = gr.notes.length, S = syl.length;
    gr.notes.forEach((n) => { n.phrase = pi; });
    if (!S) gr.notes.forEach((n) => { n.syl = 'la'; });
    else if (K >= S) {
      let j = 0;
      for (let k = 0; k < K; k++) {
        const target = Math.floor((j * K) / S);
        if (j < S && k >= target) { gr.notes[k].syl = syl[j]; j++; } else { gr.notes[k].syl = ''; gr.notes[k].melisma = true; }
      }
    } else {
      for (let k = 0; k < K; k++) {
        const a = Math.floor((k * S) / K), b = Math.floor(((k + 1) * S) / K);
        const part = syl.slice(a, Math.max(b, a + 1));
        gr.notes[k].syl = part.reduce((acc, x) => (acc ? (acc.endsWith('-') ? acc.slice(0, -1) + x : acc + ' ' + x) : x), '');
      }
    }
    const start = gr.notes[0].t, end = gr.notes[K - 1].t + gr.notes[K - 1].d;
    lyrics.push({ text: gr.text || gr.notes.map((n) => n.syl).join(' '), start, end, line: pi });
    phrases.push({ start, end, index: pi, section: 1 });
  });
  return { notes: ns.filter((n) => groups.some((g) => g.notes.includes(n))).map(({ _used, ...n }) => n), lyrics, phrases };
}

/** Nový text k importované písni (úprava textu): noty zůstávají, mění se slabiky, řádky a fráze. */
export function relyricSong(song, lines) {
  const bt = (song.timing?.beats || []).map((b) => b.time);
  const zero = song.timing?.zeroBeat || 0;
  const toTime = bt.length > 1 ? beatToTimeFn(bt) : null;
  const notes = song.notes.map(({ syl, melisma, ...n }) => ({ ...n, time: toTime ? toTime(n.t + zero) : null }));
  const al = alignLyrics(notes, lines, { bpb: song.meter[0] });
  const keep = new Set(al.notes.map((n) => n.t));
  const extra = notes.filter((n) => !keep.has(n.t)); // noty mimo text: zachovat jako „la“ v nejbližší frázi
  const all = [...al.notes, ...extra.map((n) => ({ ...n, syl: 'la', phrase: nearestPhrase(al.phrases, n.t) }))].sort((a, b) => a.t - b.t);
  return { ...song, notes: all.map(({ time, endTime, ...n }) => n), lyrics: al.lyrics, phrases: al.phrases, analysis: { ...(song.analysis || {}), lyricsEdited: true } };
}
function nearestPhrase(phrases, t) {
  let best = 0, bd = Infinity;
  for (const p of phrases) { const d = t < p.start ? p.start - t : t > p.end ? t - p.end : 0; if (d < bd) { bd = d; best = p.index; } }
  return best;
}
/** Text písně jako řádky (pro úpravy). */
export function lyricsText(song) { return (song.lyrics || []).map((l) => l.text).join('\n'); }

/** Akordy po dobách → segmenty po půltaktech / taktech (doby písně). */
export function chordsToSegments(perBeat, beatOffset, bpb, length) {
  const segLen = bpb === 4 ? 2 : bpb;
  const out = [];
  for (let b = 0; b < length; b += segLen) {
    const votes = {};
    for (let k = 0; k < segLen; k++) { const s = perBeat[b + k + beatOffset]; if (s) votes[s] = (votes[s] || 0) + (k === 0 ? 1.5 : 1); }
    const best = Object.entries(votes).sort((a, c) => c[1] - a[1])[0]?.[0] || out[out.length - 1]?.sym || 'C';
    const last = out[out.length - 1];
    if (last && last.sym === best && (b % bpb) !== 0) last.d += segLen; else out.push({ t: b, d: Math.min(segLen, length - b), sym: best });
  }
  return out;
}

/**
 * Sestaví importovanou píseň.
 * a: { title, artist, beats (s), meter, downbeat, chordsPerBeat, vocalFrames, lyricsLines, duration, stems }
 */
export function buildImportedSong(a) {
  const bpb = a.meter;
  const toBeat = timeToBeatFn(a.beats);
  // nula písně = první doba taktu (downbeat), nejpozději 1 takt před prvním tónem
  let notes = fixOctaves(notesFromPitch(a.vocalFrames, toBeat, { grid: a.grid || 0.5 }));
  const firstNoteBeat = notes.length ? notes[0].t : 0;
  let zero = a.downbeat;
  while (zero + bpb <= firstNoteBeat - bpb) zero += bpb; // ořízni dlouhé ticho/předehru na max. ~2 takty
  zero = Math.max(0, zero);
  notes = notes.map((n) => ({ ...n, t: n.t - zero })).filter((n) => n.t >= 0);
  const al = alignLyrics(notes, a.lyricsLines || [], { bpb });
  const lastEnd = al.notes.length ? Math.max(...al.notes.map((n) => n.t + n.d)) : bpb * 4;
  const songLen = Math.ceil((lastEnd + 0.01) / bpb) * bpb + bpb;
  const chords = chordsToSegments(a.chordsPerBeat, zero, bpb, songLen);
  const keyInfo = detectKey(al.notes.map((n) => ({ p: n.p, d: n.d })));
  const ROOT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const spb = median(a.beats.slice(1).map((b, i) => b - a.beats[i]));
  const tempo = Math.round((60 / spb) * 10) / 10;
  const firstNote = al.notes[0]?.t ?? 0;
  const introEnd = Math.floor(firstNote / bpb) * bpb;
  const span = al.notes.length ? Math.max(...al.notes.map((n) => n.p)) - Math.min(...al.notes.map((n) => n.p)) : 0;
  const song = {
    format: SONG_FORMAT, version: SONG_VERSION, id: a.id, title: a.title || 'Importovaná píseň', subtitle: a.artist || '', source: 'import',
    level: span <= 7 ? 1 : span <= 9 ? 2 : span <= 12 ? 3 : 4, chapter: null, practices: ['importovaná píseň'],
    description: a.artist ? `${a.artist} – importovaná píseň` : 'Importovaná píseň', credits: { melody: a.artist || 'originál', lyrics: a.lyricsSource || '' },
    tempo, meter: [bpb, 4], key: { tonic: ROOT[keyInfo.tonic], mode: keyInfo.mode },
    sections: [
      ...(introEnd > 0 ? [{ type: 'intro', name: 'Předehra', start: 0, end: introEnd }] : []),
      { type: 'verse', name: 'Píseň', start: introEnd, end: songLen - bpb },
      { type: 'outro', name: 'Dohra', start: songLen - bpb, end: songLen },
    ],
    notes: al.notes.map(({ time, endTime, ...n }) => n), chords, lyrics: al.lyrics, phrases: al.phrases, length: songLen,
    timing: { type: 'beatmap', zeroBeat: zero, beats: a.beats.map((t, i) => ({ beat: i - zero, time: Math.round(t * 1000) / 1000 })) },
    audio: a.stems || null,
    analysis: { tempoBpm: tempo, meter: bpb, notes: al.notes.length, lyricsSource: a.lyricsSource || null, duration: a.duration },
  };
  // poslední akord = tónika (píseň má končit doma)
  const tonicSym = ROOT[keyInfo.tonic] + (keyInfo.mode === 'minor' ? 'm' : '');
  if (song.chords.length) song.chords[song.chords.length - 1].sym = tonicSym;
  return song;
}

/** Celý rozbor z PCM (mono, 22,05 kHz doporučeno). vocalFrames dodá detektor výšky. */
export function analyzeRhythmAndHarmony(mixMono, instMono, sr) {
  const { env, fps, nFft, hop } = onsetEnvelope(mixMono, sr);
  let bpm = estimateTempo(env, fps);
  // preferuj rozsah 60–150 BPM
  while (bpm > 150) bpm /= 2;
  while (bpm < 60) bpm *= 2;
  // obálka se počítá z počátku okna → posun na skutečný čas nástupu
  const shift = (nFft / 2 + hop / 2) / sr;
  const rawBeats = trackBeats(env, fps, bpm);
  const accent = rawBeats.map((b) => { const i = Math.round(b * fps); let m = 0; for (let k = i - 2; k <= i + 2; k++) m = Math.max(m, env[k] || 0); return m; });
  const beats = rawBeats.map((b) => b + shift);
  const { chroma, bass, energy } = beatChroma(instMono, sr, beats);
  const lowAcc = bassAccent(mixMono, sr, beats);
  const m = detectMeter(accent, chroma, bass, lowAcc);
  const chordsPerBeat = recognizeChords(chroma, bass, energy, { meter: m.meter, downbeat: m.phase });
  const total = chroma.reduce((acc, c) => { for (let k = 0; k < 12; k++) acc[k] += c[k]; return acc; }, new Float64Array(12));
  return { bpm, beats, meter: m.meter, downbeat: m.phase, chordsPerBeat, chromaTotal: Array.from(total) };
}

export { parseChord, pc };
