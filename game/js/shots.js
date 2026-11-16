// Deterministic screenshot scenes for MORVANE.
// Every house game renders its shots from ?shot=<scene>&seed=<n>: a seeded
// generator, a fixed simulated time, no wall clock. This module does the
// same, so the four screenshots are real renders of the game's own code and
// replay exactly: title, mid-fight play, the wave-5 boss, and victory.
// main.js signals window.__shotReady once the scene has rendered.

import { state, resetRun } from './state.js';
import { seedRng } from './rng.js';
import { startWave } from './waves.js';
import { updateWorld, setupAttract } from './update.js';
import { botStep } from './bot.js';
import { burst } from './entities.js';

const STEP = 1 / 60;

// Run the world forward with the bot at the controls. If the keeper falls
// mid-scene the shot must still show the fight, so revive them in place.
function stepWithBot() {
  botStep();
  updateWorld(STEP);
  if (state.mode === 'gameover') {
    state.player.alive = true;
    state.player.hull = state.player.maxHull;
    state.player.invuln = 2;
    state.mode = 'playing';
  }
}

function sim(seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    stepWithBot();
    if (state.mode === 'victory') break;
  }
}

/** Read ?shot= from the URL and build that scene. True when one was built. */
export function setupShot() {
  const params = new URLSearchParams(window.location.search);
  const scene = params.get('shot');
  if (!scene) return false;
  const seed = parseInt(params.get('seed') || '7', 10) || 7;
  state.shotMode = true;
  seedRng(seed);

  if (scene === 'title') {
    setupAttract();
    sim(9);
  } else if (scene === 'play') {
    resetRun();
    startWave(6);
    sim(12);
  } else if (scene === 'boss') {
    resetRun();
    startWave(5);
    let waited = 0;
    while (!state.boss && waited < 3600) {
      stepWithBot();
      waited++;
    }
    sim(4);
  } else if (scene === 'victory') {
    resetRun();
    state.score = 42850;
    state.wave = 15;
    state.kills = 412;
    state.shotsFired = 3200;
    state.shotsHit = 2412;
    state.comboBest = 42;
    state.playTime = 742;
    state.best = 42850;
    state.shards = 187;
    state.mode = 'victory';
    burst(640, 300, '#ffe08a', 60, 260, 4);
    burst(640, 300, '#8affd1', 40, 200, 3);
  } else if (scene === 'end') {
    resetRun();
    state.score = 12480;
    state.wave = 7;
    state.kills = 156;
    state.shotsFired = 1400;
    state.shotsHit = 980;
    state.comboBest = 18;
    state.playTime = 316;
    state.best = 42850;
    state.shards = 43;
    state.player.alive = false;
    state.mode = 'gameover';
    burst(640, 360, '#9fd8ff', 50, 320, 4);
  } else {
    return false;
  }
  return true;
}
