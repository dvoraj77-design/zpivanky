// Hry: nauka (noty, klávesy, intervaly, rytmus, tóniny), poslech (sluchový trénink) a zpěv (trefa, rytmus, síla, rychlost, paměť).
import { html, useState, useEffect, useRef, useMemo, useAppState, TopBar, ScoreRing, Stars, useImmersive, navigate } from '../ui/common.js';
import { Hint } from '../ui/hints.js';
import { state, saveProgress } from '../state.js';
import { engine } from '../audio/engine.js';
import { GAMES, GAME_GROUPS, LEVEL_NAMES, gameById, makeQuestion, updateBox, rng, randomMotif, singGameScore, gameStars, levelUnlocked } from '../core/games.js';
import { recordAttempt } from '../core/progress.js';
import { buildExercise } from '../core/exercises.js';
import { exerciseSessionOpts } from '../app/builders.js';
import { RunScreen } from './run.js';
import { Staff, RhythmValues, RhythmBar, Keyboard } from '../ui/staff.js';
import { gradeLabel } from '../core/scoring.js';

const QUESTIONS = 10;
const gp = (id) => (state.progress.games ||= {})[id] ||= { levels: {}, boxes: {} };
const totalStars = (g) => Object.values(gp(g.id).levels).reduce((a, l) => a + (l.stars || 0), 0);

/** Zapíše výsledek hry: nejlepší skóre, hvězdy, odemčení, čas do denního cíle. */
function recordGame(g, lv, score, seconds) {
  const p = gp(g.id);
  const prev = p.levels[lv] || { best: 0, stars: 0, plays: 0 };
  const stars = gameStars(score);
  const wasLocked = lv + 1 < g.levels.length && !levelUnlocked(p, lv + 1);
  p.levels[lv] = { best: Math.max(prev.best, score), stars: Math.max(prev.stars, stars), plays: prev.plays + 1, last: new Date().toISOString() };
  recordAttempt(state.progress, { type: 'game', id: `${g.id}:${lv}`, score, stars, seconds });
  saveProgress();
  return { record: score > prev.best && prev.plays > 0, stars, unlocked: wasLocked && levelUnlocked(p, lv + 1) ? `${lv + 2} – ${g.levels[lv + 1].desc}` : null };
}

export function GamesScreen() {
  useAppState();
  const [group, setGroup] = useState(() => { try { return sessionStorage.getItem('zp-games-group') || 'nauka'; } catch { return 'nauka'; } });
  useEffect(() => { try { sessionStorage.setItem('zp-games-group', group); } catch { /* */ } }, [group]);
  const games = GAMES.filter((g) => g.group === group);
  return html`<div class="screen">
    <h1 class="mb8">Hry</h1>
    <${Hint} id="games" title="Učení hrou">Krátká kola na 1–2 minuty. Každá hra má 5 úrovní od začátečníka po mistra – další úroveň se odemkne, když získáš aspoň ⭐. Co ti nejde, aplikace připomene častěji.</${Hint}>
    <div class="seg mb16" role="tablist">${GAME_GROUPS.map(([k, l, i]) => html`<button role="tab" aria-selected=${group === k} class=${group === k ? 'on' : ''} onClick=${() => setGroup(k)}>${i} ${l}</button>`)}</div>
    <p class="small muted mb8">${GAME_GROUPS.find((x) => x[0] === group)[3]}${group === 'zpev' ? ' – potřebuješ mikrofon a sluchátka.' : ''}</p>
    <div class="list">${games.map((g) => {
      const p = gp(g.id); const st = totalStars(g);
      const lv = [0, 1, 2, 3, 4].filter((i) => levelUnlocked(p, i)).length;
      return html`<a class="item" href=${'#/game/' + g.id} data-testid=${'game-' + g.id}>
        <div class="ic">${g.icon}</div>
        <div class="grow"><div class="t">${g.title}</div><div class="s ellipsis">${g.desc}</div>
          <div class="tiny dim mt8">${[0, 1, 2, 3, 4].map((i) => html`<span style="margin-right:6px">${p.levels[i]?.stars ? '★'.repeat(p.levels[i].stars) : levelUnlocked(p, i) ? '○' : '🔒'}</span>`)}</div></div>
        <div class="chev">${st ? html`<span class="badge">${st}★</span>` : `${lv}/5`}</div></a>`;
    })}</div>
  </div>`;
}

export function GameLevels({ id }) {
  useAppState();
  const g = gameById(id);
  if (!g) return html`<div class="screen"><${TopBar} title="Hra nenalezena" backTo="/games" /></div>`;
  const p = gp(g.id);
  return html`<div class="screen">
    <${TopBar} title=${`${g.icon} ${g.title}`} sub=${g.desc} backTo="/games" />
    <div class="list">${g.levels.map((lv, i) => {
      const open = levelUnlocked(p, i); const s = p.levels[i];
      return html`<button class="item" disabled=${!open} style=${open ? '' : 'opacity:.55'} onClick=${() => open && navigate(`/play-game/${g.id}/${i}`)} data-testid=${'level-' + i}>
        <div class="ic">${open ? i + 1 : '🔒'}</div>
        <div class="grow"><div class="t">${LEVEL_NAMES[i]}</div><div class="s">${lv.desc}</div></div>
        <div style="text-align:right">${s?.stars ? html`<${Stars} n=${s.stars} />` : null}${s?.best ? html`<div class="tiny dim">rekord ${s.best}</div>` : open ? html`<span class="chev">▶</span>` : null}</div>
      </button>`;
    })}</div>
    ${!levelUnlocked(p, 1) ? html`<p class="small muted mt16 center">Další úroveň se odemkne, když získáš aspoň ⭐ (50 bodů).</p>` : null}
  </div>`;
}

