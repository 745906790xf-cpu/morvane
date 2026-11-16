// The whole game state for MORVANE, in one place.
// Modes: 'title' | 'playing' | 'shop' | 'paused' | 'gameover' | 'victory'
// The title screen runs an attract mode: the arena simulates itself behind
// the menu, so the first screenshot can show a living game.

export const ARENA_W = 1280;
export const ARENA_H = 720;

export const state = {
  mode: 'title',
  time: 0, // seconds since boot, drives ambient animation
  playTime: 0, // seconds in the current run
  wave: 0,
  waveState: 'idle', // 'idle' | 'spawning' | 'fighting' | 'clear'
  spawnQueue: [], // { type, delay } entries waiting to enter
  spawnTimer: 0,
  score: 0,
  best: 0,
  shards: 0,
  combo: 0,
  comboTimer: 0,
  comboBest: 0,
  kills: 0,
  shotsFired: 0,
  shotsHit: 0,
  damageDealt: 0,
  player: null,
  enemies: [],
  bullets: [],
  enemyBullets: [],
  particles: [],
  pickups: [],
  texts: [],
  portals: [],
  boss: null,
  upgrades: {}, // upgrade id -> level taken
  shopOffers: [],
  shake: 0, // screen trauma, 0..1
  hitStop: 0, // seconds the world stays frozen
  flash: 0, // red hurt vignette, 0..1
  waveBanner: '',
  waveBannerTimer: 0,
  shotMode: false, // true when rendering a deterministic ?shot= scene
  attract: true, // title-screen demo play
};

const BEST_KEY = 'morvane-best-score-v1';

export function loadBest() {
  try {
    state.best = parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (e) {
    state.best = 0;
  }
}

export function saveBest() {
  if (state.score > state.best) state.best = state.score;
  try {
    window.localStorage.setItem(BEST_KEY, String(state.best));
  } catch (e) {
    // Storage may be unavailable (private mode, file:// in some browsers).
  }
}

/** A fresh player ship: the last lantern-keeper of Morvane. */
export function newPlayer() {
  return {
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    r: 16,
    hull: 100,
    maxHull: 100,
    speed: 265,
    fireRate: 7.5, // shots per second
    fireTimer: 0,
    damage: 14,
    projectiles: 1,
    pierce: 0,
    bulletSpeed: 640,
    dashCooldown: 0,
    dashTimer: 0,
    dashDirX: 0,
    dashDirY: -1,
    invuln: 0,
    magnet: 90,
    shardValue: 1,
    wispCount: 0,
    wispAngle: 0,
    novaTimer: 0,
    alive: true,
  };
}

/** Reset everything for a new run. */
export function resetRun() {
  state.mode = 'playing';
  state.playTime = 0;
  state.wave = 0;
  state.waveState = 'idle';
  state.spawnQueue = [];
  state.spawnTimer = 0;
  state.score = 0;
  state.shards = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.comboBest = 0;
  state.kills = 0;
  state.shotsFired = 0;
  state.shotsHit = 0;
  state.damageDealt = 0;
  state.player = newPlayer();
  state.enemies = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.particles = [];
  state.pickups = [];
  state.texts = [];
  state.portals = [];
  state.boss = null;
  state.upgrades = {};
  state.shopOffers = [];
  state.shake = 0;
  state.hitStop = 0;
  state.flash = 0;
  state.waveBanner = '';
  state.waveBannerTimer = 0;
  state.attract = false;
}

/** Score a kill: combo multiplies, and the combo clock refreshes. */
export function addKillScore(base) {
  const mult = 1 + Math.min(state.combo, 50) * 0.04;
  const gained = Math.round(base * mult);
  state.score += gained;
  state.combo += 1;
  state.comboTimer = 3.5;
  if (state.combo > state.comboBest) state.comboBest = state.combo;
  return gained;
}

export function addShards(n) {
  state.shards += n;
}

/** Hurt the player; returns true if the run ends. */
export function damagePlayer(amount) {
  const p = state.player;
  if (!p || !p.alive || p.invuln > 0 || p.dashTimer > 0) return false;
  p.hull -= amount;
  p.invuln = 0.6;
  state.flash = 1;
  state.shake = Math.min(1, state.shake + 0.45);
  state.combo = 0;
  state.comboTimer = 0;
  if (p.hull <= 0) {
    p.hull = 0;
    p.alive = false;
    return true;
  }
  return false;
}

export function healPlayer(amount) {
  const p = state.player;
  if (!p) return;
  p.hull = Math.min(p.maxHull, p.hull + amount);
}
