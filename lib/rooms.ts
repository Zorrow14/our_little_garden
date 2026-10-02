import type { Point, WanderPlan } from "@/lib/wander";

/**
 * Walking about a small place of its own: a room, a lawn round a gazebo, a
 * maze. Each is laid out in its own space, centred on the origin with the
 * floor at y = 0, and described as a `RoomPlan`: the floor's outline, a door
 * on its edge, and the solid things standing on it. `roomGround` turns a plan
 * into the walking rules a zone needs (see `ZoneGround` in the registry), and
 * `roomDoor` into the spawn point and exit by its door.
 *
 * The places off the far garden all use this; the cottage has its own
 * (`lib/house.ts`), which works the same way.
 */

/** Something solid on the floor: a round footprint, a box, or a wall (a thick line from `a` to `b`). */
export type Solid = (Point & { r: number }) | (Point & { halfX: number; halfZ: number }) | { a: Point; b: Point; half: number };

export interface RoomPlan {
  /** The walkable floor: a rectangle or a circle, centred on the origin. */
  floor: { halfWidth: number; halfDepth: number } | { radius: number };
  /** The doorway, on the floor's edge. Walking into it (or clicking the door) leads back out. */
  door: Point;
  solids: Solid[];
  /** Things worth pottering over to and looking at. */
  tend?: { stand: Point; face: Point }[];
}

/** Room kept between a gardener and the walls or furniture. */
const BODY = 0.24;

function intoSolid(s: Solid, x: number, z: number, body: number) {
  if ("r" in s) return Math.max(0, s.r + body - Math.hypot(x - s.x, z - s.z));
  if ("halfX" in s) {
    const inX = s.halfX + body - Math.abs(x - s.x);
    const inZ = s.halfZ + body - Math.abs(z - s.z);
    return inX > 0 && inZ > 0 ? Math.min(inX, inZ) : 0;
  }
  const dx = s.b.x - s.a.x;
  const dz = s.b.z - s.a.z;
  const t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (z - s.a.z) * dz) / (dx * dx + dz * dz)));
  return Math.max(0, s.half + body - Math.hypot(s.a.x + dx * t - x, s.a.z + dz * t - z));
}

/** How far past the floor's edge (x, z) is, keeping `inset` in from it. */
function pastEdge(plan: RoomPlan, x: number, z: number, inset: number) {
  const f = plan.floor;
  if ("radius" in f) return Math.max(0, Math.hypot(x, z) - (f.radius - inset));
  return Math.max(0, Math.abs(x) - (f.halfWidth - inset)) + Math.max(0, Math.abs(z) - (f.halfDepth - inset));
}

/** The way in from the door: straight in from whichever edge it's on. */
function inward(plan: RoomPlan): Point {
  const { door, floor } = plan;
  if ("radius" in floor) {
    const l = Math.hypot(door.x, door.z) || 1;
    return { x: -door.x / l, z: -door.z / l };
  }
  return Math.abs(door.x) / floor.halfWidth > Math.abs(door.z) / floor.halfDepth
    ? { x: -Math.sign(door.x), z: 0 }
    : { x: 0, z: -Math.sign(door.z) };
}

/** Arriving: a step in from the door, facing into the room. Leaving: walking back into the doorway. */
export function roomDoor(plan: RoomPlan) {
  const into = inward(plan);
  const step = (d: number) => ({ x: plan.door.x + into.x * d, z: plan.door.z + into.z * d });
  return {
    spawn: { ...step(0.8), yaw: Math.atan2(into.x, into.z) },
    exit: { at: step(0.28), radius: 0.34 },
  };
}

export function roomGround(plan: RoomPlan) {
  const solids = plan.solids;
  const tend = plan.tend ?? [];

  /** How far into a wall or something solid a gardener at (x, z) would be: 0 on open floor. */
  const offGroundBy = (x: number, z: number) => {
    let by = pastEdge(plan, x, z, BODY + 0.04);
    for (const s of solids) by += intoSolid(s, x, z, BODY);
    return by;
  };

  /** Wandering keeps further from everything than steering does, and away from the door. */
  const isWalkable = (x: number, z: number) => {
    if (pastEdge(plan, x, z, 0.6) > 0) return false;
    if (Math.hypot(x - plan.door.x, z - plan.door.z) < 1) return false;
    return solids.every((s) => intoSolid(s, x, z, BODY + 0.18) === 0);
  };

  const clearWalk = (a: Point, b: Point, blockers: Point[]) => {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    for (let d = Math.min(0.3, length); d <= length; d += 0.15) {
      const x = a.x + ((b.x - a.x) * d) / length;
      const z = a.z + ((b.z - a.z) * d) / length;
      if (offGroundBy(x, z) > 0 || blockers.some((o) => Math.hypot(o.x - x, o.z - z) < 0.75)) return false;
    }
    return isWalkable(b.x, b.z);
  };

  const extent = "radius" in plan.floor ? { x: plan.floor.radius, z: plan.floor.radius } : { x: plan.floor.halfWidth, z: plan.floor.halfDepth };

  /** A stroll across the floor, or over to something to tend. */
  const planWander = (from: Point, claimed: Point[], blockers: Point[], rand: () => number): WanderPlan | null => {
    const roomy = (p: Point) => claimed.every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= 1.2);
    if (tend.length > 0 && rand() < 0.45) {
      const spot = tend[Math.floor(rand() * tend.length)];
      if (Math.hypot(spot.stand.x - from.x, spot.stand.z - from.z) > 0.6 && roomy(spot.stand) && clearWalk(from, spot.stand, blockers)) {
        return { target: spot.stand, tend: spot.face };
      }
    }
    for (let i = 0; i < 40; i++) {
      const target = { x: (rand() * 2 - 1) * (extent.x - 0.6), z: (rand() * 2 - 1) * (extent.z - 0.6) };
      if (Math.hypot(target.x - from.x, target.z - from.z) > 1 && roomy(target) && clearWalk(from, target, blockers)) return { target, tend: null };
    }
    return null;
  };

  const nearestWalkable = (p: Point): Point => {
    if (isWalkable(p.x, p.z)) return p;
    for (let r = 0.2; r < Math.max(extent.x, extent.z) * 2; r += 0.2) {
      for (let a = 0; a < Math.PI * 2; a += 0.35) {
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r;
        if (isWalkable(x, z)) return { x, z };
      }
    }
    return p;
  };

  return { offGroundBy, isWalkable, planWander, nearestWalkable };
}
