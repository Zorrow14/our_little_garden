"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SATURATION_GLSL, sharedUniforms } from "@/lib/growth";
import { type Brook, brookDepth } from "@/lib/terrain";
import { NO_RAYCAST } from "./shared";

const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
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
  uniform float uLength;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform vec3 uGlint;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    // Darker down the middle, catching the sky toward the banks and at a glancing angle.
    float edge = abs(vUv.y - 0.5) * 2.0;
    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - clamp(view.y, 0.0, 1.0), 3.0);
    vec3 color = mix(uDeep, uSky, clamp(fresnel * 0.7 + edge * 0.25, 0.0, 1.0));
    // Ripples running downstream.
    float along = vUv.x * uLength;
    float ripple = pow(0.5 + 0.5 * sin(along * 7.0 - uTime * 2.4 + sin(vUv.y * 9.0 + along) * 1.5), 10.0);
    color += ripple * 0.12 * uGlint * (1.0 - edge);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    ${SATURATION_GLSL}
  }
`;

/**
 * The water in a brook: a ribbon along its channel, at a level the banks rise
 * above, so it shows only where the channel is deep and tapers away into the
 * hills at either end.
 */
export default function BrookWater({ brook, height }: { brook: Brook; height: (x: number, z: number) => number }) {
  const scene = useThree((s) => s.scene);

  const geometry = useMemo(() => {
    const steps = 72;
    const across = [-0.85, 0, 0.85];
    const positions: number[] = [];
    const uvs: number[] = [];
    const index: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = brook.angle - brook.spread + (i / steps) * brook.spread * 2;
      across.forEach((k, j) => {
        const r = brook.radius + k * brook.width;
        const x = brook.x + Math.cos(a) * r;
        const z = brook.z + Math.sin(a) * r;
        // Below the bank by a little over half the channel's depth.
        const banks = height(x, z) + brookDepth(brook, x, z);
        positions.push(x, banks - brook.depth * 0.5, z);
        uvs.push(i / steps, j / (across.length - 1));
      });
      if (i < steps) {
        for (let j = 0; j < across.length - 1; j++) {
          const p = i * across.length + j;
          const q = p + across.length;
          index.push(p, q, p + 1, p + 1, q, q + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(index);
    g.computeBoundingSphere();
    return g;
  }, [brook, height]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uTime: sharedUniforms.uTime,
          uSaturation: sharedUniforms.uSaturation,
          uLength: { value: brook.radius * brook.spread * 2 },
          uDeep: { value: new THREE.Color("#0a1630") },
          uSky: { value: new THREE.Color("#262a4e") },
          uGlint: { value: new THREE.Color("#c6cfff") },
        },
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        fog: true,
      }),
    [brook],
  );

  useFrame(() => {
    // Like the pond, it reflects the sky, whose horizon colour the sky writes into the fog.
    if (scene.fog) material.uniforms.uSky.value.copy(scene.fog.color);
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <mesh geometry={geometry} material={material} raycast={NO_RAYCAST} />;
}
