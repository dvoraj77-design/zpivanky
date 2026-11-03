// Hodnocení zpěvu: po notách, po frázích, celkově; konkrétní zpětná vazba česky.
import { foldCents, median, mean, stdev, clamp } from './music.js';

export const STRICTNESS = {
  beginner: { tol: 50, label: 'Začátečník (±50 centů)' },
  advanced: { tol: 25, label: 'Pokročilý (±25 centů)' },
  pro: { tol: 10, label: 'Profi (±10 centů)' },
};

export function gradeLabel(score) {
  if (score >= 90) return 'Výborně';
  if (score >= 75) return 'Dobře';
  if (score >= 55) return 'Ujde to';
  if (score >= 30) return 'Zkus znovu';
  return 'Nevyšlo';
}
export function starsFor(score) { return score >= 85 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0; }

/**
 * Ohodnotí tónové cíle.
 * @param {Array<{start:number,end:number,midi:number,kind?:'note'|'glide',toMidi?:number,phrase?:number,syl?:string,checkOnset?:boolean}>} targets čas v s
 * @param {Array<{t:number,midi:number|null,voiced:boolean,db?:number,onset?:boolean}>} frames čas v s (už po korekci zpoždění)
 * @param {{tol?:number, octaveFree?:boolean}} opts
 */
export function scorePitchTargets(targets, frames, opts = {}) {
  const tol = opts.tol ?? 50;
  const octaveFree = opts.octaveFree ?? true;
  const res = [];
  let fi = 0;
  const sorted = frames;
  for (let i = 0; i < targets.length; i++) {
    const tg = targets[i];
    const dur = tg.end - tg.start;
    const isGlide = tg.kind === 'glide';
    const attack = isGlide ? 0.08 : Math.min(0.15, dur * 0.25);
    const from = tg.start + attack, to = tg.end - Math.min(0.05, dur * 0.1);
    while (fi < sorted.length && sorted[fi].t < tg.start - 0.4) fi++;
    let total = 0, voiced = 0, inTune = 0;
    const devs = [], sung = [];
    for (let j = fi; j < sorted.length && sorted[j].t <= to; j++) {
      const f = sorted[j];
      if (f.t < from) continue;
      total++;
      if (!f.voiced || f.midi == null) continue;
      voiced++;
      const target = isGlide ? tg.midi + (tg.toMidi - tg.midi) * clamp((f.t - tg.start) / dur, 0, 1) : tg.midi;
      let c = (f.midi - target) * 100;
      if (octaveFree) c = foldCents(c);
      devs.push(c);
      sung.push(f.midi);
      if (Math.abs(c) <= tol * (isGlide ? 2 : 1)) inTune++;
    }
    // nástup: první hlasový rámec v okolí začátku, který se blíží cíli
    let onsetDelay = null;
    const prev = targets[i - 1];
    const legatoSame = prev && tg.start - prev.end < 0.15 && Math.abs(prev.midi - tg.midi) < 0.5;
    const searchFrom = prev && prev.end > tg.start - 0.3 ? Math.max(tg.start - 0.3, prev.end - 0.02) : tg.start - 0.3;
    if (tg.checkOnset !== false && !legatoSame && !isGlide) {
      for (let j = fi; j < sorted.length && sorted[j].t <= tg.start + Math.min(0.6, dur); j++) {
        const f = sorted[j];
        if (f.t < searchFrom) continue;
        if (!f.voiced || f.midi == null) continue;
        let c = (f.midi - tg.midi) * 100;
        if (octaveFree) c = foldCents(c);
        if (Math.abs(c) <= Math.max(150, tol * 3)) { onsetDelay = f.t - tg.start; break; }
      }
      // pokud zpěvák už zněl na stejném tónu před začátkem (předchozí nota stejná), nástup nehodnotíme
      if (onsetDelay != null && onsetDelay <= -0.29) onsetDelay = null;
    }
    const coverage = total ? voiced / total : 0;
    const medDev = devs.length ? median(devs) : null;
    const sd = devs.length > 2 ? stdev(devs) : 0;
    const inTuneRatio = total ? inTune / total : 0;
    let status;
    if (coverage < 0.25 || medDev == null) status = 'missed';
    else if (medDev < -tol) status = 'low';
    else if (medDev > tol) status = 'high';
    else status = 'ok';
    const accScore = medDev == null ? 0 : clamp(100 - (Math.max(0, Math.abs(medDev) - tol / 2) / (tol * 2.5)) * 100, 0, 100);
    const timingScore = onsetDelay == null ? 100 : clamp(100 - ((Math.abs(onsetDelay) - 0.08) / 0.32) * 100, 0, 100);
    const pitchScore = 100 * (0.7 * inTuneRatio + 0.3 * (accScore / 100) * coverage);
    let score = 0.6 * inTuneRatio * 100 + 0.25 * accScore * coverage + 0.15 * timingScore * (coverage > 0.25 ? 1 : 0);
    if (status === 'missed') score = Math.min(score, 20);
    res.push({
      i, phrase: tg.phrase ?? 0, syl: tg.syl, midi: tg.midi, start: tg.start, end: tg.end, kind: tg.kind || 'note',
      status, medDev, sd, coverage, inTuneRatio, onsetDelay, score: Math.round(clamp(score, 0, 100)),
      pitchScore: Math.round(clamp(pitchScore, 0, 100)), timingScore: Math.round(timingScore),
      sungMidi: sung.length ? median(sung) : null,
    });
  }
  return res;
}

