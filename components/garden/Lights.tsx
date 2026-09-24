"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { garden } from "@/lib/growth";
import { MOON_DIRECTION } from "@/lib/layout";

const MOON_POSITION = MOON_DIRECTION.clone().multiplyScalar(20).toArray();

/** Moonlight plus a cool sky fill. Both brighten a little as the garden grows. */
export default function Lights() {
  const sky = useRef<THREE.HemisphereLight>(null!);
  const moon = useRef<THREE.DirectionalLight>(null!);

  useFrame(() => {
    sky.current.intensity = 1.1 + 0.5 * garden.growth;
    moon.current.intensity = 1.5 + 0.5 * garden.growth;
  });

  return (
    <>
      <hemisphereLight ref={sky} args={["#8f96d6", "#1c2b24", 1.1]} />
      <directionalLight ref={moon} position={MOON_POSITION} color="#d4dcff" intensity={1.5} />
    </>
  );
}
