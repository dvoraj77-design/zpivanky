// Knihovna skutečných písní: české lidové, dětské, koledy a písně ze světa – vše volné dílo
// (lidové, nebo autoři zemřelí před víc než 70 lety). České písně a koledy podle notových zápisů z repozitáře
// mojzis/noticky (CC0 – volné dílo), mezinárodní písně podle obecně známých lidových nápěvů.
// Zápis jako v songs.js: [melodie, text (nebo pole slok), akordy] = jedna fráze; sec() = celý oddíl najednou
// (fráze podle „/“ v textu – hodí se, když fráze začíná předtaktem uprostřed taktu).
import { compileSong, songRange } from '../core/song.js';

const FOLK = { melody: 'lidová', lyrics: 'lidový' };
const NOTICKY = { melody: 'lidová (zápis mojzis/noticky, CC0)', lyrics: 'lidový' };

function part(type, lines, name, pickup) {
  const melody = lines.map((l) => l[0]).join(' | ');
  const chords = lines.map((l) => l[2]).join(' | ');
  const stanzas = Array.isArray(lines[0][1]) ? lines[0][1].length : 1;
  const lyrics = [];
  for (let s = 0; s < stanzas; s++) lyrics.push(lines.map((l) => (Array.isArray(l[1]) ? l[1][s] : l[1])).join(' / '));
  return { type, name, melody, chords, lyrics: stanzas > 1 ? lyrics : lyrics[0], pickup };
}
const sec = (type, melody, lyrics, chords, pickup) => ({ type, melody, lyrics, chords, pickup });
function song(meta, ...sections) {
  const secs = [];
  if (meta.intro) secs.push({ type: 'intro', chords: meta.intro });
  secs.push(...sections);
  if (meta.outro) secs.push({ type: 'outro', chords: meta.outro });
  const s = compileSong({ credits: FOLK, ...meta, sections: secs });
  // obtížnost podle rozsahu melodie
  const { lo, hi } = songRange(s);
  const span = hi - lo;
  s.level = meta.level || (span <= 7 ? 1 : span <= 9 ? 2 : span <= 12 ? 3 : 4);
  return s;
}

// ================= Lidové =================
const skakalPes = song({ id: 'skakal-pes', title: 'Skákal pes', category: 'lidove', tempo: 108, meter: '4/4', key: 'C', credits: NOTICKY,
  practices: ['opakované tóny', 'krokový pohyb'], description: 'Nejznámější česká dětská lidová píseň.', intro: 'C | G7', outro: 'G7 | C' },
part('verse', [
  ['G4/1 G E/2 | G/1 G E/2 | G/1 G A G | G/2 F', ['Ská-kal pes přes o-ves, přes ze-le-nou lou-ku,', 'Pej-sku náš, co dě-láš, žes tak ve-sel stá-le?'], 'C | C | C:2 F:2 | G7'],
  ['F4/1 F D/2 | F/1 F D/2 | F/1 F G F | F/2 E', ['šel za ním my-sli-vec, pé-ro na klo-bou-ku.', 'Řek bych vám, ne-vím sám, hop, a ská-kal dá-le.'], 'G7 | G7 | G7 | G7:2 C:2'],
]));

const staraBaba = song({ id: 'stara-baba-jede', title: 'Stará bába jede', category: 'lidove', tempo: 120, meter: '3/4', key: 'C', credits: NOTICKY,
  practices: ['rychlé osminy', 'skoky', 'vysoké tóny'], description: 'Rozverná lidová píseň s rychlými osminami.', intro: 'C | G7', outro: 'G7 | C' },
part('verse', [
  ['C5/0.5 B4 C5 G4 A B | C5/0.5 B4 C5 G4 A B | C5/1 G4 E | C/1 r/2', 'Sta-rá bá-ba je-de, sta-rá bá-ba je-de s~mar-ci-pá-nem.', 'C | C:2 G7:1 | C | C'],
  ['C5/0.5 B4 C5 G4 A B | C5/0.5 B4 C5 G4 A B | C5/1 G4 E | C/1 r/2', 'Sta-rej dě-děk za ní, sta-rej dě-děk za ní s~tu-li-pá-nem.', 'C | C:2 G7:1 | C | C'],
]),
part('chorus', [
  ['C5/2 D/1 | E D C | B4/2 C5/1 | D C B4', 'Bá-ba od-chá-zí, on jí nad-chá-zí,', 'C | C | G | G'],
  ['C5/0.5 B4 C5 G4 A B | C5/0.5 B4 C5 G4 A B', 'o-na do ko-mí-na, on ji na-po-mí-ná,', 'C | C:2 G7:1'],
  ['C5/1 G4 E | C/1 r/2', 'ať ne-blá-zní.', 'C | C'],
]));

