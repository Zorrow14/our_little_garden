"use client";

import { useFrame } from "@react-three/fiber";
import { sharedUniforms } from "@/lib/growth";

/** Advances the shared shader clock once per frame. */
export default function GrowthDriver() {
  useFrame((state) => {
    sharedUniforms.uTime.value = state.clock.elapsedTime;
  });
  return null;
}
