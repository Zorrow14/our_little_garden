import type { RoomPlan, Solid } from "@/lib/rooms";
import { smoothstep } from "@/lib/terrain";

/**
 * The gazebo: an open-sided, eight-sided gazebo on a round lawn, in its own
 * space centred on the origin. You come in through a vine arch at the near
 * (+z) edge of the lawn, and walk up a short path of lanterns to it. Inside,
 * a bench round the back, and nothing else: a quiet place, left open for
 * whatever it becomes.
 */

/** The lawn you can walk on. */
export const LAWN_RADIUS = 5.6;

/** Corner radius, floor height, and the height of the eaves. */
export const GAZEBO = { radius: 1.9, floor: 0.22, eaves: 2.15, peak: 3.3 };

/** Its corners, a face (not a corner) toward the arch. */
export const GAZEBO_CORNERS = Array.from({ length: 8 }, (_, k) => {
  const a = Math.PI / 2 + Math.PI / 8 + (k * Math.PI) / 4;
  return { x: Math.cos(a) * GAZEBO.radius, z: Math.sin(a) * GAZEBO.radius };
});
/** The faces with a railing: every one but the one toward the arch (between the last and first corners). */
export const RAILED_FACES = [0, 1, 2, 3, 4, 5, 6];

/** How far the floor's flat faces are from the middle. */
const APOTHEM = GAZEBO.radius * Math.cos(Math.PI / 8);

export const GAZEBO_ARCH = { x: 0, z: LAWN_RADIUS };

/** The lanterns along the path, either side of it. */
export const PATH_LANTERNS = [2.9, 4.3].flatMap((z) => [-0.85, 0.85].map((x) => ({ x, z })));

/** The bench, round the back three faces, a little in from them. */
export const BENCH_FACES = [2, 3, 4];

/** The lawn: nearly flat, rising into low hills beyond. */
export function lawnHeight(x: number, z: number) {
  return Math.sin(x * 0.4) * 0.05 + Math.cos(z * 0.37 + 0.6) * 0.05 + smoothstep(7, 22, Math.hypot(x, z)) * 3.5;
}

/** Where gardeners stand: on the lawn, or up on the gazebo's floor. */
export function gazeboHeight(x: number, z: number) {
  return Math.hypot(x, z) < APOTHEM ? GAZEBO.floor : lawnHeight(x, z);
}

const solids: Solid[] = [
  ...GAZEBO_CORNERS.map((c) => ({ ...c, r: 0.1 })),
  ...RAILED_FACES.map((k) => ({ a: GAZEBO_CORNERS[k], b: GAZEBO_CORNERS[(k + 1) % 8], half: 0.05 })),
  ...BENCH_FACES.map((k) => {
    const a = GAZEBO_CORNERS[k];
    const b = GAZEBO_CORNERS[(k + 1) % 8];
    const inset = 0.78;
    return { a: { x: a.x * inset, z: a.z * inset }, b: { x: b.x * inset, z: b.z * inset }, half: 0.16 };
  }),
  ...PATH_LANTERNS.map((p) => ({ ...p, r: 0.08 })),
];

export const GAZEBO_PLAN: RoomPlan = {
  floor: { radius: LAWN_RADIUS },
  door: GAZEBO_ARCH,
  solids,
  tend: [{ stand: { x: 0, z: 0.4 }, face: { x: 0, z: -1 } }],
};