// ================= Koledy =================
const pasliOvce = song({ id: 'pasli-ovce', title: 'Pásli ovce Valaši', category: 'koledy', tempo: 96, meter: '2/4', key: 'C', credits: NOTICKY,
  practices: ['skok o kvartu', 'krokový pohyb dolů'], description: 'Vánoční koleda s refrénem „hajdom, hajdom“.', intro: 'C | G7', outro: 'G7 | C' },
part('verse', [
  ['C5/1 G4 | G F | E F | G/2', ['Pá-sli ov-ce Va-la-ši', 'An-děl se jim u-ká-zal,'], 'C | G7 | C | C'],
  ['C5/1 G4 | G F | E D | C/2', ['při bet-lém-ské sa-la-ši.', 'do Bet-lé-ma jít ká-zal.'], 'C | G7 | C:1 G7:1 | C'],
  ['C4/1 E | E F | E D | E/2', ['Haj-dom, haj-dom, ty-dli-dom,', 'Haj-dom, haj-dom, ty-dli-dom,'], 'C | C | C:1 G7:1 | C'],
  ['C4/1 E | E F | E D | C/2', ['haj-dom, haj-dom, ty-dli-dom.', 'haj-dom, haj-dom, ty-dli-dom.'], 'C | C | C:1 G7:1 | C'],
]));

const stedrejVecer = song({ id: 'stedrej-vecer', title: 'Štědrej večer nastal', category: 'koledy', tempo: 92, meter: '2/4', key: 'C', credits: NOTICKY,
  practices: ['tercie', 'osminy'], description: 'Koleda, kterou se chodilo koledovat.', intro: 'C | G7', outro: 'G7 | C' },
part('verse', [
  ['C4/1 E | F/0.5 E D/1 | C/2', 'Štěd-rej ve-čer na-stal,', 'C | G7 | C'],
  ['E4/1 G | G/0.5 F F A', 'Štěd-rej ve-čer na-stal,', 'C | C:1 F:1'],
  ['D4/1 F | F/0.5 E E G', 'ko-le-dy při-chy-stal,', 'Dm | G7:1 C:1'],
  ['C4/1 E | F/0.5 E D/1 | C/2', 'ko-le-dy při-chy-stal.', 'C | G7 | C'],
]));

const bylaCesta = song({ id: 'byla-cesta', title: 'Byla cesta, byla ušlapaná', category: 'koledy', tempo: 84, meter: '3/4', key: 'C', credits: NOTICKY,
  practices: ['rozložený akord', 'malé tercie', 'stará stupnice'], description: 'Stará moravská koleda s neobvyklou melodií.', intro: 'Fm | C', outro: 'Fm | C' },
part('verse', [
  ['C4/0.5 E G/1 Bb | Ab/0.5 G F/1 G | E/1 C/2', 'By-la ces-ta, by-la u-šla-pa-ná,', 'C7 | Fm | C'],
  ['E4/0.5 E C/1 F | E/0.5 E C/1 F', 'kdo ju šla-pal, kdo ju šla-pal?', 'C | C'],
  ['F4/0.5 F G/1 F | E/1 C/2', 'Mat-ka Kris-ta Pá-na.', 'Fm | C'],
]));

