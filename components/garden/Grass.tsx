"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGardenStore } from "@/lib/gardenStore";
import { garden, SATURATION_GLSL, sharedUniforms } from "@/lib/growth";
import { distanceToFlowers, distanceToPath } from "@/lib/layout";
import { distanceToProps } from "@/lib/props";
import { night } from "@/lib/stargazing";
import { createRandom, distanceToPond, groundHeight, POND } from "@/lib/terrain";

const CLUMPS = 820;
const BLADES_PER_CLUMP = 11;
const MAX_BLADES = CLUMPS * BLADES_PER_CLUMP;

/** A tapered blade in three segments that bends slightly forward toward its tip. */
function createBladeGeometry() {
  const levels = [0, 0.38, 0.72];
  const widths = [0.055, 0.042, 0.024];
  const positions: number[] = [];
  const uvs: number[] = [];
  levels.forEach((h, i) => {
    const bend = h * h * 0.12;
    positions.push(-widths[i] / 2, h, bend, widths[i] / 2, h, bend);
    uvs.push(0, h, 1, h);
  });
  positions.push(0, 1, 0.12);
  uvs.push(0.5, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6]);
  return g;
}

const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  uniform float uTime;
  uniform float uWind;
  varying float vHeight;
  varying vec3 vTint;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    float h = uv.y;
    float gust = sin(uTime * 1.6 + world.x * 0.55 + world.z * 0.35)
      + 0.45 * sin(uTime * 2.9 + world.x * 1.7 - world.z * 0.9);
    world.xz += vec2(0.11, 0.05) * gust * h * h * uWind;
    vHeight = h;
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #else
      vTint = vec3(1.0);
    #endif
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uBase;
  uniform vec3 uTip;
  uniform float uBrightness;
  uniform float uSaturation;
  varying float vHeight;
  varying vec3 vTint;
  void main() {
    vec3 color = mix(uBase, uTip, smoothstep(0.0, 1.0, vHeight)) * vTint * uBrightness;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    ${SATURATION_GLSL}
  }
`;

/** Where a field of grass grows: within `radius` of `center`, on `height`, wherever `open` allows a clump. */
export interface GrassField {
  radius: number;
  center: [number, number];
  height: (x: number, z: number) => number;
  open: (x: number, z: number) => boolean;
}

/** The garden's grass: inside the fence, round the pond, off the path, and clear of the flowers and props. */
const GARDEN_FIELD: GrassField = {
  radius: 12.5,
  center: [0, -0.5],
  height: groundHeight,
  open: (x, z) =>
    distanceToPond(x, z) >= POND.radius * 1.02 &&
    distanceToPath(x, z) >= 0.5 &&
    distanceToFlowers(x, z) >= 0.35 &&
    // Not up through the dock's boards.
    distanceToProps(x, z) >= 0.15,
};

export default function Grass({ field = GARDEN_FIELD }: { field?: GrassField }) {
  const quality = useGardenStore((s) => s.quality);
  const mesh = useRef<THREE.InstancedMesh>(null!);

  // Blades are generated clump by clump in random order, so drawing only the
  // first N still spreads grass evenly across the garden.
  const blades = useMemo(() => {
    const rand = createRandom(11);
    const m = new THREE.Object3D();
    const matrices = new Float32Array(MAX_BLADES * 16);
    const colors = new Float32Array(MAX_BLADES * 3);
    let count = 0;
    for (let attempt = 0; attempt < CLUMPS * 6 && count < MAX_BLADES; attempt++) {
      const r = Math.sqrt(rand()) * field.radius;
      const a = rand() * Math.PI * 2;
      const cx = Math.cos(a) * r + field.center[0];
      const cz = Math.sin(a) * r + field.center[1];
      if (!field.open(cx, cz)) continue;
      const tint = 0.75 + rand() * 0.45;
      for (let b = 0; b < BLADES_PER_CLUMP && count < MAX_BLADES; b++) {
        const x = cx + (rand() - 0.5) * 0.45;
        const z = cz + (rand() - 0.5) * 0.45;
        m.position.set(x, field.height(x, z) - 0.02, z);
        m.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
        const width = 0.8 + rand() * 0.7;
        m.scale.set(width, 0.18 + rand() * 0.3, width);
        m.updateMatrix();
        m.matrix.toArray(matrices, count * 16);
        colors.set([tint * (0.9 + rand() * 0.2), tint, tint * (0.85 + rand() * 0.2)], count * 3);
        count++;
      }
    }
    return { matrices, colors, count };
  }, [field]);

  const geometry = useMemo(() => createBladeGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uBase: { value: new THREE.Color("#14261a") },
          uTip: { value: new THREE.Color("#3d5c35") },
          uBrightness: { value: 1 },
          uTime: sharedUniforms.uTime,
          uWind: sharedUniforms.uWind,
          uSaturation: sharedUniforms.uSaturation,
        },
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        fog: true,
      }),
    [],
  );

  useLayoutEffect(() => {
    mesh.current.instanceMatrix.array.set(blades.matrices);
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor = new THREE.InstancedBufferAttribute(blades.colors, 3);
  }, [blades]);

  useLayoutEffect(() => {
    mesh.current.count = quality === "low" ? Math.floor(blades.count * 0.45) : blades.count;
  }, [quality, blades]);

  useFrame(() => {
    material.uniforms.uBrightness.value = (0.72 + 0.3 * garden.growth) * (1 - 0.35 * night.amount);
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, MAX_BLADES]} frustumCulled={false} />;
}
