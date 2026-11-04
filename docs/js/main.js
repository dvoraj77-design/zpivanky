// Zpívánky – start aplikace, směrování, spodní lišta, service worker, testovací rozhraní.
import { html, render, useState, useEffect, ToastHost, toast, navigate } from './ui/common.js';
import { state, loadState, subscribe, saveSettings } from './state.js';
import { engine } from './audio/engine.js';
import { Transport } from './audio/transport.js';
import { HomeScreen } from './screens/home.js';
import { CourseScreen, ChapterScreen, LessonScreen } from './screens/course.js';
import { SongsScreen, SongDetail, SongPlay, SongEditor } from './screens/songs.js';
import { ImportScreen } from './screens/import.js';
import { MidiImportScreen } from './screens/midi.js';
import { TunerScreen } from './screens/tuner.js';
import { MeScreen, ProgressScreen, RecordingsScreen, SettingsScreen, BackupScreen, DiagScreen, AboutScreen } from './screens/me.js';
import { VoiceScreen, VoiceTestScreen } from './screens/voice.js';
import { AudioScreen, CalibrateScreen } from './screens/audio.js';
import { ToolsScreen, MetronomeScreen, DroneScreen, PianoScreen, ScalesScreen } from './screens/tools.js';
import { GamesScreen, GameLevels, GamePlay } from './screens/games.js';
import { OnboardingScreen } from './screens/onboarding.js';
import { PlanScreen } from './screens/plan.js';
import { TheoryChapterScreen, TheoryLessonScreen } from './screens/theory.js';
import { HelpScreen } from './screens/help.js';
import { dayKey } from './core/progress.js';

const ROUTES = [
  [/^\/$/, () => html`<${HomeScreen} />`, 'home'],
  [/^\/welcome$/, () => html`<${OnboardingScreen} />`, null],
  [/^\/course$/, (m, q) => html`<${CourseScreen} query=${q} />`, 'course'],
  [/^\/theory\/([\w-]+)$/, (m) => html`<${TheoryChapterScreen} id=${m[1]} />`, 'course'],
  [/^\/tlesson\/([\w-]+)$/, (m) => html`<${TheoryLessonScreen} id=${m[1]} />`, 'course'],
  [/^\/help$/, (m, q) => html`<${HelpScreen} query=${q} />`, 'me'],
  [/^\/course\/([\w-]+)$/, (m) => html`<${ChapterScreen} id=${m[1]} />`, 'course'],
  [/^\/lesson\/([\w-]+)$/, (m) => html`<${LessonScreen} id=${m[1]} />`, 'course'],
  [/^\/songs$/, () => html`<${SongsScreen} />`, 'songs'],
  [/^\/song\/([\w-]+)$/, (m, q) => html`<${SongDetail} id=${m[1]} query=${q} />`, 'songs'],
  [/^\/play\/([\w-]+)$/, (m, q) => html`<${SongPlay} id=${m[1]} query=${q} />`, 'songs'],
  [/^\/import$/, () => html`<${ImportScreen} />`, 'songs'],
  [/^\/midi$/, () => html`<${MidiImportScreen} />`, 'songs'],
  [/^\/editor$/, () => html`<${SongEditor} />`, 'songs'],
  [/^\/editor\/([\w-]+)$/, (m) => html`<${SongEditor} id=${m[1]} />`, 'songs'],
  [/^\/tuner$/, () => html`<${TunerScreen} />`, 'home'],
  [/^\/me$/, () => html`<${MeScreen} />`, 'me'],
  [/^\/voice$/, () => html`<${VoiceScreen} />`, 'me'],
  [/^\/voicetest$/, (m, q) => html`<${VoiceTestScreen} query=${q} />`, 'me'],
  [/^\/progress$/, () => html`<${ProgressScreen} />`, 'me'],
  [/^\/recordings$/, () => html`<${RecordingsScreen} />`, 'me'],
  [/^\/audio$/, () => html`<${AudioScreen} />`, 'me'],
  [/^\/calibrate$/, () => html`<${CalibrateScreen} />`, 'me'],
  [/^\/settings$/, () => html`<${SettingsScreen} />`, 'me'],
  [/^\/backup$/, () => html`<${BackupScreen} />`, 'me'],
  [/^\/diag$/, () => html`<${DiagScreen} />`, 'me'],
  [/^\/about$/, () => html`<${AboutScreen} />`, 'me'],
  [/^\/tools$/, () => html`<${ToolsScreen} />`, 'me'],
  [/^\/tools\/metronome$/, () => html`<${MetronomeScreen} />`, 'me'],
  [/^\/tools\/drone$/, () => html`<${DroneScreen} />`, 'me'],
  [/^\/tools\/piano$/, () => html`<${PianoScreen} />`, 'me'],
  [/^\/tools\/scales$/, () => html`<${ScalesScreen} />`, 'me'],
  [/^\/ear$/, () => { try { sessionStorage.setItem('zp-games-group', 'poslech'); } catch { /* */ } return html`<${GamesScreen} />`; }, 'games'],
  [/^\/games$/, () => html`<${GamesScreen} />`, 'games'],
  [/^\/game\/([\w-]+)$/, (m) => html`<${GameLevels} id=${m[1]} />`, 'games'],
  [/^\/play-game\/([\w-]+)\/(\d)$/, (m) => html`<${GamePlay} key=${m[1] + m[2]} id=${m[1]} level=${m[2]} />`, null],
  [/^\/plan\/(\d+)$/, (m) => html`<${PlanScreen} minutes=${m[1]} />`, 'home'],
];

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', query: new URLSearchParams(qs || '') };
}