const myTriKralove = song({ id: 'my-tri-kralove', title: 'My tři králové', category: 'koledy', tempo: 104, meter: '3/4', key: 'G', credits: NOTICKY,
  practices: ['předtakt', 'dlouhé tóny'], description: 'Tříkrálová koleda.', intro: 'G | D', outro: 'D | G' },
sec('verse', 'D4/1 | G/2 G/1 | G/2 B/1 | A/2 A/1 | B/3 | G/1 F# E | A/2 A/1 | D/1 E F# | G/3',
  'My tři krá-lo-vé jde-me k~vám, / štěs-tí, zdra-ví vin-šu-je-me vám.', 'D | G | G | D | G | G:1 D:1 Em:1 | D | D | G', 1));

const nesemVam = song({ id: 'nesem-vam-noviny', title: 'Nesem vám noviny', category: 'koledy', tempo: 100, meter: '3/4', key: 'D', credits: NOTICKY,
  practices: ['melismata (víc tónů na slabiku)', 'legato'], description: 'Jedna z nejznámějších českých koled.', intro: 'D | A', outro: 'A | D' },
part('verse', [
  ['A4/1 A/0.5 F#/0.5 B/0.5 G/0.5 | A/1 A/0.5 F#/0.5 B/0.5 G/0.5 | A/1 F#/0.5 A/0.5 E/0.5 F#/0.5 | D/2 r/1', 'Ne-sem _ vám _ no-vi- _ ny _ po-slou- _ chej- _ te,', 'D:2 G:1 | D:2 G:1 | D:2 A:1 | D'],
  ['A4/1 A/0.5 F#/0.5 B/0.5 G/0.5 | A/1 A/0.5 F#/0.5 B/0.5 G/0.5 | A/1 F#/0.5 A/0.5 E/0.5 F#/0.5 | D/2 r/1', 'z~Bet-lém- _ ské _ kra-ji- _ ny _ po-zor _ dej- _ te.', 'D:2 G:1 | D:2 G:1 | D:2 A:1 | D'],
  ['D4/1 F#/0.5 D/0.5 F#/0.5 A/0.5 | D/1 F#/0.5 D/0.5 E/0.5 A3/0.5', 'Slyš-te je pil-ně a ne-o-myl-ně,', 'D | D:2 A:1'],
  ['D4/1 F#/0.5 D/0.5 F#/0.5 A/0.5 | D/1 F#/0.5 D/0.5 E/0.5 A3/0.5', 'slyš-te je pil-ně a ne-o-myl-ně,', 'D | D:2 A:1'],
  ['A4/1 F#/0.5 A/0.5 E/0.5 F#/0.5 | D/3', 'roz-jí- _ mej- _ te.', 'D:2 A:1 | D'],
]));

const narodilSe = song({ id: 'narodil-se', title: 'Narodil se Kristus Pán', category: 'koledy', tempo: 92, meter: '4/4', key: 'C', credits: NOTICKY,
  practices: ['stoupání po stupnici', 'zvýšený tón'], description: 'Starobylá česká koleda.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['C4/1 C/0.5 D/0.5 E/1 F#/1 | G/1 G G/2 | F#/1 G A/2 | G/3 r/1', 'Na-ro- _ dil se Kris-tus Pán, ve-sel-me se.', 'C:3 D:1 | G | D | G'],
  ['G4/1 G F F | E E D/2 | E/1 F E D | C/3 r/1', 'Z~rů-že kví-tek vy-kvet nám, ra-duj-me _ se.', 'G7 | C:2 G:2 | C:3 G7:1 | C'],
]),
part('chorus', [
  ['E4/1 D E F | G/2 C/2', 'Z~ži-vo-ta čis-té-ho,', 'C | G:2 C:2'],
  ['E4/1 D E F | G/2 C/2', 'z~ro-du krá-lov-ské-ho', 'C | G:2 C:2'],
  ['C4/2 A/2 | G/1 F E D | C/3 r/1', 'nám, nám na-ro-dil _ se.', 'C:2 F:2 | G7:2 C:2 | C'],
]));

