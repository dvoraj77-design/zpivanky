// Zapisovač MIDI pro testy: více stop, program, kanál, text (karaoke typ 1 nebo lyric typ 5), tempo, takt, tónina.
const vlq = (n) => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
function track(events) {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const bytes = []; let last = 0;
  for (const e of events) { bytes.push(...vlq(e.tick - last), ...e.data); last = e.tick; }
  bytes.push(0, 0xff, 0x2f, 0);
  return [0x4d, 0x54, 0x72, 0x6b, ...u32(bytes.length), ...bytes];
}
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const meta = (type, data) => [0xff, type, ...vlq(data.length), ...data];
export function encodeCp1250(s) {
  const map = { 'á': 0xe1, 'č': 0xe8, 'ď': 0xef, 'é': 0xe9, 'ě': 0xec, 'í': 0xed, 'ň': 0xf2, 'ó': 0xf3, 'ř': 0xf8, 'š': 0x9a, 'ť': 0x9d, 'ú': 0xfa, 'ů': 0xf9, 'ý': 0xfd, 'ž': 0x9e, 'Č': 0xc8, 'Ř': 0xd8, 'Š': 0x8a, 'Ž': 0x8e };
  return [...s].map((c) => map[c] ?? c.charCodeAt(0));
}
/**
 * tracks: [{name, ch, program, notes:[{t, d, p, vel}], text:[{t, text}], textType: 1 | 5, cp1250: bool}]
 * Čas v dobách (čtvrťových notách).
 */
export function writeMidi({ ppq = 480, bpm = 100, meter = [4, 4], keySf = 0, tracks }) {
  const T = (b) => Math.round(b * ppq);
  const conductor = [
    { tick: 0, order: 0, data: meta(0x03, [...Buffer.from('Test song')]) },
    { tick: 0, order: 1, data: meta(0x51, [((6e7 / bpm) >> 16) & 255, ((6e7 / bpm) >> 8) & 255, (6e7 / bpm) & 255]) },
    { tick: 0, order: 2, data: meta(0x58, [meter[0], Math.log2(meter[1]), 24, 8]) },
    { tick: 0, order: 3, data: meta(0x59, [keySf & 255, 0]) },
  ];
  const chunks = [track(conductor)];
  for (const tr of tracks) {
    const ev = [{ tick: 0, order: 0, data: meta(0x03, [...Buffer.from(tr.name)]) }];
    if (tr.program != null) ev.push({ tick: 0, order: 1, data: [0xc0 | tr.ch, tr.program] });
    for (const n of tr.notes || []) {
      ev.push({ tick: T(n.t), order: 3, data: [0x90 | tr.ch, n.p, n.vel ?? 90] });
      ev.push({ tick: T(n.t + n.d), order: 2, data: [0x80 | tr.ch, n.p, 0] });
    }
    for (const x of tr.text || []) ev.push({ tick: T(x.t), order: 1, data: meta(tr.textType ?? 1, tr.cp1250 ? encodeCp1250(x.text) : [...Buffer.from(x.text)]) });
    chunks.push(track(ev));
  }
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, chunks.length, (ppq >> 8) & 255, ppq & 255];
  return Buffer.from([...head, ...chunks.flat()]);
}

/** Karaoke píseň: melodie (Hvězdičko) ve 3. stopě s textem v cp1250, basa, klavírní akordy, bicí. */
export function karaokeSong() {
  const mel = [[0, 60], [1, 60], [2, 67], [3, 67], [4, 69], [5, 69], [6, 67, 2], [8, 65], [9, 65], [10, 64], [11, 64], [12, 62], [13, 62], [14, 60, 2]];
  const syl = ['\\Hvěz', 'dič', 'ko,', ' ty', ' ma', 'lič', 'ká,', '/kdo', ' tě', ' na', ' ne', 'be', ' dal?', ''];
  const notes = mel.map(([t, p, d = 1]) => ({ t: t + 4, d: d * 0.95, p, vel: 100 }));
  const text = mel.map(([t], i) => ({ t: t + 4 - 0.02, text: syl[i] })).filter((x) => x.text);
  const chords = [[0, [48, 52, 55]], [4, [48, 52, 55]], [6, [48, 52, 55]], [8, [53, 57, 60]], [10, [48, 52, 55]], [12, [55, 59, 62]], [14, [48, 52, 55]]];
  const piano = [];
  for (let b = 0; b < 16; b++) { const c = chords.filter((x) => x[0] <= b).at(-1)[1]; for (const p of c) piano.push({ t: b + 4, d: 0.9, p: p + 12, vel: 60 }); }
  const bass = chords.map(([t, c]) => ({ t: t + 4, d: 1.9, p: c[0] - 12, vel: 80 }));
  const drums = []; for (let b = 0; b < 20; b++) { drums.push({ t: b, d: 0.1, p: b % 2 ? 38 : 36, vel: 90 }); drums.push({ t: b + 0.5, d: 0.1, p: 42, vel: 60 }); }
  return writeMidi({
    bpm: 96, tracks: [
      { name: 'Piano', ch: 0, program: 0, notes: piano },
      { name: 'Bass', ch: 1, program: 33, notes: bass },
      { name: 'Melody', ch: 2, program: 73, notes, text, textType: 1, cp1250: true },
      { name: 'Drums', ch: 9, notes: drums },
    ],
  });
}
