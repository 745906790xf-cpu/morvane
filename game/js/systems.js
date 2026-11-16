// The per-frame systems for MORVANE: bullets and their collisions, the
// particle and floating-text effects, shard and heart pickups, and the
// spawn portals that telegraph where a shade will appear.

import { state, ARENA_W, ARENA_H, addShards, healPlayer } from './state.js';
import { damageEnemy, spawnEnemy, burst, spawnText, clamp, endRun } from './entities.js';
import { sfxPickup, sfxHeal, sfxHurt } from './audio.js';

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// ---------------------------------------------------------------------------
// Bullets
// ---------------------------------------------------------------------------

export function updateBullets(dt) {
  const p = state.player;

  // Player bullets: fly, fade, and bite the first shade they meet.
  for (const b of [...state.bullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > ARENA_W + 20 || b.y < -20 || b.y > ARENA_H + 20;
    if (!dead) {
      for (const e of [...state.enemies]) {
        if (e.hp <= 0) continue;
        const rr = e.r + b.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          state.shotsHit += 1;
          const killed = damageEnemy(e, b.damage);
          burst(b.x, b.y, '#cfe9ff', killed ? 8 : 3, 120, 2);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
    }
    if (dead) {
      const i = state.bullets.indexOf(b);
      if (i >= 0) state.bullets.splice(i, 1);
    }
  }

  // Enemy orbs: drift and hurt the lantern-keeper on contact.
  for (const b of [...state.enemyBullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > ARENA_W + 20 || b.y < -20 || b.y > ARENA_H + 20;
    if (!dead && p && p.alive && p.invuln <= 0 && p.dashTimer <= 0) {
      const rr = p.r + b.r - 4;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        dead = true;
        const died = damagePlayer(b.damage);
        sfxHurt();
        if (died) endRun();
      }
    }
    if (dead) {
      const i = state.enemyBullets.indexOf(b);
      if (i >= 0) state.enemyBullets.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Particles, floating text
// ---------------------------------------------------------------------------

export function updateParticles(dt) {
  for (const pt of [...state.particles]) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.2 * dt;
    pt.vy *= 1 - 2.2 * dt;
    if (pt.life <= 0) {
      const i = state.particles.indexOf(pt);
      if (i >= 0) state.particles.splice(i, 1);
    }
  }
  if (state.particles.length > 600) state.particles.splice(0, state.particles.length - 600);
}

export function updateTexts(dt) {
  for (const t of [...state.texts]) {
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) {
      const i = state.texts.indexOf(t);
      if (i >= 0) state.texts.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Pickups: shards (score currency) and hearts (repair)
// ---------------------------------------------------------------------------

export function updatePickups(dt) {
  const p = state.player;
  for (const pk of [...state.pickups]) {
    pk.life -= dt;
    // Drift, then get pulled in when the keeper is near.
    let mx = 0;
    let my = 0;
    if (p && p.alive) {
      const d = Math.hypot(p.x - pk.x, p.y - pk.y) || 1;
      const magnetR = p.magnet;
      if (d < magnetR) {
        mx = ((p.x - pk.x) / d) * 520;
        my = ((p.y - pk.y) / d) * 520;
      }
    }
    pk.vx = pk.vx * (1 - 2 * dt) + mx * dt * 6;
    pk.vy = pk.vy * (1 - 2 * dt) + my * dt * 6;
    pk.x = clamp(pk.x + pk.vx * dt, 12, ARENA_W - 12);
    pk.y = clamp(pk.y + pk.vy * dt, 12, ARENA_H - 12);
    let taken = pk.life <= 0;
    if (!taken && p && p.alive) {
      const rr = p.r + 12;
      if (dist2(pk.x, pk.y, p.x, p.y) < rr * rr) {
        taken = true;
        if (pk.kind === 'shard') {
          addShards(pk.value);
          spawnText(pk.x, pk.y - 10, '+' + pk.value + ' shard' + (pk.value > 1 ? 's' : ''), '#8affd1', 13);
          sfxPickup();
        } else if (pk.kind === 'heart') {
          healPlayer(25);
          spawnText(pk.x, pk.y - 10, '+25 hull', '#7dff9b', 15);
          sfxHeal();
        }
      }
    }
    if (taken) {
      const i = state.pickups.indexOf(pk);
      if (i >= 0) state.pickups.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Portals: a rift opens, warns, then delivers its shade.
// ---------------------------------------------------------------------------

export function updatePortals(dt) {
  for (const po of [...state.portals]) {
    po.timer -= dt;
    if (po.timer <= 0) {
      spawnEnemy(po.type, po.x, po.y, po.elite);
      burst(po.x, po.y, '#b78cff', 10, 160, 3);
      const i = state.portals.indexOf(po);
      if (i >= 0) state.portals.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Combo: the multiplier fades if the keeper stops scoring.
// ---------------------------------------------------------------------------

export function updateCombo(dt) {
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }
}
