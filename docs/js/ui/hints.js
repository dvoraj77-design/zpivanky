// Vysvětlivky pro úplné začátečníky (režim začátečníka, výchozí zapnutý; jednotlivé tipy jde skrýt).
import { html } from './common.js';
import { state, saveSettings } from '../state.js';

export function hintsOn() { return state.settings.beginner !== false; }

/** <Hint id="..." help="roll">text</Hint> */
export function Hint({ id, help, title = 'Pro začátečníky', children }) {
  if (!hintsOn() || (state.settings.hiddenHints || []).includes(id)) return null;
  return html`<div class="hint" role="note">
    <div class="row between"><b class="small">💡 ${title}</b>
      <button class="hint-x" aria-label="Skrýt tip" onClick=${() => saveSettings({ hiddenHints: [...(state.settings.hiddenHints || []), id] })}>✕</button></div>
    <div class="small mt8">${children}</div>
    ${help ? html`<a class="small" href=${'#/help?s=' + help}>Víc vysvětlení →</a>` : null}
  </div>`;
}

/** Malé tlačítko „?“ vedle nadpisu, otevře nápovědu na dané sekci. */
export function HelpBtn({ s, label = 'Nápověda' }) {
  return html`<a class="iconbtn" href=${'#/help?s=' + s} aria-label=${label} style="font-weight:900">?</a>`;
}
