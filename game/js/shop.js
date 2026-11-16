// The intermission shop of MORVANE.
// After every cleared wave the keeper spends the shards the shades dropped
// on lantern upgrades. Three cards are offered; any number may be bought
// while the shards last, then the next wave begins. Every upgrade stacks
// to a small cap, so no single choice dominates a run.

import { state } from './state.js';
import { shuffle } from './rng.js';
import { sfxBuy, sfxClick } from './audio.js';

export const UPGRADES = [
  {
    id: 'twin', name: 'Twin Lantern', max: 2, base: 60, step: 35,
    desc: 'Fire one more bolt with every shot.',
    apply(p) { p.projectiles += 1; },
  },
  {
    id: 'rapid', name: 'Rapid Wick', max: 3, base: 50, step: 25,
    desc: '+25% fire rate. The lantern burns faster.',
    apply(p) { p.fireRate *= 1.25; },
  },
  {
    id: 'pierce', name: 'Piercing Beam', max: 2, base: 70, step: 35,
    desc: 'Bolts pass through one more shade.',
    apply(p) { p.pierce += 1; },
  },
  {
    id: 'wisps', name: 'Orbiting Wisps', max: 3, base: 60, step: 25,
    desc: 'A blade of light circles the ship, cutting shades it touches.',
    apply(p) { p.wispCount += 1; },
  },
  {
    id: 'dashnova', name: 'Dash Nova', max: 2, base: 55, step: 30,
    desc: 'Dashing scorches every shade nearby.',
    apply() { /* the dash code reads state.upgrades.dashnova */ },
  },
  {
    id: 'magnet', name: 'Shard Magnet', max: 2, base: 40, step: 25,
    desc: '+70% shard pickup radius.',
    apply(p) { p.magnet *= 1.7; },
  },
  {
    id: 'plating', name: 'Hull Plating', max: 3, base: 50, step: 25,
    desc: '+30 max hull, and repair 30 hull at once.',
    apply(p) { p.maxHull += 30; p.hull = Math.min(p.maxHull, p.hull + 30); },
  },
  {
    id: 'greed', name: 'Shard Greed', max: 2, base: 45, step: 25,
    desc: 'Every shard is worth +1 more.',
    apply(p) { p.shardValue += 1; },
  },
  {
    id: 'keel', name: 'Swift Keel', max: 2, base: 40, step: 25,
    desc: '+15% movement speed.',
    apply(p) { p.speed *= 1.15; },
  },
  {
    id: 'nova', name: 'Nova Pulse', max: 2, base: 80, step: 35,
    desc: 'A burst of light erupts from the ship every few seconds.',
    apply(p) { p.novaTimer = Math.min(p.novaTimer, 1.5); },
  },
];

export function upgradeLevel(id) {
  return state.upgrades[id] || 0;
}

export function upgradeCost(upg) {
  return upg.base + upg.step * upgradeLevel(upg.id);
}

/** Roll three distinct offers the keeper has not maxed out. */
export function rollShop() {
  const available = UPGRADES.filter((u) => upgradeLevel(u.id) < u.max);
  shuffle(available);
  state.shopOffers = available.slice(0, 3).map((upg) => ({
    upg,
    level: upgradeLevel(upg.id) + 1,
    cost: upgradeCost(upg),
    bought: false,
  }));
}

/** Buy offer i. Returns true when the purchase went through. */
export function buyOffer(i) {
  const offer = state.shopOffers[i];
  if (!offer || offer.bought) return false;
  if (state.shards < offer.cost) return false;
  if (upgradeLevel(offer.upg.id) >= offer.upg.max) return false;
  state.shards -= offer.cost;
  state.upgrades[offer.upg.id] = upgradeLevel(offer.upg.id) + 1;
  offer.upg.apply(state.player);
  offer.bought = true;
  sfxBuy();
  return true;
}

export function canAfford(i) {
  const offer = state.shopOffers[i];
  return !!offer && !offer.bought && state.shards >= offer.cost;
}

/** Layout of the shop screen in canvas pixels. One source of truth for
 *  both drawing (render.js) and click hit-testing (main.js). */
export function shopLayout() {
  const cardW = 300;
  const cardH = 330;
  const gap = 36;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (1280 - totalW) / 2;
  const y0 = 168;
  const cards = [0, 1, 2].map((i) => ({
    x: x0 + i * (cardW + gap),
    y: y0,
    w: cardW,
    h: cardH,
  }));
  return {
    cards,
    continueBtn: { x: 1280 / 2 - 170, y: 556, w: 340, h: 56 },
    cardW, cardH,
  };
}

export function shopContinue() {
  sfxClick();
}
