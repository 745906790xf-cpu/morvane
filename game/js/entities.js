// Everything that moves in MORVANE: the player ship, bullets, the five shade
// kinds and the three bosses, particles, pickups and spawn portals.
// All movement runs on a fixed 1/60 s step from main.js, so the game plays
// the same on any machine and a screenshot scene replays exactly.

import { state, ARENA_W, ARENA_H, addKillScore, addShards, damagePlayer, healPlayer, saveBest } from './state.js';
import { rand, randRange, randInt, pick, chance } from './rng.js';
import { input, keyDown, anyKeyDown } from './input.js';
import {
  sfxShoot, sfxHit, sfxExplode, sfxBigExplode, sfxPickup, sfxHeal,
  sfxDash, sfxHurt, sfxBoss,
} from './audio.js';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// Particles, floating text, pickups, portals
// ---------------------------------------------------------------------------

export function spawnParticle(x, y, vx, vy, life, size, color) {
  state.particles.push({ x, y, vx, vy, life, maxLife: life, size, color });
}

export function burst(x, y, color, n, speed, size) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const s = randRange(speed * 0.3, speed);
    spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(0.3, 0.7), randRange(size * 0.5, size), color);
  }
}

export function spawnText(x, y, str, color, size) {
  state.texts.push({ x, y, str, color, life: 0.9, maxLife: 0.9, size: size || 16 });
}

export function spawnPickup(kind, x, y, value) {
  state.pickups.push({
    x, y,
    vx: randRange(-40, 40), vy: randRange(-40, 40),
    kind, value: value || 1, life: 14,
  });
}

