// Knihovna písní. Melodie jsou původní (Zpívánky) nebo autorsky volné (uvedeno v credits).
// Zápis: melodie „nota+oktáva/doby“ (oktáva i délka se pamatují), takty „|“, slabiky „-“, „~“ = spojení slov (k~nám),
// akordy po taktech. Každý řádek = [melodie, text (nebo pole slok), akordy] = jedna fráze.
import { compileSong } from '../core/song.js';

const OWN = { melody: 'Zpívánky (původní)', lyrics: 'Zpívánky (původní)' };

function part(type, lines, name) {
  const melody = lines.map((l) => l[0]).join(' | ');
  const chords = lines.map((l) => l[2]).join(' | ');
  const stanzas = Array.isArray(lines[0][1]) ? lines[0][1].length : 1;
  const lyrics = [];
  for (let s = 0; s < stanzas; s++) lyrics.push(lines.map((l) => (Array.isArray(l[1]) ? l[1][s] : l[1])).join(' / '));
  return { type, name, melody, chords, lyrics: stanzas > 1 ? lyrics : lyrics[0] };
}
function song(meta, ...sections) {
  const secs = [];
  if (meta.intro) secs.push({ type: 'intro', chords: meta.intro });
  secs.push(...sections);
  if (meta.outro) secs.push({ type: 'outro', chords: meta.outro });
  return compileSong({ credits: OWN, ...meta, sections: secs });
}

// ---------------- Úroveň 1 ----------------
const triTony = song({ id: 'tri-tony', title: 'Tři tóny', level: 1, tempo: 72, meter: '4/4', key: 'C', chapter: 3,
  practices: ['trefení tónu', 'tři sousední tóny'], description: 'Jen do, re, mi – ideální první píseň.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['C4/1 D E/2 | E/1 D C/2', 'Zpí-vám rád, zpí-vám teď,', 'C | C'],
  ['C/1 D E D | C/4', 'tó-ny tři si dám.', 'C:3 G:1 | C'],
  ['E/1 D C D | E/1 E E/2', 'Kro-kem jdu a ne-spě-chám,', 'C | C'],
  ['D/1 D E D | C/4', 'tón za tó-nem znám.', 'G C | C'],
]));

const ukolebavka = song({ id: 'ukolebavka', title: 'Ukolébavka', level: 1, tempo: 76, meter: '3/4', key: 'C', chapter: 4,
  practices: ['držení tónu', 'legato'], description: 'Klidná houpavá melodie na dlouhé tóny.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['E4/2 D/1 | E/2 D/1 | E/2 F/1 | G/3', ['Spin-kej, spin-kej, ma-lič-ký,', 'Sníš-ko, sníš-ko, při-leť k~nám,'], 'C | Am | C | G'],
  ['G/2 F/1 | E/2 D/1 | D/2 D/1 | C/3', ['ven-ku svi-tí hvěz-dič-ky.', 'zav-ři oč-ka, spin-kej sám.'], 'G | C | G | C'],
]));

const poSchodech = song({ id: 'po-schodech', title: 'Po schodech', level: 1, tempo: 84, meter: '4/4', key: 'C', chapter: 5,
  practices: ['stupnice do–sol', 'krokový pohyb'], description: 'Stupnice nahoru a dolů jako po schodech.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['C4/1 D E F | G/4', 'Po schůd-cích jdu výš,', 'C | G'],
  ['G/1 F E D | C/4', 'zpát-ky do-lů jdu.', 'G C | C'],
  ['E/1 F G G | E/1 F G/2', 'Výš a výš až k~ob-lá-kům', 'C | C'],
  ['G/1 F E D | C/4', 'a pak zpát-ky dom.', 'G C | C'],
]));

const houpacka = song({ id: 'houpacka', title: 'Houpačka', level: 1, tempo: 92, meter: '3/4', key: 'F', chapter: 2,
  practices: ['dlouhé fráze na jeden dech', 'krokový pohyb'], description: 'Houpavý valčík – nadechni se vždy na začátku řádku.', intro: 'F | C', outro: 'C | F' },
part('verse', [
  ['F4/2 G/1 | A/2 G/1 | F/2 G/1 | A/3', ['Hou-py, hou-py, hou-pač-ka,', 've-tří-ček ji tla-čí dál,'], 'F | Dm | Bb | F'],
  ['A/2 G/1 | F/2 E/1 | G/2 E/1 | F/3', ['le-tí výš a le-tí níž,', 'až se sko-ro do-tkne skal.'], 'F | Dm | C | F'],
]));

