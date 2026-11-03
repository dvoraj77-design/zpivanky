// Záloha a obnova jedním souborem. Pracuje s abstraktním úložištěm (IndexedDB v prohlížeči, paměť v testech).
export const BACKUP_FORMAT = 'zpivanky-backup';
export const BACKUP_VERSION = 1;

function toB64(u8) {
  if (typeof Buffer !== 'undefined') return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const s = atob(b64); const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/**
 * store: { getKV(key), setKV(key, val), allKV(), listSongs(), putSong(s), listAttempts(), putAttempt(a), listRecordings(), getRecording(id), putRecording(r), clearAll() }
 */
export async function createBackup(store, { includeRecordings = false, settings = {} } = {}) {
  const kv = await store.allKV();
  const data = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), app: 'Zpívánky',
    settings, kv, songs: await store.listSongs(), attempts: await store.listAttempts(), recordings: [],
  };
  if (includeRecordings) {
    for (const meta of await store.listRecordings()) {
      const r = await store.getRecording(meta.id);
      if (!r) continue;
      const pcm = r.pcm instanceof Int16Array ? r.pcm : new Int16Array(r.pcm);
      data.recordings.push({ ...r, pcm: undefined, pcmB64: toB64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)) });
    }
  }
  return data;
}

export function validateBackup(data) {
  const errs = [];
  if (!data || typeof data !== 'object') return ['Soubor není záloha Zpívánek.'];
  if (data.format !== BACKUP_FORMAT) errs.push('Soubor není záloha Zpívánek.');
  if (!(data.version >= 1 && data.version <= BACKUP_VERSION)) errs.push('Neznámá verze zálohy.');
  if (!data.kv || typeof data.kv !== 'object') errs.push('V záloze chybí data.');
  return errs;
}

export async function restoreBackup(store, data, { replace = true } = {}) {
  const errs = validateBackup(data);
  if (errs.length) throw new Error(errs.join(' '));
  if (replace) await store.clearAll();
  for (const [k, v] of Object.entries(data.kv)) await store.setKV(k, v);
  for (const s of data.songs || []) await store.putSong(s);
  for (const a of data.attempts || []) await store.putAttempt(a);
  for (const r of data.recordings || []) {
    const u8 = fromB64(r.pcmB64);
    const pcm = new Int16Array(u8.buffer, u8.byteOffset, u8.byteLength / 2);
    const { pcmB64, ...rest } = r;
    await store.putRecording({ ...rest, pcm });
  }
  return { settings: data.settings || {}, counts: { songs: (data.songs || []).length, attempts: (data.attempts || []).length, recordings: (data.recordings || []).length } };
}

/** Úložiště v paměti (testy). */
export function memoryStore() {
  const kv = new Map(), songs = new Map(), attempts = new Map(), recs = new Map();
  let aid = 1;
  return {
    async getKV(k) { return kv.has(k) ? structuredClone(kv.get(k)) : undefined; },
    async setKV(k, v) { kv.set(k, structuredClone(v)); },
    async allKV() { return Object.fromEntries([...kv.entries()].map(([k, v]) => [k, structuredClone(v)])); },
    async listSongs() { return [...songs.values()]; },
    async putSong(s) { songs.set(s.id, structuredClone(s)); },
    async deleteSong(id) { songs.delete(id); },
    async listAttempts() { return [...attempts.values()]; },
    async putAttempt(a) { const id = a.id ?? aid++; attempts.set(id, { ...a, id }); return id; },
    async listRecordings() { return [...recs.values()].map(({ pcm, ...m }) => m); },
    async getRecording(id) { return recs.get(id); },
    async putRecording(r) { recs.set(r.id, r); },
    async deleteRecording(id) { recs.delete(id); },
    async clearAll() { kv.clear(); songs.clear(); attempts.clear(); recs.clear(); },
  };
}
