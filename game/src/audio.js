// All sound is synthesized live with WebAudio — no audio files.
// Three generated radio stations, engine, sirens, shots, pickups.
import { clamp } from './random.js';

const STATIONS = [
  { name: 'SOL FM', bpm: 112, scale: [0, 3, 5, 7, 10], base: 110, wave: 'sawtooth' },
  { name: 'BAY FM', bpm: 96, scale: [0, 2, 4, 7, 9], base: 130.8, wave: 'triangle' },
  { name: 'TIDE FM', bpm: 128, scale: [0, 3, 5, 8, 10], base: 98, wave: 'square' },
];

export function createAudio() {
  const A = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    analyser: null, station: 0, nextNote: 0, noteTimer: null,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    started: false, musicPeak: 0, sfxPeak: 0,
  };

  A.ensure = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain(); A.master.gain.value = 0.5; A.master.connect(A.ctx.destination);
    A.analyser = A.ctx.createAnalyser(); A.analyser.fftSize = 512;
    A.analyser.connect(A.master);
    A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = 0.16; A.musicGain.connect(A.analyser);
    A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = 0.5; A.sfxGain.connect(A.analyser);
    // Engine drone.
    A.engineOsc = A.ctx.createOscillator(); A.engineOsc.type = 'sawtooth'; A.engineOsc.frequency.value = 55;
    A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0.0;
    A.engineOsc.connect(A.engineGain); A.engineGain.connect(A.sfxGain); A.engineOsc.start();
    // Police siren (two-tone wail).
    A.sirenOsc = A.ctx.createOscillator(); A.sirenOsc.type = 'sine'; A.sirenOsc.frequency.value = 750;
    A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0.0;
    A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.sfxGain); A.sirenOsc.start();
    A.started = true;
    A.nextNote = A.ctx.currentTime + 0.1;
    A.scheduleLoop();
  };

  A.scheduleLoop = function () {
    if (!A.ctx) return;
    const st = STATIONS[A.station];
    const beat = 60 / st.bpm / 2; // eighth notes
    const tick = () => {
      if (!A.ctx) return;
      while (A.nextNote < A.ctx.currentTime + 0.25) {
        A.playNote(st, A.nextNote);
        A.nextNote += beat;
      }
      A.noteTimer = setTimeout(tick, 90);
    };
    tick();
  };

  A.playNote = function (st, t) {
    // A simple generative line: walk the scale, bass on the beat.
    const step = Math.floor(t / (60 / st.bpm / 2));
    const idx = (step * 7 + Math.floor(step / 4) * 3) % st.scale.length;
    const semis = st.scale[idx] + 12 * (1 + (step % 8 >= 6 ? 1 : 0));
    const freq = st.base * Math.pow(2, semis / 12);
    const o = A.ctx.createOscillator(); o.type = st.wave; o.frequency.value = freq;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    o.connect(g); g.connect(A.musicGain);
    o.start(t); o.stop(t + 0.4);
    if (step % 4 === 0) {
      const b = A.ctx.createOscillator(); b.type = 'sine'; b.frequency.value = st.base / 2;
      const bg = A.ctx.createGain();
      bg.gain.setValueAtTime(0.0, t);
      bg.gain.linearRampToValueAtTime(0.7, t + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      b.connect(bg); bg.connect(A.musicGain);
      b.start(t); b.stop(t + 0.35);
    }
  };

  A.setStation = function (i) {
    A.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    return STATIONS[A.station].name;
  };
  A.stationName = function () { return STATIONS[A.station].name; };

  A.setEngine = function (speed01, on) {
    if (!A.ctx) return;
    const f = 50 + speed01 * 160;
    A.engineOsc.frequency.setTargetAtTime(f, A.ctx.currentTime, 0.08);
    A.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0.0, A.ctx.currentTime, 0.1);
  };
  A.setSiren = function (on) {
    if (!A.ctx) return;
    A.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0.0, A.ctx.currentTime, 0.2);
    if (on) {
      const now = A.ctx.currentTime;
      A.sirenOsc.frequency.cancelScheduledValues(now);
      A.sirenOsc.frequency.setValueAtTime(660, now);
      A.sirenOsc.frequency.linearRampToValueAtTime(920, now + 0.5);
      A.sirenOsc.frequency.linearRampToValueAtTime(660, now + 1.0);
    }
  };

  function noiseBurst(dur, freq, vol, type) {
    if (!A.ctx) return;
    const len = Math.floor(A.ctx.sampleRate * dur);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource(); src.buffer = buf;
    const f = A.ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    const g = A.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(A.sfxGain);
    src.start();
  }
  function blip(freq, dur, vol, type) {
    if (!A.ctx) return;
    const o = A.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, A.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + dur);
    o.connect(g); g.connect(A.sfxGain);
    o.start(); o.stop(A.ctx.currentTime + dur);
  }
  A.shot = function () { noiseBurst(0.12, 1800, 0.5, 'bandpass'); };
  A.shotgun = function () { noiseBurst(0.25, 900, 0.7); };
  A.explosion = function () { noiseBurst(0.7, 300, 0.9); blip(60, 0.5, 0.6, 'sine'); };
  A.crash = function () { noiseBurst(0.2, 500, 0.5); };
  A.pickup = function () { blip(880, 0.12, 0.4); setTimeout(() => blip(1320, 0.15, 0.4), 90); };
  A.cash = function () { blip(1046, 0.1, 0.4); setTimeout(() => blip(1568, 0.2, 0.4), 80); };
  A.horn = function () { blip(370, 0.25, 0.35, 'square'); };
  A.busted = function () { blip(220, 0.4, 0.5, 'sawtooth'); setTimeout(() => blip(165, 0.6, 0.5, 'sawtooth'), 300); };
  A.missionOk = function () { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.18, 0.4), i * 110)); };
  A.reload = function () { blip(300, 0.08, 0.3, 'square'); };

  // Analyser peak (0..255) for the play-test to prove sound is audible.
  A.peak = function () {
    if (!A.analyser) return 0;
    const buf = new Uint8Array(A.analyser.frequencyBinCount);
    A.analyser.getByteFrequencyData(buf);
    let m = 0, sum = 0;
    for (let i = 0; i < buf.length; i++) { if (buf[i] > m) m = buf[i]; sum += buf[i]; }
    A.musicPeak = Math.max(A.musicPeak, m);
    return { peak: m, avg: sum / buf.length };
  };
  return A;
}