const kapky = song({ id: 'kapky', title: 'Kapky', level: 1, tempo: 92, meter: '2/4', key: 'C', chapter: 7,
  practices: ['rytmus – osminy', 'krátké tóny'], description: 'Rytmická píseň s osminami jako kapky deště.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['G4/0.5 G E/1 | G/0.5 G E/1 | F/0.5 F D/0.5 D | E/0.5 D C/1', 'Kap, kap, kap, ťuk, ťuk, ťuk, deš-tík ťu-ká na o-kno.', 'C | Em | F | C'],
  ['G/0.5 G E/1 | G/0.5 G E/1 | F/0.5 F D/0.5 D | D/1 C/1', 'Pr-ší dál, ne-bo ne? Slu-níč-ko už vstá-vá.', 'C | Em | Dm | G:1 C:1'],
]));

const dobreRano = song({ id: 'dobre-rano', title: 'Dobré ráno', level: 1, tempo: 88, meter: '4/4', key: 'C', chapter: 1,
  practices: ['krokový pohyb', 'první píseň'], description: 'Ranní píseň v rozsahu pěti tónů.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['C4/1 D E F | G/1 F E D', 'Dob-ré rá-no, slun-ce vstá-vá,', 'C | G C'],
  ['E/1 F G E | F/1 E D/2', 'co-pak dnes nám při-ne-se?', 'C | G7'],
  ['C/1 D E F | G/1 F E D', 'Ok-no do-ko-řán ot-ví-rám', 'C | G C'],
  ['E/1 D C D | C/4', 'a zpí-vám si sám.', 'C:3 G:1 | C'],
]));

// ---------------- Úroveň 2 ----------------
const hvezdicka = song({ id: 'hvezdicka', title: 'Hvězdičko, ty maličká', level: 2, tempo: 88, meter: '4/4', key: 'C', chapter: 6,
  credits: { melody: 'francouzská lidová „Ah! vous dirai-je, maman“ (18. st.)', lyrics: 'Zpívánky (původní)' },
  practices: ['skok o kvintu', 'krokový sestup'], description: 'Známá melodie se skokem do–sol.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['C4/1 C G G | A/1 A G/2', 'Hvěz-dič-ko, ty ma-lič-ká,', 'C | F C'],
  ['F/1 F E E | D/1 D C/2', 'kde se be-reš na ne-bi?', 'F C | G C'],
  ['G/1 G F F | E/1 E D/2', 'Vy-so-ko nad stře-cha-mi', 'C F | C G'],
  ['G/1 G F F | E/1 E D/2', 'sví-tíš ja-ko di-a-mant.', 'C F | C G'],
  ['C/1 C G G | A/1 A G/2', 'Hvěz-dič-ko, ty ma-lič-ká,', 'C | F C'],
  ['F/1 F E E | D/1 D C/2', 'přej mi klid-ný, slad-ký sen.', 'F C | G C'],
]));

const oda = song({ id: 'oda-na-radost', title: 'Óda na radost', level: 2, tempo: 100, meter: '4/4', key: 'C', chapter: 5,
  credits: { melody: 'Ludwig van Beethoven (9. symfonie, 1824)', lyrics: 'Zpívánky (původní)' },
  practices: ['krokový pohyb', 'tečkovaný rytmus'], description: 'Beethovenova melodie – samé kroky a jeden tečkovaný rytmus.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['E4/1 E F G | G/1 F E D', 'Ra-dost jis-kří v~na-šich o-čích,', 'C F | G C'],
  ['C/1 C D E | E/1.5 D/0.5 D/2', 'zpí-vej se mnou ra-dost-ně,', 'C G | C G'],
  ['E/1 E F G | G/1 F E D', 'kaž-dý den je ja-ko dá-rek,', 'C F | G C'],
  ['C/1 C D E | D/1.5 C/0.5 C/2', 'ra-dost zpí-vá v~kaž-dém z~nás.', 'C G | G C'],
]));

