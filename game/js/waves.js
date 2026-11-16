// The fifteen waves of MORVANE.
// Each wave is a queue of shades fed through portals at the arena edge.
// Waves 5, 10 and 15 end in a named boss; the fifteenth boss is the run's
// win condition. The mix grows from drifting motes to every kind at once,
// with elites joining from wave 4.

import { state, ARENA_W, ARENA_H } from './state.js';
import { spawnPortal, spawnBoss } from './entities.js';
import { rollShop } from './shop.js';
import { randRange, randInt, chance } from './rng.js';
import { sfxWaveClear } from './audio.js';

export const WAVE_COUNT = 15;

const EDGE = 46;

function edgePoint() {
  const side = randInt(0, 3);
  if (side === 0) return { x: randRange(EDGE, ARENA_W - EDGE), y: EDGE };
  if (side === 1) return { x: randRange(EDGE, ARENA_W - EDGE), y: ARENA_H - EDGE };
  if (side === 2) return { x: EDGE, y: randRange(EDGE, ARENA_H - EDGE) };
  return { x: ARENA_W - EDGE, y: randRange(EDGE, ARENA_H - EDGE) };
}

// Build the spawn queue for wave n: [{ type, elite, delay }].
export function buildWave(n) {
  const queue = [];
  let t = 0.6;
  const push = (type, count, gap, eliteChance) => {
    for (let i = 0; i < count; i++) {
      queue.push({ type, elite: chance(eliteChance || 0), delay: t });
      t += gap;
    }
  };
  const elites = n >= 4 ? 0.08 + n * 0.008 : 0;

  if (n === 1) {
    push('mote', 8, 0.9, 0);
  } else if (n === 2) {
    push('mote', 10, 0.7, 0);
    push('weaver', 4, 0.8, 0);
  } else if (n === 3) {
    push('mote', 8, 0.6, 0);
    push('weaver', 6, 0.6, 0);
    push('spitter', 3, 1.0, 0);
  } else if (n === 4) {
    push('mote', 10, 0.55, elites);
    push('weaver', 6, 0.55, elites);
    push('splitter', 4, 0.8, elites);
    push('spitter', 3, 0.9, 0);
  } else if (n === 5) {
    push('mote', 6, 0.6, elites);
    push('weaver', 4, 0.6, elites);
    queue.push({ type: 'boss-riftmother', elite: false, delay: t + 1.5 });
  } else if (n === 6) {
    push('weaver', 8, 0.5, elites);
    push('splitter', 6, 0.6, elites);
    push('spitter', 4, 0.8, elites);
    push('brute', 2, 1.2, 0);
  } else if (n === 7) {
    push('mote', 12, 0.45, elites);
    push('weaver', 8, 0.5, elites);
    push('brute', 3, 1.0, elites);
    push('spitter', 4, 0.7, elites);
  } else if (n === 8) {
    push('splitter', 8, 0.5, elites);
    push('spitter', 6, 0.6, elites);
    push('brute', 3, 0.9, elites);
    push('weaver', 8, 0.45, elites);
  } else if (n === 9) {
    push('mote', 14, 0.4, elites);
    push('weaver', 10, 0.45, elites);
    push('splitter', 6, 0.5, elites);
    push('brute', 4, 0.9, elites);
    push('spitter', 4, 0.7, elites);
  } else if (n === 10) {
    push('weaver', 6, 0.5, elites);
    push('splitter', 4, 0.6, elites);
    queue.push({ type: 'boss-choir', elite: false, delay: t + 1.5 });
  } else if (n === 11) {
    push('mote', 12, 0.4, elites);
    push('weaver', 10, 0.4, elites);
    push('spitter', 6, 0.6, elites);
    push('brute', 4, 0.8, elites);
    push('splitter', 6, 0.5, elites);
  } else if (n === 12) {
    push('weaver', 12, 0.4, elites);
    push('splitter', 8, 0.45, elites);
    push('brute', 5, 0.8, elites);
    push('spitter', 6, 0.55, elites);
  } else if (n === 13) {
    push('mote', 16, 0.35, elites);
    push('weaver', 12, 0.4, elites);
    push('splitter', 8, 0.45, elites);
    push('brute', 5, 0.75, elites);
    push('spitter', 6, 0.55, elites);
  } else if (n === 14) {
    push('weaver', 14, 0.35, elites);
    push('splitter', 10, 0.4, elites);
    push('brute', 6, 0.7, elites);
    push('spitter', 8, 0.5, elites);
    push('mote', 10, 0.35, elites);
  } else {
    push('mote', 10, 0.4, elites);
    push('weaver', 8, 0.4, elites);
    push('splitter', 6, 0.45, elites);
    push('brute', 4, 0.7, elites);
    queue.push({ type: 'boss-maw', elite: false, delay: t + 1.5 });
  }
  return queue;
}

/** Open wave n: banner, queue, and the first portals. */
export function startWave(n) {
  state.wave = n;
  state.waveState = 'spawning';
  state.spawnQueue = buildWave(n);
  state.spawnTimer = 0;
  state.waveBanner = n === 5 || n === 10 || n === 15 ? 'WAVE ' + n : 'WAVE ' + n + ' / ' + WAVE_COUNT;
  state.waveBannerTimer = 2.0;
}

/** Feed the queue through portals; notice when the wave is cleared. */
export function updateWaves(dt) {
  if (state.waveState === 'spawning' || state.waveState === 'fighting') {
    state.spawnTimer += dt;
    while (state.spawnQueue.length > 0 && state.spawnQueue[0].delay <= state.spawnTimer) {
      const s = state.spawnQueue.shift();
      if (s.type === 'boss-riftmother') spawnBoss('riftmother');
      else if (s.type === 'boss-choir') spawnBoss('choir');
      else if (s.type === 'boss-maw') spawnBoss('maw');
      else {
        const p = edgePoint();
        spawnPortal(p.x, p.y, s.type, s.elite);
      }
    }
    if (state.spawnQueue.length === 0 && state.waveState === 'spawning') {
      state.waveState = 'fighting';
    }
    // Cleared: nothing left to spawn, no portals open, no shades alive.
    if (
      state.waveState === 'fighting' &&
      state.spawnQueue.length === 0 &&
      state.portals.length === 0 &&
      state.enemies.length === 0 &&
      state.mode === 'playing'
    ) {
      waveCleared();
    }
  }
}

function waveCleared() {
  state.waveState = 'clear';
  const bonus = 250 + state.wave * 150;
  state.score += bonus;
  sfxWaveClear();
  // The fifteenth wave ends when the Umbral Maw dies, which wins the run
  // directly; a clear here always means an intermission shop.
  state.mode = 'shop';
  rollShop();
}
