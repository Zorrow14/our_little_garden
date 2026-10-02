import type { RoomPlan } from "@/lib/rooms";

/**
 * Inside the treehouse: a little room up in the leaves, smaller than the
 * cottage, in its own space centred on the origin (floor at y = 0, high above
 * the ground far below; door in the left, -x, wall, out to the top of the
 * ladder). Nothing to do here but be together: a nest of cushions, a crate
 * for a table, and a window looking down over the far garden.
 */

export const TREEHOUSE = { halfWidth: 2.0, halfDepth: 1.6, height: 1.85 };

/** How far below the floor the ground is. */
export const TREEHOUSE_DROP = 4.2;

export const TREEHOUSE_DOOR = { x: -TREEHOUSE.halfWidth, z: 0.6, width: 0.72, height: 1.45 };
export const TREEHOUSE_WINDOW = { x: -0.15, y: 1.05, width: 0.95, height: 0.72 };

export const TREEHOUSE_FURNITURE = {
  /** The trunk, coming up through the floor in the back corner. */
  trunk: { x: -1.45, z: -1.05, r: 0.32 },
  /** Cushions and blankets heaped in the other back corner. */
  nest: { x: 1.1, z: -0.8, halfX: 0.78, halfZ: 0.68 },
  /** An upturned crate for a table, with a candle and two mugs. */
  crate: { x: -0.2, z: 0.3, r: 0.27 },
};

export const TREEHOUSE_PLAN: RoomPlan = {
  floor: { halfWidth: TREEHOUSE.halfWidth, halfDepth: TREEHOUSE.halfDepth },
  door: TREEHOUSE_DOOR,
  solids: Object.values(TREEHOUSE_FURNITURE),
  tend: [
    { stand: { x: TREEHOUSE_WINDOW.x, z: -1.0 }, face: { x: TREEHOUSE_WINDOW.x, z: -TREEHOUSE.halfDepth } },
    { stand: { x: 0.95, z: 0.25 }, face: TREEHOUSE_FURNITURE.nest },
  ],
};