export function GamePlay({ id, level }) {
  const g = gameById(id); const lv = Math.max(0, Math.min(4, parseInt(level, 10) || 0));
  if (!g) return html`<div class="screen"><${TopBar} title="Hra nenalezena" backTo="/games" /></div>`;
  if (g.kind === 'sing') return html`<${SingGame} key=${id + lv} g=${g} lv=${lv} />`;
  return html`<${QuizGame} key=${id + lv} g=${g} lv=${lv} />`;
}

// ---------- kvízy (nauka, poslech) ----------
async function playAudio(audio) {
  if (!audio?.notes?.length) return;
  await engine.ensureContext();
  const inst = audio.inst || 'piano';
  if (inst === 'piano') await engine.loadInstruments(['piano']).catch(() => {});
  const t0 = engine.now + 0.08 + (audio.count ? audio.count * audio.spb : 0);
  if (audio.count) for (let i = 0; i < audio.count; i++) engine.playEvent({ midi: i === 0 ? 84 : 77, inst: 'click', vel: 0.7 }, engine.now + 0.08 + i * audio.spb, 0.05, engine.bus.preview);
  for (const n of audio.notes) {
    const i2 = n.inst || (inst === 'piano' && !engine.inst.piano.loaded ? 'guide' : inst);
    if (i2 === 'click') engine.playEvent({ midi: 38, inst: 'drum', vel: 0.9 }, t0 + n.t, n.d, engine.bus.preview);
    else engine.playEvent({ midi: n.midi, inst: i2, vel: 0.8 }, t0 + n.t, n.d, engine.bus.preview);
  }
}

