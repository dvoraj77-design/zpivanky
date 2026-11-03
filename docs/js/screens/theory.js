// Hudební nauka: kapitoly a lekce se stránkami (text, poslech, klaviatura, rytmus, ukázka válce not, kvíz).
import { html, useState, useEffect, useRef, useAppState, navigate, TopBar, Stars, toast, fmtNote, useImmersive } from '../ui/common.js';
import { THEORY, ALL_THEORY, theoryById, theoryChapter } from '../data/theory.js';
import { state, saveProgress } from '../state.js';
import { engine } from '../audio/engine.js';
import { recordAttempt } from '../core/progress.js';
import { starsFor } from '../core/scoring.js';
import { noteName } from '../core/music.js';
import { drawRoll, setupCanvas } from '../ui/pitchroll.js';

export const theoryState = (p, id) => (p.theory && p.theory[id]) || { stars: 0, best: 0 };

export function TheoryList() {
  const st = useAppState();
  return html`<div class="list">${THEORY.map((c) => {
    const done = c.lessons.filter((l) => theoryState(st.progress, l.id).stars >= 1).length;
    const stars = c.lessons.reduce((a, l) => a + theoryState(st.progress, l.id).stars, 0);
    return html`<a class="item" href=${'#/theory/' + c.id}><div class="ic">${c.icon}</div>
      <div class="grow"><div class="t">${c.n}. ${c.title}</div><div class="s ellipsis">${c.intro}</div>
        <div class="bar mt8"><i style=${`width:${(stars / (c.lessons.length * 3)) * 100}%`}></i></div></div>
      <div class="col center" style="gap:0"><span class="small" style="font-weight:800">${done}/${c.lessons.length}</span></div></a>`;
  })}</div>`;
}

export function TheoryChapterScreen({ id }) {
  const st = useAppState();
  const c = theoryChapter(id);
  if (!c) return html`<div class="screen"><${TopBar} title="Kapitola nenalezena" backTo="/course?part=theory" /></div>`;
  return html`<div class="screen">
    <${TopBar} title=${`${c.n}. ${c.title}`} sub=${c.intro} backTo="/course?part=theory" />
    <div class="list">${c.lessons.map((l, i) => html`<a class="item" href=${'#/tlesson/' + l.id}><div class="ic">${i + 1}</div>
      <div class="grow"><div class="t">${l.title}</div><div class="s">${l.blocks.filter((b) => b.t === 'quiz').length} otázek · ${l.blocks.filter((b) => b.t === 'play' || b.t === 'rhythm').length} ukázek</div></div>
      <${Stars} n=${theoryState(st.progress, l.id).stars} /></a>`)}</div>
  </div>`;
}

async function playNotes(spec) {
  await engine.ensureContext();
  await engine.loadInstruments().catch(() => {});
  const spb = 60 / (spec.bpm || 80);
  const unit = spec.bpm ? spb : 0.75; // u ukázek bez tempa: 1 „doba“ = 0,75 s
  const t0 = engine.now + 0.08;
  const play = (notes, inst) => {
    const ins = inst === 'guide' || !engine.inst.piano.loaded ? 'guide' : 'piano';
    for (const [m, t, d, vel] of notes) engine.playEvent({ midi: m, inst: ins, vel: vel ?? 0.8 }, t0 + t * unit, d * unit, engine.bus.preview);
  };
  if (spec.notes) play(spec.notes, spec.inst);
  if (spec.then) play(spec.then.notes, spec.then.inst);
  if (spec.rhythm) {
    const meter = spec.meter || 4;
    const len = Math.max(...spec.rhythm.map(([t, d]) => t + d));
    for (let b = 0; b < Math.ceil(len); b++) engine.perc.click(t0 + b * spb, b % meter === 0, engine.bus.preview, b % meter === 0 ? 1 : 0.6);
    if (spec.voice) for (const [t, d] of spec.rhythm) engine.playEvent({ midi: 64, inst: 'guide', vel: 0.7 }, t0 + t * spb, d * spb * 0.9, engine.bus.preview);
  }
  return t0;
}

const rich = (text) => String(text).split(/(\*\*[^*]+\*\*)/g).map((p) => (p.startsWith('**') ? html`<b>${p.slice(2, -2)}</b>` : p));
function Para({ text }) { return html`<p class="lesson-text">${rich(text)}</p>`; }