const pujdemSpolu = song({ id: 'pujdem-spolu', title: 'Půjdem spolu do Betléma', category: 'koledy', tempo: 88, meter: '2/4', key: 'F', credits: NOTICKY,
  practices: ['rychlé ozdoby', 'šestnáctiny'], description: 'Veselá koleda s „dujdaj“ jako na dudách.', intro: 'F | C7', outro: 'C7 | F' },
part('verse', [
  ['F4/0.5 F C C | A4/0.5 A F F', 'Pů-jdem spo-lu do Bet-lé-ma,', 'F | F'],
  ['B4/0.25 C5 D C B4 C5 D C | B4/0.25 C5 D B4 C5/1', 'duj- _ daj, _ duj- _ daj _ duj- _ daj _ dá.', 'G7 | G7:1 C:1'],
]),
part('chorus', [
  ['Bb4/0.5 Bb/0.25 D5/0.25 G4/1 | A4/0.5 A/0.25 C5/0.25 F4/1', 'Je-žíš- _ ku, pa-náč- _ ku,', 'Gm | F'],
  ['G4/0.5 G F/0.25 E D E | F/0.5 A F A', 'já tě bu- _ du _ ko-lé-ba-ti,', 'C7 | F'],
  ['Bb4/0.5 Bb/0.25 D5/0.25 G4/1 | A4/0.5 A/0.25 C5/0.25 F4/1', 'Je-žíš- _ ku, pa-náč- _ ku,', 'Gm | F'],
  ['G4/0.5 G F/0.25 E D E | F/0.5 A F/1', 'já tě bu- _ du _ ko-lé-bat.', 'C7 | F'],
]));

const stestiZdravi = song({ id: 'stesti-zdravi', title: 'Štěstí, zdraví, pokoj svatý', category: 'koledy', tempo: 104, meter: '2/4', key: 'D', credits: NOTICKY,
  practices: ['opakované tóny', 'osminy'], description: 'Koleda s přáním štěstí a zdraví.', intro: 'D | A', outro: 'A | D' },
part('verse', [
  ['A4/0.5 A A B | G G G A | F#/0.5 F# E E | D/1 r/1', 'Štěs-tí, zdra-ví, po-koj sva-tý vin-šu-je-me vám,', 'D | G | D:1 A:1 | D'],
  ['A4/0.5 A A B | G G G A | F#/0.5 F# E E | D/1 r/1', 'nej-prv pá-nu hos-po-dá-ři, pak va-šim dít-kám.', 'D | G | D:1 A:1 | D'],
]),
part('chorus', [
  ['F#4/0.5 F# F# E | F# B A/1 | F#/0.5 F# F# E | F# B A/1', 'Zda-le-ka se bé-ře-me, no-vi-nu vám ne-se-me,', 'D | Bm:1 A:1 | D | Bm:1 A:1'],
  ['A4/0.5 A A B | G G G A | F#/0.5 F# E E | D/1 r/1', 'co jest se nám při-ho-di-lo v~měs-tě Bet-lé-mě.', 'D | G | D:1 A:1 | D'],
]));

// ================= Dětské =================
const bratreKubo = song({ id: 'bratre-kubo', title: 'Bratře Kubo', category: 'detske', tempo: 100, meter: '4/4', key: 'F',
  practices: ['kánon', 'tercie', 'skoky dolů'], description: 'Francouzská lidová píseň (Frère Jacques) – dá se zpívat i jako kánon.', intro: 'F | C', outro: 'C | F' },
part('verse', [
  ['F4/1 G A F | F G A F', 'Bra-tře Ku-bo, bra-tře Ku-bo,', 'F | F'],
  ['A4/1 Bb C5/2 | A4/1 Bb C5/2', 'ješ-tě spíš? Ješ-tě spíš?', 'F | F'],
  ['C5/0.5 D C Bb4 A/1 F | C5/0.5 D C Bb4 A/1 F', 'Sly-šíš zvo-ny zní-ti, sly-šíš zvo-ny zní-ti,', 'F | F'],
  ['F4/1 C F/2 | F/1 C F/2', 'bim, bam, bom, bim, bam, bom.', 'F:1 C:1 F:2 | F:1 C:1 F:2'],
]));

