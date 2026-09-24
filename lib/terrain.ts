/** Surface of the pond. The terrain dips below this inside the pond basin. */
export const WATER_Y = -0.14;

/** The pond sits front and centre, between the camera and the rest of the garden. */
export const POND = { x: 0, z: 2.2, radius: 2.4 } as const;

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function distanceToPond(x: number, z: number) {
  return Math.hypot(x - POND.x, z - POND.z);
}

/** Terrain height: gently rolling ground, a basin for the pond, and hills around the rim. */
export function groundHeight(x: number, z: number) {
  let h = Math.sin(x * 0.33 + 1.3) * 0.1 + Math.cos(z * 0.29 - x * 0.12) * 0.12;
  h += smoothstep(12, 26, Math.hypot(x, z)) * 4;
  const basin = 1 - smoothstep(0.55, 1.1, distanceToPond(x, z) / POND.radius);
  return h + (-0.5 - h) * basin;
}

/** Deterministic PRNG (mulberry32), so the garden grows the same way on every visit. */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
