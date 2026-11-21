// random.js — Solmar Bay v3: a small seeded RNG so the city is stable per seed.
// One job: deterministic randomness for the city layout and the test driver.

// mulberry32: a fast, well-behaved seeded PRNG.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Range helper: rng() in [0,1) -> [lo, hi).
export function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function rangeInt(rng, lo, hi) { return Math.floor(range(rng, lo, hi + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function chance(rng, p) { return rng() < p; }

// A stable hash of a grid cell, so a building's look does not depend on
// the order the city was built in.
export function cellHash(ix, iz, salt) {
  let h = (ix * 374761393 + iz * 668265263 + salt * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
