// Hry: katalog (nauka, poslech, zpěv) s úrovněmi od začátečníka po mistra, generátory otázek,
// opakování podle chyb (Leitnerovy krabičky), metriky zpívacích her (rytmus, rychlost reakce, stabilita, tempo).
// Postup podle RESEARCH.md: zvuk před značkou, intervaly po skupinách s opěrnými písněmi, solmizace od sol–mi,
// prokládání a opakování podle chyb, rytmus = přesnost + pravidelnost + držení tempa.

export const GAME_GROUPS = [['nauka', 'Nauka', '📖', 'Noty, klávesy, intervaly, rytmus, tóniny'], ['poslech', 'Poslech', '👂', 'Sluchový trénink hrou'], ['zpev', 'Zpěv', '🎤', 'Trefa, rytmus, síla, rychlost, paměť']];
export const LEVEL_NAMES = ['Začátečník', 'Mírně pokročilý', 'Pokročilý', 'Expert', 'Mistr'];

// ---------- jména tónů ----------
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
const LETTER_SEMI = [0, 2, 4, 5, 7, 9, 11];
const INTL_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/** Český název tónu z písmene a posuvky (-1 béčko, 0, +1 křížek): Cis, Es, As, B (= H s béčkem)… */
export function czNote(l, acc = 0) {
  const L = LETTERS[l];
  if (!acc) return L;
  if (acc > 0) return L + 'is';
  if (L === 'H') return 'B';
  if (L === 'E') return 'Es';
  if (L === 'A') return 'As';
  return L + 'es';
}
export const intlNote = (l, acc = 0) => INTL_LETTERS[l] + (acc > 0 ? '♯' : acc < 0 ? '♭' : '');
export const noteLabel = (n, style = 'cz') => (style === 'intl' ? intlNote(n.l, n.acc) : czNote(n.l, n.acc));
/** Diatonický krok od C4 (C4 = 0, D4 = 1 … C5 = 7). */
export const stepOf = (l, oct) => (oct - 4) * 7 + l;
export const midiOf = (l, oct, acc = 0) => (oct + 1) * 12 + LETTER_SEMI[l] + acc;
const fromStep = (s) => ({ l: ((s % 7) + 7) % 7, oct: 4 + Math.floor(s / 7) });

export const INTERVALS_CZ = ['prima', 'malá sekunda', 'velká sekunda', 'malá tercie', 'velká tercie', 'čistá kvarta', 'tritón', 'čistá kvinta', 'malá sexta', 'velká sexta', 'malá septima', 'velká septima', 'oktáva'];
export const GENERIC_CZ = ['prima', 'sekunda', 'tercie', 'kvarta', 'kvinta', 'sexta', 'septima', 'oktáva'];
/** Opěrné písně z knihovny aplikace (začátek písně = interval). */
export const ANCHORS = {
  1: { song: 'oda-na-radost', text: 'Óda na radost (mi–mi–fa)' },
  2: { song: 'bratre-kubo', text: 'Bratře Kubo (Bra–tře)' },
  3: { song: 'skakal-pes', text: 'Skákal pes (dolů: kal–pes)' },
  4: { song: 'stedrej-vecer', text: 'Štědrej večer (Štěd–rej)' },
  5: { song: 'my-tri-kralove', text: 'My tři králové (My–tři)' },
  7: { song: 'hvezdicka', text: 'Hvězdičko, ty maličká (ko–ty)' },
  12: { song: 'hodne-stesti', text: 'Hodně štěstí (oktáva na „všech-no nej“)' },
};
const ANCHOR_DOWN = { 5: 'Pásli ovce Valaši (Pá–sli, dolů)', 3: 'Skákal pes (kal–pes)' };

export const SOLF = ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'];
const SOLF_SEMI = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, ti: 11 };

// ---------- rytmické hodnoty ----------
export const VALUES = {
  w: { beats: 4, name: 'celá nota' }, h: { beats: 2, name: 'půlová nota' }, q: { beats: 1, name: 'čtvrťová nota' }, e: { beats: 0.5, name: 'osminová nota' }, s: { beats: 0.25, name: 'šestnáctinová nota' },
  'h.': { beats: 3, name: 'půlová s tečkou' }, 'q.': { beats: 1.5, name: 'čtvrťová s tečkou' },
  wr: { beats: 4, name: 'celá pomlka' }, hr: { beats: 2, name: 'půlová pomlka' }, qr: { beats: 1, name: 'čtvrťová pomlka' }, er: { beats: 0.5, name: 'osminová pomlka' },
};
const beatsLabel = (b) => { const w = Math.floor(b), f = b - w; const t = (w || '') + (f === 0.25 ? '¼' : f === 0.5 ? '½' : f === 0.75 ? '¾' : ''); return b === 1 ? '1 doba' : b < 1 ? `${t} doby` : b < 5 ? `${t} doby` : `${t} dob`; };

// ---------- tóniny ----------
const SHARP_KEYS = [['C dur', 'a moll'], ['G dur', 'e moll'], ['D dur', 'h moll'], ['A dur', 'fis moll'], ['E dur', 'cis moll'], ['H dur', 'gis moll']];
const FLAT_KEYS = [['C dur', 'a moll'], ['F dur', 'd moll'], ['B dur', 'g moll'], ['Es dur', 'c moll'], ['As dur', 'f moll']];

