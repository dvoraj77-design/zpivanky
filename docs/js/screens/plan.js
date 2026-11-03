// Dnešní trénink: sled položek (rozezpívka → slabé místo → lekce → píseň → sluch).
import { html, useState, useMemo, navigate, TopBar, Stars } from '../ui/common.js';
import { dailyPlan, lessonState } from '../core/progress.js';
import { state, allSongs, findSong } from '../state.js';
import { lessonById } from '../data/course.js';
import { exercisePlan, exerciseSessionOpts, songSessionOpts } from '../app/builders.js';
import { recommendShifts } from '../core/voice.js';
import { RunScreen, BreathRun } from './run.js';
import { EarQuiz } from './ear.js';
import { saveAttempt } from '../app/record.js';

export function PlanScreen({ minutes }) {
  const mins = parseInt(minutes, 10) || 10;
  const items = useMemo(() => dailyPlan(state.progress, mins, allSongs().filter((s) => s.source !== 'custom'), state.profile), [mins]);
  const [idx, setIdx] = useState(-1);
  const [scores, setScores] = useState({});
  const [seed] = useState(() => Date.now());
  const it = items[idx];
  const finish = (i, r) => setScores((s) => ({ ...s, [i]: r?.overall ?? null }));
  const nextBtn = idx + 1 < items.length ? { label: `Dál: ${items[idx + 1].title} →`, go: () => setIdx(idx + 1) } : { label: 'Dokončit trénink ✓', go: () => setIdx(items.length) };
  const runOpts = useMemo(() => {
    if (!it) return null;
    const spec = it.kind === 'lesson' ? lessonById(it.id).ex : it.ex;
    if (it.kind === 'song') {
      const song = findSong(it.id);
      const shift = state.progress.songs[song.id]?.lastShift ?? recommendShifts(song.notes, state.profile)[0].shift;
      return { song: true, opts: songSessionOpts(song, { shift, mode: 'sing', factor: state.settings.songTempo ?? 0.7 }), shift };
    }
    if (!spec || ['earInterval', 'breath', 'voicetest'].includes(spec.type)) return { spec };
    return { spec, opts: exerciseSessionOpts(exercisePlan(spec, seed + idx)) };
  }, [idx]);
  if (idx >= 0 && idx < items.length && runOpts) {
    const title = it.title;
    const type = it.kind === 'lesson' ? 'lesson' : it.kind === 'song' ? 'song' : 'warmup';
    const onResult = async (r) => { finish(idx, r); return saveAttempt(r, { type, id: it.id, title, opts: runOpts.opts, mode: 'sing', shift: runOpts.shift }); };
    const exit = () => setIdx(-1);
    const spec = runOpts.spec;
    if (spec?.type === 'voicetest') return html`<div class="screen"><${TopBar} title=${title} onBack=${exit} />
      <div class="card"><p>Tahle lekce je test hlasu (asi 3 minuty). Změří tvůj rozsah a nastaví tóninu.</p></div>
      <div class="col mt16"><button class="btn primary big block" onClick=${() => navigate('/voicetest?lesson=' + it.id)}>🎙️ Spustit test hlasu</button>
        <button class="btn block" onClick=${() => nextBtn.go()}>Přeskočit</button></div></div>`;
    if (spec?.type === 'earInterval') return html`<${EarQuiz} key=${idx} spec=${spec} title=${title} onExit=${exit} onResult=${onResult} next=${nextBtn} />`;
    if (spec?.type === 'breath') return html`<${BreathRun} key=${idx} target=${spec.target} steady=${spec.steady} title=${title} onExit=${exit} onResult=${onResult} next=${nextBtn} />`;
    const song = runOpts.song ? findSong(it.id) : null;
    return html`<${RunScreen} key=${idx} opts=${runOpts.opts} title=${title} sub=${`Dnešní trénink · ${idx + 1}/${items.length}`} onExit=${exit} onResult=${onResult} next=${nextBtn}
      karaoke=${song && state.settings.lyricsMode === 'text' ? runOpts.opts.song.lyrics : null} allowMix=${!!song} guideToggle=${true} />`;
  }
  const done = idx >= items.length;
  const icon = { warmup: '🔥', drill: '🎯', lesson: '📘', song: '🎵', ear: '👂' };
  return html`<div class="screen">
    <${TopBar} title=${`Dnešní trénink · ${mins} min`} backTo="/" />
    ${done ? html`<div class="card hero center mb16"><div style="font-size:44px">🎉</div><h2>Hotovo!</h2><p class="mt8">Skvělá práce. Napij se vody a dej hlasu chvíli odpočinout.</p></div>` : null}
    <div class="list">${items.map((x, i) => html`<button class="item" onClick=${() => setIdx(i)}>
      <div class="ic">${scores[i] != null ? '✓' : icon[x.kind]}</div>
      <div class="grow"><div class="t">${x.title}</div><div class="s">${{ warmup: 'Rozezpívka', drill: 'Slabé místo', lesson: 'Lekce', song: 'Píseň', ear: 'Sluch' }[x.kind]} · ~${x.minutes} min${scores[i] != null ? ` · ${scores[i]} b.` : ''}</div></div>
      ${x.kind === 'lesson' ? html`<${Stars} n=${lessonState(state.progress, x.id).stars || 0} />` : html`<div class="chev">›</div>`}</button>`)}</div>
    <div class="bottom-actions">${done ? html`<button class="btn primary big block" onClick=${() => navigate('/', true)}>Zpět na Dnes</button>`
      : html`<button class="btn primary big block" onClick=${() => setIdx(Object.keys(scores).length < items.length ? items.findIndex((_, i) => scores[i] == null) : 0)}>▶ ${Object.keys(scores).length ? 'Pokračovat' : 'Začít trénink'}</button>`}</div>
  </div>`;
}
