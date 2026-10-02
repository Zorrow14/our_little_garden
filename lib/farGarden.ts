import { type BridgeSpan, bridgeCrossing, bridgeLanding, makeBridge, offBridgeWalkBy } from "@/lib/bridge";
import { type Frame, toWorld } from "@/lib/frame";
import { type Brook, brookDepth, smoothstep } from "@/lib/terrain";
import type { Point, WanderPlan } from "@/lib/wander";
import type { ZoneName } from "@/lib/zones";

/**
 * The far garden, over the bridge: an open meadow in its own space (centred on
 * the origin, the bridge at the near, +z, edge). A signpost stands in the
 * middle, with five entrances spaced evenly round it. Each is the way into a
 * place of its own (greenhouse, gazebo, lighthouse, maze, treehouse), a zone
 * of its own off its entrance, as the cottage is off the garden. Here each is
 * only a doorway (the lighthouse a tower too), so the meadow stays a modest hub.
 *
 * Pure layout and walkability; the scene is `components/zones/FarGardenZone`.
 */

/** How far from the middle you can walk; the hills start rising a little beyond. */
export const FAR_REACH = 12.5;

/** The brook along the near edge: the same one the garden's bridge crosses, seen from the other bank. */
export const FAR_BROOK: Brook = { x: 0, z: 0, radius: 16.6, angle: Math.PI / 2, spread: 1.1, width: 1.3, depth: 0.75 };

/** The ground: rolling like the garden's, rising into hills all round, cut by the brook at the near edge. */
export function farHeight(x: number, z: number) {
  let h = Math.sin(x * 0.29 + 0.4) * 0.1 + Math.cos(z * 0.31 - x * 0.1 + 1.1) * 0.12;
  h += smoothstep(14.5, 30, Math.hypot(x, z)) * 4.5;
  return h - brookDepth(FAR_BROOK, x, z);
}

// ---------------------------------------------------------------------------
// The bridge back to the garden, at the near edge, running out over the brook.

const nearEnd = FAR_BROOK.radius - 1.75;
export const FAR_BRIDGE: BridgeSpan = makeBridge({ x: 0, z: nearEnd, yaw: 0 }, 3.5, farHeight);
/** The way onto the bridge starts this far back from it, inside the meadow. */
const APPROACH = nearEnd - (FAR_REACH - 0.5);
/** Arriving over the bridge from the garden: a couple of steps in from it, facing the meadow. */
export const FAR_LANDING = bridgeLanding(FAR_BRIDGE, 1.9);
export const FAR_CROSSING = bridgeCrossing(FAR_BRIDGE);

// ---------------------------------------------------------------------------
// The five entrances.

export type EntranceId = "greenhouse" | "gazebo" | "lighthouse" | "maze" | "treehouse";

export interface Entrance extends Frame {
  id: EntranceId;
  /** For its tag: "The greenhouse". */
  label: string;
  /**
   * The zone it leads into, or null for a doorway that doesn't lead anywhere
   * yet. The registry turns every entrance with a `to` into an exit, and the
   * marker into a door; the zone has a spawn named "far-garden" by its way
   * back out, which leads to the spawn named after the entrance's id.
   */
  to: ZoneName | null;
}

/** How far out from the signpost the entrances stand. */
export const ENTRANCE_RING = 9.5;

/** The lighthouse is a tower as well as a doorway: a landmark across the meadow, its lamp turning. */
export const LIGHTHOUSE_TOWER = { radius: 1.05, top: 0.68, height: 6.2, lamp: 6.75 };

/**
 * The solid parts of each entrance, in its own space (the doorway itself, at
 * the origin, is left clear so it can be walked into once it leads somewhere).
 */
export const ENTRANCE_SOLIDS: Record<EntranceId, (Point & { r: number })[]> = {
  greenhouse: [
    { x: -0.62, z: 0, r: 0.12 },
    { x: 0.62, z: 0, r: 0.12 },
    { x: -1.0, z: 0.1, r: 0.18 },
    { x: 1.0, z: 0.1, r: 0.18 },
  ],
  gazebo: [
    { x: -0.62, z: 0, r: 0.12 },
    { x: 0.62, z: 0, r: 0.12 },
  ],
  // The tower, its door in the front of it.
  lighthouse: [{ x: 0, z: -LIGHTHOUSE_TOWER.radius - 0.1, r: LIGHTHOUSE_TOWER.radius }],
  maze: [
    { x: -0.98, z: 0, r: 0.4 },
    { x: 0.98, z: 0, r: 0.4 },
  ],
  treehouse: [{ x: 0, z: -0.62, r: 0.45 }],
};