function Keys({ from, to, highlight = [], labels }) {
  const whites = [];
  for (let m = from; m <= to; m++) if ([0, 2, 4, 5, 7, 9, 11].includes(m % 12)) whites.push(m);
  const wW = 100 / whites.length;
  const blacks = [];
  whites.forEach((w, i) => { if ([0, 2, 5, 7, 9].includes(w % 12) && w + 1 <= to) blacks.push({ m: w + 1, left: (i + 1) * wW - wW * 0.3 }); });
  const hl = new Set(highlight);
  const style = state.settings.notation === 'solf' ? 'cz' : state.settings.notation;
  return html`<div class="kbd" style="height:130px;margin:8px 0">
    ${whites.map((m) => html`<div class=${'w' + (hl.has(m) ? ' on' : '')} onPointerDown=${(e) => { e.preventDefault(); engine.previewNote(m, 1.2); }}>${labels ? noteName(m, { style, octave: false }) : ''}</div>`)}
    ${blacks.map((b) => html`<div class=${'b' + (hl.has(b.m) ? ' on' : '')} style=${`left:${b.left}%;width:${wW * 0.6}%`} onPointerDown=${(e) => { e.preventDefault(); engine.previewNote(b.m, 1.2); }}>
      ${labels && hl.has(b.m) ? html`<span style="position:absolute;bottom:4px;left:0;right:0;text-align:center;color:#fff;font-size:10px;font-weight:800">${noteName(b.m, { style, octave: false })}</span>` : null}</div>`)}
  </div>`;
}

function RhythmViz({ pattern, meter = 4 }) {
  const len = Math.ceil(Math.max(...pattern.map(([t, d]) => t + d)));
  return html`<div style="position:relative;height:34px;margin:6px 0;background:var(--bg2);border-radius:10px;overflow:hidden">
    ${Array.from({ length: len }, (_, b) => html`<div style=${`position:absolute;top:0;bottom:0;left:${(b / len) * 100}%;width:1px;background:${b % meter === 0 ? '#c9c4b8' : '#e2ded5'}`}></div>`)}
    ${pattern.map(([t, d]) => html`<div style=${`position:absolute;top:8px;height:18px;border-radius:9px;background:var(--primary);left:calc(${(t / len) * 100}% + 2px);width:calc(${(d / len) * 100}% - 4px)`}></div>`)}
  </div>`;
}

function MiniRoll({ items }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const { ctx, w, h } = setupCanvas(cv);
    const its = items.map(([m, t, d, syl]) => ({ t, d, midi: m, syl }));
    const lo = Math.min(...its.map((i) => i.midi)) - 2, hi = Math.max(...its.map((i) => i.midi)) + 2;
    const curve = [];
    for (let b = 0; b <= 3.4; b += 0.05) { const it = its.find((i) => b >= i.t && b < i.t + i.d); if (it) curve.push({ b, m: it.midi + (b < 2 ? 0.05 : -0.45), s: b < 2 ? 'ok' : 'off' }); }
    drawRoll(ctx, w, h, { beat: () => 3.4, items: its, curve, lo, hi, keyPc: 0, notation: state.settings.notation, pxPerBeat: (w - 60) / 9, tol: 25, live: { midi: its[2].midi - 0.45, dev: -45, status: 'off' }, bpb: 4, results: {} });
  }, []);
  return html`<canvas ref=${ref} class="fill" style="height:190px;margin:8px 0"></canvas>`;
}

export function TheoryLessonScreen({ id }) {
  const l = theoryById(id);
  if (!l) return html`<div class="screen"><${TopBar} title="Lekce nenalezena" backTo="/course?part=theory" /></div>`;
  return html`<${TheoryLessonInner} key=${id} l=${l} />`;
}