const kukacka = song({ id: 'kukacka', title: 'Kukačka', level: 2, tempo: 104, meter: '3/4', key: 'C', chapter: 6,
  practices: ['malá tercie sol–mi', 'skoky'], description: 'Kukání je malá tercie dolů – ten nejpřirozenější interval.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['G4/2 E/1 | G/2 E/1 | F/1 G A | G/3', 'Ku-kuk, ku-kuk, vo-lá v~le-se,', 'C | Em | F | C'],
  ['A/2 F/1 | G/2 E/1 | F/1 E D | C/3', 'ku-kač-ka si zpí-vá zno-vu.', 'F | C | G7 | C'],
  ['C/2 E/1 | G/2 E/1 | A/2 G/1 | E/3', 'Ko-lik let mi ješ-tě dáš?', 'C | Em | F | C'],
  ['D/2 F/1 | E/2 G/1 | D/1 E D | C/3', 'Ra-dě-ji to ne-po-čí-tej.', 'Dm | C | G | C'],
]));

const vecerni = song({ id: 'vecerni', title: 'Večerní', level: 2, tempo: 80, meter: '3/4', key: 'C', chapter: 6,
  practices: ['skok o sextu', 'legato'], description: 'Skok o sextu nahoru (do–la) a klidný sestup.', intro: 'F | G', outro: 'G | C' },
part('verse', [
  ['C4/1 A/2 | G/2 E/1 | F/1 E D | C/3', 'Ve-čer ti-chý ná-ves ha-lí,', 'F | C | G7 | C'],
  ['C/1 A/2 | G/2 C/1 | D/1 E F | E/3', 'hvěz-dy svi-tí nad stu-dán-kou,', 'F | C | Dm | C'],
  ['G/1 A/2 | G/2 E/1 | F/1 A G | E/3', 'ti-še zně-jí zvo-ny z~dá-li,', 'C | Em | F | C'],
  ['C/1 A/2 | G/2 E/1 | D/1 E D | C/3', 'dob-rou noc, už všich-ni spí-me.', 'F | C | G | C'],
]));

const pochod = song({ id: 'pochod', title: 'Pochod', level: 2, tempo: 108, meter: '2/4', key: 'F', chapter: 7,
  practices: ['skok o kvartu', 'rytmus'], description: 'Svižný pochod – kvarta nahoru na „Raz, dva“.', intro: 'F | C', outro: 'C | F' },
part('verse', [
  ['C4/1 F/1 | F/0.5 G A/1 | G/0.5 F E/0.5 D | E/0.5 E C/1', 'Raz, dva, kro-kem vpřed, bu-ben ví-ří sem a tam.', 'F | F | C | C'],
  ['C/1 F/1 | F/0.5 G A/1 | A/0.5 G F/0.5 A | G/1 F/1', 'Raz, dva, ne-stů-jem, pís-nič-ka nás ve-de.', 'F | F | Dm | C:1 F:1'],
]));

const naLouce = song({ id: 'na-louce', title: 'Na louce', level: 2, tempo: 92, meter: '4/4', key: 'C', chapter: 6,
  practices: ['tercie', 'rozložený akord'], description: 'Skoky po tónech akordu do–mi–sol.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['C4/1 E G E | F/1 A G/2', 'Na lou-ce kve-tou kvě-ty,', 'C | F C'],
  ['E/1 G F D | E/2 C/2', 'včel-ky ko-lem bzu-čí,', 'C Dm | C'],
  ['G/1 A G E | F/1 A G/2', 'mo-týl le-tí ze kvě-tu', 'C | F C'],
  ['E/1 D C D | C/4', 'zas na dal-ší květ.', 'C:3 G:1 | C'],
]));

// ---------------- Úroveň 3 ----------------
const horska = song({ id: 'horska', title: 'Horská', level: 3, tempo: 96, meter: '4/4', key: 'C', chapter: 6,
  practices: ['rozložený akord přes oktávu', 'tečkovaný rytmus'], description: 'Výstup po tónech akordu až na oktávu.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['C4/1.5 E/0.5 G/1 C5/1 | B4/1.5 A/0.5 G/2', ['Na ho-rách je čis-tý vzduch,', 'Vě-trem vo-ní ho-řec, mech,'], 'C | G'],
  ['A4/1.5 G/0.5 F/1 A/1 | G/1.5 F/0.5 E/2', ['da-le-ko je ú-do-lí.', 'nad ná-mi jen ne-be je.'], 'F | C'],
  ['E4/1.5 G/0.5 C5/1 G4/1 | A/1.5 B/0.5 C5/2', ['Ces-tou vzhů-ru sta-čí jít', 'Kaž-dý krok je vý-še zas,'], 'C | F'],
  ['B4/1.5 A/0.5 G/1 E/1 | D/1.5 E/0.5 C/2', ['a pak zpí-vat: ta-dy jsem!', 'vr-chol če-ká, za-zpí-vej!'], 'G | G C'],
]));