/** Souhrn: celkové skóre, fráze, přesnost výšky, rytmus, rada. */
export function summarize(noteResults, opts = {}) {
  const tol = opts.tol ?? 50;
  const w = (n) => Math.max(0.1, n.end - n.start);
  const wsum = noteResults.reduce((a, n) => a + w(n), 0) || 1;
  const overall = Math.round(noteResults.reduce((a, n) => a + n.score * w(n), 0) / wsum);
  const pitch = Math.round(noteResults.reduce((a, n) => a + n.pitchScore * w(n), 0) / wsum);
  const timed = noteResults.filter((n) => n.onsetDelay != null);
  const rhythm = timed.length ? Math.round(mean(timed.map((n) => n.timingScore))) : null;
  const phrases = [];
  for (const n of noteResults) {
    let p = phrases.find((x) => x.index === n.phrase);
    if (!p) { p = { index: n.phrase, notes: [], score: 0 }; phrases.push(p); }
    p.notes.push(n);
  }
  for (const p of phrases) {
    const ws = p.notes.reduce((a, n) => a + w(n), 0) || 1;
    p.score = Math.round(p.notes.reduce((a, n) => a + n.score * w(n), 0) / ws);
    p.start = Math.min(...p.notes.map((n) => n.start));
    p.end = Math.max(...p.notes.map((n) => n.end));
    p.label = p.notes.map((n) => n.syl).filter(Boolean).join(' ').replace(/- /g, '');
  }
  phrases.sort((a, b) => a.index - b.index);
  return { overall, pitch, rhythm, phrases, tip: tipFor(noteResults, tol), label: gradeLabel(overall), stars: starsFor(overall) };
}

export function centsText(c) {
  const a = Math.round(Math.abs(c));
  if (a < 5) return 'přesně';
  return c < 0 ? `o ${a} centů níž` : `o ${a} centů výš`;
}

