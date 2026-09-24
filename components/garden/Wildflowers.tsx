"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGardenStore } from "@/lib/gardenStore";
import { garden } from "@/lib/growth";
import { distanceToFlowers, distanceToPath } from "@/lib/layout";
import { createRandom, distanceToPond, groundHeight, POND, smoothstep } from "@/lib/terrain";

const COUNT = 300;
const COLORS = ["#f4b3c8", "#f7e3a3", "#c9b8f2", "#fbf7f2", "#a9c7f0", "#f2a7a0"].map((c) => new THREE.Color(c));

interface Blossom {
  x: number;
  y: number;
  z: number;
  height: number;
  size: number;
  tilt: number;
  yaw: number;
  /** Garden growth at which this one starts to sprout. */
  threshold: number;
  color: THREE.Color;
}

/** A small five-lobed blossom lying flat, facing up. */
function createBlossomGeometry() {
  const shape = new THREE.Shape();
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = 0.55 + 0.45 * Math.abs(Math.cos(2.5 * a));
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

/**
 * Tiny wildflowers that sprout across the garden as letters are read. Each has
 * its own growth threshold, so a few are there from the start and the rest
 * spread in gradually until the garden is full.
 */
export default function Wildflowers() {
  const quality = useGardenStore((s) => s.quality);
  const heads = useRef<THREE.InstancedMesh>(null!);
  const stems = useRef<THREE.InstancedMesh>(null!);
  const lastGrowth = useRef(-1);

  const blossoms = useMemo(() => {
    const rand = createRandom(31);
    const list: Blossom[] = [];
    while (list.length < COUNT) {
      const r = Math.sqrt(rand()) * 12;
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 0.8;
      if (distanceToPond(x, z) < POND.radius * 1.1 || distanceToPath(x, z) < 0.45 || distanceToFlowers(x, z) < 0.6) continue;
      const i = list.length;
      list.push({
        x,
        z,
        y: groundHeight(x, z),
        height: 0.12 + rand() * 0.2,
        size: 0.06 + rand() * 0.05,
        tilt: (rand() - 0.5) * 0.6,
        yaw: rand() * Math.PI * 2,
        threshold: -0.12 + 1.02 * (i / COUNT),
        color: COLORS[Math.floor(rand() * COLORS.length)],
      });
    }
    return list;
  }, []);

  const headGeometry = useMemo(() => createBlossomGeometry(), []);
  const stemGeometry = useMemo(() => new THREE.CylinderGeometry(0.005, 0.008, 1, 3).translate(0, 0.5, 0), []);
  const headMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: new THREE.Color("#2e2438") }),
    [],
  );
  const stemMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: "#3a5f36" }), []);

  useLayoutEffect(() => {
    blossoms.forEach((b, i) => heads.current.setColorAt(i, b.color));
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [blossoms]);

  useLayoutEffect(() => {
    const count = quality === "low" ? COUNT / 2 : COUNT;
    heads.current.count = count;
    stems.current.count = count;
  }, [quality]);

  const m = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const g = garden.growth;
    if (Math.abs(g - lastGrowth.current) < 0.002) return;
    lastGrowth.current = g;
    blossoms.forEach((b, i) => {
      const s = smoothstep(b.threshold, b.threshold + 0.15, g);
      m.position.set(b.x, b.y + b.height * s, b.z);
      m.rotation.set(b.tilt, b.yaw, 0);
      m.scale.setScalar(b.size * s + 1e-4);
      m.updateMatrix();
      heads.current.setMatrixAt(i, m.matrix);
      m.position.set(b.x, b.y, b.z);
      m.rotation.set(b.tilt * 0.3, 0, 0);
      m.scale.set(1, b.height * s + 1e-4, 1);
      m.updateMatrix();
      stems.current.setMatrixAt(i, m.matrix);
    });
    heads.current.instanceMatrix.needsUpdate = true;
    stems.current.instanceMatrix.needsUpdate = true;
  });

  useEffect(
    () => () => {
      [headGeometry, stemGeometry, headMaterial, stemMaterial].forEach((o) => o.dispose());
    },
    [headGeometry, stemGeometry, headMaterial, stemMaterial],
  );

  return (
    <>
      <instancedMesh ref={heads} args={[headGeometry, headMaterial, COUNT]} frustumCulled={false} />
      <instancedMesh ref={stems} args={[stemGeometry, stemMaterial, COUNT]} frustumCulled={false} />
    </>
  );
}
