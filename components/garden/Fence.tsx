"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { withCameraFade, withGrowth } from "@/lib/growth";
import { FENCE, GATE_ANGLE } from "@/lib/layout";
import { BRIDGE_ANGLE, createRandom, groundHeight } from "@/lib/terrain";

const POST_SPACING = 1.3;
const POST_HEIGHT = 0.85;
/** Half the width of the gap in the fence where the path comes in. */
const GATE_HALF_WIDTH = 0.85;
const GATE_HEIGHT = 1.45;
/** Rail heights above the ground, as a share of the post height. */
const RAILS = [0.36, 0.74];

const WOOD_COLORS = ["#8a735f", "#957d68", "#7f6a57", "#8f7862", "#7a6553"].map((c) => new THREE.Color(c));

interface Board {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  size: THREE.Vector3;
  color: THREE.Color;
}

/** A plank from `a` to `b` (both on the plank's centre line), overhanging each end a little. */
function plank(a: THREE.Vector3, b: THREE.Vector3, height: number, depth: number, color: THREE.Color): Board {
  const d = b.clone().sub(a);
  const run = Math.hypot(d.x, d.z);
  return {
    position: a.clone().add(b).multiplyScalar(0.5),
    // Yaw lays the plank's length along the span; the roll tilts it to follow the slope.
    rotation: new THREE.Euler(0, Math.atan2(-d.z, d.x), Math.atan2(d.y, run), "YXZ"),
    size: new THREE.Vector3(d.length() + 0.1, height, depth),
    color,
  };
}

/** Whether a post at angle `a` would stand in the way out to the bridge. */
function inBridgeGap(a: number) {
  const turn = a - BRIDGE_ANGLE;
  return Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) * FENCE.radius < GATE_HALF_WIDTH;
}

/**
 * A split-rail fence around the garden: hand-set posts with two rails between
 * each pair, and a taller gateway with a crossbeam where the path comes in,
 * and another at the back where the way out to the bridge goes through.
 * Every post, rail and beam is one instance of a single box.
 */
export default function Fence() {
  const boards = useMemo(() => {
    const rand = createRandom(41);
    const wood = () => WOOD_COLORS[Math.floor(rand() * WOOD_COLORS.length)];
    const gateHalfAngle = GATE_HALF_WIDTH / FENCE.radius;
    const arc = Math.PI * 2 - gateHalfAngle * 2;
    const spans = Math.round((arc * FENCE.radius) / POST_SPACING);
    const list: Board[] = [];

    // Posts in the way out to the bridge are left out; the two either side of it stand tall, like the gate's.
    const baseAngle = (i: number) => GATE_ANGLE + gateHalfAngle + (i / spans) * arc;
    const gap = (i: number) => i > 0 && i < spans && inBridgeGap(baseAngle(i));
    const bridgePosts: number[] = [];

    // Every post (and rail) draws its random numbers whether or not it's built, so the rest of the fence stays as it was.
    const posts = Array.from({ length: spans + 1 }, (_, i) => {
      const gate = i === 0 || i === spans;
      const flanksBridge = !gap(i) && (gap(i - 1) || gap(i + 1));
      if (flanksBridge) bridgePosts.push(i);
      const a = baseAngle(i) + (gate ? 0 : (rand() - 0.5) * 0.02);
      const x = FENCE.x + Math.cos(a) * FENCE.radius;
      const z = FENCE.z + Math.sin(a) * FENCE.radius;
      const ground = groundHeight(x, z);
      const usual = gate ? GATE_HEIGHT : POST_HEIGHT * (0.93 + rand() * 0.14);
      const tall = gate || flanksBridge;
      const height = tall ? GATE_HEIGHT : usual;
      const board: Board = {
        position: new THREE.Vector3(x, ground + height / 2 - 0.08, z),
        rotation: new THREE.Euler((rand() - 0.5) * 0.06, -a + (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.06),
        size: new THREE.Vector3(tall ? 0.16 : 0.1, height + 0.08, tall ? 0.16 : 0.1),
        color: wood(),
      };
      if (!gap(i)) list.push(board);
      return { x, z, ground };
    });

    // Two rails per span, each resting a touch unevenly on its posts.
    for (let i = 0; i < spans; i++) {
      const p = posts[i];
      const q = posts[i + 1];
      for (const share of RAILS) {
        const h = POST_HEIGHT * share;
        const a = new THREE.Vector3(p.x, p.ground + h + (rand() - 0.5) * 0.04, p.z);
        const b = new THREE.Vector3(q.x, q.ground + h + (rand() - 0.5) * 0.04, q.z);
        const rail = plank(a, b, 0.06, 0.04, wood());
        if (!gap(i) && !gap(i + 1)) list.push(rail);
      }
    }

    // Each gateway: a crossbeam over the way through, with a short board beneath it.
    const gateway = (left: (typeof posts)[number], right: (typeof posts)[number]) => {
      const beamY = Math.max(left.ground, right.ground) + GATE_HEIGHT - 0.12;
      // A point level with `y` on the post's centre, pushed `reach` further out to the side.
      const across = (post: { x: number; z: number }, y: number, reach: number) =>
        new THREE.Vector3(post.x, y, post.z).addScaledVector(
          new THREE.Vector3(post.x - (left.x + right.x) / 2, 0, post.z - (left.z + right.z) / 2).normalize(),
          reach,
        );
      list.push(plank(across(left, beamY, 0.28), across(right, beamY, 0.28), 0.11, 0.13, wood()));
      list.push(plank(across(left, beamY - 0.2, 0), across(right, beamY - 0.2, 0), 0.05, 0.05, wood()));
    };
    gateway(posts[spans], posts[0]);
    if (bridgePosts.length === 2) gateway(posts[bridgePosts[0]], posts[bridgePosts[1]]);

    return list;
  }, []);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => withCameraFade(withGrowth(new THREE.MeshLambertMaterial({ flatShading: true })), 1.2, 3.2),
    [],
  );
  const mesh = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    boards.forEach((b, i) => {
      m.position.copy(b.position);
      m.rotation.copy(b.rotation);
      m.scale.copy(b.size);
      m.updateMatrix();
      mesh.current.setMatrixAt(i, m.matrix);
      mesh.current.setColorAt(i, b.color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [boards]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, boards.length]} />;
}
