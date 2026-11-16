// The demo pilot for MORVANE.
// The title screen plays the game behind the menu, and the deterministic
// screenshot scenes need a player too. The bot drives the game through the
// same input a human uses — movement keys, mouse aim, fire, dash — so what
// it does is always something the game itself can do.

import { input } from './input.js';
import { state } from './state.js';

/** One bot decision. Call before the world's fixed step. */
export function botStep() {
  const p = state.player;
  if (!p || !p.alive) return;

  // Nearest shade.
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }

  // Orbit the arena centre on a ~270 px ring, fleeing anything too close.
  // The ring sits low enough that the keeper never hides under the HUD
  // strip at the top or hangs half off the bottom edge.
  const cx = 640;
  const cy = 390;
  const ox = p.x - cx;
  const oy = p.y - cy;
  const od = Math.hypot(ox, oy) || 1;
  let mx = -oy / od;
  let my = ox / od;
  const radial = (270 - od) / 270;
  mx += (ox / od) * radial * 0.8;
  my += (oy / od) * radial * 0.8;
  if (best && bestD < 120 * 120) {
    const bd = Math.sqrt(bestD) || 1;
    mx += ((p.x - best.x) / bd) * 1.4;
    my += ((p.y - best.y) / bd) * 1.4;
  }
  if (p.y < 110) my += 1.2;
  if (p.y > 650) my -= 1.2;
  const len = Math.hypot(mx, my) || 1;
  mx /= len;
  my /= len;

  input.keys.clear();
  if (mx < -0.3) input.keys.add('KeyA');
  if (mx > 0.3) input.keys.add('KeyD');
  if (my < -0.3) input.keys.add('KeyW');
  if (my > 0.3) input.keys.add('KeyS');

  if (best) {
    input.mouseX = best.x;
    input.mouseY = best.y;
    input.mouseSeen = true;
    input.mouseDown = true;
  } else {
    input.mouseDown = false;
  }

  if (best && bestD < 70 * 70 && p.dashCooldown <= 0) {
    input.pressed.add('Dash');
  }
}

/** Let go of everything the bot held. */
export function botIdle() {
  input.keys.clear();
  input.mouseDown = false;
  input.pressed.clear();
}
