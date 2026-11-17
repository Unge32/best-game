// Emberwarden — random.js
// A tiny seeded generator (mulberry32) so the staged screenshots are
// deterministic, plus the small helpers the game uses for jitter.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRandom(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // Integer in [min, max].
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    // Pick one element of an array.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}
