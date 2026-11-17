// Synthesized WebAudio only: no audio files, no network. Every sound is an
// oscillator or a short noise burst built here. The context is created lazily
// on the first user gesture; until then every call is a safe no-op, so the
// shot stager and the headless playtests never trip on sound.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let noiseBuffer = null;
  let muted = false;
  let musicStep = 0;
  let nextNoteTime = 0;

  // Am F C G, one bar each, bass roots with a pentatonic lead on top.
  const BASS = [55, 43.65, 65.41, 49];
  const LEAD = [220, 261.63, 329.63, 392, 440, 523.25, 392, 329.63];
  const STEP_SECONDS = 60 / 112 / 2;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      nextNoteTime = ctx.currentTime + 0.1;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function scheduleMusic() {
    if (!ctx) return;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const bar = Math.floor(musicStep / 8) % BASS.length;
      const stepInBar = musicStep % 8;
      if (stepInBar === 0 || stepInBar === 4) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = BASS[bar];
        gain.gain.setValueAtTime(0.5, nextNoteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + STEP_SECONDS * 3.5);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(nextNoteTime);
        osc.stop(nextNoteTime + STEP_SECONDS * 4);
      }
      if (stepInBar % 2 === 0) {
        const note = LEAD[(musicStep * 3 + bar) % LEAD.length];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = note;
        gain.gain.setValueAtTime(0.22, nextNoteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + STEP_SECONDS * 1.8);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(nextNoteTime);
        osc.stop(nextNoteTime + STEP_SECONDS * 2);
      }
      musicStep += 1;
      nextNoteTime += STEP_SECONDS;
    }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    click() {
      if (!ensure()) return;
      tone(660, 0.06, 'square', 0.12);
    },
    shoot() {
      if (!ensure()) return;
      noise(0.12, 0.5, 2400);
      tone(180, 0.1, 'square', 0.25, 0, 60);
    },
    punch() {
      if (!ensure()) return;
      noise(0.08, 0.35, 900);
    },
    horn() {
      if (!ensure()) return;
      tone(370, 0.18, 'square', 0.15);
      tone(466, 0.18, 'square', 0.12);
    },
    pickup() {
      if (!ensure()) return;
      tone(880, 0.09, 'sine', 0.2);
      tone(1318, 0.12, 'sine', 0.18, 0.08);
    },
    cash() {
      if (!ensure()) return;
      tone(1046, 0.08, 'sine', 0.2);
      tone(1318, 0.08, 'sine', 0.2, 0.07);
      tone(1568, 0.14, 'sine', 0.22, 0.14);
    },
    missionDone() {
      if (!ensure()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.18, 'triangle', 0.25, i * 0.11));
    },
    busted() {
      if (!ensure()) return;
      [392, 311.13, 233.08].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.2, i * 0.22));
    },
    wasted() {
      if (!ensure()) return;
      tone(110, 0.9, 'sawtooth', 0.25, 0, 55);
      noise(0.6, 0.2, 400);
    },
    setEngine(speed, inCar) {
      if (!ctx) return;
      const target = inCar ? 0.05 + Math.min(0.09, Math.abs(speed) / 520 * 0.09) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.28, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.15);
    },
    update(dt) {
      if (!ctx) return;
      scheduleMusic();
      if (sirenGain && sirenGain.gain.value > 0.01) {
        sirenTimer += dt;
        if (sirenTimer > 0.42) {
          sirenTimer = 0;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 720, ctx.currentTime, 0.02);
        }
      }
    },
  };
}