export function spawnPortal(x, y, type, elite) {
  state.portals.push({ x, y, type, elite: !!elite, timer: 0.8, duration: 0.8 });
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export function updatePlayer(dt) {
  const p = state.player;
  if (!p || !p.alive) return;

  // --- movement (WASD / arrows), acceleration with damping ---
  let mx = 0;
  let my = 0;
  if (anyKeyDown(['KeyA', 'ArrowLeft'])) mx -= 1;
  if (anyKeyDown(['KeyD', 'ArrowRight'])) mx += 1;
  if (anyKeyDown(['KeyW', 'ArrowUp'])) my -= 1;
  if (anyKeyDown(['KeyS', 'ArrowDown'])) my += 1;
  const len = Math.hypot(mx, my) || 1;
  mx /= len;
  my /= len;

  const accel = p.dashTimer > 0 ? 0 : 2400;
  p.vx += mx * accel * dt;
  p.vy += my * accel * dt;
  // drag
  const drag = p.dashTimer > 0 ? 0.2 : 6.5;
  p.vx -= p.vx * Math.min(1, drag * dt);
  p.vy -= p.vy * Math.min(1, drag * dt);
  const spd = Math.hypot(p.vx, p.vy);
  const maxSpd = p.dashTimer > 0 ? 900 : p.speed;
  if (spd > maxSpd) {
    p.vx = (p.vx / spd) * maxSpd;
    p.vy = (p.vy / spd) * maxSpd;
  }
  p.x = clamp(p.x + p.vx * dt, 24, ARENA_W - 24);
  p.y = clamp(p.y + p.vy * dt, 24, ARENA_H - 24);

  // --- aim: mouse when seen, else the direction of travel ---
  if (input.mouseSeen) {
    p.angle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
  } else if (spd > 30) {
    p.angle = Math.atan2(p.vy, p.vx);
  }

  // --- dash (Shift or right mouse): a burst with invulnerability ---
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.dashTimer = Math.max(0, p.dashTimer - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  const wantDash = input.pressed.has('Dash') || keyDown('ShiftLeft') || keyDown('ShiftRight');
  if (wantDash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
    let dx = mx;
    let dy = my;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    }
    p.dashDirX = dx;
    p.dashDirY = dy;
    p.dashTimer = 0.16;
    p.dashCooldown = 2.1;
    p.invuln = Math.max(p.invuln, 0.22);
    p.vx = dx * 900;
    p.vy = dy * 900;
    sfxDash();
    burst(p.x, p.y, '#9fd8ff', 10, 220, 3);
    if (state.upgrades.dashnova) {
      // A dash with the Dash Nova upgrade scorches everything it passes.
      for (const e of state.enemies) {
        if (dist2(p.x, p.y, e.x, e.y) < 120 * 120) damageEnemy(e, 30 + 20 * state.upgrades.dashnova);
      }
    }
  }
  if (p.dashTimer > 0) {
    p.vx = p.dashDirX * 900;
    p.vy = p.dashDirY * 900;
    spawnParticle(p.x, p.y, randRange(-20, 20), randRange(-20, 20), 0.3, 4, '#bfe9ff');
  }

  // --- fire: hold mouse or Space; the lantern answers at once ---
  p.fireTimer -= dt;
  const firing = input.mouseDown || keyDown('Space');
  if (firing && p.fireTimer <= 0) {
    p.fireTimer = 1 / p.fireRate;
    firePlayerBullets();
  }

  // --- orbiting wisps (upgrade): blades that circle the ship ---
  if (p.wispCount > 0) {
    p.wispAngle += dt * 3.2;
    for (let i = 0; i < p.wispCount; i++) {
      const a = p.wispAngle + (i * Math.PI * 2) / p.wispCount;
      const wx = p.x + Math.cos(a) * 56;
      const wy = p.y + Math.sin(a) * 56;
      for (const e of state.enemies) {
        if (e.wispCd > 0) continue;
        if (dist2(wx, wy, e.x, e.y) < (e.r + 14) * (e.r + 14)) {
          e.wispCd = 0.45;
          damageEnemy(e, 12 + 6 * (state.upgrades.wisps || 1));
          burst(wx, wy, '#ffe08a', 4, 120, 2.5);
        }
      }
    }
  }

  // --- nova pulse (upgrade): a radial burst on a timer ---
  if (state.upgrades.nova) {
    p.novaTimer -= dt;
    if (p.novaTimer <= 0) {
      p.novaTimer = 4.5;
      const R = 150 + 30 * state.upgrades.nova;
      for (const e of [...state.enemies]) {
        if (dist2(p.x, p.y, e.x, e.y) < R * R) damageEnemy(e, 25 + 15 * state.upgrades.nova);
      }
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        spawnParticle(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, Math.cos(a) * 320, Math.sin(a) * 320, 0.45, 3, '#ffd76a');
      }
      sfxExplode();
    }
  }

  // --- engine trail ---
  if (spd > 60 && chance(0.5)) {
    spawnParticle(p.x - Math.cos(p.angle) * 14, p.y - Math.sin(p.angle) * 14,
      randRange(-30, 30), randRange(-30, 30), 0.35, randRange(2, 4), '#5fb8ff');
  }
}

function firePlayerBullets() {
  const p = state.player;
  const n = p.projectiles;
  const spread = 0.11;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * spread;
    const a = p.angle + off;
    state.bullets.push({
      x: p.x + Math.cos(a) * 22,
      y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * p.bulletSpeed,
      vy: Math.sin(a) * p.bulletSpeed,
      r: 5,
      damage: p.damage,
      pierce: p.pierce,
      life: 1.1,
    });
  }
  state.shotsFired += n;
  sfxShoot();
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export const ENEMY_TYPES = {
  mote: { r: 13, hp: 22, speed: 96, damage: 10, score: 50, color: '#b78cff', dark: '#7a4fd0' },
  weaver: { r: 12, hp: 30, speed: 168, damage: 12, score: 80, color: '#5fe8c8', dark: '#2a9d87' },
  spitter: { r: 15, hp: 42, speed: 72, damage: 10, score: 120, color: '#ff9a5c', dark: '#c85a1e' },
  splitter: { r: 16, hp: 36, speed: 86, damage: 12, score: 100, color: '#9be15d', dark: '#5da32e' },
  brute: { r: 24, hp: 150, speed: 56, damage: 22, score: 200, color: '#ff5c6e', dark: '#b81f31' },
};

