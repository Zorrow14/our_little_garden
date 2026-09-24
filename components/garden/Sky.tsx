"use client";

import { Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { garden, SATURATION_GLSL, sharedUniforms } from "@/lib/growth";
import { MOON_DIRECTION } from "@/lib/layout";
import { getGlowTexture } from "@/lib/textures";

/** [growth 0, growth 1]: a quiet blue hour that warms toward violet dusk as the garden fills in. */
const PALETTE = {
  top: [new THREE.Color("#060a1c"), new THREE.Color("#0b0f30")],
  horizon: [new THREE.Color("#262a4e"), new THREE.Color("#4b3b6e")],
  below: [new THREE.Color("#0b1020"), new THREE.Color("#151435")],
};

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBelow;
  uniform float uSaturation;
  varying vec3 vDirection;
  void main() {
    float y = vDirection.y;
    vec3 color = y > 0.0
      ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.65, y), 0.7))
      : mix(uHorizon, uBelow, smoothstep(0.0, -0.25, y));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
    ${SATURATION_GLSL}
  }
`;

export default function Sky() {
  const scene = useThree((s) => s.scene);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: PALETTE.top[0].clone() },
          uHorizon: { value: PALETTE.horizon[0].clone() },
          uBelow: { value: PALETTE.below[0].clone() },
          uSaturation: sharedUniforms.uSaturation,
        },
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const g = garden.growth;
    const u = material.uniforms;
    u.uTop.value.lerpColors(PALETTE.top[0], PALETTE.top[1], g);
    u.uHorizon.value.lerpColors(PALETTE.horizon[0], PALETTE.horizon[1], g);
    u.uBelow.value.lerpColors(PALETTE.below[0], PALETTE.below[1], g);
    // Fog fades distant hills into the horizon colour, so the two must match.
    if (scene.fog) scene.fog.color.copy(u.uHorizon.value);
  });

  return (
    <>
      <mesh material={material} renderOrder={-1}>
        <sphereGeometry args={[90, 32, 16]} />
      </mesh>
      <Stars radius={60} depth={24} count={1400} factor={2.6} saturation={0} fade speed={0.35} />
      <Moon />
    </>
  );
}

function Moon() {
  const texture = useMemo(() => getGlowTexture(), []);
  const position = useMemo(() => MOON_DIRECTION.clone().multiplyScalar(80).toArray(), []);
  return (
    <group position={position}>
      <sprite scale={30}>
        <spriteMaterial map={texture} color="#9aa6e8" transparent opacity={0.35} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={5.2}>
        <spriteMaterial map={texture} color="#f4f1ff" transparent depthWrite={false} fog={false} />
      </sprite>
    </group>
  );
}
