import type { ComponentType } from "react";
import { HOUSE_DOOR, houseIsWalkable, houseNearestWalkable, houseOffGroundBy, housePlanWander } from "@/lib/house";
import { COTTAGE, DOOR, OFF_DOORSTEP, onProcession, PROCESSION_LENGTH } from "@/lib/procession";
import { deckHeight } from "@/lib/props";
import { groundHeight, WATER_Y } from "@/lib/terrain";
import { isWalkable, nearestWalkable, offGroundBy, planWander, type Point, type WanderPlan } from "@/lib/wander";
import { goToZone, type ZoneName } from "@/lib/zones";
import GardenZone from "./GardenZone";
import HouseZone from "./HouseZone";

/** A place to appear when arriving in a zone, facing `yaw`. */
export interface SpawnPoint {
  x: number;
  z: number;
  yaw: number;
}

/** A way out: walking within `radius` of `at` (or clicking it) takes you to `spawn` in zone `to`. */
export interface ExitPoint {
  name: string;
  at: Point;
  radius: number;
  to: ZoneName;
  spawn: string;
}

/** Where gardeners can stand and stroll in a zone. `plants` are the shared garden's planted flowers. */
export interface ZoneGround {
  height: (x: number, z: number) => number;
  /** How far into somewhere they shouldn't be: 0 on open ground. Used when steering. */
  offGroundBy: (x: number, z: number, plants: Point[]) => number;
  /** Stricter, for picking where to wander to. */
  isWalkable: (x: number, z: number, plants: Point[]) => boolean;
  planWander: (from: Point, claimed: Point[], blockers: Point[], plants: Point[], rand: () => number) => WanderPlan | null;
  nearestWalkable: (p: Point, plants: Point[]) => Point;
}

export interface ZoneDefinition {
  /** Everything in the zone except the gardeners, who walk between zones: scenery, lights and camera. */
  Scene: ComponentType;
  ground: ZoneGround;
  /** Where you appear, by the entry point you came in through. */
  spawns: Record<string, SpawnPoint>;
  exits: ExitPoint[];
}

/** The cottage floor sits above the slope it's built on, the dock above the water; out on the grass, a gardener crossing the pond wades. */
function gardenHeight(x: number, z: number) {
  const deck = deckHeight(x, z);
  if (deck !== null) return Math.max(deck, groundHeight(x, z));
  const c = Math.cos(COTTAGE.yaw);
  const s = Math.sin(COTTAGE.yaw);
  const lx = (x - COTTAGE.x) * c - (z - COTTAGE.z) * s;
  const lz = (x - COTTAGE.x) * s + (z - COTTAGE.z) * c;
  if (Math.abs(lx) < COTTAGE.width / 2 && Math.abs(lz) < COTTAGE.depth / 2 + 0.05) return COTTAGE.floorY;
  return Math.max(groundHeight(x, z), WATER_Y - 0.12);
}

const spawnOnPath = (s: number): SpawnPoint => {
  const p = onProcession(s, 0);
  return { x: p.x, z: p.z, yaw: p.heading };
};

/**
 * Every zone, by name. To add one: build its scene (with its own camera), give
 * it ground, spawn points and exits here, add its name to `ZONE_NAMES`, and
 * add an exit from an existing zone that leads to one of its spawn points.
 */
export const ZONES = {
  garden: {
    Scene: GardenZone,
    ground: {
      height: gardenHeight,
      offGroundBy,
      isWalkable,
      planWander,
      nearestWalkable,
    },
    spawns: {
      /** Just inside the gate, where the walk in from the cottage ends. */
      gate: spawnOnPath(PROCESSION_LENGTH),
      /** On the path just outside the cottage door, heading toward the garden. */
      "cottage-door": spawnOnPath(OFF_DOORSTEP + 0.15),
    },
    exits: [{ name: "cottage-door", at: DOOR, radius: 0.42, to: "house", spawn: "front-door" }],
  },
  house: {
    Scene: HouseZone,
    ground: {
      height: () => 0,
      offGroundBy: (x, z) => houseOffGroundBy(x, z),
      isWalkable: (x, z) => houseIsWalkable(x, z),
      planWander: (from, claimed, blockers, _plants, rand) => housePlanWander(from, claimed, blockers, rand),
      nearestWalkable: (p) => houseNearestWalkable(p),
    },
    spawns: {
      /** Just inside the door, stepping into the room. */
      "front-door": { x: HOUSE_DOOR.x + 0.75, z: HOUSE_DOOR.z, yaw: Math.PI / 2 },
      /** Where a gardener whose owner is away is found pottering about. */
      home: { x: 0.95, z: 0.75, yaw: -2.4 },
    },
    exits: [{ name: "front-door", at: { x: HOUSE_DOOR.x + 0.28, z: HOUSE_DOOR.z }, radius: 0.32, to: "garden", spawn: "cottage-door" }],
  },
} satisfies Record<ZoneName, ZoneDefinition>;

/** Every zone has its scene and ground, typed loosely enough to look up by a `ZoneName` held in a variable. */
export const zoneDefinition = (zone: ZoneName): ZoneDefinition => ZONES[zone];

/** Takes an exit by clicking it (a door), as if you'd walked through. */
export function takeExit(zone: ZoneName, name: string) {
  const exit = zoneDefinition(zone).exits.find((e) => e.name === name);
  if (exit) goToZone(exit.to, exit.spawn);
}
