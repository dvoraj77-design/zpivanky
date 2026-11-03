// Uložení pokusu: pokrok, historie, nahrávka do archivu (s prořezáváním).
import { db } from '../store/db.js';
import { state, saveProgress } from '../state.js';
import { recordAttempt, isUnlocked } from '../core/progress.js';
import { ALL_LESSONS } from '../data/course.js';

const MAX_RECORDINGS = 60;

export async function saveAttempt(result, { type, id, title, opts, mode, shift, factor }) {
  const p = state.progress;
  const nextIdx = type === 'lesson' ? ALL_LESSONS.findIndex((l) => l.id === id) + 1 : -1;
  const wasLocked = nextIdx > 0 && nextIdx < ALL_LESSONS.length && !isUnlocked(p, ALL_LESSONS[nextIdx].id);
  const badges = recordAttempt(p, { type, id, score: result.overall, stars: result.stars, seconds: result.seconds || 0, notes: result.notes, mode, shift });
  await saveProgress();
  const date = new Date().toISOString();
  const attempt = { itemId: id, type, title, date, score: result.overall, stars: result.stars, pitch: result.pitch ?? null, rhythm: result.rhythm ?? null, mode: mode || null, shift: shift ?? null, factor: factor ?? 1, tip: result.tip };
  try { attempt.id = await db.putAttempt(attempt); } catch (e) { console.warn(e); }
  if (result.recording && state.settings.saveRecordings) {
    const rid = 'r' + Date.now();
    try {
      await db.putRecording({
        id: rid, date, type, itemId: id, title, score: result.overall, mode: mode || null, shift: shift ?? 0, factor: factor ?? 1,
        rate: result.recording.rate, offset: result.recording.offset, latency: result.recording.latency, pcm: result.recording.pcm,
        frames: result.frames, opts: slimOpts(opts), starred: false, duration: result.recording.pcm.length / result.recording.rate,
      });
      result.recordingId = rid;
      await pruneRecordings();
    } catch (e) { console.warn('Nahrávku se nepodařilo uložit', e); }
  }
  const unlocked = wasLocked && isUnlocked(p, ALL_LESSONS[nextIdx].id) ? ALL_LESSONS[nextIdx].title : null;
  return { badges, unlocked };
}

function slimOpts(o) {
  if (!o) return null;
  return { items: o.items.map(({ note, ...i }) => i), audio: o.audio, tempo: o.tempo, factor: o.factor || 1, countIn: o.countIn, bpb: o.bpb, tol: o.tol, keyPc: o.keyPc };
}

export async function pruneRecordings() {
  const list = await db.listRecordings();
  if (list.length <= MAX_RECORDINGS) return;
  const removable = list.filter((r) => !r.starred).sort((a, b) => a.date.localeCompare(b.date));
  for (const r of removable.slice(0, list.length - MAX_RECORDINGS)) await db.deleteRecording(r.id);
}
