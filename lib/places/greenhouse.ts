import { FLOWER_TYPES, type FlowerType } from "@/lib/flowerSpecs";
import type { RoomPlan } from "@/lib/rooms";

/**
 * Inside the greenhouse: one glass room, its own space centred on the origin
 * (floor at y = 0, door in the left, -x, wall, as in the cottage). Along the
 * back, a tiered stand shows one of every flower in the registry. On the
 * right, the potting bench, where you can plant something for the garden.
 */

export const GREENHOUSE = { halfWidth: 3.2, halfDepth: 2.4, eaves: 1.9, ridge: 3.05 };

export const GREENHOUSE_DOOR = { x: -GREENHOUSE.halfWidth, z: 0.9, width: 0.9, height: 1.7 };

export const GREENHOUSE_FURNITURE = {
  /** The flower stand along the back wall. */
  stand: { x: 0.1, z: -1.95, halfX: 2.75, halfZ: 0.42 },
  /** The potting bench along the right wall. */
  bench: { x: 2.72, z: 0.15, halfX: 0.45, halfZ: 1.0 },
  /** A slatted table of potted plants in the middle. */
  table: { x: -0.35, z: 0.6, halfX: 0.75, halfZ: 0.38 },
  fern: { x: -2.65, z: 1.95, r: 0.3 },
  palm: { x: 2.7, z: 1.95, r: 0.28 },
};

/** One shelf of the stand: how high, how far back, and the flowers along it, left to right. */
export interface CatalogShelf {
  y: number;
  z: number;
  x0: number;
  flowers: FlowerType[];
}

/** Every flower in the registry, the first half on the low front shelf and the rest on the high back one. */
const half = Math.ceil(FLOWER_TYPES.length / 2);
export const CATALOG: CatalogShelf[] = [
  { y: 0.5, z: -1.68, x0: -2.25, flowers: FLOWER_TYPES.slice(0, half) },
  { y: 0.95, z: -2.12, x0: -1.85, flowers: FLOWER_TYPES.slice(half) },
];
/** Room for each flower along a shelf. */
export const CATALOG_SPACING = 0.9;

export const GREENHOUSE_PLAN: RoomPlan = {
  floor: { halfWidth: GREENHOUSE.halfWidth, halfDepth: GREENHOUSE.halfDepth },
  door: GREENHOUSE_DOOR,
  solids: Object.values(GREENHOUSE_FURNITURE),
  tend: [
    { stand: { x: -1.1, z: -1.05 }, face: { x: -1.1, z: -2 } },
    { stand: { x: 1.3, z: -1.05 }, face: { x: 1.3, z: -2 } },
    { stand: { x: 1.95, z: 0.15 }, face: GREENHOUSE_FURNITURE.bench },
  ],
};
