// Stav aplikace: nastavení, profil hlasu, pokrok, vlastní písně. Ukládá se do IndexedDB; změny se hlásí odběratelům.
import { db } from './store/db.js';
import { defaultProfile, computeProfile } from './core/voice.js';
import { emptyProgress } from './core/progress.js';
import { SONGS } from './data/songs.js';
import { STRICTNESS } from './core/scoring.js';

export const DEFAULT_SETTINGS = {
  notation: 'cz', strictness: 'beginner', guideInst: 'guide', accStyle: 'piano', bass: true, drums: false,
  dailyGoal: 10, reminders: true, wakeLock: true, micDeviceId: null, headphones: 'unknown',
  hpProfiles: [
    { id: 'wired', name: 'Drátová sluchátka', type: 'wired', latencyMs: 40, calibrated: false },
    { id: 'bt', name: 'Nothing Ear (a) – Bluetooth', type: 'bt', latencyMs: 220, calibrated: false },
    { id: 'speaker', name: 'Reproduktor telefonu', type: 'speaker', latencyMs: 60, calibrated: false },
  ],
  activeHp: 'bt', onboarded: false, saveRecordings: true, lyricsMode: 'text',
  mix: { accomp: 0.75, guide: 0.7, metro: 0.5, monitor: 0 }, view: 'roll', countIn: true, lastBreakReminder: 0,
};

const listeners = new Set();
export const state = {
  ready: false,
  settings: structuredClone(DEFAULT_SETTINGS),
  profile: defaultProfile(),
  profileHistory: [],
  progress: emptyProgress(),
  customSongs: [],
  version: 0,
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { state.version++; for (const l of listeners) l(state); }

export async function loadState() {
  try {
    const kv = await db.allKV();
    if (kv.settings) state.settings = { ...structuredClone(DEFAULT_SETTINGS), ...kv.settings, mix: { ...DEFAULT_SETTINGS.mix, ...(kv.settings.mix || {}) } };
    if (kv.profile) state.profile = kv.profile;
    if (kv.profileHistory) state.profileHistory = kv.profileHistory;
    if (kv.progress) state.progress = { ...emptyProgress(), ...kv.progress };
    state.customSongs = await db.listSongs();
  } catch (e) {
    console.warn('Načtení dat selhalo', e);
    state.loadError = 'Data se nepodařilo načíst z úložiště prohlížeče: ' + (e.message || e);
  }
  state.ready = true;
  emit();
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  emit();
  await db.setKV('settings', state.settings).catch((e) => console.warn(e));
}
export async function saveProgress() { emit(); await db.setKV('progress', state.progress).catch((e) => console.warn(e)); }

/** Uloží nový změřený profil a přidá ho do historie rozsahu. */
export async function saveProfile(measure, { addHistory = true } = {}) {
  const p = computeProfile(measure);
  state.profile = p;
  if (addHistory) {
    state.profileHistory = [...state.profileHistory, { date: new Date().toISOString(), low: p.low, highChest: p.highChest, highAll: p.highAll, type: p.type, speakingHz: p.speakingHz }].slice(-200);
    await db.setKV('profileHistory', state.profileHistory);
  }
  await db.setKV('profile', p);
  emit();
  return p;
}
export async function updateProfileManual(patch) {
  const p = state.profile;
  const measure = { low: patch.low ?? p.low, highChest: patch.highChest ?? p.highChest, highFalsetto: patch.highFalsetto ?? p.highFalsetto ?? p.highAll, speakingHz: p.speakingHz, breathHold: p.breathHold, breathControl: p.breathControl, measured: p.measured, manual: { ...(p.manual || {}), ...(patch.manual || {}) } };
  return saveProfile(measure, { addHistory: false });
}

export function allSongs() { return [...SONGS, ...state.customSongs]; }
export function findSong(id) { return allSongs().find((s) => s.id === id); }
export async function saveCustomSong(song) {
  await db.putSong(song);
  state.customSongs = [...state.customSongs.filter((s) => s.id !== song.id), song];
  emit();
}
export async function deleteCustomSong(id) {
  await db.deleteSong(id);
  state.customSongs = state.customSongs.filter((s) => s.id !== id);
  emit();
}

export const tol = () => STRICTNESS[state.settings.strictness]?.tol ?? 50;
export const hpProfile = () => state.settings.hpProfiles.find((h) => h.id === state.settings.activeHp) || state.settings.hpProfiles[0];
export function notationStyle() { return state.settings.notation; }
export function touch() { emit(); }
