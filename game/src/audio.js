// Every sound in the game is synthesized with WebAudio: oscillators, filtered
// noise and scheduled notes. No audio files, no network. The context starts on
// the first user gesture; until then every call is a safe no-op.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;
  let musicTimer = null;
  let musicStep = 0;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
    } catch {
      return false;
    }
    return true;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function burst({ duration, frequency, type, gainValue, slideTo }) {
    if (!ensure()) return;
    resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noiseHit({ duration, gainValue, filterFreq, type }) {
    if (!ensure()) return;
    resume();
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  // A laid-back coastal loop: soft bass notes under a sparse plucked line.
  const BASS = [110.0, 110.0, 130.81, 98.0, 110.0, 146.83, 130.81, 98.0];
  const PLUCK = [440.0, 0, 523.25, 0, 659.25, 0, 523.25, 587.33, 440.0, 0, 392.0, 0, 523.25, 659.25, 0, 0];
  function scheduleMusicStep() {
    if (!ctx) return;
    const stepDuration = 0.24;
    const now = ctx.currentTime + 0.05;
    const bass = BASS[musicStep % BASS.length];
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = bass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 2);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(now);
    osc.stop(now + stepDuration * 2);
    const note = PLUCK[musicStep % PLUCK.length];
    if (note) {
      const pluck = ctx.createOscillator();
      pluck.type = 'sine';
      pluck.frequency.value = note;
      const pluckGain = ctx.createGain();
      pluckGain.gain.setValueAtTime(0.35, now);
      pluckGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 3);
      pluck.connect(pluckGain);
      pluckGain.connect(musicGain);
      pluck.start(now);
      pluck.stop(now + stepDuration * 3);
    }
    musicStep += 1;
  }

  return {
    // Call from a click or key handler: browsers only allow audio after one.
    unlock() {
      if (ensure()) {
        resume();
        if (!started) {
          started = true;
          this.startMusic();
        }
      }
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(scheduleMusicStep, 240);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    setEngineRunning(running, speed01) {
      if (!ensure()) return;
      resume();
      if (running && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (!running && engineOsc) {
        try { engineOsc.stop(); } catch { /* already stopped */ }
        engineOsc = null;
        engineGain = null;
        return;
      }
      if (engineOsc) {
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.09, ctx.currentTime, 0.08);
      }
    },
    setSiren(on) {
      if (on === sirenOn) return;
      sirenOn = on;
      if (!ensure()) return;
      resume();
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 1.4;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 260;
        lfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 780;
        lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        try { sirenOsc._lfo.stop(); sirenOsc.stop(); } catch { /* stopped */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    shot(big) {
      noiseHit({ duration: big ? 0.22 : 0.14, gainValue: big ? 0.5 : 0.34, filterFreq: big ? 900 : 1600, type: 'lowpass' });
      burst({ duration: 0.06, frequency: 220, type: 'square', gainValue: 0.12, slideTo: 60 });
    },
    punch() {
      noiseHit({ duration: 0.1, gainValue: 0.4, filterFreq: 500 });
    },
    crash(strength) {
      noiseHit({ duration: 0.3, gainValue: Math.min(0.6, 0.2 + strength * 0.4), filterFreq: 700 });
      burst({ duration: 0.18, frequency: 120, type: 'sawtooth', gainValue: 0.2, slideTo: 40 });
    },
    pickup() {
      burst({ duration: 0.12, frequency: 660, type: 'sine', gainValue: 0.25, slideTo: 990 });
      setTimeout(() => burst({ duration: 0.16, frequency: 990, type: 'sine', gainValue: 0.22, slideTo: 1320 }), 90);
    },
    cash() {
      burst({ duration: 0.1, frequency: 880, type: 'triangle', gainValue: 0.25 });
      setTimeout(() => burst({ duration: 0.14, frequency: 1174, type: 'triangle', gainValue: 0.25 }), 80);
    },
    horn() {
      burst({ duration: 0.35, frequency: 340, type: 'square', gainValue: 0.14 });
      burst({ duration: 0.35, frequency: 428, type: 'square', gainValue: 0.12 });
    },
    skid() {
      noiseHit({ duration: 0.25, gainValue: 0.12, filterFreq: 3200, type: 'bandpass' });
    },
    explosion() {
      noiseHit({ duration: 0.9, gainValue: 0.7, filterFreq: 300 });
      burst({ duration: 0.7, frequency: 90, type: 'sawtooth', gainValue: 0.4, slideTo: 30 });
    },
    click() {
      burst({ duration: 0.05, frequency: 700, type: 'sine', gainValue: 0.18 });
    },
    missionPass() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        setTimeout(() => burst({ duration: 0.22, frequency: freq, type: 'triangle', gainValue: 0.25 }), i * 110);
      });
    },
    missionFail() {
      [392, 330, 262].forEach((freq, i) => {
        setTimeout(() => burst({ duration: 0.3, frequency: freq, type: 'triangle', gainValue: 0.22 }), i * 150);
      });
    },
  };
}