/** Jedna nejdůležitější rada. */
export function tipFor(notes, tol = 50, nameFn = null) {
  if (!notes.length) return 'Zkus to znovu.';
  const missed = notes.filter((n) => n.status === 'missed').length / notes.length;
  if (missed > 0.5) return 'Většinu tónů jsem neslyšel. Zpívej nahlas a celou délku tónu; zkontroluj mikrofon v Já → Zvuk.';
  const devs = notes.filter((n) => n.medDev != null).map((n) => n.medDev);
  const avg = devs.length ? mean(devs) : 0;
  const delays = notes.filter((n) => n.onsetDelay != null).map((n) => n.onsetDelay);
  const avgDelay = delays.length >= 2 ? median(delays) : 0;
  const sds = notes.filter((n) => n.medDev != null).map((n) => n.sd);
  const avgSd = sds.length ? mean(sds) : 0;
  const issues = [];
  if (Math.abs(avg) > Math.max(12, tol * 0.4)) {
    issues.push({ w: Math.abs(avg) / tol, text: avg < 0
      ? `Celkově zpíváš ${centsText(avg)}. Mysli na tón o kousek výš a drž oporu dechu až do konce.`
      : `Celkově zpíváš ${centsText(avg)}. Uvolni hrdlo a netlač – tón přijde sám.` });
  }
  if (Math.abs(avgDelay) > 0.12) {
    const ms = Math.round(Math.abs(avgDelay) * 1000);
    issues.push({ w: Math.abs(avgDelay) / 0.15, text: avgDelay > 0
      ? `Nástupy jsou asi o ${ms} ms pozdě. Nadechni se o dobu dřív a nastup přesně s dobou.`
      : `Nástupy předbíháš asi o ${ms} ms. Počkej na dobu – poslouchej metronom.` });
  }
  if (avgSd > Math.max(15, tol * 0.6)) {
    issues.push({ w: avgSd / tol, text: 'Tón kolísá. Drž stálý proud vzduchu a nehýbej čelistí během tónu.' });
  }
  const worst = notes.filter((n) => n.medDev != null).sort((a, b) => Math.abs(b.medDev) - Math.abs(a.medDev))[0];
  if (worst && Math.abs(worst.medDev) > tol) {
    issues.push({ w: Math.abs(worst.medDev) / tol * 0.8, text: `Nejvíc ti ujíždí tón „${worst.syl || 'č. ' + (worst.i + 1)}“ (${centsText(worst.medDev)}). Zazpívej si ho zvlášť s ladičkou.` });
  }
  if (!issues.length) {
    if (missed > 0.15) return 'Pár tónů chybělo – zpívej každou notu celou délku.';
    return 'Výborně! Zkus přísnější hodnocení nebo rychlejší tempo.';
  }
  issues.sort((a, b) => b.w - a.w);
  return issues[0].text;
}

// ---------- Rytmus ----------
/** onsets: časy nástupů (s, po korekci zpoždění), targets: [{start}] */
export function scoreRhythm(targets, onsets, opts = {}) {
  const win = opts.window ?? 0.25;
  const used = new Set();
  const res = targets.map((tg, i) => {
    let best = null, bi = -1;
    onsets.forEach((o, j) => {
      if (used.has(j)) return;
      const d = o - tg.start;
      if (Math.abs(d) <= win && (best == null || Math.abs(d) < Math.abs(best))) { best = d; bi = j; }
    });
    if (bi >= 0) used.add(bi);
    const score = best == null ? 0 : clamp(100 - ((Math.abs(best) - 0.05) / 0.2) * 100, 0, 100);
    return { i, start: tg.start, end: tg.end, delay: best, status: best == null ? 'missed' : Math.abs(best) <= 0.08 ? 'ok' : best > 0 ? 'late' : 'early', score: Math.round(score), phrase: tg.phrase ?? 0, syl: tg.syl };
  });
  const extra = onsets.length - used.size;
  const base = res.length ? mean(res.map((r) => r.score)) : 0;
  const overall = Math.round(clamp(base - extra * 5, 0, 100));
  const delays = res.filter((r) => r.delay != null).map((r) => r.delay);
  const md = delays.length ? median(delays) : 0;
  let tip;
  if (res.filter((r) => r.status === 'missed').length > res.length / 2) tip = 'Většinu nástupů jsem nezachytil – zpívej „pa“ krátce a zřetelně.';
  else if (md > 0.08) tip = `Nástupy jsou v průměru o ${Math.round(md * 1000)} ms pozdě. Nadechni se předem a „pa“ vyslov přesně na dobu.`;
  else if (md < -0.08) tip = `Předbíháš o ${Math.round(-md * 1000)} ms. Poslouchej klik a nastup s ním, ne před ním.`;
  else if (extra > 2) tip = 'Zpíváš i tam, kde je pauza. Pauzy jsou součást rytmu.';
  else tip = 'Rytmus sedí! Zkus vyšší tempo.';
  return { notes: res, overall, label: gradeLabel(overall), stars: starsFor(overall), tip, medianDelay: md, extra };
}

