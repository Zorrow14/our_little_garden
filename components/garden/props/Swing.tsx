"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { withCameraFade, withGrowth } from "@/lib/growth";
import { player } from "@/lib/playerInput";
import { usePresence } from "@/lib/presence";
import {
  type SeatProp,
  SEATS,
  seatById,
  seated,
  seatRequest,
  SIT_REACH,
  SWING,
  SWING_GROUND,
  SWING_PIVOT,
  SWING_ROPE,
  SWING_ROPE_X,
  SWING_TREE,
  SWING_WIDTH,
  swingMotion,
  toWorld,
} from "@/lib/props";
import { createRandom, groundHeight } from "@/lib/terrain";
import { box, PropHover, rod, useMergedParts } from "./shared";

/** What a seat's tag says when you hover it: sit down, get up, or come closer. */
export function seatNote(prop: SeatProp) {
  const { me } = usePresence.getState();
  const mine = me ? seatById(seated.get(me)) : null;
  if (mine?.prop === prop) return "click to get up";
  if (!player.active) return undefined;
  const near = SEATS.some((s) => s.prop === prop && Math.hypot(s.stand.x - player.x, s.stand.z - player.z) <= SIT_REACH);
  return near ? "click to sit down" : "walk over to sit down";
}

const CANOPY_COLORS = ["#1e4a38", "#245240", "#2d5b44", "#20463f"];

/**
 * An old tree with a two-seater swing hung from its low branch. The tree is
 * built like the ones ringing the garden, a little gnarlier, and fades away
 * when the camera comes right up to it. The swing sways in the breeze, more
 * with someone on it.
 */
export default function Swing() {
  const trunkBase = useMemo(() => new THREE.Vector3(SWING_TREE.x, groundHeight(SWING_TREE.x, SWING_TREE.z) - 0.1, SWING_TREE.z), []);
  const fadeCenter = useMemo(() => ({ value: new THREE.Vector3(SWING_TREE.x, trunkBase.y + 2, SWING_TREE.z) }), [trunkBase]);

  // The tree, in world space: trunk, the branch out over the swing, and a canopy of blobs.
  const tree = useMemo(() => {
    const s = SWING_TREE.scale;
    const pivotY = SWING_GROUND + SWING_PIVOT;
    const at = (lx: number, y: number, lz = 0) => {
      const p = toWorld(SWING, lx, lz);
      return new THREE.Vector3(p.x, y, p.z);
    };
    const bark = new THREE.MeshLambertMaterial({ color: "#3b2d29", flatShading: true });
    const leaves = new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true });
    const fade = <T extends THREE.Material>(m: T) => withCameraFade(withGrowth(m), 2.2, 4.5, fadeCenter);

    const wood = [
      rod(trunkBase, new THREE.Vector3(SWING_TREE.x + 0.08, trunkBase.y + 2.6 * s, SWING_TREE.z), 0.2 * s, 0.11 * s, 7),
      // The branch: out of the trunk, then level along the top of the swing, where the ropes are tied.
      rod(new THREE.Vector3(SWING_TREE.x, pivotY - 0.3, SWING_TREE.z), at(-0.75, pivotY + 0.04), 0.11, 0.08, 6),
      rod(at(-0.8, pivotY + 0.04), at(SWING_ROPE_X + 0.45, pivotY + 0.1), 0.08, 0.045, 6),
      // A second limb up into the canopy, the other way.
      rod(new THREE.Vector3(SWING_TREE.x, trunkBase.y + 1.9 * s, SWING_TREE.z), at(-2.1, trunkBase.y + 3 * s, -0.6), 0.08, 0.04, 5),
    ].map((g) => g.toNonIndexed());

    // Canopy: blobs over the trunk and out along the branch, so the swing hangs in its shade.
    const rand = createRandom(23);
    const blobs: THREE.BufferGeometry[] = [];
    const color = new THREE.Color();
    const centres = [
      [-1.35, -0.3, 3.35, 1.25],
      [-0.6, -0.1, 3.05, 1.05],
      [0.25, -0.15, 2.85, 0.85],
      [-2.0, -0.55, 3.0, 0.95],
      [-1.2, -0.9, 3.7, 0.9],
      [-1.3, 0.35, 3.25, 0.85],
    ];
    for (const [lx, lz, y, r] of centres) {
      const p = toWorld(SWING, lx, lz);
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.scale(1, 0.85, 1);
      g.rotateY(rand() * Math.PI);
      g.translate(p.x, SWING_GROUND + y, p.z);
      color.set(CANOPY_COLORS[Math.floor(rand() * CANOPY_COLORS.length)]);
      const count = g.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      blobs.push(g);
    }
    const merged = { wood: mergeGeometries(wood)!, canopy: mergeGeometries(blobs)! };
    [...wood, ...blobs].forEach((g) => g.dispose());
    return {
      ...merged,
      bark: fade(bark),
      leaves: fade(leaves),
    };
  }, [trunkBase, fadeCenter]);

  useEffect(
    () => () => {
      [tree.wood, tree.canopy, tree.bark, tree.leaves].forEach((o) => o.dispose());
    },
    [tree],
  );

  const swingArm = useRef<THREE.Group>(null!);
  const amplitude = useRef(0.03);

  useFrame(({ clock }, delta) => {
    // A breath of a sway when empty; a gentle swing with one of you on it, a little more with both.
    const riders = [...seated.values()].filter((id) => seatById(id)?.prop === "swing").length;
    amplitude.current = THREE.MathUtils.damp(amplitude.current, riders === 0 ? 0.03 : riders === 1 ? 0.13 : 0.17, 0.8, delta);
    swingMotion.angle = amplitude.current * Math.sin(clock.elapsedTime * 1.9);
    swingArm.current.rotation.x = -swingMotion.angle;
  });

  const seat = useMergedParts(swingParts, SWING_PALETTE);
  const middle = toWorld(SWING, 0, 0);
  const tagAt: [number, number, number] = [middle.x, SWING_GROUND + 1.5, middle.z];

  return (
    <>
      <mesh geometry={tree.wood} material={tree.bark} />
      <mesh geometry={tree.canopy} material={tree.leaves} />
      <PropHover
        tag="The swing"
        note={() => seatNote("swing")}
        tagAt={tagAt}
        pool={{ at: [middle.x, SWING_GROUND + 0.03, middle.z], size: 2.4 }}
        light={[middle.x, SWING_GROUND + 1.3, middle.z]}
        onSelect={() => {
          // Only while you've a gardener of your own to sit down.
          if (player.active) seatRequest.prop = "swing";
        }}
      >
        <group position={[SWING.x, SWING_GROUND + SWING_PIVOT, SWING.z]} rotation-y={SWING.yaw}>
          <group ref={swingArm}>
            {seat}
            {/* The whole swing up to the branch, ropes and all, so it can be clicked over whoever's sitting on it. */}
            <mesh visible={false} position-y={-SWING_ROPE / 2 + 0.1}>
              <boxGeometry args={[SWING_WIDTH + 0.2, SWING_ROPE + 0.4, 0.5]} />
            </mesh>
          </group>
        </group>
      </PropHover>
    </>
  );
}