const hodneStesti = song({ id: 'hodne-stesti', title: 'Hodně štěstí, zdraví', category: 'detske', tempo: 96, meter: '3/4', key: 'C',
  credits: { melody: 'M. a P. Hillovy (Happy Birthday, volné dílo)', lyrics: 'lidový' },
  practices: ['předtakt', 'skok o oktávu'], description: 'Narozeninová píseň – nápěv Happy Birthday.', intro: 'C | G7', outro: 'G7 | C' },
sec('verse', 'G4/1.5 G/0.5 | A/1 G C5 | B4/2 G/0.75 G/0.25 | A/1 G D5 | C5/2 G4/0.75 G/0.25 | G5/1 E C | B4 A F5/0.75 F/0.25 | E5/1 C D | C/3',
  'Hod-ně štěs-tí, zdra-ví, / hod-ně štěs-tí, zdra-ví, / hod-ně štěs-tí, všech-no nej, / hod-ně štěs-tí, zdra-ví!',
  'G | F:1 C:2 | G7 | Dm:1 G7:2 | C | C | G7:1 F:2 | C:2 G7:1 | C', 2));

const mary = song({ id: 'mary-little-lamb', title: 'Mary Had a Little Lamb', category: 'detske', tempo: 100, meter: '4/4', key: 'C',
  credits: { melody: 'lidová (USA)', lyrics: 'Sarah J. Hale (1830)' },
  practices: ['tři sousední tóny', 'angličtina'], description: 'Jednoduchá americká dětská píseň v angličtině.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['E4/1 D C D | E E E/2', 'Ma-ry had a lit-tle lamb,', 'C | C'],
  ['D4/1 D D/2 | E/1 G G/2', 'lit-tle lamb, lit-tle lamb,', 'G | C'],
  ['E4/1 D C D | E E E E', 'Ma-ry had a lit-tle lamb, its', 'C | C'],
  ['D4/1 D E D | C/4', 'fleece was white as snow.', 'G:2 C:1 G:1 | C'],
]));

const rowBoat = song({ id: 'row-your-boat', title: 'Row, Row, Row Your Boat', category: 'detske', tempo: 160, meter: '6/8', key: 'C',
  credits: { melody: 'lidová (USA, 19. stol.)', lyrics: 'lidový' },
  practices: ['takt 6/8', 'kánon', 'rozložený akord dolů'], description: 'Houpavá kánonová píseň v šestiosminovém taktu.', intro: 'C | G7', outro: 'G7 | C' },
part('verse', [
  ['C4/3 C | C/2 D/1 E/3', 'Row, row, row your boat,', 'C | C'],
  ['E4/2 D/1 E/2 F/1 | G/6', 'gent-ly down the stream.', 'C | C'],
  ['C5/1 C C G4 G G | E E E C C C', 'Mer-ri-ly, mer-ri-ly, mer-ri-ly, mer-ri-ly,', 'C | C'],
  ['G4/2 F/1 E/2 D/1 | C/6', 'life is but a dream.', 'G7:3 C:3 | C'],
]));

const oldMacdonald = song({ id: 'old-macdonald', title: 'Old MacDonald', category: 'detske', tempo: 112, meter: '4/4', key: 'G',
  credits: { melody: 'lidová (USA)', lyrics: 'lidový' },
  practices: ['opakované tóny', 'angličtina'], description: 'Veselá píseň o farmě.', intro: 'G | D7', outro: 'D7 | G' },
part('verse', [
  ['G4/1 G G D | E E D/2', 'Old Mac-Don-ald had a farm,', 'G | C:2 G:2'],
  ['B4/1 B A A | G/3 D/1', 'E- I- E- I- O, and', 'G:2 D7:2 | G'],
  ['G4/1 G G D | E E D/2', 'on his farm he had a cow,', 'G | C:2 G:2'],
  ['B4/1 B A A | G/4', 'E- I- E- I- O.', 'G:2 D7:2 | G'],
]));