// ---------- katalog ----------
const L = (desc, p = {}) => ({ desc, ...p });
export const GAMES = [
  // ===== Nauka =====
  { id: 'noty', group: 'nauka', kind: 'quiz', icon: '🎼', title: 'Noty na osnově', desc: 'Poznej notu podle polohy na notové osnově.', levels: [
    L('Houslový klíč, C–G (5 tónů)', { clef: 'G', from: 0, to: 4 }), L('Houslový klíč, oktáva c1–c2', { clef: 'G', from: 0, to: 7 }),
    L('Pomocné linky (a–e2)', { clef: 'G', from: -2, to: 9 }), L('Křížky a béčka', { clef: 'G', from: 0, to: 7, acc: true }), L('Basový klíč', { clef: 'F', from: -12, to: -1 })] },
  { id: 'klavesy', group: 'nauka', kind: 'quiz', icon: '🎹', title: 'Klaviatura', desc: 'Najdi tóny na klávesách.', levels: [
    L('Bílé klávesy – jak se jmenuje?', { mode: 'name', white: true }), L('Ťukni na klávesu', { mode: 'tap', white: true }),
    L('Černé klávesy (cis = des…)', { mode: 'name', black: true }), L('Všechny klávesy – ťukni', { mode: 'tap' }), L('Půltóny a celé tóny', { mode: 'step' })] },
  { id: 'intervaly-noty', group: 'nauka', kind: 'quiz', icon: '📏', title: 'Intervaly v notách', desc: 'Kolik kroků je mezi dvěma notami?', levels: [
    L('Prima, sekunda, tercie', { max: 2 }), L('Až po kvintu', { max: 4 }), L('Až po oktávu', { max: 7 }), L('Malá, nebo velká?', { quality: true }), L('Všechno dohromady', { max: 7, quality: true })] },
  { id: 'rytmus-hodnoty', group: 'nauka', kind: 'quiz', icon: '🥁', title: 'Délky not', desc: 'Kolik dob trvá nota nebo pomlka?', levels: [
    L('Celá, půlová, čtvrťová', { set: ['w', 'h', 'q'] }), L('Osminy a šestnáctiny', { set: ['w', 'h', 'q', 'e', 's'] }), L('Noty s tečkou', { set: ['h', 'q', 'e', 'h.', 'q.'] }),
    L('Pomlky', { set: ['wr', 'hr', 'qr', 'er'] }), L('Spočítej celý takt', { sum: true })] },
  { id: 'toniny', group: 'nauka', kind: 'quiz', icon: '🔑', title: 'Předznamenání', desc: 'Poznej tóninu podle křížků a béček.', levels: [
    L('C, G, F dur', { max: 1 }), L('Až 2 křížky / béčka', { max: 2 }), L('Až 4', { max: 4 }), L('Mollové tóniny', { max: 3, minor: true }), L('Všechny dur i moll', { max: 5, minor: 'mix' })] },
  // ===== Poslech =====
  { id: 'vyssi-nizsi', group: 'poslech', kind: 'quiz', icon: '↕️', title: 'Vyšší, nebo nižší?', desc: 'Který tón je vyšší? Rozdíl se zmenšuje až na pár centů.', audio: true, levels: [
    L('Rozdíl 3 půltóny', { cents: 300 }), L('Půltón', { cents: 100 }), L('Čtvrttón (50 centů)', { cents: 50, same: true }), L('25 centů', { cents: 25, same: true }), L('10 centů – ucho ladiče', { cents: 12, same: true })] },
  { id: 'intervaly-sluch', group: 'poslech', kind: 'quiz', icon: '👂', title: 'Intervaly sluchem', desc: 'Poznej interval – s opěrnou písní.', audio: true, levels: [
    L('Prima, velká sekunda, oktáva', { set: [0, 2, 12] }), L('+ tercie', { set: [2, 3, 4, 12] }), L('+ kvarta a kvinta', { set: [3, 4, 5, 7, 12] }),
    L('+ malá sekunda a sexty', { set: [1, 2, 5, 7, 8, 9] }), L('Všechny, nahoru i dolů', { set: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], down: true })] },
  { id: 'dur-moll', group: 'poslech', kind: 'quiz', icon: '🌗', title: 'Dur, nebo moll?', desc: 'Veselý, nebo smutný akord?', audio: true, levels: [
    L('Akordy v základní poloze', { set: ['maj', 'min'] }), L('Rozložené akordy', { set: ['maj', 'min'], arp: true }), L('Obraty akordů', { set: ['maj', 'min'], inv: true }),
    L('+ zmenšený', { set: ['maj', 'min', 'dim'], inv: true }), L('+ septakord', { set: ['maj', 'min', 'dim', 'dom7'], inv: true })] },
  { id: 'solmizace', group: 'poslech', kind: 'quiz', icon: '✋', title: 'Solmizace sluchem', desc: 'Zazní „do“ a pak tón – jaký stupeň to je?', audio: true, levels: [
    L('sol a mi', { set: ['sol', 'mi'] }), L('sol, mi, la', { set: ['sol', 'mi', 'la'] }), L('do, re, mi', { set: ['do', 're', 'mi'] }),
    L('Pentatonika do–re–mi–sol–la', { set: ['do', 're', 'mi', 'sol', 'la'] }), L('Celá stupnice', { set: SOLF })] },
  { id: 'rytmus-diktat', group: 'poslech', kind: 'quiz', icon: '🎧', title: 'Který rytmus zazněl?', desc: 'Poslechni si takt a vyber správný zápis.', audio: true, levels: [
    L('Čtvrťové a půlové', { pool: ['q', 'h'] }), L('+ osminy', { pool: ['q', 'h', 'ee'] }), L('+ celé takty a pomlky', { pool: ['q', 'h', 'ee', 'qr'] }),
    L('+ tečkované', { pool: ['q', 'ee', 'q.e', 'h'] }), L('+ šestnáctiny a synkopy', { pool: ['q', 'ee', 'ssss', 'eqe', 'q.e'] })] },
  { id: 'melodie-smer', group: 'poslech', kind: 'quiz', icon: '〰️', title: 'Kam jde melodie?', desc: 'Nahoru, dolů, nebo stejně? Poznej obrys melodie.', audio: true, levels: [
    L('3 tóny, velké skoky', { n: 3, big: true }), L('3 tóny', { n: 3 }), L('4 tóny', { n: 4 }), L('5 tónů po krocích', { n: 5 }), L('5 tónů, malé rozdíly', { n: 5, small: true })] },
  // ===== Zpěv =====
  { id: 'napodob', group: 'zpev', kind: 'sing', icon: '🎯', title: 'Napodob tón', desc: 'Zazní tón – zazpívej ho co nejpřesněji.', levels: [
    L('5 tónů, hlas, ±50 centů', { spec: { type: 'match', count: 5, degrees: [1, 2, 3, 4, 5] }, tol: 50, listen: 'guide' }),
    L('6 tónů, klavír, ±35', { spec: { type: 'match', count: 6, random: true }, tol: 35, listen: 'piano' }),
    L('8 tónů v celém rozsahu, ±25', { spec: { type: 'match', count: 8, random: true, holdBeats: 2 }, tol: 25, listen: 'piano' }),
    L('8 tónů, ±15 centů', { spec: { type: 'match', count: 8, random: true, holdBeats: 2 }, tol: 15, listen: 'piano' }),
    L('Naslepo – bez křivky', { spec: { type: 'match', count: 8, random: true, holdBeats: 2, hideCurve: true }, tol: 25, listen: 'piano' })] },
  { id: 'rychla-trefa', group: 'zpev', kind: 'sing', icon: '⚡', title: 'Rychlá trefa', desc: 'Jak rychle trefíš tón? Měří se čas od nástupu po přesný tón.', metric: 'reaction', levels: [
    L('Pomalu, ±50', { spec: { type: 'match', count: 6, degrees: [1, 3, 5], holdBeats: 2, tempo: 80 }, tol: 50 }),
    L('Kroky, ±40', { spec: { type: 'match', count: 8, degrees: [1, 2, 3, 4, 5], holdBeats: 2, tempo: 92 }, tol: 40 }),
    L('Skoky, ±30', { spec: { type: 'match', count: 8, random: true, holdBeats: 2, tempo: 100 }, tol: 30 }),
    L('Rychle, ±25', { spec: { type: 'match', count: 10, random: true, holdBeats: 1.5, tempo: 112 }, tol: 25 }),
    L('Bleskově, ±20', { spec: { type: 'match', count: 12, random: true, holdBeats: 1, tempo: 120 }, tol: 20 })] },
  { id: 'pa-pa-pa', group: 'zpev', kind: 'sing', icon: '🥁', title: 'Pa-pa-pa do metronomu', desc: 'Zpívej „pa“ přesně s klikem. Měří se přesnost i pravidelnost.', metric: 'rhythm', levels: [
    L('Čtvrťové, tempo 70', { spec: { type: 'rhythm', tempo: 70, reps: 3, pattern: [[0, 1], [1, 1], [2, 1], [3, 1]] } }),
    L('Půlové a čtvrťové, 84', { spec: { type: 'rhythm', tempo: 84, reps: 3, pattern: [[0, 2], [2, 1], [3, 1]] } }),
    L('Osminy, 92', { spec: { type: 'rhythm', tempo: 92, reps: 3, pattern: [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1]] } }),
    L('Tečkovaný rytmus, 100', { spec: { type: 'rhythm', tempo: 100, reps: 3, pattern: [[0, 1.5], [1.5, 0.5], [2, 1.5], [3.5, 0.5]] } }),
    L('Synkopa, 112', { spec: { type: 'rhythm', tempo: 112, reps: 4, pattern: [[0, 0.5], [0.5, 1], [1.5, 0.5], [2, 1], [3, 1]] } })] },
  { id: 'drz-tempo', group: 'zpev', kind: 'sing', icon: '⏱️', title: 'Drž tempo', desc: 'Metronom po dvou taktech zmlkne – vydržíš ve stejném tempu?', metric: 'tempo', levels: [
    L('Tempo 72, 1 takt sám', { spec: { type: 'rhythm', tempo: 72, reps: 3, noListen: true }, metroUntil: 8 }),
    L('Tempo 88, 2 takty sám', { spec: { type: 'rhythm', tempo: 88, reps: 4, noListen: true }, metroUntil: 8 }),
    L('Tempo 100, 3 takty sám', { spec: { type: 'rhythm', tempo: 100, reps: 5, noListen: true }, metroUntil: 8 }),
    L('Pomalé tempo 60 (nejtěžší)', { spec: { type: 'rhythm', tempo: 60, reps: 5, noListen: true }, metroUntil: 8 }),
    L('Osminy 96, 4 takty sám', { spec: { type: 'rhythm', tempo: 96, reps: 6, noListen: true, pattern: [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1]] }, metroUntil: 8 })] },
  { id: 'sila', group: 'zpev', kind: 'sing', icon: '🔊', title: 'Síla hlasu', desc: 'Zesiluj a zeslabuj podle žlutého pásu – výška se nemění.', metric: 'dynamics', levels: [
    L('Crescendo (zesílení)', { spec: { type: 'dynamics', curve: 'cresc', holdBeats: 8, reps: 2, rangeDb: 10 } }),
    L('Decrescendo (zeslabení)', { spec: { type: 'dynamics', curve: 'decresc', holdBeats: 8, reps: 2, rangeDb: 10 } }),
    L('Messa di voce (tiše–silně–tiše)', { spec: { type: 'dynamics', curve: 'messa', holdBeats: 10, reps: 2, rangeDb: 12 } }),
    L('Skoky: piano – forte – mezzo', { spec: { type: 'dynamics', curve: 'steps', holdBeats: 9, reps: 2, rangeDb: 14 } }),
    L('Velký rozsah síly', { spec: { type: 'dynamics', curve: 'messa', holdBeats: 12, reps: 2, rangeDb: 18 } })] },
  { id: 'rychle-tony', group: 'zpev', kind: 'sing', icon: '🏃', title: 'Rychlé tóny', desc: 'Pohyblivost hlasu – běhy po stupnici čím dál rychleji.', levels: [
    L('1-2-3-2-1, tempo 80', { spec: { type: 'scale', degrees: [1, 2, 3, 2, 1], durs: [1, 1, 1, 1, 2], reps: 3, tempo: 80, syl: 'la' } }),
    L('1–5–1 v osminách, 76', { spec: { type: 'scale', degrees: [1, 2, 3, 4, 5, 4, 3, 2, 1], durs: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2], reps: 3, tempo: 76, syl: 'la' } }),
    L('1–5–1 v osminách, 96', { spec: { type: 'scale', degrees: [1, 2, 3, 4, 5, 4, 3, 2, 1], durs: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2], reps: 3, tempo: 96, syl: 'la' } }),
    L('Oktáva v osminách, 92', { spec: { type: 'scale', degrees: [1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1], durs: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2], reps: 2, tempo: 92, syl: 'la', extended: true } }),
    L('Rozložený akord a běh, 112', { spec: { type: 'scale', degrees: [1, 3, 5, 8, 7, 6, 5, 4, 3, 2, 1], durs: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2], reps: 3, tempo: 112, syl: 'la', extended: true } })] },
  { id: 'melodie-pamet', group: 'zpev', kind: 'sing', icon: '🧠', title: 'Melodie z paměti', desc: 'Poslechni si krátký motiv a zazpívej ho zpátky.', levels: [
    L('3 tóny po krocích', { spec: { type: 'callResponse', degrees: [1, 2, 3], durs: [1, 1, 2], reps: 3, tempo: 84, randomMotif: { n: 3, steps: true } } }),
    L('4 tóny po krocích', { spec: { type: 'callResponse', degrees: [1, 2, 3, 1], durs: [1, 1, 1, 1], reps: 3, tempo: 88, randomMotif: { n: 4, steps: true } } }),
    L('4 tóny se skoky', { spec: { type: 'callResponse', degrees: [1, 3, 5, 3], durs: [1, 1, 1, 1], reps: 3, tempo: 88, randomMotif: { n: 4 } } }),
    L('5 tónů', { spec: { type: 'callResponse', degrees: [1, 3, 2, 4, 3], durs: [1, 1, 1, 1, 2], reps: 3, tempo: 92, randomMotif: { n: 5 } } }),
    L('6 tónů s rytmem', { spec: { type: 'callResponse', degrees: [1, 2, 3, 5, 4, 3], durs: [0.5, 0.5, 1, 1, 1, 2], reps: 3, tempo: 92, randomMotif: { n: 6, rhythm: true } } })] },
  { id: 'dlouhy-ton', group: 'zpev', kind: 'sing', icon: '📏', title: 'Dlouhý rovný tón', desc: 'Drž tón co nejrovněji – měří se kolísání výšky.', metric: 'stability', levels: [
    L('3 sekundy', { spec: { type: 'hold', degrees: [3], holdBeats: 4, reps: 2, tempo: 80, syl: 'u' } }),
    L('5 sekund', { spec: { type: 'hold', degrees: [3], holdBeats: 6, reps: 2, tempo: 72, syl: 'u' } }),
    L('8 sekund', { spec: { type: 'hold', degrees: [3], holdBeats: 8, reps: 2, tempo: 60, syl: 'a' } }),
    L('10 sekund, potichu', { spec: { type: 'hold', degrees: [3], holdBeats: 10, reps: 2, tempo: 60, syl: 'a' }, tol: 30 }),
    L('12 sekund, ±15 centů', { spec: { type: 'hold', degrees: [5], holdBeats: 12, reps: 2, tempo: 60, syl: 'a' }, tol: 15 })] },
];
export const gameById = (id) => GAMES.find((g) => g.id === id);

