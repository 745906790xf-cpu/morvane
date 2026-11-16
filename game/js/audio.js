// Synthesized sound for MORVANE. No audio files: every effect is an
// oscillator or a burst of filtered noise, and the music is a quiet generative
// pad over a minor pentatonic line. The AudioContext is created lazily on
// the first user gesture (browsers block autoplay), and every call is a
// no-op until then, so headless screenshot runs stay silent.

let ctx = null;
let master = null;
let musicGain = null;
let musicTimer = 0;
let nextNoteAt = 0;
let muted = false;

// A-minor pentatonic, two octaves, as frequencies.
const SCALE = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392];

/** Create the audio graph. Safe to call repeatedly; only the first runs. */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.05;
    musicGain.connect(master);
    startDrone();
  } catch (e) {
    ctx = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function startDrone() {
  // Two detuned triangle waves, a fifth apart, through a slow filter.
  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.value = 55;
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = 82.41;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(g);
  g.connect(musicGain);
  osc1.start();
  osc2.start();
  // Slow breathing on the filter.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();
}

/** Advance the generative music line. Call once per frame with dt. */
export function updateMusic(dt) {
  if (!ctx || muted) return;
  musicTimer += dt;
  if (musicTimer < nextNoteAt) return;
  // A sparse pluck every 0.4-0.9 s, weighted toward the low end.
  nextNoteAt = musicTimer + 0.4 + Math.random() * 0.5;
  const idx = Math.floor(Math.pow(Math.random(), 1.6) * SCALE.length);
  pluck(SCALE[idx], 0.10, 1.6);
}

function pluck(freq, vol, dur) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t);
}

export function sfxShoot() { blip(720, 0.08, 'square', 0.10, 320); }
export function sfxHit() { blip(220, 0.05, 'square', 0.08, 140); }
export function sfxExplode() { noiseBurst(0.35, 0.28, 900); blip(120, 0.3, 'sine', 0.22, 40); }
export function sfxBigExplode() { noiseBurst(0.6, 0.35, 600); blip(90, 0.55, 'sine', 0.3, 30); }
export function sfxPickup() { blip(880, 0.09, 'sine', 0.12, 1320); }
export function sfxHeal() { blip(520, 0.25, 'sine', 0.12, 780); }
export function sfxDash() { noiseBurst(0.18, 0.16, 2400); }
export function sfxHurt() { blip(160, 0.25, 'sawtooth', 0.2, 60); noiseBurst(0.2, 0.15, 500); }
export function sfxWaveClear() { blip(523, 0.12, 'sine', 0.14); setTimeout(() => blip(659, 0.12, 'sine', 0.14), 110); setTimeout(() => blip(784, 0.2, 'sine', 0.16), 220); }
export function sfxBoss() { blip(70, 0.8, 'sawtooth', 0.25, 45); noiseBurst(0.7, 0.2, 300); }
export function sfxClick() { blip(600, 0.05, 'sine', 0.1, 800); }
export function sfxBuy() { blip(660, 0.1, 'sine', 0.14, 990); setTimeout(() => blip(990, 0.16, 'sine', 0.14), 90); }
export function sfxGameOver() { blip(330, 0.4, 'triangle', 0.18, 110); setTimeout(() => blip(220, 0.6, 'triangle', 0.18, 82), 350); }
export function sfxVictory() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sine', 0.16), i * 140));
}
