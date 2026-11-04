// Import písně v telefonu: načtení souboru / nahrávky, model pro přesné oddělení zpěvu (Cache Storage),
// rozbor ve workeru, dohledání textu (lrclib.net), sestavení a uložení písně, originální stopy pro přehrávač.
import { engine } from '../audio/engine.js';
import { db } from '../store/db.js';
import { buildImportedSong } from '../core/analysis.js';
import { parseFileName, lyricsLines, plainLines, stemShift } from '../core/importutil.js';
export { parseFileName, lyricsLines, plainLines, stemShift };
import { validateSong } from '../core/song.js';
import { saveCustomSong } from '../state.js';

const BASE = new URL('../../', import.meta.url).href;
export const MODEL_CACHE = 'zp-models-v1';
export const MODEL_FILES = [
  { path: 'vendor/ort/ort.all.bundle.min.mjs', size: 775869, type: 'text/javascript' },
  { path: 'vendor/ort/ort-wasm-simd-threaded.jsep.wasm', size: 21663894, type: 'application/wasm' },
  { path: 'models/kim-vocal-2.onnx', size: 33442087, type: 'application/octet-stream' },
];
export const MODEL_MB = Math.round(MODEL_FILES.reduce((a, f) => a + f.size, 0) / 1e6);
export const MAX_SECONDS = 8 * 60;
export const SR = 44100;

// ---------- worker ----------
let worker = null, seq = 0;
const pending = new Map();
function getWorker() {
  if (worker) return worker;
  worker = new Worker(BASE + 'js/audio/import-worker.js', { type: 'module' });
  worker.onmessage = (e) => {
    const d = e.data, p = pending.get(d.id); if (!p) return;
    if (d.type === 'progress') p.onProgress?.(d);
    else { pending.delete(d.id); if (d.type === 'done') p.resolve(d.result); else p.reject(Object.assign(new Error(d.message), { cancelled: d.cancelled })); }
  };
  worker.onerror = (e) => { const err = new Error('Chyba ve výpočtu: ' + (e.message || 'worker')); for (const p of pending.values()) p.reject(err); pending.clear(); worker = null; };
  return worker;
}
function call(msg, transfer = [], onProgress) {
  const id = ++seq;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, onProgress }); getWorker().postMessage({ ...msg, id }, transfer); });
}
/** Okamžité zrušení výpočtu (worker se ukončí, příště se vytvoří nový). */
export function cancelWork() {
  if (worker) { worker.terminate(); worker = null; }
  for (const p of pending.values()) p.reject(Object.assign(new Error('Zrušeno'), { cancelled: true }));
  pending.clear();
}
export const workerInfo = () => call({ type: 'ping' });

// ---------- model ----------
export async function modelReady() {
  try { const c = await caches.open(MODEL_CACHE); for (const f of MODEL_FILES) if (!(await c.match(BASE + f.path))) return false; return true; } catch { return false; }
}
export async function downloadModel(onProgress, signal) {
  const c = await caches.open(MODEL_CACHE);
  const total = MODEL_FILES.reduce((a, f) => a + f.size, 0);
  let done = 0;
  for (const f of MODEL_FILES) {
    const url = BASE + f.path;
    if (await c.match(url)) { done += f.size; onProgress?.(done / total); continue; }
    // velké soubory: při výpadku sítě pokračovat od staženého místa (Range), nejvýš 5 pokusů
    const parts = []; let got = 0, tries = 0;
    for (;;) {
      try {
        const res = await fetch(url, { signal, cache: 'no-store', headers: got ? { Range: `bytes=${got}-` } : {} });
        if (got && res.status === 200) { parts.length = 0; got = 0; } // server neumí pokračovat → od začátku
        else if (!res.ok) throw Object.assign(new Error(`Stažení se nepovedlo (${res.status}).`), { fatal: res.status === 404 });
        const reader = res.body.getReader();
        for (;;) { const { done: end, value } = await reader.read(); if (end) break; parts.push(value); got += value.length; onProgress?.((done + Math.min(got, f.size)) / total); }
        break;
      } catch (e) {
        if (signal?.aborted || e.fatal || ++tries >= 5) throw new Error('Stažení modelu se přerušilo (výpadek internetu). Zkus to znovu, nejlépe na Wi-Fi – už stažená část se nestahuje znovu.');
        await new Promise((r) => setTimeout(r, 1500 * tries));
      }
    }
    await c.put(url, new Response(new Blob(parts, { type: f.type }), { headers: { 'Content-Type': f.type } }));
    done += f.size;
  }
  try { await navigator.storage?.persist?.(); } catch { /* */ }
  onProgress?.(1);
}
export async function deleteModel() { try { await caches.delete(MODEL_CACHE); } catch { /* */ } }