const londonBridge = song({ id: 'london-bridge', title: 'London Bridge', category: 'detske', tempo: 104, meter: '4/4', key: 'C',
  credits: { melody: 'lidová (Anglie)', lyrics: 'lidový' },
  practices: ['tečkovaný rytmus', 'angličtina'], description: 'Anglická dětská píseň o londýnském mostě.', intro: 'C | G7', outro: 'G7 | C' },
part('verse', [
  ['G4/1.5 A/0.5 G/1 F | E F G/2', 'Lon-don Bridge is fal-ling down,', 'C | C'],
  ['D4/1 E F/2 | E/1 F G/2', 'fal-ling down, fal-ling down,', 'G7 | C'],
  ['G4/1.5 A/0.5 G/1 F | E F G/2', 'Lon-don Bridge is fal-ling down,', 'C | C'],
  ['D4/2 G/2 | E/1 C/3', 'my fair la-dy.', 'G7 | C'],
]));

// ================= Ze světa =================
const drunkenSailor = song({ id: 'drunken-sailor', title: 'Drunken Sailor', category: 'svet', tempo: 112, meter: '2/4', key: 'D', mode: 'minor', credits: { ...NOTICKY, melody: 'lidová (námořnická, zápis mojzis/noticky, CC0)' },
  practices: ['dórská stupnice', 'rytmus', 'angličtina'], description: 'Námořnická píseň (sea shanty).', intro: 'Dm | A', outro: 'C | Dm' },
part('verse', [
  ['A4/0.5 A/0.25 A A/0.5 A/0.25 A | A/0.5 D F A', 'What shall we do with the drun-ken sai-lor,', 'Dm | Dm'],
  ['G4/0.5 G/0.25 G G/0.5 G/0.25 G | G/0.5 C E G', 'what shall we do with the drun-ken sai-lor,', 'C | C'],
  ['A4/0.5 A/0.25 A A/0.5 A/0.25 A | A/0.5 B C5 D', 'what shall we do with the drun-ken sai-lor', 'Dm | Dm'],
  ['C5/0.5 A4 G E | D/1 D', 'ear-ly in the mor-ning?', 'C:1 Am:1 | Dm'],
]),
part('chorus', [
  ['A4/1 A/0.75 A/0.25 | A/0.5 D F A', 'Hoo-ray and up she ri-ses,', 'Dm | Dm'],
  ['G4/1 G/0.75 G/0.25 | G/0.5 C E G', 'hoo-ray and up she ri-ses,', 'C | C'],
  ['A4/1 A/0.75 A/0.25 | A/0.5 B C5 D', 'hoo-ray and up she ri-ses', 'Dm | Dm'],
  ['C5/0.5 A4 G E | D/1 D', 'ear-ly in the mor-ning.', 'C:1 Am:1 | Dm'],
]));

const saints = song({ id: 'when-the-saints', title: 'When the Saints Go Marching In', category: 'svet', tempo: 100, meter: '4/4', key: 'C', credits: { ...NOTICKY, melody: 'lidová (spirituál, zápis mojzis/noticky, CC0)' },
  practices: ['nástup po pauze', 'dlouhé tóny', 'angličtina'], description: 'Americký spirituál, slavný v podání jazzových kapel.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['r/1 C4/1 E F | G/4 | r/1 C E F | G/4', 'Oh when the saints go mar-ching in,', 'C | C | C | C'],
  ['r/1 C4/1 E F | G/2 E/2 | C/2 E/2 | D/4', 'oh when the saints go mar-ching in,', 'C | C | C | G'],
  ['r/1 E4/1 E D | C/3 C/1 | E/2 G/1 G | G/1 F/3', 'oh Lord, I want to be in that num-ber', 'C | C | C7 | C7:1 F:3'],
  ['r/2 E4/1 F | G/2 E/2 | C/2 D/2 | C/4', 'when the saints go mar-ching in.', 'C | C | C:2 G7:2 | C'],
]));