const TABS = [['home', '#/', '🏠', 'Dnes'], ['course', '#/course', '📘', 'Kurz'], ['songs', '#/songs', '🎵', 'Písně'], ['games', '#/games', '🎮', 'Hry'], ['me', '#/me', '👤', 'Já']];

function App() {
  const [route, setRoute] = useState(parseHash());
  const [, setV] = useState(0);
  const [update, setUpdate] = useState(null);
  useEffect(() => {
    const on = () => { sessionStorage.setItem('zp-nav', '1'); setRoute(parseHash()); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    const un = subscribe(() => setV((x) => x + 1));
    const onUpd = (e) => setUpdate(e.detail);
    addEventListener('zp-update', onUpd);
    return () => { removeEventListener('hashchange', on); un(); removeEventListener('zp-update', onUpd); };
  }, []);
  if (!state.ready) return html`<div class="boot"><div class="boot-logo">🎤</div><div class="boot-title">Zpívánky</div></div>`;
  let view = null, tab = null;
  for (const [re, fn, t] of ROUTES) {
    const m = re.exec(route.path);
    if (m) { view = fn(m, route.query); tab = t; break; }
  }
  if (!view) { view = html`<${HomeScreen} />`; tab = 'home'; }
  return html`<div class="app">
    ${state.loadError ? html`<div class="banner" style="background:var(--bad)">${state.loadError}</div>` : null}
    ${update ? html`<div class="banner"><span class="grow">Je k dispozici nová verze.</span><button class="btn sm" onClick=${() => update()}>Aktualizovat</button></div>` : null}
    ${view}
    ${tab ? html`<nav class="nav" aria-label="Hlavní navigace"><div class="nav-in">${TABS.map(([id, href, ico, label]) => html`<a href=${href} class=${tab === id ? 'on' : ''} aria-current=${tab === id ? 'page' : null}><span class="ico">${ico}</span>${label}</a>`)}</div></nav>` : null}
    <${ToastHost} />
  </div>`;
}

async function boot() {
  render(html`<${App} />`, document.getElementById('app'));
  await loadState();
  engine.latencyMs = state.settings.hpProfiles.find((h) => h.id === state.settings.activeHp)?.latencyMs ?? 0;
  if (!state.settings.onboarded && !location.hash.startsWith('#/welcome') && !isTest()) navigate('/welcome', true);
  // ladička připravená co nejdřív: pokud je mikrofon už povolený, spustíme ho hned
  try {
    const perm = await navigator.permissions?.query({ name: 'microphone' });
    if (perm?.state === 'granted' && state.settings.onboarded) engine.startMic(state.settings.micDeviceId).catch(() => {});
  } catch { /* některé prohlížeče dotaz nepodporují */ }
  // instrumenty v pozadí
  const warm = () => { engine.ensureContext().then(() => engine.loadInstruments()).catch(() => {}); removeEventListener('pointerdown', warm); };
  addEventListener('pointerdown', warm);
  // AudioContext potřebuje gesto – obnov ho po prvním dotyku
  addEventListener('pointerdown', () => { if (engine.ctx && engine.ctx.state !== 'running') engine.ctx.resume().catch(() => {}); });
  navigator.storage?.persist?.().catch(() => {});
  setupReminders();
  registerSW();
}

function isTest() { return /[?&]test/.test(location.search); }

function setupReminders() {
  let lastNotified = null;
  subscribe((st) => {
    if (!st.settings.reminders) return;
    const sec = st.progress.days[dayKey()]?.seconds || 0;
    const slot = Math.floor(sec / 900);
    if (lastNotified == null) { lastNotified = slot; return; }
    if (slot > lastNotified) { lastNotified = slot; setTimeout(() => toast('💧 Už zpíváš přes ' + slot * 15 + ' minut. Napij se vody a dej hlasu krátkou pauzu.', 6000), 1500); }
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator) || isTest() && !/sw=1/.test(location.search)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = (w) => dispatchEvent(new CustomEvent('zp-update', { detail: () => { w.postMessage({ type: 'skipWaiting' }); } }));
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch((e) => console.warn('SW', e));
}

// Testovací rozhraní pro automatizované testy (simulovaný zpěvák jako mikrofon).
window.zpTest = {
  engine, state, saveSettings,
  async loadInput(url) { return engine.loadTestInput(url); },
  clearInput() { engine.testBuffer = null; engine.stopTestInput(); },
  diag() { return engine.diagnostics(); },
  get transport() { return Transport.last; },
};

boot();