export function spawnEnemy(type, x, y, elite) {
  const base = ENEMY_TYPES[type];
  if (!base) return null;
  const waveScale = 1 + 0.13 * (state.wave - 1);
  const e = {
    type,
    x, y,
    vx: 0, vy: 0,
    r: base.r * (elite ? 1.25 : 1),
    hp: base.hp * waveScale * (elite ? 3.2 : 1),
    maxHp: base.hp * waveScale * (elite ? 3.2 : 1),
    speed: base.speed * (1 + 0.02 * (state.wave - 1)) * (elite ? 1.1 : 1),
    damage: base.damage,
    score: base.score * (elite ? 3 : 1),
    color: base.color,
    dark: base.dark,
    elite: !!elite,
    angle: rand() * Math.PI * 2,
    wobble: rand() * Math.PI * 2,
    fireTimer: randRange(1.2, 2.4),
    chargeTimer: randRange(2.5, 4),
    charging: 0,
    chargeDirX: 0,
    chargeDirY: 0,
    wispCd: 0,
    touchCd: 0,
    flash: 0,
  };
  state.enemies.push(e);
  return e;
}

/** A boss: a named shade with patterns of its own. */
export function spawnBoss(kind) {
  const defs = {
    riftmother: { r: 46, hp: 1500, speed: 42, damage: 26, score: 1500, color: '#c77dff', dark: '#7b2fbe', name: 'RIFTMOTHER' },
    choir: { r: 40, hp: 2400, speed: 96, damage: 24, score: 2500, color: '#5ce1e6', dark: '#1e8fa3', name: 'THE DROWNED CHOIR' },
    maw: { r: 54, hp: 3600, speed: 60, damage: 30, score: 5000, color: '#ff5470', dark: '#8f1024', name: 'UMBRAL MAW' },
  };
  const d = defs[kind];
  const e = {
    type: 'boss',
    bossKind: kind,
    name: d.name,
    x: ARENA_W / 2,
    y: 130,
    vx: 0, vy: 0,
    r: d.r,
    hp: d.hp,
    maxHp: d.hp,
    speed: d.speed,
    damage: d.damage,
    score: d.score,
    color: d.color,
    dark: d.dark,
    elite: false,
    angle: 0,
    wobble: 0,
    fireTimer: 2,
    chargeTimer: 4,
    charging: 0,
    chargeDirX: 0,
    chargeDirY: 0,
    summonTimer: 6,
    spiralAngle: 0,
    enraged: false,
    wispCd: 0,
    touchCd: 0,
    flash: 0,
  };
  state.enemies.push(e);
  state.boss = e;
  state.waveBanner = d.name;
  state.waveBannerTimer = 2.4;
  sfxBoss();
  return e;
}

export function damageEnemy(e, amount) {
  if (e.hp <= 0) return false;
  e.hp -= amount;
  e.flash = 0.12;
  state.damageDealt += amount;
  if (e.hp <= 0) {
    killEnemy(e);
    return true;
  }
  return false;
}

