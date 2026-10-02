"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { garden } from "@/lib/growth";
import { MOON_DIRECTION } from "@/lib/layout";
import { night } from "@/lib/stargazing";

const MOON_POSITION = MOON_DIRECTION.clone().multiplyScalar(20).toArray();

/** Moonlight plus a cool sky fill. Both brighten a little as the garden grows, and dim when night falls for stargazing. */
export default function Lights() {
  const sky = useRef<THREE.HemisphereLight>(null!);
  const moon = useRef<THREE.DirectionalLight>(null!);

  useFrame(() => {
    sky.current.intensity = (1.1 + 0.5 * garden.growth) * (1 - 0.5 * night.amount);
    moon.current.intensity = (1.5 + 0.5 * garden.growth) * (1 - 0.3 * night.amount);
  });

  return (
    <>
      <hemisphereLight ref={sky} args={["#8f96d6", "#1c2b24", 1.1]} />
      <directionalLight ref={moon} position={MOON_POSITION} color="#d4dcff" intensity={1.5} />
    </>
  );
}
