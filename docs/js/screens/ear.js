// Sluchový trénink: poznávání intervalů (melodicky / harmonicky) a krátkých melodií.
import { html, useState, useEffect, ScoreRing, Stars, TopBar, toast, useImmersive } from '../ui/common.js';
import { engine } from '../audio/engine.js';
import { INTERVAL_NAMES } from '../core/music.js';
import { starsFor, gradeLabel } from '../core/scoring.js';
import { buildExercise } from '../core/exercises.js';
import { state } from '../state.js';

const HINT = { 1: 'malá sekunda – „čelisti“', 2: 'velká sekunda – „Dobré ráno“', 3: 'malá tercie – „ku-kuk“', 4: 'velká tercie – „Na louce“', 5: 'kvarta – začátek pochodu', 7: 'kvinta – „Hvězdičko“', 9: 'velká sexta – „Večerní“', 12: 'oktáva – stejný tón výš' };

export function EarQuiz({ spec, title, onExit, onResult, next }) {
  const [plan] = useState(() => buildExercise(spec, state.profile, { seed: Date.now() }));
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(null);
  const [extra, setExtra] = useState(null);
  const q = plan.questions[i];
  useImmersive();
  const play = async (qq = q) => {
    await engine.ensureContext();
    await engine.loadInstruments().catch(() => {});
    const inst = engine.inst.piano.loaded ? 'piano' : 'guide';
    const t = engine.now + 0.08;
    if (qq.harmonic) { engine.playEvent({ midi: qq.root, inst, vel: 0.8 }, t, 1.4, engine.bus.preview); engine.playEvent({ midi: qq.root + qq.semi, inst, vel: 0.8 }, t, 1.4, engine.bus.preview); }
    else { engine.playEvent({ midi: qq.root, inst, vel: 0.8 }, t, 0.8, engine.bus.preview); engine.playEvent({ midi: qq.root + qq.semi, inst, vel: 0.8 }, t + 0.85, 1.0, engine.bus.preview); }
  };
  useEffect(() => { if (q && !done) setTimeout(() => play(q), 250); }, [i]);
  const answer = (semi) => {
    if (picked != null) return;
    setPicked(semi);
    const ok = semi === q.semi;
    setAnswers([...answers, ok]);
    if (!ok) setTimeout(() => play(q), 400);
  };
  const nextQ = async () => {
    setPicked(null);
    if (i + 1 >= plan.questions.length) {
      const correct = answers.filter(Boolean).length;
      const score = Math.round((correct / plan.questions.length) * 100);
      const r = { kind: 'ear', overall: score, stars: starsFor(score), label: gradeLabel(score), tip: score >= 85 ? 'Výborné ucho! Zkus těžší intervaly.' : 'Zpívej si intervaly v duchu – pomáhají začátky známých písní (viz nápověda).', seconds: plan.questions.length * 6, correct, total: plan.questions.length };
      setDone(r);
      if (window.zpTest) window.zpTest.lastResult = r;
      if (onResult) setExtra(await onResult(r));
    } else setI(i + 1);
  };
  if (done) {
    return html`<div class="screen full">
      <div class="topbar"><button class="back" onClick=${onExit} aria-label="Zavřít">✕</button><h2>${title}</h2></div>
      <div class="center"><${ScoreRing} score=${done.overall} label=${done.label} /><div class="mt8"><${Stars} n=${done.stars} /></div>
      <p class="mt8">Správně ${done.correct} z ${done.total}</p></div>
      ${extra?.badges?.length ? html`<div class="card hero mt16 center">🏅 Nový odznak: ${extra.badges.map((b) => b.title).join(', ')}</div>` : null}
      <div class="pill-tip mt16">💡 ${done.tip}</div>
      <div class="col mt24">${next ? html`<button class="btn primary big block" onClick=${next.go}>${next.label}</button>` : null}
        <button class="btn block" onClick=${() => { setI(0); setAnswers([]); setDone(null); setExtra(null); }}>↻ Znovu</button></div>
    </div>`;
  }
  return html`<div class="screen full">
    <div class="topbar"><button class="back" onClick=${onExit} aria-label="Zavřít">✕</button><div class="grow"><h2>${title}</h2><div class="small muted">Otázka ${i + 1} z ${plan.questions.length}</div></div></div>
    <div class="progress-seg mb16">${plan.questions.map((_, k) => html`<i style=${`background:${k < answers.length ? (answers[k] ? '#a8dcc9' : '#f5c2ca') : k === i ? '#f0a35e' : '#e9e6df'}`}></i>`)}</div>
    <div class="card center col" style="align-items:center">
      <div style="font-size:54px">👂</div>
      <p class="muted">${q.harmonic ? 'Dva tóny zazní současně.' : 'Dva tóny zazní po sobě.'} Jaký je to interval?</p>
      <button class="btn block" onClick=${() => play()}>🔁 Přehrát znovu</button>
    </div>
    <div class="col mt16">${q.options.map((s) => {
      const isPicked = picked === s, isRight = picked != null && s === q.semi;
      return html`<button class=${'btn block ' + (isRight ? 'good' : isPicked ? 'danger' : '')} onClick=${() => answer(s)}>
        ${isRight ? '✓ ' : isPicked ? '✕ ' : ''}${spec.quality === 'third' || (q.options.length === 2 && q.options.includes(3) && q.options.includes(4)) ? (s === 3 ? 'Moll (malá tercie)' : 'Dur (velká tercie)') : INTERVAL_NAMES[s][0].toUpperCase() + INTERVAL_NAMES[s].slice(1)}
      </button>`;
    })}</div>
    ${picked != null ? html`<div class="card mt16 small">${picked === q.semi ? '✓ Správně!' : `Byla to ${INTERVAL_NAMES[q.semi]}.`} <span class="muted">${HINT[q.semi] || ''}</span>
      <button class="btn primary block mt8" onClick=${nextQ}>${i + 1 >= plan.questions.length ? 'Výsledek' : 'Další →'}</button></div>` : null}
  </div>`;
}