const polka = song({ id: 'polka', title: 'Polka', level: 3, tempo: 112, meter: '2/4', key: 'G', chapter: 7,
  practices: ['tečkovaný rytmus', 'rozsah oktávy'], description: 'Rychlá polka s tečkovaným rytmem.', intro: 'G | D', outro: 'D | G' },
part('verse', [
  ['D4/0.75 G/0.25 G/0.5 B/0.5 | D5/1 B4/1 | C5/0.75 B4/0.25 A/0.5 G/0.5 | A/2', 'Bub-ny bu-ší, trub-ka zpí-vá na-hlas, hej!', 'G | G | C | D'],
  ['D4/0.75 G/0.25 G/0.5 B/0.5 | D5/1 B4/1 | C5/0.75 A4/0.25 F#/0.5 A/0.5 | G/2', 'Kdo má no-hy, ať jde tan-čit s~na-mi, hned!', 'G | G | D7 | G'],
  ['B4/0.75 A/0.25 G/0.5 B/0.5 | A/1 F#/1 | A/0.75 G/0.25 F#/0.5 E/0.5 | D/2', 'Toč se, toč se ko-lem, ruč-ku po-dej mně!', 'Em | D | A7 | D'],
  ['D4/0.75 G/0.25 G/0.5 B/0.5 | D5/1 B4/1 | C5/0.75 A4/0.25 F#/0.5 A/0.5 | G/2', 'Bub-ny bu-ší, trub-ka zpí-vá s~na-mi, hej!', 'G | G | D7 | G'],
]));

const valcik = song({ id: 'valcik', title: 'Valčík', level: 3, tempo: 120, meter: '3/4', key: 'C', chapter: 6,
  practices: ['rozložené akordy', 'oktáva'], description: 'Rozložený akord až na horní do v rytmu valčíku.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['C4/1 E G | C5/2 G4/1 | A/1 G F | E/3', 'Val-čí-ček hra-je, my tan-čí-me,', 'C | Am | F | C'],
  ['D4/1 F A | C5/2 A4/1 | G/1 F D | G/3', 'hla-va se nám zto-čí do-ko-la.', 'Dm | F | G7 | G'],
  ['C4/1 E G | C5/2 G4/1 | A/1 G F | E/3', 'Mi-lá se smě-je a já ta-ky,', 'C | Am | F | C'],
  ['C4/1 E G | C5/2 B4/1 | A/1 G D | C/3', 'val-čí-ček nás do no-ci ne-se.', 'C | Am | Dm | C'],
]));

const rybar = song({ id: 'rybar', title: 'Rybář', level: 3, tempo: 76, meter: '4/4', key: 'A', mode: 'minor', chapter: 9,
  practices: ['moll', 'legato', 'dynamika'], description: 'Tklivá píseň v moll – zpívej vázaně a s citem.', intro: 'Am | E', outro: 'E | Am' },
part('verse', [
  ['A3/1 C4 E D | C/1 B3 A/2', ['Ry-bář plu-je po ře-ce,', 'Sí-tě ho-dí do hlu-bin,'], 'Am | F Am'],
  ['C4/1 E A G | E/1 D E/2', ['ml-ha nad ní ti-še spí.', 'če-ká ti-še do ve-čer.'], 'C Am | E'],
  ['E4/1 A G E | F/1 E D/2', ['Vl-ny sví-tí ve slun-ci,', 'Ve-čer sví-tí lu-cer-na,'], 'C | F Dm'],
  ['C4/1 B3 A C4 | B3/1 B A/2', ['ry-bář zpí-vá pís-ni-ci.', 'ry-bář ve-ze ú-lo-vek.'], 'Am | E Am'],
]));

