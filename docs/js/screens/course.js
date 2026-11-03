// Kurz: kapitoly, lekce, úvod lekce, spuštění cvičení.
import { html, useState, useMemo, useAppState, navigate, TopBar, Stars, Sheet, toast, fmtNote } from '../ui/common.js';
import { CHAPTERS, lessonById, chapterById, ALL_LESSONS } from '../data/course.js';
import { isUnlocked, lessonState, chapterProgress, skipTo, nextLesson } from '../core/progress.js';
import { state, saveProgress, findSong } from '../state.js';
import { EXERCISE_TYPES } from '../core/exercises.js';
import { exercisePlan, exerciseSessionOpts } from '../app/builders.js';
import { RunScreen, BreathRun } from './run.js';
import { EarQuiz } from './ear.js';
import { saveAttempt } from '../app/record.js';
import { engine } from '../audio/engine.js';
import { keyName } from '../core/music.js';

export function CourseScreen() {
  const st = useAppState();
  const nl = nextLesson(st.progress);
  return html`<div class="screen">
    <h1 class="mb8">Kurz</h1>
    <p class="muted small">10 kapitol, 50 lekcí – od prvního tónu k čistému zpěvu písní.</p>
    <a class="item mt16" href=${'#/lesson/' + nl.id} style="background:linear-gradient(135deg,#dff3ea,#dce9fa);box-shadow:none">
      <div class="ic">▶</div><div class="grow"><div class="s">Pokračovat</div><div class="t">${nl.title}</div></div><div class="chev">›</div></a>
    <div class="list mt16">${CHAPTERS.map((c) => {
      const pr = chapterProgress(st.progress, c.id);
      const unlocked = isUnlocked(st.progress, c.lessons[0].id);
      return html`<a class=${'item' + (unlocked ? '' : ' locked')} href=${'#/course/' + c.id}>
        <div class="ic">${unlocked ? c.icon : '🔒'}</div>
        <div class="grow"><div class="t">${c.n}. ${c.title}</div><div class="s ellipsis">${c.intro}</div>
          <div class="bar mt8"><i style=${`width:${(pr.stars / pr.max) * 100}%`}></i></div></div>
        <div class="col center" style="gap:0"><span class="small" style="font-weight:800">${pr.done}/${pr.total}</span><span class="tiny dim">★ ${pr.stars}</span></div>
      </a>`;
    })}</div>
  </div>`;
}

export function ChapterScreen({ id }) {
  const st = useAppState();
  const c = chapterById(id);
  const [ask, setAsk] = useState(null);
  if (!c) return html`<div class="screen"><${TopBar} title="Kapitola nenalezena" backTo="/course" /></div>`;
  return html`<div class="screen">
    <${TopBar} title=${`${c.n}. ${c.title}`} sub=${c.intro} backTo="/course" />
    <div class="list">${c.lessons.map((l, i) => {
      const ls = lessonState(st.progress, l.id);
      const un = isUnlocked(st.progress, l.id);
      return html`<button class=${'item' + (un ? '' : ' locked')} onClick=${() => (un ? navigate('/lesson/' + l.id) : setAsk(l))}>
        <div class="ic">${un ? i + 1 : '🔒'}</div>
        <div class="grow"><div class="t">${l.title}</div><div class="s">${EXERCISE_TYPES[l.ex.type]}${ls.best ? ` · nejlepší ${ls.best}` : ''}</div></div>
        <${Stars} n=${ls.stars || 0} />
      </button>`;
    })}</div>
    ${c.songs?.length ? html`<div class="section-title">Písně k procvičení</div><div class="list">${c.songs.map((sid) => { const s = findSong(sid); return s ? html`<a class="item" href=${'#/song/' + s.id}><div class="ic">🎵</div><div class="grow"><div class="t">${s.title}</div><div class="s">Úroveň ${s.level} · ${s.practices.join(', ')}</div></div><div class="chev">›</div></a>` : null; })}</div>` : null}
    ${ask ? html`<${Sheet} onClose=${() => setAsk(null)}>
      <h2>Lekce je zamčená</h2><p class="muted mt8">Další lekce se odemkne, když předchozí splníš aspoň na 1★. Pokud ji umíš, můžeš lekce přeskočit.</p>
      <button class="btn primary block mt16" onClick=${async () => { skipTo(st.progress, ask.id); await saveProgress(); const id2 = ask.id; setAsk(null); navigate('/lesson/' + id2); }}>Přeskočit sem</button>
      <button class="btn block mt8" onClick=${() => setAsk(null)}>Zpět</button>
    </${Sheet}>` : null}
  </div>`;
}