function TheoryLessonInner({ l }) {
  const c = theoryChapter(l.chapter);
  const quizzes = l.blocks.map((b, i) => (b.t === 'quiz' ? i : -1)).filter((i) => i >= 0);
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(null);
  const idx = ALL_THEORY.findIndex((x) => x.id === l.id);
  const next = ALL_THEORY[idx + 1];
  const allAnswered = quizzes.every((i) => answers[i] != null);
  const finish = async () => {
    const correct = quizzes.filter((i) => answers[i] === l.blocks[i].answer).length;
    const score = quizzes.length ? Math.round((correct / quizzes.length) * 100) : 100;
    const stars = starsFor(score);
    const p = state.progress;
    p.theory = p.theory || {};
    const prev = p.theory[l.id] || { stars: 0, best: 0 };
    p.theory[l.id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score), last: new Date().toISOString() };
    const badges = recordAttempt(p, { type: 'theory', id: l.id, score, stars, seconds: 120 });
    await saveProgress();
    setDone({ score, stars, correct, total: quizzes.length, badges });
    if (window.zpTest) window.zpTest.lastResult = { kind: 'theory', overall: score };
  };
  return html`<div class="screen">
    <${TopBar} title=${l.title} sub=${`Hudební nauka · ${c.n}. ${c.title}`} backTo=${'/theory/' + c.id} />
    <div class="col">${l.blocks.map((b, i) => {
      if (b.t === 'p') return html`<div class="card"><${Para} text=${b.text} /></div>`;
      if (b.t === 'tip') return html`<div class="pill-tip">💡 ${rich(b.text)}</div>`;
      if (b.t === 'play') return html`<button class="btn block" style="justify-content:flex-start" onClick=${() => playNotes(b)}>🔊 ${b.label}</button>`;
      if (b.t === 'rhythm') return html`<div class="card tight"><div class="row between"><b class="small">${b.label}</b><button class="btn sm" onClick=${() => playNotes({ rhythm: b.pattern, bpm: b.bpm, meter: b.meter, voice: b.voice })}>▶ Přehrát</button></div><${RhythmViz} pattern=${b.pattern} meter=${b.meter || 4} /></div>`;
      if (b.t === 'keys') return html`<div class="card tight"><${Keys} ...${b} /><div class="tiny dim">Klepni na klávesu – uslyšíš ji.</div></div>`;
      if (b.t === 'roll') return html`<div class="card tight"><${MiniRoll} items=${b.items} /><div class="tiny dim">Zelená část křivky je přesně, červená s ▼ je moc nízko.</div></div>`;
      if (b.t === 'quiz') {
        const a = answers[i];
        return html`<div class="card"><div class="label-caps mb8">Otázka</div><b>${b.q}</b>
          ${b.play ? html`<button class="btn sm mt8" onClick=${() => playNotes(b.play)}>🔊 Přehrát</button>` : null}
          <div class="col mt8" style="gap:8px">${b.options.map((o, k) => {
            const cls = a == null ? '' : k === b.answer ? ' good' : k === a ? ' danger' : '';
            return html`<button class=${'btn block' + cls} disabled=${a != null && k !== a && k !== b.answer} onClick=${() => a == null && setAnswers({ ...answers, [i]: k })}>${a != null && k === b.answer ? '✓ ' : a === k ? '✕ ' : ''}${o}</button>`;
          })}</div>
          ${a != null ? html`<div class=${'small mt8 ' + (a === b.answer ? 'c-good' : 'c-bad')}>${a === b.answer ? 'Správně!' : 'Ne tak docela – správná odpověď je zelená.'}</div>` : null}</div>`;
      }
      return null;
    })}</div>
    ${done ? html`<div class="card hero center mt16"><div style="font-size:40px">${done.stars >= 3 ? '🎉' : done.stars >= 1 ? '👍' : '📖'}</div>
      <h2>${done.correct} z ${done.total} správně</h2><div class="mt8"><${Stars} n=${done.stars} /></div>
      ${done.badges?.length ? html`<div class="small mt8">🏅 ${done.badges.map((b) => b.title).join(', ')}</div>` : null}</div>` : null}
    <div class="bottom-actions">
      ${!done ? html`<button class="btn primary big block" disabled=${!allAnswered} onClick=${finish}>${allAnswered ? '✓ Hotovo' : `Odpověz na otázky (${Object.keys(answers).length}/${quizzes.length})`}</button>`
        : next ? html`<button class="btn primary big block" onClick=${() => navigate('/tlesson/' + next.id)}>Další: ${next.title} →</button>` : html`<button class="btn primary big block" onClick=${() => navigate('/course?part=theory')}>Zpět na Hudební nauku</button>`}
    </div>
  </div>`;
}
