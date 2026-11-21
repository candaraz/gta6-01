// audio.js — Solmar Bay v3: every sound is synthesized live with WebAudio.
// One job: engine, sirens, gunshots, explosions, pickups, and 3 radio
// stations of generated music. No audio files, no network.

import { STATIONS } from './config.js';

export function createAudio() {
  let ctx = null, master = null, musicGain = null, sfxGain = null, analyser = null;
  let engineOsc1 = null, engineOsc2 = null, engineGain = null, windSrc = null, windGain = null, windFilter = null;
  let sirenOsc = null, sirenGain = null, sirenOn = false, sirenPhase = 0;
  let station = 0, musicTimer = null, step = 0, nextNoteTime = 0;
  let noiseBuf = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.55;
    analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    master.connect(analyser); analyser.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.34; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    // Shared white-noise buffer for wind, shots, explosions, hats.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Engine: two detuned oscillators + filtered wind noise.
    engineOsc1 = ctx.createOscillator(); engineOsc1.type = 'sawtooth'; engineOsc1.frequency.value = 55;
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 28;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    const engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 520;
    engineOsc1.connect(engFilter); engineOsc2.connect(engFilter);
    engFilter.connect(engineGain); engineGain.connect(sfxGain);
    engineOsc1.start(); engineOsc2.start();
    windSrc = ctx.createBufferSource(); windSrc.buffer = noiseBuf; windSrc.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 700; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(sfxGain);
    windSrc.start();
    // Siren: a single oscillator that alternates two tones.
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 760;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(sfxGain);
    sirenOsc.start();
    return true;
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, filterFreq, vol, type = 'lowpass') {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // ---- music: a 16-step loop per station (bass + chord stabs + hats) ----
  // Chord roots (Hz) and bass patterns per station mood, minor pentatonic.
  const PROGS = {
    sunset: { roots: [110, 87.3, 130.8, 98], bass: [0, 0, 7, 0, 3, 0, 5, 7, 0, 0, 7, 10, 3, 5, 7, 10] },
    drive:  { roots: [98, 98, 116.5, 87.3], bass: [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 10, 0, 7, 5, 3, 0] },
    cruise: { roots: [131, 110, 98, 110], bass: [0, 3, 0, 5, 0, 7, 5, 3, 0, 3, 0, 5, 7, 10, 7, 5] },
  };
  const PENTA = [1, 1.189, 1.335, 1.498, 1.782, 2];

  function scheduleStep(t, s) {
    const st = STATIONS[station];
    const prog = PROGS[st.mood];
    const bar = Math.floor(s / 16) % 4;
    const root = prog.roots[bar];
    const bassNote = prog.bass[s % 16];
    if (bassNote !== undefined) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = root * PENTA[bassNote % 6] * (bassNote >= 6 ? 0.5 : 1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.25);
    }
    if (s % 4 === 0) { // chord stab on the beat
      [1, 1.189, 1.498].forEach((iv) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = root * 2 * iv; o.detune.value = (Math.random() * 10) - 5;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(f); f.connect(g); g.connect(musicGain);
        o.start(t); o.stop(t + 0.32);
      });
    }
    if (s % 2 === 1) { // hat tick
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start(t); src.stop(t + 0.06);
    }
  }

  function musicTick() {
    if (!ctx) return;
    const st = STATIONS[station];
    const stepDur = 60 / st.bpm / 2; // eighth notes
    while (nextNoteTime < ctx.currentTime + 0.18) {
      scheduleStep(nextNoteTime, step);
      nextNoteTime += stepDur;
      step++;
    }
  }

  return {
    ensure,
    get running() { return !!ctx && ctx.state === 'running'; },
    setStation(i) {
      station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      step = 0; if (ctx) nextNoteTime = ctx.currentTime + 0.05;
      return STATIONS[station].name;
    },
    get stationName() { return STATIONS[station].name; },
    startMusic() {
      if (!ensure()) return;
      nextNoteTime = ctx.currentTime + 0.05; step = 0;
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = setInterval(musicTick, 60);
    },
    setEngine(speed01, driving) {
      if (!ctx) return;
      const f = 48 + speed01 * 130;
      engineOsc1.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(f * 0.5, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.09 : 0.02, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(driving ? speed01 * 0.05 : 0, ctx.currentTime, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed01 * 900, ctx.currentTime, 0.15);
    },
    setSiren(on, near) {
      if (!ctx) return;
      sirenOn = on;
      sirenGain.gain.setTargetAtTime(on ? 0.028 + near * 0.03 : 0, ctx.currentTime, 0.2);
    },
    sirenTick(dt) {
      if (!ctx || !sirenOn) return;
      sirenPhase += dt;
      const hi = Math.floor(sirenPhase * 1.6) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(hi ? 950 : 700, ctx.currentTime, 0.05);
    },
    shot() { noiseBurst(0.12, 2400, 0.5, 'highpass'); blip(160, 0.08, 'square', 0.25); },
    enemyShot() { noiseBurst(0.1, 1800, 0.2, 'highpass'); },
    explosion() { noiseBurst(0.9, 320, 0.9); blip(55, 0.7, 'sine', 0.7); },
    crash() { noiseBurst(0.25, 500, 0.55); },
    cash() { blip(880, 0.09, 'sine', 0.3); blip(1318, 0.16, 'sine', 0.3, 0.08); },
    pickup() { blip(660, 0.08, 'sine', 0.25); blip(990, 0.12, 'sine', 0.25, 0.07); },
    horn() { blip(370, 0.22, 'square', 0.18); blip(466, 0.22, 'square', 0.14); },
    denied() { blip(180, 0.15, 'square', 0.2); },
    mission() { [523, 659, 784].forEach((f, i) => blip(f, 0.18, 'sine', 0.3, i * 0.09)); },
    // Analyser peak (0..255) across the spectrum — the driver reads this.
    peak() {
      if (!analyser) return 0;
      const arr = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(arr);
      let m = 0; for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
      return m;
    },
    avg() {
      if (!analyser) return 0;
      const arr = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(arr);
      let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i];
      return s / arr.length;
    },
  };
}
