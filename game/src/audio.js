// audio.js — all sound is synthesised with WebAudio: no audio files.
// Three generative radio stations (a lookahead step sequencer), an engine
// hum that follows speed, a two-tone siren, and one-shot effects for
// gunshots, collisions and explosions. An AnalyserNode taps the master
// bus so `level()` measures real output.
import { STATIONS } from './config.js';

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.analyser = null;
    this.station = 0;
    this.radioOn = true;
    this.volume = 0.7;
    this.muted = false;
    this._step = 0;
    this._nextTime = 0;
    this._timer = null;
    this._engineOsc = null;
    this._engineGain = null;
    this._engineNoise = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenHigh = false;
    this._sirenTimer = null;
  }

  // Must be called from a user gesture (Start button / first key).
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this._startEngineHum();
    this._startRadio();
  }

  running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // 0..255-ish average of the analyser's frequency bins.
  level() {
    if (!this.analyser) return 0;
    const bins = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(bins);
    let sum = 0;
    for (let i = 0; i < bins.length; i++) sum += bins[i];
    return sum / bins.length;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  setStation(i) {
    this.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    this._step = 0;
    return STATIONS[this.station].name;
  }

  nextStation() {
    return this.setStation(this.station + 1);
  }

  toggleRadio() {
    this.radioOn = !this.radioOn;
    if (this.musicBus) this.musicBus.gain.value = this.radioOn ? 0.5 : 0;
    return this.radioOn;
  }

  // ---- music: a 16-step sequencer, one bar per chord ----
  _startRadio() {
    this._nextTime = this.ctx.currentTime + 0.1;
    this._timer = setInterval(() => this._schedule(), 40);
  }

  _schedule() {
    if (!this.ctx || !this.radioOn) return;
    const st = STATIONS[this.station];
    const stepDur = 60 / st.bpm / 4;
    while (this._nextTime < this.ctx.currentTime + 0.18) {
      this._playStep(st, this._step, this._nextTime, stepDur);
      this._nextTime += stepDur;
      this._step = (this._step + 1) % 64;
    }
  }

  _playStep(st, step, t, stepDur) {
    const bar = Math.floor(step / 16) % 4;
    const roots = st.mood === 'chill' ? [0, -4, -2, 5] : st.mood === 'drive' ? [0, 0, -2, 3] : [0, 3, -4, -2];
    const scale = st.mood === 'night' ? MINOR : MAJOR;
    const rootMidi = st.root + roots[bar];
    const inBar = step % 16;
    // Bass on beats 0, 4, 8, 12 (and an off-beat for drive).
    if (inBar % 4 === 0 || (st.mood === 'drive' && inBar === 14)) {
      this._tone(this._midi(rootMidi - 12), t, stepDur * 1.8, 'sine', 0.30, this.musicBus);
    }
    // Chords on the off-beats.
    if (inBar % 8 === 4) {
      for (const iv of [0, 2, 4]) {
        this._tone(this._midi(rootMidi + scale[iv]), t, stepDur * 5, 'triangle', 0.07, this.musicBus);
      }
    }
    // Hats on every other 8th, kick on the beat for drive.
    if (inBar % 2 === 0) this._hat(t, 0.05);
    if (st.mood === 'drive' && inBar % 4 === 0) this._kick(t);
    // A little lead sparkle on chill stations.
    if (st.mood === 'chill' && inBar === 6) {
      this._tone(this._midi(rootMidi + 24 + scale[4]), t, stepDur * 3, 'sine', 0.08, this.musicBus);
    }
  }

  _midi(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  _tone(freq, t, dur, type, vol, bus) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _hat(t, vol) {
    const len = 0.04;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.musicBus);
    src.start(t);
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + 0.2);
  }

  // ---- engine hum ----
  _startEngineHum() {
    this._engineOsc = this.ctx.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 50;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 400;
    this._engineGain = this.ctx.createGain();
    this._engineGain.gain.value = 0.0;
    this._engineOsc.connect(f); f.connect(this._engineGain); this._engineGain.connect(this.sfxBus);
    this._engineOsc.start();
  }

  setEngine(speed01, on) {
    if (!this.ctx || !this._engineOsc) return;
    const t = this.ctx.currentTime;
    this._engineOsc.frequency.setTargetAtTime(48 + speed01 * 160, t, 0.08);
    this._engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0.0, t, 0.1);
  }

  // ---- one-shot effects ----
  _noiseBurst(t, dur, filterType, freq, vol, bus) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
    src.start(t);
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, 0.09, 'highpass', 900, 0.5);
    this._tone(180, t, 0.06, 'square', 0.18, this.sfxBus);
  }

  shotgunBlast() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, 0.22, 'lowpass', 1200, 0.7);
    this._tone(90, t, 0.14, 'square', 0.25, this.sfxBus);
  }

  collision(hard) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, hard ? 0.18 : 0.08, 'lowpass', 300, hard ? 0.6 : 0.25);
    this._tone(70, t, 0.12, 'sine', hard ? 0.4 : 0.15, this.sfxBus);
  }

  explosion() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, 0.7, 'lowpass', 500, 0.9);
    this._tone(55, t, 0.6, 'sine', 0.6, this.sfxBus);
    this._tone(38, t + 0.05, 0.7, 'sine', 0.5, this.sfxBus);
  }

  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._tone(660, t, 0.09, 'sine', 0.2, this.sfxBus);
    this._tone(990, t + 0.08, 0.14, 'sine', 0.2, this.sfxBus);
  }

  coin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._tone(1320, t, 0.07, 'triangle', 0.18, this.sfxBus);
    this._tone(1760, t + 0.06, 0.12, 'triangle', 0.18, this.sfxBus);
  }

  missionDone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, t + i * 0.1, 0.22, 'triangle', 0.22, this.sfxBus));
  }

  fail() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 330, 262].forEach((f, i) => this._tone(f, t + i * 0.14, 0.25, 'sawtooth', 0.12, this.sfxBus));
  }

  // ---- siren ----
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this._sirenOsc) {
      this._sirenOsc = this.ctx.createOscillator();
      this._sirenOsc.type = 'square';
      this._sirenOsc.frequency.value = 700;
      this._sirenGain = this.ctx.createGain();
      this._sirenGain.gain.value = 0.035;
      this._sirenOsc.connect(this._sirenGain); this._sirenGain.connect(this.sfxBus);
      this._sirenOsc.start();
      this._sirenTimer = setInterval(() => {
        if (!this._sirenOsc) return;
        this._sirenHigh = !this._sirenHigh;
        this._sirenOsc.frequency.setTargetAtTime(this._sirenHigh ? 950 : 700, this.ctx.currentTime, 0.05);
      }, 380);
    } else if (!on && this._sirenOsc) {
      clearInterval(this._sirenTimer);
      this._sirenTimer = null;
      const o = this._sirenOsc, g = this._sirenGain;
      this._sirenOsc = null; this._sirenGain = null;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      setTimeout(() => { try { o.stop(); } catch (_) {} }, 300);
    }
  }
}
