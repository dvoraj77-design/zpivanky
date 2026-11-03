// Dnes: denní trénink na jedno ťuknutí, pokračování v kurzu, série, rychlé nástroje.
import { html, useState, useAppState, navigate, Stars, fmtNote } from '../ui/common.js';
import { streak, minutesOn, nextLesson, dailyPlan, lessonState } from '../core/progress.js';
import { allSongs, findSong } from '../state.js';
import { profileSummary, typeInfo } from '../core/voice.js';
import { chapterById } from '../data/course.js';

export function HomeScreen() {
  const st = useAppState();
  const p = st.progress;
  const nl = nextLesson(p);
  const ch = chapterById(nl.chapter);
  const today = minutesOn(p);
  const goal = st.settings.dailyGoal;
  const sum = profileSummary(st.profile, st.settings.notation);
  const hour = new Date().getHours();
  const hello = hour < 10 ? 'Dobré ráno' : hour < 18 ? 'Dobrý den' : 'Dobrý večer';
  const s = streak(p);
  return html`<div class="screen">
    <div class="row between"><div><div class="small muted">${hello}</div><h1>Dnes</h1></div>
      <div class="row" style="gap:6px"><span class="badge y">🔥 ${s} ${s === 1 ? 'den' : s >= 2 && s <= 4 ? 'dny' : 'dní'}</span></div></div>
    <div class="card hero mt16">
      <div class="row between"><b>Dnešní trénink</b><span class="small">${today} / ${goal} min</span></div>
      <div class="bar mt8"><i style=${`width:${Math.min(100, (today / goal) * 100)}%`}></i></div>
      <p class="small muted mt8">Rozezpívka → slabé místo → lekce → píseň. Přizpůsobí se tomu, co ti dělá potíže.</p>
      <div class="grid3 mt8">${[5, 10, 20].map((m) => html`<button class="btn primary" onClick=${() => navigate('/plan/' + m)}>${m} min</button>`)}</div>
    </div>
    <div class="section-title">Pokračuj v kurzu</div>
    <a class="item" href=${'#/lesson/' + nl.id}><div class="ic">${ch.icon}</div><div class="grow"><div class="s">Kapitola ${ch.n} · ${ch.title}</div><div class="t">${nl.title}</div></div><${Stars} n=${lessonState(p, nl.id).stars || 0} /></a>
    ${!st.profile.measured ? html`<a class="item mt8" href="#/voicetest" style="outline:2px solid var(--accent)"><div class="ic">🎙️</div><div class="grow"><div class="t">Změř si hlas</div><div class="s">3 minuty – nastaví tóninu přesně pro tebe</div></div><div class="chev">›</div></a>` : null}
    <div class="section-title">Můj hlas</div>
    <a class="item" href="#/voice"><div class="ic">🎚️</div><div class="grow"><div class="t">${sum.key}</div><div class="s">${typeInfo(st.profile.type).name} · rozsah ${sum.range} · pohodlně ${sum.comfort}</div></div><div class="chev">›</div></a>
    <div class="section-title">Rychle</div>
    <div class="grid3">
      <a class="btn" href="#/tuner" style="flex-direction:column;min-height:76px">🎯<span class="small">Ladička</span></a>
      <a class="btn" href="#/tools/drone" style="flex-direction:column;min-height:76px">🎵<span class="small">Bourdon</span></a>
      <a class="btn" href="#/tools/metronome" style="flex-direction:column;min-height:76px">⏱️<span class="small">Metronom</span></a>
      <a class="btn" href="#/tools/piano" style="flex-direction:column;min-height:76px">🎹<span class="small">Klavír</span></a>
      <a class="btn" href="#/tools/scales" style="flex-direction:column;min-height:76px">🪜<span class="small">Stupnice</span></a>
      <a class="btn" href="#/ear" style="flex-direction:column;min-height:76px">👂<span class="small">Sluch</span></a>
    </div>
    <div class="card warnc small mt16">💧 Při zpěvu pij vodu a dělej pauzy. Když bolí v krku nebo chraptíš, přestaň a dej hlasu odpočinout.</div>
  </div>`;
}
