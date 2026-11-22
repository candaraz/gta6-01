// audioRadio.js — 100% synthesized Web Audio soundscape: engine RPM hum, tire
// screech, police sirens, distinct gunshots, explosions, UI clicks, and three
// original synth radio stations (R to switch): Mirador Synthwave FM, Tropico Bass,
// MKPD Scanner. No audio files, no network.
export const STATIONS = [
  { name: 'MIRADOR SYNTHWAVE FM', bpm: 96, root: 55, scale: [0, 3, 5, 7, 10], wave: 'sawtooth' },
  { name: 'TROPICO BASS', bpm: 112, root: 41.2, scale: [0, 3, 5, 8, 10], wave: 'triangle' },
  { name: 'MKPD SCANNER', bpm: 0, root: 0, scale: [], wave: 'sine' },
];

export class AudioRadio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.station = 0;
    this.musicTimer = null;
    this.step = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.started = false;
  }

  init() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.master);
      // engine hum loop
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.started = true;
      this.startStation(0);
    } catch (e) {
      this.started = false;
    }
  }

  setEngine(rpm, on) {
    if (!this.started) return;
    const target = on ? 0.05 + rpm * 0.12 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(45 + rpm * 130, this.ctx.currentTime, 0.05);
  }

  blip(freq, dur, type, gain, when = 0) {
    if (!this.started) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, gain, filterFreq = 1200) {
    if (!this.started) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  gunshot(weapon = 0) {
    if (!this.started) return;
    if (weapon === 2) { this.noiseBurst(0.22, 0.9, 700); this.blip(90, 0.15, 'square', 0.4); }
    else if (weapon === 4) { this.noiseBurst(0.4, 1.0, 500); this.blip(60, 0.3, 'sine', 0.7); }
    else { this.noiseBurst(0.09, 0.7, 2400); this.blip(180, 0.06, 'square', 0.25); }
  }

  explosion() {
    if (!this.started) return;
    this.noiseBurst(0.9, 1.0, 320);
    this.blip(48, 0.7, 'sine', 0.9);
  }

  siren(on) {
    if (!this.started) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null;
      this.sirenLfo = null;
    }
  }

  skid() { this.noiseBurst(0.3, 0.25, 900); }
  uiClick() { this.blip(880, 0.06, 'square', 0.15); }
  cash() { this.blip(1320, 0.08, 'sine', 0.25); this.blip(1760, 0.12, 'sine', 0.25, 0.08); }
  horn() { this.blip(370, 0.35, 'square', 0.2); this.blip(466, 0.35, 'square', 0.18); }

  nextStation() {
    this.startStation((this.station + 1) % STATIONS.length);
    return STATIONS[this.station].name;
  }

  startStation(index) {
    this.station = index;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (!this.started) return;
    const st = STATIONS[index];
    if (index === 2) {
      // MKPD Scanner: sparse radio chirps + static blips
      this.musicTimer = setInterval(() => {
        if (Math.random() < 0.6) this.blip(1200 + Math.random() * 600, 0.05, 'square', 0.06);
        if (Math.random() < 0.25) this.noiseBurst(0.15, 0.05, 3000);
      }, 900);
      return;
    }
    this.step = 0;
    const stepMs = 60000 / st.bpm / 2;
    this.musicTimer = setInterval(() => {
      const s = this.step++;
      const bar = Math.floor(s / 16) % 4;
      const root = st.root * [1, 1, 0.89, 1.12][bar];
      // bass line on the beat
      if (s % 4 === 0) {
        const note = root * Math.pow(2, st.scale[(s / 4) % st.scale.length] / 12);
        this.musicNote(note, stepMs * 3.2 / 1000, st.wave, 0.5);
      }
      // sparkle arp
      if (s % 2 === 1) {
        const arp = root * 4 * Math.pow(2, st.scale[(s * 3) % st.scale.length] / 12);
        this.musicNote(arp, stepMs * 1.2 / 1000, 'sine', 0.12);
      }
      // pad every bar
      if (s % 16 === 0) {
        this.musicNote(root * 2, stepMs * 14 / 1000, 'triangle', 0.10);
        this.musicNote(root * 2 * 1.5, stepMs * 14 / 1000, 'triangle', 0.08);
      }
    }, stepMs);
  }

  musicNote(freq, dur, type, gain) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
