"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { withGrowth } from "@/lib/growth";
import { createRandom } from "@/lib/terrain";
import type { Point } from "@/lib/wander";

const STONE_SPACING = 0.72;

/**
 * Stepping stones along straight runs, like the garden's path: in from the
 * fence to the bridge, and across the far garden. One instanced mesh.
 */
export default function SteppingStones({
  runs,
  height,
  seed,
}: {
  runs: [Point, Point][];
  height: (x: number, z: number) => number;
  seed: number;
}) {
  const stones = useMemo(() => {
    const rand = createRandom(seed);
    return runs.flatMap(([a, b]) => {
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const count = Math.max(1, Math.round(length / STONE_SPACING));
      const across = { x: -(b.z - a.z) / length, z: (b.x - a.x) / length };
      return Array.from({ length: count }, (_, i) => {
        const t = (i + 0.5) / count;
        const sideways = (rand() - 0.5) * 0.24;
        const x = a.x + (b.x - a.x) * t + across.x * sideways;
        const z = a.z + (b.z - a.z) * t + across.z * sideways;
        return { x, z, size: 0.8 + rand() * 0.35, spin: rand() * Math.PI, tilt: (rand() - 0.5) * 0.08 };
      });
    });
  }, [runs, seed]);

  const geometry = useMemo(() => new THREE.CylinderGeometry(0.3, 0.34, 0.08, 7), []);
  const material = useMemo(() => withGrowth(new THREE.MeshLambertMaterial({ color: "#857f76", flatShading: true })), []);
  const mesh = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    stones.forEach((s, i) => {
      m.position.set(s.x, height(s.x, s.z) + 0.015, s.z);
      m.rotation.set(s.tilt, s.spin, s.tilt);
      m.scale.set(s.size, 1, s.size * 0.85);
      m.updateMatrix();
      mesh.current.setMatrixAt(i, m.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [stones, height]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, stones.length]} />;
}