const svatojanska = song({ id: 'svatojanska', title: 'Svatojánská noc', level: 3, tempo: 88, meter: '4/4', key: 'C', chapter: 9,
  practices: ['skok o sextu a kvartu', 'tečkovaný rytmus'], description: 'Skoky o kvartu a sextu v tečkovaném rytmu.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['G3/1 C4/1.5 D/0.5 E/1 | E/1.5 D/0.5 C/2', ['Sva-to-ján-ská noc je tu,', 'Ka-pra-dí tu kve-te snad,'], 'C | Am C'],
  ['G3/1 E4/1.5 D/0.5 C/1 | D/1.5 C/0.5 B3/2', ['svět-lu-šky nám sví-tí dál,', 'šťast-ný, kdo ho na-jde sám.'], 'C | G'],
  ['C4/1 G/1.5 F/0.5 E/1 | F/1.5 E/0.5 D/2', ['o-heň ho-ří u vo-dy,', 'Hvěz-dy pa-da-jí jak déšť,'], 'C | Dm G'],
  ['G3/1 E4/1.5 D/0.5 C/1 | D/1.5 B3/0.5 C4/2', ['zpí-vá-me až do rá-na.', 'zpí-vá-me až do rá-na.'], 'C | G C'],
]));

const zebricek = song({ id: 'zebricek', title: 'Žebříček', level: 3, tempo: 92, meter: '4/4', key: 'C', chapter: 10,
  practices: ['stupnice přes oktávu', 'solmizace', 'sluch'], description: 'Celá stupnice nahoru a dolů – nejdřív se slabikami do re mi.', intro: 'C | G', outro: 'G | C' },
part('verse', [
  ['C4/1 D E F | G/1 A B C5', ['Do, re, mi, fa, sol, la, ti, do,', 'Po žeb-říč-ku stou-pám vý-še,'], 'C | C G'],
  ['C5/1 B4 A G | F/1 E D C', ['do, ti, la, sol, fa, mi, re, do.', 'a pak zpát-ky do-lů jdu sám.'], 'C F | F:2 G:1 C:1'],
  ['C4/1 E G E | C/1 E G/2', ['Do, mi, sol, mi, do, mi, sol,', 'Skok a skok a ješ-tě skok,'], 'C | C'],
  ['C5/1 G4 E G | C5/4', ['do, sol, mi, sol, do!', 'a jsem na-ho-ře!'], 'C | C'],
]));

// ---------------- Úroveň 4 ----------------
const cestaVerse = (s) => part('verse', [
  ['D4/1 G/0.5 A/1 B/0.5 B/1 | A/1 G/0.5 A/1.5 r/1', s[0], 'G D | Am D'],
  ['D4/1 G/0.5 A/1 B/0.5 D5/1 | C5/1 B4/0.5 A/1.5 r/1', s[1], 'G D | C D'],
  ['B4/1 D5/0.5 B4/1 A/0.5 G/1 | E/1 G/0.5 E/1.5 r/1', s[2], 'G | Em C'],
  ['D4/1 G/0.5 A/1 B/0.5 A/1 | G/4', s[3], 'G D | G'],
]);
const cestaChorus = part('chorus', [
  ['G4/0.5 B/0.5 D5/1 D/0.5 E/1 D/0.5 | B4/2 r/2', 'Do-mů jdu, už jdu do-mů,', 'G | Em'],
  ['A4/0.5 C5/0.5 E/1 E/0.5 D/1 C/0.5 | B4/2 r/2', 'kde mě če-ká te-plý krb,', 'Am | G'],
  ['G4/0.5 B/0.5 D5/1 D/0.5 E/1 D/0.5 | B4/2 A/1 G/1', 'tam, kde se smě-jem a zpí-vá-me,', 'G | Em D'],
  ['D5/1 B4/0.5 A/1 G/0.5 A/1 | G/4', 'tam já pat-řím, do-mů.', 'G D | G'],
]);
const cestaDomu = song({ id: 'cesta-domu', title: 'Cesta domů', level: 4, tempo: 100, meter: '4/4', key: 'G', chapter: 8,
  practices: ['synkopy', 'sloka a refrén', 'rozsah přes oktávu'], description: 'Sloka a refrén se synkopami – refrén stoupá výš.', intro: 'G C | D', outro: 'C D | G' },
cestaVerse(['Ces-tou jdu a sví-tí mě-síc,', 've-de mě až k~na-šim vra-tům.', 'Ok-na sví-tí, ma-ma če-ká,', 'už se tě-ším do-mů.']),
cestaChorus,
cestaVerse(['Lis-tí pa-dá, ví-tr fou-ká,', 'vrá-tím se dnes poz-dě ve-čer.', 'Ok-na sví-tí, pes už ště-ká,', 'už se tě-ším do-mů.']),
cestaChorus);

