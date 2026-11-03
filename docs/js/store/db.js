// IndexedDB úložiště: kv (profil, pokrok, nastavení…), songs (vlastní písně), attempts (pokusy), recordings (nahrávky).
const DB_NAME = 'zpivanky';
const DB_VER = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('attempts')) { const s = db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true }); s.createIndex('itemId', 'itemId'); }
      if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('recmeta')) db.createObjectStore('recmeta', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Databázi blokuje jiné okno aplikace.'));
  });
  return dbp;
}
function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const st = Array.isArray(store) ? store.map((s) => t.objectStore(s)) : t.objectStore(store);
    let result;
    Promise.resolve(fn(st)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Zápis do úložiště se nepovedl (plné úložiště?).'));
  }));
}
const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const db = {
  async getKV(k) { return tx('kv', 'readonly', (s) => req2p(s.get(k))); },
  async setKV(k, v) { return tx('kv', 'readwrite', (s) => { s.put(v, k); }); },
  async allKV() {
    return tx('kv', 'readonly', async (s) => {
      const keys = await req2p(s.getAllKeys()); const vals = await req2p(s.getAll());
      return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
    });
  },
  async listSongs() { return tx('songs', 'readonly', (s) => req2p(s.getAll())); },
  async putSong(song) { return tx('songs', 'readwrite', (s) => { s.put(song); }); },
  async deleteSong(id) { return tx('songs', 'readwrite', (s) => { s.delete(id); }); },
  async listAttempts() { return tx('attempts', 'readonly', (s) => req2p(s.getAll())); },
  async attemptsFor(itemId) { return tx('attempts', 'readonly', (s) => req2p(s.index('itemId').getAll(itemId))); },
  async putAttempt(a) { return tx('attempts', 'readwrite', (s) => req2p(s.put(a))); },
  async listRecordings() { return tx('recmeta', 'readonly', (s) => req2p(s.getAll())); },
  async getRecording(id) { return tx('recordings', 'readonly', (s) => req2p(s.get(id))); },
  async putRecording(r) {
    const { pcm, frames, ...meta } = r;
    return tx(['recordings', 'recmeta'], 'readwrite', ([a, b]) => { a.put(r); b.put({ ...meta, samples: pcm?.length || 0 }); });
  },
  async updateRecordingMeta(id, patch) {
    return tx(['recordings', 'recmeta'], 'readwrite', async ([a, b]) => {
      const r = await req2p(a.get(id)); const m = await req2p(b.get(id));
      if (r) a.put({ ...r, ...patch }); if (m) b.put({ ...m, ...patch });
    });
  },
  async deleteRecording(id) { return tx(['recordings', 'recmeta'], 'readwrite', ([a, b]) => { a.delete(id); b.delete(id); }); },
  async clearAll() { return tx(['kv', 'songs', 'attempts', 'recordings', 'recmeta'], 'readwrite', (ss) => { for (const s of ss) s.clear(); }); },
  async estimate() { try { return await navigator.storage.estimate(); } catch { return null; } },
};
