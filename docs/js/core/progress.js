// Pokrok: odemykání lekcí, hvězdičky, série dní, minuty, statistiky not a intervalů, odznaky, denní plán.
import { ALL_LESSONS, CHAPTERS, WARMUPS } from '../data/course.js';
import { noteName, INTERVAL_SHORT } from './music.js';

export function emptyProgress() {
  return { version: 1, lessons: {}, songs: {}, theory: {}, days: {}, noteStats: {}, intervalStats: {}, history: [], badges: {}, games: {}, dailyGoal: 10, unlockedTo: null };
}

export const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export function lessonState(p, id) { return p.lessons[id] || { stars: 0, best: 0, attempts: 0 }; }

/** Lekce je odemčená, když je první, předchozí má aspoň 1★, nebo byla přeskočena / ručně odemčena. */
export function isUnlocked(p, lessonId) {
  const idx = ALL_LESSONS.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return true;
  if (p.lessons[lessonId]?.attempts || p.lessons[lessonId]?.skippedTo) return true;
  if (p.unlockedTo != null && idx <= p.unlockedTo) return true;
  const prev = p.lessons[ALL_LESSONS[idx - 1].id];
  return !!(prev && (prev.stars >= 1 || prev.skipped));
}

/** Přeskočit na lekci: odemkne ji i všechny před ní. */
export function skipTo(p, lessonId) {
  const idx = ALL_LESSONS.findIndex((l) => l.id === lessonId);
  p.unlockedTo = Math.max(p.unlockedTo ?? -1, idx);
  for (let i = 0; i < idx; i++) {
    const id = ALL_LESSONS[i].id;
    if (!p.lessons[id] || !(p.lessons[id].stars >= 1)) p.lessons[id] = { ...lessonState(p, id), skipped: true };
  }
  return p;
}

export function nextLesson(p) {
  for (const l of ALL_LESSONS) {
    const s = p.lessons[l.id];
    if (!s || (!(s.stars >= 1) && !s.skipped)) return l;
  }
  // vše hotové → lekce s nejméně hvězdičkami
  return ALL_LESSONS.slice().sort((a, b) => lessonState(p, a.id).stars - lessonState(p, b.id).stars)[0];
}

export function chapterProgress(p, chapterId) {
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  const stars = ch.lessons.reduce((a, l) => a + (lessonState(p, l.id).stars || 0), 0);
  const done = ch.lessons.filter((l) => lessonState(p, l.id).stars >= 1).length;
  return { stars, max: ch.lessons.length * 3, done, total: ch.lessons.length };
}

/**
 * Zapíše pokus. item: {type:'lesson'|'song'|'warmup'|'tool'|'ear', id, score, stars, seconds, notes?:[{midi, medDev, status}], date?}
 */
export function recordAttempt(p, item) {
  const date = item.date ? new Date(item.date) : new Date();
  const dk = dayKey(date);
  const day = p.days[dk] || (p.days[dk] = { seconds: 0, sessions: 0, scores: [] });
  day.seconds += item.seconds || 0;
  day.sessions += 1;
  if (item.score != null) day.scores.push(item.score);
  if (item.type === 'lesson') {
    const s = lessonState(p, item.id);
    p.lessons[item.id] = { ...s, attempts: (s.attempts || 0) + 1, best: Math.max(s.best || 0, item.score || 0), stars: Math.max(s.stars || 0, item.stars || 0), last: date.toISOString() };
  }
  if (item.type === 'song') {
    const s = p.songs[item.id] || { best: 0, attempts: 0, history: [] };
    s.attempts += 1;
    s.best = Math.max(s.best, item.score || 0);
    s.history = [...(s.history || []), { date: date.toISOString(), score: item.score, mode: item.mode, shift: item.shift }].slice(-30);
    if (item.shift != null) s.lastShift = item.shift;
    p.songs[item.id] = s;
  }
  if (item.score != null) p.history = [...p.history, { date: date.toISOString(), score: item.score, type: item.type, id: item.id }].slice(-500);
  // statistiky not a intervalů
  const notes = (item.notes || []).filter((n) => n.medDev != null && n.kind !== 'glide');
  for (const n of notes) {
    const k = String(Math.round(n.midi));
    const st = p.noteStats[k] || { n: 0, abs: 0, sum: 0 };
    st.n++; st.abs += Math.abs(n.medDev); st.sum += n.medDev;
    p.noteStats[k] = st;
  }
  for (let i = 1; i < notes.length; i++) {
    const iv = Math.round(notes[i].midi - notes[i - 1].midi);
    if (iv === 0 || Math.abs(iv) > 12) continue;
    const k = (iv > 0 ? '+' : '') + iv;
    const st = p.intervalStats[k] || { n: 0, abs: 0 };
    st.n++; st.abs += Math.abs(notes[i].medDev);
    p.intervalStats[k] = st;
  }
  const newBadges = checkBadges(p, date);
  return newBadges;
}

