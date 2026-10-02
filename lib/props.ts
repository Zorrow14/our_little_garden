import { type BridgeSpan, makeBridge, offBridgeWalkBy } from "@/lib/bridge";
import { type Frame, toLocal, toWorld } from "@/lib/frame";
import { FENCE } from "@/lib/layout";
import { BRIDGE_ANGLE, GARDEN_BROOK, groundHeight, HILL, POND, WATER_Y } from "@/lib/terrain";
import type { Point } from "@/lib/wander";

/**
 * Where the garden's props stand: the swing under its tree, the dock out into
 * the pond, the mailbox by the gate, the bridge to the far garden, and (in
 * `lib/terrain`) the stargazing hill. Pure layout plus a little shared runtime
 * state about who's sitting where; the scene, the gardeners and the walkable
 * ground all read from here.
 *
 * Each prop has its own space (a `Frame`), as the cottage does.
 */

export type { Frame } from "@/lib/frame";
export { toLocal, toWorld } from "@/lib/frame";

// ---------------------------------------------------------------------------
// The swing: a two-seater hung from a low branch, on the quiet left of the
// garden, facing back across it toward the pond.

export const SWING: Frame = { x: -5.9, z: -2.1, yaw: Math.atan2(0.5, 0.87) };
export const SWING_GROUND = groundHeight(SWING.x, SWING.z);
/** Height of the branch the ropes hang from, and of the seat, above the ground under the swing. */
export const SWING_PIVOT = 2.05;
export const SWING_SEAT = 0.44;
export const SWING_ROPE = SWING_PIVOT - SWING_SEAT;
/** The ropes, either side of the middle; the seat is a little wider. */
export const SWING_ROPE_X = 0.46;
export const SWING_WIDTH = 1.04;
/** The old tree it hangs from: off to the swing's left and a little behind, its branch reaching over. */
export const SWING_TREE = { ...toWorld(SWING, -1.35, -0.3), scale: 1.45 };

// ---------------------------------------------------------------------------
// The dock: boards out from the pond's west bank toward the middle, widening at
// the end where two little benches look out over the water at the lotus.

const TOWARD_WATER = (() => {
  const l = Math.hypot(0.97, -0.24);
  return { x: 0.97 / l, z: -0.24 / l };
})();
/** Its origin is on the bank; local +z runs out over the water. */
export const DOCK = {
  x: POND.x - TOWARD_WATER.x * 3.7,
  z: POND.z - TOWARD_WATER.z * 3.7,
  yaw: Math.atan2(TOWARD_WATER.x, TOWARD_WATER.z),
  length: 2.45,
  width: 0.72,
  /** The square at the end, wider than the walkway. */
  platformWidth: 1.44,
  platformDepth: 0.95,
  /** The top of the boards: clear of the bank where it crosses the pond's rim, and well above the water. */
  deckY: WATER_Y + 0.31,
} as const;
/** The two benches at the end, side by side across the dock. */
export const DOCK_BENCHES = [-0.38, 0.38].map((x) => ({ x, z: DOCK.length - 0.3 }));
export const DOCK_BENCH_SEAT = 0.34;

/** The boards' outline, in the dock's own space, `margin` bigger all round. */
function inDockOutline(lx: number, lz: number, margin: number) {
  if (lz < -0.15 - margin || lz > DOCK.length + margin) return false;
  const half = lz > DOCK.length - DOCK.platformDepth ? DOCK.platformWidth / 2 : DOCK.width / 2;
  return Math.abs(lx) <= half + margin;
}

/** The top of the dock's boards, if (x, z) is on them. */
export function deckHeight(x: number, z: number): number | null {
  const l = toLocal(DOCK, x, z);
  return inDockOutline(l.x, l.z, 0) ? DOCK.deckY : null;
}

/** Where a gardener can walk on the dock: down the middle, and about the end short of the benches. */
export function onDockWalk(x: number, z: number) {
  const l = toLocal(DOCK, x, z);
  if (l.z < -0.6 || l.z > DOCK.length - 0.62) return false;
  return Math.abs(l.x) <= (l.z > DOCK.length - DOCK.platformDepth ? 0.62 : 0.26);
}

function distanceToDock(x: number, z: number) {
  const l = toLocal(DOCK, x, z);
  const half = l.z > DOCK.length - DOCK.platformDepth ? DOCK.platformWidth / 2 : DOCK.width / 2;
  return Math.hypot(Math.max(Math.abs(l.x) - half, 0), Math.max(-0.15 - l.z, l.z - DOCK.length, 0));
}

// ---------------------------------------------------------------------------
// The mailbox: on a post just inside the gate, left of the path, its door
// facing the path so you pass it on the way in.

export const MAILBOX: Frame = { x: 0.05, z: 10.75, yaw: Math.PI / 2 - 0.15 };

// ---------------------------------------------------------------------------
// The bridge to the far garden: through a second gap in the back of the
// fence and over the brook beyond it.

const OUT = { x: Math.cos(BRIDGE_ANGLE), z: Math.sin(BRIDGE_ANGLE) };
const nearEnd = GARDEN_BROOK.radius - 1.75;
export const GARDEN_BRIDGE: BridgeSpan = makeBridge(
  { x: FENCE.x + OUT.x * nearEnd, z: FENCE.z + OUT.z * nearEnd, yaw: Math.atan2(OUT.x, OUT.z) },
  3.5,
  groundHeight,
);
/** How far back into the garden the way onto the bridge starts: from inside the fence, out through its gap. */
export const BRIDGE_APPROACH = nearEnd - (FENCE.radius - 2.2);