// ---------- zvuk ----------
/** Soubor (mp3, m4a, wav, ogg, flac…) → stereo 44,1 kHz. */
export async function decodeFile(file) {
  const ab = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(2, 1, SR);
  let buf;
  try { buf = await ctx.decodeAudioData(ab); } catch { throw new Error('Tento soubor neumím přečíst. Zkus MP3, M4A, WAV, OGG nebo FLAC.'); }
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0);
  return { L, R, sr: SR, duration: buf.duration, channels: buf.numberOfChannels };
}
/** Nahrávka z mikrofonu (Int16, libovolná frekvence) → 44,1 kHz (převzorkuje prohlížeč). */
export async function decodePcm(pcm, rate) {
  const len = Math.ceil((pcm.length * SR) / rate);
  const off = new OfflineAudioContext(1, Math.max(1, len), SR);
  const b = off.createBuffer(1, pcm.length, rate); const d = b.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) d[i] = pcm[i] / 32768;
  const s = off.createBufferSource(); s.buffer = b; s.connect(off.destination); s.start();
  const out = await off.startRendering();
  const L = out.getChannelData(0);
  return { L, R: L, sr: SR, duration: out.duration, channels: 1 };
}
/** Úsek nahrávky (kopie). */
export function cut(audio, from = 0, to = audio.duration) {
  const a = Math.max(0, Math.floor(from * SR)), b = Math.min(audio.L.length, Math.ceil(to * SR));
  const L = audio.L.slice(a, b), R = audio.R === audio.L ? L.slice() : audio.R.slice(a, b);
  return { ...audio, L, R, duration: (b - a) / SR, offset: a / SR };
}
export function isMonoAudio(audio) {
  if (audio.channels === 1 || audio.R === audio.L) return true;
  let d = 0, s = 0; for (let i = 0; i < audio.L.length; i += 211) { d += Math.abs(audio.L[i] - audio.R[i]); s += Math.abs(audio.L[i]) + Math.abs(audio.R[i]); }
  return d < s * 0.01;
}

// ---------- název a interpret ----------
/** ID3v2 (MP3): název (TIT2) a interpret (TPE1). */
export async function readTags(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
    const ver = head[3];
    const size = ((head[6] & 127) << 21) | ((head[7] & 127) << 14) | ((head[8] & 127) << 7) | (head[9] & 127);
    const b = new Uint8Array(await file.slice(10, 10 + Math.min(size, 512 * 1024)).arrayBuffer());
    const out = {};
    let i = 0;
    while (i + 10 < b.length) {
      const id = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fs = ver >= 4 ? ((b[i + 4] & 127) << 21) | ((b[i + 5] & 127) << 14) | ((b[i + 6] & 127) << 7) | (b[i + 7] & 127) : (b[i + 4] << 24) | (b[i + 5] << 16) | (b[i + 6] << 8) | b[i + 7];
      if (fs <= 0 || i + 10 + fs > b.length) break;
      if (id === 'TIT2' || id === 'TPE1') {
        const enc = b[i + 10], data = b.subarray(i + 11, i + 10 + fs);
        const txt = new TextDecoder(enc === 0 ? 'latin1' : enc === 3 ? 'utf-8' : enc === 2 ? 'utf-16be' : 'utf-16').decode(data).replace(/\0+$/, '').replace(/^﻿/, '').trim();
        if (id === 'TIT2') out.title = txt; else out.artist = txt;
      }
      i += 10 + fs;
    }
    return out;
  } catch { return {}; }
}

