// Pomocné funkce importu bez prohlížeče (testovatelné v Node): název ze jména souboru, řádky textu, posun originální stopy.
import { parseLrc } from './analysis.js';

export function parseFileName(name) {
  const base = String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').replace(/^\d{1,3}\s*[.\-–]\s*/, '').trim();
  const m = base.split(/\s+[-–—]\s+/);
  if (m.length >= 2) return { artist: m[0].trim(), title: m.slice(1).join(' - ').trim() };
  return { artist: '', title: base };
}
/** Text → řádky pro zarovnání; synchronizovaný text posune o začátek úseku. */
export function lyricsLines(lyr, offset = 0) {
  if (!lyr) return [];
  if (lyr.synced) {
    const lines = parseLrc(lyr.synced).map((l) => ({ ...l, time: l.time - offset })).filter((l) => l.time > -1 && l.text);
    if (lines.length >= 2) return lines;
  }
  return plainLines(lyr.plain || '');
}
export const plainLines = (text) => String(text || '').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !/^\[.*\]$/.test(s)).map((text) => ({ text }));

/** Posun originální stopy: stejná výšková třída jako melodie, ale nejvýš o ±6 půltónů (oktávu nepřesouváme). */
export const stemShift = (shift) => ((((shift % 12) + 18) % 12) + 12) % 12 - 6;
