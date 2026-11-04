// Knihovna skutečných písní: české lidové, dětské, koledy a písně ze světa – vše volné dílo (lidové nebo autoři zemřelí před víc než 70 lety).
// Zápis stejný jako v songs.js: [melodie, text (nebo pole slok), akordy] = jedna fráze.
import { compileSong } from '../core/song.js';

const FOLK = { melody: 'lidová', lyrics: 'lidový' };
function part(type, lines, name, pickup) {
  const melody = lines.map((l) => l[0]).join(' | ');
  const chords = lines.map((l) => l[2]).join(' | ');
  const stanzas = Array.isArray(lines[0][1]) ? lines[0][1].length : 1;
  const lyrics = [];
  for (let s = 0; s < stanzas; s++) lyrics.push(lines.map((l) => (Array.isArray(l[1]) ? l[1][s] : l[1])).join(' / '));
  return { type, name, melody, chords, lyrics: stanzas > 1 ? lyrics : lyrics[0], pickup };
}
function song(meta, ...sections) {
  const secs = [];
  if (meta.intro) secs.push({ type: 'intro', chords: meta.intro });
  secs.push(...sections);
  if (meta.outro) secs.push({ type: 'outro', chords: meta.outro });
  return compileSong({ credits: FOLK, ...meta, sections: secs });
}

export const LIBRARY = [];
