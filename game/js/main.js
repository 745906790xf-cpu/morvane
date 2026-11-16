// MORVANE: boot, the fixed-step loop, and the menu wiring.
// The world runs on a fixed 1/60 s step, so play, replays and screenshots
// behave the same on any machine. The canvas is a fixed 1280x720; CSS scales
// it to the window. Audio starts only on a user gesture.

import { state, loadBest, resetRun } from './state.js';
import { seedRng } from './rng.js';
import { initInput, input } from './input.js';
import { initAudio, setMuted, isMuted } from './audio.js';
import { render } from './render.js';
import { updateWorld, setupAttract } from './update.js';
import { startWave } from './waves.js';
import { buyOffer, shopLayout, shopContinue } from './shop.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

initInput(canvas);
loadBest();
seedRng((Date.now() % 2147483647) | 1);

// A ?shot= URL builds a deterministic scene instead of the title.
const shotMode = setupShot();
if (!shotMode) {
  setupAttract();
}

// --- the loop: fixed 1/60 s steps, render every animation frame -----------
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
let readySignalled = false;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) {
    updateWorld(STEP);
    acc -= STEP;
    n++;
  }
  if (n === 5) acc = 0;
  render(ctx);
  // Screenshot scenes signal readiness once a frame has been drawn.
  if (state.shotMode && !readySignalled) {
    readySignalled = true;
    window.__shotReady = true;
  }
}
requestAnimationFrame(frame);

// --- menu wiring ------------------------------------------------------------

function startRun() {
  resetRun();
  startWave(1);
}

function continueToNextWave() {
  shopContinue();
  state.mode = 'playing';
  startWave(state.wave + 1);
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 1280,
    y: ((e.clientY - rect.top) / rect.height) * 720,
  };
}

function handleShopClick(e) {
  const p = canvasPos(e);
  const layout = shopLayout();
  for (let i = 0; i < 3; i++) {
    const c = layout.cards[i];
    if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
      buyOffer(i);
      return;
    }
  }
  const b = layout.continueBtn;
  if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
    continueToNextWave();
  }
}

window.addEventListener('keydown', (e) => {
  initAudio();
  if (e.code === 'KeyM') {
    setMuted(!isMuted());
    return;
  }
  if (state.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
    startRun();
  } else if (state.mode === 'playing' && (e.code === 'KeyP' || e.code === 'Escape')) {
    state.mode = 'paused';
  } else if (state.mode === 'paused' && (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter')) {
    state.mode = 'playing';
  } else if (state.mode === 'shop' && e.code === 'Enter') {
    continueToNextWave();
  } else if ((state.mode === 'gameover' || state.mode === 'victory') && e.code === 'KeyR') {
    startRun();
  } else if (state.mode === 'shop' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
    buyOffer(parseInt(e.code.slice(5), 10) - 1);
  }
});

canvas.addEventListener('mousedown', () => {
  initAudio();
  if (state.mode === 'title') startRun();
  else if (state.mode === 'paused') state.mode = 'playing';
  else if (state.mode === 'gameover' || state.mode === 'victory') startRun();
});

canvas.addEventListener('click', (e) => {
  if (state.mode === 'shop') handleShopClick(e);
});