const SWING_PALETTE = { plank: "#9a7a5e", dark: "#6e5543", rope: "#d9c9a6", cushion: "#d98ca0" };

/** The swing itself, hanging from its pivot (the origin), seat facing +z. */
function swingParts() {
  const parts: { geometry: THREE.BufferGeometry; material: string; position: [number, number, number]; rotation?: [number, number, number] }[] = [];
  const seatY = -SWING_ROPE;
  for (const side of [-1, 1]) {
    // A rope each side, from the branch down past the seat to the rail under it.
    parts.push({
      geometry: new THREE.CylinderGeometry(0.013, 0.013, SWING_ROPE + 0.08, 4),
      material: "rope",
      position: [side * SWING_ROPE_X, seatY + (SWING_ROPE + 0.08) / 2 - 0.07, 0],
    });
    // A knot round the branch.
    parts.push({ geometry: new THREE.TorusGeometry(0.035, 0.012, 4, 8), material: "rope", position: [side * SWING_ROPE_X, 0.02, 0], rotation: [0, Math.PI / 2, 0] });
    // Back posts.
    parts.push({ geometry: box(0.05, 0.38, 0.05), material: "dark", position: [side * (SWING_WIDTH / 2 - 0.04), seatY + 0.16, -0.16] });
  }
  // The seat: three planks with a rail under each end.
  for (let i = 0; i < 3; i++) {
    parts.push({ geometry: box(SWING_WIDTH, 0.045, 0.11), material: "plank", position: [0, seatY - 0.025, -0.12 + i * 0.12] });
  }
  for (const side of [-1, 1]) parts.push({ geometry: box(0.06, 0.05, 0.4), material: "dark", position: [side * (SWING_WIDTH / 2 - 0.08), seatY - 0.07, 0] });
  // A backrest of two slats.
  parts.push({ geometry: box(SWING_WIDTH - 0.04, 0.07, 0.03), material: "plank", position: [0, seatY + 0.16, -0.17] });
  parts.push({ geometry: box(SWING_WIDTH - 0.04, 0.07, 0.03), material: "plank", position: [0, seatY + 0.3, -0.17] });
  // A cushion at one end.
  parts.push({ geometry: box(0.3, 0.05, 0.28), material: "cushion", position: [0.3, seatY + 0.02, -0.01] });
  return parts;
}