// ---------- náhoda ----------
export function rng(seed = Date.now()) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- Leitnerovy krabičky: co nejde, přijde dřív znovu ----------
const BOX_WEIGHT = [0, 6, 3, 2, 1, 0.5];
/** Vybere položku podle krabiček (nové = krabička 1). */
export function pickItem(keys, boxes = {}, r = Math.random, avoid = null) {
  const pool = keys.length > 1 && avoid != null ? keys.filter((k) => k !== avoid) : keys;
  const w = pool.map((k) => BOX_WEIGHT[Math.min(5, Math.max(1, boxes[k] || 1))]);
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
export function updateBox(boxes, key, ok) { boxes[key] = ok ? Math.min(5, (boxes[key] || 1) + 1) : 1; return boxes; }

// ---------- generátory otázek ----------
/**
 * Otázka: {key, view, audio?, options:[{id,label}], answer, explain}
 * view: {type:'staff', clef, notes:[{l,oct,acc}], keySig?} | {type:'keyboard', mark?, tap?} | {type:'rhythm', items:[…]} | {type:'text', text, big?} | {type:'listen'}
 * audio: {notes:[{midi,t,d}], inst?} (t, d v sekundách)
 */
export function makeQuestion(gameId, level, r = Math.random, boxes = {}, prevKey = null, style = 'cz') {
  const g = gameById(gameId); const p = g.levels[level];
  const nl = (n) => noteLabel(n, style);
  switch (gameId) {
    case 'noty': {
      const keys = [];
      for (let s = p.from; s <= p.to; s++) for (const acc of p.acc ? [-1, 0, 1] : [0]) { const { l } = fromStep(s); if (p.acc && acc && ((acc > 0 && (l === 2 || l === 6)) || (acc < 0 && (l === 0 || l === 3)))) continue; keys.push(`${p.clef}:${s}:${acc}`); }
      const key = pickItem(keys, boxes, r, prevKey);
      const [clef, s, acc] = key.split(':'); const { l, oct } = fromStep(+s); const note = { l, oct, acc: +acc };
      const optsN = p.acc ? uniqBy(shuffle([note, ...shuffle(keys.map((k) => { const [, ss, aa] = k.split(':'); return { ...fromStep(+ss), acc: +aa }; }), r).filter((n) => nl(n) !== nl(note)).slice(0, 5)], r), nl).slice(0, 6)
        : LETTERS.map((_, i) => ({ l: i, acc: 0 }));
      return { key, view: { type: 'staff', clef, notes: [note] }, audio: { notes: [{ midi: midiOf(l, oct, +acc), t: 0, d: 0.9 }] }, options: optsN.map((n) => ({ id: nl(n), label: nl(n) })), answer: nl(note), explain: `Je to ${nl(note)} (${oct}. oktáva).`, cols: p.acc ? 3 : 4 };
    }
    case 'klavesy': {
      const whites = [0, 2, 4, 5, 7, 9, 11], blacks = [1, 3, 6, 8, 10];
      const pcs = p.white ? whites : p.black ? blacks : [...Array(12).keys()];
      const NAME = { 0: 'C', 1: 'Cis / Des', 2: 'D', 3: 'Dis / Es', 4: 'E', 5: 'F', 6: 'Fis / Ges', 7: 'G', 8: 'Gis / As', 9: 'A', 10: 'Ais / B', 11: 'H' };
      const INTL = { 0: 'C', 1: 'C♯ / D♭', 2: 'D', 3: 'D♯ / E♭', 4: 'E', 5: 'F', 6: 'F♯ / G♭', 7: 'G', 8: 'G♯ / A♭', 9: 'A', 10: 'A♯ / B♭', 11: 'B' };
      const nm = style === 'intl' ? INTL : NAME;
      if (p.mode === 'step') {
        const a = Math.floor(r() * 12), up = r() < 0.5 ? 1 : 2;
        const key = `step:${a}:${up}`;
        return { key, view: { type: 'keyboard', marks: [60 + a, 60 + a + up] }, audio: { notes: [{ midi: 60 + a, t: 0, d: 0.6 }, { midi: 60 + a + up, t: 0.65, d: 0.8 }] }, options: [{ id: 1, label: 'Půltón' }, { id: 2, label: 'Celý tón' }], answer: up, explain: up === 1 ? 'Sousední klávesy (i bílá–černá) = půltón.' : 'Ob jednu klávesu = celý tón (2 půltóny).', cols: 2 };
      }
      const key = pickItem(pcs.map(String), boxes, r, prevKey); const pc = +key;
      if (p.mode === 'tap') return { key, view: { type: 'keyboard', tap: true, text: nm[pc] }, audio: { notes: [{ midi: 60 + pc, t: 0, d: 0.8 }] }, options: [], answer: pc, explain: `${nm[pc]} je ${blacks.includes(pc) ? 'černá' : 'bílá'} klávesa.` };
      const opts = shuffle([pc, ...shuffle(pcs.filter((x) => x !== pc), r).slice(0, Math.min(3, pcs.length - 1))], r);
      return { key, view: { type: 'keyboard', marks: [60 + pc] }, audio: { notes: [{ midi: 60 + pc, t: 0, d: 0.8 }] }, options: opts.map((x) => ({ id: x, label: nm[x] })), answer: pc, explain: `Je to ${nm[pc]}.`, cols: 2 };
    }
    case 'intervaly-noty': {
      if (p.quality && (!p.max || r() < 0.6)) {
        // malá/velká sekunda a tercie na bílých klávesách
        const pairs = [];
        for (let l = 0; l < 7; l++) for (const k of [1, 2]) { const a = { l, oct: 4, acc: 0 }, s = stepOf(l, 4) + k, b = { ...fromStep(s), acc: 0 }; const semi = midiOf(b.l, b.oct) - midiOf(l, 4); pairs.push({ a, b, k, semi }); }
        const keys = pairs.map((x) => `q:${x.a.l}:${x.k}`);
        const key = pickItem(keys, boxes, r, prevKey); const x = pairs[keys.indexOf(key)];
        const name = INTERVALS_CZ[x.semi];
        const opts = x.k === 1 ? ['malá sekunda', 'velká sekunda'] : ['malá tercie', 'velká tercie'];
        return { key, view: { type: 'staff', clef: 'G', notes: [x.a, x.b] }, audio: { notes: [{ midi: midiOf(x.a.l, 4), t: 0, d: 0.7 }, { midi: midiOf(x.b.l, x.b.oct), t: 0.75, d: 0.9 }] }, options: opts.map((o) => ({ id: o, label: cap(o) })), answer: name, explain: `${nl(x.a)}–${nl(x.b)}: ${x.semi} ${x.semi === 1 ? 'půltón' : x.semi < 5 ? 'půltóny' : 'půltónů'} = ${name}.`, cols: 2 };
      }
      const max = p.max || 7;
      const keys = []; for (let k = 0; k <= max; k++) keys.push(String(k));
      const key = pickItem(keys, boxes, r, prevKey); const k = +key;
      const s0 = Math.floor(r() * (8 - Math.min(k, 7))) + (r() < 0.3 ? -2 : 0);
      const a = { ...fromStep(s0), acc: 0 }, b = { ...fromStep(s0 + k), acc: 0 };
      const opts = GENERIC_CZ.slice(0, max + 1);
      return { key, view: { type: 'staff', clef: 'G', notes: [a, b] }, audio: { notes: [{ midi: midiOf(a.l, a.oct), t: 0, d: 0.7 }, { midi: midiOf(b.l, b.oct), t: 0.75, d: 0.9 }] }, options: opts.map((o) => ({ id: o, label: cap(o) })), answer: GENERIC_CZ[k], explain: `Od ${nl(a)} do ${nl(b)} je to ${k + 1}. stupeň = ${GENERIC_CZ[k]}.`, cols: opts.length > 4 ? 3 : 2 };
    }
    case 'rytmus-hodnoty': {
      if (p.sum) {
        const vals = ['h', 'q', 'q', 'e', 'e', 'q.', 'e', 'h.', 'w'];
        let items, total;
        do { items = []; total = 0; const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const v = pick(vals, r); items.push(v); total += VALUES[v].beats; } } while (total > 6 || total !== Math.round(total * 2) / 2);
        const key = 'sum:' + items.join(',');
        const opts = uniq(shuffle([total, total + 1, Math.max(0.5, total - 1), total + 0.5].filter((x) => x > 0), r)).slice(0, 4).sort((x, y) => x - y);
        return { key, view: { type: 'rhythm', items }, options: opts.map((x) => ({ id: x, label: beatsLabel(x) })), answer: total, explain: items.map((v) => `${VALUES[v].name} ${beatsLabel(VALUES[v].beats)}`).join(' + ') + ` = ${beatsLabel(total)}.`, cols: 2 };
      }
      const key = pickItem(p.set, boxes, r, prevKey); const v = VALUES[key];
      const opts = uniq(p.set.map((x) => VALUES[x].beats)).sort((x, y) => x - y);
      return { key, view: { type: 'rhythm', items: [key] }, options: opts.map((x) => ({ id: x, label: beatsLabel(x) })), answer: v.beats, explain: `${cap(v.name)} trvá ${beatsLabel(v.beats)} (ve 4/4 taktu).`, cols: 2 };
    }
    case 'toniny': {
      const keys = [];
      for (let n = 0; n <= p.max; n++) { keys.push(`#:${n}`); if (n && n <= 4) keys.push(`b:${n}`); }
      const key = pickItem(keys, boxes, r, prevKey); const [t, n] = key.split(':');
      const pair = (t === '#' ? SHARP_KEYS : FLAT_KEYS)[+n];
      const minor = p.minor === true || (p.minor === 'mix' && r() < 0.5);
      const ans = minor ? pair[1] : pair[0];
      const all = uniq([...SHARP_KEYS.slice(0, p.max + 1), ...FLAT_KEYS.slice(0, Math.min(4, p.max) + 1)].map((x) => (minor ? x[1] : x[0])));
      const opts = shuffle([ans, ...shuffle(all.filter((x) => x !== ans), r).slice(0, 3)], r);
      return { key: key + (minor ? 'm' : ''), view: { type: 'staff', clef: 'G', notes: [], keySig: { type: t, n: +n } }, options: opts.map((o) => ({ id: o, label: o })), answer: ans, explain: `${+n ? `${n} ${t === '#' ? (+n === 1 ? 'křížek' : +n < 5 ? 'křížky' : 'křížků') : +n === 1 ? 'béčko' : +n < 5 ? 'béčka' : 'béček'}` : 'Bez předznamenání'} = ${pair[0]} nebo paralelní ${pair[1]}.`, cols: 2 };
    }
    // ===== poslech =====
    case 'vyssi-nizsi': {
      const base = 55 + Math.floor(r() * 14);
      const dir = p.same && r() < 0.2 ? 0 : r() < 0.5 ? 1 : -1;
      const key = `c${p.cents}:${dir}`;
      const opts = [{ id: 1, label: 'Druhý je vyšší ⬆' }, { id: -1, label: 'Druhý je nižší ⬇' }, ...(p.same ? [{ id: 0, label: 'Stejně vysoko =' }] : [])];
      return { key, view: { type: 'listen', text: 'Dva tóny po sobě. Je druhý vyšší, nebo nižší?' }, audio: { inst: 'guide', notes: [{ midi: base, t: 0, d: 0.9 }, { midi: base + (dir * p.cents) / 100, t: 1.05, d: 0.9 }] }, options: opts, answer: dir, explain: dir ? `Druhý byl o ${p.cents} centů ${dir > 0 ? 'výš' : 'níž'}.` : 'Byly stejně vysoko.', cols: 1 };
    }
    case 'intervaly-sluch': {
      const key = pickItem(p.set.map(String), boxes, r, prevKey); const semi = +key;
      const down = p.down && r() < 0.4;
      const root = 55 + Math.floor(r() * 8) + (down ? 12 : 0);
      const b = root + (down ? -semi : semi);
      const anc = down ? ANCHOR_DOWN[semi] : ANCHORS[semi]?.text;
      return { key: key + (down ? 'd' : ''), view: { type: 'listen', text: `Dva tóny ${down ? 'dolů' : 'nahoru'}. Jaký je to interval?` }, audio: { notes: [{ midi: root, t: 0, d: 0.8 }, { midi: b, t: 0.85, d: 1.0 }] }, options: p.set.map((s) => ({ id: s, label: cap(INTERVALS_CZ[s]) })), answer: semi, explain: `${cap(INTERVALS_CZ[semi])} (${semi} ${semi === 1 ? 'půltón' : semi < 5 && semi ? 'půltóny' : 'půltónů'}).${anc ? ' Opěrná píseň: ' + anc + '.' : ''}`, anchor: down ? null : ANCHORS[semi]?.song, cols: p.set.length > 4 ? 2 : 1 };
    }
    case 'dur-moll': {
      const Q = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], dom7: [0, 4, 7, 10] };
      const NAME = { maj: 'Dur (veselý)', min: 'Moll (smutný)', dim: 'Zmenšený (napjatý)', dom7: 'Dominantní septakord' };
      const key = pickItem(p.set, boxes, r, prevKey);
      const root = 50 + Math.floor(r() * 10);
      let ns = Q[key].map((x) => root + x);
      if (p.inv) { const k = Math.floor(r() * ns.length); for (let i = 0; i < k; i++) ns.push(ns.shift() + 12); }
      const notes = p.arp ? ns.map((m, i) => ({ midi: m, t: i * 0.35, d: 1.6 - i * 0.35 })) : ns.map((m) => ({ midi: m, t: 0, d: 1.6 }));
      return { key, view: { type: 'listen', text: 'Zazní akord. Jaký je?' }, audio: { notes }, options: p.set.map((s) => ({ id: s, label: NAME[s] })), answer: key, explain: key === 'maj' ? 'Dur: velká tercie dole (4 půltóny) – zní jasně.' : key === 'min' ? 'Moll: malá tercie dole (3 půltóny) – zní tlumeně.' : key === 'dim' ? 'Zmenšený: dvě malé tercie nad sebou – zní napjatě.' : 'Septakord: dur + malá septima – chce se rozvést.', cols: 1 };
    }
    case 'solmizace': {
      const key = pickItem(p.set, boxes, r, prevKey);
      const tonic = 55 + Math.floor(r() * 7);
      const ctx = [{ midi: tonic, t: 0, d: 0.45 }, { midi: tonic + 4, t: 0.5, d: 0.45 }, { midi: tonic + 7, t: 1.0, d: 0.45 }, { midi: tonic, t: 1.5, d: 0.8 }];
      return { key, view: { type: 'listen', text: 'Nejdřív zazní do–mi–sol–do, pak hledaný tón.' }, audio: { notes: [...ctx, { midi: tonic + SOLF_SEMI[key], t: 2.6, d: 1.1 }] }, options: SOLF.filter((s) => p.set.includes(s)).map((s) => ({ id: s, label: s })), answer: key, explain: `Byl to „${key}“ – ${['tónika, domov', '2. stupeň', '3. stupeň (určuje dur)', '4. stupeň', '5. stupeň, dominanta', '6. stupeň', '7. stupeň – táhne nahoru k do'][SOLF.indexOf(key)]}.`, cols: p.set.length > 3 ? 3 : p.set.length };
    }
    case 'rytmus-diktat': {
      const CELLS = { q: [[0, 1]], h: [[0, 2]], ee: [[0, 0.5], [0.5, 0.5]], qr: [], 'q.e': [[0, 1.5], [1.5, 0.5]], eqe: [[0, 0.5], [0.5, 1], [1.5, 0.5]], ssss: [[0, 0.25], [0.25, 0.25], [0.5, 0.25], [0.75, 0.25]] };
      const LEN = { q: 1, h: 2, ee: 1, qr: 1, 'q.e': 2, eqe: 2, ssss: 1 };
      const bar = () => { const out = []; let b = 0; while (b < 4) { const c = pick(p.pool.filter((x) => LEN[x] <= 4 - b), r); out.push(c); b += LEN[c]; } return out; };
      const target = bar(); const k = target.join(' ');
      const others = []; let guard = 0;
      while (others.length < 2 && guard++ < 50) { const o = bar(); if (o.join(' ') !== k && !others.some((x) => x.join(' ') === o.join(' '))) others.push(o); }
      const opts = shuffle([target, ...others], r);
      const notes = []; let b0 = 0; for (const c of target) { for (const [t, d] of CELLS[c]) notes.push({ midi: 72, t: (b0 + t) * 0.6, d: d * 0.6 * 0.8, inst: 'click' }); b0 += LEN[c]; }
      return { key: k, view: { type: 'listen', text: 'Poslechni si takt (4 doby, tempo 100) a vyber zápis.' }, audio: { notes, count: 4, spb: 0.6 }, options: opts.map((o) => ({ id: o.join(' '), label: '', rhythm: o })), answer: k, explain: 'Ťukej si doby a počítej „raz-a-dva-a“.', cols: 1 };
    }
    case 'melodie-smer': {
      const n = p.n;
      const shape = [];
      for (let i = 1; i < n; i++) shape.push(pick(p.big ? [1, -1] : [1, -1, 0], r));
      const key = shape.join(',');
      const steps = p.small ? [1, 2] : p.big ? [4, 5, 7] : [2, 3, 4];
      const ms = [55 + Math.floor(r() * 8)];
      for (const s of shape) ms.push(ms[ms.length - 1] + s * pick(steps, r));
      const arrow = (sh) => sh.map((s) => (s > 0 ? '↗' : s < 0 ? '↘' : '→')).join(' ');
      const others = []; let guard = 0;
      while (others.length < 2 && guard++ < 50) { const o = shape.map(() => pick(p.big ? [1, -1] : [1, -1, 0], r)); if (o.join() !== key && !others.some((x) => x.join() === o.join())) others.push(o); }
      return { key, view: { type: 'listen', text: `Zazní ${n} tóny. Kam se melodie pohybuje?` }, audio: { notes: ms.map((m, i) => ({ midi: m, t: i * 0.6, d: 0.55 })) }, options: shuffle([shape, ...others], r).map((o) => ({ id: o.join(','), label: arrow(o) })), answer: key, explain: `Správně: ${arrow(shape)} (↗ nahoru, ↘ dolů, → stejně).`, cols: 1 };
    }
  }
  throw new Error('Neznámá hra ' + gameId);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const uniq = (a) => [...new Set(a)];
