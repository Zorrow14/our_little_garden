import type { RoomPlan } from "@/lib/rooms";

/**
 * Inside the base of the lighthouse: one round stone room, its own space
 * centred on the origin (floor at y = 0). A spiral stair climbs the wall
 * toward the lamp, and in the middle, on a pedestal, the spare lamp that keeps
 * the countdown (`lib/countdown.ts`): unlit until there's a date to count to.
 */

export const LIGHTHOUSE_ROOM = { radius: 2.4, height: 2.7 };

/** The door, in the wall on the left, a little toward the front. */
const DOOR_ANGLE = (160 * Math.PI) / 180;
export const LIGHTHOUSE_DOOR = {
  x: Math.cos(DOOR_ANGLE) * LIGHTHOUSE_ROOM.radius,
  z: Math.sin(DOOR_ANGLE) * LIGHTHOUSE_ROOM.radius,
  angle: DOOR_ANGLE,
  width: 0.85,
  height: 1.75,
};

/** The lamp on its pedestal, in the middle. */
export const LAMP = { x: 0.1, z: -0.15, r: 0.42 };

/** How near the lamp (from its middle) you have to come for it to tell you the countdown: closer than the door. */
export const LAMP_NEAR = 1.25;

/** The stair: steps round the wall from the right, toward the back, up to a hatch in the ceiling. */
export const STAIR = { from: (-15 * Math.PI) / 180, sweep: (-150 * Math.PI) / 180, steps: 12, inner: 1.55, rise: 0.22 };

export const stairStep = (i: number) => {
  const a = STAIR.from + (STAIR.sweep * (i + 0.5)) / STAIR.steps;
  return { angle: a, y: STAIR.rise * (i + 1) };
};

/** A keeper's desk and a barrel against the back wall, under the high steps. */
export const LIGHTHOUSE_FURNITURE = {
  desk: { x: -0.85, z: -1.8, r: 0.38 },
  barrel: { x: -1.64, z: -1.15, r: 0.28 },
};

/** The low steps are in the way; higher up, you walk under them. */
const lowSteps = Array.from({ length: 5 }, (_, i) => {
  const { angle } = stairStep(i);
  const r = (STAIR.inner + LIGHTHOUSE_ROOM.radius) / 2;
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r, r: 0.4 };
});

export const LIGHTHOUSE_PLAN: RoomPlan = {
  floor: { radius: LIGHTHOUSE_ROOM.radius },
  door: LIGHTHOUSE_DOOR,
  solids: [LAMP, ...Object.values(LIGHTHOUSE_FURNITURE), ...lowSteps],
  tend: [{ stand: { x: 0.1, z: 0.75 }, face: LAMP }],
};
