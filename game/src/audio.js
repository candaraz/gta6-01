// Solmar Bay — sound, all synthesised.
// One job: every sound the game makes, built live with Web Audio — no audio
// files. Three radio stations (chord stabs + bassline + hats on a scheduler),
// engine hum tied to speed, two-tone police sirens, gunshots, collisions,
// UI clicks and mission stings. The context resumes on the first user gesture.

import { RADIO } from './config.js';

const CHORDS = {
  minor: [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [7, 10, 14, 17]],
  dorian: [[0, 3, 7, 10], [2, 5, 9, 12], [5, 8, 12, 15], [7, 10, 14, 17]],
  major: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [5, 9, 12, 14]],
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.station = 0;
    this.musicOn = true;
    this.muted = false;
    this.volume = { master: 0.8, music: 0.55, sfx: 0.9 };
    this._step = 0;
    this._nextTime = 0;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._timer = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume.master;
    // output tap: master -> analyser -> destination, so the output level is
    // measurable (and the game can prove its music is actually audible)
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.volume.music;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.volume.sfx;
    this.sfxGain.connect(this.master);
    // engine hum (sawtooth through a lowpass, pitch follows speed)
    this._engineOsc = this.ctx.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 50;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    this._engineGain = this.ctx.createGain();
    this._engineGain.gain.value = 0;
    this._engineOsc.connect(lp); lp.connect(this._engineGain); this._engineGain.connect(this.master);
    this._engineOsc.start();
    // police siren (two-tone)
    this._sirenOsc = this.ctx.createOscillator();
    this._sirenOsc.type = 'triangle';
    this._sirenOsc.frequency.value = 700;
    this._sirenGain = this.ctx.createGain();
    this._sirenGain.gain.value = 0;
    this._sirenOsc.connect(this._sirenGain); this._sirenGain.connect(this.master);
    this._sirenOsc.start();
    this._nextTime = this.ctx.currentTime + 0.1;
    this._timer = setInterval(() => this._schedule(), 90);
    return true;
  }

  get running() { return !!this.ctx && this.ctx.state === 'running'; }
  get stationName() { return RADIO[this.station].name; }
  // Current output level (0-255) from the analyser tap — 0 means silence.
  level() {
    if (!this.analyser) return { peak: 0, avg: 0 };
    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buf);
    return { peak: Math.max(...buf), avg: +(buf.reduce((a, b) => a + b, 0) / buf.length).toFixed(1) };
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume.master;
  }
  setVolumes(v) {
    this.volume = { ...this.volume, ...v };
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume.master;
    if (this.musicGain) this.musicGain.gain.value = this.volume.music;
    if (this.sfxGain) this.sfxGain.gain.value = this.volume.sfx;
  }
  nextStation() { this.station = (this.station + 1) % RADIO.length; this._step = 0; }

  // --- music scheduler: one 16th-note step per tick ---
  _schedule() {
    if (!this.ctx || !this.musicOn || this.muted) return;
    const st = RADIO[this.station];
    const stepDur = 60 / st.bpm / 4;
    while (this._nextTime < this.ctx.currentTime + 0.25) {
      this._playStep(st, this._step, this._nextTime, stepDur);
      this._step = (this._step + 1) % 64;
      this._nextTime += stepDur;
    }
  }
  _note(freq, time, dur, type, gain, dest) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(dest ?? this.musicGain);
    o.start(time); o.stop(time + dur + 0.05);
  }
  _hat(time, gain) {
    const len = 0.05;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(time);
  }
  _playStep(st, step, time, stepDur) {
    const chords = CHORDS[st.mode];
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const chord = chords[bar % chords.length];
    const root = 110 * Math.pow(2, (st.root - 45) / 12);
    // bass on beats
    if (s16 % 4 === 0) {
      const n = chord[(s16 / 4) % chord.length];
      this._note(root * Math.pow(2, n / 12) / 2, time, stepDur * 3.5, st.bass, 0.32);
    }
    // chord stab off-beat
    if (s16 === 2 || s16 === 7 || s16 === 10 || s16 === 14) {
      for (const n of chord.slice(0, 3)) this._note(root * Math.pow(2, n / 12), time, stepDur * 1.8, 'triangle', 0.07);
    }
    // hats
    if (s16 % 2 === 0) this._hat(time, s16 % 4 === 2 ? 0.1 : 0.05);
    // sparkle arp on the chill station
    if (st.id === 'golden' && s16 % 4 === 1) {
      this._note(root * 2 * Math.pow(2, chord[s16 / 4 | 0] / 12), time, stepDur * 2, 'sine', 0.06);
    }
  }

  // --- vehicle + police ---
  engine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, t, 0.1);
    this._engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, t, 0.08);
  }
  siren(on, dist01) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._sirenGain.gain.setTargetAtTime(on ? 0.05 * (1 - dist01) : 0, t, 0.2);
    if (on) this._sirenOsc.frequency.setTargetAtTime(650 + 250 * Math.sin(t * 2.4), t, 0.05);
  }

  // --- one-shots ---
  _noise(dur, filterFreq, gain, type = 'lowpass') {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start();
  }
  gunshot() { this._noise(0.14, 900, 0.5); this._note(90, this.ctx.currentTime, 0.08, 'sine', 0.35, this.sfxGain); }
  collision(hard) { this._noise(hard ? 0.3 : 0.15, hard ? 500 : 900, hard ? 0.6 : 0.3); }
  explosion() { this._noise(0.9, 300, 0.9); this._note(45, this.ctx.currentTime, 0.7, 'sine', 0.6, this.sfxGain); }
  click() { if (this.ctx) this._note(660, this.ctx.currentTime, 0.06, 'square', 0.12, this.sfxGain); }
  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._note(523, t, 0.1, 'sine', 0.2, this.sfxGain);
    this._note(784, t + 0.09, 0.14, 'sine', 0.2, this.sfxGain);
  }
  missionDone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this._note(f, t + i * 0.11, 0.22, 'triangle', 0.22, this.sfxGain));
  }
  wanted() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._note(220, t, 0.16, 'square', 0.16, this.sfxGain);
    this._note(175, t + 0.16, 0.22, 'square', 0.16, this.sfxGain);
  }
  failed() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 330, 262].forEach((f, i) => this._note(f, t + i * 0.18, 0.25, 'sawtooth', 0.14, this.sfxGain));
  }
}
