"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { withGrowth } from "@/lib/growth";
import { PATH_CURVE } from "@/lib/layout";
import { createRandom, groundHeight } from "@/lib/terrain";

const STONE_SPACING = 0.72;

/** Stepping stones along the path to the final bloom. */
export default function Path() {
  const stones = useMemo(() => {
    const rand = createRandom(5);
    const count = Math.floor(PATH_CURVE.getLength() / STONE_SPACING);
    return Array.from({ length: count }, (_, i) => {
      const u = (i + 0.5) / count;
      const p = PATH_CURVE.getPointAt(u);
      const tangent = PATH_CURVE.getTangentAt(u);
      const sideways = (rand() - 0.5) * 0.24;
      const x = p.x - tangent.z * sideways;
      const z = p.z + tangent.x * sideways;
      return { x, z, size: 0.8 + rand() * 0.35, spin: rand() * Math.PI, tilt: (rand() - 0.5) * 0.08 };
    });
  }, []);

  const geometry = useMemo(() => new THREE.CylinderGeometry(0.3, 0.34, 0.08, 7), []);
  const material = useMemo(() => withGrowth(new THREE.MeshLambertMaterial({ color: "#857f76", flatShading: true })), []);
  const mesh = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    stones.forEach((s, i) => {
      m.position.set(s.x, groundHeight(s.x, s.z) + 0.015, s.z);
      m.rotation.set(s.tilt, s.spin, s.tilt);
      m.scale.set(s.size, 1, s.size * 0.85);
      m.updateMatrix();
      mesh.current.setMatrixAt(i, m.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [stones]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, stones.length]} />;
}
