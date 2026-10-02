import type { Point, WanderPlan } from "@/lib/wander";

/**
 * Inside the cottage: one cosy room, bigger inside than out. The room is its
 * own little world centred on the origin, floor at y = 0, door in the left
 * (-x) wall. Everything here is plain numbers, shared by the room's scene and
 * the gardeners walking around in it.
 */

export const ROOM = { halfWidth: 3, halfDepth: 2.4, height: 2.3 };

export const HOUSE_DOOR = { x: -ROOM.halfWidth, z: 1.05, width: 0.82, height: 1.75 };
export const HOUSE_WINDOW = { x: 0.35, y: 1.35, width: 1.05, height: 0.9 };

/** Furniture, as footprints the gardeners walk around. */
type Footprint = { x: number; z: number } & ({ r: number } | { halfX: number; halfZ: number });

export const FURNITURE = {
  bed: { x: 2.15, z: -1.35, halfX: 0.72, halfZ: 1.02 },
  table: { x: -0.55, z: 0.15, r: 0.56 },
  stoolLeft: { x: -1.35, z: 0.55, r: 0.21 },
  stoolRight: { x: 0.25, z: -0.3, r: 0.21 },
  plant: { x: -2.5, z: -1.9, r: 0.32 },
  shelf: { x: -1.45, z: -2.22, halfX: 0.52, halfZ: 0.17 },
  lamp: { x: 1.05, z: -2.1, r: 0.2 },
} satisfies Record<string, Footprint>;

/** Room kept between a gardener and the walls or furniture. */
const BODY = 0.24;

/** How far into a wall or a piece of furniture a gardener at (x, z) would be: 0 on open floor. */
export function houseOffGroundBy(x: number, z: number) {
  let by = Math.max(0, Math.abs(x) - (ROOM.halfWidth - BODY - 0.04)) + Math.max(0, Math.abs(z) - (ROOM.halfDepth - BODY));
  for (const f of Object.values<Footprint>(FURNITURE)) {
    if ("r" in f) {
      by += Math.max(0, f.r + BODY - Math.hypot(x - f.x, z - f.z));
    } else {
      const inX = f.halfX + BODY - Math.abs(x - f.x);
      const inZ = f.halfZ + BODY - Math.abs(z - f.z);
      if (inX > 0 && inZ > 0) by += Math.min(inX, inZ);
    }
  }
  return by;
}

/** Wandering keeps a little further from things than steering does, and well away from the door. */
export function houseIsWalkable(x: number, z: number) {
  if (Math.abs(x) > ROOM.halfWidth - 0.6 || Math.abs(z) > ROOM.halfDepth - 0.5) return false;
  if (Math.hypot(x - HOUSE_DOOR.x, z - HOUSE_DOOR.z) < 1) return false;
  return houseOffGroundBy(x, z) === 0 && houseOffGroundBy(x + 0.15, z) === 0 && houseOffGroundBy(x - 0.15, z) === 0;
}

function clearWalk(a: Point, b: Point, blockers: Point[]) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  for (let d = Math.min(0.3, length); d <= length; d += 0.15) {
    const x = a.x + ((b.x - a.x) * d) / length;
    const z = a.z + ((b.z - a.z) * d) / length;
    if (houseOffGroundBy(x, z) > 0 || blockers.some((o) => Math.hypot(o.x - x, o.z - z) < 0.75)) return false;
  }
  return houseIsWalkable(b.x, b.z);
}

/** Things worth pottering over to: the plant (to water), the window (to look out), the bookshelf. */
const TEND_SPOTS: { stand: Point; face: Point }[] = [
  { stand: { x: -1.95, z: -1.45 }, face: FURNITURE.plant },
  { stand: { x: HOUSE_WINDOW.x, z: -1.75 }, face: { x: HOUSE_WINDOW.x, z: -ROOM.halfDepth } },
  { stand: { x: -1.45, z: -1.6 }, face: FURNITURE.shelf },
];

/** The house's version of `planWander`: a stroll across the room, or over to something to tend. */
export function housePlanWander(from: Point, claimed: Point[], blockers: Point[], rand: () => number): WanderPlan | null {
  const roomy = (p: Point) => claimed.every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= 1.2);
  if (rand() < 0.45) {
    const spot = TEND_SPOTS[Math.floor(rand() * TEND_SPOTS.length)];
    if (Math.hypot(spot.stand.x - from.x, spot.stand.z - from.z) > 0.6 && roomy(spot.stand) && clearWalk(from, spot.stand, blockers)) {
      return { target: spot.stand, tend: spot.face };
    }
  }
  for (let i = 0; i < 40; i++) {
    const target = {
      x: (rand() * 2 - 1) * (ROOM.halfWidth - 0.6),
      z: (rand() * 2 - 1) * (ROOM.halfDepth - 0.5),
    };
    const d = Math.hypot(target.x - from.x, target.z - from.z);
    if (d > 1 && roomy(target) && clearWalk(from, target, blockers)) return { target, tend: null };
  }
  return null;
}

export function houseNearestWalkable(p: Point): Point {
  if (houseIsWalkable(p.x, p.z)) return p;
  for (let r = 0.2; r < 4; r += 0.2) {
    for (let a = 0; a < Math.PI * 2; a += 0.35) {
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (houseIsWalkable(x, z)) return { x, z };
    }
  }
  return p;
}
