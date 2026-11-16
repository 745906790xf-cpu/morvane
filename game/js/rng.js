// Seeded random numbers for MORVANE.
// Every random draw in the game goes through this one module, so a screenshot
// scene can be replayed exactly from its seed: seed it from the URL in shot
// mode, from the clock in normal play. mulberry32 is small, fast and good
// enough for a game; nothing here is used for security.

// The live generator. Starts seeded from the clock; shots.js reseeds it.
let state = 0x9e3779b9;

function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let next = mulberry32(state);

/** Reseed the generator. Any integer seed works. */
export function seedRng(seed) {
  state = (seed | 0) || 1;
  next = mulberry32(state);
}

/** Uniform float in [0, 1). */
export function rand() {
  return next();
}

/** Uniform float in [min, max). */
export function randRange(min, max) {
  return min + next() * (max - min);
}

/** Uniform integer in [min, max]. */
export function randInt(min, max) {
  return Math.floor(min + next() * (max - min + 1));
}

/** True with probability p (0..1). */
export function chance(p) {
  return next() < p;
}

/** Pick one element of an array. */
export function pick(arr) {
  return arr[Math.floor(next() * arr.length)];
}

/** Fisher-Yates shuffle, in place. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/** Angle in radians, uniform over the circle. */
export function randAngle() {
  return next() * Math.PI * 2;
}
