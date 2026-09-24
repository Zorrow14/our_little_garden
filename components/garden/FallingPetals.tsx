"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGardenStore } from "@/lib/gardenStore";
import { garden, sharedUniforms } from "@/lib/growth";
import { createPetalGeometry } from "@/lib/petal";
import { createRandom, groundHeight } from "@/lib/terrain";

const MAX = 36;

interface Petal {
  x: number;
  y: number;
  z: number;
  fall: number;
  sway: number;
  phase: number;
  spin: THREE.Vector3;
  rotation: THREE.Euler;
}

/** Drops a petal somewhere over the garden: anywhere in the air at first, then back at the top. */
function spawn(p: Petal, rand: () => number, anywhere: boolean) {
  const r = Math.sqrt(rand()) * 9;
  const a = rand() * Math.PI * 2;
  p.x = Math.cos(a) * r;
  p.z = Math.sin(a) * r - 1.5;
  p.y = anywhere ? 0.5 + rand() * 4.5 : 4 + rand() * 1.5;
}

/** A handful of petals drifting down on the breeze; more of them as the garden fills in. */
export default function FallingPetals() {
  const quality = useGardenStore((s) => s.quality);
  const mesh = useRef<THREE.InstancedMesh>(null!);

  const rand = useMemo(() => createRandom(57), []);
  const petals = useMemo(
    () =>
      Array.from({ length: MAX }, () => {
        const p: Petal = {
          x: 0,
          y: 0,
          z: 0,
          fall: 0.18 + rand() * 0.2,
          sway: 0.25 + rand() * 0.35,
          phase: rand() * Math.PI * 2,
          spin: new THREE.Vector3(rand() * 1.6, rand() * 1.2, rand() * 1.4),
          rotation: new THREE.Euler(rand() * 6, rand() * 6, rand() * 6),
        };
        spawn(p, rand, true);
        return p;
      }),
    [rand],
  );

  const geometry = useMemo(
    () =>
      createPetalGeometry(
        { length: 0.12, width: 0.08, cup: 0.35, curl: 0.1, tip: "round", baseColor: "#f6b3c8", tipColor: "#fde6ee" },
        { across: 3, along: 3 },
      ),
    [],
  );
  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        emissive: new THREE.Color("#4a2636"),
      }),
    [],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    const wind = sharedUniforms.uWind.value;
    const max = quality === "low" ? MAX / 2 : MAX;
    const active = Math.round(max * (0.15 + 0.85 * garden.growth));
    mesh.current.count = active;

    for (let i = 0; i < active; i++) {
      const p = petals[i];
      p.y -= p.fall * dt;
      p.x += (Math.sin(t * 0.7 + p.phase) * p.sway + 0.12 * wind) * dt;
      p.z += Math.cos(t * 0.5 + p.phase) * p.sway * 0.6 * dt;
      p.rotation.x += p.spin.x * dt;
      p.rotation.y += p.spin.y * dt;
      p.rotation.z += p.spin.z * dt;
      if (p.y < groundHeight(p.x, p.z) + 0.03) spawn(p, rand, false);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.copy(p.rotation);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, MAX]} frustumCulled={false} />;
}