const jingleBells = song({ id: 'jingle-bells', title: 'Jingle Bells', category: 'svet', tempo: 116, meter: '4/4', key: 'C',
  credits: { melody: 'James Lord Pierpont (1857)', lyrics: 'James Lord Pierpont (1857)' },
  practices: ['opakované tóny', 'rytmus', 'angličtina'], description: 'Zimní píseň o saních – refrén.', intro: 'C | G7', outro: 'G7 | C' },
part('verse', [
  ['E4/1 E E/2 | E/1 E E/2 | E/1 G C/1.5 D/0.5 | E/4', 'Jin-gle bells, jin-gle bells, jin-gle all the way!', 'C | C | C | C'],
  ['F4/1 F F/1.5 F/0.5 | F/1 E E E/0.5 E/0.5 | E/1 D D E | D/2 G/2', 'Oh, what fun it is to ride in a one-horse o-pen sleigh, hey!', 'F | F:1 C:3 | C:2 G7:2 | G7'],
  ['E4/1 E E/2 | E/1 E E/2 | E/1 G C/1.5 D/0.5 | E/4', 'Jin-gle bells, jin-gle bells, jin-gle all the way!', 'C | C | C | C'],
  ['F4/1 F F F | F E E E/0.5 E/0.5 | G/1 G F D | C/4', 'Oh, what fun it is to ride in a one-horse o-pen sleigh!', 'F | F:1 C:3 | G7 | C'],
], 'Refrén'));

const yankee = song({ id: 'yankee-doodle', title: 'Yankee Doodle', category: 'svet', tempo: 104, meter: '2/4', key: 'G',
  credits: { melody: 'lidová (USA, 18. stol.)', lyrics: 'lidový' },
  practices: ['osminy', 'rychlé slabiky', 'angličtina'], description: 'Stará americká píseň s rychlým textem.', intro: 'G | D', outro: 'D | G' },
part('verse', [
  ['G4/0.5 G A B | G B A D', 'Yan-kee Doo-dle went to town a', 'G | G:1 D:1'],
  ['G4/0.5 G A B | G/1 F#/1', 'rid-ing on a po-ny,', 'G | G:1 D:1'],
  ['G4/0.5 G A B | C5 B4 A G', 'stuck a fea-ther in his cap and', 'G | C:1 G:1'],
  ['F#4/0.5 D E F# | G/1 G/1', 'called it ma-ca-ro-ni.', 'D | G'],
]));


const hotCrossBuns = song({ id: 'hot-cross-buns', title: 'Hot Cross Buns', category: 'detske', tempo: 96, meter: '4/4', key: 'C',
  credits: { melody: 'lidová (Anglie)', lyrics: 'lidový' },
  practices: ['tři tóny', 'angličtina'], description: 'Nejjednodušší píseň na tři tóny – první písnička pro úplné začátečníky.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['E4/1 D C/2 | E/1 D C/2', 'Hot cross buns! Hot cross buns!', 'C | C'],
  ['C4/0.5 C C C D D D D | E/1 D C/2', 'One a pen-ny, two a pen-ny, hot cross buns!', 'C:2 G:2 | C'],
]));

const auClair = song({ id: 'au-clair-de-la-lune', title: 'Au clair de la lune', category: 'svet', tempo: 96, meter: '4/4', key: 'C',
  credits: { melody: 'lidová (Francie, 18. stol.)', lyrics: 'lidový' },
  practices: ['krokový pohyb', 'francouzština'], description: 'Francouzská lidová píseň „Při světle měsíce“.', intro: 'C | G7', outro: 'G7 | C' },
part('verse', [
  ['C4/1 C C D | E/2 D/2', 'Au clair de la lu-ne,', 'C | C:2 G:2'],
  ['C4/1 E D D | C/4', 'mon a-mi Pier-rot,', 'C:2 G7:2 | C'],
  ['C4/1 C C D | E/2 D/2', 'prê-te-moi ta plu-me', 'C | C:2 G:2'],
  ['C4/1 E D D | C/4', 'pour é-crire un mot.', 'C:2 G7:2 | C'],
]),
part('chorus', [
  ['D4/1 D D D | A3/2 A/2', "Ma chan-del-l'est mor-te,", 'G | D7'],
  ['D4/1 C B3 A | G/4', "je n'ai plus de feu;", 'G | G'],
  ['C4/1 C C D | E/2 D/2', 'ou-vre-moi ta por-te', 'C | C:2 G:2'],
  ['C4/1 E D D | C/4', "pour l'a-mour de Dieu.", 'C:2 G7:2 | C'],
]));