function QuizGame({ g, lv }) {
  useImmersive();
  const p = gp(g.id);
  const r = useRef(rng(Date.now()));
  const style = state.settings.notation === 'intl' ? 'intl' : 'cz';
  const [q, setQ] = useState(() => makeQuestion(g.id, lv, r.current, p.boxes, null, style));
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(null);
  const t0 = useRef(performance.now());
  useEffect(() => { if (g.audio && q && !done) { const tm = setTimeout(() => playAudio(q.audio), 300); return () => clearTimeout(tm); } return undefined; }, [q]);
  const answer = (id) => {
    if (picked != null) return;
    const ok = id === q.answer;
    setPicked(id); setAnswers([...answers, ok]);
    updateBox(p.boxes, q.key, ok);
    if (!g.audio && q.audio) playAudio(q.audio); // u nauky zazní správný tón jako odměna / oprava
    else if (g.audio && !ok) setTimeout(() => playAudio(q.audio), 500);
  };
  const next = () => {
    if (i + 1 >= QUESTIONS) {
      const correct = answers.filter(Boolean).length;
      const score = Math.round((correct / QUESTIONS) * 100);
      const rec = recordGame(g, lv, score, (performance.now() - t0.current) / 1000);
      const res = { score, correct, ...rec };
      setDone(res);
      if (window.zpTest) window.zpTest.lastResult = { overall: score, kind: 'game', ...res };
      return;
    }
    setPicked(null); setI(i + 1); setQ(makeQuestion(g.id, lv, r.current, p.boxes, q.key, style));
  };
  const restart = () => { setDone(null); setAnswers([]); setPicked(null); setI(0); t0.current = performance.now(); setQ(makeQuestion(g.id, lv, r.current, p.boxes, null, style)); };
  const exit = () => navigate('/game/' + g.id, true);
  if (done) {
    const nextOpen = lv < 4 && levelUnlocked(p, lv + 1);
    return html`<div class="screen full">
      <div class="topbar"><button class="back" onClick=${exit} aria-label="Zavřít">✕</button><h2>${g.title} · ${LEVEL_NAMES[lv]}</h2></div>
      <div class="center"><${ScoreRing} score=${done.score} label=${gradeLabel(done.score)} /><div class="mt8"><${Stars} n=${done.stars} /></div><p class="mt8">Správně ${done.correct} z ${QUESTIONS}</p></div>
      ${done.record ? html`<div class="card goodc mt16 center" style="font-weight:800">🏆 Nový osobní rekord!</div>` : null}
      ${done.unlocked ? html`<div class="card infoc mt16 small">🔓 Odemkla se úroveň ${done.unlocked}</div>` : null}
      <div class="col mt24" data-testid="quiz-done">
        ${nextOpen ? html`<button class="btn primary big block" onClick=${() => navigate(`/play-game/${g.id}/${lv + 1}`, true)}>Další úroveň →</button>` : null}
        <button class="btn block" onClick=${restart}>↻ Znovu</button>
        <button class="btn block" onClick=${exit}>Zpět na úrovně</button></div>
    </div>`;
  }
  const v = q.view;
  const right = picked != null ? q.answer : null;
  if (window.zpTest) window.zpTest.quiz = q; // pro automatické testy
  return html`<div class="screen full">
    <div class="topbar"><button class="back" onClick=${exit} aria-label="Zavřít">✕</button><div class="grow"><h2>${g.title}</h2><div class="small muted">${LEVEL_NAMES[lv]} · otázka ${i + 1} z ${QUESTIONS}</div></div></div>
    <div class="progress-seg mb16">${[...Array(QUESTIONS)].map((_, k) => html`<i style=${`background:${k < answers.length ? (answers[k] ? '#a8dcc9' : '#f5c2ca') : k === i ? '#f0a35e' : '#e9e6df'}`}></i>`)}</div>
    <div class="card center col" style="align-items:center;min-height:150px;justify-content:center" data-testid="quiz-view">
      ${v.type === 'staff' ? html`<${Staff} clef=${v.clef} notes=${v.notes} keySig=${v.keySig} />` : null}
      ${v.type === 'keyboard' ? html`${v.text ? html`<div style="font-size:30px;font-weight:900" class="mb8">${v.text}</div>` : null}
        <${Keyboard} marks=${v.marks || []} onTap=${v.tap && picked == null ? (pc) => answer(pc) : null} good=${v.tap && picked != null ? q.answer : null} bad=${v.tap && picked != null && picked !== q.answer ? picked : null} />
        ${v.tap ? html`<p class="small muted mt8">${picked == null ? 'Ťukni na správnou klávesu.' : ''}</p>` : null}` : null}
      ${v.type === 'rhythm' ? html`<${RhythmValues} items=${v.items} />` : null}
      ${v.type === 'listen' ? html`<div style="font-size:48px">👂</div><p class="muted">${v.text}</p>` : null}
      ${g.audio ? html`<button class="btn block mt8" onClick=${() => playAudio(q.audio)} data-testid="quiz-replay">🔁 Přehrát znovu</button>` : null}
    </div>
    ${q.options.length ? html`<div class="mt16" style=${`display:grid;grid-template-columns:repeat(${q.cols || 2},1fr);gap:8px`} data-testid="quiz-options">${q.options.map((o) => {
      const isR = right != null && o.id === right, isP = picked === o.id;
      return html`<button class=${'btn ' + (isR ? 'good' : isP ? 'danger' : '')} style="min-height:52px" onClick=${() => answer(o.id)}>
        ${o.rhythm ? html`<${RhythmBar} cells=${o.rhythm} />` : html`${isR ? '✓ ' : isP ? '✕ ' : ''}${o.label}`}</button>`;
    })}</div>` : null}
    ${picked != null ? html`<div class="card mt16 small" data-testid="quiz-feedback"><b>${picked === q.answer ? '✓ Správně!' : '✕ Tentokrát ne.'}</b> ${q.explain}
      ${q.anchor ? html` <a href=${'#/song/' + q.anchor}>Otevřít píseň</a>` : null}
      <button class="btn primary block mt8" onClick=${next} data-testid="quiz-next">${i + 1 >= QUESTIONS ? 'Výsledek' : 'Další →'}</button></div>` : null}
  </div>`;
}

// ---------- zpívací hry ----------
function SingGame({ g, lv }) {
  const level = g.levels[lv];
  useAppState(); // po výsledku se překreslí (odemčená další úroveň)
  const [seed, setSeed] = useState(() => Date.now());
  const opts = useMemo(() => {
    const r = rng(seed);
    const spec = { ...level.spec, ...(level.spec.randomMotif ? { motifs: [0, 1, 2, 3].map(() => randomMotif(level.spec.randomMotif, r)) } : {}) };
    const plan = buildExercise(spec, state.profile, { seed });
    return exerciseSessionOpts(plan, { listenInst: level.listen, tol: level.tol, metroUntil: level.metroUntil });
  }, [seed]);
  const t0 = useRef(performance.now());
  const onResult = async (result) => {
    const { score, metrics } = singGameScore(g, lv, result);
    const rec = recordGame(g, lv, score, (performance.now() - t0.current) / 1000);
    return { game: { title: `${g.title} · ${LEVEL_NAMES[lv]}`, score, metrics, ...rec } };
  };
  const nextOpen = lv < 4 && levelUnlocked(gp(g.id), lv + 1);
  return html`<${RunScreen} key=${seed} opts=${opts} title=${`${g.icon} ${g.title}`} sub=${`${LEVEL_NAMES[lv]} · ${level.desc}`}
    onExit=${() => navigate('/game/' + g.id, true)} onResult=${onResult}
    next=${nextOpen ? { label: 'Další úroveň →', go: () => navigate(`/play-game/${g.id}/${lv + 1}`, true) } : { label: '↻ Nové kolo', go: () => { t0.current = performance.now(); setSeed(Date.now()); } }} />`;
}