function killEnemy(e) {
  const idx = state.enemies.indexOf(e);
  if (idx >= 0) state.enemies.splice(idx, 1);
  state.kills += 1;
  const gained = addKillScore(e.score);
  spawnText(e.x, e.y - e.r - 6, '+' + gained, '#ffe08a', e.type === 'boss' ? 22 : 15);
  burst(e.x, e.y, e.color, e.type === 'boss' ? 60 : 16, e.type === 'boss' ? 320 : 200, e.type === 'boss' ? 5 : 3.5);
  burst(e.x, e.y, '#ffffff', 6, 140, 2);
  state.shake = Math.min(1, state.shake + (e.type === 'boss' ? 0.9 : e.elite ? 0.3 : 0.12));
  if (e.type === 'boss') {
    state.hitStop = 0.28;
    sfxBigExplode();
    for (let i = 0; i < 8; i++) spawnPickup('shard', e.x + randRange(-50, 50), e.y + randRange(-50, 50), 5);
    spawnPickup('heart', e.x, e.y, 1);
    state.boss = null;
    if (e.bossKind === 'maw') {
      winRun();
    }
  } else {
    state.hitStop = Math.max(state.hitStop, e.elite ? 0.06 : 0.02);
    if (e.elite) sfxExplode(); else sfxHit();
    // Shard drops: bigger shades pay more.
    const shards = e.type === 'brute' ? 3 : e.elite ? 4 : chance(0.65) ? 1 : 0;
    for (let i = 0; i < shards; i++) {
      spawnPickup('shard', e.x + randRange(-14, 14), e.y + randRange(-14, 14), state.player ? state.player.shardValue : 1);
    }
    if (chance(0.04)) spawnPickup('heart', e.x, e.y, 1);
    if (e.type === 'splitter') {
      // A splitter bursts into two motes.
      spawnEnemy('mote', e.x - 14, e.y, false);
      spawnEnemy('mote', e.x + 14, e.y, false);
    }
  }
}

function winRun() {
  state.mode = 'victory';
  saveBest();
}

