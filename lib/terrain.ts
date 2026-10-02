import { FENCE } from "@/lib/layout";

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

/**
 * A brook: a channel cut along an arc (centre, radius, and the angle it's
 * centred on, either side by `spread` radians), fading out at both ends into
 * the hills. Bridges cross them into the far garden.
 */
export interface Brook {
  x: number;
  z: number;
  radius: number;
  angle: number;
  spread: number;
  /** Half the channel's width, and how deep it cuts at its deepest. */
  width: number;
  depth: number;
}

/** How far a brook cuts into the ground at (x, z). */
export function brookDepth(b: Brook, x: number, z: number) {
  const off = Math.abs(Math.hypot(x - b.x, z - b.z) - b.radius);
  if (off > b.width) return 0;
  const turn = Math.atan2(z - b.z, x - b.x) - b.angle;
  const along = Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
  if (along > b.spread) return 0;
  return b.depth * smoothstep(b.width, b.width * 0.3, off) * smoothstep(b.spread, b.spread * 0.55, along);
}

/** Which way from the middle of the garden the bridge to the far garden is: the back, a little left, away from the cottage and in sight from the usual view. */
export const BRIDGE_ANGLE = Math.atan2(-0.87, -0.5);

/** The brook running round outside the back of the fence, under the bridge. */
export const GARDEN_BROOK: Brook = { x: FENCE.x, z: FENCE.z, radius: 15.2, angle: BRIDGE_ANGLE, spread: 1.0, width: 1.3, depth: 0.75 };

/** A small grassy mound in the quiet back corner of the garden, for watching the stars from. */
export const HILL = { x: 7.0, z: -4.8, radius: 2.4, height: 0.6 } as const;

/** Terrain height: gently rolling ground, a basin for the pond, the stargazing hill, hills around the rim, and the brook. */
export function groundHeight(x: number, z: number) {
  let h = Math.sin(x * 0.33 + 1.3) * 0.1 + Math.cos(z * 0.29 - x * 0.12) * 0.12;
  h += smoothstep(12, 26, Math.hypot(x, z)) * 4;
  h -= brookDepth(GARDEN_BROOK, x, z);
  h += smoothstep(HILL.radius, HILL.radius * 0.15, Math.hypot(x - HILL.x, z - HILL.z)) * HILL.height;
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
