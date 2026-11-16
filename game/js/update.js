// One fixed step of the MORVANE world (dt is always 1/60 s).
// main.js calls this from its accumulator; shots.js calls it directly to
// fast-forward a deterministic scene. The world freezes during hit-stop,
// and the title screen runs an attract mode behind the menu.

import { state, newPlayer } from './state.js';
import { updatePlayer, updateEnemies, spawnEnemy, burst } from './entities.js';
import {
  updateBullets, updateParticles, updatePickups, updateTexts,
  updatePortals, updateCombo,
} from './systems.js';
import { updateWaves } from './waves.js';
import { endFrameInput } from './input.js';
import { updateMusic } from './audio.js';
import { botStep } from './bot.js';
import { randRange, randInt } from './rng.js';

let attractTimer = 0;

/** The arena behind the title: a keeper that cannot die, shades that keep
 *  coming, no score, no waves. Called when the title first shows. */
export function setupAttract() {
  state.mode = 'title';
  state.attract = true;
  state.player = newPlayer();
  state.enemies = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.particles = [];
  state.pickups = [];
  state.texts = [];
  state.portals = [];
  state.boss = null;
  state.wave = 1;
  attractTimer = 0;
  for (let i = 0; i < 5; i++) {
    spawnEnemy(i % 2 === 0 ? 'mote' : 'weaver', randRange(200, 1080), randRange(120, 600), false);
  }
}

export function updateWorld(dt) {
  state.time += dt;
  state.waveBannerTimer = Math.max(0, state.waveBannerTimer - dt);
  state.shake = Math.max(0, state.shake - dt * 1.8);
  state.flash = Math.max(0, state.flash - dt * 2.2);
  if (state.hitStop > 0) {
    state.hitStop -= dt;
    endFrameInput();
    return;
  }
  updateParticles(dt);
  updateTexts(dt);
  updateMusic(dt);

  if (state.mode === 'title') {
    // Attract mode: the bot plays, the keeper cannot fall.
    if (!state.player || !state.player.alive) {
      state.player = newPlayer();
      burst(640, 360, '#9fd8ff', 20, 200, 3);
    }
    attractTimer -= dt;
    if (attractTimer <= 0 && state.enemies.length < 9) {
      attractTimer = 2.2;
      const kinds = ['mote', 'weaver', 'splitter', 'spitter'];
      const kind = kinds[randInt(0, kinds.length - 1)];
      spawnEnemy(kind, randRange(120, 1160), randRange(80, 640), false);
    }
    botStep();
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updatePickups(dt);
    updatePortals(dt);
    endFrameInput();
    return;
  }

  if (state.mode === 'playing') {
    state.playTime += dt;
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updatePickups(dt);
    updatePortals(dt);
    updateWaves(dt);
    updateCombo(dt);
    endFrameInput();
    return;
  }

  // shop / paused / gameover / victory: only the ambient motion continues.
  endFrameInput();
}
