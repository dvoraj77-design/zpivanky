// Generátor doprovodu z akordů: klavírní akordy, rozložené akordy, kytarové brnkání, basa, jemný rytmus.
import { parseChord } from './music.js';

export const STYLES = {
  piano: 'Klavírní akordy',
  arpeggio: 'Rozložené akordy (klavír)',
  guitar: 'Kytara (brnkání)',
  nylon: 'Klasická kytara (prsty)',
  strings: 'Smyčce (držené akordy)',
  organ: 'Varhany',
  band: 'Kapela (klavír, basa, bicí)',
  none: 'Bez doprovodu',
};

export const INSTRUMENT_RANGES = {
  piano: [21, 108], guitar: [40, 79], bass: [28, 60], guide: [24, 96], drum: [0, 127],
  nylon: [40, 88], violin: [55, 100], cello: [36, 76], organ: [24, 96], flute: [60, 96], clarinet: [50, 91], sax: [49, 81],
};
/** Role události doprovodu → sběrnice mixu (akordy, basa, bicí). */
export const roleOf = (e) => e.role || (e.inst === 'bass' ? 'bass' : e.inst === 'drum' ? 'drums' : 'chords');

function voiceChord(pcs, prev, lo = 55, hi = 72) {
  // všechny kombinace oktáv pro jednotlivé tóny v rozsahu, vyber nejbližší k předchozímu
  const opts = pcs.map((p) => { const a = []; for (let m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === p) a.push(m); return a; });
  let best = null, bestCost = Infinity;
  const target = prev && prev.length ? prev : [60, 64, 67];
  const tc = target.reduce((a, b) => a + b, 0) / target.length;
  const rec = (i, acc) => {
    if (i === opts.length) {
      const s = acc.slice().sort((a, b) => a - b);
      if (s[s.length - 1] - s[0] > 12) return; // sevřená poloha
      for (let k = 1; k < s.length; k++) if (s[k] === s[k - 1]) return;
      const c = s.reduce((a, b) => a + b, 0) / s.length;
      let cost = Math.abs(c - tc) * 1.5;
      if (prev && prev.length) for (const m of s) cost += Math.min(...prev.map((q) => Math.abs(q - m))) * 0.5;
      if (cost < bestCost) { bestCost = cost; best = s; }
      return;
    }
    for (const m of opts[i]) { acc.push(m); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return best || pcs.map((p) => 60 + p);
}

function bassNote(pcRoot, prev, lo = 36, hi = 50) {
  let best = null;
  for (let m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === pcRoot) {
    if (best == null || Math.abs(m - (prev ?? 43)) < Math.abs(best - (prev ?? 43))) best = m;
  }
  return best ?? 36 + pcRoot;
}

/**
 * Vygeneruje události doprovodu (čas v dobách).
 * @param {object} song kanonická píseň (už transponovaná)
 * @param {{style?:string, bass?:boolean, drums?:boolean}} o
 * @returns {Array<{t:number,d:number,midi:number,inst:string,vel:number}>}
 */
export function generateAccompaniment(song, o = {}) {
  const style = o.style || 'piano';
  const bassOn = o.bass !== false;
  const drums = !!o.drums;
  const ev = [];
  const bpb = song.meter[0];
  let prevVoicing = null, prevBass = null;
  const chords = song.chords.slice().sort((a, b) => a.t - b.t);
  const end = song.length ?? Math.max(...chords.map((c) => c.t + c.d));
  chords.forEach((c, ci) => {
    const ch = parseChord(c.sym);
    if (!ch) return;
    const isLast = ci === chords.length - 1;
    const voicing = voiceChord(ch.pcs.slice(0, 4), prevVoicing);
    prevVoicing = voicing;
    const bass = bassNote(ch.bass, prevBass);
    prevBass = bass;
    const segEnd = c.t + c.d;
    const beatsIn = (t) => t - Math.floor(t / bpb + 1e-9) * bpb; // pozice v taktu
    if (isLast) {
      // závěrečný akord: držet
      const hold = Math.max(c.d, bpb);
      if (style === 'none') return;
      const ci2 = { guitar: 'guitar', nylon: 'nylon', organ: 'organ' }[style];
      voicing.forEach((m) => ev.push({ t: c.t, d: hold + 1, midi: m, inst: ci2 || (style === 'strings' ? (m >= 60 ? 'violin' : 'cello') : 'piano'), vel: 0.5 }));
      const bi = style === 'strings' ? 'cello' : style === 'organ' ? 'organ' : style === 'nylon' ? 'nylon' : bassOn || style === 'band' ? 'bass' : 'piano';
      ev.push({ t: c.t, d: hold + 1, midi: bi === 'bass' ? bass : Math.max(bi === 'nylon' ? 40 : 36, bass), inst: bi, vel: bi === 'bass' ? 0.7 : 0.5, role: 'bass' });
      return;
    }
    // basa (smyčce: violoncello, varhany: pedál, klasická kytara hraje basu sama)
    const bassInst = style === 'nylon' ? null : style === 'strings' ? (bassOn ? 'cello' : null) : style === 'organ' ? (bassOn ? 'organ' : null)
      : bassOn || style === 'band' ? 'bass' : style === 'none' || style === 'guitar' ? null : 'piano';
    if (bassInst) {
      for (let t = c.t; t < segEnd - 1e-9;) {
        const pos = beatsIn(t);
        const step = bpb === 4 ? (pos < 2 ? 2 - pos : 4 - pos) : bpb - pos;
        const d = Math.min(step, segEnd - t);
        const isSecondHalf = bpb === 4 && Math.abs(pos - 2) < 1e-9 && t > c.t + 1e-9;
        const fifth = ch.intervals.includes(7) ? bass + 7 : bass;
        const m = isSecondHalf ? (fifth <= 52 ? fifth : bass) : bass;
        const low = bassInst === 'cello' || bassInst === 'organ' ? Math.max(36, m) : m;
        if (style === 'band' && bpb === 4 && d >= 2 - 1e-9) {
          // kapela: basa na 1 a „a“ za druhou dobou
          ev.push({ t, d: 1.4, midi: low, inst: bassInst, vel: 0.78, role: 'bass' });
          ev.push({ t: t + 1.5, d: 0.45, midi: low, inst: bassInst, vel: 0.6, role: 'bass' });
        } else ev.push({ t, d: d * 0.95, midi: low, inst: bassInst, vel: bassOn || style === 'band' ? 0.75 : 0.45, role: 'bass' });
        t += d;
      }
    }
    if (style === 'piano') {
      if (bpb === 3) {
        for (let t = c.t; t < segEnd - 1e-9; t += 1) {
          const pos = beatsIn(t);
          if (pos < 1e-9 && bassInst) continue; // na 1. době jen basa (valčík)
          voicing.forEach((m) => ev.push({ t, d: 0.9, midi: m, inst: 'piano', vel: 0.4 }));
        }
      } else {
        const step = bpb === 2 ? 1 : 2;
        for (let t = c.t; t < segEnd - 1e-9;) {
          const pos = beatsIn(t);
          const next = Math.min(segEnd, t + (step - (pos % step) || step));
          voicing.forEach((m) => ev.push({ t, d: (next - t) * 0.95, midi: m, inst: 'piano', vel: 0.42 }));
          t = next;
        }
      }
    } else if (style === 'strings' || style === 'organ') {
      // držené akordy po celou dobu akordu
      const inst = style === 'organ' ? 'organ' : null;
      voicing.forEach((m) => ev.push({ t: c.t, d: c.d * 0.98, midi: m, inst: inst || (m >= 60 ? 'violin' : 'cello'), vel: style === 'organ' ? 0.36 : 0.42 }));
    } else if (style === 'nylon') {
      // prstoklad: basa na těžké době, akordové tóny v osminách
      const root = bass < 40 ? bass + 12 : bass;
      const fifthB = ch.intervals.includes(7) && root + 7 <= 52 ? root + 7 : root;
      const top = voicing.filter((m) => m > root + 7).slice(-3);
      const tones = top.length >= 2 ? top : voicing.slice(-3);
      const pat = bpb === 3 ? [['b', 0], [0, 0.5], [1, 1], [2, 1.5], [1, 2], [0, 2.5]]
        : bpb === 2 ? [['b', 0], [0, 0.5], [1, 1], [2, 1.5]]
          : [['b', 0], [0, 0.5], [1, 1], [2, 1.5], ['f', 2], [0, 2.5], [1, 3], [2, 3.5]];
      for (let barT = Math.floor(c.t / bpb) * bpb; barT < segEnd - 1e-9; barT += bpb) {
        for (const [what, off] of pat) {
          const t = barT + off;
          if (t < c.t - 1e-9 || t >= segEnd - 1e-9) continue;
          if (what === 'b' || what === 'f') ev.push({ t, d: Math.min(2, segEnd - t), midi: what === 'b' ? root : fifthB, inst: 'nylon', vel: 0.55, role: 'bass' });
          else ev.push({ t, d: Math.min(1.5, segEnd - t), midi: tones[Math.min(what, tones.length - 1)], inst: 'nylon', vel: 0.38 });
        }
      }
    } else if (style === 'band') {
      // kapela: klavír na 1, „a“ za dvojkou a na 3 (4/4), jinak na doby
      const hits = bpb === 4 ? [0, 1.5, 2, 3.5] : bpb === 3 ? [0, 1, 2] : [0, 1];
      for (let barT = Math.floor(c.t / bpb) * bpb; barT < segEnd - 1e-9; barT += bpb) {
        hits.forEach((off, k) => {
          const t = barT + off;
          if (t < c.t - 1e-9 || t >= segEnd - 1e-9) return;
          const next = hits[k + 1] != null ? barT + hits[k + 1] : barT + bpb;
          voicing.forEach((m) => ev.push({ t, d: Math.min(next, segEnd) - t - 0.05, midi: m, inst: 'piano', vel: off % 1 ? 0.34 : 0.4 }));
        });
      }
    } else if (style === 'arpeggio') {
      const i3 = ch.intervals[1], i5 = ch.intervals[2] ?? 7;
      const r = bass + 12 <= 55 ? bass + 12 : bass;
      const tones = [r, r + i5, r + 12, r + 12 + i3, r + 12 + i5];
      const pat = bpb === 3 ? [0, 1, 2, 3, 2, 1] : [0, 1, 2, 3, 4, 3, 2, 1];
      for (let t = c.t; t < segEnd - 1e-9; t += 0.5) {
        const pos = beatsIn(t);
        const idx = pat[Math.round(pos * 2) % pat.length];
        ev.push({ t, d: Math.max(0.5, segEnd - t), midi: tones[idx], inst: 'piano', vel: idx === 0 ? 0.45 : 0.33 });
      }
    } else if (style === 'guitar') {
      // kytarový akord: basa + 5 strun v otevřené poloze
      const root = bass < 40 ? bass + 12 : bass;
      const gv = [root, root + (ch.intervals[2] ?? 7), root + 12, ...voicing.filter((m) => m > root + 12 && m <= 76)].slice(0, 6);
      const pattern = bpb === 3 ? [[0, 'D'], [1, 'D'], [1.5, 'U'], [2, 'D'], [2.5, 'U']]
        : bpb === 2 ? [[0, 'D'], [1, 'D'], [1.5, 'U']]
          : [[0, 'D'], [1, 'D'], [1.5, 'U'], [2.5, 'U'], [3, 'D'], [3.5, 'U']];
      for (let barT = Math.floor(c.t / bpb) * bpb; barT < segEnd - 1e-9; barT += bpb) {
        for (const [off, dir] of pattern) {
          const t = barT + off;
          if (t < c.t - 1e-9 || t >= segEnd - 1e-9) continue;
          const strings = dir === 'D' ? gv : gv.slice(-4).reverse();
          const d = Math.min(segEnd - t, 1.5);
          strings.forEach((m, k) => ev.push({ t: t + k * 0.022, d, midi: m, inst: 'guitar', vel: dir === 'D' ? (k === 0 ? 0.5 : 0.42) : 0.28 }));
        }
      }
    }
  });
  if ((drums || style === 'band') && style !== 'none') {
    for (let t = 0; t < end - 1e-9; t += 0.5) {
      const pos = t % bpb;
      if (Math.abs(pos) < 1e-9 || (bpb === 4 && Math.abs(pos - 2) < 1e-9)) ev.push({ t, d: 0.3, midi: 36, inst: 'drum', vel: 0.6 });
      if (bpb === 4 && (Math.abs(pos - 1) < 1e-9 || Math.abs(pos - 3) < 1e-9)) ev.push({ t, d: 0.2, midi: 38, inst: 'drum', vel: 0.3 });
      ev.push({ t, d: 0.1, midi: 42, inst: 'drum', vel: Math.abs(pos % 1) < 1e-9 ? 0.18 : 0.1 });
    }
  }
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

/** Vodicí melodie (Singer ON). */
export function guideEvents(song, inst = 'guide') {
  return song.notes.map((n) => ({ t: n.t, d: n.d * 0.97, midi: n.p, inst, vel: 0.7 }));
}

/** Kliky metronomu (doba 1 zvýrazněná). */
export function metronomeEvents(fromBeat, toBeat, bpb) {
  const ev = [];
  for (let b = Math.ceil(fromBeat - 1e-9); b < toBeat - 1e-9; b++) ev.push({ t: b, d: 0.05, midi: b % bpb === 0 ? 84 : 77, inst: 'click', vel: b % bpb === 0 ? 0.9 : 0.6 });
  return ev;
}
