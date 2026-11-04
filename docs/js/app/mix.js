// Hlasitosti sběrnic podle nastavení (melodie, akordy, basa, bicí, metronom, příposlech).
import { engine } from '../audio/engine.js';
import { state } from '../state.js';

export const MIX_ROWS = [
  ['guide', 'Vodicí melodie', 'Nástroj, který hraje melodii, kterou zpíváš'],
  ['accomp', 'Doprovod – akordy', 'Klavír, kytara, smyčce, varhany'],
  ['bass', 'Basa', null],
  ['drums', 'Bicí', null],
  ['metro', 'Metronom a odpočet', null],
];
export const MIX_MAX = 1.6;

export function applyMix() {
  const m = state.settings.mix, b = engine.bus;
  if (!b) return;
  const set = (k, v) => { if (b[k]) b[k].gain.setTargetAtTime(Math.max(0, v ?? 1), engine.now, 0.03); };
  set('accomp', m.accomp); set('bass', m.bass ?? m.accomp); set('drums', m.drums ?? m.accomp);
  set('guide', state.settings.guideOn === false ? 0 : m.guide); set('metro', m.metro);
  engine.setMonitor(m.monitor > 0, m.monitor);
}