const tichaNoc = song({ id: 'ticha-noc', title: 'Tichá noc (Stille Nacht)', category: 'koledy', tempo: 120, meter: '6/8', key: 'C',
  credits: { melody: 'Franz X. Gruber (1818)', lyrics: 'Joseph Mohr (1816)' },
  practices: ['takt 6/8', 'legato', 'vysoké tóny na konci'], description: 'Nejslavnější vánoční píseň, s původním německým textem.', intro: 'C | G7', outro: 'G7 | C' },
part('verse', [
  ['G4/3 A/1 G/2 | E/6 | G/3 A/1 G/2 | E/6', 'Stil-le Nacht, _ hei-li-ge Nacht,', 'C | C | C | C'],
  ['D5/4 D/2 | B4/6 | C5/4 C/2 | G4/6', 'al-les schläft, ein-sam wacht', 'G7 | G7 | C | C'],
  ['A4/4 A/2 | C5/3 B4/1 A/2 | G/3 A/1 G/2 | E/6', 'nur das trau-te hoch-hei-li-ge Paar.', 'F | F:3 G7:3 | C | C'],
  ['A4/4 A/2 | C5/3 B4/1 A/2 | G/3 A/1 G/2 | E/6', 'Hol-der Kna-be im lo-cki-gen Haar,', 'F | F:3 G7:3 | C | C'],
  ['D5/4 D/2 | F/3 D/1 B4/2 | C5/6 | E/6', 'schlaf in himm-li-scher Ruh, _', 'G7 | G7 | C | C'],
  ['C5/2 G4 E | G/3 F/1 D/2 | C/6', 'schlaf in himm-li-scher Ruh. _', 'C | G7 | C'],
]));

const cucaracha = song({ id: 'la-cucaracha', title: 'La Cucaracha', category: 'svet', tempo: 112, meter: '4/4', key: 'F', credits: { ...NOTICKY, melody: 'lidová (Mexiko, zápis mojzis/noticky, CC0)' },
  practices: ['předtakt', 'rytmus', 'španělština'], description: 'Mexická lidová píseň o švábovi.', intro: 'F | C7', outro: 'C7 | F' },
sec('verse', 'r/2.5 C4/0.5 C C | F/1.5 A/1 C/0.5 C C | F/1.5 A/0.5 A/2 | r/0.5 F/1 F/0.5 E E D D | C/2 r/0.5 C/0.5 C C | E/1.5 G/1 C/0.5 C C | E/1.5 G/0.5 G/2 | r/0.5 C5 C D C Bb4 A G | F/4',
  'La cu-ca- / ra-cha, la cu-ca-ra-cha _ ya no pue-de ca-mi-nar, / por-que no tie-ne, por-que le fal-ta _ las dos pa-ti-tas de a-trás.',
  'F | F | F | C7 | C7 | C7 | C7 | C7 | F'));

export const LIBRARY = [
  skakalPes, staraBaba,
  pasliOvce, stedrejVecer, bylaCesta, myTriKralove, nesemVam, narodilSe, pujdemSpolu, stestiZdravi,
  tichaNoc,
  bratreKubo, hodneStesti, mary, rowBoat, oldMacdonald, londonBridge, hotCrossBuns,
  drunkenSailor, saints, jingleBells, yankee, auClair, cucaracha,
];
