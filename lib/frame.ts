import type { Point } from "@/lib/wander";

/**
 * A prop's own space, as the cottage has: an origin and a turn (`yaw`) that
 * points its front, local +z, the way it faces.
 */
export interface Frame {
  x: number;
  z: number;
  yaw: number;
}

export function toWorld(f: Frame, lx: number, lz: number): Point {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c };
}

export function toLocal(f: Frame, x: number, z: number): Point {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  const dx = x - f.x;
  const dz = z - f.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** The frame at `at`, turned to face `toward`. */
export function facing(at: Point, toward: Point): Frame {
  return { x: at.x, z: at.z, yaw: Math.atan2(toward.x - at.x, toward.z - at.z) };
}