// ---------- Dynamika ----------
/** target: [{t, rel}] relativní hlasitost v dB (0 = tvá normální), frames: [{t, db, voiced}] */
export function scoreDynamics(targetFn, frames, start, end, refDb) {
  const pts = frames.filter((f) => f.t >= start && f.t <= end && (f.voiced || f.hiss));
  if (pts.length < 10) return { overall: 0, label: gradeLabel(0), stars: 0, tip: 'Neslyšel jsem tě – zpívej po celou dobu.', curve: [] };
  // vyhlazení
  const sm = [];
  for (let i = 0; i < pts.length; i++) {
    const a = Math.max(0, i - 5), b = Math.min(pts.length, i + 6);
    let s = 0; for (let j = a; j < b; j++) s += pts[j].db;
    sm.push({ t: pts[i].t, db: s / (b - a) });
  }
  const meas = sm.map((p) => p.db - refDb);
  const targ = sm.map((p) => targetFn(p.t));
  const mm = mean(meas), mt = mean(targ);
  const err = mean(meas.map((m, i) => Math.abs((m - mm) - (targ[i] - mt))));
  const rangeT = Math.max(...targ) - Math.min(...targ);
  const rangeM = Math.max(...meas) - Math.min(...meas);
  // korelace
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < meas.length; i++) { const x = meas[i] - mm, y = targ[i] - mt; num += x * y; da += x * x; db += y * y; }
  const corr = da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
  const coverage = pts.length / Math.max(1, frames.filter((f) => f.t >= start && f.t <= end).length);
  let score = rangeT > 1 ? 100 * (0.5 * clamp(corr, 0, 1) + 0.3 * clamp(rangeM / rangeT, 0, 1) + 0.2 * clamp(1 - err / 10, 0, 1)) : 100 * clamp(1 - err / 6, 0, 1);
  score *= clamp(coverage * 1.2, 0, 1);
  score = Math.round(clamp(score, 0, 100));
  let tip;
  if (rangeT > 1 && rangeM < rangeT * 0.5) tip = 'Rozdíl mezi tichým a silným je malý. Začni opravdu potichu a přidávej dechem, ne tlakem v krku.';
  else if (rangeT > 1 && corr < 0.5) tip = 'Hlasitost nesleduje křivku. Sleduj žlutý pás a měň sílu plynule.';
  else if (rangeT <= 1 && err > 3) tip = 'Hlasitost kolísá. Drž stálý proud vzduchu.';
  else tip = 'Pěkně ovládáš sílu hlasu!';
  return { overall: score, label: gradeLabel(score), stars: starsFor(score), tip, corr, rangeM, rangeT, curve: sm.map((p, i) => ({ t: p.t, rel: meas[i], target: targ[i] })) };
}

// ---------- Dech („sss“) ----------
export function breathDuration(frames, start, end, { maxGap = 0.35 } = {}) {
  let best = 0, curStart = null, lastOn = null;
  for (const f of frames) {
    if (f.t < start || f.t > end) continue;
    const on = f.hiss || f.voiced;
    if (on) {
      if (curStart == null || f.t - lastOn > maxGap) curStart = f.t;
      lastOn = f.t;
      best = Math.max(best, lastOn - curStart);
    }
  }
  return best;
}
export function scoreBreath(frames, start, end, targetSec) {
  const dur = breathDuration(frames, start, end);
  const on = frames.filter((f) => f.t >= start && f.t <= end && (f.hiss || f.voiced));
  const dbs = on.map((f) => f.db);
  const sd = dbs.length > 5 ? stdev(dbs) : 0;
  const lenScore = clamp((dur / targetSec) * 100, 0, 100);
  const stab = clamp(100 - Math.max(0, sd - 1.5) * 12, 0, 100);
  const overall = Math.round(0.75 * lenScore + 0.25 * stab * (dur > 1 ? 1 : 0));
  const tip = dur < targetSec * 0.6
    ? 'Výdech byl krátký. Nadechni se do břicha a boků a pouštěj vzduch pomalu, jako by ses bál sfouknout svíčku.'
    : sd > 4 ? 'Proud vzduchu kolísá. Drž „sss“ rovnoměrné – pomůže mírně držet žebra roztažená.'
      : dur >= targetSec ? 'Skvělá výdrž i stabilita!' : 'Dobře, ještě kousek do cíle – zkus delší, klidný nádech.';
  return { overall, duration: dur, stability: Math.round(stab), sd, label: gradeLabel(overall), stars: starsFor(overall), tip };
}