const letniVerse = (s) => part('verse', [
  ['C4/0.5 E/0.5 G/1 G/0.5 A/1 G/0.5 | E/1 D/0.5 C/1.5 r/1', s[0], 'C | Am'],
  ['C4/0.5 E/0.5 G/1 G/0.5 A/1 G/0.5 | F/1 E/0.5 D/1.5 r/1', s[1], 'C | Dm G'],
  ['A4/0.5 C5/0.5 C/1 C/0.5 D/1 C/0.5 | A4/1 G/0.5 G/1.5 r/1', s[2], 'F | F C'],
  ['G4/0.5 A/0.5 B/1 B/0.5 C5/1 B4/0.5 | A/1 G/0.5 G/1.5 r/1', s[3], 'G | D7 G'],
]);
const letniChorus = part('chorus', [
  ['C5/1 C/0.5 D/1 C/0.5 A4/1 | G/1.5 E/0.5 G/2', 'Vět-ře, vět-ře, ne-seš pís-eň', 'F G | C'],
  ['C5/1 C/0.5 D/1 C/0.5 A4/1 | G/1.5 E/0.5 D/2', 'přes ře-ku až do da-le-ka,', 'F G | C G'],
  ['D5/1 D/0.5 C/1 B4/0.5 C5/1 | D/1.5 C/0.5 A4/2', 'zpí-vej se mnou, zpí-vej s~ná-mi', 'G C | Dm'],
  ['D5/1 C/0.5 B4/1 A/0.5 B/1 | C5/4', 'dlou-hou let-ní pís-eň.', 'G | C'],
]);
const letniVitr = song({ id: 'letni-vitr', title: 'Letní vítr', level: 4, tempo: 104, meter: '4/4', key: 'C', chapter: 9,
  practices: ['synkopy', 'sloka a refrén'], description: 'Svižná letní píseň se synkopami ve sloce i refrénu.', intro: 'C | G', outro: 'F G | C' },
letniVerse(['Let-ní ví-tr fou-ká přes po-le,', 'ne-se vů-ni čer-stvé-ho se-na,', 'sly-ším, jak si ptá-ci zpí-va-jí,', 'a pak se při-dám, ta-ky zpí-vám.']),
letniChorus,
letniVerse(['Slun-ce hře-je, ces-ta se tá-hne,', 'my-slím na to, co mám nej-rad-ši,', 'na lou-ce kvi-tou vl-čí má-ky,', 'a pak se při-dám, ta-ky zpí-vám.']),
letniChorus);

const ozvena = song({ id: 'ozvena', title: 'Ozvěna', level: 4, tempo: 96, meter: '4/4', key: 'C', chapter: 10,
  practices: ['zavolání a odpověď', 'rozložené akordy', 'dynamika (ozvěna potichu)'], description: 'Zavolej a zazpívej ozvěnu – každý druhý řádek potichu.', intro: 'C | G', outro: 'F G | C' },
part('verse', [
  ['C4/1 E/1 G/2 | C5/1 G4/1 E/2', 'Ha-ló, hej, kdo je tam?', 'C | C'],
  ['C4/1 E/1 G/2 | C5/1 G4/1 E/2', 'ha-ló, hej, kdo je tam?', 'C | C'],
  ['D4/1 F/1 A/2 | D5/1 A4/1 F/2', 'Ha-ló, hej, kdo tu jsi?', 'Dm | Dm'],
  ['D4/1 F/1 A/2 | D5/1 A4/1 F/2', 'ha-ló, hej, kdo tu jsi?', 'Dm | Dm'],
  ['E4/1 G/1 B/2 | D5/1 B4/1 G/2', 'To jsem já, tvo-je hlas,', 'Em | G'],
  ['F4/1 A/1 C5/2 | B4/1 G/1 C5/2', 'o-zvě-na z~hor-ských skal.', 'F | G C'],
]),
part('chorus', [
  ['D5/1 C/0.5 B4/1 C5/0.5 D/1 | C/1.5 B4/0.5 G/2', 'O-zvě-no, o-zvě-no, vo-lej,', 'G | C'],
  ['C5/1 B4/0.5 A/1 B/0.5 C5/1 | B4/1.5 A/0.5 G/2', 'z~ho-ry na ho-ru a zpát-ky,', 'Am | G'],
  ['A4/1 C5/0.5 D/1 C/0.5 A4/1 | B/1.5 C5/0.5 D/2', 'ať to sly-ší ce-lá ze-mě,', 'Dm | G'],
  ['D5/1 C/0.5 B4/1 C5/0.5 D/1 | B4/1.5 G/0.5 C5/2', 'o-zvě-no, o-zvě-no, vo-lej!', 'G | G C'],
]));