const uniqBy = (a, f) => { const s = new Set(); return a.filter((x) => { const k = f(x); if (s.has(k)) return false; s.add(k); return true; }); };

// ---------- náhodný motiv pro „Melodie z paměti“ ----------
export function randomMotif({ n = 4, steps = false, rhythm = false } = {}, r = Math.random) {
  const degs = [1];
  for (let i = 1; i < n; i++) {
    const prev = degs[i - 1];
    const moves = steps ? [-1, 1] : [-2, -1, 1, 2];
    let d; let guard = 0;
    do { d = prev + pick(moves, r); } while ((d < 1 || d > 6) && guard++ < 20);
    degs.push(Math.max(1, Math.min(6, d)));
  }
  degs[n - 1] = pick([1, 3, 5].filter((x) => Math.abs(x - degs[n - 2]) <= 2) .concat([1]), r);
  const durs = rhythm ? degs.map((_, i) => (i === n - 1 ? 2 : pick([0.5, 1, 1], r))) : degs.map((_, i) => (i === n - 1 ? 2 : 1));
  // délka motivu na celé doby
  const sum = durs.reduce((a, b) => a + b, 0); if (sum % 1) durs[n - 1] += 1 - (sum % 1);
  return { degrees: degs, durs };
}

// ---------- metriky zpívacích her ----------
/** Rytmus: průměrná odchylka (ms, + = pozdě), pravidelnost (směrodatná odchylka ms), trefené nástupy. */
export function rhythmMetrics(notes) {
  const d = notes.filter((n) => n.delay != null).map((n) => n.delay * 1000);
  if (!d.length) return { mean: null, sd: null, hit: 0, total: notes.length };
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length);
  return { mean: Math.round(mean), sd: Math.round(sd), hit: d.length, total: notes.length };
}
/** Držení tempa: z nástupů po zmlknutí metronomu – změna tempa v % (záporná = zpomaluješ) a pravidelnost. */
export function tempoMetrics(notes, afterSec) {
  const late = notes.filter((n) => n.delay != null && n.start >= afterSec).map((n) => ({ t: n.start, a: n.start + n.delay }));
  if (late.length < 3) return { drift: null, sd: null, n: late.length };
  // regrese skutečných nástupů na cílové časy: sklon 1 = stejné tempo
  const mx = late.reduce((s, x) => s + x.t, 0) / late.length, my = late.reduce((s, x) => s + x.a, 0) / late.length;
  let sxy = 0, sxx = 0; for (const x of late) { sxy += (x.t - mx) * (x.a - my); sxx += (x.t - mx) ** 2; }
  const slope = sxx ? sxy / sxx : 1;
  const ioi = []; for (let i = 1; i < late.length; i++) ioi.push(late[i].a - late[i - 1].a);
  const m = ioi.reduce((a, b) => a + b, 0) / ioi.length;
  const sd = Math.sqrt(ioi.reduce((a, b) => a + (b - m) ** 2, 0) / ioi.length);
  return { drift: Math.round((1 / slope - 1) * 1000) / 10, sd: Math.round(sd * 1000), n: late.length };
}
/** Rychlá trefa: čas od začátku cíle do 3 po sobě jdoucích snímků v toleranci (s). frames: [{t, m}] (s). */
export function reactionTimes(targets, frames, tolCents = 50) {
  const out = [];
  for (const tg of targets) {
    let run = 0, runStart = 0, hit = null;
    for (const f of frames) {
      if (f.t < tg.start - 0.05) continue;
      if (f.t > tg.end) break;
      const c = f.m == null ? Infinity : Math.abs(((((f.m - tg.midi) * 100) % 1200) + 1800) % 1200 - 600);
      if (c <= tolCents) { if (!run) runStart = f.t; run++; if (run >= 3 && hit == null) hit = runStart - tg.start; } else run = 0;
    }
    out.push(hit == null ? null : Math.max(0, Math.round(hit * 1000)));
  }
  return out;
}
/** Stabilita drženého tónu: směrodatná odchylka v centech ve střední části tónu. */
export function stability(targets, frames) {
  const res = [];
  for (const tg of targets) {
    const a = tg.start + (tg.end - tg.start) * 0.2, b = tg.end - (tg.end - tg.start) * 0.1;
    const c = frames.filter((f) => f.t >= a && f.t <= b && f.m != null).map((f) => (f.m - tg.midi) * 100);
    if (c.length < 5) { res.push(null); continue; }
    const m = c.reduce((x, y) => x + y, 0) / c.length;
    res.push(Math.round(Math.sqrt(c.reduce((x, y) => x + (y - m) ** 2, 0) / c.length)));
  }
  return res;
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

/** Body (0–100) a údaje pro výsledek zpívací hry. */
export function singGameScore(game, levelIdx, result) {
  const metrics = [];
  let score = result.overall;
  if (game.metric === 'rhythm' || game.metric === 'tempo') {
    const m = rhythmMetrics(result.notes || []);
    if (m.mean != null) {
      metrics.push(['Přesnost', `${Math.abs(m.mean)} ms ${m.mean > 15 ? 'pozdě' : m.mean < -15 ? 'napřed' : '– přesně na dobu'}`]);
      metrics.push(['Pravidelnost', `± ${m.sd} ms ${m.sd < 40 ? '(výborná)' : m.sd < 70 ? '(dobrá)' : '(kolísá)'}`]);
    }
    metrics.push(['Trefené nástupy', `${m.hit} z ${m.total}`]);
    if (game.metric === 'tempo') {
      const lvl = game.levels[levelIdx];
      const spb = 60 / (lvl.spec.tempo || 80);
      const t = tempoMetrics(result.notes || [], (lvl.metroUntil + (lvl.spec.countIn ?? 4)) * spb);
      if (t.drift != null) {
        metrics.push(['Tempo bez metronomu', t.drift > 0 ? `zrychluješ o ${t.drift} %` : t.drift < 0 ? `zpomaluješ o ${-t.drift} %` : 'přesně drženo']);
        score = Math.round(0.6 * score + 0.4 * Math.max(0, 100 - Math.abs(t.drift) * 8));
      }
    }
  } else if (game.metric === 'reaction') {
    const tg = (result.notes || []).map((n) => ({ start: n.start, end: n.end, midi: n.midi ?? n.target }));
    const rt = reactionTimes(tg.filter((x) => x.midi != null), result.frames || [], game.levels[levelIdx].tol || 50).filter((x) => x != null);
    const md = median(rt);
    if (md != null) {
      metrics.push(['Průměrná trefa za', `${(md / 1000).toFixed(2)} s`]);
      metrics.push(['Nejrychlejší', `${(Math.min(...rt) / 1000).toFixed(2)} s`]);
      score = Math.round(0.5 * score + 0.5 * Math.max(0, Math.min(100, 100 - ((md - 250) / 1250) * 100)));
    } else metrics.push(['Trefa', 'žádný tón jsem nezachytil přesně']);
  } else if (game.metric === 'stability') {
    const tg = (result.notes || []).map((n) => ({ start: n.start, end: n.end, midi: n.midi ?? n.target }));
    const st = stability(tg.filter((x) => x.midi != null), result.frames || []).filter((x) => x != null);
    if (st.length) {
      const best = Math.min(...st);
      metrics.push(['Kolísání výšky', `± ${best} centů ${best <= 10 ? '(jako struna)' : best <= 20 ? '(velmi rovné)' : best <= 35 ? '(dobré)' : '(kolísá)'}`]);
      score = Math.round(0.6 * score + 0.4 * Math.max(0, 100 - (best - 8) * 2.5));
    }
  } else if (game.metric === 'dynamics' && result.dynamics != null) {
    metrics.push(['Dynamika', `${result.dynamics} bodů`]);
    if (result.pitch != null) metrics.push(['Výška během dynamiky', `${result.pitch} bodů`]);
  } else if (result.pitch != null) {
    metrics.push(['Přesnost výšky', `${result.pitch} bodů`]);
    if (result.rhythm != null) metrics.push(['Rytmus', `${result.rhythm} bodů`]);
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), metrics };
}

/** Hvězdičky podle bodů (stejně jako lekce) a odemčení další úrovně od 1 hvězdičky. */
export const gameStars = (score) => (score >= 85 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0);
export function levelUnlocked(gp, idx) { return idx === 0 || (gp?.levels?.[idx - 1]?.stars || 0) >= 1; }
