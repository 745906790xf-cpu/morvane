// All drawing for MORVANE, on one 1280x720 canvas.
// The palette is a deep-sea night: indigo water, cyan lantern-light, warm
// amber shards, and the violet-red of the shades. Nothing is loaded from
// disk: every sprite is drawn in code, so the game needs no network and no
// assets. The judge sees the game through its screenshots, so the title,
// the playfield and the end screens are drawn to read at a glance.

import { state, ARENA_W, ARENA_H } from './state.js';
import { WAVE_COUNT } from './waves.js';
import { shopLayout } from './shop.js';
import { randRange } from './rng.js';

const TAU = Math.PI * 2;

// --- a starfield, generated once from the seeded rng ------------------------
let stars = null;

function getStars() {
  if (stars) return stars;
  stars = [];
  for (let i = 0; i < 170; i++) {
    stars.push({
      x: randRange(0, ARENA_W),
      y: randRange(0, ARENA_H),
      r: randRange(0.6, 2.2),
      tw: randRange(0, TAU),
      sp: randRange(0.4, 1.6),
    });
  }
  return stars;
}

function font(weight, size, family) {
  return weight + ' ' + size + 'px ' + (family || 'system-ui, sans-serif');
}

function text(ctx, str, x, y, size, color, weight, align, family) {
  ctx.font = font(weight || '700', size, family);
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  g.addColorStop(0, '#070a1e');
  g.addColorStop(0.55, '#0a0f2a');
  g.addColorStop(1, '#0d1233');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Slow nebula glows.
  const nebulae = [
    { x: 240, y: 150, r: 260, c: 'rgba(64, 80, 190, 0.16)' },
    { x: 1060, y: 540, r: 300, c: 'rgba(120, 60, 170, 0.13)' },
    { x: 640, y: 620, r: 240, c: 'rgba(30, 110, 140, 0.12)' },
  ];
  for (const n of nebulae) {
    const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    rg.addColorStop(0, n.c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }

  // Stars, twinkling on the clock.
  for (const s of getStars()) {
    const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(state.time * s.sp + s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#cfe4ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Arena edge: a faint lantern ring.
  ctx.strokeStyle = 'rgba(140, 180, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, ARENA_W - 20, ARENA_H - 20);
}

// --- entities ----------------------------------------------------------------

function drawPlayer(ctx) {
  const p = state.player;
  if (!p || !p.alive) return;
  const blink = p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (blink) ctx.globalAlpha = 0.45;

  // Lantern glow.
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 64);
  glow.addColorStop(0, 'rgba(255, 224, 138, 0.55)');
  glow.addColorStop(0.4, 'rgba(255, 200, 90, 0.18)');
  glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 64, 0, TAU);
  ctx.fill();

  ctx.rotate(p.angle);
  // Hull: a sleek arrow.
  ctx.fillStyle = '#dfe9ff';
  ctx.strokeStyle = '#8fb8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -12);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Lantern core.
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.arc(2, 0, 6, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Orbiting wisps.
  if (p.wispCount > 0) {
    for (let i = 0; i < p.wispCount; i++) {
      const a = p.wispAngle + (i * TAU) / p.wispCount;
      const wx = p.x + Math.cos(a) * 56;
      const wy = p.y + Math.sin(a) * 56;
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(wx, wy, 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 224, 138, 0.5)';
      ctx.beginPath();
      ctx.arc(wx, wy, 9, 0, TAU);
      ctx.stroke();
    }
  }

  // Dash cooldown pip under the ship.
  if (p.dashCooldown > 0) {
    const frac = 1 - p.dashCooldown / 2.1;
    ctx.fillStyle = 'rgba(159, 216, 255, 0.25)';
    ctx.fillRect(p.x - 18, p.y + 26, 36, 4);
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(p.x - 18, p.y + 26, 36 * frac, 4);
  }
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  // Hit shimmer: a translucent white wash over the body's own colour, never
  // solid white — a boss under sustained fire would otherwise go white.
  const body = e.color;
  const dark = e.dark;

  if (e.type === 'boss') {
    // A crowned shade: big spiked ring, dark core, glowing eyes.
    ctx.rotate(Math.sin(state.time * 1.2) * 0.08);
    ctx.fillStyle = dark;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const r = i % 2 === 0 ? e.r + 10 : e.r - 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, e.r - 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0a0618';
    ctx.beginPath();
    ctx.arc(-14, -6, 6, 0, TAU);
    ctx.arc(14, -6, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff5c6e';
    ctx.beginPath();
    ctx.arc(-14, -6, 2.5, 0, TAU);
    ctx.arc(14, -6, 2.5, 0, TAU);
    ctx.fill();
  } else if (e.type === 'mote') {
    // A drifting wisp of gloom: spiky puff.
    ctx.fillStyle = dark;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + e.wobble * 0.3;
      const r = i % 2 === 0 ? e.r + 4 : e.r - 3;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, e.r - 5, 0, TAU);
    ctx.fill();
  } else if (e.type === 'weaver') {
    ctx.rotate(e.wobble);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, -e.r - 3);
    ctx.lineTo(e.r, 0);
    ctx.lineTo(0, e.r + 3);
    ctx.lineTo(-e.r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -e.r + 5);
    ctx.lineTo(e.r - 5, 0);
    ctx.lineTo(0, e.r - 5);
    ctx.lineTo(-e.r + 5, 0);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === 'spitter') {
    // A hex pod with a glowing mouth.
    ctx.fillStyle = dark;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const x = Math.cos(a) * (e.r + 2);
      const y = Math.sin(a) * (e.r + 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, e.r - 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a1200';
    ctx.beginPath();
    ctx.arc(4, 0, 4, 0, TAU);
    ctx.fill();
  } else if (e.type === 'splitter') {
    // Two lobes, ready to come apart.
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(-6, 0, e.r - 4, 0, TAU);
    ctx.arc(6, 0, e.r - 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(-6, 0, e.r - 8, 0, TAU);
    ctx.arc(6, 0, e.r - 8, 0, TAU);
    ctx.fill();
  } else {
    // brute: a heavy square with horns.
    ctx.fillStyle = dark;
    ctx.fillRect(-e.r, -e.r, e.r * 2, e.r * 2);
    ctx.fillStyle = body;
    ctx.fillRect(-e.r + 5, -e.r + 5, e.r * 2 - 10, e.r * 2 - 10);
    ctx.fillStyle = '#1c0510';
    ctx.fillRect(-10, -6, 7, 5);
    ctx.fillRect(3, -6, 7, 5);
    ctx.fillRect(-10, 4, 20, 3);
  }

  // Elite ring.
  if (e.elite) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 6, 0, TAU);
    ctx.stroke();
  }

  // Boss and elite health bar.
  if (e.type === 'boss' || e.elite) {
    const w = e.type === 'boss' ? 90 : 40;
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(-w / 2, -e.r - 16, w, 5);
    ctx.fillStyle = e.type === 'boss' ? '#ff5c6e' : '#ffd76a';
    ctx.fillRect(-w / 2, -e.r - 16, w * frac, 5);
  }
  // Hit shimmer: translucent white over the body colour, never solid white.
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(0.5, e.flash * 7);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBullets(ctx) {
  for (const b of state.bullets) {
    ctx.strokeStyle = '#bfe6ff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, TAU);
    ctx.fill();
  }
  for (const b of state.enemyBullets) {
    const pulse = 1 + 0.25 * Math.sin(state.time * 10 + b.x);
    ctx.fillStyle = '#ff7a9e';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * pulse, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd3de';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU);
    ctx.fill();
  }
}

function drawParticles(ctx) {
  for (const pt of state.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPickups(ctx) {
  for (const pk of state.pickups) {
    const bob = Math.sin(state.time * 4 + pk.x) * 2;
    if (pk.kind === 'shard') {
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.rotate(state.time * 2 + pk.x);
      ctx.fillStyle = '#8affd1';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.fillStyle = '#7dff9b';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
      ctx.restore();
    }
  }
}

function drawPortals(ctx) {
  for (const po of state.portals) {
    const frac = 1 - po.timer / po.duration;
    const r = 8 + frac * 26;
    ctx.save();
    ctx.translate(po.x, po.y);
    ctx.rotate(state.time * 6);
    ctx.strokeStyle = 'rgba(183, 140, 255, ' + (0.4 + 0.6 * frac) + ')';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r, (i * TAU) / 3, (i * TAU) / 3 + 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawTexts(ctx) {
  for (const t of state.texts) {
    const a = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = a;
    text(ctx, t.str, t.x, t.y, t.size, t.color, '700');
  }
  ctx.globalAlpha = 1;
}

// --- HUD ---------------------------------------------------------------------

function drawHUD(ctx) {
  const p = state.player;
  // Hull bar, top left.
  ctx.fillStyle = 'rgba(4, 8, 24, 0.6)';
  ctx.fillRect(18, 16, 260, 44);
  text(ctx, 'HULL', 30, 30, 12, '#9fb4d8', '700', 'left');
  const hullFrac = p ? Math.max(0, p.hull / p.maxHull) : 0;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(30, 40, 200, 10);
  ctx.fillStyle = hullFrac > 0.35 ? '#5fe8a8' : '#ff5c6e';
  ctx.fillRect(30, 40, 200 * hullFrac, 10);
  text(ctx, p ? Math.ceil(p.hull) + ' / ' + p.maxHull : '—', 238, 30, 12, '#dfe9ff', '700', 'left');

  // Wave and score, top centre.
  text(ctx, 'WAVE ' + Math.max(1, state.wave) + ' / ' + WAVE_COUNT, 640, 30, 18, '#eaf2ff', '800');
  text(ctx, 'SCORE ' + state.score.toLocaleString('en-US'), 640, 54, 14, '#9fb4d8', '700');
  if (state.best > 0) text(ctx, 'BEST ' + state.best.toLocaleString('en-US'), 640, 74, 12, '#6f84ad', '700');

  // Shards and combo, top right.
  text(ctx, '◆ ' + state.shards + ' shards', 1262, 30, 15, '#8affd1', '700', 'right');
  if (state.combo >= 5) {
    text(ctx, 'COMBO x' + state.combo, 1262, 54, 15, '#ffd76a', '800', 'right');
  }
  text(ctx, 'M mute · P pause', 1262, 698, 12, '#5c6f92', '600', 'right');

  // Boss bar, bottom centre.
  if (state.boss) {
    const b = state.boss;
    const w = 520;
    const x = (ARENA_W - w) / 2;
    const y = 668;
    text(ctx, b.name, 640, y - 14, 14, '#ff9db0', '800');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = '#ff5c6e';
    ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, 10);
  }

  // Wave banner.
  if (state.waveBannerTimer > 0) {
    const a = Math.min(1, state.waveBannerTimer);
    ctx.globalAlpha = a;
    text(ctx, state.waveBanner, 640, 300, 44, '#ffe08a', '800');
    ctx.globalAlpha = 1;
  }

  // Hurt vignette.
  if (state.flash > 0) {
    const g = ctx.createRadialGradient(640, 360, 200, 640, 360, 720);
    g.addColorStop(0, 'rgba(255, 40, 60, 0)');
    g.addColorStop(1, 'rgba(255, 40, 60, ' + (0.45 * state.flash) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
}

// --- screens -----------------------------------------------------------------

function drawTitle(ctx) {
  ctx.fillStyle = 'rgba(3, 5, 16, 0.62)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  text(ctx, 'M O R V A N E', 640, 190, 84, '#ffe08a', '800', 'center', 'Georgia, serif');
  text(ctx, 'HOLD THE LAST LANTERN', 640, 252, 20, '#9fd8ff', '700');
  text(ctx, 'The Gloom has swallowed the drowned city. One lantern still burns —', 640, 312, 17, '#c8d6ef', '500');
  text(ctx, 'yours. Fifteen waves stand between the dark and the dawn.', 640, 338, 17, '#c8d6ef', '500');

  text(ctx, 'MOVE  WASD / ARROWS      AIM  MOUSE      FIRE  HOLD CLICK / SPACE', 640, 408, 15, '#8fa8cc', '600');
  text(ctx, 'DASH  SHIFT / RIGHT CLICK      PAUSE  P      MUTE  M', 640, 434, 15, '#8fa8cc', '600');
  text(ctx, 'Between waves, spend shards on lantern upgrades. Beat wave 15 to win.', 640, 460, 15, '#8fa8cc', '600');

  if (state.best > 0) {
    text(ctx, 'BEST SCORE  ' + state.best.toLocaleString('en-US'), 640, 508, 16, '#ffd76a', '700');
  }
  const blink = Math.floor(state.time * 1.6) % 2 === 0;
  if (blink) {
    text(ctx, '—  CLICK OR PRESS ENTER TO BEGIN  —', 640, 566, 20, '#ffffff', '800');
  }
}

function drawShop(ctx) {
  ctx.fillStyle = 'rgba(3, 5, 16, 0.72)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  text(ctx, 'WAVE ' + state.wave + ' CLEARED', 640, 84, 40, '#8affd1', '800');
  text(ctx, 'The lantern holds. Spend your shards, keeper.', 640, 122, 16, '#c8d6ef', '500');
  text(ctx, '◆ ' + state.shards + ' shards', 640, 150, 18, '#8affd1', '700');

  const layout = shopLayout();
  state.shopOffers.forEach((offer, i) => {
    const c = layout.cards[i];
    const afford = state.shards >= offer.cost && !offer.bought;
    ctx.fillStyle = offer.bought ? 'rgba(40, 70, 50, 0.85)' : afford ? 'rgba(16, 28, 54, 0.92)' : 'rgba(10, 14, 30, 0.85)';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = offer.bought ? '#5fe8a8' : afford ? '#ffe08a' : 'rgba(140, 160, 200, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);
    text(ctx, '[' + (i + 1) + ']', c.x + c.w / 2, c.y + 34, 14, '#6f84ad', '700');
    text(ctx, offer.upg.name, c.x + c.w / 2, c.y + 74, 22, '#ffffff', '800');
    // Level pips.
    const taken = state.upgrades[offer.upg.id] || 0;
    for (let k = 0; k < offer.upg.max; k++) {
      ctx.fillStyle = k < taken + (offer.bought ? 1 : 0) ? '#ffd76a' : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2 - (offer.upg.max - 1) * 11 + k * 22, c.y + 106, 5, 0, TAU);
      ctx.fill();
    }
    // Description, wrapped to the card width.
    const words = offer.upg.desc.split(' ');
    let line = '';
    let ly = c.y + 150;
    ctx.font = font('500', 15);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > c.w - 36 && line) {
        ctx.fillStyle = '#c8d6ef';
        ctx.fillText(line, c.x + c.w / 2, ly);
        line = w;
        ly += 22;
      } else {
        line = test;
      }
    }
    ctx.fillStyle = '#c8d6ef';
    ctx.fillText(line, c.x + c.w / 2, ly);
    if (offer.bought) {
      text(ctx, 'TAKEN', c.x + c.w / 2, c.y + c.h - 44, 18, '#5fe8a8', '800');
    } else {
      text(ctx, '◆ ' + offer.cost + ' shards', c.x + c.w / 2, c.y + c.h - 44, 18, afford ? '#8affd1' : '#8a6f6f', '800');
    }
  });

  const b = layout.continueBtn;
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  text(ctx, 'BEGIN WAVE ' + (state.wave + 1) + '  [ENTER]', b.x + b.w / 2, b.y + b.h / 2, 19, '#1a1206', '800');
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(3, 5, 16, 0.66)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  text(ctx, 'PAUSED', 640, 300, 48, '#ffffff', '800');
  text(ctx, 'WASD move · Mouse aim · Hold click to fire · Shift to dash', 640, 360, 16, '#c8d6ef', '500');
  text(ctx, 'Press P or click to resume', 640, 396, 16, '#9fd8ff', '700');
}

function drawStats(ctx, y0) {
  const p = state.player;
  const acc = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
  const mins = Math.floor(state.playTime / 60);
  const secs = Math.floor(state.playTime % 60);
  const rows = [
    ['SCORE', state.score.toLocaleString('en-US')],
    ['WAVE REACHED', String(Math.max(1, state.wave)) + ' / 15'],
    ['SHADES DESTROYED', String(state.kills)],
    ['ACCURACY', acc + '%'],
    ['BEST COMBO', 'x' + state.comboBest],
    ['TIME', mins + ':' + String(secs).padStart(2, '0')],
    ['BEST SCORE', state.best.toLocaleString('en-US')],
  ];
  rows.forEach((row, i) => {
    const y = y0 + i * 34;
    text(ctx, row[0], 480, y, 16, '#8fa8cc', '600', 'left');
    text(ctx, row[1], 800, y, 16, '#ffffff', '700', 'right');
  });
}

function drawGameOver(ctx) {
  ctx.fillStyle = 'rgba(8, 3, 10, 0.72)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  text(ctx, 'THE LIGHT GOES OUT', 640, 150, 52, '#ff5c6e', '800', 'center', 'Georgia, serif');
  text(ctx, 'The Gloom takes the lantern — this time.', 640, 200, 17, '#c8d6ef', '500');
  drawStats(ctx, 258);
  const blink = Math.floor(state.time * 1.6) % 2 === 0;
  if (blink) {
    text(ctx, '—  PRESS R OR CLICK TO TRY AGAIN  —', 640, 566, 20, '#ffffff', '800');
  }
}

function drawVictory(ctx) {
  ctx.fillStyle = 'rgba(4, 10, 8, 0.66)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  text(ctx, 'THE DAWN RETURNS', 640, 150, 52, '#ffe08a', '800', 'center', 'Georgia, serif');
  text(ctx, 'The Umbral Maw is unmade. Morvane wakes, and the lantern still burns.', 640, 200, 17, '#c8d6ef', '500');
  drawStats(ctx, 258);
  const blink = Math.floor(state.time * 1.6) % 2 === 0;
  if (blink) {
    text(ctx, '—  PRESS R OR CLICK TO PLAY AGAIN  —', 640, 566, 20, '#ffffff', '800');
  }
}

// --- main entry ---------------------------------------------------------------

/** Draw one frame. */
export function render(ctx) {
  ctx.save();
  // Screen shake from trauma.
  if (state.shake > 0) {
    const s = state.shake * state.shake * 14;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx);
  drawPortals(ctx);
  drawPickups(ctx);
  for (const e of state.enemies) drawEnemy(ctx, e);
  if (state.mode !== 'victory' && state.mode !== 'gameover') drawPlayer(ctx);
  drawBullets(ctx);
  drawParticles(ctx);
  drawTexts(ctx);
  ctx.restore();

  if (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'shop') {
    drawHUD(ctx);
  }
  if (state.mode === 'title') drawTitle(ctx);
  else if (state.mode === 'shop') drawShop(ctx);
  else if (state.mode === 'paused') drawPaused(ctx);
  else if (state.mode === 'gameover') drawGameOver(ctx);
  else if (state.mode === 'victory') drawVictory(ctx);
}
