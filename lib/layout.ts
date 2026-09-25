import * as THREE from "three";
import type { FlowerKind } from "@/data/memories";

export interface FlowerSpot {
  x: number;
  z: number;
  scale: number;
  /** How far the flower looks off to one side of the viewer, in radians, so they don't all stare straight at her. */
  facing: number;
}

/**
 * Where each flower grows. The lotus floats in the pond right in front of the
 * camera so it's the first one she finds; the lily is the largest, on the near bank.
 * The final bloom waits at the far end of the path.
 */
export const FLOWER_SPOTS: Record<FlowerKind, FlowerSpot> = {
  lotus: { x: 0.35, z: 2.0, scale: 1.25, facing: 0 },
  lily: { x: -2.75, z: 0.8, scale: 1.45, facing: 0.2 },
  tulip: { x: 3.1, z: -0.4, scale: 1.2, facing: -0.2 },
  rose: { x: -2.9, z: -3.7, scale: 1.25, facing: 0.15 },
  daisy: { x: 2.8, z: -4.1, scale: 1.3, facing: -0.15 },
  orchid: { x: -0.6, z: -5.4, scale: 1.25, facing: 0.1 },
  final: { x: 0.7, z: -8.7, scale: 1.7, facing: 0 },
};

/** World-space point just above each flower head, filled in as flowers mount. */
export const flowerAnchors = new Map<string, THREE.Vector3>();

/** Stepping-stone path from the front of the garden, past the pond, to the final bloom. */
export const PATH_CURVE = new THREE.CatmullRomCurve3(
  [
    [1.1, 9.5],
    [2.8, 6.8],
    [3.3, 4.0],
    [2.7, 1.3],
    [1.5, -1.9],
    [1.2, -4.5],
    [0.9, -7.4],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
);

const PATH_SAMPLES = PATH_CURVE.getSpacedPoints(120);

/**
 * The fence around the garden: a circle just past the grass, before the hills
 * rise, with a gate where the stepping-stone path comes in.
 */
export const FENCE = { x: 0, z: -0.8, radius: 13 } as const;
const pathStart = PATH_CURVE.getPoint(0);
export const GATE_ANGLE = Math.atan2(pathStart.z - FENCE.z, pathStart.x - FENCE.x);

export function distanceToPath(x: number, z: number) {
  let min = Infinity;
  for (const p of PATH_SAMPLES) min = Math.min(min, Math.hypot(p.x - x, p.z - z));
  return min;
}

export function distanceToFlowers(x: number, z: number) {
  let min = Infinity;
  for (const spot of Object.values(FLOWER_SPOTS)) min = Math.min(min, Math.hypot(spot.x - x, spot.z - z));
  return min;
}

/** Direction the moonlight comes from (upper left, behind the garden). */
export const MOON_DIRECTION = new THREE.Vector3(-0.42, 0.5, -0.76).normalize();