// ---------- text (lrclib.net) ----------
const LRCLIB = 'https://lrclib.net/api/';
/** Dohledá text: odešle jen název, interpreta a délku písně. Vrací {synced, plain, match} nebo null. */
export async function lookupLyrics({ title, artist, duration }, { signal, timeoutMs = 9000 } = {}) {
  if (!title) return null;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), timeoutMs);
  signal?.addEventListener('abort', () => ctl.abort());
  const pick = (j) => (j && (j.syncedLyrics || j.plainLyrics) ? { synced: j.syncedLyrics || null, plain: j.plainLyrics || null, instrumental: !!j.instrumental, match: { title: j.trackName, artist: j.artistName, duration: j.duration } } : null);
  try {
    if (artist) {
      const q = new URLSearchParams({ track_name: title, artist_name: artist });
      if (duration) q.set('duration', String(Math.round(duration)));
      const r = await fetch(LRCLIB + 'get?' + q, { signal: ctl.signal });
      if (r.ok) { const p = pick(await r.json()); if (p) return p; }
    }
    const q = new URLSearchParams(artist ? { track_name: title, artist_name: artist } : { q: title });
    const r = await fetch(LRCLIB + 'search?' + q, { signal: ctl.signal });
    if (!r.ok) return null;
    const list = (await r.json()) || [];
    const score = (j) => (j.syncedLyrics ? 0 : 30) + (duration && j.duration ? Math.abs(j.duration - duration) : 10);
    const best = list.filter((j) => j.syncedLyrics || j.plainLyrics).sort((a, b) => score(a) - score(b))[0];
    return pick(best);
  } catch { return null; } finally { clearTimeout(to); }
}
// ---------- celý import ----------
export const STAGES = { model: 'Načítám model', separate: 'Odděluji zpěv od doprovodu', rhythm: 'Hledám tempo, doby a akordy', melody: 'Přepisuji melodii do not', lyrics: 'Skládám text na noty', save: 'Ukládám' };

/**
 * audio: {L, R, duration, offset?}; meta: {title, artist}; mode: 'fast' | 'precise';
 * lyrics: {mode: 'auto' | 'manual' | 'none', text?, fullDuration?}
 */
export async function importSong({ audio, meta, mode, lyrics, prefer = 'auto', onProgress }) {
  const id = 'import-' + Date.now().toString(36);
  const lyrP = lyrics.mode === 'auto' ? lookupLyrics({ title: meta.title, artist: meta.artist, duration: lyrics.fullDuration || audio.duration }) : Promise.resolve(null);
  const L = audio.L.slice(), R = audio.R === audio.L ? L.slice() : audio.R.slice();
  const an = await call({ type: 'analyze', L, R, sr: SR, mode, prefer }, [L.buffer, R.buffer], (p) => onProgress?.(p));
  onProgress?.({ stage: 'lyrics', p: 0 });
  const found = await lyrP;
  let lines = [], lyricsSource = '';
  if (lyrics.mode === 'manual') { lines = plainLines(lyrics.text); lyricsSource = 'vlastní text'; }
  else if (found) { lines = lyricsLines(found, audio.offset || 0); lyricsSource = 'lrclib.net'; }
  const song = buildImportedSong({
    id, title: meta.title || 'Importovaná píseň', artist: meta.artist || '', beats: an.beats, meter: an.meter, downbeat: an.downbeat,
    chordsPerBeat: an.chordsPerBeat, vocalFrames: an.vocalFrames, lyricsLines: lines, lyricsSource, duration: audio.duration,
  });
  if (song.notes.length < 6) throw new Error(mode === 'precise'
    ? 'Z nahrávky se nepodařilo spolehlivě vyčíst melodii zpěvu. Import ze zvuku je zatím pokus – mnohem přesnější je MIDI nebo karaoke soubor (Písně → ＋ Přidat → Z MIDI).'
    : 'V nahrávce jsem nenašel zpívanou melodii. Zkus režim Přesně, nebo raději MIDI / karaoke soubor (Písně → ＋ Přidat → Z MIDI).');
  const st = an.stems;
  const bytes = st.inst[0].byteLength * 2 + st.voc.byteLength;
  song.audio = { stems: true, sr: st.sr, vocSr: st.vocSr, duration: audio.duration, mode, backend: an.backend, bytes };
  song.analysis = { ...song.analysis, mode, backend: an.backend, seconds: Math.round(an.timing.total), lyricsFound: !!found, lyricsMatch: found?.match || null, lyricsTimed: !!(found?.synced && lines[0]?.time != null), offset: audio.offset || 0 };
  const errs = validateSong(song);
  if (errs.length) throw new Error('Píseň se nepodařilo sestavit: ' + errs.slice(0, 3).join(', '));
  onProgress?.({ stage: 'save', p: 0 });
  await db.putStems({ id, sr: st.sr, inst: st.inst, vocSr: st.vocSr, voc: st.voc, bytes });
  await saveCustomSong(song);
  try { await navigator.storage?.persist?.(); } catch { /* */ }
  return { song, found, timing: an.timing, backend: an.backend };
}