const svetlaVerse = (s) => part('verse', [
  ['A3/0.5 C4/0.5 E/1 E/0.5 D/1 C/0.5 | D/1 E/0.5 A3/1.5 r/1', s[0], 'Am | Dm'],
  ['A3/0.5 C4/0.5 E/1 E/0.5 G/1 E/0.5 | D/1 C/0.5 B3/1.5 r/1', s[1], 'Am | G'],
  ['C4/0.5 E/0.5 G/1 G/0.5 A/1 G/0.5 | F/1 E/0.5 D/1.5 r/1', s[2], 'C | Dm'],
  ['C4/0.5 E/0.5 G/1 G/0.5 A/1 G/0.5 | E/1 D/0.5 E/1.5 r/1', s[3], 'C | E'],
]);
const svetlaChorus = part('chorus', [
  ['A4/1 A/0.5 C5/1 B4/0.5 A/1 | G/1.5 E/0.5 E/2', 'Svět-la měs-ta, svět-la měs-ta', 'F | C'],
  ['A4/1 A/0.5 C5/1 B4/0.5 A/1 | B/1.5 G#/0.5 A/2', 'sví-tí mi na ces-tu do-mů,', 'F | E Am'],
  ['C5/1 C/0.5 B4/1 A/0.5 G/1 | B/1.5 A/0.5 G/2', 'kaž-dé o-kno má svůj pří-běh', 'C G | G'],
  ['A4/1 A/0.5 C5/1 B4/0.5 A/1 | B/1.5 G#/0.5 A/2', 'a já mám zas tu-hle pís-eň.', 'F | E Am'],
]);
const svetlaMesta = song({ id: 'svetla-mesta', title: 'Světla města', level: 4, tempo: 100, meter: '4/4', key: 'A', mode: 'minor', chapter: 7,
  practices: ['synkopy', 'moll', 'sloka a refrén'], description: 'Večerní městská píseň v moll se synkopami.', intro: 'Am | E', outro: 'F E | Am' },
svetlaVerse(['A ce-lé měs-to v~no-ci zá-ří', 'a lam-py sví-tí po-dél u-lic,', 'jdu sám a hud-ba hra-je z~ok-na', 'a já si ti-še po-bru-ku-ju.']),
svetlaChorus,
svetlaVerse(['Tram-vaj pro-jíž-dí ko-lem mos-tu', 'a ře-ka ne-se ty-hle svět-la,', 'jdu sám a hud-ba hra-je z~ok-na', 'a já si ti-še po-bru-ku-ju.']),
svetlaChorus);