export function updateEnemies(dt) {
  const p = state.player;
  for (const e of [...state.enemies]) {
    e.flash = Math.max(0, e.flash - dt);
    e.wispCd = Math.max(0, e.wispCd - dt);
    e.touchCd = Math.max(0, e.touchCd - dt);
    if (!p || !p.alive) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;

    if (e.type === 'boss') {
      updateBoss(e, dt, nx, ny, d);
    } else if (e.type === 'mote') {
      e.wobble += dt * 2;
      const wob = Math.sin(e.wobble) * 0.5;
      e.vx = (nx * Math.cos(wob) - ny * Math.sin(wob)) * e.speed;
      e.vy = (nx * Math.sin(wob) + ny * Math.cos(wob)) * e.speed;
    } else if (e.type === 'weaver') {
      e.wobble += dt * 5;
      const wob = Math.sin(e.wobble) * 0.9;
      e.vx = (nx * Math.cos(wob) - ny * Math.sin(wob)) * e.speed;
      e.vy = (nx * Math.sin(wob) + ny * Math.cos(wob)) * e.speed;
    } else if (e.type === 'spitter') {
      // Holds about 280 px away and lobs orbs.
      const want = 280;
      const radial = d < want - 40 ? -1 : d > want + 60 ? 1 : 0;
      e.vx = nx * e.speed * radial;
      e.vy = ny * e.speed * radial;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && d < 560) {
        e.fireTimer = randRange(2.0, 2.6);
        state.enemyBullets.push({
          x: e.x, y: e.y,
          vx: nx * 190, vy: ny * 190,
          r: 7, damage: e.damage, life: 5,
        });
        burst(e.x, e.y, e.color, 4, 90, 2.5);
      }
    } else if (e.type === 'splitter' || e.type === 'brute') {
      if (e.type === 'brute') {
        // Telegraph, then charge.
        e.chargeTimer -= dt;
        if (e.charging > 0) {
          e.charging -= dt;
          e.vx = e.chargeDirX * 340;
          e.vy = e.chargeDirY * 340;
        } else if (e.chargeTimer <= 0 && d < 420) {
          e.chargeTimer = randRange(3.5, 5);
          e.charging = 0.55;
          e.chargeDirX = nx;
          e.chargeDirY = ny;
          spawnText(e.x, e.y - e.r - 10, '!', '#ff5c6e', 20);
        } else {
          e.vx = nx * e.speed;
          e.vy = ny * e.speed;
        }
      } else {
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = clamp(e.x, 16, ARENA_W - 16);
    e.y = clamp(e.y, 16, ARENA_H - 16);

    // Touch damage.
    if (p.alive && e.touchCd <= 0 && dist2(e.x, e.y, p.x, p.y) < (e.r + p.r - 4) * (e.r + p.r - 4)) {
      e.touchCd = 0.8;
      const died = damagePlayer(e.damage);
      sfxHurt();
      if (died) {
        endRun();
        return;
      }
    }
  }
}

function updateBoss(e, dt, nx, ny, d) {
  const p = state.player;
  if (e.bossKind === 'maw' && !e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true;
    e.speed *= 1.5;
    state.waveBanner = 'THE MAW IS ENRAGED';
    state.waveBannerTimer = 2;
    sfxBoss();
  }
  const speedMul = e.enraged ? 1.4 : 1;

  if (e.bossKind === 'riftmother') {
    // Slow chase, radial bursts, spawns motes.
    e.vx = nx * e.speed * speedMul;
    e.vy = ny * e.speed * speedMul;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      e.fireTimer = e.enraged ? 2.2 : 3.0;
      fireRadial(e, 12, 170);
    }
    e.summonTimer -= dt;
    if (e.summonTimer <= 0) {
      e.summonTimer = 6;
      for (let i = 0; i < 3; i++) spawnPortal(e.x + randRange(-90, 90), e.y + randRange(-90, 90), 'mote', false);
    }
  } else if (e.bossKind === 'choir') {
    // Charges across the arena, then spirals shots.
    e.chargeTimer -= dt;
    if (e.charging > 0) {
      e.charging -= dt;
      e.vx = e.chargeDirX * 420;
      e.vy = e.chargeDirY * 420;
    } else if (e.chargeTimer <= 0) {
      e.chargeTimer = randRange(3.2, 4.2);
      e.charging = 0.6;
      e.chargeDirX = nx;
      e.chargeDirY = ny;
      spawnText(e.x, e.y - e.r - 10, '!', '#5ce1e6', 22);
    } else {
      e.vx = nx * e.speed * speedMul;
      e.vy = ny * e.speed * speedMul;
    }
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      e.fireTimer = 0.14;
      e.spiralAngle += 0.55;
      state.enemyBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(e.spiralAngle) * 150, vy: Math.sin(e.spiralAngle) * 150,
        r: 6, damage: 12, life: 6,
      });
      state.enemyBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(e.spiralAngle + Math.PI) * 150, vy: Math.sin(e.spiralAngle + Math.PI) * 150,
        r: 6, damage: 12, life: 6,
      });
    }
    e.summonTimer -= dt;
    if (e.summonTimer <= 0) {
      e.summonTimer = 8;
      spawnPortal(e.x + randRange(-120, 120), e.y + randRange(-120, 120), 'spitter', false);
      spawnPortal(e.x + randRange(-120, 120), e.y + randRange(-120, 120), 'spitter', false);
    }
  } else {
    // maw: radial bursts plus aimed fans, faster when enraged.
    e.vx = nx * e.speed * speedMul;
    e.vy = ny * e.speed * speedMul;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      e.fireTimer = e.enraged ? 1.7 : 2.4;
      fireRadial(e, 16, 185);
      for (let i = -1; i <= 1; i++) {
        const a = Math.atan2(ny, nx) + i * 0.22;
        state.enemyBullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
          r: 7, damage: 14, life: 5,
        });
      }
    }
    e.summonTimer -= dt;
    if (e.summonTimer <= 0) {
      e.summonTimer = 7;
      spawnPortal(e.x + randRange(-140, 140), e.y + randRange(-140, 140), pick(['weaver', 'mote', 'splitter']), false);
      spawnPortal(e.x + randRange(-140, 140), e.y + randRange(-140, 140), 'mote', true);
    }
  }
}

function fireRadial(e, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + e.wobble;
    state.enemyBullets.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      r: 7, damage: 14, life: 6,
    });
  }
  burst(e.x, e.y, e.color, 10, 200, 3);
}

export function endRun() {
  state.mode = 'gameover';
  saveBest();
  burst(state.player.x, state.player.y, '#9fd8ff', 50, 320, 4);
  burst(state.player.x, state.player.y, '#ffffff', 20, 200, 3);
}