/**
 * Evenly round a circle (72° apart), with the gap between the first and last
 * facing the bridge, so the way in from it runs straight up the middle.
 * Each faces the signpost.
 */
const ORDER: [EntranceId, string, ZoneName | null][] = [
  ["greenhouse", "The greenhouse", "greenhouse"],
  ["gazebo", "The gazebo", "gazebo"],
  ["lighthouse", "The lighthouse", "lighthouse"],
  ["maze", "The maze", "maze"],
  ["treehouse", "The treehouse", "treehouse"],
];

export const ENTRANCES: Entrance[] = ORDER.map(([id, label, to], i) => {
  const a = Math.PI / 2 - Math.PI / 5 - (i * 2 * Math.PI) / 5;
  const x = Math.cos(a) * ENTRANCE_RING;
  const z = Math.sin(a) * ENTRANCE_RING;
  return { id, label, x, z, yaw: Math.atan2(-x, -z), to };
});

export const entranceById = (id: EntranceId) => ENTRANCES.find((e) => e.id === id)!;

/** Where you appear coming back out of an entrance's place: just in front of it, facing the signpost. */
export function entranceLanding(e: Entrance) {
  const p = toWorld(e, 0, 1.3);
  return { x: p.x, z: p.z, yaw: e.yaw };
}

// ---------------------------------------------------------------------------
// Walking.

/** The signpost in the middle and the solid parts of each entrance. */
export const FAR_OBSTACLES: (Point & { r: number })[] = [
  { x: 0, z: 0, r: 0.3 },
  ...ENTRANCES.flatMap((e) => ENTRANCE_SOLIDS[e.id].map((s) => ({ ...toWorld(e, s.x, s.z), r: s.r }))),
];

const BODY = 0.14;

/** How far into somewhere a walking gardener shouldn't be: past the edge (except onto the bridge), or into a post. 0 on open ground. */
export function farOffGroundBy(x: number, z: number) {
  let by = Math.max(0, Math.hypot(x, z) - FAR_REACH);
  if (by > 0) by = Math.min(by, offBridgeWalkBy(FAR_BRIDGE, x, z, APPROACH));
  for (const o of FAR_OBSTACLES) by += Math.max(0, o.r + BODY - Math.hypot(o.x - x, o.z - z));
  return by;
}

/** Stricter, for picking somewhere to stroll to. */
export function farIsWalkable(x: number, z: number) {
  if (Math.hypot(x, z) > FAR_REACH - 2) return false;
  return FAR_OBSTACLES.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + 0.6);
}

function clearLine(a: Point, b: Point, blockers: Point[]) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  for (let d = Math.min(0.5, length); d <= length; d += 0.25) {
    const t = d / length;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (farOffGroundBy(x, z) > 0 || blockers.some((o) => Math.hypot(o.x - x, o.z - z) < 0.9)) return false;
  }
  return farIsWalkable(b.x, b.z);
}

/** A stroll to somewhere a few steps away, never where the other gardener is or is heading. */
export function farPlanWander(from: Point, claimed: Point[], blockers: Point[], rand: () => number): WanderPlan | null {
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const d = 1.5 + rand() * 4.5;
    const target = { x: from.x + Math.cos(a) * d, z: from.z + Math.sin(a) * d };
    if (claimed.some((o) => Math.hypot(o.x - target.x, o.z - target.z) < 1.8)) continue;
    if (clearLine(from, target, blockers)) return { target, tend: null };
  }
  return null;
}

export function farNearestWalkable(p: Point): Point {
  if (farIsWalkable(p.x, p.z)) return p;
  for (let r = 0.3; r < FAR_REACH; r += 0.3) {
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const q = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
      if (farIsWalkable(q.x, q.z)) return q;
    }
  }
  return p;
}

/** The stepping-stone paths: in from the bridge to the signpost, and out from it to each entrance. */
export const FAR_PATHS: [Point, Point][] = [
  [{ x: 0, z: FAR_LANDING.z + 0.6 }, { x: 0, z: 1.4 }],
  ...ENTRANCES.map((e): [Point, Point] => {
    const l = Math.hypot(e.x, e.z);
    return [
      { x: (e.x / l) * 1.4, z: (e.z / l) * 1.4 },
      { x: (e.x / l) * (ENTRANCE_RING - 0.9), z: (e.z / l) * (ENTRANCE_RING - 0.9) },
    ];
  }),
];