const naVrcholu = song({ id: 'na-vrcholu', title: 'Na vrcholu', level: 4, tempo: 92, meter: '4/4', key: 'C', chapter: 8,
  practices: ['rozsah přes oktávu', 'synkopy', 'sloka a refrén'], description: 'Sloka začíná hluboko, refrén vystoupá nahoru.', intro: 'C | G', outro: 'F G | C' },
part('verse', [
  ['G3/1 C4/0.5 D/1 E/0.5 E/1 | D/1 C/0.5 D/1.5 r/1', 'Skal-ní ces-tou kro-čím vzhů-ru,', 'C G | G'],
  ['G3/1 C4/0.5 D/1 E/0.5 G/1 | E/1 D/0.5 C/1.5 r/1', 'ví-tr fou-ká, slun-ce pá-lí,', 'C G | Am C'],
  ['A3/1 C4/0.5 E/1 E/0.5 F/1 | E/1 D/0.5 C/1.5 r/1', 'ješ-tě kou-sek, ješ-tě kou-sek,', 'Am | C'],
  ['A3/1 C4/0.5 D/1 C/0.5 B3/1 | C4/1 B3/0.5 G3/1.5 r/1', 'a už vi-dím vr-chol ho-ry.', 'Am G | C G'],
]),
part('chorus', [
  ['C4/0.5 E/0.5 G/1 A/1 G/1 | E/1.5 D/0.5 C/2', 'Na vr-cho-lu, na vr-cho-lu', 'C Am | C'],
  ['C4/0.5 E/0.5 G/1 A/1 G/1 | F/1.5 E/0.5 D/2', 'ce-lý svět je teď po-de mnou,', 'C Am | Dm G'],
  ['A4/0.5 A/0.5 G/1 E/1 G/1 | A/1.5 G/0.5 E/2', 'zpí-vám na-hlas do da-le-ka,', 'Am | F Am'],
  ['G4/0.5 G/0.5 E/1 D/1 E/1 | D/1.5 B3/0.5 C4/2', 'o-zvě-na mi od-po-ví-dá.', 'C G | G C'],
]));

const konecVerse = (s) => part('verse', [
  ['E4/1 E/0.5 F/1 E/0.5 D/1 | C/3 r/1', s[0], 'C F | C'],
  ['E4/1 E/0.5 F/1 E/0.5 D/1 | G/3 r/1', s[1], 'C F | G'],
  ['A4/1 A/0.5 G/1 F/0.5 E/1 | F/3 r/1', s[2], 'F C | Dm'],
  ['G4/1 G/0.5 F/1 E/0.5 D/1 | E/3 r/1', s[3], 'C G7 | C'],
]);
const konecChorus = part('chorus', [
  ['C5/1.5 B4/0.5 A/1 G/1 | A/1.5 G/0.5 E/2', 'Dob-rou noc, můj mi-lý dni,', 'F | Am'],
  ['C5/1.5 B4/0.5 A/1 G/1 | F/1.5 E/0.5 D/2', 'zí-tra zno-vu za-zpí-vám.', 'F | Dm G'],
  ['E5/1.5 D/0.5 C/1 B4/1 | C5/1.5 B4/0.5 A/2', 'Hvěz-dy, sviť-te nad ná-mi', 'C:3 G:1 | F'],
  ['G4/1.5 A/0.5 B/1 D5/1 | C5/4', 'a hlí-dej-te sen.', 'G | C'],
]);
const konecDne = song({ id: 'konec-dne', title: 'Píseň na konec dne', level: 4, tempo: 72, meter: '4/4', key: 'C', chapter: 9,
  practices: ['legato', 'dynamika', 'sloka a refrén'], description: 'Pomalá večerní píseň – dlouhé vázané fráze.', intro: 'F G | C', outro: 'F G | C' },
konecVerse(['Slun-ce už za-pa-dá', 'a ve-čer při-chá-zí.', 'Sed-nu si ke dve-řím', 'a ti-še si zpí-vám.']),
konecChorus,
konecVerse(['Pta-ci už spí v~hníz-dě', 'i lou-ka už spin-ká.', 'Mě-síc se u-smí-vá', 'a ti-še si zpí-vám.']),
konecChorus);

export const SONGS = [
  dobreRano, triTony, ukolebavka, poSchodech, houpacka, kapky,
  hvezdicka, oda, kukacka, vecerni, pochod, naLouce,
  horska, polka, valcik, rybar, svatojanska, zebricek,
  cestaDomu, letniVitr, ozvena, svetlaMesta, naVrcholu, konecDne,
];

export const LEVELS = {
  1: { name: 'Úroveň 1', desc: 'Rozsah 3–5 tónů, krokově, pomalu' },
  2: { name: 'Úroveň 2', desc: 'Rozsah do sexty, jednoduché skoky' },
  3: { name: 'Úroveň 3', desc: 'Rozsah oktávy, intervaly, tečkovaný rytmus' },
  4: { name: 'Úroveň 4', desc: 'Přes oktávu, synkopy, sloka a refrén' },
};

export function songById(id) { return SONGS.find((s) => s.id === id); }
