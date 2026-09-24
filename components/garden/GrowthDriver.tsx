"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { bloomedLetterCount, LETTER_IDS, useGardenStore } from "@/lib/gardenStore";
import { garden, sharedUniforms } from "@/lib/growth";

/**
 * Eases the garden's growth toward the share of letters read, and advances the
 * shared shader clock and breeze. Everything that grows reads `garden.growth` each frame.
 */
export default function GrowthDriver() {
  const hydrated = useGardenStore((s) => s.hydrated);
  const bloomed = useGardenStore(bloomedLetterCount);
  const settled = useRef(false);

  useFrame((state, dt) => {
    const target = bloomed / LETTER_IDS.length;
    // A returning visitor sees the garden as she left it; growth only animates after a new letter.
    if (!settled.current && hydrated) {
      garden.growth = target;
      settled.current = true;
    }
    garden.growth = THREE.MathUtils.damp(garden.growth, target, 0.6, dt);
    const t = state.clock.elapsedTime;
    sharedUniforms.uTime.value = t;
    sharedUniforms.uSaturation.value = 0.45 + 0.55 * garden.growth;
    // A gentle breeze that rises and falls in slow, overlapping gusts.
    sharedUniforms.uWind.value = 0.75 + 0.3 * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 0.61 + 1.3);
  });

  return null;
}
