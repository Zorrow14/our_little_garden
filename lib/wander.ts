import { distanceToFlowers, FENCE, FLOWER_SPOTS } from "@/lib/layout";
import { distanceToPond, POND, WATER_Y } from "@/lib/terrain";

export interface Point {
  x: number;
  z: number;
}

/**
 * How far from the middle of the garden the gardeners roam: well inside the
 * fence, and short of the near edge where they'd crowd the camera.
 */
const ROAM_RADIUS = FENCE.radius - 3.5;
/** Room kept clear around the pond's rim stones, each letter's flower, and each planted flower. */
const POND_CLEARANCE = POND.radius * 1.22;
const FLOWER_CLEARANCE = 0.85;
const PLANT_CLEARANCE = 0.7;
/** How close a gardener may pick a spot to where the other is, or is heading. */
const PERSONAL_SPACE = 1.8;
/** How close a planned walk may pass someone standing in the garden. */
const PASSING_ROOM = 0.9;

/** Letter flowers a gardener can walk up to (the lotus floats out of reach). */
const LETTER_FLOWERS: Point[] = Object.entries(FLOWER_SPOTS)
  .filter(([kind]) => kind !== "lotus")
  .map(([, spot]) => ({ x: spot.x, z: spot.z }));

function inRoamingArea(x: number, z: number) {
  return Math.hypot(x - FENCE.x, z - FENCE.z) <= ROAM_RADIUS;
}

/** Clear of the pond, the flowers and the planted flowers. */
function isOpenGround(x: number, z: number, plants: Point[]) {
  if (distanceToPond(x, z) < POND_CLEARANCE || distanceToFlowers(x, z) < FLOWER_CLEARANCE) return false;
  return plants.every((p) => Math.hypot(p.x - x, p.z - z) >= PLANT_CLEARANCE);
}

export function isWalkable(x: number, z: number, plants: Point[]) {
  return inRoamingArea(x, z) && isOpenGround(x, z, plants);
}

/**
 * Whether a straight walk from `a` to `b` stays on walkable ground and clear of
 * `blockers`. The first stretch is skipped, so a gardener a flower sprang up
 * beside can still step away, and one who has just come in through the gate
 * (outside the roaming area) may cross its edge on the way in.
 */
export function isClearWalk(a: Point, b: Point, plants: Point[], blockers: Point[] = []) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const startsInside = inRoamingArea(a.x, a.z);
  for (let d = Math.min(0.5, length); d <= length; d += 0.2) {
    const t = d / length;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (!isOpenGround(x, z, plants) || (startsInside && !inRoamingArea(x, z))) return false;
    if (blockers.some((o) => Math.hypot(o.x - x, o.z - z) < PASSING_ROOM)) return false;
  }
  return isWalkable(b.x, b.z, plants);
}

/** Walking your own gardener: anywhere inside the fence, short of the pond's rim and stepping round the flowers. */
const PLAYER_REACH = FENCE.radius - 1.4;
const PLAYER_POND_CLEARANCE = POND.radius * 1.12;
const PLAYER_FLOWER_CLEARANCE = 0.42;
const PLAYER_PLANT_CLEARANCE = 0.32;

/**
 * How far into somewhere a walking gardener shouldn't be (past the edge, into
 * the pond, onto a flower): 0 on open ground. A step is allowed if it lands on
 * open ground or gets less stuck, so a gardener who starts in the gateway, past
 * the edge, can still walk in.
 */
export function offGroundBy(x: number, z: number, plants: Point[]) {
  let by = Math.max(0, Math.hypot(x - FENCE.x, z - FENCE.z) - PLAYER_REACH);
  by += Math.max(0, PLAYER_POND_CLEARANCE - distanceToPond(x, z));
  by += Math.max(0, PLAYER_FLOWER_CLEARANCE - distanceToFlowers(x, z));
  for (const p of plants) by += Math.max(0, PLAYER_PLANT_CLEARANCE - Math.hypot(p.x - x, p.z - z));
  return by;
}

/** Planted flowers growing on land, which gardeners walk around and sometimes tend. */
export function landPlants(plants: { position_x: number; position_y: number; position_z: number }[]): Point[] {
  return plants.filter((p) => p.position_y > WATER_Y + 0.01).map((p) => ({ x: p.position_x, z: p.position_z }));
}

export interface WanderPlan {
  target: Point;
  /** A flower to face and tend on arrival, if the walk was to one. */
  tend: Point | null;
}

/**
 * Picks where to stroll next: usually a random spot a few steps away, sometimes
 * a flower to tend. Never somewhere the other gardener is standing or heading
 * (`claimed`), and never walking through where they stand (`blockers`).
 */
export function planWander(
  from: Point,
  claimed: Point[],
  blockers: Point[],
  plants: Point[],
  rand: () => number,
): WanderPlan | null {
  const roomy = (p: Point) => claimed.every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= PERSONAL_SPACE);

  if (rand() < 0.4) {
    const flowers = [...LETTER_FLOWERS, ...plants];
    for (let i = 0; i < 6; i++) {
      const flower = flowers[Math.floor(rand() * flowers.length)];
      // Stand an arm's length from the flower, roughly on the side facing the gardener.
      const a = Math.atan2(from.z - flower.z, from.x - flower.x) + (rand() - 0.5) * 1.6;
      const target = { x: flower.x + Math.cos(a) * 1.0, z: flower.z + Math.sin(a) * 1.0 };
      const distance = Math.hypot(target.x - from.x, target.z - from.z);
      if (distance > 1 && distance < 7 && roomy(target) && isClearWalk(from, target, plants, blockers)) {
        return { target, tend: flower };
      }
    }
  }

  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const d = 1.5 + rand() * 4.5;
    const target = { x: from.x + Math.cos(a) * d, z: from.z + Math.sin(a) * d };
    if (roomy(target) && isClearWalk(from, target, plants, blockers)) return { target, tend: null };
  }
  return null;
}

/** The nearest walkable point to `p`, for placing a gardener at the start. */
export function nearestWalkable(p: Point, plants: Point[]): Point {
  if (isWalkable(p.x, p.z, plants)) return p;
  for (let r = 0.3; r < ROAM_RADIUS; r += 0.3) {
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (isWalkable(x, z, plants)) return { x, z };
    }
  }
  return p;
}
