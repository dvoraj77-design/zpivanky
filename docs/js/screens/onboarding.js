// První spuštění: vítej → sluchátka → mikrofon a úroveň → kalibrace → test hlasu.
import { html, useState, useEffect, navigate, MicGate, LevelMeter, Seg, useImmersive } from '../ui/common.js';
import { state, saveSettings } from '../state.js';
import { engine } from '../audio/engine.js';

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [hp, setHp] = useState(state.settings.activeHp);
  const [guess, setGuess] = useState(null);
  useImmersive();
  useEffect(() => { if (step === 2) engine.headphonesGuess().then(setGuess).catch(() => {}); }, [step]);
  const finish = async (to) => { await saveSettings({ onboarded: true }); navigate(to, true); };
  const steps = [
    () => html`<div class="center" style="padding-top:20px"><div style="font-size:72px">🎤</div><h1 style="font-size:34px">Zpívánky</h1>
      <p class="muted mt8">Nauč se zpívat čistě – krok za krokem.</p></div>
      <div class="list mt24">
        <div class="item"><div class="ic">🎯</div><div class="grow"><div class="t">Živá ladička</div><div class="s">vidíš, jak vysoko zpíváš</div></div></div>
        <div class="item"><div class="ic">📘</div><div class="grow"><div class="t">Kurz pro začátečníky</div><div class="s">50 lekcí s hodnocením</div></div></div>
        <div class="item"><div class="ic">🎵</div><div class="grow"><div class="t">24 písní s doprovodem</div><div class="s">automaticky ve tvé tónině</div></div></div>
        <div class="item"><div class="ic">🔒</div><div class="grow"><div class="t">Vše jen v telefonu</div><div class="s">bez účtu, bez internetu, nic se neodesílá</div></div></div>
      </div>`,
    () => html`<h1>Zpívej se sluchátky</h1>
      <div class="card mt16"><p><b>Použij sluchátka s mikrofonem (headset).</b> Mikrofon u pusy dá čistší signál a doprovod ze sluchátek se nedostane do mikrofonu – hodnocení je pak přesné.</p>
        <p class="small muted">Nejlepší jsou drátová sluchátka (jack / USB-C). Bluetooth sluchátka mají zpoždění (100–300 ms) a jejich mikrofon zní hůř.</p></div>
      <div class="card warnc mt16 small"><b>Máš Bluetooth sluchátka (např. Nothing Ear (a))?</b> Poslouchej přes ně, ale zpívej do <b>mikrofonu telefonu</b> – jinak Android přepne sluchátka do hovorového režimu a zvuk zhorší. V aplikaci Nothing X zapni „Low Lag Mode“.</div>
      <p class="small muted mt16">Bez sluchátek funguje ladička a cvičení bez doprovodu; u písní použiju režim „poslechni → zazpívej“.</p>`,
    () => html`<h1>Co používáš?</h1>
      <div class="list mt16">${state.settings.hpProfiles.map((h) => html`<button class="item" style=${hp === h.id ? 'outline:2px solid var(--accent)' : ''} onClick=${() => setHp(h.id)}>
        <div class="ic">${h.type === 'bt' ? '🎧' : h.type === 'wired' ? '🔌' : '🔈'}</div><div class="grow"><div class="t">${h.name}</div><div class="s">${h.type === 'bt' ? 'poslech přes sluchátka, zpěv do telefonu' : h.type === 'wired' ? 'nejmenší zpoždění' : 'bez sluchátek'}</div></div>${hp === h.id ? html`<span class="c-acc">●</span>` : null}</button>`)}</div>
      ${guess?.any ? html`<p class="small muted mt8">Zjistil jsem připojená ${guess.bt ? 'Bluetooth ' : ''}sluchátka.</p>` : null}`,
    () => html`<h1>Mikrofon</h1><p class="muted mt8">Povol mikrofon. Zvuk zpracovávám jen v telefonu.</p>
      <${MicGate}><div class="card mt16"><p class="small">Řekni něco nebo zazpívej – ukazatel by se měl hýbat:</p><${LevelMeter} /><div class="small muted mt16">Mikrofon: <b>${engine.mic.label}</b></div></div></${MicGate}>`,
    () => html`<h1>Skoro hotovo</h1>
      <div class="card mt16"><p>Doporučuji dva krátké kroky:</p><ol><li><b>Kalibrace zpoždění</b> (10 s) – aby seděl rytmus.</li><li><b>Test hlasu</b> (3 min) – aby cvičení i písně seděly do tvého rozsahu.</li></ol>
        <p class="small muted">Obojí můžeš udělat i později v Já.</p></div>
      <div class="col mt16"><button class="btn block" onClick=${() => finish('/calibrate')}>⏱️ Kalibrace zpoždění</button>
        <button class="btn primary block big" onClick=${() => finish('/voicetest')}>🎙️ Test hlasu</button>
        <button class="btn ghost block" onClick=${() => finish('/')}>Přeskočit, chci zpívat</button></div>`,
  ];
  const last = step === steps.length - 1;
  return html`<div class="screen full">
    <div class="progress-seg mb16" style="margin-top:8px">${steps.map((_, i) => html`<i style=${`background:${i <= step ? '#ffc928' : '#3a2f7a'}`}></i>`)}</div>
    ${steps[step]()}
    ${!last ? html`<div class="bottom-actions mt24">${step > 0 ? html`<button class="btn" onClick=${() => setStep(step - 1)}>←</button>` : html`<button class="btn ghost" onClick=${() => finish('/')}>Přeskočit</button>`}
      <button class="btn primary big grow" onClick=${async () => { if (step === 2) await saveSettings({ activeHp: hp, headphones: state.settings.hpProfiles.find((h) => h.id === hp)?.type === 'speaker' ? 'no' : 'yes' }); setStep(step + 1); }}>Pokračovat</button></div>` : null}
  </div>`;
}
