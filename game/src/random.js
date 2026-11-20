// Solmar Bay — seeded random numbers.
// One job: a deterministic RNG so the city, traffic and missions are the same on
// every run (screenshots are reproducible) while still feeling alive.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    next: rand,
    // float in [min, max)
    range(min, max) { return min + rand() * (max - min); },
    // integer in [min, max]
    int(min, max) { return Math.floor(min + rand() * (max - min + 1)); },
    // pick one element
    pick(arr) { return arr[Math.floor(rand() * arr.length)]; },
    // true with probability p
    chance(p) { return rand() < p; },
    // gaussian-ish in [-1, 1]
    gauss() { return (rand() + rand() + rand() - 1.5) / 1.5; },
  };
}

// A tiny hash of two integers, for per-block variation that is stable.
export function hash2(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 974634) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
// shortest signed angle difference, in radians
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function dist2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
