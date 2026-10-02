import * as THREE from "three";
import { FENCE, GATE_ANGLE } from "@/lib/layout";
import { groundHeight } from "@/lib/terrain";

/**
 * The cottage outside the gate, and the walk the gardeners take from its door
 * into the garden at the end of the intro. The cottage, the gardeners and the
 * camera all read from here.
 */

/** Unit vectors at the gate: straight out of the garden, and across to the right as you walk out. */
const OUT = new THREE.Vector2(Math.cos(GATE_ANGLE), Math.sin(GATE_ANGLE));
const ACROSS = new THREE.Vector2(OUT.y, -OUT.x);

export const GATE = { x: FENCE.x + OUT.x * FENCE.radius, z: FENCE.z + OUT.y * FENCE.radius };

/** A point `along` units out from the gate and `across` units to the right of the way out. */
export function nearGate(along: number, across: number) {
  return {
    x: GATE.x + OUT.x * along + ACROSS.x * across,
    z: GATE.z + OUT.y * along + ACROSS.y * across,
  };
}

const center = nearGate(4.2, 3.2);
// The front faces back across toward the path, turned a little toward the gate.
const front = new THREE.Vector2(-ACROSS.x * 0.95 - OUT.x * 0.3, -ACROSS.y * 0.95 - OUT.y * 0.3).normalize();
const WIDTH = 2.3;
const DEPTH = 1.8;

/** Footprint corners, for sitting the cottage level on the slope. */
const corners = [-1, 1].flatMap((sx) =>
  [-1, 1].map((sz) => {
    const side = new THREE.Vector2(front.y, -front.x);
    return {
      x: center.x + side.x * sx * (WIDTH / 2 + 0.1) + front.x * sz * (DEPTH / 2 + 0.1),
      z: center.z + side.y * sx * (WIDTH / 2 + 0.1) + front.y * sz * (DEPTH / 2 + 0.1),
    };
  }),
);
const cornerHeights = corners.map((c) => groundHeight(c.x, c.z));

export const COTTAGE = {
  x: center.x,
  z: center.z,
  /** Turns the cottage's local +z (its front, with the door) to face `front`. */
  yaw: Math.atan2(front.x, front.y),
  width: WIDTH,
  depth: DEPTH,
  wallHeight: 1.45,
  doorWidth: 0.62,
  doorHeight: 1.18,
  /** Floor level: a touch above the average ground, the uphill side dug into the slope. */
  floorY: cornerHeights.reduce((a, b) => a + b, 0) / cornerHeights.length + 0.12,
  /** Lowest ground under the footprint, for how far down the stone base must reach. */
  lowestGround: Math.min(...cornerHeights),
};

export const DOOR = {
  x: center.x + front.x * (DEPTH / 2),
  z: center.z + front.y * (DEPTH / 2),
};

const along = (d: number) => ({ x: DOOR.x + front.x * d, z: DOOR.z + front.y * d });

/**
 * The scripted walk, as a centre line: from inside the cottage, out of the door,
 * down to the gate, and a few steps into the garden.
 */
const WAYPOINTS = [along(-1.25), along(0.05), along(0.75), nearGate(2.5, 0.7), nearGate(0.9, 0), nearGate(0, 0), nearGate(-1.5, 0)];
export const PROCESSION = new THREE.CatmullRomCurve3(
  WAYPOINTS.map((p) => new THREE.Vector3(p.x, 0, p.z)),
  false,
  "centripetal",
);
export const PROCESSION_LENGTH = PROCESSION.getLength();

/** Distance along the walk to the point nearest `p`. */
function distanceAlong(p: { x: number; z: number }) {
  const samples = PROCESSION.getSpacedPoints(300);
  let best = 0;
  let bestDistance = Infinity;
  samples.forEach((s, i) => {
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return (best / 300) * PROCESSION_LENGTH;
}

/** Where the walk crosses the threshold, steps off the doorstep, and passes through the gate. */
export const AT_DOOR = distanceAlong(DOOR);
export const OFF_DOORSTEP = distanceAlong(along(0.75));
export const AT_GATE = distanceAlong(GATE);

const tangent = new THREE.Vector3();
const point = new THREE.Vector3();

/**
 * A spot on the walk `s` units along the centre line, shifted `side` units to the
 * right of it, with the heading of travel there.
 */
export function onProcession(s: number, side: number) {
  const u = THREE.MathUtils.clamp(s / PROCESSION_LENGTH, 0, 1);
  PROCESSION.getPointAt(u, point);
  PROCESSION.getTangentAt(u, tangent);
  const x = point.x - tangent.z * side;
  const z = point.z + tangent.x * side;
  const outside = groundHeight(x, z);
  // Indoors they're on the cottage floor; they step down off the doorstep onto the ground.
  const indoors = 1 - THREE.MathUtils.smoothstep(s, AT_DOOR, AT_DOOR + 0.35);
  return { x, z, y: THREE.MathUtils.lerp(outside, COTTAGE.floorY, indoors), heading: Math.atan2(tangent.x, tangent.z) };
}

/** Live state of the intro walk, written and read every frame by the cottage, gardeners and camera. */
export const procession = {
  /** Whether the door should be open. The camera opens it; the cottage shuts it once everyone's out. */
  doorWanted: false,
  /** How far the door has swung, from 0 (shut) to 1 (open). */
  door: 0,
  /** Each gardener's position and progress along the walk, and whether they've reached the garden. */
  walkers: new Map<string, { position: THREE.Vector3; s: number; done: boolean }>(),
  /** Gardeners standing near the door, any time: it opens for them on their way in or out. */
  nearDoor: new Set<string>(),
};

/** Camera poses for the intro: looking at the cottage door, and trailing the gardeners as they reach the gate. */
export const INTRO_SHOTS = {
  reveal: {
    position: (() => {
      const p = nearGate(6.8, -3.2);
      return new THREE.Vector3(p.x, groundHeight(p.x, p.z) + 2.5, p.z);
    })(),
    target: new THREE.Vector3(DOOR.x, COTTAGE.floorY + 0.8, DOOR.z),
  },
  trail: (() => {
    const p = nearGate(4.4, -1.4);
    return new THREE.Vector3(p.x, groundHeight(p.x, p.z) + 3.4, p.z);
  })(),
};
