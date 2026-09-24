"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { withCameraFade, withGrowth } from "@/lib/growth";
import { createRandom, groundHeight } from "@/lib/terrain";

interface Tree {
  x: number;
  z: number;
  scale: number;
  lean: number;
}

const TREE_COUNT = 44;
/**
 * The trees ring the garden where they frame the view from any side. The camera
 * can orbit out among them (farther on a portrait phone), so trees fade away as
 * it gets close instead of blocking the view.
 */
const RING_INNER = 17;
const RING_DEPTH = 8;

const CANOPY_COLORS = ["#1e4a38", "#245240", "#1b4034", "#2d5b44", "#20463f"].map((c) => new THREE.Color(c));

export default function Trees() {
  const trees = useMemo(() => {
    const rand = createRandom(7);
    return Array.from({ length: TREE_COUNT }, (_, i): Tree => {
      const a = ((i + rand() * 0.8) / TREE_COUNT) * Math.PI * 2;
      const r = RING_INNER + rand() * RING_DEPTH;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, scale: 1.2 + rand() * 1, lean: (rand() - 0.5) * 0.12 };
    });
  }, []);

  // Each canopy is a cluster of three or four low-poly blobs.
  const blobs = useMemo(() => {
    const rand = createRandom(8);
    return trees.flatMap((t) => {
      const top = groundHeight(t.x, t.z) + 2.3 * t.scale;
      const count = 3 + Math.floor(rand() * 2);
      return Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + rand();
        const spread = i === 0 ? 0 : 0.55 * t.scale;
        return {
          x: t.x + Math.cos(a) * spread,
          y: top + (i === 0 ? 0.35 * t.scale : rand() * 0.3 * t.scale),
          z: t.z + Math.sin(a) * spread,
          r: (0.85 + rand() * 0.4) * t.scale,
          spin: rand() * Math.PI,
          color: CANOPY_COLORS[Math.floor(rand() * CANOPY_COLORS.length)],
        };
      });
    });
  }, [trees]);

  const trunkGeometry = useMemo(() => new THREE.CylinderGeometry(0.1, 0.18, 1, 6).translate(0, 0.5, 0), []);
  const canopyGeometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const trunkMaterial = useMemo(
    () => withCameraFade(withGrowth(new THREE.MeshLambertMaterial({ color: "#3b2d29" })), 3, 7),
    [],
  );
  const canopyMaterial = useMemo(
    () => withCameraFade(withGrowth(new THREE.MeshLambertMaterial({ flatShading: true })), 3, 7),
    [],
  );

  const trunks = useRef<THREE.InstancedMesh>(null!);
  const canopies = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    trees.forEach((t, i) => {
      m.position.set(t.x, groundHeight(t.x, t.z) - 0.1, t.z);
      m.rotation.set(0, 0, t.lean);
      m.scale.set(t.scale, 2.5 * t.scale, t.scale);
      m.updateMatrix();
      trunks.current.setMatrixAt(i, m.matrix);
    });
    blobs.forEach((b, i) => {
      m.position.set(b.x, b.y, b.z);
      m.rotation.set(0, b.spin, 0);
      m.scale.set(b.r, b.r * 0.85, b.r);
      m.updateMatrix();
      canopies.current.setMatrixAt(i, m.matrix);
      canopies.current.setColorAt(i, b.color);
    });
    trunks.current.instanceMatrix.needsUpdate = true;
    canopies.current.instanceMatrix.needsUpdate = true;
    if (canopies.current.instanceColor) canopies.current.instanceColor.needsUpdate = true;
    trunks.current.computeBoundingSphere();
    canopies.current.computeBoundingSphere();
  }, [trees, blobs]);

  useEffect(
    () => () => {
      [trunkGeometry, canopyGeometry, trunkMaterial, canopyMaterial].forEach((o) => o.dispose());
    },
    [trunkGeometry, canopyGeometry, trunkMaterial, canopyMaterial],
  );

  return (
    <>
      <instancedMesh ref={trunks} args={[trunkGeometry, trunkMaterial, trees.length]} />
      <instancedMesh ref={canopies} args={[canopyGeometry, canopyMaterial, blobs.length]} />
    </>
  );
}