export function LessonScreen({ id }) {
  const l = lessonById(id);
  if (!l) return html`<div class="screen"><${TopBar} title="Lekce nenalezena" backTo="/course" /></div>`;
  return html`<${LessonInner} key=${id} id=${id} l=${l} />`;
}
function LessonInner({ id, l }) {
  const st = useAppState();
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(() => Date.now());
  const runOpts = useMemo(() => (['earInterval', 'breath', 'voicetest'].includes(l.ex.type) ? null : exerciseSessionOpts(exercisePlan(l.ex, seed))), [id, seed, running]);
  const ch = chapterById(l.chapter);
  const idx = ALL_LESSONS.findIndex((x) => x.id === id);
  const nextL = ALL_LESSONS[idx + 1];
  const ls = lessonState(st.progress, id);
  const exit = () => { setRunning(false); };
  const onResult = (r) => saveAttempt(r, { type: 'lesson', id, title: l.title, opts: r._opts });
  const next = nextL ? { label: `Další lekce: ${nextL.title} →`, go: () => { setRunning(false); navigate('/lesson/' + nextL.id); } } : null;
  if (l.ex.type === 'voicetest') {
    return html`<div class="screen">
      <${TopBar} title=${l.title} sub=${`Kapitola ${ch.n} · ${ch.title}`} backTo=${'/course/' + ch.id} />
      <div class="card"><p class="lesson-text">${l.text}</p></div>
      <div class="bottom-actions"><button class="btn primary big block" onClick=${() => navigate('/voicetest?lesson=' + id)}>Spustit test hlasu</button></div>
    </div>`;
  }
  if (running) {
    if (l.ex.type === 'earInterval') return html`<${EarQuiz} spec=${l.ex} title=${l.title} onExit=${exit} onResult=${onResult} next=${next} />`;
    if (l.ex.type === 'breath') return html`<${BreathRun} target=${l.ex.target} steady=${l.ex.steady} title=${l.title} onExit=${exit} onResult=${onResult} next=${next} />`;
    const opts = runOpts;
    return html`<${RunScreen} key=${seed} opts=${opts} title=${l.title} sub=${`${ch.n}. ${ch.title} · ${EXERCISE_TYPES[l.ex.type]}`} onExit=${exit}
      onResult=${(r) => { r._opts = opts; return onResult(r); }} next=${next} />`;
  }
  const demo = async () => {
    const plan = exercisePlan(l.ex, seed);
    if (plan.kind === 'ear' || plan.kind === 'breath') return;
    const notes = plan.items.filter((i) => !i.listen).slice(0, 12);
    if (!notes.length) return;
    const t0 = notes[0].t;
    await engine.previewSequence(notes.map((n) => ({ midi: n.midi, toMidi: n.toMidi, t: n.t - t0, d: n.d * 0.95 })), 60 / plan.tempo, plan.kind === 'rhythm' ? 'guide' : 'guide');
  };
  const p = st.profile;
  return html`<div class="screen">
    <${TopBar} title=${l.title} sub=${`Kapitola ${ch.n} · ${ch.title}`} backTo=${'/course/' + ch.id} />
    <div class="row mb16"><span class="badge">${EXERCISE_TYPES[l.ex.type]}</span><${Stars} n=${ls.stars || 0} />${ls.best ? html`<span class="small muted">nejlepší ${ls.best}</span>` : null}</div>
    <div class="card"><p class="lesson-text" style="margin:0">${l.text}</p></div>
    ${!['earInterval', 'breath'].includes(l.ex.type) ? html`<div class="card tight mt16 small row between">
      <span>Pracovní tónina: <b>${keyName(p.workingTonic % 12, st.settings.notation === 'solf' ? 'cz' : st.settings.notation).replace(' dur', '')}</b> (do = ${fmtNote(p.workingTonic)})</span>
      <span class="dim">${p.measured ? '' : 'výchozí'}</span></div>` : null}
    ${!p.measured ? html`<div class="card infoc mt16 small">Tip: udělej si <a href="#/voicetest">test hlasu</a>, aby cvičení sedělo přesně do tvého rozsahu.</div>` : null}
    <div class="col mt16">
      ${!['earInterval', 'breath'].includes(l.ex.type) ? html`<button class="btn block" onClick=${demo}>🔊 Poslechni ukázku</button>` : null}
    </div>
    <div class="bottom-actions"><button class="btn primary big block" onClick=${() => { setSeed(Date.now()); setRunning(true); }}>▶ Začít cvičení</button></div>
  </div>`;
}
