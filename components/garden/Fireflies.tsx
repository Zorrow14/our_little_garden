"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGardenStore } from "@/lib/gardenStore";
import { garden, sharedUniforms } from "@/lib/growth";
import { createRandom, distanceToPond, groundHeight, POND, WATER_Y } from "@/lib/terrain";

const MAX = 110;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute float aSeed;
  varying float vBrightness;
  void main() {
    vec3 p = position;
    float t = uTime * (0.25 + aSeed * 0.2);
    p.x += sin(t + aSeed * 12.0) * 0.8;
    p.y += sin(t * 1.3 + aSeed * 7.0) * 0.35;
    p.z += cos(t * 0.9 + aSeed * 3.0) * 0.8;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Capped so the ones drifting right past the camera stay small points of light.
    gl_PointSize = min(uSize * uPixelRatio * (0.6 + aSeed * 0.6) / -mvPosition.z, 44.0 * uPixelRatio);
    // Each one pulses on its own slow rhythm.
    vBrightness = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (1.2 + aSeed * 1.8) + aSeed * 40.0), 3.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vBrightness;
  void main() {
    float glow = pow(smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)), 2.2) * vBrightness;
    gl_FragColor = vec4(uColor * glow * 1.4, glow);
    #include <colorspace_fragment>
  }
`;

/** Fireflies drifting over the garden. A few from the start; more as it fills with flowers. */
export default function Fireflies() {
  const quality = useGardenStore((s) => s.quality);

  const geometry = useMemo(() => {
    const rand = createRandom(99);
    const positions = new Float32Array(MAX * 3);
    const seeds = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) {
      const r = Math.sqrt(rand()) * 11;
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 1.5;
      const floor = distanceToPond(x, z) < POND.radius ? WATER_Y : groundHeight(x, z);
      positions.set([x, floor + 0.35 + rand() * 2.2, z], i * 3);
      seeds[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: sharedUniforms.uTime,
          uPixelRatio: { value: 1 },
          uSize: { value: 220 },
          uColor: { value: new THREE.Color("#ffd98a") },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame(({ gl }) => {
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    const max = quality === "low" ? MAX / 2 : MAX;
    geometry.setDrawRange(0, Math.floor(max * (0.4 + 0.6 * garden.growth)));
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
