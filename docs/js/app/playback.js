// Přehrání pokusu (moje nahrávka proti cíli) a export WAV (hlas + doprovod).
import { engine } from '../audio/engine.js';
import { Transport } from '../audio/transport.js';
import { encodeWav } from '../audio/wav.js';

/** Přehraje doprovod + vodicí melodii a moji nahrávku zarovnanou podle zpoždění. */
export async function playAttempt(opts, rec, { fromBeat = 0, toBeat = null, accomp = true, guide = true, voice = true } = {}) {
  await engine.ensureContext();
  await engine.loadInstruments().catch(() => {});
  const ci = opts.countIn || 0;
  const spb = 60 / (opts.tempo * (opts.factor || 1));
  const events = opts.audio.filter((e) => (e.bus === 'guide' ? guide : accomp)).map((e) => ({ ...e, t: e.t + ci, vel: (e.vel ?? 0.6) * (e.bus === 'guide' ? 0.5 : 0.8) }));
  const tr = new Transport(engine);
  const end = toBeat ?? Math.max(...opts.items.map((i) => i.t + i.d)) + ci + 1;
  const clips = accomp ? (opts.clips || []).filter((c) => c.bus === 'accomp').map((c) => ({ ...c, beat0: c.beat0 + ci })) : [];
  tr.load({ events, tempo: opts.tempo, factor: opts.factor || 1, length: end, clips });
  const t0 = tr.start(fromBeat, 0.15);
  let src = null;
  if (voice && rec?.pcm?.length) {
    const offsetSec = fromBeat * spb + (rec.latency || 0) - (rec.offset || 0);
    if (offsetSec >= 0) src = engine.playPcm(rec.pcm, rec.rate, t0, engine.bus.playback, offsetSec);
    else src = engine.playPcm(rec.pcm, rec.rate, t0 - offsetSec, engine.bus.playback, 0);
  }
  const stopAt = t0 + (end - fromBeat) * spb;
  const timer = setTimeout(() => stop(), (stopAt - engine.now) * 1000 + 200);
  function stop() { clearTimeout(timer); tr.stop(); try { src?.stop(); } catch { /* */ } }
  return { stop, transport: tr, t0 };
}

/** Vyrenderuje mix (hlas + doprovod) do WAV (mono 32 kHz). */
export async function renderMixWav(opts, rec, { accompGain = 0.6, voiceGain = 1 } = {}) {
  await engine.loadInstruments();
  const sr = 32000;
  const ci = opts.countIn || 0;
  const spb = 60 / (opts.tempo * (opts.factor || 1));
  const voiceDur = rec.pcm.length / rec.rate;
  const dur = voiceDur + 2;
  const off = new OfflineAudioContext(1, Math.ceil(dur * sr), sr);
  const master = off.createGain(); master.connect(off.destination);
  // hlas
  const vb = off.createBuffer(1, rec.pcm.length, rec.rate);
  const vd = vb.getChannelData(0);
  for (let i = 0; i < rec.pcm.length; i++) vd[i] = rec.pcm[i] / 32768;
  const vs = off.createBufferSource(); vs.buffer = vb;
  const vg = off.createGain(); vg.gain.value = voiceGain; vs.connect(vg); vg.connect(master); vs.start(0);
  // doprovod: beat b zazněl v čase startTime + b*spb; hlas začíná v rec.start → posun = b*spb - offset + latency
  const ag = off.createGain(); ag.gain.value = accompGain; ag.connect(master);
  for (const e of opts.audio) {
    if (e.bus === 'guide') continue;
    const t = (e.t + ci) * spb - (rec.offset || 0) + (rec.latency || 0);
    if (t < 0 || t > dur) continue;
    const s = engine.inst[e.inst];
    if (!s?.buffers?.length) continue;
    let best = s.buffers[0];
    for (const b of s.buffers) if (Math.abs(b.midi - e.midi) < Math.abs(best.midi - e.midi)) best = b;
    const src = off.createBufferSource(); src.buffer = best.buf; src.playbackRate.value = Math.pow(2, (e.midi - best.midi) / 12);
    const g = off.createGain(); const d = e.d * spb;
    g.gain.setValueAtTime(e.vel ?? 0.6, t); g.gain.setValueAtTime(e.vel ?? 0.6, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.3);
    src.connect(g); g.connect(ag); src.start(t); src.stop(t + d + 0.35);
  }
  // originální doprovod (bez zpěvu)
  for (const c of opts.clips || []) {
    if (c.bus !== 'accomp') continue;
    const p = c.spb / spb;
    const t0 = (c.beat0 + ci) * spb - (rec.offset || 0) + (rec.latency || 0);
    const src = off.createBufferSource(); src.buffer = c.buffer; src.playbackRate.value = p;
    const g = off.createGain(); g.gain.value = c.gain ?? 1; src.connect(g); g.connect(ag);
    if (t0 >= 0) src.start(t0, 0); else src.start(0, -t0 * p);
  }
  const buf = await off.startRendering();
  const data = buf.getChannelData(0);
  let peak = 0; for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0.99) for (let i = 0; i < data.length; i++) data[i] /= peak * 1.02;
  return encodeWav(data, sr);
}

export function voiceWav(rec) { return encodeWav(rec.pcm, rec.rate); }
