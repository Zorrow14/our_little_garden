"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SATURATION_GLSL, sharedUniforms, withGrowth } from "@/lib/growth";
import { FLOWER_SPOTS, MOON_DIRECTION } from "@/lib/layout";
import { POND, WATER_Y } from "@/lib/terrain";

const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uSaturation;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uGlint;
  uniform vec3 uMoonDirection;
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform vec2 uLotus;
  varying vec3 vWorld;

  void main() {
    vec2 p = vWorld.xz;
    vec3 color = mix(uDeep, uShallow, smoothstep(0.15, 1.0, length(p - uCenter) / uRadius));

    // Small travelling waves perturb the normal so the moon's reflection shimmers.
    vec2 w = p * 3.0;
    vec3 n = normalize(vec3(
      0.06 * cos(w.x * 1.3 + uTime * 0.9) + 0.04 * cos((w.x + w.y) * 2.1 - uTime * 1.3),
      1.0,
      0.06 * cos(w.y * 1.1 - uTime * 0.7) + 0.04 * cos((w.x - w.y) * 1.7 + uTime * 1.1)
    ));
    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - clamp(dot(view, n), 0.0, 1.0), 3.0);
    color = mix(color, uSky, fresnel * 0.75);
    float moon = pow(max(dot(reflect(-view, n), uMoonDirection), 0.0), 160.0) * 0.9;

    // Slow rings spreading out from the lotus.
    float r = length(p - uLotus);
    float rings = pow(0.5 + 0.5 * sin(r * 13.0 - uTime * 1.4), 4.0) * smoothstep(1.9, 0.4, r) * 0.18;

    color += (moon + rings) * uGlint;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    ${SATURATION_GLSL}
  }
`;

const LILY_PADS = [
  { x: -1.2, z: 1.3, size: 0.34, spin: 0.4 },
  { x: -0.9, z: 3.3, size: 0.28, spin: 2.1 },
  { x: 1.5, z: 3.1, size: 0.3, spin: 4.0 },
  { x: 1.6, z: 1.2, size: 0.24, spin: 5.2 },
  { x: -1.75, z: 1.6, size: 0.22, spin: 1.1 },
  { x: 0.9, z: 0.6, size: 0.2, spin: 3.3 },
];

export default function Pond() {
  const scene = useThree((s) => s.scene);
  const lotus = FLOWER_SPOTS.lotus;

  const water = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uTime: sharedUniforms.uTime,
          uSaturation: sharedUniforms.uSaturation,
          uDeep: { value: new THREE.Color("#07122a") },
          uShallow: { value: new THREE.Color("#1a2c4c") },
          uSky: { value: new THREE.Color("#262a4e") },
          uGlint: { value: new THREE.Color("#c6cfff") },
          uMoonDirection: { value: MOON_DIRECTION.clone() },
          uCenter: { value: new THREE.Vector2(POND.x, POND.z) },
          uRadius: { value: POND.radius },
          uLotus: { value: new THREE.Vector2(lotus.x, lotus.z) },
        },
        vertexShader,
        fragmentShader,
        fog: true,
      }),
    [lotus.x, lotus.z],
  );

  const padGeometry = useMemo(() => new THREE.CircleGeometry(1, 22, 0.35, Math.PI * 2 - 0.35), []);
  const padMaterial = useMemo(
    () => withGrowth(new THREE.MeshLambertMaterial({ color: "#2c5536", side: THREE.DoubleSide })),
    [],
  );
  const pads = useRef<THREE.Group>(null!);

  useFrame((state) => {
    // The water reflects the sky, so it tracks the horizon colour the sky writes into the fog.
    if (scene.fog) water.uniforms.uSky.value.copy(scene.fog.color);
    const t = state.clock.elapsedTime;
    pads.current.children.forEach((pad, i) => {
      pad.position.y = WATER_Y + 0.006 + Math.sin(t * 0.8 + i * 1.7) * 0.005;
      pad.rotation.z = LILY_PADS[i].spin + Math.sin(t * 0.15 + i) * 0.1;
    });
  });

  useEffect(
    () => () => {
      water.dispose();
      padGeometry.dispose();
      padMaterial.dispose();
    },
    [water, padGeometry, padMaterial],
  );

  return (
    <group>
      <mesh material={water} position={[POND.x, WATER_Y, POND.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[POND.radius * 1.08, 64]} />
      </mesh>
      <group ref={pads}>
        {LILY_PADS.map((pad, i) => (
          <mesh
            key={i}
            geometry={padGeometry}
            material={padMaterial}
            position={[pad.x, WATER_Y + 0.006, pad.z]}
            rotation-x={-Math.PI / 2}
            scale={pad.size}
          />
        ))}
      </group>
    </group>
  );
}