export function streak(p, today = new Date()) {
  let n = 0;
  const d = new Date(today);
  // dnešek se počítá, pokud už je procvičený; jinak začni od včerejška
  if (!p.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (p.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function bestStreak(p) {
  const keys = Object.keys(p.days).sort();
  let best = 0, cur = 0, prev = null;
  for (const k of keys) {
    const d = new Date(k + 'T12:00:00');
    if (prev && (d - prev) / 86400000 < 1.5) cur++; else cur = 1;
    best = Math.max(best, cur); prev = d;
  }
  return best;
}
export function minutesOn(p, date = new Date()) { return Math.round(((p.days[dayKey(date)]?.seconds) || 0) / 60); }
export function totalMinutes(p) { return Math.round(Object.values(p.days).reduce((a, d) => a + d.seconds, 0) / 60); }

/** Nejslabší noty a intervaly (nejvyšší průměrná odchylka, min. 3 vzorky). */
export function weakest(p, style = 'cz') {
  const notes = Object.entries(p.noteStats).filter(([, s]) => s.n >= 3).map(([k, s]) => ({ midi: +k, name: noteName(+k, { style: style === 'solf' ? 'cz' : style }), avg: s.abs / s.n, bias: s.sum / s.n, n: s.n })).sort((a, b) => b.avg - a.avg);
  const ints = Object.entries(p.intervalStats).filter(([, s]) => s.n >= 3).map(([k, s]) => {
    const v = +k;
    return { semi: v, name: `${INTERVAL_SHORT[Math.abs(v)]} ${v > 0 ? 'nahoru' : 'dolů'}`, avg: s.abs / s.n, n: s.n };
  }).sort((a, b) => b.avg - a.avg);
  return { notes: notes.slice(0, 5), intervals: ints.slice(0, 5) };
}

/** Průměrné skóre po týdnech (pro graf přesnosti v čase). */
export function accuracyByWeek(p) {
  const map = new Map();
  for (const h of p.history) {
    const d = new Date(h.date);
    const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = dayKey(monday);
    const e = map.get(k) || { sum: 0, n: 0 };
    e.sum += h.score; e.n++; map.set(k, e);
  }
  return [...map.entries()].sort().map(([k, e]) => ({ week: k, avg: Math.round(e.sum / e.n), n: e.n }));
}

export const BADGES = [
  { id: 'first', title: 'První tón', desc: 'Dokončil jsi první cvičení.', test: (p) => p.history.length >= 1 },
  { id: 'streak3', title: 'Tři dny v řadě', desc: 'Cvičil jsi 3 dny po sobě.', test: (p, d) => streak(p, d) >= 3 },
  { id: 'streak7', title: 'Týden zpěvu', desc: 'Cvičil jsi 7 dní po sobě.', test: (p, d) => streak(p, d) >= 7 },
  { id: 'streak30', title: 'Měsíc bez přestávky', desc: '30 dní v řadě.', test: (p, d) => streak(p, d) >= 30 },
  { id: 'min60', title: 'Hodina zpěvu', desc: 'Celkem 60 minut cvičení.', test: (p) => totalMinutes(p) >= 60 },
  { id: 'min300', title: 'Pět hodin', desc: 'Celkem 300 minut cvičení.', test: (p) => totalMinutes(p) >= 300 },
  { id: 'star3', title: 'Tři hvězdy', desc: 'Získal jsi 3★ v lekci.', test: (p) => Object.values(p.lessons).some((l) => l.stars >= 3) },
  { id: 'chapter1', title: 'Hotová kapitola', desc: 'Všechny lekce kapitoly aspoň na 1★.', test: (p) => CHAPTERS.some((c) => c.lessons.every((l) => (p.lessons[l.id]?.stars || 0) >= 1)) },
  { id: 'course', title: 'Absolvent kurzu', desc: 'Všech 50 lekcí aspoň na 1★.', test: (p) => ALL_LESSONS.every((l) => (p.lessons[l.id]?.stars || 0) >= 1) },
  { id: 'song1', title: 'První píseň', desc: 'Zazpíval jsi celou píseň.', test: (p) => Object.keys(p.songs).length >= 1 },
  { id: 'song90', title: 'Čistý zpěv', desc: 'Píseň na 90 bodů a víc.', test: (p) => Object.values(p.songs).some((s) => s.best >= 90) },
  { id: 'songs10', title: 'Repertoár', desc: '10 různých písní.', test: (p) => Object.keys(p.songs).length >= 10 },
  { id: 'goal', title: 'Splněný cíl', desc: 'Splnil jsi denní cíl minut.', test: (p, d) => minutesOn(p, d) >= (p.dailyGoal || 10) },
];

export function checkBadges(p, date = new Date()) {
  const fresh = [];
  for (const b of BADGES) if (!p.badges[b.id] && b.test(p, date)) { p.badges[b.id] = date.toISOString(); fresh.push(b); }
  return fresh;
}

/**
 * Dnešní trénink na 5 / 10 / 20 minut: rozezpívka → slabé místo → aktuální lekce → píseň (→ sluch).
 * Vrací položky {kind:'warmup'|'lesson'|'drill'|'song'|'ear', id, title, ex?, minutes}
 */
export function dailyPlan(p, minutes, songs, profile) {
  const items = [];
  const day = new Date().getDate();
  const wu = WARMUPS;
  items.push({ kind: 'warmup', id: wu[day % 2 === 0 ? 1 : 0].id, title: wu[day % 2 === 0 ? 1 : 0].title, ex: wu[day % 2 === 0 ? 1 : 0].ex, minutes: 1 });
  if (minutes >= 10) items.push({ kind: 'warmup', id: wu[2 + (day % 2)].id, title: wu[2 + (day % 2)].title, ex: wu[2 + (day % 2)].ex, minutes: 1.5 });
  const w = weakest(p);
  if (minutes >= 10 && w.intervals.length) {
    const iv = w.intervals[0].semi;
    const deg = { 1: null, 2: 2, 3: 3, 4: 3, 5: 4, 7: 5, 9: 6, 12: 8 }[Math.abs(iv)] || 3;
    const degrees = iv > 0 ? [1, deg, 1] : [deg, 1, deg];
    items.push({ kind: 'drill', id: 'drill-int', title: `Slabé místo: ${w.intervals[0].name}`, ex: { type: 'interval', degrees, durs: [1, 1, 2], reps: 4, tempo: 80, extended: true }, minutes: 1.5 });
  } else if (minutes >= 10 && w.notes.length) {
    const target = w.notes[0].midi;
    const deg = Math.max(1, Math.min(8, Math.round((target - (profile?.workingTonic ?? 48)) / 1.7) + 1));
    items.push({ kind: 'drill', id: 'drill-note', title: `Slabé místo: tón ${w.notes[0].name}`, ex: { type: 'match', degrees: [deg, deg, deg], count: 3, holdBeats: 3, tempo: 76 }, minutes: 1.5 });
  }
  const lesson = nextLesson(p);
  items.push({ kind: 'lesson', id: lesson.id, title: lesson.title, minutes: 2.5 });
  if (minutes >= 20) {
    const idx = ALL_LESSONS.findIndex((l) => l.id === lesson.id);
    const review = ALL_LESSONS.slice(0, Math.max(1, idx)).filter((l) => l.ex.type !== 'voicetest' && l.ex.type !== 'earInterval').sort((a, b) => lessonState(p, a.id).best - lessonState(p, b.id).best)[0];
    if (review && review.id !== lesson.id) items.push({ kind: 'lesson', id: review.id, title: 'Opakování: ' + review.title, minutes: 2.5 });
    items.push({ kind: 'ear', id: 'ear-mix', title: 'Sluchový trénink', ex: { type: 'earInterval', intervals: [2, 3, 4, 5, 7, 12], count: 6 }, minutes: 2 });
  }
  if (minutes >= 5 && songs?.length) {
    const lvl = Math.max(1, Math.min(4, Math.ceil((ALL_LESSONS.findIndex((l) => l.id === lesson.id) + 1) / 12.5)));
    const pool = songs.filter((s) => s.level <= lvl);
    const sorted = pool.slice().sort((a, b) => (p.songs[a.id]?.attempts || 0) - (p.songs[b.id]?.attempts || 0));
    const song = sorted[day % Math.max(1, Math.min(3, sorted.length))] || songs[0];
    items.push({ kind: 'song', id: song.id, title: song.title, minutes: minutes >= 20 ? 6 : 3 });
  }
  return items;
}