// ---------- originální stopy v přehrávači ----------
const stemCache = { id: null, data: null };
const clipCache = new Map();
async function loadStems(id) {
  if (stemCache.id === id && stemCache.data) return stemCache.data;
  const d = await db.getStems(id);
  stemCache.id = id; stemCache.data = d || null;
  return stemCache.data;
}
export async function hasStems(song) { return !!(song?.audio?.stems && (await loadStems(song.id))); }

/**
 * Připraví AudioBuffery originálu pro danou rychlost a tóninu.
 * which: 'inst' (doprovod bez zpěvu) | 'voc' (původní zpěv). Vrací [{buffer, beat0, spb, rate, bus, gain}].
 */
export async function stemClips(song, { factor = 1, shift = 0, which = ['inst'], onProgress } = {}) {
  const st = await loadStems(song.id);
  if (!st) return [];
  await engine.ensureContext();
  const semis = stemShift(shift);
  const spb = 60 / (song.tempo * factor);
  const bpb = song.meter[0];
  const out = [];
  for (const w of which) {
    const key = [song.id, w, factor.toFixed(3), semis].join('|');
    if (!clipCache.has(key)) {
      onProgress?.(w);
      const chans = w === 'inst' ? st.inst : [st.voc];
      const sr = w === 'inst' ? st.sr : st.vocSr;
      const plan = { beatTimes: song.timing.beats.map((b) => b.time), zero: song.timing.beats.findIndex((b) => b.beat === 0), duration: chans[0].length / sr, spb, semis, fromBeat: -2 * bpb - 1, toBeat: song.length + 2 };
      const r = await call({ type: 'render', chans, sr, plan });
      const buf = engine.ctx.createBuffer(r.chans.length, Math.max(1, r.chans[0].length), sr);
      r.chans.forEach((c, i) => buf.copyToChannel(c, i));
      if (clipCache.size >= 2) clipCache.delete(clipCache.keys().next().value); // v paměti nejvýš 2 verze (3 min stereo ≈ 60 MB)
      clipCache.set(key, { buffer: buf, beat0: r.fromBeat, spb: r.outSpb, rate: r.rate });
    }
    const c = clipCache.get(key);
    out.push({ ...c, which: w, bus: w === 'voc' ? 'guide' : 'accomp', gain: w === 'voc' ? 1 : 0.9 });
  }
  return out;
}
export function forgetClips(id) { for (const k of [...clipCache.keys()]) if (k.startsWith(id + '|')) clipCache.delete(k); if (stemCache.id === id) { stemCache.id = null; stemCache.data = null; } }