/** Stepping stones out through the fence to the bridge, and on from its far end into the trees. */
export const GARDEN_BRIDGE_PATH: [Point, Point][] = [
  [toWorld(GARDEN_BRIDGE, 0, -BRIDGE_APPROACH - 0.6), toWorld(GARDEN_BRIDGE, 0, -0.35)],
  [toWorld(GARDEN_BRIDGE, 0, GARDEN_BRIDGE.length + 0.4), toWorld(GARDEN_BRIDGE, 0, GARDEN_BRIDGE.length + 4)],
];

/** How far (x, z) is off the way out through the fence and over the bridge: 0 on it. */
export function offGardenBridgeBy(x: number, z: number) {
  return offBridgeWalkBy(GARDEN_BRIDGE, x, z, BRIDGE_APPROACH);
}

// ---------------------------------------------------------------------------
// Spacing.

/** Solid things to walk round: the tree's trunk, the swing's seat, the mailbox's post. */
export const OBSTACLES: (Point & { r: number })[] = [
  { x: SWING_TREE.x, z: SWING_TREE.z, r: 0.3 },
  { ...toWorld(SWING, -0.28, 0), r: 0.28 },
  { ...toWorld(SWING, 0.28, 0), r: 0.28 },
  { x: MAILBOX.x, z: MAILBOX.z, r: 0.18 },
];

/**
 * How far (x, z) is from the nearest prop: the obstacles above, the dock, and the way to the bridge.
 * Scenery, wandering and new plants use it to keep their distance.
 */
export function distanceToProps(x: number, z: number) {
  let min = Math.min(distanceToDock(x, z), offGardenBridgeBy(x, z) - 0.15);
  for (const o of OBSTACLES) min = Math.min(min, Math.hypot(o.x - x, o.z - z) - o.r);
  return Math.max(0, min);
}

/**
 * Stargazing: where the view sits, low on the hill's flank, and which way it
 * looks (up past the top of the hill). It's turned well round from the way
 * out of the garden, so the trees round the edge don't fill the sky.
 */
export const STARGAZE = (() => {
  const l = Math.hypot(HILL.x - FENCE.x, HILL.z - FENCE.z);
  const out = { x: (HILL.x - FENCE.x) / l, z: (HILL.z - FENCE.z) / l };
  const turn = 0.95;
  const side = { x: out.x * Math.cos(turn) - out.z * Math.sin(turn), z: out.x * Math.sin(turn) + out.z * Math.cos(turn) };
  return {
    camera: { x: HILL.x + side.x * 5, z: HILL.z + side.z * 5 },
    look: { x: -side.x, z: -side.z },
  };
})();

/** Whether (x, z) is on the top of the stargazing hill, which is kept clear for lying back on. */
export function onHilltop(x: number, z: number, share = 0.6) {
  return Math.hypot(x - HILL.x, z - HILL.z) < HILL.radius * share;
}

// ---------------------------------------------------------------------------
// Seats: two on the swing, one on each bench at the end of the dock.

export type SeatProp = "swing" | "dock";

export interface Seat {
  id: string;
  prop: SeatProp;
  /** Which way a gardener sitting here faces. */
  yaw: number;
  /** Height of the seat's top. */
  y: number;
  /** Where they get up to, and must be near to sit down. */
  stand: Point;
  /** Where they sit, in the prop's own space. */
  local: Point;
  frame: Frame;
}

export const SEATS: Seat[] = [
  ...[-0.26, 0.26].map((x, i): Seat => ({
    id: `swing-${i}`,
    prop: "swing",
    yaw: SWING.yaw,
    y: SWING_GROUND + SWING_SEAT,
    // Beside the seat's end rather than in front of it, so you don't stand between the camera and the swing.
    stand: toWorld(SWING, Math.sign(x) * 0.85, 0.5),
    local: { x, z: 0.02 },
    frame: SWING,
  })),
  ...DOCK_BENCHES.map(
    (b, i): Seat => ({
      id: `dock-${i}`,
      prop: "dock",
      yaw: DOCK.yaw,
      y: DOCK.deckY + DOCK_BENCH_SEAT,
      stand: toWorld(DOCK, b.x * 1.1, DOCK.length - 0.82),
      local: { x: b.x, z: b.z + 0.02 },
      frame: DOCK,
    }),
  ),
];

export const seatById = (id: string | null | undefined) => SEATS.find((s) => s.id === id) ?? null;

/** How close to a seat's prop a gardener must be to sit on it. */
export const SIT_REACH = 1.7;

/** How far the swing is swung out, in radians: written by the swing every frame, read by whoever's sitting on it. */
export const swingMotion = { angle: 0 };

/** Where someone sitting on `seat` is right now: on the swing, that moves with it. */
export function seatPose(seat: Seat) {
  let lz = seat.local.z;
  let y = seat.y;
  if (seat.prop === "swing") {
    lz += Math.sin(swingMotion.angle) * SWING_ROPE;
    y += (1 - Math.cos(swingMotion.angle)) * SWING_ROPE;
  }
  const p = toWorld(seat.frame, seat.local.x, lz);
  return { x: p.x, y, z: p.z, yaw: seat.yaw };
}

/** Who's sitting where right now (gardener name → seat id), kept up to date by the gardeners every frame. */
export const seated = new Map<string, string>();

/** A click on a seat, waiting for your gardener to sit down on it (or get up, if already there). */
export const seatRequest = { prop: null as SeatProp | null };

/** The pair of seats in use, if both gardeners are sitting on the same prop. */
export function sittingTogether(): [Seat, Seat] | null {
  const seats = [...seated.values()].map(seatById).filter((s): s is Seat => s !== null);
  return seats.length === 2 && seats[0].prop === seats[1].prop ? [seats[0], seats[1]] : null;
}
